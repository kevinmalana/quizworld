import type { Slide, SlideType } from "@/lib/presentation/types";
import { SLIDE_TYPES } from "./slide-types";
import { ImageUpload } from "@/components/builder/ImageUpload";

type SlideEditorPanelProps = {
  slide: Slide;
  slideIndex: number;
  slideCount: number;
  onUpdate: (updates: Partial<Slide>) => void;
  onDelete: () => void;
  onConvertImported?: (type: SlideType) => void;
};

const INTERACTIVE_TYPES: { type: SlideType; icon: string; label: string }[] = [
  { type: "poll", icon: "📊", label: "Poll" },
  { type: "quiz", icon: "🏆", label: "Quiz" },
  { type: "word_cloud", icon: "☁️", label: "Word Cloud" },
  { type: "open_text", icon: "💬", label: "Open Text" },
  { type: "qna", icon: "❓", label: "Q&A" },
];

export function SlideEditorPanel({ slide, slideIndex, slideCount, onUpdate, onDelete, onConvertImported }: SlideEditorPanelProps) {
  const updateContent = (partial: Record<string, unknown>) => {
    onUpdate({ content: { ...slide.content, ...partial } });
  };

  const isImported = !!(slide.content as Record<string, unknown>)._imported;

  return (
    <div className="present-slide-editor-panel">
      <div className="card present-slide-editor-card">
        <div className="present-slide-editor-title-row">
          <span className="present-slide-editor-icon">{SLIDE_TYPES.find(s => s.type === slide.slide_type)?.icon}</span>
          <input
            value={slide.title}
            onChange={(e) => onUpdate({ title: e.target.value })}
            placeholder="Slide title…"
            className="present-slide-editor-title-input"
          />
          <span style={{ fontSize: "0.75rem", color: "var(--muted)", fontWeight: 600, whiteSpace: "nowrap", flexShrink: 0 }}>
            {slideIndex + 1} / {slideCount}
          </span>
          <button onClick={onDelete} disabled={slideCount <= 1} className="present-slide-editor-delete">✕</button>
        </div>

        {/* Convert imported slide banner */}
        {isImported && onConvertImported && (
          <div style={{
            background: "var(--surface-alt, #f7f7f8)", border: "1px solid var(--line)",
            borderRadius: "var(--radius-lg, 8px)", padding: "0.75rem 1rem",
            marginBottom: "0.75rem",
          }}>
            <p style={{ fontSize: "0.8125rem", color: "var(--muted)", marginBottom: "0.5rem", fontWeight: 600 }}>
              📌 This is an imported slide. Convert it to make it interactive:
            </p>
            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
              {INTERACTIVE_TYPES.map(({ type, icon, label }) => (
                <button
                  key={type}
                  onClick={() => onConvertImported(type)}
                  className="btn btn-secondary"
                  style={{ fontSize: "0.75rem", padding: "0.25rem 0.625rem" }}
                >
                  {icon} {label}
                </button>
              ))}
            </div>
          </div>
        )}

        {slide.slide_type === "content" && (
          <div>
            <textarea
              value={slide.content.text || ""}
              onChange={(e) => updateContent({ text: e.target.value })}
              placeholder="Slide content… Use markdown for formatting"
              rows={6}
              className="present-editor-textarea"
            />
            <div className="present-slide-editor-image-upload">
              <ImageUpload
                imageUrl={slide.content.image_url}
                onUpload={(url) => updateContent({ image_url: url })}
                onRemove={() => updateContent({ image_url: null })}
                label="Add slide image"
                compact
              />
            </div>
          </div>
        )}

        {slide.slide_type === "word_cloud" && (
          <div>
            <label className="present-editor-label">Prompt</label>
            <input
              value={slide.content.prompt || ""}
              onChange={(e) => updateContent({ prompt: e.target.value })}
              placeholder="What comes to mind when…"
              className="present-editor-input"
            />
          </div>
        )}

        {slide.slide_type === "open_text" && (
          <div>
            <label className="present-editor-label">Question</label>
            <input
              value={slide.content.question || ""}
              onChange={(e) => updateContent({ question: e.target.value })}
              placeholder="What do you think about…"
              className="present-editor-input"
            />
          </div>
        )}

        {slide.slide_type === "poll" && (
          <div>
            <label className="present-editor-label">Options</label>
            {(slide.content.options || []).map((opt, oi) => (
              <div key={opt.id} className="present-editor-option-row">
                <input
                  value={opt.text}
                  onChange={(e) => {
                    const opts = [...(slide.content.options || [])];
                    opts[oi] = { ...opts[oi], text: e.target.value };
                    updateContent({ options: opts });
                  }}
                  placeholder={`Option ${oi + 1}`}
                  className="present-editor-option-input"
                />
                <button
                  onClick={() => {
                    const opts = (slide.content.options || []).filter((_, i) => i !== oi);
                    updateContent({ options: opts });
                  }}
                  className="present-editor-remove-btn"
                >✕</button>
              </div>
            ))}
            <button
              onClick={() => {
                const opts = [...(slide.content.options || []), { id: String(Date.now()), text: "" }];
                updateContent({ options: opts });
              }}
              className="present-editor-add-item-btn"
            >+ Add Option</button>
          </div>
        )}

        {slide.slide_type === "quiz" && (
          <div>
            <label className="present-editor-label">Answers</label>
            {(slide.content.answers || []).map((ans, ai) => (
              <div key={ans.id} className="present-editor-answer-row">
                <button
                  onClick={() => {
                    const ansList = (slide.content.answers || []).map((a, i) => ({ ...a, is_correct: i === ai }));
                    updateContent({ answers: ansList });
                  }}
                  className={ans.is_correct ? "present-editor-correct-btn is-correct" : "present-editor-correct-btn"}
                >{ans.is_correct ? "✓" : String.fromCharCode(65 + ai)}</button>
                <input
                  value={ans.text}
                  onChange={(e) => {
                    const ansList = [...(slide.content.answers || [])];
                    ansList[ai] = { ...ansList[ai], text: e.target.value };
                    updateContent({ answers: ansList });
                  }}
                  placeholder={`Answer ${String.fromCharCode(65 + ai)}`}
                  className="present-editor-option-input"
                />
              </div>
            ))}
            <button
              onClick={() => {
                const ansList = [...(slide.content.answers || []), { id: String(Date.now()), text: "", is_correct: false }];
                updateContent({ answers: ansList });
              }}
              className="present-editor-add-item-btn"
            >+ Add Answer</button>
          </div>
        )}

        {slide.slide_type === "scale" && (
          <div className="present-editor-scale-grid">
            <div className="present-editor-scale-pair">
              <div className="present-editor-scale-field">
                <label className="present-editor-label">Min</label>
                <input type="number" value={slide.content.min ?? 1} onChange={(e) => updateContent({ min: Number(e.target.value) })} className="present-editor-number" />
              </div>
              <div className="present-editor-scale-field">
                <label className="present-editor-label">Max</label>
                <input type="number" value={slide.content.max ?? 10} onChange={(e) => updateContent({ max: Number(e.target.value) })} className="present-editor-number" />
              </div>
            </div>
            <div>
              <label className="present-editor-label">Min Label</label>
              <input value={slide.content.min_label || ""} onChange={(e) => updateContent({ min_label: e.target.value })} placeholder="Not at all" className="present-editor-number" />
            </div>
            <div>
              <label className="present-editor-label">Max Label</label>
              <input value={slide.content.max_label || ""} onChange={(e) => updateContent({ max_label: e.target.value })} placeholder="Very much" className="present-editor-number" />
            </div>
          </div>
        )}

        {slide.slide_type === "qna" && (
          <div className="present-editor-qna-placeholder">
            <div className="present-editor-qna-icon">❓</div>
            <p className="present-editor-qna-title">Q&A slide — audience submits questions during presentation</p>
            <p className="present-editor-qna-hint">Questions appear live. Other participants can upvote.</p>
          </div>
        )}
      </div>
    </div>
  );
}
