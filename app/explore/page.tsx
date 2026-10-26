import ExploreClient from "./explore-client";
import { getInitialExploreCatalog } from "@/lib/catalog-server";
import { canonicalizeCategory } from "@/lib/catalog-discovery";

export const revalidate = 60;

type ExplorePageProps = {
  searchParams: Promise<{ category?: string | string[]; q?: string | string[] }>;
};

export default async function ExplorePage({ searchParams }: ExplorePageProps) {
  const params = await searchParams;
  const rawCategory = Array.isArray(params.category) ? params.category[0] : params.category;
  const initialCategory = rawCategory ? canonicalizeCategory(rawCategory) : "All";
  const initialSearch = (Array.isArray(params.q) ? params.q[0] : params.q) ?? "";
  const initialCatalog = initialSearch ? null : await getInitialExploreCatalog(initialCategory);
  return <ExploreClient key={`${initialCategory}:${initialSearch}`} initialSearch={initialSearch} initialCatalog={initialCatalog} initialCategory={initialCategory} />;
}
