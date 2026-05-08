"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { useAuth } from "@/components/supabase-provider";
import type { Slide, SlideType, SlideContent } from "@/lib/presentation/types";
import { startPhoenixPresentation, writePresenterToken } from "@/lib/presentation/client";

const SLIDE_TYPES: { type: SlideType; icon: string; label: string; desc: string }[] = [
  { type: "content", icon: "📝", label: "Content", desc: "Text, images, video" },
  { type: "word_cloud", icon: "☁️", label: "Word Cloud", desc: "Collect words, visualize" },
  { type: "open_text", icon: "💬", label: "Open Text", desc: "Written responses" },
  { type: "poll", icon: "📊", label: "Poll", desc: "Vote on options" },
  { type: "quiz", icon: "🏆", label: "Quiz", desc: "Competitive question" },
  { type: "scale", icon: "📏", label: "Scale", desc: "Rate 1-10" },
  { type: "qna", icon: "❓", label: "Q&A", desc: "Audience questions" },
];

function validateSlides(slides: Slide[]): string | null {
  if (!slides.length) return "Add at least one slide.";

  for (const [index, slide] of slides.entries()) {
    const label = `Slide ${index + 1}`;
    if (slide.slide_type === "poll" && (slide.content.options || []).filter((o) => o.text.trim()).length < 2) {
      return `${label}: polls need at least two non-empty options.`;
    }
    if (slide.slide_type === "quiz") {
      const answers = (slide.content.answers || []).filter((a) => a.text.trim());
      if (answers.length < 2) return `${label}: quiz slides need at least two non-empty answers.`;
      if (!answers.some((a) => a.is_correct)) return `${label}: choose a correct answer.`;
    }
    if (slide.slide_type === "scale" && Number(slide.content.min ?? 1) >= Number(slide.content.max ?? 10)) {
      return `${label}: scale minimum must be less than maximum.`;
    }
  }

  return null;
}

function defaultContent(type: SlideType): SlideContent {
  switch (type) {
    case "content": return { text: "" };
    case "word_cloud": return { prompt: "What comes to mind when you think of…?" };
    case "open_text": return { question: "What do you think?" };
    case "poll": return { options: [{ id: "1", text: "Option A" }, { id: "2", text: "Option B" }] };
    case "quiz": return { answers: [{ id: "1", text: "Answer A", is_correct: true }, { id: "2", text: "Answer B", is_correct: false }], time_limit: 20, points: 1000 };
    case "scale": return { min: 1, max: 10, min_label: "Not at all", max_label: "Very much" };
    case "qna": return { moderated: false };
  }
}

export default function PresentationEditor() {
  const params = useParams();
  const router = useRouter();
  const code = params.code as string;
  const { user } = useAuth();

  const [title, setTitle] = useState("");
  const [slides, setSlides] = useState<Slide[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showAddSlide, setShowAddSlide] = useState(false);
  const [joinCode, setJoinCode] = useState<string | null>(null);
  const [error, setError] = useState("");

  // Load presentation
  useEffect(() => {
    async function load() {
      const { data: pres, error } = await supabase
        .from("presentations")
        .select("*, slides(*)")
        .eq("id", code)
        .single();

      if (error || !pres) {
        router.push("/present");
        return;
      }

      setTitle(pres.title);
      setJoinCode(pres.join_code);
      const sorted = (pres.slides || []).sort((a: Slide, b: Slide) => a.order_index - b.order_index);
      setSlides(sorted);
      setLoading(false);
    }
    load();
  }, [code, router]);

  // Add slide
  const addSlide = useCallback((type: SlideType) => {
    const newSlide: Slide = {
      id: "temp_" + Date.now(),
      presentation_id: code,
      slide_type: type,
      title: SLIDE_TYPES.find(s => s.type === type)?.label || "",
      content: defaultContent(type),
      order_index: slides.length,
      settings: {},
    };
    setSlides(prev => [...prev, newSlide]);
    setActiveIndex(slides.length);
    setShowAddSlide(false);
  }, [code, slides.length]);

  // Update slide
  const updateSlide = useCallback((idx: number, updates: Partial<Slide>) => {
    setSlides(prev => prev.map((s, i) => i === idx ? { ...s, ...updates } : s));
  }, []);

  // Delete slide
  const deleteSlide = useCallback((idx: number) => {
    if (slides.length <= 1) return;
    setSlides(prev => prev.filter((_, i) => i !== idx));
    setActiveIndex(prev => Math.min(prev, slides.length - 2));
  }, [slides.length]);

  // Save presentation
  const savePresentation = useCallback(async () => {
    const validationError = validateSlides(slides);
    if (validationError) {
      setError(validationError);
      return false;
    }

    setSaving(true);
    setError("");
    try {
      const { error } = await supabase.rpc("save_presentation", {
        p_presentation_id: code,
        p_title: title,
        p_slides: slides,
      });

      if (error) throw error;
      setSaving(false);
      return true;
    } catch (err) {
      console.error("Save error:", err);
      setError(err instanceof Error ? err.message : "Save failed.");
      setSaving(false);
      return false;
    }
  }, [code, title, slides]);

  // Start presenting
  const startPresenting = useCallback(async () => {
    const saved = await savePresentation();
    if (!saved) return;

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token) {
      router.push("/login");
      return;
    }

    const live = await startPhoenixPresentation(code, session.access_token);
    writePresenterToken(code, live.presenter_token);
    router.push(`/present/${code}/live`);
  }, [code, savePresentation, router]);

  if (loading) {
    return <div className="container" style={{ paddingTop: "4rem", textAlign: "center" }}>Loading...</div>;
  }

  const activeSlide = slides[activeIndex];

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      {/* Top bar */}
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.5rem 1rem", borderBottom: "1px solid var(--line)", background: "var(--surface)" }}>
        <button onClick={() => router.push("/present")} style={{ background: "none", border: "none", cursor: "pointer", fontSize: "1.125rem", padding: "0.5rem" }}>←</button>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Presentation title…"
          style={{ flex: 1, fontWeight: 700, fontSize: "0.875rem", padding: "0.35rem 0.65rem", border: "1.5px solid var(--line)", borderRadius: "var(--radius-lg)", background: "var(--surface)", color: "var(--ink)", outline: "none" }}
        />
        {error && <span style={{ color: "var(--primary)", fontSize: "0.75rem", fontWeight: 700 }}>{error}</span>}
        {joinCode && (
          <span style={{ fontSize: "0.7rem", fontWeight: 700, color: "var(--accent)", padding: "0.25rem 0.5rem", borderRadius: "999px", background: "var(--accent-light)" }}>
            Code: {joinCode}
          </span>
        )}
        <button onClick={savePresentation} disabled={saving} style={{ padding: "0.35rem 0.75rem", fontSize: "0.75rem", fontWeight: 700, borderRadius: "var(--radius-full)", border: "1.5px solid var(--line)", background: "var(--surface)", cursor: "pointer" }}>{saving ? "Saving…" : "Save"}</button>
        <button onClick={startPresenting} style={{ padding: "0.35rem 0.75rem", fontSize: "0.75rem", fontWeight: 700, borderRadius: "var(--radius-full)", border: "none", background: "var(--accent)", color: "#fff", cursor: "pointer" }}>🎤 Present</button>
      </div>

      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        {/* Slide list */}
        <div style={{ width: 200, borderRight: "1px solid var(--line)", overflowY: "auto", padding: "0.5rem", background: "var(--bg)" }}>
          {slides.map((slide, i) => (
            <div
              key={slide.id}
              onClick={() => setActiveIndex(i)}
              style={{
                padding: "0.5rem", marginBottom: "0.375rem", borderRadius: "var(--radius-lg)",
                border: i === activeIndex ? "2px solid var(--accent)" : "1px solid var(--line)",
                background: i === activeIndex ? "var(--accent-light)" : "var(--surface)",
                cursor: "pointer", fontSize: "0.7rem", fontWeight: 600,
              }}
            >
              <div style={{ color: "var(--muted)", marginBottom: "0.125rem" }}>#{i + 1}</div>
              <div>{SLIDE_TYPES.find(s => s.type === slide.slide_type)?.icon} {slide.title || slide.slide_type}</div>
            </div>
          ))}
          <button
            onClick={() => setShowAddSlide(true)}
            style={{ width: "100%", padding: "0.5rem", borderRadius: "var(--radius-lg)", border: "1.5px dashed var(--line)", background: "transparent", cursor: "pointer", fontSize: "0.75rem", fontWeight: 600, color: "var(--muted)" }}
          >
            + Add Slide
          </button>
        </div>

        {/* Slide editor */}
        <div style={{ flex: 1, padding: "1.5rem", overflowY: "auto" }}>
          {activeSlide && (
            <div className="card" style={{ padding: "1.5rem", maxWidth: 640, margin: "0 auto" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "1rem" }}>
                <span style={{ fontSize: "1.5rem" }}>{SLIDE_TYPES.find(s => s.type === activeSlide.slide_type)?.icon}</span>
                <input
                  value={activeSlide.title}
                  onChange={(e) => updateSlide(activeIndex, { title: e.target.value })}
                  placeholder="Slide title…"
                  style={{ flex: 1, fontWeight: 700, fontSize: "1rem", padding: "0.35rem 0.65rem", border: "1.5px solid var(--line)", borderRadius: "var(--radius-lg)", background: "var(--surface)", color: "var(--ink)", outline: "none" }}
                />
                <button onClick={() => deleteSlide(activeIndex)} disabled={slides.length <= 1} style={{ padding: "0.35rem 0.5rem", fontSize: "0.75rem", borderRadius: "var(--radius-lg)", border: "1px solid var(--line)", background: "transparent", cursor: "pointer", color: "var(--primary)" }}>✕</button>
              </div>

              {/* Slide-specific editor */}
              {activeSlide.slide_type === "content" && (
                <textarea
                  value={activeSlide.content.text || ""}
                  onChange={(e) => updateSlide(activeIndex, { content: { ...activeSlide.content, text: e.target.value } })}
                  placeholder="Slide content… Use markdown for formatting"
                  rows={8}
                  style={{ width: "100%", padding: "0.75rem", border: "1.5px solid var(--line)", borderRadius: "var(--radius-xl)", background: "var(--surface)", color: "var(--ink)", fontSize: "0.875rem", fontWeight: 500, outline: "none", resize: "vertical", fontFamily: "inherit" }}
                />
              )}

              {activeSlide.slide_type === "word_cloud" && (
                <div>
                  <label style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--muted)", display: "block", marginBottom: "0.375rem" }}>Prompt</label>
                  <input
                    value={activeSlide.content.prompt || ""}
                    onChange={(e) => updateSlide(activeIndex, { content: { ...activeSlide.content, prompt: e.target.value } })}
                    placeholder="What comes to mind when…"
                    style={{ width: "100%", padding: "0.75rem", border: "1.5px solid var(--line)", borderRadius: "var(--radius-xl)", background: "var(--surface)", color: "var(--ink)", fontSize: "0.875rem", fontWeight: 600, outline: "none" }}
                  />
                </div>
              )}

              {activeSlide.slide_type === "open_text" && (
                <div>
                  <label style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--muted)", display: "block", marginBottom: "0.375rem" }}>Question</label>
                  <input
                    value={activeSlide.content.question || ""}
                    onChange={(e) => updateSlide(activeIndex, { content: { ...activeSlide.content, question: e.target.value } })}
                    placeholder="What do you think about…"
                    style={{ width: "100%", padding: "0.75rem", border: "1.5px solid var(--line)", borderRadius: "var(--radius-xl)", background: "var(--surface)", color: "var(--ink)", fontSize: "0.875rem", fontWeight: 600, outline: "none" }}
                  />
                </div>
              )}

              {activeSlide.slide_type === "poll" && (
                <div>
                  <label style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--muted)", display: "block", marginBottom: "0.375rem" }}>Options</label>
                  {(activeSlide.content.options || []).map((opt, oi) => (
                    <div key={opt.id} style={{ display: "flex", gap: "0.375rem", marginBottom: "0.375rem" }}>
                      <input
                        value={opt.text}
                        onChange={(e) => {
                          const opts = [...(activeSlide.content.options || [])];
                          opts[oi] = { ...opts[oi], text: e.target.value };
                          updateSlide(activeIndex, { content: { ...activeSlide.content, options: opts } });
                        }}
                        placeholder={`Option ${oi + 1}`}
                        style={{ flex: 1, padding: "0.5rem", border: "1.5px solid var(--line)", borderRadius: "var(--radius-lg)", background: "var(--surface)", color: "var(--ink)", fontSize: "0.8125rem", outline: "none" }}
                      />
                      <button
                        onClick={() => {
                          const opts = (activeSlide.content.options || []).filter((_, i) => i !== oi);
                          updateSlide(activeIndex, { content: { ...activeSlide.content, options: opts } });
                        }}
                        style={{ padding: "0.5rem", background: "none", border: "none", cursor: "pointer", color: "var(--primary)" }}
                      >✕</button>
                    </div>
                  ))}
                  <button
                    onClick={() => {
                      const opts = [...(activeSlide.content.options || []), { id: String(Date.now()), text: "" }];
                      updateSlide(activeIndex, { content: { ...activeSlide.content, options: opts } });
                    }}
                    style={{ width: "100%", padding: "0.5rem", borderRadius: "var(--radius-lg)", border: "1.5px dashed var(--line)", background: "transparent", cursor: "pointer", fontSize: "0.75rem", fontWeight: 600, color: "var(--muted)" }}
                  >
                    + Add Option
                  </button>
                </div>
              )}

              {activeSlide.slide_type === "quiz" && (
                <div>
                  <label style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--muted)", display: "block", marginBottom: "0.375rem" }}>Answers</label>
                  {(activeSlide.content.answers || []).map((ans, ai) => (
                    <div key={ans.id} style={{ display: "flex", gap: "0.375rem", marginBottom: "0.375rem", alignItems: "center" }}>
                      <button
                        onClick={() => {
                          const ansList = (activeSlide.content.answers || []).map((a, i) => ({ ...a, is_correct: i === ai }));
                          updateSlide(activeIndex, { content: { ...activeSlide.content, answers: ansList } });
                        }}
                        style={{
                          width: 32, height: 32, borderRadius: "var(--radius-lg)", border: "none", cursor: "pointer", fontWeight: 800, fontSize: "0.875rem",
                          background: ans.is_correct ? "var(--accent)" : "var(--line)",
                          color: ans.is_correct ? "#fff" : "var(--muted)",
                        }}
                      >{ans.is_correct ? "✓" : String.fromCharCode(65 + ai)}</button>
                      <input
                        value={ans.text}
                        onChange={(e) => {
                          const ansList = [...(activeSlide.content.answers || [])];
                          ansList[ai] = { ...ansList[ai], text: e.target.value };
                          updateSlide(activeIndex, { content: { ...activeSlide.content, answers: ansList } });
                        }}
                        placeholder={`Answer ${String.fromCharCode(65 + ai)}`}
                        style={{ flex: 1, padding: "0.5rem", border: "1.5px solid var(--line)", borderRadius: "var(--radius-lg)", background: "var(--surface)", color: "var(--ink)", fontSize: "0.8125rem", outline: "none" }}
                      />
                    </div>
                  ))}
                  <button
                    onClick={() => {
                      const ansList = [...(activeSlide.content.answers || []), { id: String(Date.now()), text: "", is_correct: false }];
                      updateSlide(activeIndex, { content: { ...activeSlide.content, answers: ansList } });
                    }}
                    style={{ width: "100%", padding: "0.5rem", borderRadius: "var(--radius-lg)", border: "1.5px dashed var(--line)", background: "transparent", cursor: "pointer", fontSize: "0.75rem", fontWeight: 600, color: "var(--muted)" }}
                  >
                    + Add Answer
                  </button>
                </div>
              )}

              {activeSlide.slide_type === "scale" && (
                <div style={{ display: "grid", gap: "0.75rem" }}>
                  <div style={{ display: "flex", gap: "0.75rem" }}>
                    <div style={{ flex: 1 }}>
                      <label style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--muted)", display: "block", marginBottom: "0.25rem" }}>Min</label>
                      <input type="number" value={activeSlide.content.min ?? 1} onChange={(e) => updateSlide(activeIndex, { content: { ...activeSlide.content, min: Number(e.target.value) } })} style={{ width: "100%", padding: "0.5rem", border: "1.5px solid var(--line)", borderRadius: "var(--radius-lg)", outline: "none" }} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--muted)", display: "block", marginBottom: "0.25rem" }}>Max</label>
                      <input type="number" value={activeSlide.content.max ?? 10} onChange={(e) => updateSlide(activeIndex, { content: { ...activeSlide.content, max: Number(e.target.value) } })} style={{ width: "100%", padding: "0.5rem", border: "1.5px solid var(--line)", borderRadius: "var(--radius-lg)", outline: "none" }} />
                    </div>
                  </div>
                  <div>
                    <label style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--muted)", display: "block", marginBottom: "0.25rem" }}>Min Label</label>
                    <input value={activeSlide.content.min_label || ""} onChange={(e) => updateSlide(activeIndex, { content: { ...activeSlide.content, min_label: e.target.value } })} placeholder="Not at all" style={{ width: "100%", padding: "0.5rem", border: "1.5px solid var(--line)", borderRadius: "var(--radius-lg)", outline: "none" }} />
                  </div>
                  <div>
                    <label style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--muted)", display: "block", marginBottom: "0.25rem" }}>Max Label</label>
                    <input value={activeSlide.content.max_label || ""} onChange={(e) => updateSlide(activeIndex, { content: { ...activeSlide.content, max_label: e.target.value } })} placeholder="Very much" style={{ width: "100%", padding: "0.5rem", border: "1.5px solid var(--line)", borderRadius: "var(--radius-lg)", outline: "none" }} />
                  </div>
                </div>
              )}

              {activeSlide.slide_type === "qna" && (
                <div style={{ textAlign: "center", padding: "2rem", color: "var(--muted)" }}>
                  <div style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>❓</div>
                  <p style={{ fontWeight: 600 }}>Q&A slide — audience submits questions during presentation</p>
                  <p style={{ fontSize: "0.8125rem" }}>Questions appear live. Other participants can upvote.</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Add slide modal */}
      {showAddSlide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.5)" }}>
          <div className="card" style={{ padding: "1.5rem", maxWidth: 480, width: "100%", margin: "0 1rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
              <h2 style={{ fontWeight: 800 }}>Add Slide</h2>
              <button onClick={() => setShowAddSlide(false)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: "1.125rem" }}>✕</button>
            </div>
            <div style={{ display: "grid", gap: "0.5rem" }}>
              {SLIDE_TYPES.map((st) => (
                <button
                  key={st.type}
                  onClick={() => addSlide(st.type)}
                  style={{
                    display: "flex", alignItems: "center", gap: "0.75rem", padding: "0.75rem 1rem",
                    borderRadius: "var(--radius-lg)", border: "1.5px solid var(--line)", background: "var(--surface)",
                    cursor: "pointer", textAlign: "left",
                  }}
                >
                  <span style={{ fontSize: "1.25rem" }}>{st.icon}</span>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: "0.875rem" }}>{st.label}</div>
                    <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>{st.desc}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
