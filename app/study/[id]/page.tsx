import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { CATEGORY_EMOJIS } from "@/lib/store";
import StudyPageClient from "./StudyPageClient";

interface PageProps {
  params: Promise<{ id: string }>;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const supabase = await createClient();

  // Fetch by UUID or slug
  const { data: quiz } = UUID_RE.test(id)
    ? await supabase.from("quizzes").select("id, slug, title, category, questions(id)").eq("id", id).eq("is_public", true).single()
    : await supabase.from("quizzes").select("id, slug, title, category, questions(id)").eq("slug", id).eq("is_public", true).single();

  if (!quiz) return { title: "Quiz Not Found" };

  const qCount = Array.isArray(quiz.questions) ? quiz.questions.length : 0;
  const title = quiz.title as string;
  const category = quiz.category as string | null;
  const slug = (quiz.slug as string | null) || quiz.id;
  const pageTitle = `Study: ${title} — Free ${category ? category + " " : ""}Practice Quiz (${qCount} Questions)`;
  const description = `Study and master ${title} with ${qCount} free practice questions. Use flashcard or quick-fire mode on QuizWorld.`;
  const canonicalUrl = `https://www.quizworld.xyz/study/${slug}`;
  const emoji = CATEGORY_EMOJIS[category ?? ""] || "🧠";
  const ogImageUrl = `https://www.quizworld.xyz/api/og?title=${encodeURIComponent(title)}&category=${encodeURIComponent(category || "")}&count=${qCount}&emoji=${encodeURIComponent(emoji)}`;

  return {
    title: pageTitle,
    description,
    alternates: { canonical: canonicalUrl },
    openGraph: {
      title: pageTitle,
      description,
      url: canonicalUrl,
      type: "website",
      images: [{ url: ogImageUrl, width: 1200, height: 630, alt: title }],
    },
    twitter: {
      card: "summary_large_image",
      title: pageTitle,
      description,
      images: [ogImageUrl],
    },
  };
}

export default async function StudyPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();

  // If accessed by UUID, redirect to slug URL
  if (UUID_RE.test(id)) {
    const { data: quiz } = await supabase
      .from("quizzes")
      .select("slug")
      .eq("id", id)
      .eq("is_public", true)
      .single();
    const slug = quiz?.slug as string | null;
    if (slug) redirect(`/study/${slug}`);
  }

  return <StudyPageClient />;
}
