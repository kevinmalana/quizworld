"use client";

import Link from "next/link";
import { useState } from "react";
import styles from "./create-activity.module.css";

type Output = "quiz" | "presentation" | "study";
type Source = "topic" | "document" | "url" | "deck" | "template";

const outputs: Array<{ id: Output; icon: string; title: string; description: string; meta: string }> = [
  { id: "quiz", icon: "🧠", title: "Quiz", description: "Live game, assignment, or self-study quiz.", meta: "Questions · Scoring · Reports" },
  { id: "presentation", icon: "🎤", title: "Presentation", description: "Interactive audience-ready slide deck.", meta: "Polls · Q&A · Quizzes" },
  { id: "study", icon: "⚡", title: "Study Set", description: "Flashcards and QuickFire practice.", meta: "Progress · XP · Assignments" },
];

const sources: Array<{ id: Source; icon: string; title: string; description: string }> = [
  { id: "topic", icon: "💡", title: "Topic", description: "Describe what you want to teach or test." },
  { id: "document", icon: "📄", title: "Document", description: "Upload or paste source-grounded material." },
  { id: "url", icon: "🔗", title: "URL", description: "Generate from a readable web page." },
  { id: "deck", icon: "📥", title: "Deck", description: "Import PowerPoint or PDF into a presentation." },
  { id: "template", icon: "🧩", title: "Template", description: "Start from a proven activity structure." },
];

function destination(output: Output, source: Source) {
  if (output === "presentation") {
    return source === "deck" ? "/present?mode=import&source=deck" : `/present?mode=ai&source=${source}`;
  }
  const purpose = output === "study" ? "&purpose=study" : "";
  const supportedSource = source === "deck" ? "document" : source;
  return `/create?source=${supportedSource}${purpose}`;
}

export default function CreateActivityPage() {
  const [output, setOutput] = useState<Output>("quiz");
  const [source, setSource] = useState<Source>("topic");
  const deckNeedsPresentation = source === "deck" && output !== "presentation";

  return (
    <main className={styles.shell}>
      <section className={styles.hero} aria-labelledby="create-heading">
        <p className={styles.eyebrow}>Create once. Deliver anywhere.</p>
        <h1 id="create-heading">What do you want to create?</h1>
        <p>Choose an output and a source. QuizWorld carries both choices into the authoring flow.</p>
      </section>

      <section aria-labelledby="output-heading">
        <h2 id="output-heading">1. Choose the output</h2>
        <div className={styles.grid}>
          {outputs.map((item) => (
            <button key={item.id} type="button" className={styles.card} aria-pressed={output === item.id} onClick={() => setOutput(item.id)}>
              <span className={styles.icon} aria-hidden="true">{item.icon}</span>
              <div><h3>{item.title}</h3><p>{item.description}</p></div>
              <p className={styles.meta}>{item.meta}</p>
            </button>
          ))}
        </div>
      </section>

      <section aria-labelledby="source-heading">
        <h2 id="source-heading">2. Choose the source</h2>
        <div className={styles.grid}>
          {sources.map((item) => (
            <button key={item.id} type="button" className={styles.card} aria-pressed={source === item.id} onClick={() => setSource(item.id)}>
              <span className={styles.icon} aria-hidden="true">{item.icon}</span>
              <div><h3>{item.title}</h3><p>{item.description}</p></div>
            </button>
          ))}
        </div>
      </section>

      {deckNeedsPresentation && (
        <p role="status" className={styles.tip}>Deck import creates a presentation. Choose Presentation to continue with PowerPoint or PDF.</p>
      )}

      <Link
        className="btn btn-primary btn-lg"
        href={destination(output, source)}
        aria-disabled={deckNeedsPresentation}
        onClick={(event) => { if (deckNeedsPresentation) event.preventDefault(); }}
      >
        Continue with {sources.find((item) => item.id === source)?.title} →
      </Link>
    </main>
  );
}
