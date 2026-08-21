import { buildDraftSavePayload, type RecoverableDraft } from "./quiz-lifecycle";

type DraftValue = RecoverableDraft & { editingQuizId: string | null };
type RpcResult = { data: unknown; error: { message?: string } | null };
export type DraftClient = {
  rpc(name: string, payload: unknown): PromiseLike<RpcResult>;
};

export class DraftRevisionConflictError extends Error {
  constructor(public readonly serverRevision: number | null) {
    super("This draft changed in another tab. Reload before saving again.");
    this.name = "DraftRevisionConflictError";
  }
}

export async function saveQuizDraftV2WithConflictRecovery(input: {
  client: DraftClient;
  draftId: string | null;
  expectedRevision: number | null;
  value: DraftValue;
}) {
  const request = (expectedRevision: number | null) => input.client.rpc("save_quiz_draft_v2", buildDraftSavePayload({
    draftId: input.draftId, expectedRevision, quizId: input.value.editingQuizId,
    title: input.value.title, category: input.value.category, emoji: input.value.emoji,
    color: "", isPublic: input.value.isPublic, sourceType: input.value.sourceType,
    questions: input.value.questions,
  }));
  let result = await request(input.expectedRevision);
  const isRevisionConflict = (candidate: RpcResult) => {
    const data = candidate.data as { ok?: unknown; error?: unknown } | null;
    return /revision|conflict|stale/i.test(candidate.error?.message || "")
      || (data?.ok === false && data.error === "revision_conflict");
  };

  if (isRevisionConflict(result)) {
    const data = result.data as { revision?: unknown } | null;
    throw new DraftRevisionConflictError(typeof data?.revision === "number" ? data.revision : null);
  }
  if (result.error) throw result.error;
  const saved = result.data as { ok?: boolean; error?: string; draft_id?: string; revision?: number } | null;
  if (saved?.ok === false) throw new Error(saved.error || "Draft save failed.");
  if (!saved?.draft_id || typeof saved.revision !== "number") throw new Error("Draft save did not return its id and revision.");
  return { draftId: saved.draft_id, revision: saved.revision };
}
