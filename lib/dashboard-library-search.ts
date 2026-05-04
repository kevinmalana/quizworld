export type DashboardQuizSearchItem = {
  title?: string | null;
  category?: string | null;
  emoji?: string | null;
  is_public?: boolean | null;
  archived_at?: string | null;
  plays?: number | null;
  questions?: { count?: number | null }[] | null;
};

export function getDashboardQuizQuestionCount(quiz: DashboardQuizSearchItem) {
  const firstQuestion = quiz.questions?.[0];
  return typeof firstQuestion?.count === "number" ? firstQuestion.count : 0;
}

export function getDashboardQuizSearchValues(quiz: DashboardQuizSearchItem) {
  const questionCount = getDashboardQuizQuestionCount(quiz);
  const plays = quiz.plays ?? 0;

  return [
    quiz.title,
    quiz.category,
    quiz.emoji,
    quiz.is_public ? "public" : "private",
    quiz.archived_at ? "archived" : "active",
    `${questionCount} question${questionCount === 1 ? "" : "s"}`,
    `${plays} play${plays === 1 ? "" : "s"}`,
  ];
}

export function matchesDashboardSearch(query: string, values: Array<string | number | null | undefined>) {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return true;

  return values.some((value) => String(value ?? "").toLowerCase().includes(normalizedQuery));
}
