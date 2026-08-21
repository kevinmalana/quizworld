import { useEffect, useId, useState, useRef } from "react";
import type { SourceType } from "@/components/builder/SourcePicker";
import { extractTextFromFile, FileExtractionError } from "@/lib/file-extract";
import type { AIGenerationOptions, AIDifficultyPreset, AITonePreset } from "@/lib/quiz-ai";
import { DEFAULT_AI_OPTIONS } from "@/lib/quiz-ai";

export type AIQuestionCount = 5 | 10 | 20 | 30 | 50 | 65;

const QUESTION_COUNTS: AIQuestionCount[] = [5, 10, 20, 30, 50, 65];

type SourceModalProps = {
  sourceType: SourceType;
  aiTopic: string;
  aiUrl: string;
  pasteText: string;
  aiCount: AIQuestionCount;
  aiOptions: AIGenerationOptions;
  aiLoading: boolean;
  aiError: string;
  onClose: () => void;
  onAiTopicChange: (value: string) => void;
  onAiUrlChange: (value: string) => void;
  onPasteTextChange: (value: string) => void;
  onAiCountChange: (value: AIQuestionCount) => void;
  onAiOptionsChange: (options: AIGenerationOptions) => void;
  onAiGenerate: (sourceMode: "topic" | "document") => void;
  onPasteImport: () => void;
  onUrlFetch: () => void;
};

export function CreateSourceModals({
  sourceType,
  aiTopic,
  aiUrl,
  pasteText,
  aiCount,
  aiOptions,
  aiLoading,
  aiError,
  onClose,
  onAiTopicChange,
  onAiUrlChange,
  onPasteTextChange,
  onAiCountChange,
  onAiOptionsChange,
  onAiGenerate,
  onPasteImport,
  onUrlFetch,
}: SourceModalProps) {
  if (sourceType === "ai-topic") {
    return (
      <BuilderSourceModal title="💡 AI Topic Generator" onClose={onClose}>
        <textarea
          value={aiTopic}
          onChange={(e) => onAiTopicChange(e.target.value)}
          placeholder="Describe your topic… e.g. 'The solar system and its planets'"
          rows={2}
          className="builder-source-input"
          autoFocus
        />
        <AIOptionsPanel options={aiOptions} onChange={onAiOptionsChange} />
        <SourceError message={aiError} />
        <ModalFooter>
          <QuestionCountPicker value={aiCount} onChange={onAiCountChange} />
          <button onClick={() => onAiGenerate("topic")} disabled={aiLoading || aiTopic.trim().length < 5} className="btn btn-primary btn-compact builder-source-action">
            {aiLoading ? "Generating…" : "Generate ✨"}
          </button>
        </ModalFooter>
      </BuilderSourceModal>
    );
  }

  if (sourceType === "paste") {
    return (
      <BuilderSourceModal title="📋 Paste Questions" onClose={onClose}>
        <textarea
          value={pasteText}
          onChange={(e) => onPasteTextChange(e.target.value)}
          placeholder={"Paste anything — structured questions OR raw text\n\nStructured format (parsed directly):\nQuestion 1: What is the capital of France?\n* Paris\n- London\n- Berlin\n- Rome\n\nOr just paste notes, articles, study material — AI will generate questions from it."}
          rows={6}
          className="builder-source-input builder-source-input--mono"
          autoFocus
        />
        <AIOptionsPanel options={aiOptions} onChange={onAiOptionsChange} />
        <SourceError message={aiError} />
        <ModalFooter>
          <QuestionCountPicker value={aiCount} onChange={onAiCountChange} />
          <button onClick={onPasteImport} disabled={aiLoading || pasteText.trim().length < 5} className="btn btn-primary btn-compact builder-source-action">
            {aiLoading ? "Generating…" : "Import ✨"}
          </button>
        </ModalFooter>
      </BuilderSourceModal>
    );
  }

  if (sourceType === "ai-url") {
    return (
      <BuilderSourceModal title="🔗 AI from URL" onClose={onClose}>
        <input
          value={aiUrl}
          onChange={(e) => onAiUrlChange(e.target.value)}
          placeholder="https://en.wikipedia.org/wiki/..."
          className="builder-source-input"
          autoFocus
        />
        <AIOptionsPanel options={aiOptions} onChange={onAiOptionsChange} />
        <SourceError message={aiError} />
        <ModalFooter>
          <QuestionCountPicker value={aiCount} onChange={onAiCountChange} />
          <button onClick={onUrlFetch} disabled={aiLoading || !aiUrl.trim()} className="btn btn-primary btn-compact builder-source-action">
            {aiLoading ? "Fetching…" : "Fetch & Generate ✨"}
          </button>
        </ModalFooter>
      </BuilderSourceModal>
    );
  }

  if (sourceType === "ai-document") {
    return (
      <BuilderSourceModal title="📄 AI from Document" onClose={onClose}>
        <FileUploadArea onTextExtracted={(text) => onAiTopicChange(text)} currentText={aiTopic} />
        <AIOptionsPanel options={aiOptions} onChange={onAiOptionsChange} />
        <SourceError message={aiError} />
        <ModalFooter>
          <QuestionCountPicker value={aiCount} onChange={onAiCountChange} />
          <button onClick={() => onAiGenerate("document")} disabled={aiLoading || aiTopic.trim().length < 20} className="btn btn-primary btn-compact builder-source-action">
            {aiLoading ? "Generating…" : "Generate ✨"}
          </button>
        </ModalFooter>
      </BuilderSourceModal>
    );
  }

  return null;
}

// ── AI Options Panel ──────────────────────────────────────────

function AIOptionsPanel({ options, onChange }: { options: AIGenerationOptions; onChange: (o: AIGenerationOptions) => void }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="builder-ai-options">
      <button
        onClick={() => setExpanded(!expanded)}
        className="builder-ai-options__toggle"
      >
        <span>⚙️ Customize generation</span>
        <span className={expanded ? "builder-ai-options__chevron is-open" : "builder-ai-options__chevron"}>▼</span>
      </button>

      {expanded && (
        <div className="builder-ai-options__body">
          {/* Audience */}
          <div>
            <label className="builder-ai-options__label">👤 Who is this for?</label>
            <input
              type="text"
              value={options.audience}
              onChange={(e) => onChange({ ...options, audience: e.target.value })}
              placeholder="e.g. Year 10 students, trivia night, new employees"
              className="builder-ai-options__input"
            />
          </div>

          {/* Difficulty */}
          <div>
            <label className="builder-ai-options__label">📊 Difficulty</label>
            <div className="builder-ai-options__chip-row">
              {(["easy", "balanced", "mixed", "hard"] as AIDifficultyPreset[]).map((d) => (
                <button
                  key={d}
                  onClick={() => onChange({ ...options, difficulty: d })}
                  className={options.difficulty === d ? "builder-ai-chip is-selected" : "builder-ai-chip"}
                >
                  {d === "easy" ? "🟢 Easy" : d === "balanced" ? "🟡 Balanced" : d === "mixed" ? "🎲 Mixed" : "🔴 Hard"}
                </button>
              ))}
            </div>
          </div>

          {/* Question types */}
          <div>
            <label className="builder-ai-options__label">❓ Question types</label>
            <div className="builder-ai-options__question-types">
              <ToggleChip
                label="◉ Multiple Choice"
                active={options.questionTypes.mc}
                onToggle={() => onChange({ ...options, questionTypes: { ...options.questionTypes, mc: !options.questionTypes.mc } })}
                disabled={options.questionTypes.mc && !options.questionTypes.tf}
              />
              <ToggleChip
                label="⚖ True / False"
                active={options.questionTypes.tf}
                onToggle={() => onChange({ ...options, questionTypes: { ...options.questionTypes, tf: !options.questionTypes.tf } })}
                disabled={options.questionTypes.tf && !options.questionTypes.mc}
              />
            </div>
          </div>

          {/* Tone */}
          <div>
            <label className="builder-ai-options__label">🎯 Tone</label>
            <div className="builder-ai-options__chip-row">
              {(["educational", "fun", "exam", "challenging"] as AITonePreset[]).map((t) => (
                <button
                  key={t}
                  onClick={() => onChange({ ...options, tone: t })}
                  className={options.tone === t ? "builder-ai-chip is-selected" : "builder-ai-chip"}
                >
                  {t === "educational" ? "📚 Educational" : t === "fun" ? "🎉 Fun" : t === "exam" ? "📝 Exam" : "🧠 Challenging"}
                </button>
              ))}
            </div>
          </div>

          {/* Focus areas */}
          <div>
            <label className="builder-ai-options__label">🔍 Focus areas <span className="builder-ai-options__optional">(optional)</span></label>
            <input
              type="text"
              value={options.focusAreas}
              onChange={(e) => onChange({ ...options, focusAreas: e.target.value })}
              placeholder="e.g. photosynthesis, cell division, mitosis"
              className="builder-ai-options__input"
            />
          </div>
        </div>
      )}
    </div>
  );
}

function ToggleChip({ label, active, onToggle, disabled }: { label: string; active: boolean; onToggle: () => void; disabled?: boolean }) {
  return (
    <button
      onClick={onToggle}
      disabled={disabled}
      className={[
        "builder-ai-chip",
        active ? "is-selected" : "",
        disabled ? "is-disabled" : "",
      ].filter(Boolean).join(" ")}
    >
      {active ? "✓ " : ""}{label}
    </button>
  );
}

// ── File Upload Area ───────────────────────────────────────────

function FileUploadArea({ onTextExtracted, currentText }: { onTextExtracted: (text: string) => void; currentText: string }) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [extracting, setExtracting] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileError, setFileError] = useState("");
  const [fileWarning, setFileWarning] = useState("");
  const [dragOver, setDragOver] = useState(false);

  async function handleFile(file: File) {
    setFileError("");
    setFileWarning("");
    setExtracting(true);
    setFileName(null);

    try {
      const { text, filename, truncated } = await extractTextFromFile(file);
      setFileName(filename);
      if (truncated) {
        setFileWarning(`Text was truncated to 24,000 characters. Original file had more content.`);
      }
      onTextExtracted(text);
    } catch (err) {
      if (err instanceof FileExtractionError) {
        setFileError(err.message);
      } else {
        setFileError("Failed to read this file. Try a different file or paste the text directly.");
      }
    } finally {
      setExtracting(false);
    }
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(true);
  }

  function handleDragLeave() {
    setDragOver(false);
  }

  return (
    <div className="builder-file-upload">
      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={dragOver ? "builder-file-dropzone is-drag-over" : "builder-file-dropzone"}
        aria-label="Upload a source document"
      >
        {extracting ? (
          <>
            <span className="builder-file-icon">⏳</span>
            <span className="builder-file-status builder-file-status--muted">Extracting text…</span>
          </>
        ) : fileName ? (
          <>
            <span className="builder-file-icon">✅</span>
            <span className="builder-file-status builder-file-status--success">{fileName}</span>
            <span className="builder-file-hint">Choose a different file</span>
          </>
        ) : (
          <>
            <span className="builder-file-icon">📁</span>
            <span className="builder-file-status">Upload a file</span>
            <span className="builder-file-hint">PDF, Word, TXT, or Markdown · Max 25MB</span>
          </>
        )}
      </button>
      <input ref={fileInputRef} type="file" accept=".txt,.md,.pdf,.docx" onChange={handleInputChange} className="builder-file-input" />

      {fileError && <p className="builder-file-error">{fileError}</p>}
      {fileWarning && <p className="builder-file-warning" role="status">{fileWarning}</p>}

      <div className="builder-file-paste">
        <span className="builder-file-paste-label">Or paste text directly:</span>
        <textarea
          value={currentText}
          onChange={(e) => onTextExtracted(e.target.value)}
          placeholder="Paste document content here…"
          rows={5}
          className="builder-source-input"
        />
      </div>

      {currentText.length > 0 && (
        <span className="builder-file-count">
          {currentText.length.toLocaleString()} / 24,000 characters
        </span>
      )}
    </div>
  );
}

// ── Shared components ──────────────────────────────────────────

function BuilderSourceModal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const titleId = useId();

  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null;
    const dialog = dialogRef.current;
    const focusable = () => Array.from(dialog?.querySelectorAll<HTMLElement>(
      'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
    ) ?? []);
    focusable()[0]?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab") return;
      const items = focusable();
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      previousFocus?.focus();
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center glass-dark">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="card-elevated builder-source-modal"
      >
        <div className="flex items-center justify-between">
          <h2 id={titleId} className="font-display font-bold text-lg text-[var(--ink)]">{title}</h2>
          <button onClick={onClose} className="builder-source-close" aria-label="Close source dialog">✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function SourceError({ message }: { message: string }) {
  if (!message) return null;
  return <p className="text-sm font-semibold text-red-500">{message}</p>;
}

function ModalFooter({ children }: { children: React.ReactNode }) {
  return <div className="builder-source-footer">{children}</div>;
}

function QuestionCountPicker({ value, onChange }: { value: AIQuestionCount; onChange: (value: AIQuestionCount) => void }) {
  return (
    <div className="builder-question-counts">
      <span className="builder-question-counts__label">Q:</span>
      {QUESTION_COUNTS.map((n) => (
        <button
          key={n}
          onClick={() => onChange(n)}
          className={value === n ? "btn btn-compact builder-question-count is-selected" : "btn btn-compact builder-question-count"}
        >
          {n}
        </button>
      ))}
    </div>
  );
}
