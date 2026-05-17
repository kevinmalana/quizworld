"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { joinPhoenixPresentation, writeParticipantSession } from "@/lib/presentation/client";
import { setParticipantName } from "@/lib/presentation/types";

function JoinForm() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const initialCode  = (searchParams.get("code") || "").toUpperCase().slice(0, 6);

  const [digits, setDigits]   = useState<string[]>(Array(6).fill(""));
  const [name, setName]       = useState("");
  const [error, setError]     = useState("");
  const [loading, setLoading] = useState(false);
  const digitRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Pre-fill from URL code param
  useEffect(() => {
    if (initialCode.length === 6) {
      setDigits(initialCode.split(""));
      const saved = localStorage.getItem("qw_present_name");
      if (saved) setName(saved);
    } else {
      digitRefs.current[0]?.focus();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleDigitChange = (idx: number, val: string) => {
    const ch = val.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(-1);
    const next = [...digits];
    next[idx] = ch;
    setDigits(next);
    setError("");
    if (ch && idx < 5) digitRefs.current[idx + 1]?.focus();
  };

  const handleDigitKeyDown = (idx: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !digits[idx] && idx > 0) {
      digitRefs.current[idx - 1]?.focus();
    }
    if (e.key === "Enter" && digits.join("").length === 6) void handleJoin();
  };

  // Handle paste on any digit box
  const handlePaste = (e: React.ClipboardEvent) => {
    const pasted = e.clipboardData.getData("text").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
    if (pasted.length > 0) {
      e.preventDefault();
      const next = Array(6).fill("");
      pasted.split("").forEach((ch, i) => { next[i] = ch; });
      setDigits(next);
      digitRefs.current[Math.min(pasted.length, 5)]?.focus();
    }
  };

  const handleJoin = async () => {
    const joinCode = digits.join("");
    if (joinCode.length !== 6) return;

    setLoading(true);
    setError("");

    try {
      const participantName = name.trim() || "Anonymous";
      const joined = await joinPhoenixPresentation(joinCode, participantName);
      setParticipantName(participantName);
      writeParticipantSession(joined.presentationId, {
        participantId: joined.participantId,
        participantToken: joined.participantToken,
        participantName,
      });
      router.push(`/present/${joined.presentationId}/live`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Could not join presentation.";
      setError(
        msg.toLowerCase().includes("not found") || msg.toLowerCase().includes("not live")
          ? "That code doesn't match any active presentation. Check the code and try again."
          : msg
      );
      setLoading(false);
    }
  };

  const codeComplete = digits.join("").length === 6;

  return (
    <div className="present-join-screen">
      <div className="card present-join-card">
        <div className="present-join-icon">🎤</div>
        <h1 className="font-display present-join-title">Join Presentation</h1>
        <p className="present-join-subtitle">Enter the 6-character code from your presenter</p>

        {/* 6 individual character boxes — same pattern as game join */}
        <div className="join-pin-row present-join-pin-row">
          {digits.map((d, i) => (
            <input
              key={i}
              ref={(el) => { digitRefs.current[i] = el; }}
              type="text"
              inputMode="text"
              maxLength={1}
              value={d}
              onChange={(e) => handleDigitChange(i, e.target.value)}
              onKeyDown={(e) => handleDigitKeyDown(i, e)}
              onPaste={handlePaste}
              className="input-pin join-digit-input"
              aria-label={`Code character ${i + 1}`}
            />
          ))}
        </div>

        <input
          value={name}
          onChange={(e) => { setName(e.target.value); setError(""); }}
          placeholder="Your name (optional)"
          maxLength={80}
          className="present-join-name-input"
          onKeyDown={(e) => { if (e.key === "Enter") void handleJoin(); }}
        />

        {error && (
          <div className="present-join-error">
            <span className="present-join-error-icon">⚠️</span>
            {error}
          </div>
        )}

        <button
          onClick={handleJoin}
          disabled={loading || !codeComplete}
          className="btn btn-primary btn-lg present-join-btn"
        >
          {loading ? "Joining..." : "Join →"}
        </button>
      </div>
    </div>
  );
}

export default function PresentJoinPage() {
  return (
    <Suspense fallback={<div className="present-join-loading">Loading...</div>}>
      <JoinForm />
    </Suspense>
  );
}
