import type { SlideContent, SlideType } from "./types";

export type AIPresentationSourceMode = "topic" | "document" | "paste" | "url";
export type AIInteractionDensity = "light" | "balanced" | "high";

export type AIPresentationSlideDraft = {
  slide_type: SlideType;
  title: string;
  content: SlideContent;
  settings: Record<string, unknown>;
  order_index: number;
};

export type AIPresentationDraft = {
  title: string;
  summary: string;
  slides: AIPresentationSlideDraft[];
};

export type AIPresentationRequest = {
  sourceMode: AIPresentationSourceMode;
  sourceText: string;
  sourceTitle: string;
  audience: string;
  slideCount: number;
  interactionDensity: AIInteractionDensity;
};

type BuildPromptInput = AIPresentationRequest;

const SLIDE_TYPES = new Set<SlideType>([
  "content",
  "word_cloud",
  "open_text",
  "poll",
  "quiz",
  "scale",
  "qna",
]);

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function normalizeOptions(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .map((option, index) => {
      const item = record(option);
      const optionText = text(item.text);
      return optionText ? { id: text(item.id) || String(index + 1), text: optionText } : null;
    })
    .filter((option): option is { id: string; text: string } => option !== null);
}

function normalizeAnswers(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .map((answer, index) => {
      const item = record(answer);
      const answerText = text(item.text);
      return answerText
        ? {
            id: text(item.id) || String(index + 1),
            text: answerText,
            is_correct: item.is_correct === true,
          }
        : null;
    })
    .filter(
      (answer): answer is { id: string; text: string; is_correct: boolean } => answer !== null,
    );
}

function validateContent(slideType: SlideType, rawContent: unknown, index: number): SlideContent {
  const source = record(rawContent);
  const content: SlideContent = {};
  const question = text(source.question);
  const prompt = text(source.prompt);

  if (slideType === "content") {
    const body = text(source.text);
    if (!body && !text(source.image_url) && !text(source.video_url)) {
      throw new Error(`Slide ${index + 1} needs text or media.`);
    }
    if (body) content.text = body;
    if (text(source.image_url)) content.image_url = text(source.image_url);
    if (text(source.video_url)) content.video_url = text(source.video_url);
    return content;
  }

  if (slideType === "poll") {
    const options = normalizeOptions(source.options);
    if (!question || options.length < 2) {
      throw new Error(`Slide ${index + 1} needs a question and at least two valid options.`);
    }
    return { question, options };
  }

  if (slideType === "quiz") {
    const answers = normalizeAnswers(source.answers);
    if (!question || answers.length < 2) {
      throw new Error(`Slide ${index + 1} needs a question and at least two valid answers.`);
    }
    if (answers.filter((answer) => answer.is_correct).length !== 1) {
      throw new Error(`Slide ${index + 1} needs exactly one correct answer.`);
    }
    return {
      question,
      answers,
      time_limit: typeof source.time_limit === "number" ? source.time_limit : 30,
      points: typeof source.points === "number" ? source.points : 1000,
    };
  }

  if (slideType === "word_cloud") {
    if (!prompt) throw new Error(`Slide ${index + 1} needs a prompt.`);
    return { prompt };
  }

  if (slideType === "open_text") {
    if (!question) throw new Error(`Slide ${index + 1} needs a question.`);
    return { question };
  }

  if (slideType === "scale") {
    if (!question) throw new Error(`Slide ${index + 1} needs a question.`);
    const min = typeof source.min === "number" ? source.min : 1;
    const max = typeof source.max === "number" ? source.max : 5;
    if (min >= max) throw new Error(`Slide ${index + 1} has an invalid scale range.`);
    return {
      question,
      min,
      max,
      min_label: text(source.min_label),
      max_label: text(source.max_label),
    };
  }

  return { moderated: source.moderated !== false };
}

export function validateAIPresentationDraft(input: unknown): AIPresentationDraft {
  const value = record(input);
  const title = text(value.title);
  const summary = text(value.summary);
  const rawSlides = Array.isArray(value.slides) ? value.slides : [];

  if (!title) throw new Error("AI response did not include a presentation title.");
  if (rawSlides.length === 0) throw new Error("AI response did not include any slides.");
  if (rawSlides.length > 20) throw new Error("AI response included too many slides.");

  const slides = rawSlides.map((rawSlide, index): AIPresentationSlideDraft => {
    const slide = record(rawSlide);
    const rawType = text(slide.slide_type) as SlideType;
    if (!SLIDE_TYPES.has(rawType)) {
      throw new Error(`Slide ${index + 1} has an unsupported type.`);
    }

    return {
      slide_type: rawType,
      title: text(slide.title) || `Slide ${index + 1}`,
      content: validateContent(rawType, slide.content, index),
      settings: record(slide.settings),
      order_index: index,
    };
  });

  return { title, summary, slides };
}

export function normalizeAIPresentationRequest(input: unknown): AIPresentationRequest {
  const value = record(input);
  const requestedMode = text(value.sourceMode);
  const sourceMode: AIPresentationSourceMode =
    requestedMode === "document" || requestedMode === "paste" || requestedMode === "url"
      ? requestedMode
      : "topic";
  const sourceText = text(value.sourceText);
  const sourceTitle = text(value.sourceTitle);
  const audience = text(value.audience);
  const requestedDensity = text(value.interactionDensity);
  const interactionDensity: AIInteractionDensity =
    requestedDensity === "light" || requestedDensity === "high" ? requestedDensity : "balanced";
  const numericSlideCount = Number(value.slideCount);
  const slideCount = Math.min(15, Math.max(4, Number.isFinite(numericSlideCount) ? Math.round(numericSlideCount) : 8));

  if (sourceMode === "topic" && sourceText.length < 10) {
    throw new Error("Describe the topic or goal in a little more detail.");
  }
  if (sourceMode !== "topic" && sourceText.length < 200) {
    throw new Error("Add more source material before generating a presentation draft.");
  }

  return {
    sourceMode,
    sourceText,
    sourceTitle,
    audience,
    slideCount,
    interactionDensity,
  };
}

export function buildAIPresentationPrompt(input: BuildPromptInput): string {
  const audience = text(input.audience) || "a general audience";
  const sourceTitle = text(input.sourceTitle) || "Untitled source";
  const grounded = input.sourceMode !== "topic";
  const interactionTarget =
    input.interactionDensity === "light"
      ? "Include 1 or 2 interactive slides."
      : input.interactionDensity === "high"
        ? "Make roughly every second slide interactive."
        : "Include 2 to 4 interactive slides at meaningful checkpoints.";

  return `Create an editable interactive presentation with ${input.slideCount} slides for ${audience}.
Title/source: ${sourceTitle}
Mode: ${input.sourceMode}
${grounded ? "Use only the supplied source material. Do not invent facts that are not supported by it." : "Use accurate general knowledge and avoid unsupported claims."}
${interactionTarget}

Use a clear narrative: opening, key ideas, interaction checkpoints, recap, and a useful closing action. Keep one idea per slide. Content slide text may use simple Markdown. Interactive slide types are poll, quiz, word_cloud, open_text, scale, and qna. Every quiz must have exactly one correct answer and plausible distractors.

Return JSON only in this shape:
{
  "title": "Presentation title",
  "summary": "One-sentence purpose",
  "slides": [
    { "slide_type": "content", "title": "Slide title", "content": { "text": "# Heading\\n\\nUseful body" }, "settings": {} },
    { "slide_type": "poll", "title": "Audience poll", "content": { "question": "Question", "options": [{ "id": "1", "text": "Option A" }, { "id": "2", "text": "Option B" }] }, "settings": {} },
    { "slide_type": "quiz", "title": "Knowledge check", "content": { "question": "Question", "answers": [{ "id": "1", "text": "Correct", "is_correct": true }, { "id": "2", "text": "Distractor", "is_correct": false }], "time_limit": 30, "points": 1000 }, "settings": {} }
  ]
}

Source material:
${input.sourceText.slice(0, 24000)}`;
}
