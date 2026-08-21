import type { AIPresentationSlideDraft } from "./ai-draft";

export type QuizConversionAnswer = {
  id: string;
  text: string;
  is_correct: boolean;
};

export type QuizConversionQuestion = {
  id: string;
  text: string;
  question_type?: string | null;
  time_limit?: number | null;
  points?: number | null;
  answers?: QuizConversionAnswer[] | null;
};

export type QuizConversionInput = {
  title: string;
  category?: string | null;
  questions: QuizConversionQuestion[];
};

export type ConvertedPresentation = {
  title: string;
  slides: AIPresentationSlideDraft[];
};

export function convertQuizToPresentation(input: QuizConversionInput): ConvertedPresentation {
  const quizTitle = input.title.trim();
  if (!quizTitle) throw new Error("Quiz title is required.");

  const interactiveSlides = input.questions.flatMap<AIPresentationSlideDraft>((question) => {
    const questionText = question.text?.trim();
    const answers = (question.answers ?? []).filter((answer) => answer.text?.trim());
    if (!questionText || answers.length < 2) return [];

    if (question.question_type === "poll") {
      return [
        {
          slide_type: "poll" as const,
          title: `Audience pulse: ${questionText}`,
          content: {
            question: questionText,
            options: answers.map((answer, index) => ({
              id: answer.id || String(index + 1),
              text: answer.text.trim(),
            })),
          },
          settings: {},
          order_index: 0,
        },
      ];
    }

    if (answers.filter((answer) => answer.is_correct).length !== 1) return [];
    return [
      {
        slide_type: "quiz" as const,
        title: `Knowledge check: ${questionText}`,
        content: {
          question: questionText,
          answers: answers.map((answer, index) => ({
            id: answer.id || String(index + 1),
            text: answer.text.trim(),
            is_correct: answer.is_correct,
          })),
          time_limit: question.time_limit ?? 20,
          points: question.points ?? 1000,
        },
        settings: {},
        order_index: 0,
      },
    ];
  });

  if (interactiveSlides.length === 0) {
    throw new Error("This quiz does not contain any usable questions for a presentation.");
  }

  const categoryLine = input.category?.trim() ? `\n\n${input.category.trim()}` : "";
  const slides: AIPresentationSlideDraft[] = [
    {
      slide_type: "content",
      title: quizTitle,
      content: {
        text: `# ${quizTitle}${categoryLine}\n\nAn interactive presentation created from a QuizWorld quiz.`,
      },
      settings: {},
      order_index: 0,
    },
    ...interactiveSlides,
    {
      slide_type: "qna",
      title: "Questions and discussion",
      content: { moderated: true },
      settings: {},
      order_index: 0,
    },
  ];

  return {
    title: `${quizTitle} — interactive deck`,
    slides: slides.map((slide, index) => ({ ...slide, order_index: index })),
  };
}
