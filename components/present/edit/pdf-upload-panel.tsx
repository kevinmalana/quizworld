"use client";

import { useState, useRef } from "react";
import { useAuth } from "@/components/supabase-provider";
import { supabase } from "@/lib/supabase/client";

type PdfUploadPanelProps = {
  onImport: (slides: Array<{ title: string; image_url: string }>) => void;
  onClose: () => void;
};

export function PdfUploadPanel({ onImport, onClose }: PdfUploadPanelProps) {
  const { user } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState("");
  const [pdfInfo, setPdfInfo] = useState<{
    url: string;
    pageCount: number;
    filename: string;
  } | null>(null);
  const [pageImages, setPageImages] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(0);

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith(".pdf")) {
      setError("Please select a PDF file");
      return;
    }

    if (file.size > 50 * 1024 * 1024) {
      setError("PDF must be under 50MB");
      return;
    }

    setUploading(true);
    setError("");

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("userId", user?.id || "anonymous");

      const response = await fetch("/api/present/import-pdf", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Upload failed");
      }

      setPdfInfo(data.pdf);
      
      // Now render pages using PDF.js
      await renderPdfPages(data.pdf.url);

    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function renderPdfPages(pdfUrl: string) {
    setProcessing(true);
    const images: string[] = [];

    try {
      // Dynamically import PDF.js
      const pdfjsLib = await import("pdfjs-dist");
      
      // Set worker
      pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

      const loadingTask = pdfjsLib.getDocument(pdfUrl);
      const pdf = await loadingTask.promise;
      const pageCount = pdf.numPages;

      for (let i = 1; i <= pageCount; i++) {
        const page = await pdf.getPage(i);
        const scale = 2; // Higher resolution
        const viewport = page.getViewport({ scale });

        // Create canvas
        const canvas = document.createElement("canvas");
        const context = canvas.getContext("2d");
        canvas.height = viewport.height;
        canvas.width = viewport.width;

        await page.render({
          canvasContext: context!,
          viewport,
          canvas,
        }).promise;

        // Convert to image URL
        const imageUrl = canvas.toDataURL("image/png", 0.9);
        images.push(imageUrl);
        setPageImages([...images]);
        setCurrentPage(i);
      }

      // Upload all images to Supabase Storage
      const uploadedUrls: string[] = [];
      for (let i = 0; i < images.length; i++) {
        const blob = await fetch(images[i]).then(r => r.blob());
        const path = `${user?.id}/slides/${Date.now()}-page-${i + 1}.png`;
        
        const { error: uploadError } = await supabase.storage
          .from("quiz-images")
          .upload(path, blob, { contentType: "image/png", upsert: true });

        if (!uploadError) {
          const { data } = supabase.storage.from("quiz-images").getPublicUrl(path);
          uploadedUrls.push(data.publicUrl);
        } else {
          // Fallback to data URL
          uploadedUrls.push(images[i]);
        }
      }

      setPageImages(uploadedUrls);
    } catch (err) {
      console.error("PDF rendering error:", err);
      setError("Failed to render PDF pages. Try a different file.");
    } finally {
      setProcessing(false);
    }
  }

  function handleImport() {
    if (pageImages.length === 0) return;

    const slides = pageImages.map((url, i) => ({
      title: `Slide ${i + 1}`,
      image_url: url,
    }));

    onImport(slides);
  }

  return (
    <div className="present-add-slide-backdrop" onClick={onClose}>
      <div className="card present-add-slide-card present-pdf-panel" onClick={(e) => e.stopPropagation()}>
        <div className="present-add-slide-header">
          <h2 className="present-add-slide-title">📄 Import PDF Slides</h2>
          <button onClick={onClose} className="present-add-slide-close">✕</button>
        </div>

        {!pdfInfo && (
          <div className="present-pdf-upload-area">
            <input
              ref={fileRef}
              type="file"
              accept=".pdf"
              onChange={handleFileSelect}
              style={{ display: "none" }}
            />
            <button
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="present-pdf-upload-btn"
            >
              {uploading ? (
                <>
                  <span className="present-pdf-spinner"></span>
                  Uploading...
                </>
              ) : (
                <>
                  📄 Select PDF File
                </>
              )}
            </button>
            <p className="present-pdf-hint">
              Upload a PDF (max 50 pages, 50MB). Each page becomes a slide.
            </p>
          </div>
        )}

        {processing && (
          <div className="present-pdf-processing">
            <div className="present-pdf-progress">
              <div 
                className="present-pdf-progress-bar"
                style={{ width: `${(currentPage / (pdfInfo?.pageCount || 1)) * 100}%` }}
              ></div>
            </div>
            <p>Processing page {currentPage} of {pdfInfo?.pageCount}...</p>
          </div>
        )}

        {!processing && pageImages.length > 0 && (
          <div className="present-pdf-preview">
            <div className="present-pdf-preview-grid">
              {pageImages.slice(0, 6).map((url, i) => (
                <div key={i} className="present-pdf-preview-thumb">
                  <img src={url} alt={`Page ${i + 1}`} />
                  <span>{i + 1}</span>
                </div>
              ))}
              {pageImages.length > 6 && (
                <div className="present-pdf-preview-more">
                  +{pageImages.length - 6} more
                </div>
              )}
            </div>
            <p className="present-pdf-count">
              {pageImages.length} slides ready to import
            </p>
          </div>
        )}

        {error && (
          <div className="present-pdf-error">
            {error}
          </div>
        )}

        <div className="present-pdf-actions">
          {pageImages.length > 0 && (
            <button
              onClick={handleImport}
              className="btn btn-primary"
              disabled={processing}
            >
              Import {pageImages.length} Slides
            </button>
          )}
          <button onClick={onClose} className="btn btn-secondary">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
