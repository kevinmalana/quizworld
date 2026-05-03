export type HostQuizSearchItem = {
  title?: string | null;
  category?: string | null;
  emoji?: string | null;
  questions?: unknown[] | { count?: number | null }[] | null;
};

export function getHostQuizQuestionCount(quiz: HostQuizSearchItem) {
  if (!Array.isArray(quiz.questions)) return 0;

  const firstQuestion = quiz.questions[0];
  if (
    quiz.questions.length === 1 &&
    firstQuestion &&
    typeof firstQuestion === "object" &&
    "count" in firstQuestion &&
    typeof firstQuestion.count === "number"
  ) {
    return firstQuestion.count;
  }

  return quiz.questions.length;
}

export function filterHostQuizzes<T extends HostQuizSearchItem>(quizzes: T[], query: string) {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return quizzes;

  return quizzes.filter((quiz) => {
    const searchableValues = [
      quiz.title,
      quiz.category,
      quiz.emoji,
      `${getHostQuizQuestionCount(quiz)} questions`,
    ];

    return searchableValues.some((value) => value?.toLowerCase().includes(normalizedQuery));
  });
}
