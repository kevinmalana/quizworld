"use client";

import { useState, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { writePlayerSession } from "@/lib/player-session";
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

  if (liveGameEngineMisconfigured) {
    return (
      <div className="container" style={{ paddingTop: "4rem", paddingBottom: "5rem", maxWidth: 520 }}>
        <div className="card" style={{ padding: "2rem", textAlign: "center" }}>
          <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>⚙️</div>
          <h2 className="font-display" style={{ fontSize: "1.5rem", fontWeight: 800, marginBottom: "0.75rem" }}>
            Live Game Service Not Configured
          </h2>
          <p style={{ color: "var(--muted)" }}>
            Phoenix is selected as the live engine, but `NEXT_PUBLIC_GAME_SERVICE_URL` is missing.
          </p>
        </div>
      </div>
    );
  }

  if (legacySupabaseGameEngine) {
    return (
      <div className="container" style={{ paddingTop: "4rem", paddingBottom: "5rem", maxWidth: 520 }}>
        <div className="card" style={{ padding: "2rem", textAlign: "center" }}>
          <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>🛑</div>
          <h2 className="font-display" style={{ fontSize: "1.5rem", fontWeight: 800, marginBottom: "0.75rem" }}>
            Legacy Supabase Live Games Disabled
          </h2>
          <p style={{ color: "var(--muted)" }}>
            Production live sessions now require the Phoenix realtime service.
          </p>
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

        if (error) {
          throw error;
        }
      }

      setError("Could not join this game right now. Please try again.");
    } catch (error: any) {
      console.error("Join game error:", error);
      setError(
        error?.message === "Game is not accepting new players."
          ? "This game is no longer accepting new players."
          : error?.message === "Nickname is required." ||
              error?.message === "Nickname is required."
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
      <div className="container" style={{ paddingTop: "4rem", paddingBottom: "5rem", maxWidth: 480 }}>
        <div className="card" style={{ padding: "2rem", textAlign: "center" }}>
          <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>🙋</div>
          <h2 className="font-display" style={{ fontSize: "1.5rem", fontWeight: 800, marginBottom: "0.5rem" }}>
            Enter Your Nickname
          </h2>
          <p style={{ color: "var(--muted)", marginBottom: "2rem" }}>
            Game PIN: <strong>{pin}</strong>
          </p>

          <input
            type="text"
            placeholder="Nickname"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            className="input-pin"
            style={{ marginBottom: "1.5rem", textAlign: "center", fontSize: "1.25rem" }}
            maxLength={20}
          />

          {/* Avatar picker */}
          <div style={{ marginBottom: "1.5rem" }}>
            <p style={{ fontSize: "0.875rem", fontWeight: 700, color: "var(--muted)", marginBottom: "0.75rem", letterSpacing: "0.05em", textTransform: "uppercase" }}>
              Pick Your Avatar
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "0.5rem", maxWidth: 280, margin: "0 auto" }}>
              {AVATARS.map((a) => (
                <button
                  key={a}
                  onClick={() => setAvatar(a)}
                  style={{
                    fontSize: "1.5rem",
                    padding: "0.5rem",
                    borderRadius: 12,
                    border: avatar === a ? "2px solid var(--accent)" : "2px solid transparent",
                    background: avatar === a ? "var(--accent-light)" : "var(--bg)",
                    cursor: "pointer",
                    transition: "all 0.15s",
                    transform: avatar === a ? "scale(1.1)" : "scale(1)",
                    boxShadow: avatar === a ? "0 0 0 3px var(--accent-light)" : "none",
                  }}
                >
                  {a}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={handleJoinSubmit}
            disabled={joining}
            className="btn btn-primary btn-lg"
            style={{ width: "100%" }}
          >
            {joining ? "Joining..." : `Join as ${nickname.trim() || "Player"} 🎮`}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="container" style={{ paddingTop: "4rem", paddingBottom: "5rem", maxWidth: 480 }}>
      <div className="card" style={{ padding: "2rem", textAlign: "center" }}>
        <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>🎮</div>
        <h2 className="font-display" style={{ fontSize: "1.5rem", fontWeight: 800, marginBottom: "0.5rem" }}>
          Join a Game
        </h2>
        <p style={{ color: "var(--muted)", marginBottom: "2rem" }}>
          Enter the 6-character PIN
        </p>

        <div style={{ display: "flex", gap: "0.5rem", justifyContent: "center", marginBottom: "1.5rem" }}>
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
              className="input-pin"
              style={{ 
                width: 48, 
                height: 56, 
                textAlign: "center", 
                fontSize: "1.5rem", 
                fontWeight: 800,
                textTransform: "uppercase"
              }}
            />
          ))}
        </div>

        {error && (
          <div style={{ 
            color: "var(--primary)", 
            background: "var(--primary-light)", 
            padding: "0.75rem", 
            borderRadius: "var(--radius-lg)",
            marginBottom: "1rem",
            fontWeight: 600,
            fontSize: "0.875rem"
          }}>
            {error}
          </div>
        )}

          <button 
            onClick={handlePinSubmit}
            disabled={joining || digits.join("").length !== 6}
            className="btn btn-primary btn-lg"
            style={{ width: "100%" }}
          >
          {joining ? "Finding..." : "Enter Game"}
        </button>
      </div>
    </div>
  );
}

export default function JoinPage() {
  return (
    <Suspense fallback={<div className="container" style={{ paddingTop: "4rem", textAlign: "center" }}>Loading...</div>}>
      <JoinForm />
    </Suspense>
  );
}
