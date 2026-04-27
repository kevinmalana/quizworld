export const EXPLORE_ALL_CATEGORY = "All";

export function getValidExploreCategory(category: string | null | undefined, categories: readonly string[]) {
  return category && categories.includes(category) ? category : EXPLORE_ALL_CATEGORY;
}

export function buildExploreCategoryHref(category: string) {
  if (!category || category === EXPLORE_ALL_CATEGORY) {
    return "/explore";
  }

  const params = new URLSearchParams({ category });
  return `/explore?${params.toString()}`;
}
