import { useState, useRef } from "react";
import type { SourceType } from "@/components/builder/SourcePicker";
import { extractTextFromFile, FileExtractionError } from "@/lib/file-extract";

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
        <FileUploadArea onTextExtracted={(text) => onAiTopicChange(text)} currentText={aiTopic} />
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

function FileUploadArea({ onTextExtracted, currentText }: { onTextExtracted: (text: string) => void; currentText: string }) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [extracting, setExtracting] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileError, setFileError] = useState("");
  const [dragOver, setDragOver] = useState(false);

  async function handleFile(file: File) {
    setFileError("");
    setExtracting(true);
    setFileName(null);

    try {
      const { text, filename } = await extractTextFromFile(file);
      setFileName(filename);
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
    // Reset input so same file can be selected again
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
    <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
      {/* Drop zone */}
      <div
        onClick={() => fileInputRef.current?.click()}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "0.5rem",
          padding: "1.5rem",
          border: `2px dashed ${dragOver ? "var(--accent)" : "var(--line)"}`,
          borderRadius: "var(--radius-xl)",
          background: dragOver ? "var(--accent-light)" : "var(--bg-subtle)",
          cursor: "pointer",
          transition: "all 0.15s ease",
        }}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".txt,.md,.pdf,.docx"
          onChange={handleInputChange}
          style={{ display: "none" }}
        />
        {extracting ? (
          <>
            <span style={{ fontSize: "1.5rem" }}>⏳</span>
            <span style={{ fontSize: "0.8125rem", fontWeight: 700, color: "var(--muted)" }}>Extracting text…</span>
          </>
        ) : fileName ? (
          <>
            <span style={{ fontSize: "1.5rem" }}>✅</span>
            <span style={{ fontSize: "0.8125rem", fontWeight: 700, color: "var(--success)" }}>{fileName}</span>
            <span style={{ fontSize: "0.75rem", color: "var(--muted)" }}>Click to upload a different file</span>
          </>
        ) : (
          <>
            <span style={{ fontSize: "1.5rem" }}>📁</span>
            <span style={{ fontSize: "0.8125rem", fontWeight: 700, color: "var(--ink)" }}>Upload a file</span>
            <span style={{ fontSize: "0.75rem", color: "var(--muted)" }}>PDF, Word, TXT, or Markdown · Max 5MB</span>
          </>
        )}
      </div>

      {fileError && <p style={{ fontSize: "0.8125rem", fontWeight: 600, color: "var(--primary)", margin: 0 }}>{fileError}</p>}

      {/* Textarea */}
      <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
        <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--muted)" }}>Or paste text directly:</span>
        <textarea
          value={currentText}
          onChange={(e) => onTextExtracted(e.target.value)}
          placeholder="Paste document content here…"
          rows={5}
          className="builder-source-input"
        />
      </div>

      {currentText.length > 0 && (
        <span style={{ fontSize: "0.7rem", color: "var(--muted)", textAlign: "right" }}>
          {currentText.length.toLocaleString()} / 24,000 characters
        </span>
      )}
    </div>
  );
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
