"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/components/supabase-provider";
import type { Slide, SlideResponse, QnaQuestion } from "@/lib/presentation/types";
import { getParticipantName } from "@/lib/presentation/types";
import { activityMatchesSlide, summarizePresentationActivity } from "@/lib/presentation/runtime";
import { subscribeToPresentation } from "@/lib/presentation/presentation-socket";
import {
  fetchPhoenixPresentation,
  fetchPhoenixSlideActivity,
  readParticipantSession,
  readPresenterToken,
  type PresentationParticipantSession,
} from "@/lib/presentation/client";
import { presentationJoinUrl } from "@/lib/config/public";
import { HostDock, JoinOverlay, LiveStatusRail } from "@/components/present/live/live-status-panels";
import { LiveSlideStage } from "@/components/present/live/live-slide-stage";
import { PresentationLiveGuard } from "@/components/present/live/live-route-guards";

export default function PresentationLive() {
  const params = useParams();
  const router = useRouter();
  const code = params.code as string;
  const { user } = useAuth();

  const [title, setTitle] = useState("");
  const [slides, setSlides] = useState<Slide[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isHost, setIsHost] = useState(false);
  const [loading, setLoading] = useState(true);
  const [joinCode, setJoinCode] = useState<string | null>(null);
  const [presenterToken, setPresenterToken] = useState<string | null>(null);
  const [participantSession, setParticipantSession] = useState<PresentationParticipantSession | null>(null);
  const [channelJoined, setChannelJoined] = useState(false);
  const [channelError, setChannelError] = useState<string | null>(null);
  const [showJoinOverlay, setShowJoinOverlay] = useState(false);
  const [resultsHidden, setResultsHidden] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [ended, setEnded] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Audience state
  const [name, setName] = useState("");
  const [response, setResponse] = useState("");
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [scaleValue, setScaleValue] = useState(5);
  const [submitted, setSubmitted] = useState(false);
  const [allResponses, setAllResponses] = useState<SlideResponse[]>([]);
  const [qnaQuestions, setQnaQuestions] = useState<QnaQuestion[]>([]);
  const [newQnaQuestion, setNewQnaQuestion] = useState("");
  const [revealedAnswers, setRevealedAnswers] = useState<Record<string, string[]>>({}); // slideId -> correct answer ids

  const participantId = participantSession?.participantId || "";
  const channelRef = useRef<ReturnType<typeof subscribeToPresentation> | null>(null);
  const currentSlideIdRef = useRef<string | undefined>(undefined);
  const currentSlideId = slides[currentIndex]?.id;

  useEffect(() => {
    currentSlideIdRef.current = currentSlideId;
    setAllResponses([]);
    setQnaQuestions([]);
  }, [currentSlideId]);

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

  // Load initial presentation state
  useEffect(() => {
    async function load() {
      const storedPresenterToken = readPresenterToken(code);
      const storedParticipantSession = readParticipantSession(code);
      let pres: any;

      try {
        const result = await fetchPhoenixPresentation(code, { presenterToken: storedPresenterToken });
        pres = result.presentation;
      } catch (err) {
        setLoadError(err instanceof Error ? err.message : "Presentation could not be loaded.");
        setLoading(false);
        return;
      }

      setTitle(pres.title);
      setJoinCode(pres.join_code);
      const host = user?.id === pres.creator_id;
      setIsHost(host);
      setPresenterToken(storedPresenterToken);
      setParticipantSession(storedParticipantSession);
      setCurrentIndex(pres.current_slide_index || 0);
      setResultsHidden(pres.results_hidden === true);
      setEnded(pres.status === "finished");
      const sorted = (pres.slides || []).sort((a: Slide, b: Slide) => a.order_index - b.order_index);
      setSlides(sorted);

      const savedName = storedParticipantSession?.participantName || getParticipantName();
      if (host || storedParticipantSession || savedName !== "Anonymous") {
        setName(savedName);
      }

      setLoading(false);
    }
    load();
  }, [code, user, router]);

  // Connect to Phoenix channel
  useEffect(() => {
    if (loading || ended) return;

    const channel = subscribeToPresentation({
      presentationId: code,
      presenterToken: isHost ? presenterToken : null,
      participantId: participantSession?.participantId,
      participantToken: participantSession?.participantToken,
      callbacks: {
        onJoined: () => {
          setChannelJoined(true);
          setChannelError(null);
        },
        onPresentationUpdate: (pres: any) => {
          if (pres?.slides) {
            const sorted = [...(pres.slides || [])].sort((a: Slide, b: Slide) => a.order_index - b.order_index);
            setSlides(sorted);
          }
          if (pres?.current_slide_index !== undefined) {
            setCurrentIndex(pres.current_slide_index);
            setSubmitted(false);
            setResponse("");
            setSelectedOption(null);
          }
          if (pres?.results_hidden !== undefined) setResultsHidden(pres.results_hidden === true);
        },
        onSlideChanged: (pres: any) => {
          if (pres?.slides) {
            const sorted = [...(pres.slides || [])].sort((a: Slide, b: Slide) => a.order_index - b.order_index);
            setSlides(sorted);
          }
          if (pres?.current_slide_index !== undefined) {
            setCurrentIndex(pres.current_slide_index);
            setSubmitted(false);
            setResponse("");
            setSelectedOption(null);
          }
          if (pres?.results_hidden !== undefined) setResultsHidden(pres.results_hidden === true);
        },
        onResponseNew: (data) => {
          if (activityMatchesSlide(currentSlideIdRef.current, data)) {
            setAllResponses((data.responses || []) as SlideResponse[]);
          }
        },
        onQnaNew: (data) => {
          if (activityMatchesSlide(currentSlideIdRef.current, data)) {
            setQnaQuestions((data.questions || []) as QnaQuestion[]);
          }
        },
        onQnaUpdated: (data) => {
          if (activityMatchesSlide(currentSlideIdRef.current, data)) {
            setQnaQuestions((data.questions || []) as QnaQuestion[]);
          }
        },
        onQuizRevealed: (data) => {
          setRevealedAnswers((prev) => ({ ...prev, [data.slide_id]: data.correct_answers }));
        },
        onPresentationEnded: () => {
          setEnded(true);
        },
        onPresenterDisconnected: (msg) => {
          setChannelError(msg);
        },
        onError: (msg) => {
          console.error("Presentation channel error:", msg);
          setChannelJoined(false);
          setChannelError(msg);
        },
        onClose: () => setChannelJoined(false),
      },
    });

    channelRef.current = channel;

    return () => {
      channel.disconnect();
    };
  }, [loading, ended, code, isHost, presenterToken, participantSession?.participantId, participantSession?.participantToken, router]);

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
    if (!isHost) return;

    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select") return;

      if (event.key === "ArrowRight" || event.key === "PageDown") {
        event.preventDefault();
        if (channelJoined && channelRef.current && currentIndex < slides.length - 1) void channelRef.current.nextSlide();
      }

      if (event.key === "ArrowLeft" || event.key === "PageUp") {
        event.preventDefault();
        if (channelJoined && channelRef.current && currentIndex > 0) void channelRef.current.prevSlide();
      }

      if (event.key.toLowerCase() === "i") {
        event.preventDefault();
        setShowJoinOverlay((v) => !v);
      }

      if (event.key.toLowerCase() === "h") {
        event.preventDefault();
        if (channelJoined && channelRef.current) void channelRef.current.setResultsHidden(!resultsHidden);
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
  }, [isHost, channelJoined, currentIndex, slides.length, resultsHidden, toggleFullscreen]);

  // Load responses for current slide (initial + fallback)
  useEffect(() => {
    const slideId = slides[currentIndex]?.id;
    if (!slideId || slideId.startsWith("temp_")) return;
    if (!isHost && !participantSession) return;

    let cancelled = false;
    setAllResponses([]);
    setQnaQuestions([]);

    async function loadResponses() {
      try {
        const activity = await fetchPhoenixSlideActivity(code, slideId, {
          presenterToken: isHost ? presenterToken : null,
          participantId: participantSession?.participantId,
          participantToken: participantSession?.participantToken,
        });
        if (cancelled || currentSlideIdRef.current !== slideId) return;

        const responses = (activity.responses || []) as SlideResponse[];
        const qnas = (activity.questions || []) as QnaQuestion[];
        setAllResponses(responses);
        setQnaQuestions(qnas);
        setSubmitted(responses.some((r: SlideResponse) => r.participant_id === participantId));
      } catch (err) {
        if (!cancelled) setChannelError(err instanceof Error ? err.message : "Could not load slide activity.");
      }
    }

    void loadResponses();
    return () => { cancelled = true; };
  }, [code, currentIndex, slides, participantId, isHost, presenterToken, participantSession]);

  // Periodic fallback when websocket is unavailable.
  useEffect(() => {
    if (loading || channelJoined) return;
    const timer = window.setInterval(async () => {
      try {
        const latest = await fetchPhoenixPresentation(code) as { presentation?: any };
        const pres = latest.presentation;
        if (pres?.slides) setSlides([...(pres.slides || [])].sort((a: Slide, b: Slide) => a.order_index - b.order_index));
        if (pres?.current_slide_index !== undefined) setCurrentIndex(pres.current_slide_index);
        if (pres?.results_hidden !== undefined) setResultsHidden(pres.results_hidden === true);

        const slideId = slides[currentIndex]?.id;
        if (slideId && !slideId.startsWith("temp_") && (isHost || participantSession)) {
          const activity = await fetchPhoenixSlideActivity(code, slideId, {
            presenterToken: isHost ? presenterToken : null,
            participantId: participantSession?.participantId,
            participantToken: participantSession?.participantToken,
          });
          if (currentSlideIdRef.current === slideId) {
            setAllResponses((activity.responses || []) as SlideResponse[]);
            setQnaQuestions((activity.questions || []) as QnaQuestion[]);
          }
        }
      } catch {
        // Keep current screen stable; explicit channelError is already shown.
      }
    }, 2500);
    return () => window.clearInterval(timer);
  }, [loading, channelJoined, code, slides, currentIndex, isHost, presenterToken, participantSession]);

  // Submit response via channel
  const submitResponse = useCallback(async (data: Record<string, unknown>) => {
    if (!slides[currentIndex] || submitted || !channelRef.current || !participantSession) return;
    const slideId = slides[currentIndex].id;
    const ok = await channelRef.current.submitResponse(slideId, data, name || participantSession.participantName || "Anonymous");
    if (ok) setSubmitted(true);
  }, [currentIndex, slides, name, submitted, participantSession]);

  // Submit Q&A via channel
  const submitQnaQuestion = useCallback(async () => {
    if (!newQnaQuestion.trim() || !slides[currentIndex] || !channelRef.current || !participantSession) return;
    const ok = await channelRef.current.submitQna(slides[currentIndex].id, newQnaQuestion.trim(), name || participantSession.participantName || "Anonymous");
    if (ok) setNewQnaQuestion("");
  }, [currentIndex, slides, name, newQnaQuestion, participantSession]);

  // Upvote via channel
  const upvoteQna = useCallback((qnaId: string) => {
    if (!slides[currentIndex] || !channelRef.current || !participantSession) return;
    void channelRef.current.upvoteQna(qnaId, slides[currentIndex].id);
  }, [currentIndex, slides, participantSession]);

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

  const { sortedWords, pollCounts, scaleValues, scaleAvg } = summarizePresentationActivity(currentSlide, allResponses);

  const joinUrl = joinCode ? presentationJoinUrl(joinCode) : "";
  const responseCount = allResponses.length;

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

      <LiveSlideStage
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
          void channelRef.current.revealQuizAnswers(slide.id, correctIds);
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
          onPrev={() => { if (channelJoined && channelRef.current) void channelRef.current.prevSlide(); }}
          onNext={() => { if (channelJoined && channelRef.current) void channelRef.current.nextSlide(); }}
          onJoin={() => setShowJoinOverlay(true)}
          onToggleResults={() => {
            const hidden = !resultsHidden;
            if (channelJoined && channelRef.current) void channelRef.current.setResultsHidden(hidden);
          }}
          onToggleFullscreen={toggleFullscreen}
          onEnd={() => { if (channelJoined && channelRef.current) void channelRef.current.endPresentation(); }}
        />
      )}

      {!isHost && <div className="present-audience-progress">{currentIndex + 1} / {slides.length}</div>}
    </div>
  );
}
