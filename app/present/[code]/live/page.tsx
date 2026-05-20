"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { useAuth } from "@/components/supabase-provider";
import type { Slide, SlideResponse, QnaQuestion } from "@/lib/presentation/types";
import { getParticipantName } from "@/lib/presentation/types";
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

  const participantId = participantSession?.participantId || "";
  const channelRef = useRef<ReturnType<typeof subscribeToPresentation> | null>(null);

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
      const { data: pres, error } = await supabase
        .from("presentations")
        .select("*, slides(*)")
        .eq("id", code)
        .single();

      if (error || !pres) {
        router.push("/present");
        return;
      }

      setTitle(pres.title);
      setJoinCode(pres.join_code);
      const host = user?.id === pres.creator_id;
      setIsHost(host);
      const storedPresenterToken = readPresenterToken(code);
      const storedParticipantSession = readParticipantSession(code);
      setPresenterToken(storedPresenterToken);
      setParticipantSession(storedParticipantSession);
      setCurrentIndex(pres.current_slide_index || 0);
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
    if (loading) return;

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
        },
        onResponseNew: (data) => {
          setAllResponses((data.responses || []) as SlideResponse[]);
        },
        onQnaNew: (data) => {
          setQnaQuestions((data.questions || []) as QnaQuestion[]);
        },
        onQnaUpdated: (data) => {
          setQnaQuestions((data.questions || []) as QnaQuestion[]);
        },
        onPresentationEnded: () => {
          router.push("/present");
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
  }, [loading, code, isHost, presenterToken, participantSession?.participantId, participantSession?.participantToken, router]);

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
        setResultsHidden((v) => !v);
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
  }, [isHost, channelJoined, currentIndex, slides.length, toggleFullscreen]);

  // Load responses for current slide (initial + fallback)
  useEffect(() => {
    if (!slides[currentIndex]) return;

    async function loadResponses() {
      const slideId = slides[currentIndex]?.id;
      if (!slideId || slideId.startsWith("temp_")) return;

      if (!isHost && !participantSession) return;

      const activity = await fetchPhoenixSlideActivity(code, slideId, {
        presenterToken: isHost ? presenterToken : null,
        participantId: participantSession?.participantId,
        participantToken: participantSession?.participantToken,
      });
      const responses = (activity.responses || []) as SlideResponse[];
      const qnas = (activity.questions || []) as QnaQuestion[];
      setAllResponses(responses);
      setQnaQuestions(qnas);

      const alreadySubmitted = responses.some((r: SlideResponse) => r.participant_id === participantId);
      setSubmitted(alreadySubmitted);
    }
    loadResponses();
  }, [currentIndex, slides, participantId, isHost, presenterToken, participantSession]);

  // Periodic fallback when websocket is unavailable.
  useEffect(() => {
    if (loading || channelJoined) return;
    const timer = window.setInterval(async () => {
      try {
        const latest = await fetchPhoenixPresentation(code) as { presentation?: any };
        const pres = latest.presentation;
        if (pres?.slides) setSlides([...(pres.slides || [])].sort((a: Slide, b: Slide) => a.order_index - b.order_index));
        if (pres?.current_slide_index !== undefined) setCurrentIndex(pres.current_slide_index);

        const slideId = slides[currentIndex]?.id;
        if (slideId && !slideId.startsWith("temp_") && (isHost || participantSession)) {
          const activity = await fetchPhoenixSlideActivity(code, slideId, {
            presenterToken: isHost ? presenterToken : null,
            participantId: participantSession?.participantId,
            participantToken: participantSession?.participantToken,
          });
          setAllResponses((activity.responses || []) as SlideResponse[]);
          setQnaQuestions((activity.questions || []) as QnaQuestion[]);
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

  if (loading) {
    return <div className="container present-live-guard">Loading...</div>;
  }

  if (isHost && !presenterToken) {
    return (
      <div className="container present-live-guard present-live-guard--narrow">
        <div className="card present-live-guard-card">
          <div className="present-live-guard-icon">🎤</div>
          <h1 className="font-display present-live-guard-title">Start from the editor</h1>
          <p className="present-live-guard-copy">Presenter controls require a live presenter token. Start this deck from the editor.</p>
          <button className="btn btn-primary btn-lg" onClick={() => router.push(`/present/${code}/edit`)}>Open Editor</button>
        </div>
      </div>
    );
  }

  if (!isHost && !participantSession) {
    return (
      <div className="container present-live-guard present-live-guard--narrow">
        <div className="card present-live-guard-card">
          <div className="present-live-guard-icon">🙋</div>
          <h1 className="font-display present-live-guard-title">Join through the presentation code</h1>
          <p className="present-live-guard-copy">Audience responses need a participant session so your answers and upvotes are valid.</p>
          <button className="btn btn-primary btn-lg" onClick={() => router.push(joinCode ? `/present/join?code=${joinCode}` : "/present/join")}>Join Presentation</button>
        </div>
      </div>
    );
  }

  const currentSlide = slides[currentIndex];
  if (!currentSlide) {
    return <div className="container present-live-guard">No slides</div>;
  }

  // Word cloud data
  const wordCloudWords = allResponses.flatMap(r => {
    const text = (r.response_data?.words as string) || "";
    return text.split(/[\s,]+/).filter(w => w.length > 1);
  });
  const wordCounts: Record<string, number> = {};
  wordCloudWords.forEach(w => { wordCounts[w.toLowerCase()] = (wordCounts[w.toLowerCase()] || 0) + 1; });
  const sortedWords = Object.entries(wordCounts).sort((a, b) => b[1] - a[1]).slice(0, 30);

  // Poll data
  const pollCounts: Record<string, number> = {};
  (currentSlide.content?.options || []).forEach(o => { pollCounts[o.id] = 0; });
  allResponses.forEach(r => {
    const optId = r.response_data?.option_id as string;
    if (optId) pollCounts[optId] = (pollCounts[optId] || 0) + 1;
  });

  // Scale data
  const scaleValues = allResponses.map(r => Number(r.response_data?.value) || 0);
  const scaleAvg = scaleValues.length > 0 ? Math.round(scaleValues.reduce((s, v) => s + v, 0) / scaleValues.length * 10) / 10 : 0;

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
        onReconnect={() => {
          if (channelRef.current) {
            channelRef.current.disconnect();
            channelRef.current = null;
          }
          // Re-subscribe by toggling loading briefly
          setChannelJoined(false);
          setChannelError(null);
          // Re-run channel subscription effect by re-mounting
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
          onToggleResults={() => setResultsHidden((v) => !v)}
          onToggleFullscreen={toggleFullscreen}
          onEnd={() => { if (channelJoined && channelRef.current) void channelRef.current.endPresentation(); }}
        />
      )}

      {!isHost && <div className="present-audience-progress">{currentIndex + 1} / {slides.length}</div>}
    </div>
  );
}
