import { z } from "zod";

const answerSchema = z.object({
  id: z.string(),
  text: z.string(),
  is_correct: z.boolean().nullable().optional(),
  image_url: z.string().nullable().optional(),
});
export const liveSnapshotSchema = z.object({
  pin: z.string(),
  game_instance_id: z.string(),
  updated_at: z.string(),
  status: z.enum(["waiting", "active", "reveal", "finished"]),
  current_question_index: z.number(),
  current_question: z
    .object({
      id: z.string(),
      text: z.string(),
      question_type: z.string().optional(),
      image_url: z.string().nullable().optional(),
      video_url: z.string().nullable().optional(),
      time_limit: z.number().optional(),
      answers: z.array(answerSchema),
    })
    .nullable(),
  players: z.array(
    z.object({ id: z.string(), nickname: z.string(), score: z.number() }),
  ),
  current_answers: z
    .array(
      z.object({
        player_id: z.string(),
        answer_id: z.string(),
        is_correct: z.boolean().optional(),
        points_awarded: z.number().optional(),
      }),
    )
    .optional(),
  ready_player_ids: z.array(z.string()).optional(),
  eliminated: z.array(z.string()).optional(),
  game_mode: z.string().optional(),
  teams: z
    .record(
      z.string(),
      z.object({ id: z.string(), name: z.string(), score: z.number() }),
    )
    .optional(),
  team_assignments: z.record(z.string(), z.string()).optional(),
});
export type LiveSnapshot = z.infer<typeof liveSnapshotSchema>;
export const savedPlayerSchema = z.object({
  version: z.literal(1),
  pin: z.string().regex(/^[A-Z0-9]{6}$/),
  instance: z.string(),
  player_id: z.string(),
  player_token: z.string(),
});
export type SavedPlayer = z.infer<typeof savedPlayerSchema>;
export interface LiveTransport {
  request(
    pin: string,
    action: "join" | "reconnect",
    payload: Record<string, unknown>,
  ): Promise<unknown>;
  connect(
    player: SavedPlayer,
    update: (data: unknown) => void,
    connection: (connected: boolean, error?: string) => void,
  ): () => void;
  command(
    event: "player:answer" | "player:ready",
    payload: Record<string, unknown>,
  ): Promise<unknown>;
}
export interface PlayerStorage {
  save(player: SavedPlayer): Promise<void>;
  clear(): Promise<void>;
}
export type LiveState = {
  session: LiveSnapshot | null;
  connected: boolean;
  busy: boolean;
  error: string;
  playerId: string | null;
  lockedQuestion: string | null;
};
export class LiveGame {
  state: LiveState = {
    session: null,
    connected: false,
    busy: false,
    error: "",
    playerId: null,
    lockedQuestion: null,
  };
  private player: SavedPlayer | null = null;
  private disconnect: (() => void) | null = null;
  private epoch = 0;
  private disposed = false;
  private connectionError = "";
  constructor(
    private transport: LiveTransport,
    private storage: PlayerStorage,
    private changed: (state: LiveState) => void,
  ) {}
  private set(patch: Partial<LiveState>) {
    if (this.disposed) return;
    this.state = { ...this.state, ...patch };
    this.changed(this.state);
  }
  private valid(epoch: number) {
    return !this.disposed && epoch === this.epoch;
  }
  private fail(error: unknown) {
    this.set({
      error:
        error instanceof z.ZodError
          ? "The game returned an unsupported response. Try reconnecting."
          : error instanceof Error
            ? error.message
            : "Could not reach the game. Try reconnecting.",
    });
  }
  private credentials() {
    return {
      player_id: this.player!.player_id,
      player_token: this.player!.player_token,
    };
  }
  private accept(data: unknown) {
    const session = liveSnapshotSchema.parse(
      (data as { session: unknown }).session,
    );
    if (
      session.pin !== this.player?.pin ||
      session.game_instance_id !== this.player.instance
    ) {
      this.suspend();
      this.set({
        error:
          "This game has expired or was replaced. Leave and ask the host for a new PIN.",
      });
      return;
    }
    const previous = this.state.session;
    if (
      previous?.status === "finished" ||
      (previous && session.updated_at < previous.updated_at)
    )
      return;
    if (
      session.status === "active" &&
      session.current_question?.id === previous?.current_question?.id &&
      session.current_answers === undefined
    )
      session.current_answers = previous?.current_answers;
    const own = session.current_answers?.find(
      (a) => a.player_id === this.player?.player_id,
    );
    this.set({
      session,
      lockedQuestion: own
        ? (session.current_question?.id ?? null)
        : session.current_question?.id === previous?.current_question?.id
          ? this.state.lockedQuestion
          : null,
    });
    if (session.status === "finished") {
      this.suspend();
      void this.storage.clear().catch(() =>
        this.set({
          error: "Game finished. Could not clear the saved reconnect identity.",
        }),
      );
    }
  }
  private connect() {
    if (!this.player || this.state.session?.status === "finished") return;
    const epoch = this.epoch;
    this.disconnect = this.transport.connect(
      this.player,
      (data) => {
        if (!this.valid(epoch)) return;
        try {
          this.accept(data);
        } catch (error) {
          this.fail(error);
        }
      },
      (connected, error) => {
        if (!this.valid(epoch)) return;
        const clearOldError =
          connected && this.state.error === this.connectionError;
        if (error) this.connectionError = error;
        this.set({
          connected,
          ...(error ? { error } : clearOldError ? { error: "" } : {}),
        });
      },
    );
  }
  async join(pin: string, nickname: string) {
    if (this.state.busy || this.player || this.disposed) return;
    if (!/^[A-Z0-9]{6}$/.test(pin)) {
      this.set({ error: "Enter the six-character PIN shown by your host." });
      return;
    }
    if (!nickname.trim() || nickname.trim().length > 24) {
      this.set({ error: "Enter a name between 1 and 24 characters." });
      return;
    }
    const epoch = ++this.epoch;
    this.set({ busy: true, error: "" });
    try {
      const body = (await this.transport.request(pin, "join", {
        nickname: nickname.trim(),
      })) as Record<string, unknown>;
      if (!this.valid(epoch)) return;
      const session = liveSnapshotSchema.parse(body.session);
      const player = savedPlayerSchema.parse({
        version: 1,
        pin,
        instance: session.game_instance_id,
        player_id: body.player_id,
        player_token: body.player_token,
      });
      if (session.pin !== pin)
        throw new Error("Game PIN did not match the server response.");
      this.player = player;
      this.set({ playerId: player.player_id });
      try {
        await this.storage.save(player);
      } catch {
        if (this.valid(epoch))
          this.set({
            error:
              "Joined, but secure reconnect storage failed. Keep this screen open; restarting may lose your place.",
          });
      }
      if (!this.valid(epoch)) return;
      this.accept(body);
      this.connect();
    } catch (error) {
      if (this.valid(epoch)) this.fail(error);
    } finally {
      if (this.valid(epoch)) this.set({ busy: false });
    }
  }
  async restore(player: SavedPlayer) {
    if (this.player || this.disposed) return;
    this.player = savedPlayerSchema.parse(player);
    this.set({ playerId: player.player_id });
    await this.resume();
  }
  suspend() {
    this.epoch++;
    const close = this.disconnect;
    this.disconnect = null;
    close?.();
    this.set({ connected: false, busy: false });
  }
  async resume() {
    if (
      !this.player ||
      this.disposed ||
      this.state.session?.status === "finished"
    )
      return;
    this.suspend();
    const epoch = this.epoch;
    this.set({ busy: true, error: "" });
    try {
      const body = await this.transport.request(
        this.player.pin,
        "reconnect",
        this.credentials(),
      );
      if (!this.valid(epoch)) return;
      this.accept(body);
      if (this.valid(epoch)) this.connect();
    } catch (error) {
      if (this.valid(epoch)) this.fail(error);
    } finally {
      if (this.valid(epoch)) this.set({ busy: false });
    }
  }
  async answer(answerId: string) {
    const question = this.state.session?.current_question;
    if (
      !this.player ||
      !question ||
      !this.state.connected ||
      this.state.session?.status !== "active" ||
      this.state.lockedQuestion === question.id ||
      this.state.session.eliminated?.includes(this.player.player_id) ||
      !question.answers.some((a) => a.id === answerId)
    )
      return;
    // An attempted answer is never replayed, even if a command times out.
    this.set({ lockedQuestion: question.id, error: "" });
    const epoch = this.epoch;
    try {
      const body = await this.transport.command("player:answer", {
        ...this.credentials(),
        answer_id: answerId,
      });
      if (this.valid(epoch)) this.accept(body);
    } catch (error) {
      if (this.valid(epoch)) this.fail(error);
    }
  }
  async ready() {
    if (
      !this.player ||
      !this.state.connected ||
      this.state.busy ||
      this.state.session?.status !== "waiting"
    )
      return;
    const epoch = this.epoch;
    this.set({ busy: true, error: "" });
    try {
      const body = await this.transport.command(
        "player:ready",
        this.credentials(),
      );
      if (this.valid(epoch)) this.accept(body);
    } catch (error) {
      if (this.valid(epoch)) this.fail(error);
    } finally {
      if (this.valid(epoch)) this.set({ busy: false });
    }
  }
  async leave() {
    this.suspend();
    await this.storage.clear();
    this.player = null;
    this.set({
      session: null,
      playerId: null,
      lockedQuestion: null,
      error: "",
    });
  }
  dispose() {
    this.suspend();
    this.disposed = true;
  }
}
