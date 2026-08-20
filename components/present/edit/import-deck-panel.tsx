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
  onImport: (slides: Array<{ title: string; image_url: string }>, failedCount: number) => void;
  onClose: () => void;
};

type Phase = "drop" | "converting" | "rendering" | "review" | "uploading" | "done" | "error";

const ACCEPTED_EXTS = [".pdf", ".pptx", ".ppt"];
const ACCEPTED_MIME = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.ms-powerpoint",
];
const MAX_BYTES = 25 * 1024 * 1024;
const MAX_PAGES = 100;

export function ImportDeckPanel({ onImport, onClose }: ImportDeckPanelProps) {
  const { user } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const [phase, setPhase] = useState<Phase>("drop");
  const [errorMsg, setErrorMsg] = useState("");
  const [filename, setFilename] = useState("");
  const [conversionStep, setConversionStep] = useState(0); // 0=uploading,1=converting,2=done
  const [importSummary, setImportSummary] = useState<{ ok: number; failed: number } | null>(null);
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
    if (file.size > MAX_BYTES) return `File too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Max 25 MB.`;
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
      setConversionStep(0);
      setProgressText(`Uploading ${file.name}…`);
      try {
        const formData = new FormData();
        formData.append("file", file);
        // Simulate progress steps since we can't stream LibreOffice
        const stepTimer = setInterval(() => {
          setConversionStep((prev) => {
            if (prev < 1) { setProgressText("Converting to PDF…"); return 1; }
            return prev;
          });
        }, 2000);
        const res = await fetch("/api/present/import-deck", {
          method: "POST",
          body: formData,
          signal,
        });
        clearInterval(stepTimer);
        setConversionStep(2);
        setProgressText("Conversion complete — rendering pages…");
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
    let failedCount = 0;

    // Derive a base name from the filename for slide titles
    const baseName = filename
      ? filename.replace(/\.(pdf|pptx|ppt)$/i, "").trim()
      : "Slide";

    for (const page of selected) {
      setPages((prev) =>
        prev.map((p) => (p.index === page.index ? { ...p, uploading: true } : p))
      );

      try {
        const res = await fetch(page.thumbnailUrl);
        const blob = await res.blob();

        const uid = user?.id || "anon";
        const path = `${uid}/deck-imports/${Date.now()}-page-${page.index + 1}.jpg`;

        const { error: uploadError } = await supabase.storage
          .from("quiz-images")
          .upload(path, blob, { contentType: "image/jpeg", upsert: true });

        if (uploadError) throw uploadError;

        const { data } = supabase.storage.from("quiz-images").getPublicUrl(path);
        // Use filename-based title: "MyDeck — Slide 3 of 12"
        results.push({
          title: `${baseName} — Slide ${page.index + 1} of ${selected.length}`,
          image_url: data.publicUrl,
        });

        setPages((prev) =>
          prev.map((p) =>
            p.index === page.index
              ? { ...p, uploading: false, thumbnailUrl: data.publicUrl }
              : p
          )
        );
      } catch (err) {
        failedCount++;
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

    setImportSummary({ ok: results.length, failed: failedCount });
    setPhase("done");
    // Short delay so user sees the summary, then hand off
    setTimeout(() => onImport(results, failedCount), failedCount > 0 ? 0 : 800);
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
              PDF · PPTX · PPT &nbsp;·&nbsp; Max 25 MB &nbsp;·&nbsp; Up to {MAX_PAGES} pages
            </p>
          </div>
        )}

        {/* ── CONVERTING ── */}
        {phase === "converting" && (
          <div className="present-deck-processing">
            <div className="present-deck-spinner" />
            <p className="present-deck-progress-label">{progressText}</p>
            {/* Step indicators */}
            <div style={{ display: "flex", gap: "0.5rem", justifyContent: "center", marginTop: "0.75rem" }}>
              {["Upload", "Convert", "Ready"].map((label, i) => (
                <div key={label} style={{ display: "flex", alignItems: "center", gap: "0.25rem", fontSize: "0.75rem", color: conversionStep >= i ? "var(--primary)" : "var(--muted)", fontWeight: conversionStep >= i ? 700 : 400 }}>
                  <span style={{ width: 18, height: 18, borderRadius: "50%", background: conversionStep > i ? "var(--primary)" : conversionStep === i ? "var(--primary)" : "var(--line)", display: "inline-flex", alignItems: "center", justifyContent: "center", color: conversionStep >= i ? "#fff" : "var(--muted)", fontSize: "0.625rem", flexShrink: 0 }}>
                    {conversionStep > i ? "✓" : i + 1}
                  </span>
                  {label}
                  {i < 2 && <span style={{ color: "var(--line)", marginLeft: "0.25rem" }}>›</span>}
                </div>
              ))}
            </div>
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

        {/* ── DONE (summary before hand-off) ── */}
        {phase === "done" && importSummary && (
          <div style={{ textAlign: "center", padding: "1.5rem 0" }}>
            <div style={{ fontSize: "2.5rem", marginBottom: "0.5rem" }}>✅</div>
            <p style={{ fontWeight: 700, fontSize: "1rem" }}>
              {importSummary.ok} slide{importSummary.ok !== 1 ? "s" : ""} imported
              {importSummary.failed > 0 && (
                <span style={{ color: "var(--error, #e53e3e)", fontWeight: 600 }}>
                  {" "}· {importSummary.failed} failed
                </span>
              )}
            </p>
            {importSummary.failed > 0 && (
              <>
                <p style={{ color: "var(--muted)", fontSize: "0.8125rem", marginTop: "0.25rem" }}>
                  The failed slides were skipped. You can re-import them separately.
                </p>
                <button
                  onClick={() => { setPhase("drop"); setPages([]); setFilename(""); setImportSummary(null); }}
                  className="btn btn-secondary"
                  style={{ marginTop: "0.75rem" }}
                >
                  Re-import slides
                </button>
              </>
            )}
          </div>
        )}

        {/* Footer actions */}
        <div className="present-pdf-actions">
          {phase === "review" && (
            <>
              <button
                onClick={uploadAndImport}
                className="btn btn-primary"
                disabled={selectedCount === 0}
              >
                Import {selectedCount} slide{selectedCount !== 1 ? "s" : ""}
              </button>
              <button
                onClick={() => { setPhase("drop"); setPages([]); setFilename(""); }}
                className="btn btn-secondary"
                title="Choose a different file"
              >
                ↩ Different file
              </button>
            </>
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
