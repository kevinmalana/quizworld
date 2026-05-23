"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { useAuth } from "@/components/supabase-provider";
import type { Slide, SlideType } from "@/lib/presentation/types";
import { startPhoenixPresentation, writePresenterToken } from "@/lib/presentation/client";
import { defaultContent } from "@/components/present/edit/slide-types";
import { EditorTopbar } from "@/components/present/edit/editor-topbar";
import { SlideListPanel } from "@/components/present/edit/slide-list-panel";
import { SlideEditorPanel } from "@/components/present/edit/slide-editor-panel";
import { SlidePreview } from "@/components/present/edit/slide-preview";
import { AddSlideModal } from "@/components/present/edit/add-slide-modal";
import { ImportDeckPanel } from "@/components/present/edit/import-deck-panel";

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
  const [savedOk, setSavedOk] = useState(false);
  const [showAddSlide, setShowAddSlide] = useState(false);
  const [showImportDeck, setShowImportDeck] = useState(false);
  const [importToast, setImportToast] = useState<string | null>(null);
  const [importedCount, setImportedCount] = useState(0); // for bulk convert banner
  const [joinCode, setJoinCode] = useState<string | null>(null);
  const [error, setError] = useState("");

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

  const addSlide = useCallback((type: SlideType) => {
    const newSlide: Slide = {
      id: "temp_" + Date.now(),
      presentation_id: code,
      slide_type: type,
      title: "",
      content: defaultContent(type),
      order_index: slides.length,
      settings: {},
    };
    setSlides(prev => [...prev, newSlide]);
    setActiveIndex(slides.length);
    setShowAddSlide(false);
  }, [code, slides.length]);

  const importDeckSlides = useCallback((imported: Array<{ title: string; image_url: string }>, failedCount: number) => {
    const baseIndex = slides.length;
    const newSlides: Slide[] = imported.map((ps, idx) => ({
      id: "temp_" + Date.now() + "_" + idx,
      presentation_id: code,
      slide_type: "content" as SlideType,
      // FIX 3: Clean title — 'Slide N' not verbose filename
      title: `Slide ${baseIndex + idx + 1}`,
      content: { image_url: ps.image_url, text: "", _imported: true },
      order_index: baseIndex + idx,
      settings: {},
    }));

    setSlides(prev => [...prev, ...newSlides]);
    setActiveIndex(baseIndex);
    setImportedCount(imported.length); // FIX 4: show bulk convert banner
    setShowImportDeck(false);
    setShowAddSlide(false);
    if (failedCount > 0) {
      setImportToast(`${imported.length} slide${imported.length !== 1 ? "s" : ""} imported · ${failedCount} failed (skipped)`);
    } else {
      setImportToast(`${imported.length} slide${imported.length !== 1 ? "s" : ""} imported`);
    }
    setTimeout(() => setImportToast(null), 4000);
  }, [code, slides.length]);

  const updateSlide = useCallback((idx: number, updates: Partial<Slide>) => {
    setSlides(prev => prev.map((s, i) => i === idx ? { ...s, ...updates } : s));
  }, []);

  const deleteSlide = useCallback((idx: number) => {
    if (slides.length <= 1) return;
    setSlides(prev => prev.filter((_, i) => i !== idx));
    setActiveIndex(prev => Math.min(prev, slides.length - 2));
  }, [slides.length]);

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
      setSavedOk(true);
      setTimeout(() => setSavedOk(false), 2500);
      return true;
    } catch (err) {
      console.error("Save error:", err);
      setError(err instanceof Error ? err.message : "Save failed.");
      setSaving(false);
      return false;
    }
  }, [code, title, slides]);

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

  // Bulk convert all imported slides — sets content.interactive overlay, keeps image
  const bulkConvertImported = useCallback((toType: "poll" | "quiz" | "open_text" | "word_cloud" | "qna") => {
    type OverlayOption = { id: string; text: string };
    type OverlayAnswer = { id: string; text: string; is_correct: boolean };
    type Overlay = { type: string; question?: string; prompt?: string; options?: OverlayOption[]; answers?: OverlayAnswer[] };
    const defaults: Record<string, Overlay> = {
      poll: { type: "poll", question: "", options: [{ id: "1", text: "" }, { id: "2", text: "" }] },
      quiz: { type: "quiz", question: "", answers: [{ id: "1", text: "", is_correct: true }, { id: "2", text: "", is_correct: false }] },
      open_text: { type: "open_text", question: "" },
      word_cloud: { type: "word_cloud", prompt: "" },
      qna: { type: "qna" },
    };
    setSlides(prev => prev.map(s => {
      if (!(s.content as Record<string, unknown>)._imported) return s;
      return { ...s, content: { ...s.content, interactive: defaults[toType] } } as Slide;
    }));
    setImportedCount(0);
  }, []);

  if (loading) {
    return <div className="container present-editor-loading">Loading...</div>;
  }

  const activeSlide = slides[activeIndex];

  const BULK_TYPES: { type: SlideType; icon: string; label: string }[] = [
    { type: "content" as const, icon: "📄", label: "Keep as content" },
    { type: "poll", icon: "📊", label: "Convert to Polls" },
    { type: "quiz", icon: "🏆", label: "Convert to Quizzes" },
    { type: "open_text", icon: "💬", label: "Convert to Open Text" },
  ];

  return (
    <div className="present-editor-shell">
      <EditorTopbar
        title={title}
        onTitleChange={setTitle}
        joinCode={joinCode}
        error={error}
        saving={saving}
        savedOk={savedOk}
        onBack={() => router.push("/present")}
        onSave={savePresentation}
        onPresent={startPresenting}
      />

      {/* FIX 4: Bulk convert banner — shows after import */}
      {importedCount > 0 && (
        <div style={{
          background: "var(--accent-light, #f0ecff)",
          borderBottom: "1px solid var(--accent-line, #ddd6fe)",
          padding: "0.625rem 1rem",
          display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap",
          fontSize: "0.8125rem",
        }}>
          <span style={{ fontWeight: 700, color: "var(--accent)" }}>
            ✅ {importedCount} slide{importedCount !== 1 ? "s" : ""} imported. Make them interactive:
          </span>
          <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
            {BULK_TYPES.map(({ type, icon, label }) => (
              <button
                key={type}
                onClick={() => type !== "content" ? bulkConvertImported(type as "poll" | "quiz" | "open_text" | "word_cloud" | "qna") : setImportedCount(0)}
                className="btn btn-secondary"
                style={{ fontSize: "0.75rem", padding: "0.25rem 0.625rem" }}
              >
                {icon} {label}
              </button>
            ))}
          </div>
          <button
            onClick={() => setImportedCount(0)}
            style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", color: "var(--muted)", fontSize: "0.875rem" }}
          >✕</button>
        </div>
      )}

      {/* Import toast */}
      {importToast && (
        <div style={{
          position: "fixed", bottom: "1.5rem", left: "50%", transform: "translateX(-50%)",
          background: "var(--ink)", color: "var(--bg)", padding: "0.625rem 1.25rem",
          borderRadius: "var(--radius-xl)", fontSize: "0.875rem", fontWeight: 600,
          zIndex: 1000, boxShadow: "0 4px 12px rgba(0,0,0,0.2)",
        }}>
          ✅ {importToast}
        </div>
      )}

      <div className="present-editor-layout">
        <SlideListPanel
          slides={slides}
          activeIndex={activeIndex}
          onSelect={setActiveIndex}
          onAdd={() => setShowAddSlide(true)}
          onImport={() => setShowImportDeck(true)}
          onReorder={(reordered) => {
            setSlides(reordered);
            const activeId = slides[activeIndex]?.id;
            if (activeId) {
              const newIdx = reordered.findIndex((s) => s.id === activeId);
              if (newIdx !== -1) setActiveIndex(newIdx);
            }
          }}
        />

        {/* Editor + Preview split */}
        {activeSlide && (
          <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
            {/* Edit panel */}
            <div style={{ flex: "0 0 360px", overflowY: "auto", borderRight: "1px solid var(--line)" }}>
              <SlideEditorPanel
                slide={activeSlide}
                slideIndex={activeIndex}
                slideCount={slides.length}
                onUpdate={(updates) => updateSlide(activeIndex, updates)}
                onDelete={() => deleteSlide(activeIndex)}
                  />
            </div>

            {/* FIX 1: Live preview pane */}
            <div style={{
              flex: 1, padding: "1.5rem", overflowY: "auto",
              background: "var(--bg-subtle, #0a0a0d)",
              display: "flex", flexDirection: "column", gap: "0.75rem",
            }}>
              <div style={{ fontSize: "0.7rem", fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                Audience Preview
              </div>
              <SlidePreview slide={activeSlide} />
              <p style={{ fontSize: "0.7rem", color: "var(--muted)", textAlign: "center" }}>
                This is exactly what your audience sees during the presentation
              </p>
            </div>
          </div>
        )}
      </div>

    </div>
  );
}
