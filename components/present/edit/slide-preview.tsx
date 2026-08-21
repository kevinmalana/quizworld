"use client";

import type { Slide } from "@/lib/presentation/types";
import { LiveSlideStage } from "@/components/present/live/live-slide-stage";

/** The editor preview is the real audience renderer with inert controls. */
export function SlidePreview({ slide }: { slide: Slide }) {
  const noop = () => undefined;

  return (
    <div
      aria-label="Audience view preview"
      style={{
        width: "100%",
        aspectRatio: "16/9",
        overflow: "auto",
        border: "1px solid var(--line)",
        borderRadius: "var(--radius-lg, 8px)",
        background: "var(--bg-subtle, #0f0f14)",
        pointerEvents: "none",
      }}
    >
      <LiveSlideStage
        currentSlide={slide}
        isHost={false}
        resultsHidden
        responseCount={0}
        allResponses={[]}
        qnaQuestions={[]}
        sortedWords={[]}
        pollCounts={{}}
        scaleValues={[]}
        scaleAvg={0}
        response=""
        selectedOption={null}
        scaleValue={5}
        submitted={false}
        newQnaQuestion=""
        channelJoined
        revealedAnswers={{}}
        setResponse={noop}
        setScaleValue={noop}
        setSelectedOption={noop}
        setNewQnaQuestion={noop}
        submitResponse={noop}
        submitQnaQuestion={noop}
        upvoteQna={noop}
      />
    </div>
  );
}
