"use client";

import { useState, useRef, useCallback } from "react";
import { useAuth } from "@/components/supabase-provider";
import { supabase } from "@/lib/supabase/client";

type ImportedPage = {
  index: number;          // 0-based page number
  thumbnailUrl: string;   // Supabase storage public URL
  selected: boolean;
  uploading: boolean;
  error: string | null;
};

type ImportDeckPanelProps = {
  onImport: (slides: Array<{ title: string; image_url: string }>) => void;
  onClose: () => void;
};

type Phase = "drop" | "converting" | "rendering" | "review" | "uploading" | "error";

const ACCEPTED_EXTS = [".pdf", ".pptx", ".ppt"];
const ACCEPTED_MIME = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.ms-powerpoint",
];
const MAX_BYTES = 100 * 1024 * 1024;
const MAX_PAGES = 100;

export function ImportDeckPanel({ onImport, onClose }: ImportDeckPanelProps) {
  const { user } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const [phase, setPhase] = useState<Phase>("drop");
  const [errorMsg, setErrorMsg] = useState("");
  const [filename, setFilename] = useState("");
  const [pages, setPages] = useState<ImportedPage[]>([]);
  const [progressText, setProgressText] = useState("");
  const [isDragging, setIsDragging] = useState(false);

  // ─── Derived counts ──────────────────────────────────────────────────────────
  const selectedCount = pages.filter((p) => p.selected).length;
  const totalCount = pages.length;

  // ─── Cancel / close ──────────────────────────────────────────────────────────
  const handleCancel = useCallback(() => {
    abortRef.current?.abort();
    onClose();
  }, [onClose]);

  // ─── File validation ─────────────────────────────────────────────────────────
  function validateFile(file: File): string | null {
    const ext = "." + file.name.split(".").pop()?.toLowerCase();
    if (!ACCEPTED_EXTS.includes(ext) && !ACCEPTED_MIME.includes(file.type)) {
      return `Unsupported format "${ext}". Use PDF, PPTX, or PPT.`;
    }
    if (file.size === 0) return "File is empty.";
    if (file.size > MAX_BYTES) return `File too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Max 100 MB.`;
    return null;
  }

  // ─── Main processing pipeline ────────────────────────────────────────────────
  async function processFile(file: File) {
    const validationError = validateFile(file);
    if (validationError) {
      setErrorMsg(validationError);
      setPhase("error");
      return;
    }

    setFilename(file.name);
    abortRef.current = new AbortController();
    const signal = abortRef.current.signal;

    const ext = "." + file.name.split(".").pop()?.toLowerCase();

    let pdfBytes: ArrayBuffer;

    // Step 1: Convert if needed
    if (ext !== ".pdf") {
      setPhase("converting");
      setProgressText(`Converting ${file.name}…`);
      try {
        const formData = new FormData();
        formData.append("file", file);
        const res = await fetch("/api/present/import-deck", {
          method: "POST",
          body: formData,
          signal,
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({})) as { error?: string };
          throw new Error(body.error || "Conversion failed.");
        }
        pdfBytes = await res.arrayBuffer();
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        setErrorMsg(err instanceof Error ? err.message : "Conversion failed.");
        setPhase("error");
        return;
      }
    } else {
      // PDF: read directly — no upload, no CORS issues
      pdfBytes = await file.arrayBuffer();
    }

    if (signal.aborted) return;

    // Step 2: Render pages via PDF.js from local buffer
    setPhase("rendering");
    try {
      await renderPages(pdfBytes, signal);
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      setErrorMsg(err instanceof Error ? err.message : "Failed to render pages.");
      setPhase("error");
    }
  }

  async function renderPages(pdfBytes: ArrayBuffer, signal: AbortSignal) {
    // Load PDF.js — use local worker to avoid CDN version mismatch
    const pdfjsLib = await import("pdfjs-dist");
    pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

    const pdf = await pdfjsLib.getDocument({ data: pdfBytes }).promise;
    const totalPages = Math.min(pdf.numPages, MAX_PAGES);

    if (totalPages === 0) {
      setErrorMsg("This file has no pages.");
      setPhase("error");
      return;
    }

    // Initialise page slots immediately so user sees them filling in
    setPages(
      Array.from({ length: totalPages }, (_, i) => ({
        index: i,
        thumbnailUrl: "",
        selected: true,
        uploading: false,
        error: null,
      }))
    );

    for (let i = 0; i < totalPages; i++) {
      if (signal.aborted) return;

      setProgressText(`Rendering page ${i + 1} of ${totalPages}…`);

      const page = await pdf.getPage(i + 1);
      const viewport = page.getViewport({ scale: 1.5 }); // enough for thumbnail
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      if (!ctx) continue;

      canvas.width = viewport.width;
      canvas.height = viewport.height;

      await page.render({ canvasContext: ctx as unknown as CanvasRenderingContext2D, viewport } as Parameters<typeof page.render>[0]).promise;

      const dataUrl = canvas.toDataURL("image/jpeg", 0.85);

      // Update this specific page slot — streaming UI
      setPages((prev) =>
        prev.map((p) =>
          p.index === i ? { ...p, thumbnailUrl: dataUrl } : p
        )
      );
    }

    setPhase("review");
    setProgressText("");
  }

  // ─── Upload selected pages to Supabase Storage ───────────────────────────────
  async function uploadAndImport() {
    const selected = pages.filter((p) => p.selected);
    if (selected.length === 0) return;

    setPhase("uploading");
    const results: Array<{ title: string; image_url: string }> = [];

    for (const page of selected) {
      // Mark as uploading
      setPages((prev) =>
        prev.map((p) => (p.index === page.index ? { ...p, uploading: true } : p))
      );

      try {
        // Convert data URL to blob
        const res = await fetch(page.thumbnailUrl);
        const blob = await res.blob();

        const uid = user?.id || "anon";
        const path = `${uid}/deck-imports/${Date.now()}-page-${page.index + 1}.jpg`;

        const { error: uploadError } = await supabase.storage
          .from("quiz-images")
          .upload(path, blob, { contentType: "image/jpeg", upsert: true });

        if (uploadError) throw uploadError;

        const { data } = supabase.storage.from("quiz-images").getPublicUrl(path);
        results.push({ title: `Slide ${results.length + 1}`, image_url: data.publicUrl });

        setPages((prev) =>
          prev.map((p) =>
            p.index === page.index
              ? { ...p, uploading: false, thumbnailUrl: data.publicUrl }
              : p
          )
        );
      } catch (err) {
        // Mark this page as failed but continue with others
        setPages((prev) =>
          prev.map((p) =>
            p.index === page.index
              ? { ...p, uploading: false, error: "Upload failed" }
              : p
          )
        );
      }
    }

    if (results.length === 0) {
      setErrorMsg("All uploads failed. Check your connection and try again.");
      setPhase("error");
      return;
    }

    onImport(results);
  }

  // ─── Drag & drop ─────────────────────────────────────────────────────────────
  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) void processFile(file);
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(true);
  }

  function handleDragLeave() {
    setIsDragging(false);
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) void processFile(file);
  }

  // ─── Page selection helpers ───────────────────────────────────────────────────
  function togglePage(index: number) {
    setPages((prev) =>
      prev.map((p) => (p.index === index ? { ...p, selected: !p.selected } : p))
    );
  }

  function selectAll() {
    setPages((prev) => prev.map((p) => ({ ...p, selected: true })));
  }

  function deselectAll() {
    setPages((prev) => prev.map((p) => ({ ...p, selected: false })));
  }

  // ─── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="present-add-slide-backdrop" onClick={handleCancel}>
      <div
        className="card present-add-slide-card present-import-deck-panel"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 680, width: "100%" }}
      >
        {/* Header */}
        <div className="present-add-slide-header">
          <h2 className="present-add-slide-title">📥 Import Slide Deck</h2>
          <button onClick={handleCancel} className="present-add-slide-close">✕</button>
        </div>

        {/* ── DROP ZONE ── */}
        {phase === "drop" && (
          <div
            className={`present-deck-dropzone${isDragging ? " is-dragging" : ""}`}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onClick={() => fileRef.current?.click()}
          >
            <input
              ref={fileRef}
              type="file"
              accept=".pdf,.pptx,.ppt"
              onChange={handleFileInput}
              style={{ display: "none" }}
            />
            <div className="present-deck-dropzone-icon">📂</div>
            <p className="present-deck-dropzone-title">Drop your deck here or click to browse</p>
            <p className="present-deck-dropzone-hint">
              PDF · PPTX · PPT &nbsp;·&nbsp; Max 100 MB &nbsp;·&nbsp; Up to {MAX_PAGES} pages
            </p>
          </div>
        )}

        {/* ── CONVERTING ── */}
        {phase === "converting" && (
          <div className="present-deck-processing">
            <div className="present-deck-spinner" />
            <p className="present-deck-progress-label">{progressText}</p>
            <p className="present-deck-progress-hint">Converting to PDF…</p>
          </div>
        )}

        {/* ── RENDERING (streaming thumbnails) ── */}
        {phase === "rendering" && (
          <div>
            <div className="present-deck-processing-header">
              <div className="present-deck-spinner" />
              <p className="present-deck-progress-label">{progressText}</p>
            </div>
            {pages.length > 0 && (
              <div className="present-deck-thumb-grid">
                {pages.map((p) => (
                  <div key={p.index} className="present-deck-thumb present-deck-thumb--rendering">
                    {p.thumbnailUrl ? (
                      <img src={p.thumbnailUrl} alt={`Page ${p.index + 1}`} />
                    ) : (
                      <div className="present-deck-thumb-placeholder" />
                    )}
                    <span className="present-deck-thumb-num">{p.index + 1}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── REVIEW (page selector) ── */}
        {phase === "review" && (
          <div>
            <div className="present-deck-review-header">
              <span className="present-deck-review-count">
                {totalCount} page{totalCount !== 1 ? "s" : ""} · {selectedCount} selected
                {totalCount === MAX_PAGES && (
                  <span className="present-deck-review-capped"> (capped at {MAX_PAGES})</span>
                )}
              </span>
              <div className="present-deck-review-actions">
                <button onClick={selectAll} className="present-deck-select-btn">All</button>
                <button onClick={deselectAll} className="present-deck-select-btn">None</button>
              </div>
            </div>

            <div className="present-deck-thumb-grid present-deck-thumb-grid--selectable">
              {pages.map((p) => (
                <button
                  key={p.index}
                  className={`present-deck-thumb${p.selected ? " is-selected" : ""}`}
                  onClick={() => togglePage(p.index)}
                  title={`Page ${p.index + 1} — click to ${p.selected ? "deselect" : "select"}`}
                >
                  {p.thumbnailUrl ? (
                    <img src={p.thumbnailUrl} alt={`Page ${p.index + 1}`} />
                  ) : (
                    <div className="present-deck-thumb-placeholder" />
                  )}
                  <span className="present-deck-thumb-num">{p.index + 1}</span>
                  {p.selected && <span className="present-deck-thumb-check">✓</span>}
                </button>
              ))}
            </div>

            {filename && (
              <p className="present-deck-filename">📄 {filename}</p>
            )}
          </div>
        )}

        {/* ── UPLOADING ── */}
        {phase === "uploading" && (
          <div>
            <div className="present-deck-processing-header">
              <div className="present-deck-spinner" />
              <p className="present-deck-progress-label">
                Uploading {pages.filter((p) => p.selected && !p.uploading && !p.error && !p.thumbnailUrl.startsWith("data:")).length === 0
                  ? "slides…"
                  : `${pages.filter((p) => p.selected && p.uploading).length} remaining…`}
              </p>
            </div>
            <div className="present-deck-thumb-grid">
              {pages.filter((p) => p.selected).map((p) => (
                <div
                  key={p.index}
                  className={`present-deck-thumb${p.uploading ? " is-uploading" : ""}${p.error ? " is-error" : ""}`}
                >
                  {p.thumbnailUrl ? (
                    <img src={p.thumbnailUrl} alt={`Page ${p.index + 1}`} />
                  ) : (
                    <div className="present-deck-thumb-placeholder" />
                  )}
                  <span className="present-deck-thumb-num">{p.index + 1}</span>
                  {p.uploading && <span className="present-deck-thumb-uploading">⏳</span>}
                  {p.error && <span className="present-deck-thumb-err" title={p.error}>✗</span>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── ERROR ── */}
        {phase === "error" && (
          <div className="present-deck-error-state">
            <div className="present-deck-error-icon">⚠️</div>
            <p className="present-deck-error-msg">{errorMsg}</p>
            <button
              onClick={() => { setPhase("drop"); setErrorMsg(""); setPages([]); }}
              className="btn btn-secondary"
            >
              Try another file
            </button>
          </div>
        )}

        {/* Footer actions */}
        <div className="present-pdf-actions">
          {phase === "review" && (
            <button
              onClick={uploadAndImport}
              className="btn btn-primary"
              disabled={selectedCount === 0}
            >
              Import {selectedCount} slide{selectedCount !== 1 ? "s" : ""}
            </button>
          )}
          {(phase === "drop" || phase === "review" || phase === "error") && (
            <button onClick={handleCancel} className="btn btn-secondary">
              Cancel
            </button>
          )}
          {(phase === "converting" || phase === "rendering" || phase === "uploading") && (
            <button onClick={handleCancel} className="btn btn-secondary">
              Cancel
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
