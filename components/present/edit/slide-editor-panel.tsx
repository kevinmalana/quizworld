import type { Slide, SlideType, InteractiveOverlay } from "@/lib/presentation/types";
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

type InteractiveType = "poll" | "quiz" | "open_text" | "word_cloud" | "qna";

const INTERACTIVE_TYPES: { type: InteractiveType; icon: string; label: string }[] = [
  { type: "poll", icon: "📊", label: "Poll" },
  { type: "quiz", icon: "🏆", label: "Quiz" },
  { type: "open_text", icon: "💬", label: "Open Text" },
  { type: "word_cloud", icon: "☁️", label: "Word Cloud" },
  { type: "qna", icon: "❓", label: "Q&A" },
];

function defaultInteractive(type: InteractiveType): InteractiveOverlay {
  switch (type) {
    case "poll": return { type, question: "", options: [{ id: "1", text: "" }, { id: "2", text: "" }] };
    case "quiz": return { type, question: "", answers: [{ id: "1", text: "", is_correct: true }, { id: "2", text: "", is_correct: false }] };
    case "open_text": return { type, question: "" };
    case "word_cloud": return { type, prompt: "" };
    case "qna": return { type };
  }
}

export function SlideEditorPanel({ slide, slideIndex, slideCount, onUpdate, onDelete }: SlideEditorPanelProps) {
  const updateContent = (partial: Record<string, unknown>) => {
    onUpdate({ content: { ...slide.content, ...partial } });
  };

  const updateInteractive = (partial: Partial<InteractiveOverlay>) => {
    const existing = (slide.content.interactive || {}) as Partial<InteractiveOverlay>;
    updateContent({ interactive: { ...existing, ...partial } });
  };

  const isImported = !!(slide.content as Record<string, unknown>)._imported;
  const hasImage = !!(slide.content as Record<string, unknown>).image_url;
  const hasText = !!((slide.content as Record<string, unknown>).text as string)?.trim();
  const interactive = slide.content.interactive as InteractiveOverlay | undefined;

  return (
    <div className="present-slide-editor-panel">
      <div className="card present-slide-editor-card">

        {/* Title row */}
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

        {/* ── CONTENT SLIDE (includes imported hybrid slides) ── */}
        {slide.slide_type === "content" && (
          <div>
            {/* Image section */}
            {hasImage ? (
              <div style={{ position: "relative", marginBottom: "0.75rem", borderRadius: "var(--radius-lg, 8px)", overflow: "hidden", border: "1px solid var(--line)", background: "var(--bg-subtle)" }}>
                <img
                  src={slide.content.image_url as string}
                  alt={slide.title || "Slide"}
                  style={{ width: "100%", display: "block", maxHeight: 200, objectFit: "contain" }}
                />
                <div style={{ position: "absolute", top: "0.5rem", left: "0.5rem", background: "rgba(0,0,0,0.55)", color: "#fff", fontSize: "0.7rem", fontWeight: 700, padding: "0.2rem 0.5rem", borderRadius: "4px" }}>
                  📄 Slide image
                </div>
                <button
                  onClick={() => updateContent({ image_url: undefined, _imported: false })}
                  title="Remove image"
                  style={{ position: "absolute", top: "0.5rem", right: "0.5rem", background: "rgba(0,0,0,0.55)", color: "#fff", border: "none", borderRadius: "4px", padding: "0.2rem 0.5rem", cursor: "pointer", fontSize: "0.75rem" }}
                >
                  ✕ Remove
                </button>
              </div>
            ) : !hasText ? (
              /* Empty: image upload as primary action */
              <div style={{ marginBottom: "0.75rem" }}>
                <ImageUpload imageUrl={undefined} onUpload={(url) => updateContent({ image_url: url })} onRemove={() => updateContent({ image_url: undefined })} label="Upload a slide image" />
                <div style={{ textAlign: "center", padding: "0.5rem 0", color: "var(--muted)", fontSize: "0.75rem" }}>— or add text below —</div>
              </div>
            ) : null}

            {/* Text / caption */}
            <label className="present-editor-label" style={{ fontSize: "0.75rem" }}>
              {hasImage ? "Optional caption" : "Slide content"}
            </label>
            <textarea
              value={slide.content.text || ""}
              onChange={(e) => updateContent({ text: e.target.value })}
              placeholder={hasImage ? "Add a caption or notes…" : "Slide content… Use markdown for formatting"}
              rows={hasImage ? 2 : 5}
              className="present-editor-textarea"
              style={{ marginBottom: "0.5rem" }}
            />

            {/* Image upload if has text but no image */}
            {!hasImage && hasText && (
              <div className="present-slide-editor-image-upload">
                <ImageUpload imageUrl={undefined} onUpload={(url) => updateContent({ image_url: url })} onRemove={() => updateContent({ image_url: undefined })} label="Add slide image" compact />
              </div>
            )}

            {/* ── INTERACTIVE OVERLAY SECTION ── */}
            <div style={{ marginTop: "0.75rem", borderTop: "1px solid var(--line)", paddingTop: "0.75rem" }}>
              {!interactive ? (
                /* No interactive yet — offer to add one */
                <div style={{ background: "var(--accent-light, #f0ecff)", border: "1px solid var(--accent-line, #ddd6fe)", borderRadius: "var(--radius-lg, 8px)", padding: "0.75rem 1rem" }}>
                  <p style={{ fontSize: "0.8125rem", color: "var(--accent)", marginBottom: "0.5rem", fontWeight: 700 }}>
                    ✨ Add an interactive layer to this slide
                  </p>
                  <p style={{ fontSize: "0.75rem", color: "var(--muted)", marginBottom: "0.75rem" }}>
                    The image stays. The interactive component appears below it for the audience.
                  </p>
                  <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                    {INTERACTIVE_TYPES.map(({ type, icon, label }) => (
                      <button
                        key={type}
                        onClick={() => updateContent({ interactive: defaultInteractive(type) })}
                        className="btn btn-secondary"
                        style={{ fontSize: "0.75rem", padding: "0.25rem 0.625rem" }}
                      >
                        {icon} {label}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                /* Interactive layer fields — inline editing */
                <div style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "var(--radius-lg, 8px)", padding: "0.75rem 1rem" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.75rem" }}>
                    <span style={{ fontSize: "0.875rem" }}>
                      {INTERACTIVE_TYPES.find(t => t.type === interactive.type)?.icon}
                    </span>
                    <span style={{ fontWeight: 700, fontSize: "0.8125rem" }}>
                      {INTERACTIVE_TYPES.find(t => t.type === interactive.type)?.label} layer
                    </span>
                    <button
                      onClick={() => updateContent({ interactive: undefined })}
                      title="Remove interactive layer"
                      style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", color: "var(--muted)", fontSize: "0.75rem", padding: "0.1rem 0.3rem" }}
                    >
                      ✕ Remove
                    </button>
                  </div>

                  {/* Poll fields */}
                  {interactive.type === "poll" && (
                    <div>
                      <label className="present-editor-label">Question</label>
                      <input value={interactive.question || ""} onChange={(e) => updateInteractive({ question: e.target.value })} placeholder="What do you think?" className="present-editor-input" style={{ marginBottom: "0.5rem" }} />
                      <label className="present-editor-label">Options</label>
                      {(interactive.options || []).map((opt, oi) => (
                        <div key={opt.id} className="present-editor-option-row">
                          <input
                            value={opt.text}
                            onChange={(e) => {
                              const opts = [...(interactive.options || [])];
                              opts[oi] = { ...opts[oi], text: e.target.value };
                              updateInteractive({ options: opts });
                            }}
                            placeholder={`Option ${oi + 1}`}
                            className="present-editor-option-input"
                          />
                          <button onClick={() => updateInteractive({ options: (interactive.options || []).filter((_, i) => i !== oi) })} className="present-editor-remove-btn">✕</button>
                        </div>
                      ))}
                      <button onClick={() => updateInteractive({ options: [...(interactive.options || []), { id: String(Date.now()), text: "" }] })} className="present-editor-add-item-btn">+ Add Option</button>
                    </div>
                  )}

                  {/* Quiz fields */}
                  {interactive.type === "quiz" && (
                    <div>
                      <label className="present-editor-label">Question</label>
                      <input value={interactive.question || ""} onChange={(e) => updateInteractive({ question: e.target.value })} placeholder="What is the correct answer?" className="present-editor-input" style={{ marginBottom: "0.5rem" }} />
                      <label className="present-editor-label">Answers — click letter to mark correct</label>
                      {(interactive.answers || []).map((ans, ai) => (
                        <div key={ans.id} className="present-editor-answer-row">
                          <button
                            onClick={() => updateInteractive({ answers: (interactive.answers || []).map((a, i) => ({ ...a, is_correct: i === ai })) })}
                            className={ans.is_correct ? "present-editor-correct-btn is-correct" : "present-editor-correct-btn"}
                            title={ans.is_correct ? "Correct answer" : "Mark as correct"}
                          >{ans.is_correct ? "✓" : String.fromCharCode(65 + ai)}</button>
                          <input
                            value={ans.text}
                            onChange={(e) => {
                              const ansList = [...(interactive.answers || [])];
                              ansList[ai] = { ...ansList[ai], text: e.target.value };
                              updateInteractive({ answers: ansList });
                            }}
                            placeholder={`Answer ${String.fromCharCode(65 + ai)}`}
                            className="present-editor-option-input"
                          />
                          <button onClick={() => updateInteractive({ answers: (interactive.answers || []).filter((_, i) => i !== ai) })} className="present-editor-remove-btn">✕</button>
                        </div>
                      ))}
                      <button onClick={() => updateInteractive({ answers: [...(interactive.answers || []), { id: String(Date.now()), text: "", is_correct: false }] })} className="present-editor-add-item-btn">+ Add Answer</button>
                    </div>
                  )}

                  {/* Open text fields */}
                  {interactive.type === "open_text" && (
                    <div>
                      <label className="present-editor-label">Question</label>
                      <input value={interactive.question || ""} onChange={(e) => updateInteractive({ question: e.target.value })} placeholder="What do you think about…?" className="present-editor-input" />
                    </div>
                  )}

                  {/* Word cloud fields */}
                  {interactive.type === "word_cloud" && (
                    <div>
                      <label className="present-editor-label">Prompt</label>
                      <input value={interactive.prompt || ""} onChange={(e) => updateInteractive({ prompt: e.target.value })} placeholder="What comes to mind when…?" className="present-editor-input" />
                    </div>
                  )}

                  {/* Q&A — no fields needed */}
                  {interactive.type === "qna" && (
                    <p style={{ fontSize: "0.8125rem", color: "var(--muted)" }}>
                      Audience will submit questions live during the presentation.
                    </p>
                  )}

                  {/* Switch type buttons */}
                  <div style={{ marginTop: "0.75rem", display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
                    <span style={{ fontSize: "0.7rem", color: "var(--muted)", alignSelf: "center" }}>Switch to:</span>
                    {INTERACTIVE_TYPES.filter(t => t.type !== interactive.type).map(({ type, icon, label }) => (
                      <button
                        key={type}
                        onClick={() => updateContent({ interactive: defaultInteractive(type) })}
                        className="btn btn-secondary"
                        style={{ fontSize: "0.7rem", padding: "0.15rem 0.5rem" }}
                      >
                        {icon} {label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── STANDALONE SLIDE TYPES (non-content) ── */}
        {slide.slide_type === "word_cloud" && (
          <div>
            <label className="present-editor-label">Prompt</label>
            <input value={slide.content.prompt || ""} onChange={(e) => updateContent({ prompt: e.target.value })} placeholder="What comes to mind when…" className="present-editor-input" />
          </div>
        )}

        {slide.slide_type === "open_text" && (
          <div>
            <label className="present-editor-label">Question</label>
            <input value={slide.content.question || ""} onChange={(e) => updateContent({ question: e.target.value })} placeholder="What do you think about…" className="present-editor-input" />
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
                <button onClick={() => updateContent({ options: (slide.content.options || []).filter((_, i) => i !== oi) })} className="present-editor-remove-btn">✕</button>
              </div>
            ))}
            <button onClick={() => updateContent({ options: [...(slide.content.options || []), { id: String(Date.now()), text: "" }] })} className="present-editor-add-item-btn">+ Add Option</button>
          </div>
        )}

        {slide.slide_type === "quiz" && (
          <div>
            <label className="present-editor-label">Question</label>
            <input value={slide.content.question || ""} onChange={(e) => updateContent({ question: e.target.value })} placeholder="What is the question?" className="present-editor-input" style={{ marginBottom: "0.75rem" }} />
            <label className="present-editor-label">Answers — click a letter to mark correct</label>
            {(slide.content.answers || []).map((ans, ai) => (
              <div key={ans.id} className="present-editor-answer-row">
                <button
                  onClick={() => updateContent({ answers: (slide.content.answers || []).map((a, i) => ({ ...a, is_correct: i === ai })) })}
                  className={ans.is_correct ? "present-editor-correct-btn is-correct" : "present-editor-correct-btn"}
                  title={ans.is_correct ? "Correct answer" : "Mark as correct"}
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
                <button onClick={() => updateContent({ answers: (slide.content.answers || []).filter((_, i) => i !== ai) })} className="present-editor-remove-btn">✕</button>
              </div>
            ))}
            <button onClick={() => updateContent({ answers: [...(slide.content.answers || []), { id: String(Date.now()), text: "", is_correct: false }] })} className="present-editor-add-item-btn">+ Add Answer</button>
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
