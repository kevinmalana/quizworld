import type { SourceType } from "@/components/builder/SourcePicker";

export type AIQuestionCount = 3 | 5 | 8 | 10;

const QUESTION_COUNTS: AIQuestionCount[] = [3, 5, 8, 10];

type SourceModalProps = {
  sourceType: SourceType;
  aiTopic: string;
  aiUrl: string;
  pasteText: string;
  aiCount: AIQuestionCount;
  aiLoading: boolean;
  aiError: string;
  onClose: () => void;
  onAiTopicChange: (value: string) => void;
  onAiUrlChange: (value: string) => void;
  onPasteTextChange: (value: string) => void;
  onAiCountChange: (value: AIQuestionCount) => void;
  onAiGenerate: () => void;
  onPasteImport: () => void;
  onUrlFetch: () => void;
};

export function CreateSourceModals({
  sourceType,
  aiTopic,
  aiUrl,
  pasteText,
  aiCount,
  aiLoading,
  aiError,
  onClose,
  onAiTopicChange,
  onAiUrlChange,
  onPasteTextChange,
  onAiCountChange,
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
        <SourceError message={aiError} />
        <ModalFooter>
          <QuestionCountPicker value={aiCount} onChange={onAiCountChange} />
          <button onClick={onAiGenerate} disabled={aiLoading || aiTopic.trim().length < 5} className="btn btn-primary btn-compact" style={{ flexShrink: 0 }}>
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
          placeholder={"Question 1: What is the capital of France?\n* Paris\n- London\n- Berlin\n- Rome"}
          rows={6}
          className="builder-source-input builder-source-input--mono"
          autoFocus
        />
        <SourceError message={aiError} />
        <div className="flex justify-end">
          <button onClick={onPasteImport} className="btn btn-primary btn-compact">Import →</button>
        </div>
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
        <ModalFooter>
          <QuestionCountPicker value={aiCount} onChange={onAiCountChange} />
          <button onClick={onUrlFetch} disabled={aiLoading || !aiUrl.trim()} className="btn btn-primary btn-compact" style={{ flexShrink: 0 }}>
            {aiLoading ? "Fetching…" : "Fetch & Generate ✨"}
          </button>
        </ModalFooter>
        <SourceError message={aiError} />
      </BuilderSourceModal>
    );
  }

  if (sourceType === "ai-document") {
    return (
      <BuilderSourceModal title="📄 AI from Document" onClose={onClose}>
        <p className="text-sm text-[var(--muted)]">Paste your document text below and AI will generate quiz questions from it.</p>
        <textarea
          value={aiTopic}
          onChange={(e) => onAiTopicChange(e.target.value)}
          placeholder="Paste document content here…"
          rows={6}
          className="builder-source-input"
          autoFocus
        />
        <SourceError message={aiError} />
        <ModalFooter>
          <QuestionCountPicker value={aiCount} onChange={onAiCountChange} />
          <button onClick={onAiGenerate} disabled={aiLoading || aiTopic.trim().length < 20} className="btn btn-primary btn-compact" style={{ flexShrink: 0 }}>
            {aiLoading ? "Generating…" : "Generate ✨"}
          </button>
        </ModalFooter>
      </BuilderSourceModal>
    );
  }

  return null;
}

function BuilderSourceModal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center glass-dark">
      <div className="card-elevated builder-source-modal">
        <div className="flex items-center justify-between">
          <h2 className="font-display font-bold text-lg text-[var(--ink)]">{title}</h2>
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
          className="btn btn-compact"
          style={{
            background: value === n ? "var(--accent)" : "var(--surface)",
            color: value === n ? "#fff" : "var(--ink)",
            border: value === n ? "1px solid var(--accent)" : "1px solid var(--line)",
            padding: "0.375rem 0.75rem",
            fontSize: "0.8125rem",
          }}
        >
          {n}
        </button>
      ))}
    </div>
  );
}
