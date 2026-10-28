"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import type { Slide, SlideResponse, QnaQuestion } from "@/lib/presentation/types";
import { getParticipantName } from "@/lib/presentation/types";
import { activityMatchesSlide, normalizePresentationActivity, summarizePresentationActivity } from "@/lib/presentation/runtime";
import { subscribeToPresentation } from "@/lib/presentation/presentation-socket";
import { applyPresentationSnapshot, type PresentationSnapshotState } from "@/lib/presentation/snapshot";
import type { PresentationCommandOutcome } from "@/lib/presentation/command-outcome";
import {
  fetchPhoenixPresentation,
  fetchPhoenixSlideActivity,
  readParticipantSession,
  readPresenterToken,
  type PresentationParticipantSession,
} from "@/lib/presentation/client";
import { presentationJoinUrl } from "@/lib/config/public";
import { HostDock, JoinOverlay, LiveStatusRail } from "@/components/present/live/live-status-panels";
import { presentationCommandNotice } from "@/lib/presentation/command-notice";
import { choiceFromPayload, ownChoiceFrom } from "@/lib/presentation/own-choice";
import { LiveSlideStage } from "@/components/present/live/live-slide-stage";
import { PresentationLiveGuard } from "@/components/present/live/live-route-guards";

export function PresentationLiveSession({ code, userId }: { code: string; userId?: string }) {
  const router = useRouter();

  const [title, setTitle] = useState(""); const [slides, setSlides] = useState<Slide[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0); const [isHost, setIsHost] = useState(false);
  const [loading, setLoading] = useState(true); const [joinCode, setJoinCode] = useState<string | null>(null);
  const [presenterToken, setPresenterToken] = useState<string | null>(null);
  const [participantSession, setParticipantSession] = useState<PresentationParticipantSession | null>(null);
  const [channelJoined, setChannelJoined] = useState(false); const [channelError, setChannelError] = useState<string | null>(null);
  const [showJoinOverlay, setShowJoinOverlay] = useState(false); const [resultsHidden, setResultsHidden] = useState(false);
  const [loadError, setLoadError] = useState(""); const [ended, setEnded] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const endedRef = useRef(false);
  const markEnded = useCallback(() => {
    endedRef.current = true;
    setEnded(true);
    setChannelJoined(false);
  }, []);

  const [name, setName] = useState(""); const [response, setResponse] = useState("");
  const [selectedOption, setSelectedOption] = useState<string | null>(null); const [scaleValue, setScaleValue] = useState(5);
  const [submitted, setSubmitted] = useState(false);
  const [commandNotice, setCommandNotice] = useState<string | null>(null);
  const [recovering, setRecovering] = useState(false);
  const snapshotRef = useRef<PresentationSnapshotState<Slide>>({ slides: [], currentIndex: 0, runId: null });
  const revisionRef = useRef(0);
  const slideEpochRef = useRef(0);
  const pendingCommandRef = useRef<object | null>(null);
  const [allResponses, setAllResponses] = useState<SlideResponse[]>([]); const [safeResponseCount, setSafeResponseCount] = useState(0);
  const [safeAggregates, setSafeAggregates] = useState<Record<string, unknown>>({});
  const [qnaQuestions, setQnaQuestions] = useState<QnaQuestion[]>([]); const [newQnaQuestion, setNewQnaQuestion] = useState("");
  const [revealedAnswers, setRevealedAnswers] = useState<Record<string, string[]>>({}); // slideId -> correct answer ids

  const participantId = participantSession?.participantId || ""; const currentSlideId = slides[currentIndex]?.id;
  const channelRef = useRef<ReturnType<typeof subscribeToPresentation> | null>(null); const currentSlideIdRef = useRef<string | undefined>(undefined);

  const applySnapshot = useCallback((pres: unknown) => {
    const previous = snapshotRef.current;
    const next = applyPresentationSnapshot(previous, pres);
    // Never carry credentials from an immutable run into a relaunched deck.
    if (previous.runId && next.runId !== previous.runId) {
      revisionRef.current += 1;
      currentSlideIdRef.current = undefined;
      setChannelJoined(false);
      setLoadError("This presentation has started a new run. Rejoin to continue.");
      channelRef.current?.disconnect();
      return false;
    }
    revisionRef.current += 1;
    snapshotRef.current = next;
    currentSlideIdRef.current = next.slides[next.currentIndex]?.id;
    setSlides(next.slides);
    setCurrentIndex(next.currentIndex);
    if (next.resultsHidden !== null) setResultsHidden(next.resultsHidden);
    if (next.revealedAnswers !== null) setRevealedAnswers(next.revealedAnswers);
    if (next.slideChanged) {
      slideEpochRef.current += 1;
      setSubmitted(false); setResponse(""); setSelectedOption(null);
      setScaleValue(5); setNewQnaQuestion("");
      setAllResponses([]); setSafeResponseCount(0); setSafeAggregates({}); setQnaQuestions([]);
      setCommandNotice(null);
    }
    if (next.ended) markEnded();
    return true;
  }, [markEnded]);

  const runCommand = useCallback(async (command: () => Promise<PresentationCommandOutcome>, onAdmitted?: () => void) => {
    if (pendingCommandRef.current || endedRef.current || !currentSlideIdRef.current) return false;
    const ticket = {};
    const identity = snapshotRef.current;
    const epoch = slideEpochRef.current;
    const channel = channelRef.current;
    pendingCommandRef.current = ticket;
    onAdmitted?.();
    try {
      const outcome = await command();
      if (endedRef.current || slideEpochRef.current !== epoch || channelRef.current !== channel ||
          snapshotRef.current.runId !== identity.runId ||
          currentSlideIdRef.current !== identity.slides[identity.currentIndex]?.id) return false;
      if (outcome.status === "confirmed") {
        setCommandNotice(null);
        return true;
      }
      setCommandNotice(presentationCommandNotice(outcome));
      setRecovering(true); // Read-only reconciliation, never mutation replay.
      return false;
    } finally {
      if (pendingCommandRef.current === ticket) pendingCommandRef.current = null;
    }
  }, []);


  const toggleFullscreen = useCallback(() => {
    if (typeof document === "undefined") return;
    if (!document.fullscreenElement) {
      void document.documentElement.requestFullscreen?.();
    } else {
      void document.exitFullscreen?.();
    }
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.body.classList.add("qw-present-live-route");
    return () => document.body.classList.remove("qw-present-live-route");
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const storedParticipantSession = readParticipantSession(code);
      let pres: any;

      try {
        const result = await fetchPhoenixPresentation(code);
        if (cancelled) return;
        pres = result.presentation;
      } catch (err) {
        if (cancelled) return;
        setLoadError(err instanceof Error ? err.message : "Presentation could not be loaded.");
        setLoading(false);
        return;
      }

      setTitle(pres.title);
      setJoinCode(pres.join_code);
      const host = userId === pres.creator_id;
      const activeParticipantSession = storedParticipantSession?.runId === pres.run_id
        ? storedParticipantSession
        : null;
      setIsHost(host);
      setPresenterToken(readPresenterToken(code, pres.run_id));
      setParticipantSession(activeParticipantSession);
      applySnapshot(pres);

      const savedName = activeParticipantSession?.participantName || getParticipantName();
      if (host || activeParticipantSession || savedName !== "Anonymous") {
        setName(savedName);
      }

      setLoading(false);
    }
    void load();
    return () => { cancelled = true; };
  }, [code, userId, applySnapshot]);

  useEffect(() => {
    if (loading || ended || loadError) return;
    let active = true;

    const channel = subscribeToPresentation({
      presentationId: code,
      presenterToken: isHost ? presenterToken : null,
      participantId: participantSession?.participantId,
      participantToken: participantSession?.participantToken,
      callbacks: {
        onJoined: () => {
          if (!active || endedRef.current) return;
          setChannelJoined(true);
          setChannelError(null);
        },
        onPresentationUpdate: (pres: any) => {
          if (!active || endedRef.current) return;
          applySnapshot(pres);
        },
        onSlideChanged: (pres: any) => {
          if (!active || endedRef.current) return;
          applySnapshot(pres);
        },
        onResponseNew: (data) => {
          if (!active || endedRef.current) return;
          if (activityMatchesSlide(currentSlideIdRef.current, data)) {
            const activity = normalizePresentationActivity(data as Record<string, unknown>, isHost);
            setAllResponses(activity.responses as SlideResponse[]);
            setSafeResponseCount(activity.responseCount);
            setSafeAggregates(activity.aggregates);
            if (!isHost && activity.ownResponse) {
              setSubmitted(true);
              const choice = ownChoiceFrom(activity.ownResponse);
              if (choice) setSelectedOption(choice);
            }
          }
        },
        onQnaNew: (data) => {
          if (!active || endedRef.current) return;
          if (activityMatchesSlide(currentSlideIdRef.current, data)) {
            setQnaQuestions((data.questions || []) as QnaQuestion[]);
          }
        },
        onQnaUpdated: (data) => {
          if (!active || endedRef.current) return;
          if (activityMatchesSlide(currentSlideIdRef.current, data)) {
            setQnaQuestions((data.questions || []) as QnaQuestion[]);
          }
        },
        onQuizRevealed: (data) => {
          if (!active || endedRef.current) return;
          setRevealedAnswers((prev) => ({ ...prev, [data.slide_id]: data.correct_answers }));
        },
        onPresentationEnded: () => {
          if (!active || endedRef.current) return;
          markEnded();
        },
        onPresenterDisconnected: (msg) => {
          if (!active || endedRef.current) return;
          setChannelError(msg);
        },
        onError: (msg) => {
          if (!active || endedRef.current) return;
          console.error("Presentation channel error:", msg);
          setChannelJoined(false);
          setChannelError(msg);
        },
        onDisconnected: (msg) => {
          if (!active || endedRef.current) return;
          setChannelJoined(false);
          setChannelError(msg);
        },
        onClose: () => { if (active && !endedRef.current) setChannelJoined(false); },
      },
    });

    channelRef.current = channel;

    return () => {
      active = false;
      if (channelRef.current === channel) channelRef.current = null;
      channel.disconnect();
    };
  }, [loading, ended, loadError, code, isHost, presenterToken, participantSession?.participantId, participantSession?.participantToken, markEnded, applySnapshot]);

  useEffect(() => {
    if (!isHost || !joinCode) return;
    setShowJoinOverlay(true);
  }, [isHost, joinCode]);

  useEffect(() => {
    if (typeof document === "undefined") return;

    const onFullscreenChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onFullscreenChange);
    onFullscreenChange();

    return () => document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, []);

  useEffect(() => {
    if (!isHost || ended || loading || loadError) return;

    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select") return;

      if (showJoinOverlay) {
        if (event.key === "Escape" || event.key.toLowerCase() === "i") {
          event.preventDefault();
          setShowJoinOverlay(false);
        }
        return;
      }

      if (event.key === "ArrowRight" || event.key === "PageDown") {
        event.preventDefault();
        if (channelJoined && channelRef.current && currentIndex < slides.length - 1) void runCommand(() => channelRef.current!.nextSlide());
      }

      if (event.key === "ArrowLeft" || event.key === "PageUp") {
        event.preventDefault();
        if (channelJoined && channelRef.current && currentIndex > 0) void runCommand(() => channelRef.current!.prevSlide());
      }

      if (event.key.toLowerCase() === "i") {
        event.preventDefault();
        setShowJoinOverlay((v) => !v);
      }

      if (event.key.toLowerCase() === "h") {
        event.preventDefault();
        if (channelJoined && channelRef.current) void runCommand(() => channelRef.current!.setResultsHidden(!resultsHidden));
      }

      if (event.key.toLowerCase() === "f") {
        event.preventDefault();
        toggleFullscreen();
      }

      if (event.key === "Escape") {
        setShowJoinOverlay(false);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isHost, ended, loading, loadError, showJoinOverlay, channelJoined, currentIndex, slides.length, resultsHidden, toggleFullscreen, runCommand]);

  useEffect(() => {
    const slideId = slides[currentIndex]?.id;
    if (loading || ended || loadError) return;
    if (!slideId || slideId.startsWith("temp_")) return;
    if (!isHost && !participantSession) return;

    let cancelled = false;
    async function loadResponses() {
      const identity = snapshotRef.current;
      const epoch = slideEpochRef.current;
      try {
        const activity = await fetchPhoenixSlideActivity(code, slideId, {
          presenterToken: isHost ? presenterToken : null,
          participantId: participantSession?.participantId,
          participantToken: participantSession?.participantToken,
        });
        if (cancelled || endedRef.current || slideEpochRef.current !== epoch || currentSlideIdRef.current !== slideId || snapshotRef.current.runId !== identity.runId) return;

        const normalized = normalizePresentationActivity(activity as Record<string, unknown>, isHost);
        const responses = normalized.responses as SlideResponse[];
        setAllResponses(responses);
        setSafeResponseCount(normalized.responseCount);
        setSafeAggregates(normalized.aggregates);
        setQnaQuestions(normalized.questions as QnaQuestion[]);
        if (normalized.ownResponse || responses.some((r) => r.participant_id === participantId)) setSubmitted(true);
        const restoredChoice = ownChoiceFrom(normalized.ownResponse);
        if (!isHost && restoredChoice) setSelectedOption(restoredChoice);
      } catch (err) {
        if (!cancelled && !endedRef.current) setChannelError(err instanceof Error ? err.message : "Could not load slide activity.");
      }
    }

    void loadResponses();
    return () => { cancelled = true; };
  }, [loading, ended, loadError, code, currentSlideId, participantId, isHost, presenterToken, participantSession]);

  // Periodic presenter activity refresh and disconnected-channel fallback.
  useEffect(() => {
    if (loading || ended || loadError || (channelJoined && !isHost && !recovering)) return;
    let cancelled = false;
    let refreshing = false;
    const timer = window.setInterval(async () => {
      if (cancelled || endedRef.current || refreshing) return;
      refreshing = true;
      try {
        if (!channelJoined || recovering) {
          const revision = revisionRef.current;
          const latest = await fetchPhoenixPresentation(code, {
            presenterToken: isHost ? presenterToken : null,
          }) as { presentation?: any };
          if (cancelled || endedRef.current || revision !== revisionRef.current) return;
          if (!applySnapshot(latest.presentation) || endedRef.current) return;
        }

        const identity = snapshotRef.current;
        const epoch = slideEpochRef.current;
        const slideId = identity.slides[identity.currentIndex]?.id;
        if (slideId && !slideId.startsWith("temp_") && (isHost || participantSession)) {
          const activity = await fetchPhoenixSlideActivity(code, slideId, {
            presenterToken: isHost ? presenterToken : null,
            participantId: participantSession?.participantId,
            participantToken: participantSession?.participantToken,
          });
          if (!cancelled && !endedRef.current && slideEpochRef.current === epoch && currentSlideIdRef.current === slideId && snapshotRef.current.runId === identity.runId) {
            const normalized = normalizePresentationActivity(activity as Record<string, unknown>, isHost);
            setAllResponses(normalized.responses as SlideResponse[]);
            setSafeResponseCount(normalized.responseCount);
            setSafeAggregates(normalized.aggregates);
            setQnaQuestions(normalized.questions as QnaQuestion[]);
            if (normalized.ownResponse) {
              setSubmitted(true); setCommandNotice(null);
              const choice = ownChoiceFrom(normalized.ownResponse);
              if (!isHost && choice) setSelectedOption(choice);
            }
          }
        }
        if (!cancelled && !endedRef.current && channelJoined) setRecovering(false);
      } catch {
        // Keep current screen stable; explicit channelError is already shown.
      } finally { refreshing = false; }
    }, 2500);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, [loading, ended, loadError, channelJoined, code, isHost, presenterToken, participantSession, applySnapshot, recovering]);

  // Submit response via channel
  const submitResponse = useCallback(async (data: Record<string, unknown>) => {
    if (!slides[currentIndex] || submitted || !channelRef.current || !participantSession) return;
    const slideId = slides[currentIndex].id;
    // Show the pick optimistically only once the submit is actually going out.
    const optimisticChoice = choiceFromPayload(data);
    let admitted = false;
    const ok = await runCommand(
      () => channelRef.current!.submitResponse(slideId, data, name || participantSession.participantName || "Anonymous"),
      () => {
        admitted = true;
        if (optimisticChoice) setSelectedOption(optimisticChoice);
      }
    );
    if (!admitted) return;
    if (ok) {
      setSubmitted(true);
      if (optimisticChoice) setSelectedOption(optimisticChoice);
    } else if (optimisticChoice) {
      // A rejected/unconfirmed vote must not look chosen; recovery restores it if the server has it.
      setSelectedOption(null);
    }
  }, [currentIndex, slides, name, submitted, participantSession, runCommand]);

  // Submit Q&A via channel
  const submitQnaQuestion = useCallback(async () => {
    if (!newQnaQuestion.trim() || !slides[currentIndex] || !channelRef.current || !participantSession) return;
    const ok = await runCommand(() => channelRef.current!.submitQna(slides[currentIndex].id, newQnaQuestion.trim(), name || participantSession.participantName || "Anonymous"));
    if (ok) setNewQnaQuestion("");
  }, [currentIndex, slides, name, newQnaQuestion, participantSession, runCommand]);

  // Upvote via channel
  const upvoteQna = useCallback((qnaId: string) => {
    if (!slides[currentIndex] || !channelRef.current || !participantSession) return;
    void runCommand(() => channelRef.current!.upvoteQna(qnaId, slides[currentIndex].id));
  }, [currentIndex, slides, participantSession, runCommand]);

  const navigate = (path: string) => router.push(path);
  if (loading) return <PresentationLiveGuard state="loading" />;
  if (loadError) return <PresentationLiveGuard state="unavailable" message={loadError} onNavigate={navigate} />;
  if (ended) return <PresentationLiveGuard state="ended" title={title} isHost={isHost} onNavigate={navigate} />;
  if (isHost && !presenterToken) return <PresentationLiveGuard state="presenter-token" presentationId={code} onNavigate={navigate} />;
  if (!isHost && !participantSession) return <PresentationLiveGuard state="participant-session" joinCode={joinCode} onNavigate={navigate} />;

  const currentSlide = slides[currentIndex];
  if (!currentSlide) {
    return <PresentationLiveGuard state="empty" />;
  }

  const derived = summarizePresentationActivity(currentSlide, allResponses);
  const sortedWords = (safeAggregates.sorted_words as typeof derived.sortedWords | undefined) ?? derived.sortedWords;
  const pollCounts = (safeAggregates.poll_counts as typeof derived.pollCounts | undefined) ?? derived.pollCounts;
  const scaleValues = (safeAggregates.scale_values as typeof derived.scaleValues | undefined) ?? derived.scaleValues;
  const scaleAvg = (safeAggregates.scale_avg as number | undefined) ?? derived.scaleAvg;

  const joinUrl = joinCode ? presentationJoinUrl(joinCode) : "";
  const responseCount = isHost && safeResponseCount === 0 ? allResponses.length : safeResponseCount;

  return (
    <div className={isHost ? "present-live-shell is-host" : "present-live-shell"}>
      {isHost && (
        <LiveStatusRail
          channelJoined={channelJoined}
          currentIndex={currentIndex}
          slideCount={slides.length}
          title={title}
          joinCode={joinCode}
          resultsHidden={resultsHidden}
          responseCount={responseCount}
          onShowJoin={() => setShowJoinOverlay(true)}
        />
      )}

      {isHost && showJoinOverlay && joinCode && (
        <JoinOverlay joinCode={joinCode} joinUrl={joinUrl} onClose={() => setShowJoinOverlay(false)} />
      )}

      {channelError && (
        <div className="present-channel-error">
          {channelError} {channelJoined ? "" : "Using read-only fallback until realtime reconnects."}
        </div>
      )}

      {commandNotice && <div className="present-channel-error" role="status">{commandNotice}</div>}

      <LiveSlideStage
        key={currentSlide.id}
        currentSlide={currentSlide}
        isHost={isHost}
        resultsHidden={resultsHidden}
        responseCount={responseCount}
        allResponses={allResponses}
        qnaQuestions={qnaQuestions}
        sortedWords={sortedWords}
        pollCounts={pollCounts}
        scaleValues={scaleValues}
        scaleAvg={scaleAvg}
        response={response}
        selectedOption={selectedOption}
        scaleValue={scaleValue}
        submitted={submitted}
        newQnaQuestion={newQnaQuestion}
        channelJoined={channelJoined}
        revealedAnswers={revealedAnswers}
        onRevealQuiz={() => {
          const slide = slides[currentIndex];
          if (!slide || !channelRef.current) return;
          const correctIds = (slide.content.answers || [])
            .filter((a) => a.is_correct)
            .map((a) => a.id);
          void runCommand(() => channelRef.current!.revealQuizAnswers(slide.id, correctIds));
        }}
        onReconnect={() => {
          if (channelRef.current) {
            channelRef.current.disconnect();
            channelRef.current = null;
          }
          setChannelJoined(false);
          setChannelError(null);
          window.location.reload();
        }}
        setResponse={setResponse}
        setScaleValue={setScaleValue}
        setSelectedOption={setSelectedOption}
        setNewQnaQuestion={setNewQnaQuestion}
        submitResponse={submitResponse}
        submitQnaQuestion={submitQnaQuestion}
        upvoteQna={upvoteQna}
      />

      {isHost && (
        <HostDock
          channelJoined={channelJoined}
          currentIndex={currentIndex}
          slideCount={slides.length}
          resultsHidden={resultsHidden}
          isFullscreen={isFullscreen}
          onPrev={() => { if (channelJoined && channelRef.current) void runCommand(() => channelRef.current!.prevSlide()); }}
          onNext={() => { if (channelJoined && channelRef.current) void runCommand(() => channelRef.current!.nextSlide()); }}
          onJoin={() => setShowJoinOverlay(true)}
          onToggleResults={() => {
            const hidden = !resultsHidden;
            if (channelJoined && channelRef.current) void runCommand(() => channelRef.current!.setResultsHidden(hidden));
          }}
          onToggleFullscreen={toggleFullscreen}
          onEnd={() => { if (channelJoined && channelRef.current) void runCommand(() => channelRef.current!.endPresentation()); }}
        />
      )}

      {!isHost && <div className="present-audience-progress">{currentIndex + 1} / {slides.length}</div>}
    </div>
  );
}
