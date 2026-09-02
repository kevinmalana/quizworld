"use client";

import Link from "next/link";
import type { buildTeacherClassroomJourney } from "@/lib/classroom/teacher-journey";

type TeacherJourney = ReturnType<typeof buildTeacherClassroomJourney>;

type TeacherJourneyCardProps = {
  journey: TeacherJourney;
  joinCode: string;
  onShareCode: () => void;
  onAssignQuiz: () => void;
  onReviewProgress: () => void;
  onReviewInsights: () => void;
};

export function TeacherJourneyCard({
  journey,
  joinCode,
  onShareCode,
  onAssignQuiz,
  onReviewProgress,
  onReviewInsights,
}: TeacherJourneyCardProps) {
  const { nextAction } = journey;

  const action = nextAction.kind === "share_code" ? (
    <button className="btn btn-primary" onClick={onShareCode}>📋 {nextAction.label}</button>
  ) : nextAction.kind === "create_quiz" ? (
    <Link className="btn btn-primary" href="/create">✏️ {nextAction.label}</Link>
  ) : nextAction.kind === "assign_quiz" ? (
    <button className="btn btn-primary" onClick={onAssignQuiz}>📚 {nextAction.label}</button>
  ) : nextAction.kind === "review_progress" ? (
    <button className="btn btn-primary" onClick={onReviewProgress}>📊 {nextAction.label}</button>
  ) : (
    <button className="btn btn-primary" onClick={onReviewInsights}>💡 {nextAction.label}</button>
  );

  return (
    <section className="card ct-journey" aria-labelledby="teacher-journey-title">
      <div className="ct-journey__header">
        <div>
          <div className="ct-journey__eyebrow">Teacher launchpad</div>
          <h2 id="teacher-journey-title" className="font-display ct-journey__title">
            {journey.progressPercent === 100 ? "Keep your class moving" : "Launch your classroom"}
          </h2>
          <p className="ct-journey__subtitle">
            {journey.progressPercent === 100
              ? "Use results from one activity to choose what your class does next."
              : "Prepare a quiz, assign practice, then invite students into a ready-to-use class."}
          </p>
        </div>
        <div className="ct-journey__progress" aria-label={`${journey.completedCount} of 3 classroom launch steps complete`}>
          <strong>{journey.completedCount}/3</strong>
          <span>complete</span>
        </div>
      </div>

      <div className="ct-journey__bar" aria-hidden="true">
        <div className="ct-journey__bar-fill" style={{ width: `${journey.progressPercent}%` }} />
      </div>

      <ol className="ct-journey__steps">
        {journey.steps.map((step, index) => (
          <li key={step.id} className={`ct-journey-step${step.completed ? " is-complete" : ""}`}>
            <span className="ct-journey-step__marker" aria-label={step.completed ? "Complete" : `Step ${index + 1}`}>
              {step.completed ? "✓" : index + 1}
            </span>
            <div>
              <div className="ct-journey-step__label">{step.label}</div>
              <div className="ct-journey-step__description">{step.description}</div>
            </div>
          </li>
        ))}
      </ol>

      <div className="ct-journey__next">
        <div>
          <div className="ct-journey__next-label">Next best action</div>
          <div className="ct-journey__next-description">{nextAction.description}</div>
          {nextAction.kind === "share_code" && <div className="ct-journey__code">Student code: {joinCode}</div>}
        </div>
        {action}
      </div>
    </section>
  );
}
