import { createClient } from "@supabase/supabase-js";
import { unstable_cache } from "next/cache";
import { calcLevel } from "@/components/study/study-session-panels";
import type { QuizWithCreator } from "@/components/explore/explore-quiz-card";
import { CATALOG_QUIZ_SELECT, categoryVariants } from "@/lib/catalog-discovery";

const PAGE_SIZE = 24;

export type InitialExploreCatalog = {
  quizzes: QuizWithCreator[];
  totalCount: number;
};

async function fetchInitialExploreCatalog(category = "All"): Promise<InitialExploreCatalog | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;

  const supabase = createClient(url, anonKey, {
    auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false },
  });

  let query = supabase
    .from("quizzes")
    .select(CATALOG_QUIZ_SELECT, { count: "exact" })
    .eq("is_public", true)
    .is("archived_at", null);

  if (category !== "All") {
    query = query.in("category", categoryVariants(category));
  }

  const { data, error, count } = await query
    .order("plays", { ascending: false })
    .order("id", { ascending: true })
    .limit(PAGE_SIZE);

  if (error || !data) return null;

  const creatorIds = [...new Set(data.map((quiz) => quiz.creator_id).filter(Boolean))] as string[];
  const creatorMap: Record<string, {
    name: string;
    username: string;
    avatar: string;
    level: number;
    levelTitle: string;
  }> = {};

  if (creatorIds.length > 0) {
    const { data: profiles, error: profilesError } = await supabase
      .from("profiles")
      .select("id, username, display_name, avatar, total_xp")
      .in("id", creatorIds);

    if (!profilesError && profiles) {
      for (const profile of profiles) {
        const level = calcLevel((profile.total_xp as number) ?? 0);
        creatorMap[profile.id] = {
          name: profile.display_name || profile.username || "",
          username: profile.username || "",
          avatar: profile.avatar || "👤",
          level: level.level,
          levelTitle: level.title,
        };
      }
    }
  }

  const quizzes = data.map((quiz) => ({
    ...quiz,
    creator_name: creatorMap[quiz.creator_id]?.name,
    creator_display_name: creatorMap[quiz.creator_id]?.name,
    creator_username: creatorMap[quiz.creator_id]?.username,
    creator_avatar: creatorMap[quiz.creator_id]?.avatar,
    creator_level: creatorMap[quiz.creator_id]?.level,
    creator_level_title: creatorMap[quiz.creator_id]?.levelTitle,
  })) as unknown as QuizWithCreator[];

  return { quizzes, totalCount: count ?? quizzes.length };
}

export const getInitialExploreCatalog = unstable_cache(
  fetchInitialExploreCatalog,
  ["explore-initial-catalog-v1"],
  { revalidate: 120 }
);
