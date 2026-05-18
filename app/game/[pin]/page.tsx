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
} from "@/components/game/live-game-panels";
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
import { gameJoinUrl } from "@/lib/config/public";
import { extractYouTubeId } from "@/lib/media/youtube";
import {
  getTimeLeft,
  normalizePhoenixSession,
  sortQuizQuestions,
  type CurrentAnswer,
  type GamePlayer,
  type GameQuestion,
  type GameStatus,
  type QuestionHistoryEntry,
} from "@/lib/game/session-normalizers";
import { useGameAudio } from "@/lib/game/use-game-audio";
import {
  calculatePlayerAchievements,
  countCorrectAnswersByPlayer,
  sortLeaderboard,
} from "@/lib/game/game-analytics";

export default function GamePage() {
  const params = useParams();
  const { user } = useAuth();
  const pin = params.pin as string;

  const [session, setSession] = useState<Record<string, unknown> | null>(null);
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
  const [phoenixChannelConnected, setPhoenixChannelConnected] = useState(false);
  const phaseTransitionLock = useRef(false);
  const revealRequestLock = useRef(false);
  // Feature 5: Ready-up
  const [readyPlayers, setReadyPlayers] = useState<Set<string>>(new Set());
  const [amReady, setAmReady] = useState(false);
  // Feature 6: Streak tracking
  const [playerStreaks, setPlayerStreaks] = useState<Record<string, number>>({});
  // Feature 13: Reactions
  const [reactions, setReactions] = useState<{id: string; emoji: string; x: number; ts: number}[]>([]);
  const reactionIdRef = useRef(0);
  // Achievements
  const [achievements, setAchievements] = useState<Record<string, string[]>>({});
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
      }[]
    ) => {
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
    }, 5000);

    return () => {
      window.clearInterval(fallbackInterval);
    };
  }, [loadSession, phoenixChannelConnected]);

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
    // Feature 12: Play correct/wrong sound
    if (ownAnswer) { ownAnswer.is_correct ? playCorrect() : playWrong(); }
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

  // Feature 13: Send reaction
  const sendReaction = useCallback((emoji: string) => {
    const id = String(++reactionIdRef.current);
    const x = 10 + Math.random() * 80;
    setReactions(prev => [...prev, { id, emoji, x, ts: Date.now() }]);
    setTimeout(() => setReactions(prev => prev.filter(r => r.id !== id)), 2500);
  }, []);

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
      const summaryData = {
        quiz_title: (session as any)?.quiz?.title || 'Quiz',
        total_players: players.length,
        total_questions: totalQuestions,
        avg_score: players.length > 0 ? Math.round(players.reduce((s, p) => s + (p.score ?? 0), 0) / players.length) : 0,
        leaderboard: leaderboard.slice(0, 5).map(p => ({ nickname: p.nickname, score: p.score ?? 0, correct: playerCorrectCounts[p.id] ?? 0 })),
        question_stats: questionHistory.map(qh => ({
          text: qh.text,
          correct_pct: qh.responses ? Math.round(qh.responses.filter(r => r.is_correct).length / qh.responses.length * 100) : 0,
          avg_time: qh.responses ? Math.round(qh.responses.reduce((s, r) => s + r.response_time_ms, 0) / qh.responses.length / 1000 * 10) / 10 : 0,
        })),
      };
      const res = await fetch('/api/ai-source-draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceText: `Analyze this quiz game result and provide 3-4 short insights for the host. Be concise and actionable.\n\nGame data: ${JSON.stringify(summaryData)}`,
          sourceTitle: 'Quiz Analytics',
          questionCount: 1,
        }),
      });
      const data = await res.json();
      if (data.draft?.title) setAiSummary(data.draft.title);
      else setAiSummary('AI analysis unavailable right now.');
    } catch {
      setAiSummary('Could not generate AI summary.');
    }
    setAiSummaryLoading(false);
  }, [aiSummary, aiSummaryLoading, session, players, totalQuestions, leaderboard, playerCorrectCounts, questionHistory]);

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
          await supabase.rpc("finish_game_and_record_results", {
            p_session_id: (session as { id: string }).id,
          });
        }
      } else {
        if (isLastQuestion) {
          // Finish + record results in one call
          const { error: finishError } = await supabase.rpc("finish_game_and_record_results", {
            p_session_id: (session as { id: string }).id,
          });
          if (finishError) throw finishError;
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

    // Immediate visual feedback — look up the full answer from currentQuestion to get is_correct
    const fullAnswer = currentQuestion.answers?.find((a) => a.id === answer.id);
    const isCorrect = fullAnswer?.is_correct === true;
    setAnswerFeedback(isCorrect ? "correct" : "wrong");
    window.setTimeout(() => setAnswerFeedback(null), 800);

    // Score pop on correct answer
    if (isCorrect && timeLeft > 0) {
      const timeFraction = Math.min(1, timeLeft / Math.max(currentQuestion.time_limit ?? 20, 1));
      const pts = Math.round(500 + timeFraction * 500);
      setScorePop(pts);
      window.setTimeout(() => setScorePop(null), 1200);
    }

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
          <div className={`game-feedback-overlay ${answerFeedback === "correct" ? "is-correct" : "is-wrong"}`}>
            <div className="game-feedback-icon">{answerFeedback === "correct" ? "✅" : "❌"}</div>
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
            <span className={timeLeft <= 5 ? "game-timer is-critical" : "game-timer is-normal"}>
              {timeLeft}s
            </span>
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
            <SurvivalStatusBar
              aliveCount={aliveCount}
              totalPlayers={players.length}
              eliminated={eliminated}
              myPlayerId={playerSession?.playerId ?? null}
            />
          )}
          {gameMode === "team" && Object.keys(teams).length > 0 ? (
            <TeamLeaderboard teams={teams} players={players} teamAssignments={teamAssignments} />
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
    />
  );
}

function currentQuestionIndexLabel(session: Record<string, unknown> | null) {
  const index = ((session?.current_question_index as number) ?? 0) + 1;
  const total = (session?.quiz as { questions?: unknown[] })?.questions?.length ?? 0;
  return `Question ${index} of ${total}`;
}
