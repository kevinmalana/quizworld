"use client";

import { useRef, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { useAuth } from "@/components/supabase-provider";

interface Props {
  imageUrl?: string;
  onUpload: (url: string) => void;
  onRemove: () => void;
  label?: string;
  compact?: boolean;
}

export function ImageUpload({ imageUrl, onUpload, onRemove, label = "Add image", compact = false }: Props) {
  const { user } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setError("Image must be under 5MB");
      return;
    }
    if (!file.type.startsWith("image/")) {
      setError("Please select an image file");
      return;
    }

    setUploading(true);
    setError("");

    try {
      // Try Supabase Storage first
      if (user) {
        try {
          const ext = file.name.split(".").pop() || "jpg";
          const path = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

          const { error: uploadError } = await supabase.storage
            .from("quiz-images")
            .upload(path, file, { contentType: file.type });

          if (!uploadError) {
            const { data } = supabase.storage.from("quiz-images").getPublicUrl(path);
            onUpload(data.publicUrl);
            setUploading(false);
            if (fileRef.current) fileRef.current.value = "";
            return;
          }
          console.warn("Storage upload failed, using data URL:", uploadError.message);
        } catch (storageErr) {
          console.warn("Storage not available, using data URL:", storageErr);
        }
      }

      // Fallback: data URL
      const reader = new FileReader();
      reader.onload = () => {
        onUpload(reader.result as string);
        setUploading(false);
      };
      reader.onerror = () => {
        setError("Failed to read image file");
        setUploading(false);
      };
      reader.readAsDataURL(file);
    } catch (err: any) {
      setError(err.message || "Upload failed");
      setUploading(false);
    }

    if (fileRef.current) fileRef.current.value = "";
  }

  if (imageUrl) {
    return (
      <div style={{ position: "relative", borderRadius: 12, overflow: "hidden", border: "1.5px solid var(--line)" }}>
        <img
          src={imageUrl}
          alt="Question image"
          style={{
            width: "100%",
            maxHeight: compact ? 120 : 200,
            objectFit: "cover",
            display: "block",
          }}
        />
        <button
          type="button"
          onClick={onRemove}
          style={{
            position: "absolute",
            top: 6,
            right: 6,
            width: 32,
            height: 32,
            borderRadius: "50%",
            border: "none",
            background: "rgba(0,0,0,0.6)",
            color: "white",
            fontSize: "0.8rem",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          ✕
        </button>
      </div>
    );
  }

  // Use a <label> for mobile-compatible file input
  const inputId = `img-upload-${label.replace(/\s/g, "-")}-${Math.random().toString(36).slice(2, 6)}`;

  return (
    <div>
      <input
        ref={fileRef}
        type="file"
        id={inputId}
        accept="image/*"
        onChange={handleFile}
        style={{
          position: "absolute",
          width: 1,
          height: 1,
          padding: 0,
          margin: -1,
          overflow: "hidden",
          clip: "rect(0, 0, 0, 0)",
          border: 0,
        }}
      />
      <label
        htmlFor={inputId}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: "100%",
          border: "1.5px dashed var(--line)",
          borderRadius: 12,
          padding: compact ? "0.5rem" : "0.75rem",
          fontSize: compact ? "0.75rem" : "0.8125rem",
          fontWeight: 600,
          color: uploading ? "var(--accent)" : "var(--muted)",
          minHeight: compact ? 40 : 48,
          cursor: uploading ? "wait" : "pointer",
          background: "transparent",
          transition: "all 0.15s",
          boxSizing: "border-box",
        }}
      >
        {uploading ? "⏳ Uploading…" : `🖼 ${label}`}
      </label>
      {error && (
        <p style={{ fontSize: "0.75rem", color: "var(--primary)", marginTop: "0.375rem", fontWeight: 600, padding: "0.25rem 0.5rem", background: "var(--primary-light)", borderRadius: 8 }}>
          {error}
        </p>
      )}
    </div>
  );
}
