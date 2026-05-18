import { SupabaseClient } from "@supabase/supabase-js";

// Achievement slugs (must match the achievements table)
const ACHIEVEMENTS = {
  FIRST_QUIZ:     "first_quiz",
  FIRST_STUDY:    "first_study",
  PERFECT_SCORE:  "perfect_score",
  STREAK_3:       "streak_3",
  STREAK_7:       "streak_7",
  STREAK_30:      "streak_30",
  LEVEL_5:        "level_5",
  LEVEL_10:       "level_10",
  LEVEL_20:       "level_20",
  STUDY_10:       "study_10",
  HOST_GAME:      "host_game",
  WIN_GAME:       "win_game",
  JOIN_CLASSROOM: "join_classroom",
  JOIN_GROUP:     "join_group",
  ADD_FRIEND:     "add_friend",
} as const;

function calcLevel(totalXp: number): number {
  let level = 1;
  let xpNeeded = 200;
  while (totalXp >= xpNeeded) { level++; xpNeeded += level * 200; }
  return level;
}

async function grantAchievement(
  supabase: SupabaseClient,
  userId: string,
  slug: string,
  alreadyEarned: Set<string>
): Promise<boolean> {
  if (alreadyEarned.has(slug)) return false;
  const { error } = await supabase
    .from("user_achievements")
    .insert({ user_id: userId, achievement_slug: slug });
  if (error && !error.message?.includes("duplicate")) {
    console.error(`Failed to grant achievement ${slug}:`, error.message);
    return false;
  }
  // Grant XP reward
  const { data: ach } = await supabase
    .from("achievements")
    .select("xp_reward")
    .eq("slug", slug)
    .single();
  if (ach?.xp_reward && ach.xp_reward > 0) {
    await supabase.rpc("increment_xp", { user_uuid: userId, xp_amount: ach.xp_reward });
  }
  return true;
}

export type AchievementContext = {
  userId: string;
  supabase: SupabaseClient;
  // Optional context hints to avoid extra DB calls
  sessionResult?: { correct: number; total: number; mode: string };
  totalXp?: number;
  studyStreak?: number;
};

export async function checkAndGrantAchievements(ctx: AchievementContext): Promise<string[]> {
  const { userId, supabase } = ctx;
  const granted: string[] = [];

  try {
    // Fetch already-earned achievements
    const { data: earned } = await supabase
      .from("user_achievements")
      .select("achievement_slug")
      .eq("user_id", userId);
    const alreadyEarned = new Set((earned ?? []).map(e => e.achievement_slug));

    // Fetch profile stats
    const { data: profile } = await supabase
      .from("profiles")
      .select("total_xp, study_streak")
      .eq("id", userId)
      .single();

    const totalXp = ctx.totalXp ?? (profile?.total_xp as number) ?? 0;
    const studyStreak = ctx.studyStreak ?? (profile?.study_streak as number) ?? 0;
    const level = calcLevel(totalXp);

    // Check study-session-specific achievements
    if (ctx.sessionResult) {
      const { correct, total } = ctx.sessionResult;

      // First study session
      const { count: sessionCount } = await supabase
        .from("study_sessions")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId);
      if ((sessionCount ?? 0) >= 1) {
        if (await grantAchievement(supabase, userId, ACHIEVEMENTS.FIRST_STUDY, alreadyEarned)) {
          granted.push(ACHIEVEMENTS.FIRST_STUDY);
          alreadyEarned.add(ACHIEVEMENTS.FIRST_STUDY);
        }
      }

      // Perfect score
      if (correct === total && total > 0) {
        if (await grantAchievement(supabase, userId, ACHIEVEMENTS.PERFECT_SCORE, alreadyEarned)) {
          granted.push(ACHIEVEMENTS.PERFECT_SCORE);
          alreadyEarned.add(ACHIEVEMENTS.PERFECT_SCORE);
        }
      }

      // Study 10 different quizzes
      const { count: quizCount } = await supabase
        .from("study_progress")
        .select("quiz_id", { count: "exact", head: true })
        .eq("user_id", userId);
      if ((quizCount ?? 0) >= 10) {
        if (await grantAchievement(supabase, userId, ACHIEVEMENTS.STUDY_10, alreadyEarned)) {
          granted.push(ACHIEVEMENTS.STUDY_10);
          alreadyEarned.add(ACHIEVEMENTS.STUDY_10);
        }
      }
    }

    // Streak achievements
    if (studyStreak >= 3) {
      if (await grantAchievement(supabase, userId, ACHIEVEMENTS.STREAK_3, alreadyEarned)) {
        granted.push(ACHIEVEMENTS.STREAK_3); alreadyEarned.add(ACHIEVEMENTS.STREAK_3);
      }
    }
    if (studyStreak >= 7) {
      if (await grantAchievement(supabase, userId, ACHIEVEMENTS.STREAK_7, alreadyEarned)) {
        granted.push(ACHIEVEMENTS.STREAK_7); alreadyEarned.add(ACHIEVEMENTS.STREAK_7);
      }
    }
    if (studyStreak >= 30) {
      if (await grantAchievement(supabase, userId, ACHIEVEMENTS.STREAK_30, alreadyEarned)) {
        granted.push(ACHIEVEMENTS.STREAK_30); alreadyEarned.add(ACHIEVEMENTS.STREAK_30);
      }
    }

    // Level achievements
    if (level >= 5) {
      if (await grantAchievement(supabase, userId, ACHIEVEMENTS.LEVEL_5, alreadyEarned)) {
        granted.push(ACHIEVEMENTS.LEVEL_5); alreadyEarned.add(ACHIEVEMENTS.LEVEL_5);
      }
    }
    if (level >= 10) {
      if (await grantAchievement(supabase, userId, ACHIEVEMENTS.LEVEL_10, alreadyEarned)) {
        granted.push(ACHIEVEMENTS.LEVEL_10); alreadyEarned.add(ACHIEVEMENTS.LEVEL_10);
      }
    }
    if (level >= 20) {
      if (await grantAchievement(supabase, userId, ACHIEVEMENTS.LEVEL_20, alreadyEarned)) {
        granted.push(ACHIEVEMENTS.LEVEL_20); alreadyEarned.add(ACHIEVEMENTS.LEVEL_20);
      }
    }

    // Social achievements
    const { count: friendCount } = await supabase
      .from("friendships")
      .select("id", { count: "exact", head: true })
      .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`)
      .eq("status", "accepted");
    if ((friendCount ?? 0) >= 1) {
      if (await grantAchievement(supabase, userId, ACHIEVEMENTS.ADD_FRIEND, alreadyEarned)) {
        granted.push(ACHIEVEMENTS.ADD_FRIEND); alreadyEarned.add(ACHIEVEMENTS.ADD_FRIEND);
      }
    }

    const { count: classroomCount } = await supabase
      .from("classroom_members")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId);
    if ((classroomCount ?? 0) >= 1) {
      if (await grantAchievement(supabase, userId, ACHIEVEMENTS.JOIN_CLASSROOM, alreadyEarned)) {
        granted.push(ACHIEVEMENTS.JOIN_CLASSROOM); alreadyEarned.add(ACHIEVEMENTS.JOIN_CLASSROOM);
      }
    }

    const { count: groupCount } = await supabase
      .from("trivia_group_members")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId);
    if ((groupCount ?? 0) >= 1) {
      if (await grantAchievement(supabase, userId, ACHIEVEMENTS.JOIN_GROUP, alreadyEarned)) {
        granted.push(ACHIEVEMENTS.JOIN_GROUP); alreadyEarned.add(ACHIEVEMENTS.JOIN_GROUP);
      }
    }

    // Quiz creator achievement
    const { count: quizCreatedCount } = await supabase
      .from("quizzes")
      .select("id", { count: "exact", head: true })
      .eq("creator_id", userId)
      .is("archived_at", null);
    if ((quizCreatedCount ?? 0) >= 1) {
      if (await grantAchievement(supabase, userId, ACHIEVEMENTS.FIRST_QUIZ, alreadyEarned)) {
        granted.push(ACHIEVEMENTS.FIRST_QUIZ); alreadyEarned.add(ACHIEVEMENTS.FIRST_QUIZ);
      }
    }

  } catch (err) {
    console.error("Achievement check error:", err);
  }

  return granted;
}
