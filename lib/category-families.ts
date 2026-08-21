export const CATEGORY_FAMILY_ART = {
  academic: "/media/quizworld/categories/academic-learning-20260821.webp",
  entertainment: "/media/quizworld/categories/entertainment-culture-20260821.webp",
  professional: "/media/quizworld/categories/professional-technology-20260821.webp",
  world: "/media/quizworld/categories/world-history-20260821.webp",
  lifestyle: "/media/quizworld/categories/lifestyle-sports-20260821.webp",
  discovery: "/media/quizworld/categories/discovery-general-20260821.webp",
} as const;

export type CategoryFamilyId = keyof typeof CATEGORY_FAMILY_ART;

export const CATEGORY_FAMILY_IDS = Object.keys(CATEGORY_FAMILY_ART) as CategoryFamilyId[];
