import type { SupabaseClient } from "@supabase/supabase-js";

export function normalizeCatalogSearch(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

function literalLike(value: string): string {
  return value.replace(/[\\%_*]/g, "\\$&");
}

export function catalogSearchFilter(search: string): string | null {
  const term = normalizeCatalogSearch(search);
  if (!term) return null;
  const pattern = postgrestQuoted(`%${literalLike(term)}%`);
  const filters = [`title.ilike.${pattern}`, `category.ilike.${pattern}`];
  for (const [canonical, aliases] of Object.entries(CATEGORY_ALIASES)) {
    if ([canonical, ...aliases].some(value => normalizeCatalogSearch(value).includes(term))) {
      for (const alias of aliases) filters.push(`category.ilike.${postgrestQuoted(literalLike(alias))}`);
    }
  }
  return [...new Set(filters)].join(",");
}

/** Matching/count filters are identical; only the page query gets a keyset cursor. */
export async function fetchCatalogPage(client: SupabaseClient, options: {
  search?: string; category?: string; sort?: CatalogSort; cursor?: CatalogCursor | null;
  loadedCount?: number; pageSize?: number;
}) {
  const { search = "", category = "All", sort = "popular", cursor = null, loadedCount = 0, pageSize = 24 } = options;
  if (!Number.isInteger(loadedCount) || loadedCount < 0 || !Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100) {
    throw new Error("Invalid catalog page bounds");
  }
  const filteredQuery = (head: boolean) => {
    let query = client.from("quizzes").select(head ? "id" : CATALOG_QUIZ_SELECT, head ? { count: "exact", head: true } : {})
      .eq("is_public", true).is("archived_at", null);
    const searchFilter = catalogSearchFilter(search);
    if (searchFilter) query = query.or(searchFilter);
    if (normalizeCatalogSearch(category) !== "all") {
      query = query.or(categoryVariants(category).map(value => `category.ilike.${postgrestQuoted(literalLike(value))}`).join(","));
    }
    return query;
  };
  let query = filteredQuery(false);
  const countQuery = filteredQuery(true);
  const cursorFilter = catalogCursorFilter(sort, cursor);
  if (cursorFilter) query = query.or(cursorFilter);
  const column = sort === "newest" ? "created_at" : sort === "az" || sort === "za" ? "title" : "plays";
  query = query.order(column, { ascending: sort === "az" }).order("id", { ascending: true }).limit(pageSize);
  const [{ data, error }, { count, error: countError }] = await Promise.all([query, countQuery]);
  if (error || countError) throw new Error("Could not load the quiz catalog.");
  const quizzes = (data ?? []) as unknown as CatalogRow[];
  const totalCount = count ?? 0;
  const last = quizzes.at(-1);
  return { quizzes, totalCount, nextCursor: last ? catalogCursorForRow(sort, last) : null,
    hasMore: quizzes.length > 0 && loadedCount + quizzes.length < totalCount };
}

export type CatalogRow = {
  id: string; slug: string; title: string; category: string; emoji: string; color: string;
  plays: number; creator_id: string; created_at: string; questions: { id: string }[];
};

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
