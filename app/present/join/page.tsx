"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { joinPhoenixPresentation, writeParticipantSession } from "@/lib/presentation/client";
import { setParticipantName } from "@/lib/presentation/types";

function JoinForm() {
  const router      = useRouter();
  const searchParams = useSearchParams();
  const initialCode  = (searchParams.get("code") || "").toUpperCase().slice(0, 6);

  const [code, setCode]       = useState(initialCode);
  const [name, setName]       = useState("");
  const [error, setError]     = useState("");
  const [loading, setLoading] = useState(false);

  // Auto-fill saved name + pre-populated code from URL
  useEffect(() => {
    if (initialCode.length === 6) {
      setCode(initialCode);
      const saved = localStorage.getItem("qw_present_name");
      if (saved) setName(saved);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleJoin = async () => {
    const joinCode = code.trim().toUpperCase();
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
      // Make the error user-friendly
      if (msg.toLowerCase().includes("not found") || msg.toLowerCase().includes("not live")) {
        setError("That code doesn't match any active presentation. Check the code and try again.");
      } else {
        setError(msg);
      }
      setLoading(false);
    }
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") void handleJoin();
  };

  return (
    <div className="present-join-screen">
      <div className="card present-join-card">
        <div className="present-join-icon">🎤</div>
        <h1 className="font-display present-join-title">Join Presentation</h1>
        <p className="present-join-subtitle">Enter the 6-character code from your presenter</p>

        <input
          value={code}
          onChange={(e) => { setCode(e.target.value.toUpperCase().slice(0, 6)); setError(""); }}
          placeholder="ABCDEF"
          maxLength={6}
          className="present-join-code-input"
          onKeyDown={onKey}
          autoFocus
        />

        <input
          value={name}
          onChange={(e) => { setName(e.target.value); setError(""); }}
          placeholder="Your name (optional)"
          maxLength={80}
          className="present-join-name-input"
          onKeyDown={onKey}
        />

        {error && (
          <div className="present-join-error">
            <span className="present-join-error-icon">⚠️</span>
            {error}
          </div>
        )}

        <button
          onClick={handleJoin}
          disabled={loading || code.trim().length !== 6}
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
