"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { QrCode } from "@/components/shared/qr-code";
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
import { DISPLAY_SITE_HOST, presentationJoinUrl } from "@/lib/config/public";

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
    return <div className="container" style={{ paddingTop: "4rem", textAlign: "center" }}>Loading...</div>;
  }

  if (isHost && !presenterToken) {
    return (
      <div className="container" style={{ paddingTop: "4rem", maxWidth: 520, textAlign: "center" }}>
        <div className="card" style={{ padding: "2rem" }}>
          <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>🎤</div>
          <h1 className="font-display" style={{ fontSize: "1.5rem", fontWeight: 800, marginBottom: "0.75rem" }}>Start from the editor</h1>
          <p style={{ color: "var(--muted)", marginBottom: "1.5rem" }}>Presenter controls require a live presenter token. Start this deck from the editor.</p>
          <button className="btn btn-primary btn-lg" onClick={() => router.push(`/present/${code}/edit`)}>Open Editor</button>
        </div>
      </div>
    );
  }

  if (!isHost && !participantSession) {
    return (
      <div className="container" style={{ paddingTop: "4rem", maxWidth: 520, textAlign: "center" }}>
        <div className="card" style={{ padding: "2rem" }}>
          <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>🙋</div>
          <h1 className="font-display" style={{ fontSize: "1.5rem", fontWeight: 800, marginBottom: "0.75rem" }}>Join through the presentation code</h1>
          <p style={{ color: "var(--muted)", marginBottom: "1.5rem" }}>Audience responses need a participant session so your answers and upvotes are valid.</p>
          <button className="btn btn-primary btn-lg" onClick={() => router.push(joinCode ? `/present/join?code=${joinCode}` : "/present/join")}>Join Presentation</button>
        </div>
      </div>
    );
  }

  const currentSlide = slides[currentIndex];
  if (!currentSlide) {
    return <div className="container" style={{ paddingTop: "4rem", textAlign: "center" }}>No slides</div>;
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
  const shouldShowResults = !isHost || !resultsHidden;

  const dockButtonStyle = { padding: "0.7rem 0.95rem", fontSize: "0.82rem", fontWeight: 800, borderRadius: "999px", border: "1px solid rgba(255,255,255,0.18)", background: "rgba(255,255,255,0.1)", color: "#fff", cursor: "pointer", boxShadow: "0 12px 30px rgba(15,23,42,0.12)" };
  const dockPrimaryButtonStyle = { ...dockButtonStyle, border: "none", background: "linear-gradient(135deg, var(--accent), #a78bfa)" };

  return (
    <div className="present-live-shell" style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: isHost ? "radial-gradient(circle at top left, #f5f3ff 0, #ffffff 36%, #f8fafc 100%)" : undefined }}>
      {/* Presenter status rail */}
      {isHost && (
        <div className="present-live-status-rail" style={{ position: "fixed", top: 14, left: 14, right: 14, zIndex: 20, display: "flex", alignItems: "center", gap: "0.75rem", pointerEvents: "none" }}>
          <div style={{ pointerEvents: "auto", display: "flex", alignItems: "center", gap: "0.55rem", padding: "0.55rem 0.8rem", borderRadius: "999px", background: "rgba(15,23,42,0.78)", color: "#fff", backdropFilter: "blur(14px)", boxShadow: "0 18px 50px rgba(15,23,42,0.18)" }}>
            <span style={{ width: 9, height: 9, borderRadius: "999px", background: channelJoined ? "#22c55e" : "#f97316", boxShadow: channelJoined ? "0 0 0 4px rgba(34,197,94,0.18)" : "0 0 0 4px rgba(249,115,22,0.18)" }} />
            <span style={{ fontSize: "0.76rem", fontWeight: 900 }}>{currentIndex + 1}/{slides.length}</span>
            <span style={{ fontSize: "0.76rem", color: "rgba(255,255,255,0.75)", maxWidth: 280, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{title}</span>
          </div>
          {joinCode && (
            <button onClick={() => setShowJoinOverlay(true)} style={{ pointerEvents: "auto", padding: "0.55rem 0.85rem", borderRadius: "999px", border: "1px solid rgba(124,58,237,0.18)", background: "rgba(255,255,255,0.92)", color: "var(--accent)", fontSize: "0.78rem", fontWeight: 900, cursor: "pointer", boxShadow: "0 14px 40px rgba(15,23,42,0.12)" }}>Join: {joinCode}</button>
          )}
          <div style={{ flex: 1 }} />
          <div style={{ pointerEvents: "auto", padding: "0.55rem 0.75rem", borderRadius: "999px", background: resultsHidden ? "rgba(225,29,72,0.1)" : "rgba(5,150,105,0.1)", color: resultsHidden ? "var(--primary)" : "var(--success)", fontSize: "0.76rem", fontWeight: 900 }}>
            {resultsHidden ? "Results hidden" : "Results visible"} · {responseCount} responses
          </div>
        </div>
      )}

      {isHost && showJoinOverlay && joinCode && (
        <div className="present-join-overlay" onClick={() => setShowJoinOverlay(false)} style={{ position: "fixed", inset: 0, zIndex: 50, display: "grid", placeItems: "center", padding: "2rem", background: "rgba(15,23,42,0.72)", backdropFilter: "blur(12px)" }}>
          <div className="present-join-overlay-card" onClick={(e) => e.stopPropagation()} style={{ width: "min(760px, 100%)", borderRadius: 36, padding: "2rem", background: "#fff", boxShadow: "0 30px 90px rgba(15,23,42,0.34)", textAlign: "center" }}>
            <div style={{ fontSize: "0.78rem", fontWeight: 900, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: "0.75rem" }}>Audience join</div>
            <div style={{ fontSize: "clamp(2.4rem, 8vw, 5rem)", fontWeight: 950, letterSpacing: "0.18em", color: "var(--accent)", lineHeight: 1, marginBottom: "1rem" }}>{joinCode}</div>
            <div className="present-join-overlay-body" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "2rem", flexWrap: "wrap" }}>
              <QrCode value={joinUrl} size={260} label="Scan to join" className="qr-code" />
              <div style={{ maxWidth: 360, textAlign: "left" }}>
                <div style={{ fontSize: "1.6rem", fontWeight: 950, marginBottom: "0.5rem" }}>Scan or enter the code</div>
                <div style={{ fontSize: "1rem", color: "var(--muted)", fontWeight: 700, marginBottom: "1rem" }}>{DISPLAY_SITE_HOST}/present/join</div>
                <button onClick={() => { void navigator.clipboard?.writeText(joinUrl); }} className="btn btn-primary btn-lg">Copy invite link</button>
                <div style={{ marginTop: "1rem", fontSize: "0.78rem", color: "var(--muted)", fontWeight: 700 }}>Shortcut: press I to show/hide this overlay</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {channelError && (
        <div style={{ padding: "0.5rem 1rem", background: "#fff7ed", color: "#9a3412", fontSize: "0.8rem", fontWeight: 700, textAlign: "center" }}>
          {channelError} {channelJoined ? "" : "Using read-only fallback until realtime reconnects."}
        </div>
      )}

      {/* Slide content */}
      <div className="present-live-stage" style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: isHost ? "5.5rem 2rem 7rem" : "2rem" }}>
        <div className="present-live-content" style={{ maxWidth: isHost ? 980 : 720, width: "100%", textAlign: "center" }}>

          {currentSlide.slide_type === "content" && (
            <div className="card" style={{ padding: "3rem", textAlign: "left" }}>
              <h2 className="font-display" style={{ fontSize: "1.5rem", fontWeight: 800, marginBottom: "1rem" }}>{currentSlide.title}</h2>
              <div style={{ fontSize: "1.125rem", lineHeight: 1.7, whiteSpace: "pre-wrap" }}>{currentSlide.content?.text || ""}</div>
            </div>
          )}

          {currentSlide.slide_type === "word_cloud" && (
            <div>
              <h2 className="font-display" style={{ fontSize: "1.5rem", fontWeight: 800, marginBottom: "1.5rem" }}>{currentSlide.content?.prompt || "What comes to mind?"}</h2>
              {shouldShowResults && sortedWords.length > 0 ? (
                <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "0.65rem", marginBottom: "2rem" }}>
                  {sortedWords.map(([word, count]) => (
                    <span key={word} style={{ padding: "0.55rem 1.1rem", borderRadius: "999px", background: "linear-gradient(135deg, var(--accent-light), #fdf4ff)", color: "var(--accent)", fontSize: `${Math.min(1 + count * 0.3, 2.8)}rem`, fontWeight: 900, boxShadow: "0 10px 30px rgba(124,58,237,0.1)" }}>{word}</span>
                  ))}
                </div>
              ) : <p style={{ color: "var(--muted)", fontSize: "1.125rem", fontWeight: 700 }}>{resultsHidden && isHost ? `Responses hidden · ${responseCount} received` : "Waiting for responses…"}</p>}
              {!submitted && !isHost && (
                <div className="present-response-row" style={{ display: "flex", gap: "0.5rem", maxWidth: 400, margin: "0 auto" }}>
                  <input value={response} onChange={(e) => setResponse(e.target.value)} placeholder="Type a word…"
                    style={{ flex: 1, padding: "0.75rem", border: "1.5px solid var(--line)", borderRadius: "var(--radius-xl)", outline: "none" }}
                    onKeyDown={(e) => { if (e.key === "Enter" && response.trim()) submitResponse({ words: response.trim() }); }} />
                  <button onClick={() => { if (response.trim()) submitResponse({ words: response.trim() }); }} className="btn btn-primary">Submit</button>
                </div>
              )}
              {submitted && <p style={{ color: "var(--success)", fontWeight: 700, marginTop: "1rem" }}>✅ Submitted!</p>}
            </div>
          )}

          {currentSlide.slide_type === "open_text" && (
            <div>
              <h2 className="font-display" style={{ fontSize: "1.5rem", fontWeight: 800, marginBottom: "1.5rem" }}>{currentSlide.content?.question || "What do you think?"}</h2>
              {shouldShowResults && allResponses.length > 0 && (
                <div style={{ display: "grid", gap: "0.65rem", marginBottom: "2rem", maxHeight: 360, overflowY: "auto" }}>
                  {allResponses.map((r, i) => (
                    <div key={i} className="card" style={{ padding: "0.95rem 1.15rem", textAlign: "left", border: "1px solid rgba(124,58,237,0.14)", boxShadow: "0 10px 28px rgba(15,23,42,0.06)" }}>
                      <span style={{ fontWeight: 750 }}>{r.response_data?.text as string}</span>
                      <span style={{ fontSize: "0.75rem", color: "var(--muted)", marginLeft: "0.5rem" }}>— {r.participant_name}</span>
                    </div>
                  ))}
                </div>
              )}
              {isHost && resultsHidden && <p style={{ color: "var(--muted)", fontSize: "1.125rem", fontWeight: 700, marginBottom: "2rem" }}>Responses hidden · {responseCount} received</p>}
              {!submitted && !isHost && (
                <div className="present-response-row" style={{ display: "flex", gap: "0.5rem", maxWidth: 500, margin: "0 auto" }}>
                  <input value={response} onChange={(e) => setResponse(e.target.value)} placeholder="Type your response…"
                    style={{ flex: 1, padding: "0.75rem", border: "1.5px solid var(--line)", borderRadius: "var(--radius-xl)", outline: "none" }}
                    onKeyDown={(e) => { if (e.key === "Enter" && response.trim()) submitResponse({ text: response.trim() }); }} />
                  <button onClick={() => { if (response.trim()) submitResponse({ text: response.trim() }); }} className="btn btn-primary">Submit</button>
                </div>
              )}
              {submitted && <p style={{ color: "var(--success)", fontWeight: 700, marginTop: "1rem" }}>✅ Submitted!</p>}
            </div>
          )}

          {currentSlide.slide_type === "poll" && (
            <div>
              <h2 className="font-display" style={{ fontSize: "1.5rem", fontWeight: 800, marginBottom: "1.5rem" }}>{currentSlide.title || "Vote"}</h2>
              <div style={{ display: "grid", gap: "0.75rem", maxWidth: 400, margin: "0 auto" }}>
                {(currentSlide.content?.options || []).map((opt) => {
                  const count = pollCounts[opt.id] || 0;
                  const total = Object.values(pollCounts).reduce((s, c) => s + c, 0);
                  const pct = total > 0 ? Math.round(count / total * 100) : 0;
                  return (
                    <button key={opt.id} onClick={() => { if (!submitted && !isHost) { setSelectedOption(opt.id); submitResponse({ option_id: opt.id }); } }}
                      disabled={submitted || isHost}
                      style={{ padding: "1rem", borderRadius: "var(--radius-xl)", border: selectedOption === opt.id ? "2px solid var(--accent)" : "1.5px solid var(--line)", background: selectedOption === opt.id ? "var(--accent-light)" : "var(--surface)", cursor: submitted || isHost ? "default" : "pointer", textAlign: "left", position: "relative", overflow: "hidden" }}>
                      {shouldShowResults && <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${pct}%`, background: "linear-gradient(90deg, var(--accent-light), #ddd6fe)", transition: "width 0.6s cubic-bezier(.2,.8,.2,1)", opacity: 0.75 }} />}
                      <div style={{ position: "relative", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "1rem" }}>
                        <span style={{ fontWeight: 850, fontSize: isHost ? "1.05rem" : undefined }}>{opt.text}</span>
                        <span style={{ fontWeight: 900, color: "var(--accent)", minWidth: 86, textAlign: "right" }}>{shouldShowResults ? `${pct}% (${count})` : "Hidden"}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {currentSlide.slide_type === "quiz" && (
            <div>
              <h2 className="font-display" style={{ fontSize: "1.5rem", fontWeight: 800, marginBottom: "1.5rem" }}>{currentSlide.title || "Quiz"}</h2>
              <div style={{ display: "grid", gap: "0.75rem", maxWidth: 500, margin: "0 auto" }}>
                {(currentSlide.content?.answers || []).map((ans, i) => (
                  <button key={ans.id} onClick={() => { if (!submitted && !isHost) submitResponse({ answer_id: ans.id, is_correct: ans.is_correct }); }}
                    disabled={submitted || isHost}
                    style={{ padding: "1rem", borderRadius: "var(--radius-xl)", border: "1.5px solid var(--line)", background: submitted && ans.is_correct ? "var(--accent-light)" : "var(--surface)", cursor: submitted || isHost ? "default" : "pointer", textAlign: "left", display: "flex", alignItems: "center", gap: "0.75rem" }}>
                    <span style={{ width: 36, height: 36, borderRadius: "50%", background: "var(--line)", display: "grid", placeItems: "center", fontWeight: 800 }}>{String.fromCharCode(65 + i)}</span>
                    <span style={{ fontWeight: 700 }}>{ans.text}</span>
                    {submitted && ans.is_correct && <span style={{ marginLeft: "auto", color: "var(--success)", fontWeight: 700 }}>✅</span>}
                  </button>
                ))}
              </div>
              {submitted && <p style={{ color: "var(--success)", fontWeight: 700, marginTop: "1rem" }}>✅ Answered!</p>}
              <p style={{ color: "var(--muted)", fontSize: "0.75rem", marginTop: "0.5rem" }}>{allResponses.length} responses</p>
            </div>
          )}

          {currentSlide.slide_type === "scale" && (
            <div>
              <h2 className="font-display" style={{ fontSize: "1.5rem", fontWeight: 800, marginBottom: "1.5rem" }}>{currentSlide.title || "Rate"}</h2>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.5rem", fontSize: "0.75rem", color: "var(--muted)", fontWeight: 600 }}>
                <span>{currentSlide.content?.min_label || currentSlide.content?.min || 1}</span>
                <span>{currentSlide.content?.max_label || currentSlide.content?.max || 10}</span>
              </div>
              <input type="range" min={currentSlide.content?.min ?? 1} max={currentSlide.content?.max ?? 10} value={scaleValue}
                onChange={(e) => setScaleValue(Number(e.target.value))} disabled={submitted || isHost}
                style={{ width: "100%", marginBottom: "1rem" }} />
              <div style={{ fontSize: "2rem", fontWeight: 900, color: "var(--accent)" }}>{scaleValue}</div>
              {!submitted && !isHost && <button onClick={() => submitResponse({ value: scaleValue })} className="btn btn-primary" style={{ marginTop: "1rem" }}>Submit</button>}
              {submitted && <p style={{ color: "var(--success)", fontWeight: 700, marginTop: "1rem" }}>✅ Submitted!</p>}
              {scaleValues.length > 0 && <p style={{ color: "var(--muted)", fontSize: "0.875rem", marginTop: "0.5rem", fontWeight: 700 }}>{shouldShowResults ? `Average: ${scaleAvg} (${scaleValues.length} responses)` : `Responses hidden · ${scaleValues.length} received`}</p>}
            </div>
          )}

          {currentSlide.slide_type === "qna" && (
            <div>
              <h2 className="font-display" style={{ fontSize: "1.5rem", fontWeight: 800, marginBottom: "1.5rem" }}>{currentSlide.title || "Q&A"}</h2>
              {shouldShowResults && qnaQuestions.length > 0 && (
                <div style={{ display: "grid", gap: "0.65rem", marginBottom: "2rem", maxHeight: 360, overflowY: "auto" }}>
                  {qnaQuestions.map((q) => (
                    <div key={q.id} className="card" style={{ padding: "0.75rem 1rem", display: "flex", alignItems: "center", gap: "0.75rem", textAlign: "left" }}>
                      <button onClick={() => upvoteQna(q.id)}
                        style={{ padding: "0.25rem 0.5rem", borderRadius: "var(--radius-lg)", border: "1px solid var(--line)", background: "var(--surface)", cursor: "pointer", fontWeight: 700, fontSize: "0.875rem" }}>▲ {q.upvotes}</button>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600 }}>{q.question}</div>
                        <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>{q.participant_name}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {!isHost && (
                <div className="present-response-row" style={{ display: "flex", gap: "0.5rem", maxWidth: 500, margin: "0 auto" }}>
                  <input value={newQnaQuestion} onChange={(e) => setNewQnaQuestion(e.target.value)} placeholder="Ask a question…"
                    style={{ flex: 1, padding: "0.75rem", border: "1.5px solid var(--line)", borderRadius: "var(--radius-xl)", outline: "none" }}
                    onKeyDown={(e) => { if (e.key === "Enter" && newQnaQuestion.trim()) submitQnaQuestion(); }} />
                  <button onClick={submitQnaQuestion} className="btn btn-primary">Ask</button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {isHost && (
        <div className="present-host-dock" style={{ position: "fixed", left: "50%", bottom: 18, transform: "translateX(-50%)", zIndex: 30, display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.55rem", borderRadius: 999, background: "rgba(15,23,42,0.86)", backdropFilter: "blur(18px)", boxShadow: "0 24px 70px rgba(15,23,42,0.28)", maxWidth: "calc(100vw - 1.5rem)", overflowX: "auto" }}>
          <button onClick={() => { if (channelJoined && channelRef.current) void channelRef.current.prevSlide(); }} disabled={currentIndex === 0 || !channelJoined} style={{ ...dockButtonStyle, opacity: currentIndex === 0 || !channelJoined ? 0.45 : 1 }}>← Prev</button>
          <button onClick={() => { if (channelJoined && channelRef.current) void channelRef.current.nextSlide(); }} disabled={currentIndex === slides.length - 1 || !channelJoined} style={{ ...dockPrimaryButtonStyle, opacity: currentIndex === slides.length - 1 || !channelJoined ? 0.45 : 1 }}>Next →</button>
          <button onClick={() => setShowJoinOverlay(true)} style={dockButtonStyle}>Join</button>
          <button onClick={() => setResultsHidden((v) => !v)} style={dockButtonStyle}>{resultsHidden ? "Reveal" : "Hide"}</button>
          <button onClick={toggleFullscreen} style={dockButtonStyle}>{isFullscreen ? "Exit" : "Fullscreen"}</button>
          <button onClick={() => { if (channelJoined && channelRef.current) void channelRef.current.endPresentation(); }} disabled={!channelJoined} style={{ ...dockButtonStyle, color: "#fecdd3", opacity: !channelJoined ? 0.45 : 1 }}>End</button>
        </div>
      )}

      {!isHost && <div style={{ textAlign: "center", padding: "0.5rem", fontSize: "0.75rem", color: "var(--muted)" }}>{currentIndex + 1} / {slides.length}</div>}
    </div>
  );
}
