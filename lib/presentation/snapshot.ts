// One slide/run-identity rule for applying presentation snapshots, shared by
// initial load, realtime channel events and polling fallback (audit F2,
// 2026-10-28). Response drafts must reset only on a genuine slide/run change
// — never on every repeated activity update — so a half-typed answer survives
// a same-slide refresh while a new slide never inherits the previous answer.

export type PresentationSnapshotSlide = { id: string; order_index: number };

export type PresentationSnapshotState<T extends PresentationSnapshotSlide = PresentationSnapshotSlide> = {
  slides: T[];
  currentIndex: number;
  runId: string | null;
};

export type PresentationSnapshotResult<T extends PresentationSnapshotSlide = PresentationSnapshotSlide> = PresentationSnapshotState<T> & {
  resultsHidden: boolean | null;
  revealedAnswers: Record<string, string[]> | null;
  ended: boolean;
  /** True only when the run id or the current slide identity actually changed. */
  slideChanged: boolean;
};

export function applyPresentationSnapshot<T extends PresentationSnapshotSlide>(
  current: PresentationSnapshotState<T>,
  snapshot: unknown,
): PresentationSnapshotResult<T> {
  const raw = (snapshot ?? {}) as Record<string, unknown>;

  const runId = typeof raw.run_id === "string" ? raw.run_id : current.runId;

  const slides = Array.isArray(raw.slides)
    ? [...(raw.slides as T[])].sort((a, b) => a.order_index - b.order_index)
    : current.slides;

  let currentIndex = Number.isInteger(raw.current_slide_index) ? raw.current_slide_index as number : current.currentIndex;
  if (currentIndex < 0) currentIndex = 0;
  if (slides.length > 0 && currentIndex > slides.length - 1) currentIndex = slides.length - 1;

  const nextSlideId = slides[currentIndex]?.id;
  const prevSlideId = current.slides[current.currentIndex]?.id;
  const slideChanged = runId !== current.runId || nextSlideId !== prevSlideId;

  const resultsHidden = typeof raw.results_hidden === "boolean" ? raw.results_hidden : null;
  const revealedAnswers =
    raw.quiz_reveals && typeof raw.quiz_reveals === "object"
      ? (raw.quiz_reveals as Record<string, string[]>)
      : null;

  return {
    slides,
    currentIndex,
    runId,
    resultsHidden,
    revealedAnswers,
    ended: raw.status === "finished",
    slideChanged,
  };
}
