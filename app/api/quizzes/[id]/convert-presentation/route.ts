import { NextResponse } from "next/server";

import { convertQuizToPresentation, type QuizConversionQuestion } from "@/lib/presentation/quiz-conversion";
import { createClient } from "@/utils/supabase/server";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(_request: Request, { params }: RouteContext) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Sign in to convert a quiz." }, { status: 401 });
  }

  const { id } = await params;
  const { data: quiz, error: quizError } = await supabase
    .from("quizzes")
    .select("id, title, category, is_public, creator_id, questions(id, text, question_type, time_limit, points, order_index, answers(id, text, is_correct))")
    .eq("id", id)
    .single();

  if (quizError || !quiz || (!quiz.is_public && quiz.creator_id !== user.id)) {
    return NextResponse.json({ error: "Quiz not found." }, { status: 404 });
  }

  try {
    const orderedQuestions = [...(quiz.questions ?? [])]
      .sort((left, right) => (left.order_index ?? 0) - (right.order_index ?? 0))
      .map((question) => ({
        ...question,
        answers: question.answers ?? [],
      })) as QuizConversionQuestion[];
    const deck = convertQuizToPresentation({
      title: quiz.title,
      category: quiz.category,
      questions: orderedQuestions,
    });

    const { data: presentationId, error: createError } = await supabase.rpc("create_presentation", {
      p_title: deck.title,
      p_slides: deck.slides,
    });
    if (createError) throw createError;

    return NextResponse.json({ presentationId });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not convert this quiz.";
    return NextResponse.json({ error: message }, { status: 422 });
  }
}
