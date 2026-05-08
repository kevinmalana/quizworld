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

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      {/* Host controls */}
      {isHost && (
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", padding: "0.5rem 1rem", borderBottom: "1px solid var(--line)", background: "var(--surface)", flexWrap: "wrap" }}>
          <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--muted)" }}>{currentIndex + 1}/{slides.length}</span>
          {joinCode && (
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent("https://www.quizworld.xyz/present/join?code=" + joinCode)}`}
                alt="Scan to join"
                width={150}
                height={150}
                style={{ borderRadius: 10, border: "2px solid var(--line)", width: 150, height: 150 }}
              />
              <div style={{ lineHeight: 1.3 }}>
                <div style={{ fontSize: "0.6rem", fontWeight: 700, color: "var(--muted)" }}>Scan to join</div>
                <div style={{ fontSize: "0.65rem", fontWeight: 600, color: "var(--muted)" }}>quizworld.xyz/present/join</div>
                <div style={{ fontSize: "1.5rem", fontWeight: 900, letterSpacing: "0.2em", color: "var(--accent)" }}>{joinCode}</div>
              </div>
            </div>
          )}
          <div style={{ flex: 1 }} />
          <button onClick={() => {
            if (channelJoined && channelRef.current) void channelRef.current.prevSlide();
          }} disabled={currentIndex === 0 || !channelJoined}
            style={{ padding: "0.35rem 0.75rem", fontSize: "0.75rem", fontWeight: 700, borderRadius: "var(--radius-full)", border: "1px solid var(--line)", background: "var(--surface)", cursor: "pointer" }}>← Prev</button>
          <button onClick={() => {
            if (channelJoined && channelRef.current) void channelRef.current.nextSlide();
          }} disabled={currentIndex === slides.length - 1 || !channelJoined}
            style={{ padding: "0.35rem 0.75rem", fontSize: "0.75rem", fontWeight: 700, borderRadius: "var(--radius-full)", border: "none", background: "var(--accent)", color: "#fff", cursor: "pointer" }}>Next →</button>
          <button onClick={() => {
            if (channelJoined && channelRef.current) void channelRef.current.endPresentation();
          }} disabled={!channelJoined}
            style={{ padding: "0.35rem 0.75rem", fontSize: "0.75rem", fontWeight: 700, borderRadius: "var(--radius-full)", border: "1px solid var(--primary)", background: "transparent", color: "var(--primary)", cursor: "pointer" }}>End</button>
        </div>
      )}

      {channelError && (
        <div style={{ padding: "0.5rem 1rem", background: "#fff7ed", color: "#9a3412", fontSize: "0.8rem", fontWeight: 700, textAlign: "center" }}>
          {channelError} {channelJoined ? "" : "Using read-only fallback until realtime reconnects."}
        </div>
      )}

      {/* Slide content */}
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "2rem" }}>
        <div style={{ maxWidth: 720, width: "100%", textAlign: "center" }}>

          {currentSlide.slide_type === "content" && (
            <div className="card" style={{ padding: "3rem", textAlign: "left" }}>
              <h2 className="font-display" style={{ fontSize: "1.5rem", fontWeight: 800, marginBottom: "1rem" }}>{currentSlide.title}</h2>
              <div style={{ fontSize: "1.125rem", lineHeight: 1.7, whiteSpace: "pre-wrap" }}>{currentSlide.content?.text || ""}</div>
            </div>
          )}

          {currentSlide.slide_type === "word_cloud" && (
            <div>
              <h2 className="font-display" style={{ fontSize: "1.5rem", fontWeight: 800, marginBottom: "1.5rem" }}>{currentSlide.content?.prompt || "What comes to mind?"}</h2>
              {sortedWords.length > 0 ? (
                <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "0.5rem", marginBottom: "2rem" }}>
                  {sortedWords.map(([word, count]) => (
                    <span key={word} style={{ padding: "0.5rem 1rem", borderRadius: "999px", background: "var(--accent-light)", color: "var(--accent)", fontSize: `${Math.min(1 + count * 0.3, 2.5)}rem`, fontWeight: 700 }}>{word} ({count})</span>
                  ))}
                </div>
              ) : <p style={{ color: "var(--muted)", fontSize: "1.125rem" }}>Waiting for responses…</p>}
              {!submitted && !isHost && (
                <div style={{ display: "flex", gap: "0.5rem", maxWidth: 400, margin: "0 auto" }}>
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
              {allResponses.length > 0 && (
                <div style={{ display: "grid", gap: "0.5rem", marginBottom: "2rem", maxHeight: 300, overflowY: "auto" }}>
                  {allResponses.map((r, i) => (
                    <div key={i} className="card" style={{ padding: "0.75rem 1rem", textAlign: "left" }}>
                      <span style={{ fontWeight: 600 }}>{r.response_data?.text as string}</span>
                      <span style={{ fontSize: "0.75rem", color: "var(--muted)", marginLeft: "0.5rem" }}>— {r.participant_name}</span>
                    </div>
                  ))}
                </div>
              )}
              {!submitted && !isHost && (
                <div style={{ display: "flex", gap: "0.5rem", maxWidth: 500, margin: "0 auto" }}>
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
                      <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${pct}%`, background: "var(--accent-light)", transition: "width 0.5s", opacity: 0.3 }} />
                      <div style={{ position: "relative", display: "flex", justifyContent: "space-between" }}>
                        <span style={{ fontWeight: 700 }}>{opt.text}</span>
                        <span style={{ fontWeight: 700, color: "var(--accent)" }}>{pct}% ({count})</span>
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
              {scaleValues.length > 0 && <p style={{ color: "var(--muted)", fontSize: "0.875rem", marginTop: "0.5rem" }}>Average: {scaleAvg} ({scaleValues.length} responses)</p>}
            </div>
          )}

          {currentSlide.slide_type === "qna" && (
            <div>
              <h2 className="font-display" style={{ fontSize: "1.5rem", fontWeight: 800, marginBottom: "1.5rem" }}>{currentSlide.title || "Q&A"}</h2>
              {qnaQuestions.length > 0 && (
                <div style={{ display: "grid", gap: "0.5rem", marginBottom: "2rem", maxHeight: 300, overflowY: "auto" }}>
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
                <div style={{ display: "flex", gap: "0.5rem", maxWidth: 500, margin: "0 auto" }}>
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

      {!isHost && <div style={{ textAlign: "center", padding: "0.5rem", fontSize: "0.75rem", color: "var(--muted)" }}>{currentIndex + 1} / {slides.length}</div>}
    </div>
  );
}
