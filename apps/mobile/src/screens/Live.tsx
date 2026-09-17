import React, { useEffect, useRef, useState } from "react";
import { AppState, Image, Platform, TextInput } from "react-native";
import { LiveGame, type LiveState } from "../live";
import { createLiveTransport } from "../live-transport";
import { livePlayerStore } from "../live-device-store";
import {
  Page,
  Heading,
  Title,
  Body,
  Meta,
  Card,
  Button,
  Notice,
  Loading,
  s,
} from "../ui";

export function Live() {
  const [state, setState] = useState<LiveState>({
    session: null,
    connected: false,
    busy: false,
    error: "",
    playerId: null,
    lockedQuestion: null,
  });
  const controller = useRef<LiveGame | null>(null);
  const [loading, setLoading] = useState(true);
  const [localError, setLocalError] = useState("");
  const [pin, setPin] = useState("");
  const [nickname, setNickname] = useState("");
  const [nameStep, setNameStep] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);
  useEffect(() => {
    let current = true;
    const game = new LiveGame(
      createLiveTransport(),
      livePlayerStore,
      (next) => {
        if (current) setState(next);
      },
    );
    controller.current = game;
    void livePlayerStore
      .load()
      .then(async (saved) => {
        if (current && saved) await game.restore(saved);
      })
      .catch(() => {
        if (current)
          setLocalError(
            "Saved player identity could not be loaded. Clear it below or retry after unlocking your device.",
          );
      })
      .finally(() => {
        if (current) setLoading(false);
      });
    const subscription = AppState.addEventListener("change", (status) => {
      if (status === "active") void game.resume();
      else game.suspend();
    });
    return () => {
      current = false;
      subscription.remove();
      game.dispose();
      controller.current = null;
    };
  }, []);
  const leave = async () => {
    try {
      await controller.current?.leave();
      setLocalError("");
      setConfirmLeave(false);
      setNameStep(false);
    } catch {
      setLocalError(
        "Could not clear your saved player identity. Please try again.",
      );
    }
  };
  const session = state.session;
  const own = session?.current_answers?.find(
    (a) => a.player_id === state.playerId,
  );
  const question = session?.current_question;
  const eliminated = session?.eliminated?.includes(state.playerId ?? "");
  const ready = session?.ready_player_ids?.includes(state.playerId ?? "");
  const teamId = session?.team_assignments?.[state.playerId ?? ""];
  const team = teamId ? session?.teams?.[teamId] : null;
  if (loading)
    return (
      <Page>
        <Loading label="Checking your saved game…" />
      </Page>
    );
  return (
    <Page>
      <Heading>
        {session?.status === "finished"
          ? "Game complete."
          : session
            ? "You’re part of the game."
            : "Join the room."}
      </Heading>
      <Meta>
        Live with www.quizworld.xyz · guest player · no account required
      </Meta>
      <Notice message={localError || state.error} />
      {!session && !state.playerId && !localError ? (
        <Card>
          {!nameStep ? (
            <>
              <Title>Enter your host’s PIN</Title>
              <TextInput
                accessibilityLabel="Game PIN"
                value={pin}
                onChangeText={(value) => setPin(value.toUpperCase())}
                autoCapitalize="characters"
                autoCorrect={false}
                maxLength={6}
                style={s.input}
              />
              <Button
                label="Continue to name"
                disabled={!/^[A-Z0-9]{6}$/.test(pin)}
                onPress={() => setNameStep(true)}
              />
            </>
          ) : (
            <>
              <Title>What should we call you?</Title>
              <Meta>PIN {pin} · your name is visible to the room.</Meta>
              <TextInput
                accessibilityLabel="Player name"
                value={nickname}
                onChangeText={setNickname}
                autoCorrect={false}
                maxLength={19}
                style={s.input}
              />
              <Button
                label={state.busy ? "Joining…" : "Join game"}
                disabled={state.busy || !nickname.trim()}
                signal
                onPress={() => {
                  void controller.current?.join(pin, nickname);
                }}
              />
              <Button
                label="Change PIN"
                secondary
                disabled={state.busy}
                onPress={() => setNameStep(false)}
              />
            </>
          )}
        </Card>
      ) : null}
      {session ? (
        <>
          <Meta>
            PIN {session.pin} · {session.game_mode ?? "classic"} ·{" "}
            {session.status === "finished"
              ? "Finished"
              : state.connected
                ? "Connected"
                : "Disconnected — answers disabled"}
          </Meta>
          {team ? (
            <Body>
              Your team: {team.name} · {team.score} points
            </Body>
          ) : null}
          {session.status === "waiting" ? (
            <Card>
              <Title>You’re in the lobby.</Title>
              <Body>
                {session.players.length} players here. The host starts the
                questions.
              </Body>
              {session.players.map((player) => (
                <Body key={player.id}>
                  {player.nickname}
                  {player.id === state.playerId ? " (you)" : ""}
                </Body>
              ))}
              {ready ? (
                <Body>Ready — waiting for the host.</Body>
              ) : (
                <Button
                  label="I’m ready"
                  disabled={!state.connected || state.busy}
                  onPress={() => {
                    void controller.current?.ready();
                  }}
                />
              )}
            </Card>
          ) : null}
          {question && session.status !== "finished" ? (
            <Card>
              <Meta>
                Question {session.current_question_index + 1}
                {question.time_limit
                  ? ` · ${question.time_limit}s server-controlled answer window`
                  : ""}
              </Meta>
              <Title>{question.text}</Title>
              {question.video_url ? (
                <Body>
                  This question includes a video. Watch the host’s screen; video
                  playback is not available in this app yet.
                </Body>
              ) : null}
              {question.image_url &&
              question.image_url.startsWith("https://") ? (
                <Image
                  source={{ uri: question.image_url }}
                  accessibilityLabel="Question illustration"
                  style={{ width: "100%", height: 200, resizeMode: "contain" }}
                />
              ) : null}
              {eliminated ? (
                <Body>
                  You’re spectating after elimination. Stay for the results.
                </Body>
              ) : null}
              {session.status === "active" ? (
                <>
                  {question.answers.map((answer, index) => (
                    <React.Fragment key={answer.id}>
                      {answer.image_url?.startsWith("https://") ? (
                        <Image
                          source={{ uri: answer.image_url }}
                          accessibilityLabel={`Answer ${index + 1} illustration`}
                          style={{
                            width: "100%",
                            height: 140,
                            resizeMode: "contain",
                          }}
                        />
                      ) : null}
                      <Button
                        label={answer.text || `Answer ${index + 1}`}
                        secondary
                        disabled={
                          !state.connected ||
                          state.lockedQuestion === question.id ||
                          eliminated
                        }
                        onPress={() => {
                          void controller.current?.answer(answer.id);
                        }}
                      />
                    </React.Fragment>
                  ))}
                  {state.lockedQuestion === question.id ? (
                    <Body>
                      {own
                        ? "Answer locked — confirmed by the game."
                        : "Answer sent; waiting for confirmation. Do not submit again."}
                    </Body>
                  ) : (
                    <Meta>
                      Choose once. The game server locks and scores your answer.
                    </Meta>
                  )}
                </>
              ) : (
                <>
                  <Title>Round revealed</Title>
                  <Body>
                    {own?.is_correct === true
                      ? "Correct — confirmed by the game."
                      : own?.is_correct === false
                        ? "Not this time — confirmed by the game."
                        : own
                          ? "Response received."
                          : "No answer recorded for this round."}
                  </Body>
                  {typeof own?.points_awarded === "number" ? (
                    <Body>{own.points_awarded} points awarded by the game</Body>
                  ) : null}
                  {question.answers.map((answer, index) => (
                    <React.Fragment key={answer.id}>
                      {answer.image_url?.startsWith("https://") ? (
                        <Image
                          source={{ uri: answer.image_url }}
                          accessibilityLabel={`Answer ${index + 1} illustration`}
                          style={{
                            width: "100%",
                            height: 140,
                            resizeMode: "contain",
                          }}
                        />
                      ) : null}
                      <Body key={answer.id}>
                        {answer.is_correct ? "✓ " : ""}
                        {answer.text || `Answer ${index + 1}`}
                      </Body>
                    </React.Fragment>
                  ))}
                  <Meta>Waiting for the host or server to continue.</Meta>
                </>
              )}
            </Card>
          ) : null}
          {session.status === "reveal" || session.status === "finished" ? (
            <Card>
              <Title>
                {session.status === "finished"
                  ? "Final scores"
                  : "Scores so far"}
              </Title>
              {[...session.players]
                .sort((a, b) => b.score - a.score)
                .map((player) => (
                  <Body key={player.id}>
                    {player.nickname}
                    {player.id === state.playerId ? " (you)" : ""} ·{" "}
                    {player.score} points
                  </Body>
                ))}
              <Meta>
                Scores come from Phoenix. This app does not award XP or write
                multiplayer results.
              </Meta>
            </Card>
          ) : null}
        </>
      ) : null}
      {state.playerId && session?.status !== "finished" ? (
        <Button
          label={state.busy ? "Checking game…" : "Reconnect / check game"}
          secondary
          disabled={state.busy}
          onPress={() => {
            void controller.current?.resume();
          }}
        />
      ) : null}
      {state.playerId || localError ? (
        <>
          {confirmLeave ? (
            <Card>
              <Body>
                Forget your saved player identity? Your name and answers remain
                in the host’s game. You may not be able to rejoin a game already
                in progress.
              </Body>
              <Button
                label="Confirm leave game"
                onPress={() => {
                  void leave();
                }}
              />
              <Button
                label="Keep my place"
                secondary
                onPress={() => setConfirmLeave(false)}
              />
            </Card>
          ) : (
            <Button
              label={
                session?.status === "finished"
                  ? "Close finished game"
                  : "Leave / clear saved game"
              }
              secondary
              onPress={() => setConfirmLeave(true)}
            />
          )}
        </>
      ) : null}
      <Meta>
        Online play only. Hosting and classrooms stay on the website.{" "}
        {Platform.OS === "web"
          ? "Browser preview saves reconnect identity in this tab; this is not native-device evidence."
          : "Your player identity is saved in device secure storage for reconnect."}
      </Meta>
    </Page>
  );
}
