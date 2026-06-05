import type { Metadata } from "next";
import { createClient } from "@/utils/supabase/server";
import StudyPageClient from "./StudyPageClient";

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const supabase = await createClient();
  const { data: quiz } = await supabase
    .from("quizzes")
    .select("title, category, questions(id)")
    .eq("id", id)
    .eq("is_public", true)
    .single();

  if (!quiz) return { title: "Quiz Not Found" };

  const qCount = Array.isArray(quiz.questions) ? quiz.questions.length : 0;
  const title = quiz.title as string;
  const category = quiz.category as string | null;
  const pageTitle = `Study: ${title} — Free ${category ? category + " " : ""}Practice Quiz (${qCount} Questions)`;
  const description = `Study and master ${title} with ${qCount} free practice questions. Use flashcard or quick-fire mode on QuizWorld.`;

  return {
    title: pageTitle,
    description,
    openGraph: {
      title: pageTitle,
      description,
      url: `https://www.quizworld.xyz/study/${id}`,
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: pageTitle,
      description,
    },
  };
}

export default function StudyPage() {
  return <StudyPageClient />;
}
