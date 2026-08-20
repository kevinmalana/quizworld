import { buildDraftSavePayload, type RecoverableDraft } from "./quiz-lifecycle";

type DraftValue = RecoverableDraft & { editingQuizId: string | null };
type RpcResult = { data: unknown; error: { message?: string } | null };
export type DraftClient = {
  rpc(name: string, payload: unknown): PromiseLike<RpcResult>;
  from(name: string): {
    select(columns: string): { eq(column: string, value: string): { single(): PromiseLike<RpcResult> } };
  };
};

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
  if (result.error && input.draftId && /revision|conflict|stale/i.test(result.error.message || "")) {
    const current = await input.client.from("quiz_drafts").select("revision").eq("id", input.draftId).single();
    const revision = (current.data as { revision?: unknown } | null)?.revision;
    if (current.error || typeof revision !== "number") throw result.error;
    result = await request(revision);
  }
  if (result.error) throw result.error;
  const saved = result.data as { draft_id?: string; revision?: number } | null;
  if (!saved?.draft_id || typeof saved.revision !== "number") throw new Error("Draft save did not return its id and revision.");
  return { draftId: saved.draft_id, revision: saved.revision };
}
