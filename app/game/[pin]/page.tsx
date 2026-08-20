"use client";

import Link from "next/link";
import { GameErrorPanel, GameLoadingPanel, GameStatePanel } from "@/components/game/game-state-panel";
import {
  ActiveHostDashboard,
  AnswerRevealList,
  GameFinishedPanel,
  GameNotice,
  GameProgressBar,
  LeaderboardList,
  PlayerAnswerGrid,
  QuestionMedia,
  SpectatorPanel,
  SurvivalStatusBar,
  TeamScoreBar,
  TeamLeaderboard,
  WaitingLobbyPanel,
} from "@/components/game";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
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
import {
  clearPlayerSession,
  readPlayerSession,
  shouldDiscardPlayerSession,
  type StoredPlayerSession,
} from "@/lib/player-session";
import {
  clearHostSession,
  readHostSession,
  type StoredHostSession,
} from "@/lib/host-session";
import { gameJoinUrl } from "@/lib/config/public";
import { extractYouTubeId } from "@/lib/media/youtube";
import {
  getTimeLeft,
  normalizePhoenixSession,
  shouldApplySessionSnapshot,
  sortQuizQuestions,
  type CurrentAnswer,
  type GamePlayer,
  type GameQuestion,
  type GameStatus,
  type QuestionHistoryEntry,
} from "@/lib/game/session-normalizers";
import { useGameAudio } from "@/lib/game/use-game-audio";
import { usePhoenixGameChannel } from "@/lib/game/use-phoenix-game-channel";
import {
  calculatePlayerAchievements,
  countCorrectAnswersByPlayer,
  sortLeaderboard,
} from "@/lib/game/game-analytics";

export default function GamePage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const pin = params.pin as string;

  const [session, setSession] = useState<Record<string, unknown> | null>(null);
  const sessionRef = useRef<Record<string, unknown> | null>(null); // always tracks latest session for staleness checks
  const [players, setPlayers] = useState<GamePlayer[]>([]);
  const [currentAnswers, setCurrentAnswers] = useState<CurrentAnswer[]>([]);
  const [questionHistory, setQuestionHistory] = useState<QuestionHistoryEntry[]>([]);
  const [gameStatus, setGameStatus] = useState<GameStatus>("waiting");
  const [currentQuestion, setCurrentQuestion] = useState<GameQuestion | null>(null);
  const [timeLeft, setTimeLeft] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [submittingAnswer, setSubmittingAnswer] = useState(false);
  const [answerFeedback, setAnswerFeedback] = useState<"correct" | "wrong" | null>(null);
  const [scorePop, setScorePop] = useState<number | null>(null);
  const [questionKey, setQuestionKey] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [playerSession, setPlayerSession] = useState<StoredPlayerSession | null>(null);
  const [hostSession, setHostSession] = useState<StoredHostSession | null>(null);
  const [playerSessionReady, setPlayerSessionReady] = useState(false);
  const phaseTransitionLock = useRef(false);
  const revealRequestLock = useRef(false);
  // Feature 5: Ready-up
  const [readyPlayers, setReadyPlayers] = useState<Set<string>>(new Set());
  const [amReady, setAmReady] = useState(false);
  // Feature 6: Streak tracking
  const [playerStreaks, setPlayerStreaks] = useState<Record<string, number>>({});
  // AI Summary
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [aiSummaryLoading, setAiSummaryLoading] = useState(false);
  const { playCorrect, playWrong, playTick, playFanfare } = useGameAudio();
  const isHost = isPhoenixGameEngine
    ? !!user?.id && !!hostSession && hostSession.hostId === user.id
    : !!user?.id && session?.host_id === user.id;
  const hasActiveSessionKey = isPhoenixGameEngine
    ? !!(session as { pin?: string })?.pin
    : !!(session as { id?: string })?.id;

  if (liveGameEngineMisconfigured) {
    return (
      <GameStatePanel
        icon="⚙️"
        title="Live Games Unavailable"
        message="The live game service isn't reachable right now. Please try again shortly."
      />
    );
  }

  if (legacySupabaseGameEngine) {
    return (
      <GameStatePanel
        icon="🛑"
        title="Live Games Unavailable"
        message="Live multiplayer games are temporarily unavailable. Please check back shortly."
      />
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
      }[],
      options: { allowEqual?: boolean } = {}
    ) => {
      // Staleness guard: never apply an older snapshot over a newer one.
      // Prevents REST responses from racing against WS broadcasts and overwriting fresher state.
      if (!shouldApplySessionSnapshot(sessionRef.current, rawSession, options)) return;

      const normalizedSession = (
        isPhoenixGameEngine
          ? normalizePhoenixSession(rawSession)
          : {
              ...rawSession,
              quiz: sortQuizQuestions((rawSession as { quiz?: unknown }).quiz),
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
      sessionRef.current = normalizedSession as Record<string, unknown>;
      setPlayers(nextPlayers);
      setCurrentAnswers(nextAnswers);
      setGameStatus(((normalizedSession.status as string) ?? "waiting") as GameStatus);
      setCurrentQuestion(nextQuestion);
      setQuestionKey(nextQuestion?.id ?? "");
      setQuestionHistory((normalizedSession.question_history as typeof questionHistory) ?? []);
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
        applySessionSnapshot(response.session, undefined, { allowEqual: true });
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
      quiz: sortQuizQuestions(gameSession.quiz),
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
      nextAnswers,
      { allowEqual: true }
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
      .catch((reconnectError) => {
        if (shouldDiscardPlayerSession(reconnectError)) {
          clearPlayerSession(pin);
          setPlayerSession(null);
        }
      });
  }, [pin, playerSession, playerSessionReady, applySessionSnapshot]);

  const revealCurrentQuestion = useCallback(async () => {
    if (!isHost || !session) return false;
    if (gameStatus !== "active") return true;
    if (revealRequestLock.current) return true;

    revealRequestLock.current = true;

    try {
      if (isPhoenixGameEngine) {
        if (!hostSession?.hostToken) {
          throw new Error("Host session is invalid.");
        }

        const response = await revealPhoenixSession(pin, hostSession.hostToken) as { session?: Record<string, unknown> };
        if (response?.session) applySessionSnapshot(response.session);
      } else {
        const { error: revealError } = await supabase.rpc("reveal_current_question", {
          p_session_id: (session as { id?: string }).id,
        });

        if (revealError) {
          throw revealError;
        }

        await loadSession();
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
    } finally {
      revealRequestLock.current = false;
    }
  }, [applySessionSnapshot, gameStatus, hostSession?.hostToken, isHost, loadSession, pin, session]);

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

  const phoenixChannelConnected = usePhoenixGameChannel({
    enabled: isPhoenixGameEngine,
    pin,
    onSnapshot: applySessionSnapshot,
    loadSnapshot: loadSession,
  });

  // Show reconnecting notice when WS drops mid-game
  // Use a delay so we don't flash the notice during normal initial connection
  useEffect(() => {
    if (!isPhoenixGameEngine) return;
    if (phoenixChannelConnected) {
      // Connected — clear the notice if it was showing
      setNotice((prev) => prev === "🔄 Reconnecting to game server..." ? null : prev);
      return;
    }
    if (loading || gameStatus === "finished") return;
    // Only show after 4 seconds of no connection — avoids false alarm on page load
    const timer = setTimeout(() => {
      setNotice("🔄 Reconnecting to game server...");
    }, 4000);
    return () => clearTimeout(timer);
  }, [phoenixChannelConnected, loading, gameStatus]);

  // Feature 6: Update streaks when reveal happens
  useEffect(() => {
    if (gameStatus !== "reveal" || !currentAnswers.length) return;
    setPlayerStreaks(prev => {
      const next = { ...prev };
      for (const ans of currentAnswers) {
        if (ans.is_correct) next[ans.player_id] = (next[ans.player_id] || 0) + 1;
        else next[ans.player_id] = 0;
      }
      return next;
    });
    // Feature 12: Play correct/wrong sound + show feedback flash on reveal
    if (ownAnswer) {
      const correct = ownAnswer.is_correct;
      correct ? playCorrect() : playWrong();
      // Show correct/wrong flash NOW that Phoenix has confirmed the answer
      setAnswerFeedback(correct ? "correct" : "wrong");
      window.setTimeout(() => setAnswerFeedback(null), 1200);
      // Score pop on correct
      if (correct) {
        const tl = typeof ownAnswer.response_time_ms === "number"
          ? Math.max(0, ((currentQuestion?.time_limit ?? 20) * 1000 - ownAnswer.response_time_ms) / 1000)
          : 0;
        const timeFraction = Math.min(1, tl / Math.max(currentQuestion?.time_limit ?? 20, 1));
        const pts = Math.round(500 + timeFraction * 500);
        setScorePop(pts);
        window.setTimeout(() => setScorePop(null), 1500);
      }
    }
  }, [gameStatus]);

  // Feature 12: Tick sound in last 5 seconds
  useEffect(() => {
    if (gameStatus !== "active" || timeLeft > 5 || timeLeft <= 0) return;
    playTick();
  }, [timeLeft, gameStatus]);

  // Clear transient animations when question changes
  useEffect(() => {
    setAnswerFeedback(null);
    setScorePop(null);
  }, [questionKey]);

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

    // In survival mode, eliminated players can't answer — use aliveCount not players.length
    const expectedAnswers = gameMode === "survival" ? aliveCount : players.length;
    const everyoneAnswered =
      expectedAnswers > 0 && currentAnswers.length >= expectedAnswers;
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

  // Feature 12: Fanfare on finish
  useEffect(() => {
    if (gameStatus === "finished") playFanfare();
  }, [gameStatus]);

  const totalQuestions = useMemo(() => ((session?.quiz as { questions?: unknown[] })?.questions?.length ?? 0), [session]);
  const currentIndex = ((session?.current_question_index as number) ?? 0);

  // Feature 1: Correct count per player from history + current answers
  const playerCorrectCounts = useMemo(
    () => countCorrectAnswersByPlayer(questionHistory, currentAnswers, gameStatus === "reveal"),
    [questionHistory, currentAnswers, gameStatus]
  );

  // Feature 10: Question breakdown
  const correctCountThisQ = currentAnswers.filter(a => a.is_correct).length;
  const totalAnsweredThisQ = currentAnswers.length;

  const leaderboard = useMemo(() => sortLeaderboard(players), [players]);

  // Mode-specific derived state
  const typedSession = session as import("@/lib/game/session-normalizers").PhoenixSessionSnapshot | null;
  const gameMode = typedSession?.game_mode ?? "classic";
  const eliminated = (typedSession?.eliminated ?? []) as string[];
  const aliveCount = typedSession?.alive_count ?? players.length;
  const teams = (typedSession?.teams ?? {}) as Record<string, { id: string; name: string; color: string; emoji: string; score: number }>;
  const teamAssignments = (typedSession?.team_assignments ?? {}) as Record<string, string>;
  const myTeamId = playerSession?.playerId ? (teamAssignments[playerSession.playerId] ?? null) : null;
  const isEliminated = playerSession?.playerId ? eliminated.includes(playerSession.playerId) : false;

  // Calculate achievements from game data
  const playerAchievements = useMemo(
    () => calculatePlayerAchievements({
      players,
      playerCorrectCounts,
      playerStreaks,
      questionHistory,
      leaderboard,
      totalQuestions,
    }),
    [players, playerCorrectCounts, playerStreaks, questionHistory, leaderboard, totalQuestions]
  );

  // AI post-game summary
  const generateAiSummary = useCallback(async () => {
    if (aiSummary || aiSummaryLoading) return;
    setAiSummaryLoading(true);
    try {
      const totalAnswers = players.length > 0
        ? players.reduce((s, p) => s + (playerCorrectCounts[p.id] ?? 0), 0)
        : 0;
      const avgAccuracy = players.length > 0 && totalQuestions > 0
        ? Math.round(totalAnswers / (players.length * totalQuestions) * 100)
        : 0;
      const teamList = Object.values(teams).sort((a, b) => b.score - a.score);
      const gameData = {
        game_mode: gameMode,
        quiz_title: (session as any)?.quiz?.title || "Quiz",
        total_players: players.length,
        total_questions: totalQuestions,
        avg_score: players.length > 0 ? Math.round(players.reduce((s, p) => s + (p.score ?? 0), 0) / players.length) : 0,
        avg_accuracy: avgAccuracy,
        leaderboard: leaderboard.slice(0, 5).map(p => ({ nickname: p.nickname, score: p.score ?? 0, correct: playerCorrectCounts[p.id] ?? 0 })),
        question_stats: questionHistory.map(qh => ({
          text: qh.text,
          correct_pct: qh.responses?.length ? Math.round(qh.responses.filter(r => r.is_correct).length / qh.responses.length * 100) : 0,
          avg_time: qh.responses?.length ? Math.round(qh.responses.reduce((s, r) => s + r.response_time_ms, 0) / qh.responses.length / 100) / 10 : 0,
        })),
        // Game mode specific
        eliminated: gameMode === "survival" ? eliminated : [],
        teams: gameMode === "team" ? teamList.map(t => ({ name: t.name, emoji: t.emoji, score: t.score })) : [],
      };
      const res = await fetch("/api/ai-game-insights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gameData }),
      });
      const data = await res.json() as { insights?: string; error?: string };
      if (data.insights) setAiSummary(data.insights);
      else setAiSummary(data.error || "AI analysis unavailable right now.");
    } catch {
      setAiSummary("Could not generate AI summary.");
    }
    setAiSummaryLoading(false);
  }, [aiSummary, aiSummaryLoading, session, players, totalQuestions, leaderboard, playerCorrectCounts, questionHistory, gameMode, eliminated, teams]);

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

        const response = await startPhoenixSession(pin, hostSession.hostToken) as { session?: Record<string, unknown> };
        if (response?.session) applySessionSnapshot(response.session);
      } else {
        const { error: startError } = await supabase.rpc("start_game_session", {
          p_session_id: (session as { id: string }).id,
        });

        if (startError) {
          throw startError;
        }

        await loadSession();
      }
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

    const questions = (session as { quiz?: { questions?: unknown[] } })?.quiz?.questions ?? [];
    const currentIndex = (session as { current_question_index?: number })?.current_question_index ?? 0;
    const isLastQuestion = currentIndex >= questions.length - 1;

    try {
      if (isPhoenixGameEngine) {
        if (!hostSession?.hostToken) {
          throw new Error("Host session is invalid.");
        }

        const response = await advancePhoenixSession(pin, hostSession.hostToken) as { session?: Record<string, unknown> };
        if (response?.session) applySessionSnapshot(response.session);

        // Record game results after Phoenix advance
        if (isLastQuestion) {
          // Phoenix sessions use pin-based results — write a game_results row directly
          // (finish_game_and_record_results expects a Supabase DB session id, which
          // Phoenix sessions don't have, so we upsert the row ourselves)
          const phoenixPlayers = (response?.session as any)?.players ?? (session as any)?.players ?? {};
          const phoenixPlayerList = Array.isArray(phoenixPlayers) ? phoenixPlayers : Object.values(phoenixPlayers);
          const hostUserId = user?.id;
          if (hostUserId) {
            const topScore = phoenixPlayerList.reduce((max: number, p: any) => Math.max(max, p.score ?? 0), 0);
            await supabase.from('game_results').upsert({
              pin: pin,
              quiz_id: (session as any)?.quiz_id ?? (session as any)?.quiz?.id ?? null,
              host_id: hostUserId,
              player_id: hostUserId,
              player_count: phoenixPlayerList.length,
              score: topScore,
              correct: phoenixPlayerList[0]?.correct ?? 0,
              answered: phoenixPlayerList[0]?.answered ?? 0,
              finished_at: new Date().toISOString(),
              results: { players: phoenixPlayerList, finished_status: 'finished' },
            }, { onConflict: 'pin,player_id', ignoreDuplicates: true }).then(({ error: grErr }) => {
              if (grErr) console.warn('game_results upsert failed:', grErr.message);
            });
            // Award XP for completing a game (50 XP)
            await supabase.rpc('increment_xp', { user_uuid: hostUserId, xp_amount: 50 })
              .then(({ error: xpErr }) => { if (xpErr) console.warn('XP award failed:', xpErr.message); });
          }
        }
      } else {
        if (isLastQuestion) {
          // Finish + record results in one call
          const { error: finishError } = await supabase.rpc("finish_game_and_record_results", {
            p_session_id: (session as { id: string }).id,
          });
          if (finishError) throw finishError;
          // Award XP for completing a game (50 XP)
          if (user?.id) {
            await supabase.rpc('increment_xp', { user_uuid: user.id, xp_amount: 50 })
              .then(({ error: xpErr }) => { if (xpErr) console.warn('XP award failed:', xpErr.message); });
          }
        } else {
          const { error: advanceError } = await supabase.rpc("advance_game_session", {
            p_session_id: (session as { id: string }).id,
          });
          if (advanceError) throw advanceError;
        }

        await loadSession();
      }
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

    // Don't show correct/wrong flash on click — Phoenix strips is_correct during "active"
    // phase for security, so fullAnswer.is_correct is always undefined here.
    // Correct/wrong feedback fires in the reveal-phase useEffect once Phoenix sends the result.

    const questionStartedAt = (session as { question_started_at?: string }).question_started_at;
    const questionStart = questionStartedAt
      ? new Date(questionStartedAt).getTime()
      : Date.now();
    const responseTimeMs = Math.max(Date.now() - questionStart, 0);
    try {
      if (isPhoenixGameEngine) {
        const response = await answerPhoenixSession(pin, {
          player_id: currentPlayer.id,
          player_token: playerSession.playerToken,
          answer_id: answer.id,
          response_time_ms: responseTimeMs,
        }) as { session?: Record<string, unknown> };
        if (response?.session) applySessionSnapshot(response.session);
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

        await loadSession();
      }

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

  if (loading) return <GameLoadingPanel />;

  if (error) return <GameErrorPanel error={error} pin={pin} />;

  if (gameStatus === "waiting") {
    const joinUrl = gameJoinUrl(pin);
    const readyCount = readyPlayers.size;
    return (
      <>
        <WaitingLobbyPanel
          pin={pin}
          joinUrl={joinUrl}
          notice={notice}
          players={players}
          readyPlayers={readyPlayers}
          readyCount={readyCount}
          isHost={isHost}
          currentPlayer={currentPlayer}
          playerSessionReady={playerSessionReady}
          amReady={amReady}
          gameMode={gameMode}
          onReady={() => {
            setAmReady(true);
            setReadyPlayers((prev) => new Set(prev).add(playerSession?.playerId ?? ""));
          }}
          onStart={() => void startGame()}
        />
        {gameMode === "survival" && (
          <div className="container"><div className="game-mode-lobby-badge game-mode-lobby-badge--survival">
            <span>💀 Survival Mode</span>
            <span className="game-mode-lobby-desc">One wrong answer and you&apos;re out!</span>
          </div></div>
        )}
        {gameMode === "team" && (
          <div className="container"><div className="game-mode-lobby-badge game-mode-lobby-badge--team">
            <span>👥 Team Battle</span>
            <span className="game-mode-lobby-desc">Teams will be auto-assigned when the game starts</span>
          </div></div>
        )}
      </>
    );
  }

  if (gameStatus === "active" && currentQuestion) {
    return (
      <div className="container game-container">
        {/* Answer feedback flash overlay */}
        {answerFeedback && (
          <div className={`game-feedback-overlay ${answerFeedback === "correct" ? "is-correct" : answerFeedback === "wrong" ? "is-wrong" : "is-pending"}`}>
            <div className="game-feedback-icon">{answerFeedback === "correct" ? "✅" : answerFeedback === "wrong" ? "❌" : "✓"}</div>
          </div>
        )}
        {/* Score pop */}
        {scorePop !== null && (
          <div className="game-score-pop">+{scorePop} pts</div>
        )}

        <GameNotice notice={notice} />
        <GameProgressBar currentIndex={currentIndex} totalQuestions={totalQuestions} />

        <div key={questionKey} className="card game-question-card game-question-enter">
          <div className="game-question-header">
            <span className="game-question-label">
              {currentQuestionIndexLabel(session)}
            </span>
            {!isEliminated && (
              <span className={timeLeft <= 5 ? "game-timer is-critical" : "game-timer is-normal"}>
                {timeLeft}s
              </span>
            )}
          </div>
          <h2 className="font-display game-question-title">
            {currentQuestion.text}
          </h2>
          <QuestionMedia question={currentQuestion} />
        </div>

        {/* Feature 9: Host controls */}
        {isHost && (
          <div className="game-host-controls">
            <button
              onClick={() => { void revealCurrentQuestion(); }}
              className="btn btn-secondary btn-compact game-skip-btn"
            >
              ⏭ Skip Question
            </button>
          </div>
        )}

        {isHost ? (
          <ActiveHostDashboard
            currentAnswers={currentAnswers}
            players={players}
            currentQuestion={currentQuestion}
            timeLeft={timeLeft}
            gameMode={gameMode}
            teams={teams}
            teamAssignments={teamAssignments}
            aliveCount={aliveCount}
          />
        ) : !playerSessionReady || !currentPlayer ? (
          <SpectatorPanel />
        ) : isEliminated ? (
          <SurvivalStatusBar
            aliveCount={aliveCount}
            totalPlayers={players.length}
            eliminated={eliminated}
            myPlayerId={playerSession?.playerId ?? null}
          />
        ) : (
          <PlayerAnswerGrid
            currentQuestion={currentQuestion}
            selectedAnswer={selectedAnswer}
            submittingAnswer={submittingAnswer}
            timeLeft={timeLeft}
            myTeam={myTeamId && teams[myTeamId] ? teams[myTeamId] : null}
            onSubmit={(answer) => void submitAnswer(answer)}
          />
        )}
        {/* Survival: show alive count to all players */}
        {gameMode === "survival" && !isEliminated && (
          <SurvivalStatusBar
            aliveCount={aliveCount}
            totalPlayers={players.length}
            eliminated={eliminated}
            myPlayerId={playerSession?.playerId ?? null}
          />
        )}
        {/* Team Battle: show team scores */}
        {gameMode === "team" && Object.keys(teams).length > 0 && (
          <TeamScoreBar teams={teams} myTeamId={myTeamId} />
        )}
      </div>
    );
  }

  if (gameStatus === "reveal" && currentQuestion) {
    return (
      <div className="container game-container">
        <GameNotice notice={notice} />
        <GameProgressBar currentIndex={currentIndex} totalQuestions={totalQuestions} compact />
        <div className="card game-question-card">
          <h2 className="font-display game-question-title">
            Answer Reveal
          </h2>
          <p className="game-question-text">{currentQuestion.text}</p>
          {/* Feature 10: Question breakdown */}
          <div className="game-stats-bar">
            {correctCountThisQ}/{totalAnsweredThisQ} correct ({totalAnsweredThisQ > 0 ? Math.round((correctCountThisQ / totalAnsweredThisQ) * 100) : 0}%)
          </div>
          <QuestionMedia question={currentQuestion} maxHeight={200} margin="0" />

          {!isHost && ownAnswer && (
            <div
              className={ownAnswer.is_correct ? "game-own-answer is-correct" : "game-own-answer is-incorrect"}
            >
              <strong>{ownAnswer.is_correct ? "✅ Correct" : "❌ Incorrect"}</strong>{" "}
              You earned {ownAnswer.points_awarded ?? 0} points.
              {(() => { const myRt = currentAnswers.find(a => a.player_id === playerSession?.playerId) as any; return myRt?.response_time_ms ? <span className="game-response-time">Answered in {(myRt.response_time_ms / 1000).toFixed(1)}s ⚡</span> : null; })()}
              {(playerStreaks[playerSession?.playerId ?? ''] ?? 0) >= 2 && <div className="game-streak">🔥 {playerStreaks[playerSession?.playerId ?? '']} in a row!</div>}
            </div>
          )}

          <AnswerRevealList answerCounts={answerCounts} />

          {/* Mode-specific reveal panels */}
          {gameMode === "survival" && (
            <>
              <SurvivalStatusBar
                aliveCount={aliveCount}
                totalPlayers={players.length}
                eliminated={eliminated}
                myPlayerId={playerSession?.playerId ?? null}
              />
              {eliminated.length > 0 && (
                <div className="survival-eliminated-list">
                  <span className="survival-eliminated-list-label">💨 Eliminated:</span>
                  {players
                    .filter(p => eliminated.includes(p.id))
                    .map(p => (
                      <span key={p.id} className="survival-eliminated-chip">
                        {p.avatar || "🎮"} {p.nickname}
                      </span>
                    ))}
                </div>
              )}
            </>
          )}
          {gameMode === "team" && Object.keys(teams).length > 0 ? (
            <TeamLeaderboard teams={teams} players={players} teamAssignments={teamAssignments} myTeamId={myTeamId} />
          ) : (
            <LeaderboardList
              leaderboard={leaderboard}
              playerStreaks={playerStreaks}
              playerAchievements={playerAchievements}
              playerCorrectCounts={playerCorrectCounts}
              totalQuestions={totalQuestions}
            />
          )}
        </div>

        {isHost && (
          <div className="game-next-area">
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
    <GameFinishedPanel
      notice={notice}
      pin={pin}
      leaderboard={leaderboard}
      isHost={isHost}
      session={session}
      playerAchievements={playerAchievements}
      playerCorrectCounts={playerCorrectCounts}
      totalQuestions={totalQuestions}
      aiSummary={aiSummary}
      aiSummaryLoading={aiSummaryLoading}
      onGenerateAiSummary={() => void generateAiSummary()}
      gameMode={gameMode}
      teams={teams}
      teamAssignments={teamAssignments}
      eliminated={eliminated}
      myTeamId={myTeamId}
      onPlayAgain={() => {
        const quizId = (session as any)?.quiz_id ?? (session as any)?.quiz?.id;
        router.push(quizId ? `/host?quiz=${quizId}` : '/host');
      }}
    />
  );
}

function currentQuestionIndexLabel(session: Record<string, unknown> | null) {
  const index = ((session?.current_question_index as number) ?? 0) + 1;
  const total = (session?.quiz as { questions?: unknown[] })?.questions?.length ?? 0;
  return `Question ${index} of ${total}`;
}
