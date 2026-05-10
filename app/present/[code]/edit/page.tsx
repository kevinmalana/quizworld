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
import { AddSlideModal } from "@/components/present/edit/add-slide-modal";

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
  const [showAddSlide, setShowAddSlide] = useState(false);
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

  if (loading) {
    return <div className="container present-editor-loading">Loading...</div>;
  }

  const activeSlide = slides[activeIndex];

  return (
    <div className="present-editor-shell">
      <EditorTopbar
        title={title}
        onTitleChange={setTitle}
        joinCode={joinCode}
        error={error}
        saving={saving}
        onBack={() => router.push("/present")}
        onSave={savePresentation}
        onPresent={startPresenting}
      />

      <div className="present-editor-layout">
        <SlideListPanel
          slides={slides}
          activeIndex={activeIndex}
          onSelect={setActiveIndex}
          onAdd={() => setShowAddSlide(true)}
        />

        {activeSlide && (
          <SlideEditorPanel
            slide={activeSlide}
            slideCount={slides.length}
            onUpdate={(updates) => updateSlide(activeIndex, updates)}
            onDelete={() => deleteSlide(activeIndex)}
          />
        )}
      </div>

      {showAddSlide && (
        <AddSlideModal
          onClose={() => setShowAddSlide(false)}
          onSelect={addSlide}
        />
      )}
    </div>
  );
}
