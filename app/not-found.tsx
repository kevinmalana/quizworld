import Link from "next/link";

export default function NotFound() {
  return (
    <div
      style={{
        minHeight: "calc(100vh - 64px)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "2rem",
        textAlign: "center",
      }}
    >
      <div style={{ fontSize: "5rem", marginBottom: "1rem" }}>🔍</div>
      <h1
        className="font-display"
        style={{
          fontSize: "clamp(2rem, 5vw, 3rem)",
          fontWeight: 900,
          color: "var(--ink)",
          marginBottom: "0.5rem",
        }}
      >
        Page not found
      </h1>
      <p
        style={{
          color: "var(--muted)",
          fontSize: "1rem",
          marginBottom: "2rem",
          maxWidth: "40ch",
        }}
      >
        The page you&apos;re looking for doesn&apos;t exist or has been moved.
      </p>
      <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
        <Link href="/" className="btn btn-primary btn-sm">
          Go Home
        </Link>
        <Link href="/explore" className="btn btn-secondary btn-sm">
          Explore Quizzes
        </Link>
      </div>
    </div>
  );
}
