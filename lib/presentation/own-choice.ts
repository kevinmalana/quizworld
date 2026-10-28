/** The option/answer this participant chose, from the server's own_response row. */
export function ownChoiceFrom(ownResponse: unknown): string | null {
  if (!ownResponse || typeof ownResponse !== "object") return null;
  const data = (ownResponse as { response_data?: unknown }).response_data;
  if (!data || typeof data !== "object") return null;
  const { option_id: optionId, answer_id: answerId } = data as { option_id?: unknown; answer_id?: unknown };
  if (typeof answerId === "string" && answerId) return answerId;
  if (typeof optionId === "string" && optionId) return optionId;
  return null;
}

/** The id a participant is submitting for a poll/quiz response payload. */
export function choiceFromPayload(data: Record<string, unknown>): string | null {
  const id = data.answer_id ?? data.option_id;
  return typeof id === "string" && id ? id : null;
}

export type QuizOptionView = {
  className: string;
  /** Shown after the reveal: ✅ on the right answer, ❌ only on the participant's own wrong pick. */
  mark: "correct" | "wrong" | null;
  isOwn: boolean;
};

/**
 * How one quiz answer looks to a participant. Before the reveal only their own
 * pick is highlighted. After it, the right answer is marked for everyone and a
 * ❌ appears only on the answer this participant actually chose, so a wrong
 * guess is unmistakable and other options are not all marked wrong.
 */
export function quizOptionView(opts: {
  answerId: string;
  ownChoice: string | null;
  revealedCorrectIds: string[] | undefined;
}): QuizOptionView {
  const { answerId, ownChoice, revealedCorrectIds } = opts;
  const isOwn = ownChoice === answerId;
  const revealed = Array.isArray(revealedCorrectIds);
  const isCorrect = revealed && revealedCorrectIds!.includes(answerId);
  const classes = ["present-quiz-option"];
  if (isOwn) classes.push("is-own");
  if (revealed && isCorrect) classes.push("is-correct");
  if (revealed && isOwn && !isCorrect) classes.push("is-wrong");
  return {
    className: classes.join(" "),
    mark: revealed && isCorrect ? "correct" : revealed && isOwn ? "wrong" : null,
    isOwn,
  };
}
