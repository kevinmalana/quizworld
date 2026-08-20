import Link from "next/link";

import styles from "./create-activity.module.css";

const creationPaths = [
  {
    icon: "🧠",
    title: "Create a quiz",
    description: "Start manually or generate questions from a topic, document, link, or pasted content.",
    href: "/create",
    action: "Create a quiz",
    meta: "Live game · Assignment · Self-study",
  },
  {
    icon: "🎤",
    title: "Create a presentation",
    description: "Generate an interactive deck with AI, import PowerPoint or PDF, or start with a blank canvas.",
    href: "/present?mode=ai",
    action: "Create a presentation",
    meta: "Polls · Q&A · Quizzes · Word clouds",
  },
  {
    icon: "⚡",
    title: "Build a study activity",
    description: "Turn an existing quiz into flashcards, QuickFire practice, or an independent study session.",
    href: "/study",
    action: "Browse study activities",
    meta: "Flashcards · QuickFire · Progress",
  },
] as const;

export default function CreateActivityPage() {
  return (
    <main className={styles.shell}>
      <section className={styles.hero} aria-labelledby="create-heading">
        <p className={styles.eyebrow}>Create once. Deliver anywhere.</p>
        <h1 id="create-heading">What do you want to create?</h1>
        <p>
          Choose the outcome first. QuizWorld will guide you to the best source, format, and delivery mode.
        </p>
      </section>

      <section className={styles.grid} aria-label="Creation options">
        {creationPaths.map((path) => (
          <article className={styles.card} key={path.title}>
            <span className={styles.icon} aria-hidden="true">{path.icon}</span>
            <div>
              <h2>{path.title}</h2>
              <p>{path.description}</p>
            </div>
            <p className={styles.meta}>{path.meta}</p>
            <Link className="btn btn-primary" href={path.href}>
              {path.action} <span aria-hidden="true">→</span>
            </Link>
          </article>
        ))}
      </section>

      <aside className={styles.tip}>
        <strong>Already have content?</strong>
        <span> Upload a document or deck and review the generated draft before publishing or presenting.</span>
      </aside>
    </main>
  );
}
