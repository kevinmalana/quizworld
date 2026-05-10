import type { Slide } from "@/lib/presentation/types";

type EditorTopbarProps = {
  title: string;
  onTitleChange: (value: string) => void;
  joinCode: string | null;
  error: string;
  saving: boolean;
  onBack: () => void;
  onSave: () => void;
  onPresent: () => void;
};

export function EditorTopbar({ title, onTitleChange, joinCode, error, saving, onBack, onSave, onPresent }: EditorTopbarProps) {
  return (
    <div className="present-editor-topbar">
      <button onClick={onBack} className="present-editor-back-btn">←</button>
      <input
        value={title}
        onChange={(e) => onTitleChange(e.target.value)}
        placeholder="Presentation title…"
        className="present-editor-title-input"
      />
      {error && <span className="present-editor-error">{error}</span>}
      {joinCode && <span className="present-editor-join-badge">Code: {joinCode}</span>}
      <button onClick={onSave} disabled={saving} className="present-editor-save-btn">{saving ? "Saving…" : "Save"}</button>
      <button onClick={onPresent} className="present-editor-present-btn">🎤 Present</button>
    </div>
  );
}
