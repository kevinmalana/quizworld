"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { useAuth } from "@/components/supabase-provider";
import {
  advancePhoenixSession,
  answerPhoenixSession,
  fetchPhoenixSession,
  reconnectPhoenixSession,
  revealPhoenixSession,
  startPhoenixSession,
} from "@/lib/game-engine/client";
import {
  isPhoenixGameEngine,
  legacySupabaseGameEngine,
  liveGameEngineMisconfigured,
} from "@/lib/game-engine/config";
import { subscribeToPhoenixTopic } from "@/lib/game-engine/phoenix-socket";
import {
  clearPlayerSession,
  readPlayerSession,
  type StoredPlayerSession,
} from "@/lib/player-session";
import {
  clearHostSession,
  readHostSession,
  type StoredHostSession,
} from "@/lib/host-session";

type GameStatus = "waiting" | "active" | "reveal" | "finished";

function sortQuestions(quiz: unknown) {
  const q = quiz as { questions?: { order_index?: number }[] } | null;
  if (!q?.questions) return quiz;

  return {
    ...(q as object),
    questions: [...q.questions].sort(
      (left, right) => (left.order_index ?? 0) - (right.order_index ?? 0)
    ),
  };
}

function getTimeLeft(question: { time_limit?: number } | null, startedAt: string | null) {
  if (!question) return 0;

  const total = question.time_limit ?? 20;
  if (!startedAt) return 0;

  const elapsed = Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000);
  return Math.max(total - elapsed, 0);
}

function normalizePhoenixSession(rawSession: Record<string, unknown>) {
  const quizQuestions =
    (rawSession?.quiz as { questions?: { order_index?: number }[] })?.questions ?? [];
  const questions = [...quizQuestions].sort(
    (left, right) => (left.order_index ?? 0) - (right.order_index ?? 0)
  );
  const currentQuestion =
    (rawSession?.current_question as object) ??
    questions[(rawSession?.current_question_index as number) ?? 0] ??
    null;

  return {
    ...rawSession,
    quiz: {
      ...((rawSession?.quiz as object) ?? {}),
      questions,
    },
    current_question: currentQuestion,
    current_answers: (rawSession?.current_answers as unknown[]) ?? [],
  };
}

export default function GamePage() {
  const params = useParams();
  const { user } = useAuth();
  const pin = params.pin as string;

  const [session, setSession] = useState<Record<string, unknown> | null>(null);
  const [players, setPlayers] = useState<
    { id: string; nickname: string; avatar?: string; score?: number }[]
  >([]);
  const [currentAnswers, setCurrentAnswers] = useState<
    { player_id: string; answer_id: string; is_correct?: boolean; points_awarded?: number }[]
  >([]);
  const [gameStatus, setGameStatus] = useState<GameStatus>("waiting");
  const [currentQuestion, setCurrentQuestion] = useState<{
    id: string;
    text: string;
    time_limit?: number;
    answers?: { id: string; text: string; is_correct?: boolean }[];
  } | null>(null);
  const [timeLeft, setTimeLeft] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [submittingAnswer, setSubmittingAnswer] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [playerSession, setPlayerSession] = useState<StoredPlayerSession | null>(null);
  const [hostSession, setHostSession] = useState<StoredHostSession | null>(null);
  const [playerSessionReady, setPlayerSessionReady] = useState(false);
  const [phoenixChannelConnected, setPhoenixChannelConnected] = useState(false);
  const phaseTransitionLock = useRef(false);
  const isHost = isPhoenixGameEngine
    ? !!user?.id && !!hostSession && hostSession.hostId === user.id
    : !!user?.id && session?.host_id === user.id;
  const hasActiveSessionKey = isPhoenixGameEngine
    ? !!(session as { pin?: string })?.pin
    : !!(session as { id?: string })?.id;

  if (liveGameEngineMisconfigured) {
    return (
      <div className="container" style={{ paddingTop: "4rem", paddingBottom: "5rem", maxWidth: 520 }}>
        <div className="card" style={{ padding: "2rem", textAlign: "center" }}>
          <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>⚙️</div>
          <h1 className="font-display" style={{ fontSize: "1.75rem", fontWeight: 800, marginBottom: "0.75rem" }}>
            Live Game Service Not Configured
          </h1>
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
          <h1 className="font-display" style={{ fontSize: "1.75rem", fontWeight: 800, marginBottom: "0.75rem" }}>
            Legacy Supabase Live Games Disabled
          </h1>
          <p style={{ color: "var(--muted)" }}>
            Production live sessions now require the Phoenix realtime service.
          </p>
        </div>
      </div>
    );
  }

  useEffect(() => {
    setPlayerSession(readPlayerSession(pin));
    setHostSession(readHostSession(pin));
    setPlayerSessionReady(true);
  }, [pin]);

  useEffect(() => {
    if (!isPhoenixGameEngine || !user?.id || !hostSession) return;

    if (hostSession.hostId !== user.id) {
      clearHostSession(pin);
      setHostSession(null);
      setNotice("You are not the host of this game. Viewing as a spectator.");
    }
  }, [hostSession, pin, user?.id]);

  const applySessionSnapshot = useCallback(
    (
      rawSession: Record<string, unknown>,
      explicitAnswers?: {
        player_id: string;
        answer_id: string;
        is_correct?: boolean;
        points_awarded?: number;
      }[]
    ) => {
      const normalizedSession = (
        isPhoenixGameEngine
          ? normalizePhoenixSession(rawSession)
          : {
              ...rawSession,
              quiz: sortQuestions((rawSession as { quiz?: unknown }).quiz),
            }
      ) as Record<string, unknown>;
      const nextPlayers = (normalizedSession.players as typeof players) ?? [];
      const nextQuestion =
        isPhoenixGameEngine
          ? (normalizedSession.current_question as typeof currentQuestion) ?? null
          : ((normalizedSession.quiz as { questions?: typeof currentQuestion[] })?.questions?.[
              (normalizedSession.current_question_index as number) ?? 0
            ] ?? null);
      const nextAnswers =
        explicitAnswers ??
        (isPhoenixGameEngine
          ? (normalizedSession.current_answers as typeof currentAnswers) ?? []
          : []);

      setSession(normalizedSession as Record<string, unknown>);
      setPlayers(nextPlayers);
      setCurrentAnswers(nextAnswers);
      setGameStatus(((normalizedSession.status as string) ?? "waiting") as GameStatus);
      setCurrentQuestion(nextQuestion);
      setSelectedAnswer(
        playerSession?.playerId
          ? nextAnswers.find((answer) => answer.player_id === playerSession.playerId)?.answer_id ??
              null
          : null
      );
      setTimeLeft(getTimeLeft(nextQuestion, (normalizedSession.question_started_at as string) ?? null));
      setError(null);
      setLoading(false);
      phaseTransitionLock.current = false;
    },
    [playerSession?.playerId]
  );

  const loadSession = useCallback(async () => {
    if (isPhoenixGameEngine) {
      try {
        const response = await fetchPhoenixSession(pin) as { session: Record<string, unknown> };
        applySessionSnapshot(response.session);
        return;
      } catch (_error) {
        setError("Game not found. Check the PIN.");
        setLoading(false);
        return;
      }
    }

    const { data: gameSession, error: sessionError } = await supabase
      .from("game_sessions")
      .select("*, quiz:quizzes(*, questions(*, answers(*)))")
      .eq("pin", pin)
      .single();

    if (sessionError || !gameSession) {
      setError("Game not found. Check the PIN.");
      setLoading(false);
      return;
    }

    const normalizedSession = {
      ...gameSession,
      quiz: sortQuestions(gameSession.quiz),
    };

    const { data: playerList, error: playerError } = await supabase
      .from("players")
      .select("*")
      .eq("session_id", (normalizedSession as { id?: string }).id)
      .order("created_at", { ascending: true });

    if (playerError) {
      console.error("Error loading players:", playerError);
    }

    const nextPlayers = playerList ?? [];
    const nextQuestion =
      (normalizedSession.quiz as { questions?: typeof currentQuestion[] })?.questions?.[
        (normalizedSession as { current_question_index?: number }).current_question_index ?? 0
      ] ?? null;

    let nextAnswers: typeof currentAnswers = [];
    if (nextQuestion) {
      const { data: answerRows, error: answerError } = await supabase
        .from("player_answers")
        .select("*")
        .eq("session_id", (normalizedSession as { id?: string }).id)
        .eq("question_id", (nextQuestion as { id?: string }).id);

      if (answerError) {
        console.error("Error loading answers:", answerError);
      } else {
        nextAnswers = (answerRows ?? []) as typeof currentAnswers;
      }
    }

    applySessionSnapshot(
      {
        ...(normalizedSession as Record<string, unknown>),
        players: nextPlayers,
      },
      nextAnswers
    );
  }, [applySessionSnapshot, pin]);

  useEffect(() => {
    if (!isPhoenixGameEngine || !playerSessionReady || !playerSession) return;

    reconnectPhoenixSession(pin, {
      player_id: playerSession.playerId,
      player_token: playerSession.playerToken,
    })
      .then((response: { session?: Record<string, unknown> }) => {
        if (response?.session) {
          applySessionSnapshot(response.session);
        }
      })
      .catch(() => {
        clearPlayerSession(pin);
        setPlayerSession(null);
      });
  }, [pin, playerSession, playerSessionReady, applySessionSnapshot]);

  const revealCurrentQuestion = useCallback(async () => {
    if (!isHost || !session) return false;

    try {
      if (isPhoenixGameEngine) {
        if (!hostSession?.hostToken) {
          throw new Error("Host session is invalid.");
        }

        await revealPhoenixSession(pin, hostSession.hostToken);
      } else {
        const { error: revealError } = await supabase.rpc("reveal_current_question", {
          p_session_id: (session as { id?: string }).id,
        });

        if (revealError) {
          throw revealError;
        }
      }

      return true;
    } catch (revealError) {
      const msg = (revealError as Error)?.message ?? "";
      if (msg === "This action is not allowed right now.") {
        return true;
      }
      console.error("Error revealing question:", revealError);
      setError("Could not score and reveal this round.");
      return false;
    }
  }, [hostSession?.hostToken, isHost, pin, session]);

  useEffect(() => {
    loadSession();
  }, [loadSession]);

  useEffect(() => {
    if (isPhoenixGameEngine) return;

    const channel = supabase
      .channel(`game-session:${pin}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "game_sessions",
          filter: `pin=eq.${pin}`,
        },
        () => {
          void loadSession();
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [pin, loadSession]);

  useEffect(() => {
    if (isPhoenixGameEngine || !(session as { id?: string })?.id) return;

    const channel = supabase
      .channel(`game-live:${(session as { id: string }).id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "players",
          filter: `session_id=eq.${(session as { id: string }).id}`,
        },
        () => {
          void loadSession();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "player_answers",
          filter: `session_id=eq.${(session as { id: string }).id}`,
        },
        () => {
          void loadSession();
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [(session as { id?: string })?.id, loadSession]);

  useEffect(() => {
    if (!isPhoenixGameEngine) return;

    let stopped = false;

    const unsubscribe = subscribeToPhoenixTopic({
      topic: `game:${pin}`,
      onJoin: (payload) => {
        if (stopped) return;
        setPhoenixChannelConnected(true);
        const p = payload as { session?: Record<string, unknown> };
        if (p?.session) {
          applySessionSnapshot(p.session);
        }
      },
      onSessionUpdate: (payload) => {
        if (stopped) return;
        setPhoenixChannelConnected(true);
        const p = payload as { session?: Record<string, unknown> };
        if (p?.session) {
          applySessionSnapshot(p.session);
        }
      },
      onError: () => {
        if (stopped) return;
        setPhoenixChannelConnected(false);
      },
      onClose: () => {
        if (stopped) return;
        setPhoenixChannelConnected(false);
      },
    });

    return () => {
      stopped = true;
      unsubscribe();
    };
  }, [applySessionSnapshot, pin]);

  useEffect(() => {
    if (!isPhoenixGameEngine) return;

    const fallbackInterval = window.setInterval(() => {
      if (!phoenixChannelConnected) {
        void loadSession();
      }
    }, 2500);

    return () => {
      window.clearInterval(fallbackInterval);
    };
  }, [loadSession, phoenixChannelConnected]);

  useEffect(() => {
    if (gameStatus !== "active" || !currentQuestion) return;

    setTimeLeft(getTimeLeft(currentQuestion, (session?.question_started_at as string) ?? null));

    const timer = setInterval(() => {
      setTimeLeft(getTimeLeft(currentQuestion, (session?.question_started_at as string) ?? null));
    }, 1000);

    return () => clearInterval(timer);
  }, [gameStatus, currentQuestion, session?.question_started_at]);

  useEffect(() => {
    if (!isHost || !hasActiveSessionKey || !currentQuestion || gameStatus !== "active") {
      phaseTransitionLock.current = false;
      return;
    }

    const everyoneAnswered =
      players.length > 0 && currentAnswers.length >= players.length;
    const shouldReveal =
      players.length > 0 && (everyoneAnswered || timeLeft <= 0);

    if (!shouldReveal || phaseTransitionLock.current) return;

    phaseTransitionLock.current = true;

    void (async () => {
      const scored = await revealCurrentQuestion();
      if (!scored) {
        phaseTransitionLock.current = false;
        return;
      }

      await loadSession();
    })();
  }, [
    currentAnswers.length,
    currentQuestion,
    gameStatus,
    isHost,
    loadSession,
    players.length,
    revealCurrentQuestion,
    hasActiveSessionKey,
    timeLeft,
  ]);

  const leaderboard = useMemo(
    () => [...players].sort((left, right) => (right.score ?? 0) - (left.score ?? 0)),
    [players]
  );

  const currentPlayer = playerSession?.playerId
    ? players.find((player) => player.id === playerSession.playerId) ?? null
    : null;
  const ownAnswer = playerSession?.playerId
    ? currentAnswers.find((answer) => answer.player_id === playerSession.playerId) ?? null
    : null;
  const answerCounts = currentQuestion?.answers?.map((answer) => ({
    ...answer,
    count: currentAnswers.filter((row) => row.answer_id === answer.id).length,
  })) ?? [];

  const startGame = async () => {
    if (
      !isHost ||
      gameStatus !== "waiting" ||
      !(session as { quiz?: { questions?: unknown[] } })?.quiz?.questions?.length
    ) {
      return;
    }

    try {
      if (isPhoenixGameEngine) {
        if (!hostSession?.hostToken) {
          throw new Error("Host session is invalid.");
        }

        await startPhoenixSession(pin, hostSession.hostToken);
      } else {
        const { error: startError } = await supabase.rpc("start_game_session", {
          p_session_id: (session as { id: string }).id,
        });

        if (startError) {
          throw startError;
        }
      }

      await loadSession();
    } catch (startError) {
      const msg = (startError as Error)?.message ?? "";
      console.error("Error starting game:", startError);
      if (msg === "Only the host can perform this action." || msg === "Host session is invalid.") {
        clearHostSession(pin);
        setHostSession(null);
        setError("Your host session expired. Return to host and launch the game again.");
      } else {
        setError("Could not start the game.");
      }
    }
  };

  const goToNextQuestion = async () => {
    if (
      !isHost ||
      gameStatus !== "reveal" ||
      !(session as { quiz?: { questions?: unknown[] } })?.quiz?.questions?.length
    ) {
      return;
    }

    try {
      if (isPhoenixGameEngine) {
        if (!hostSession?.hostToken) {
          throw new Error("Host session is invalid.");
        }

        await advancePhoenixSession(pin, hostSession.hostToken);
      } else {
        const { error: advanceError } = await supabase.rpc("advance_game_session", {
          p_session_id: (session as { id: string }).id,
        });

        if (advanceError) {
          throw advanceError;
        }
      }

      await loadSession();
    } catch (advanceError) {
      const msg = (advanceError as Error)?.message ?? "";
      console.error("Error advancing game:", advanceError);
      if (msg === "Only the host can perform this action." || msg === "Host session is invalid.") {
        clearHostSession(pin);
        setHostSession(null);
        setError("Your host session expired. Return to host and relaunch the session.");
      } else {
        setError("Could not move to the next question.");
      }
    }
  };

  const submitAnswer = async (answer: { id: string }) => {
    if (
      isHost ||
      !session ||
      !currentQuestion ||
      !currentPlayer ||
      !playerSession?.playerToken ||
      selectedAnswer ||
      submittingAnswer ||
      timeLeft <= 0
    ) {
      return;
    }

    setSubmittingAnswer(true);
    setNotice(null);
    setSelectedAnswer(answer.id);

    const questionStartedAt = (session as { question_started_at?: string }).question_started_at;
    const questionStart = questionStartedAt
      ? new Date(questionStartedAt).getTime()
      : Date.now();
    const responseTimeMs = Math.max(Date.now() - questionStart, 0);
    try {
      if (isPhoenixGameEngine) {
        await answerPhoenixSession(pin, {
          player_id: currentPlayer.id,
          player_token: playerSession.playerToken,
          answer_id: answer.id,
          response_time_ms: responseTimeMs,
        });
      } else {
        const { error: answerError } = await supabase.rpc("submit_player_answer", {
          p_player_id: currentPlayer.id,
          p_player_token: playerSession.playerToken,
          p_answer_id: answer.id,
          p_response_time_ms: responseTimeMs,
        });

        if (answerError) {
          throw answerError;
        }
      }

      await loadSession();
      setSubmittingAnswer(false);
    } catch (answerError) {
      const msg = (answerError as { message?: string; code?: string })?.message ?? "";
      const code = (answerError as { code?: string })?.code ?? "";
      console.error("Error submitting answer:", answerError);
      if (msg === "Player session is invalid.") {
        clearPlayerSession(pin);
        setPlayerSession(null);
        setNotice("Your player session expired. Rejoin the game from the PIN screen.");
      } else if (code === "23505" || msg === "Your answer is already locked in.") {
        setNotice("Your answer is already locked in.");
      } else if (msg === "Answer window has closed.") {
        setNotice("Time is up for this question.");
      } else {
        setNotice("Could not submit your answer. Please try again.");
      }
      await loadSession();
      setSubmittingAnswer(false);
      return;
    }
  };

  if (loading) {
    return <div className="container" style={{ paddingTop: "4rem", textAlign: "center" }}>Loading game...</div>;
  }

  if (error) {
    return (
      <div className="container" style={{ paddingTop: "4rem", textAlign: "center" }}>
        <div className="card" style={{ padding: "3rem", maxWidth: 480, margin: "0 auto" }}>
          <div style={{ fontSize: "2.5rem", marginBottom: "1rem" }}>😕</div>
          <p style={{ color: "var(--primary)", fontWeight: 700, marginBottom: "1.5rem" }}>
            {error}
          </p>
          <div style={{ display: "flex", gap: "1rem", justifyContent: "center", flexWrap: "wrap" }}>
            <Link href={`/join?pin=${pin}`} className="btn btn-primary">
              Try Another PIN
            </Link>
            <Link href="/" className="btn btn-secondary">
              Back to Home
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (gameStatus === "waiting") {
    return (
      <div className="container" style={{ paddingTop: "4rem", textAlign: "center" }}>
        {notice && (
          <div className="card" style={{ padding: "0.9rem 1rem", maxWidth: 640, margin: "0 auto 1rem", color: "var(--primary)", background: "var(--primary-light)" }}>
            {notice}
          </div>
        )}
        <div className="card" style={{ padding: "3rem", maxWidth: 640, margin: "0 auto" }}>
          <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>🎮</div>
          <h1 className="font-display" style={{ fontSize: "2rem", fontWeight: 800, marginBottom: "0.5rem" }}>
            Waiting for host...
          </h1>
          <p style={{ color: "var(--muted)", marginBottom: "2rem" }}>
            PIN: <strong>{pin}</strong> · {players.length} player{players.length !== 1 ? "s" : ""} joined
          </p>

          {players.length > 0 && (
            <div
              style={{
                display: "grid",
                gap: "0.5rem",
                marginBottom: "2rem",
                maxWidth: 400,
                marginLeft: "auto",
                marginRight: "auto",
              }}
            >
              {players.map((player) => (
                <div
                  key={player.id}
                  style={{
                    padding: "0.75rem 1rem",
                    borderRadius: "var(--radius-lg)",
                    background: "var(--bg)",
                    display: "flex",
                    alignItems: "center",
                    gap: "0.5rem",
                    fontWeight: 700,
                  }}
                >
                  <span>{player.avatar || "🎮"}</span>
                  <span>{player.nickname}</span>
                </div>
              ))}
            </div>
          )}

          {isHost && (
            <button
              onClick={() => void startGame()}
              disabled={players.length === 0}
              className="btn btn-primary btn-lg"
              style={{ width: "100%" }}
            >
              {players.length === 0 ? "Waiting for players..." : "Start Game 🚀"}
            </button>
          )}

          {!isHost && !currentPlayer && playerSessionReady && (
            <Link href={`/join?pin=${pin}`} className="btn btn-secondary">
              Join this game
            </Link>
          )}
        </div>
      </div>
    );
  }

  if (gameStatus === "active" && currentQuestion) {
    return (
      <div className="container" style={{ paddingTop: "3rem", paddingBottom: "5rem" }}>
        {notice && (
          <div className="card" style={{ padding: "0.9rem 1rem", maxWidth: 720, margin: "0 auto 1rem", color: "var(--primary)", background: "var(--primary-light)" }}>
            {notice}
          </div>
        )}
        <div className="card" style={{ padding: "2rem", maxWidth: 720, margin: "0 auto 2rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
            <span style={{ color: "var(--muted)", fontWeight: 700 }}>
              {currentQuestionIndexLabel(session)}
            </span>
            <span style={{ fontWeight: 900, fontSize: "1.5rem", color: timeLeft <= 5 ? "var(--primary)" : "var(--ink)" }}>
              {timeLeft}s
            </span>
          </div>
          <h2 className="font-display" style={{ fontSize: "1.75rem", fontWeight: 800 }}>
            {currentQuestion.text}
          </h2>
        </div>

        {isHost ? (
          <div className="card" style={{ padding: "1.5rem", maxWidth: 680, margin: "0 auto", textAlign: "center" }}>
            <p style={{ fontWeight: 700, marginBottom: "0.5rem" }}>
              {currentAnswers.length} of {players.length} players have answered.
            </p>
          </div>
        ) : !playerSessionReady || !currentPlayer ? (
          <div className="card" style={{ padding: "1.5rem", maxWidth: 680, margin: "0 auto", textAlign: "center" }}>
            <p style={{ fontWeight: 700, marginBottom: "0.5rem" }}>Spectator view</p>
            <p style={{ color: "var(--muted)", marginBottom: "1rem" }}>
              The game is already in progress. You can only join before a game starts.
              <br />
              Watch along or join the next session.
            </p>
            <Link href="/" className="btn btn-secondary">
              Back to Home
            </Link>
          </div>
        ) : (
          <div style={{ display: "grid", gap: "1rem", maxWidth: 680, margin: "0 auto" }}>
            {currentQuestion.answers?.map((answer, index) => (
              <button
                key={answer.id}
                onClick={() => void submitAnswer(answer)}
                disabled={selectedAnswer !== null || submittingAnswer || timeLeft <= 0}
                style={{
                  padding: "1.5rem",
                  borderRadius: "var(--radius-xl)",
                  border: "3px solid var(--line)",
                  background: selectedAnswer === answer.id ? "var(--accent)" : "var(--surface)",
                  color: selectedAnswer === answer.id ? "#fff" : "var(--ink)",
                  fontSize: "1.125rem",
                  fontWeight: 700,
                  cursor: selectedAnswer !== null ? "default" : "pointer",
                  textAlign: "left",
                  display: "flex",
                  alignItems: "center",
                  gap: "1rem",
                }}
              >
                <span
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: "50%",
                    background: selectedAnswer === answer.id ? "#fff" : "var(--bg)",
                    color: selectedAnswer === answer.id ? "var(--accent)" : "var(--muted)",
                    display: "grid",
                    placeItems: "center",
                    fontWeight: 900,
                  }}
                >
                  {String.fromCharCode(65 + index)}
                </span>
                {answer.text}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  if (gameStatus === "reveal" && currentQuestion) {
    return (
      <div className="container" style={{ paddingTop: "3rem", paddingBottom: "5rem" }}>
        {notice && (
          <div className="card" style={{ padding: "0.9rem 1rem", maxWidth: 720, margin: "0 auto 1rem", color: "var(--primary)", background: "var(--primary-light)" }}>
            {notice}
          </div>
        )}
        <div className="card" style={{ padding: "2rem", maxWidth: 720, margin: "0 auto 2rem" }}>
          <h2 className="font-display" style={{ fontSize: "1.75rem", fontWeight: 800, marginBottom: "0.5rem" }}>
            Answer Reveal
          </h2>
          <p style={{ color: "var(--muted)", marginBottom: "1.5rem" }}>{currentQuestion.text}</p>

          {!isHost && ownAnswer && (
            <div
              style={{
                padding: "1rem",
                borderRadius: "var(--radius-lg)",
                background: ownAnswer.is_correct ? "var(--accent-light)" : "var(--primary-light)",
                marginBottom: "1rem",
              }}
            >
              <strong>{ownAnswer.is_correct ? "Correct" : "Incorrect"}.</strong>{" "}
              You earned {ownAnswer.points_awarded ?? 0} points.
            </div>
          )}

          <div style={{ display: "grid", gap: "0.75rem", marginBottom: "1.5rem" }}>
            {answerCounts.map((answer, index) => (
              <div
                key={answer.id}
                style={{
                  padding: "1rem 1.25rem",
                  borderRadius: "var(--radius-lg)",
                  border: answer.is_correct ? "2px solid var(--accent)" : "1px solid var(--line)",
                  background: answer.is_correct ? "var(--accent-light)" : "var(--surface)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "1rem",
                }}
              >
                <span style={{ fontWeight: 700 }}>
                  {String.fromCharCode(65 + index)}. {answer.text}
                </span>
                <span style={{ color: "var(--muted)", fontWeight: 700 }}>
                  {answer.count} vote{answer.count !== 1 ? "s" : ""}
                </span>
              </div>
            ))}
          </div>

          <div>
            <h3 style={{ fontWeight: 800, marginBottom: "1rem" }}>Leaderboard</h3>
            <div style={{ display: "grid", gap: "0.75rem" }}>
              {leaderboard.map((player, index) => (
                <div
                  key={player.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "0.9rem 1rem",
                    borderRadius: "var(--radius-lg)",
                    background: "var(--bg)",
                  }}
                >
                  <span style={{ fontWeight: 700 }}>
                    {index + 1}. {player.avatar || "🎮"} {player.nickname}
                  </span>
                  <span style={{ color: "var(--muted)", fontWeight: 700 }}>
                    {(player.score ?? 0).toLocaleString()} pts
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {isHost && (
          <div style={{ textAlign: "center" }}>
            <button onClick={() => void goToNextQuestion()} className="btn btn-primary btn-lg">
              {((session?.current_question_index as number) ?? 0) >=
              (((session?.quiz as { questions?: unknown[] })?.questions?.length ?? 1) - 1)
                ? "Finish Game"
                : "Next Question"}
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="container" style={{ paddingTop: "4rem", paddingBottom: "5rem", textAlign: "center" }}>
      {notice && (
        <div className="card" style={{ padding: "0.9rem 1rem", maxWidth: 640, margin: "0 auto 1rem", color: "var(--primary)", background: "var(--primary-light)" }}>
          {notice}
        </div>
      )}
      <div className="card" style={{ padding: "3rem", maxWidth: 640, margin: "0 auto" }}>
        <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>🏆</div>
        <h1 className="font-display" style={{ fontSize: "2rem", fontWeight: 800, marginBottom: "1rem" }}>
          Game Finished
        </h1>
        <p style={{ color: "var(--muted)", marginBottom: "2rem" }}>
          Final leaderboard for PIN {pin}
        </p>

        <div style={{ display: "grid", gap: "0.75rem", marginBottom: "2rem" }}>
          {leaderboard.map((player, index) => (
            <div
              key={player.id}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "1rem 1.25rem",
                borderRadius: "var(--radius-lg)",
                background: "var(--bg)",
              }}
            >
              <span style={{ fontWeight: 700 }}>
                {index + 1}. {player.avatar || "🎮"} {player.nickname}
              </span>
              <span style={{ color: "var(--muted)", fontWeight: 700 }}>
                {(player.score ?? 0).toLocaleString()} pts
              </span>
            </div>
          ))}
        </div>

        <div style={{ display: "flex", gap: "1rem", justifyContent: "center", flexWrap: "wrap" }}>
          <Link href="/" className="btn btn-secondary">
            Back to Home
          </Link>
        </div>
      </div>
    </div>
  );
}

function currentQuestionIndexLabel(session: Record<string, unknown> | null) {
  const index = ((session?.current_question_index as number) ?? 0) + 1;
  const total = (session?.quiz as { questions?: unknown[] })?.questions?.length ?? 0;
  return `Question ${index} of ${total}`;
}
