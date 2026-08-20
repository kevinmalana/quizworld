import type { InteractiveOverlay, Slide } from "./types";

export type OverlayType = InteractiveOverlay["type"];

export function makeInteractiveOverlay(type: OverlayType): InteractiveOverlay {
  switch (type) {
    case "poll":
      return { type, question: "", options: [{ id: "1", text: "" }, { id: "2", text: "" }] };
    case "quiz":
      return {
        type,
        question: "",
        answers: [
          { id: "1", text: "", is_correct: true },
          { id: "2", text: "", is_correct: false },
        ],
      };
    case "open_text":
      return { type, question: "" };
    case "word_cloud":
      return { type, prompt: "" };
    case "scale":
      return { type, min: 1, max: 10 };
    case "qna":
      return { type };
  }
}

export function validatePresentationSlides(slides: Slide[]): string | null {
  if (!slides.length) return "Add at least one slide.";

  for (const [index, slide] of slides.entries()) {
    const label = `Slide ${index + 1}`;
    const interactive = slide.slide_type === "content" ? slide.content.interactive : undefined;
    const type = interactive?.type || slide.slide_type;
    const content = interactive || slide.content;
    const standalonePrompt = slide.title.trim();

    if (type === "poll") {
      if (interactive && !content.question?.trim()) return `${label}: add a poll question.`;
      if (!interactive && !standalonePrompt) return `${label}: add a poll question.`;
      if ((content.options || []).filter((option) => option.text.trim()).length < 2) {
        return `${label}: polls need at least two non-empty options.`;
      }
    }

    if (type === "quiz") {
      if (!content.question?.trim() && !standalonePrompt) return `${label}: add a quiz question.`;
      const answers = (content.answers || []).filter((answer) => answer.text.trim());
      if (answers.length < 2) return `${label}: quiz slides need at least two non-empty answers.`;
      if (!answers.some((answer) => answer.is_correct)) return `${label}: choose a correct answer.`;
    }

    if (type === "open_text" && !content.question?.trim()) {
      return `${label}: add an open-text question.`;
    }

    if (type === "word_cloud" && !content.prompt?.trim()) {
      return `${label}: add a word-cloud prompt.`;
    }

    if (type === "scale" && Number(content.min ?? 1) >= Number(content.max ?? 10)) {
      return `${label}: scale minimum must be less than maximum.`;
    }
  }

  return null;
}
