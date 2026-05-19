export function GameNotice({ notice, maxWidth = 720 }: { notice: string | null; maxWidth?: number }) {
  if (!notice) return null;
  return (
    <div className="card game-notice" style={{ maxWidth }}>
      {notice}
    </div>
  );
}
