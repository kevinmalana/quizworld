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
