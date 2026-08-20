"use client";

import { useState, useRef, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { writePlayerSession, readPlayerSession } from "@/lib/player-session";
import { fetchPhoenixSession, joinPhoenixSession } from "@/lib/game-engine/client";
import {
  isPhoenixGameEngine,
  legacySupabaseGameEngine,
  liveGameEngineMisconfigured,
} from "@/lib/game-engine/config";

const AVATARS = ["🦁", "🐯", "🐺", "🦊", "🐸", "🦄", "🐉", "🦋", "🦅", "🐬", "🦝", "🐱"];
type JoinGameResponse = {
  player_id: string;
  player_token: string;
  session_id: string;
};

function JoinForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialPin = searchParams.get("pin") ?? "";

  const [step, setStep] = useState<"pin" | "nickname">("pin");
  const [pin, setPin] = useState(initialPin.toUpperCase());
  const [nickname, setNickname] = useState("");
  const [avatar, setAvatar] = useState(AVATARS[0]);
  const [error, setError] = useState("");
  const [joining, setJoining] = useState(false);

  const [digits, setDigits] = useState<string[]>(
    initialPin ? initialPin.toUpperCase().split("").slice(0, 6).concat(Array(6).fill("")).slice(0, 6) : Array(6).fill("")
  );
  const digitRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Re-join: if player already has a valid session for this PIN, go straight to game
  useEffect(() => {
    if (!initialPin) return;
    const existing = readPlayerSession(initialPin.toUpperCase());
    if (existing?.playerId && existing?.playerToken) {
      setJoining(true); // show spinner during redirect
      router.replace(`/game/${initialPin.toUpperCase()}`);
    }
  }, [initialPin, router]);

  if (liveGameEngineMisconfigured) {
    return (
      <div className="container game-status-panel">
        <div className="card game-status-card">
          <div className="game-status-icon">⚙️</div>
          <h2 className="font-display game-status-title">Live Games Unavailable</h2>
          <p className="game-status-text">The live game service isn't reachable right now. Please try again shortly or contact support.</p>
        </div>
      </div>
    );
  }

  if (legacySupabaseGameEngine) {
    return (
      <div className="container game-status-panel">
        <div className="card game-status-card">
          <div className="game-status-icon">🛑</div>
          <h2 className="font-display game-status-title">Live Games Unavailable</h2>
          <p className="game-status-text">Live multiplayer games are temporarily unavailable. Please check back shortly.</p>
        </div>
      </div>
    );
  }

  const handleDigitChange = (idx: number, val: string) => {
    // Keep exactly one sanitized character per controlled input. Taking the first
    // character avoids mobile/iOS keystroke bursts duplicating the final character.
    const char = val.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 1);
    const newDigits = [...digits];
    newDigits[idx] = char;
    setDigits(newDigits);
    if (char && idx < 5) {
      digitRefs.current[idx + 1]?.focus();
    }
    setPin(newDigits.join(""));
    setError("");
  };


  const handleDigitKeyDown = (idx: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !digits[idx] && idx > 0) {
      digitRefs.current[idx - 1]?.focus();
    }
    if (e.key === "Enter" && digits.join("").length === 6) handlePinSubmit();
  };

  const handlePinSubmit = async () => {
    const p = digits.join("").toUpperCase();
    if (p.length !== 6) { setError("Enter the full 6-character PIN"); return; }

    // Only check for presentation code if the user typed the PIN manually.
    // If it came from a QR code (?pin= URL param) it is always a game PIN.
    const isPresentation = !initialPin && /^[A-Za-z]+$/.test(p);
    if (isPresentation) {
      router.push(`/present/join?code=${p}`);
      return;
    }
    
    setError("");
    setJoining(true);

    try {
      if (isPhoenixGameEngine) {
        const response = await fetchPhoenixSession(p);
        const session = response.session;

        if (session.status !== "waiting") {
          setError("This game has already started.");
          setJoining(false);
          return;
        }

        setPin(p);
        setStep("nickname");
        setJoining(false);
        return;
      }

      const { data: session } = await supabase
        .rpc("lookup_game_by_pin", { p_pin: p })
        .single();

      if (session) {
        if ((session as { status: string }).status !== "waiting") {
          setError("This game has already started.");
          setJoining(false);
          return;
        }
        setPin(p);
        setStep("nickname");
        setJoining(false);
        return;
      }

      setError("Game not found. Check the PIN and try again.");
      setJoining(false);
    } catch (_error) {
      setError("Game not found. Check the PIN and try again.");
      setJoining(false);
    }
  };

  const handleJoinSubmit = async () => {
    if (!nickname.trim()) { setError("Enter a nickname"); return; }
    
    setJoining(true);

    try {
      if (isPhoenixGameEngine) {
        const response = await joinPhoenixSession(pin, {
          nickname: nickname.trim(),
          avatar,
        });

        if (response?.player_id && response?.player_token) {
          writePlayerSession(pin, {
            playerId: response.player_id,
            playerToken: response.player_token,
          });
          router.push(`/game/${pin}`);
          return;
        }

        // joinPhoenixSession throws on non-2xx — if we get here the response was
        // a 2xx but missing player credentials (shouldn't happen, treat as error)
        setError("Could not join this game right now. Please try again.");
        setJoining(false);
        return;
      } else {
        const { data, error } = await supabase
          .rpc("join_game_session", {
            p_pin: pin,
            p_nickname: nickname.trim(),
            p_avatar: avatar,
          })
          .single<JoinGameResponse>();

        if (data?.player_id && data?.player_token) {
          writePlayerSession(pin, {
            playerId: data.player_id,
            playerToken: data.player_token,
          });
          router.push(`/game/${pin}`);
          return;
        }

        if (error) throw error;
      }

      setError("Could not join this game right now. Please try again.");
    } catch (error: any) {
      console.error("Join game error:", error);
      const msg = error?.message ?? "";
      setError(
        msg === "Game is not accepting new players." || msg === "Session not found."
          ? "This game is no longer accepting new players."
          : msg === "Nickname is required."
            ? "Enter a nickname."
            : msg === "That nickname is already taken in this game."
              ? "That nickname is already taken. Choose a different one."
              : msg === "This game is full."
                ? "This game is full. Ask the host to start a new session."
                : msg
                  ? msg  // show actual Phoenix error message
                  : "Could not join this game right now. Please try again."
      );
    }

    setJoining(false);
  };

  if (step === "nickname") {
    return (
      <div className="container join-shell">
        <div className="card join-card">
          <div className="join-icon">🙋</div>
          <h2 className="font-display join-title">Enter Your Nickname</h2>
          <p className="join-subtitle">Game PIN: <strong>{pin}</strong></p>

          <input
            type="text"
            placeholder="Nickname"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            className="input-pin join-nickname-input"
            maxLength={20}
          />

          <div className="mb-md">
            <p className="join-pin-label">Pick Your Avatar</p>
            <div className="join-pin-grid">
              {AVATARS.map((a) => (
                <button
                  key={a}
                  onClick={() => setAvatar(a)}
                  className={avatar === a ? "nickname-avatar-btn is-selected" : "nickname-avatar-btn"}
                >{a}</button>
              ))}
            </div>
          </div>

          {error && (
            <div className="error-message">
              {error}
            </div>
          )}

          <button onClick={handleJoinSubmit} disabled={joining} className="btn btn-primary btn-lg join-submit-btn">
            {joining ? "Joining..." : `Join as ${nickname.trim() || "Player"} 🎮`}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="container join-shell">
      <div className="card join-card">
        <div className="join-icon">🎮</div>
        <h2 className="font-display join-title">Join a Game</h2>
        <p className="join-subtitle">Enter your 6-character game PIN</p>

        <div className="join-pin-row">
          {digits.map((d, i) => (
            <input
              key={i}
              ref={(el) => { digitRefs.current[i] = el; }}
              type="text"
              inputMode="text"
              // 2026-08-13: explicit autoComplete/autocorrect/capitalize off on mobile.
                // iOS Safari will otherwise suggest autocorrected "B8" instead of "B" etc.
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="characters"
                spellCheck={false}
                pattern="[A-Z0-9]*"
                maxLength={1}
                value={d}
                onChange={(e) => handleDigitChange(i, e.target.value)}
                onKeyDown={(e) => handleDigitKeyDown(i, e)}
                onPaste={(e) => {
                  // 2026-08-13: paste the entire string into the next N digits.
                  // Without this, a paste of the full PIN would only fill the first box.
                  e.preventDefault();
                  const pasted = (e.clipboardData.getData("text") || "")
                    .toUpperCase()
                    .replace(/[^A-Z0-9]/g, "")
                    .slice(0, 6 - digits.filter(Boolean).length);
                  const newDigits = [...digits];
                  for (let j = 0; j < pasted.length && i + j < 6; j++) {
                    newDigits[i + j] = pasted[j];
                  }
                  setDigits(newDigits);
                  setPin(newDigits.join(""));
                  setError("");
                  // Focus the next empty cell, or the last cell.
                  const next = Math.min(i + pasted.length, 5);
                  digitRefs.current[next]?.focus();
                }}
                className="input-pin join-digit-input"
                aria-label={`PIN character ${i + 1}`}
              />
          ))}
        </div>

        {error && (
          <div className="error-message">
            {error}
          </div>
        )}

        <button onClick={handlePinSubmit} disabled={joining || digits.join("").length !== 6} className="btn btn-primary btn-lg join-submit-btn">
          {joining ? "Finding..." : "Enter Game"}
        </button>
      </div>
    </div>
  );
}

export default function JoinPage() {
  return (
    <Suspense fallback={<div className="container report-status">Loading...</div>}>
      <JoinForm />
    </Suspense>
  );
}
