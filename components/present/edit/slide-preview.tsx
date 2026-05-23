"use client";

import { useState } from "react";
import type { Slide, SlideType } from "@/lib/presentation/types";

/**
 * SlidePreview — renders a scaled-down preview of any slide type.
 * Shows exactly what the audience will see, inline in the editor.
 */

type SlidePreviewProps = {
  slide: Slide;
};

function renderMarkdownPreview(text: string): string {
  return (text || "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/\n/g, "<br />");
}

export function SlidePreview({ slide }: SlidePreviewProps) {
  const content = slide.content as Record<string, unknown>;

  return (
    <div style={{
      width: "100%",
      aspectRatio: "16/9",
      background: "var(--bg-subtle, #0f0f14)",
      borderRadius: "var(--radius-lg, 8px)",
      overflow: "hidden",
      border: "1px solid var(--line)",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      position: "relative",
      fontSize: "0.7rem",
      color: "var(--ink)",
    }}>

      {/* Slide title */}
      {slide.title && (
        <div style={{
          position: "absolute", top: "8%", left: 0, right: 0,
          textAlign: "center", fontWeight: 800, fontSize: "0.875em",
          padding: "0 1rem", color: "var(--ink)",
        }}>
          {slide.title}
        </div>
      )}

      {/* Content slide */}
      {slide.slide_type === "content" && (
        <>
          {content.image_url ? (
            <img
              src={content.image_url as string}
              alt={slide.title || "Slide"}
              style={{ width: "100%", height: "100%", objectFit: "contain" }}
            />
          ) : (
            <div style={{ padding: "1.5rem", textAlign: "center", width: "100%" }}>
              <div
                style={{ fontSize: "0.8em", lineHeight: 1.5, color: "var(--ink)" }}
                dangerouslySetInnerHTML={{ __html: renderMarkdownPreview(content.text as string) || "<em style='opacity:0.4'>No content yet</em>" }}
              />
            </div>
          )}
          {content.image_url && content.text && (
            <div style={{
              position: "absolute", bottom: 0, left: 0, right: 0,
              background: "rgba(0,0,0,0.55)", color: "#fff",
              padding: "0.35rem 0.75rem", fontSize: "0.75em", textAlign: "center",
            }}>
              {content.text as string}
            </div>
          )}
        </>
      )}

      {/* Poll slide */}
      {slide.slide_type === "poll" && (
        <div style={{ width: "100%", padding: "1rem" }}>
          <div style={{ fontWeight: 700, marginBottom: "0.5rem", textAlign: "center", fontSize: "0.85em" }}>
            {slide.title || "Poll"}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem" }}>
            {((content.options as { text: string }[]) || []).slice(0, 4).map((opt, i) => (
              <div key={i} style={{
                background: "var(--surface)", border: "1px solid var(--line)",
                borderRadius: 4, padding: "0.3rem 0.5rem", fontSize: "0.75em",
              }}>
                {opt.text || `Option ${i + 1}`}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quiz slide */}
      {slide.slide_type === "quiz" && (
        <div style={{ width: "100%", padding: "1rem" }}>
          <div style={{ fontWeight: 700, marginBottom: "0.35rem", textAlign: "center", fontSize: "0.85em" }}>
            {(content.question as string) || slide.title || "Quiz"}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.3rem" }}>
            {((content.answers as { text: string; is_correct: boolean }[]) || []).slice(0, 4).map((ans, i) => (
              <div key={i} style={{
                background: ans.is_correct ? "rgba(34,197,94,0.15)" : "var(--surface)",
                border: `1px solid ${ans.is_correct ? "#22c55e" : "var(--line)"}`,
                borderRadius: 4, padding: "0.3rem 0.4rem", fontSize: "0.7em",
              }}>
                {String.fromCharCode(65 + i)}. {ans.text || `Answer ${i + 1}`}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Word cloud */}
      {slide.slide_type === "word_cloud" && (
        <div style={{ textAlign: "center", padding: "1rem" }}>
          <div style={{ fontSize: "1.5em", marginBottom: "0.25rem" }}>☁️</div>
          <div style={{ fontSize: "0.8em", fontWeight: 700 }}>Word Cloud</div>
          <div style={{ fontSize: "0.7em", color: "var(--muted)", marginTop: "0.25rem" }}>
            {(content.prompt as string) || "Audience submits words"}
          </div>
        </div>
      )}

      {/* Open text */}
      {slide.slide_type === "open_text" && (
        <div style={{ textAlign: "center", padding: "1rem" }}>
          <div style={{ fontSize: "1.5em", marginBottom: "0.25rem" }}>💬</div>
          <div style={{ fontSize: "0.8em", fontWeight: 700 }}>Open Text</div>
          <div style={{ fontSize: "0.7em", color: "var(--muted)", marginTop: "0.25rem" }}>
            {(content.question as string) || "Audience responds freely"}
          </div>
        </div>
      )}

      {/* Scale */}
      {slide.slide_type === "scale" && (
        <div style={{ textAlign: "center", padding: "1rem", width: "100%" }}>
          <div style={{ fontSize: "1.5em", marginBottom: "0.25rem" }}>📏</div>
          <div style={{ fontSize: "0.8em", fontWeight: 700 }}>Scale</div>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: "0.5rem", fontSize: "0.7em", color: "var(--muted)" }}>
            <span>{(content.min_label as string) || content.min as string || "1"}</span>
            <span>{(content.max_label as string) || content.max as string || "10"}</span>
          </div>
          <div style={{
            height: 4, background: "var(--line)", borderRadius: 2,
            margin: "0.25rem 0", position: "relative",
          }}>
            <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", width: 8, height: 8, borderRadius: "50%", background: "var(--accent)" }} />
          </div>
        </div>
      )}

      {/* Q&A */}
      {slide.slide_type === "qna" && (
        <div style={{ textAlign: "center", padding: "1rem" }}>
          <div style={{ fontSize: "1.5em", marginBottom: "0.25rem" }}>❓</div>
          <div style={{ fontSize: "0.8em", fontWeight: 700 }}>Q&A</div>
          <div style={{ fontSize: "0.7em", color: "var(--muted)", marginTop: "0.25rem" }}>Audience submits questions live</div>
        </div>
      )}

      {/* Preview label */}
      <div style={{
        position: "absolute", bottom: "0.35rem", right: "0.5rem",
        fontSize: "0.6em", color: "rgba(255,255,255,0.3)", fontWeight: 600,
        pointerEvents: "none",
      }}>
        AUDIENCE VIEW
      </div>
    </div>
  );
}
