export const CATEGORY_ALIASES: Record<string, string[]> = {
  "Animals & Pets": ["Animals & Pets", "Animals"],
  "Art & Literature": ["Art & Literature", "Art", "Books"],
  "Cars & Automotive": ["Cars & Automotive", "Vehicles"],
  "Comics & Anime": ["Comics & Anime", "Comics", "Anime & Manga", "Cartoons"],
  Math: ["Math", "Mathematics"],
  "Mythology & Folklore": ["Mythology & Folklore", "Mythology"],
  "Politics & Government": ["Politics & Government", "Politics"],
  Technology: ["Technology", "Computers", "Gadgets & Tech"],
  "TV Shows": ["TV Shows", "Television"],
};

const aliasToCanonical = new Map<string, string>();
for (const [canonical, aliases] of Object.entries(CATEGORY_ALIASES)) {
  for (const alias of aliases) aliasToCanonical.set(alias.toLowerCase(), canonical);
}

export function canonicalizeCategory(category: string | null | undefined): string {
  const value = category?.trim();
  if (!value) return "Other";
  const canonical = aliasToCanonical.get(value.toLowerCase());
  if (canonical) return canonical;

  // Categories that do not need aliases are already canonical when title-cased
  // by the authoring flow. Unknown legacy values are grouped under Other.
  const known = [
    "General Knowledge", "Trivia", "Education", "Science & Nature", "Space & Astronomy",
    "Programming", "History", "Geography", "Current Events", "Entertainment", "Movies",
    "Music", "Pop Culture", "Celebrities", "Sports", "Video Games", "Travel & Tourism",
    "Photography", "Fashion & Style", "Food & Drink", "Health & Medicine", "Nature & Environment",
    "Psychology & Mind", "Religion & Spirituality", "Languages", "Business", "Social Media & Internet",
    "DIY & Crafts", "Relationships & Dating", "Holidays & Celebrations", "Inventions & Discoveries",
    "Board Games", "Musicals & Theatre", "Other",
  ];
  return known.find((entry) => entry.toLowerCase() === value.toLowerCase()) ?? "Other";
}

export function categoryVariants(category: string): string[] {
  const canonical = canonicalizeCategory(category);
  return CATEGORY_ALIASES[canonical] ?? [canonical];
}

export function catalogCategoryHref(category: string): string {
  return `/explore?category=${encodeURIComponent(category)}`;
}

export type CatalogCursor = { primary: string | number; id: string };
export type CatalogSort = "popular" | "newest" | "az" | "za";

export const CATALOG_QUIZ_SELECT =
  "id,slug,title,category,emoji,color,plays,creator_id,created_at,questions(id)";

export function catalogQuestionCount(quiz: {
  question_count?: number | null;
  questions?: { id?: string }[] | null;
}): number {
  if (typeof quiz.question_count === "number" && Number.isFinite(quiz.question_count)) {
    return Math.max(0, quiz.question_count);
  }
  return Array.isArray(quiz.questions) ? quiz.questions.length : 0;
}

function postgrestQuoted(value: string): string {
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

export function catalogCursorFilter(sortMode: CatalogSort, cursor: CatalogCursor | null): string | null {
  if (!cursor) return null;
  if (sortMode === "newest") {
    const value = postgrestQuoted(String(cursor.primary));
    return `created_at.lt.${value},and(created_at.eq.${value},id.gt.${cursor.id})`;
  }
  if (sortMode === "az" || sortMode === "za") {
    const op = sortMode === "az" ? "gt" : "lt";
    const value = postgrestQuoted(String(cursor.primary));
    return `title.${op}.${value},and(title.eq.${value},id.gt.${cursor.id})`;
  }
  const value = Number(cursor.primary) || 0;
  return `plays.lt.${value},and(plays.eq.${value},id.gt.${cursor.id})`;
}

export function catalogCursorForRow(sortMode: CatalogSort, row: { id: string; created_at: string; title: string; plays?: number | null }): CatalogCursor {
  const primary = sortMode === "newest" ? row.created_at
    : sortMode === "az" || sortMode === "za" ? row.title
    : (row.plays ?? 0);
  return { primary, id: row.id };
}

export function mergeCatalogPage<T extends { id: string }>(current: T[], incoming: T[]): T[] {
  const seen = new Set<string>();
  return [...current, ...incoming].filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

export function excludeFeaturedQuizzes<T extends { id: string }>(catalog: T[], rows: { id: string }[][]): T[] {
  const featuredIds = new Set(rows.flat().map((quiz) => quiz.id));
  return catalog.filter((quiz) => !featuredIds.has(quiz.id));
}

export function formatCatalogCount(loaded: number, total: number, singular: string): string {
  const noun = total === 1 ? singular : `${singular}${singular.endsWith("quiz") ? "zes" : "s"}`;
  return loaded < total ? `Showing ${loaded} of ${total} ${noun}` : `Showing ${total} ${noun}`;
}
