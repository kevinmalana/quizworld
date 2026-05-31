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
    const char = val.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(-1);
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
        .from("game_sessions")
        .select("*")
        .eq("pin", p)
        .single();

      if (session) {
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

        // Surface Phoenix-specific error messages clearly
        const reason = (response as any)?.reason;
        if (reason === "game_full") {
          setError("This game is full (200 players max). Ask the host to start a new session.");
          setJoining(false);
          return;
        }
        if (reason === "nickname_taken") {
          setError("That nickname is already taken. Choose a different one.");
          setJoining(false);
          return;
        }
        if (reason === "session_closed") {
          setError("This game has already started. Ask the host to start a new session.");
          setJoining(false);
          return;
        }
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
      setError(
        error?.message === "Game is not accepting new players."
          ? "This game is no longer accepting new players."
          : error?.message === "Nickname is required."
            ? "Enter a nickname."
            : error?.message === "That nickname is already taken in this game."
              ? "That nickname is already taken. Choose a different one."
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
              pattern="[A-Z0-9]*"
              maxLength={1}
              value={d}
              onChange={(e) => handleDigitChange(i, e.target.value)}
              onKeyDown={(e) => handleDigitKeyDown(i, e)}
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
