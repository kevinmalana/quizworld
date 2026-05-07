"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { useAuth } from "@/components/supabase-provider";
import type { Slide, SlideResponse, QnaQuestion } from "@/lib/presentation/types";
import { getParticipantId, getParticipantName, setParticipantName } from "@/lib/presentation/types";

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

  // Audience state
  const [name, setName] = useState("");
  const [nameSet, setNameSet] = useState(false);
  const [response, setResponse] = useState("");
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [scaleValue, setScaleValue] = useState(5);
  const [submitted, setSubmitted] = useState(false);
  const [allResponses, setAllResponses] = useState<SlideResponse[]>([]);
  const [qnaQuestions, setQnaQuestions] = useState<QnaQuestion[]>([]);
  const [newQnaQuestion, setNewQnaQuestion] = useState("");

  const participantId = getParticipantId();

  // Load presentation
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
      setIsHost(user?.id === pres.creator_id);
      const sorted = (pres.slides || []).sort((a: Slide, b: Slide) => a.order_index - b.order_index);
      setSlides(sorted);

      // Check if name is saved
      const savedName = getParticipantName();
      if (savedName !== "Anonymous") {
        setName(savedName);
        setNameSet(true);
      }

      setLoading(false);
    }
    load();
  }, [code, user, router]);

  // Poll for updates
  useEffect(() => {
    if (loading) return;

    const interval = setInterval(async () => {
      const { data: pres } = await supabase
        .from("presentations")
        .select("*, slides(*)")
        .eq("id", code)
        .single();

      if (pres) {
        const sorted = (pres.slides || []).sort((a: Slide, b: Slide) => a.order_index - b.order_index);
        setSlides(sorted);

        // Load responses for current slide
        if (sorted[currentIndex]) {
          const { data: responses } = await supabase
            .from("slide_responses")
            .select("*")
            .eq("slide_id", sorted[currentIndex].id)
            .order("created_at", { ascending: false });
          setAllResponses((responses || []) as SlideResponse[]);

          // Load Q&A questions
          if (sorted[currentIndex].slide_type === "qna") {
            const { data: qnas } = await supabase
              .from("qna_questions")
              .select("*")
              .eq("slide_id", sorted[currentIndex].id)
              .order("upvotes", { ascending: false });
            setQnaQuestions((qnas || []) as QnaQuestion[]);
          }
        }
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [code, currentIndex, loading]);

  // Check if already submitted
  useEffect(() => {
    if (!slides[currentIndex]) return;
    const alreadySubmitted = allResponses.some(r => r.participant_id === participantId);
    setSubmitted(alreadySubmitted);
    if (!alreadySubmitted) {
      setResponse("");
      setSelectedOption(null);
      setScaleValue(slides[currentIndex].content?.min ?? 1);
    }
  }, [currentIndex, allResponses, participantId, slides]);

  // Submit response
  const submitResponse = useCallback(async (data: Record<string, unknown>) => {
    if (!slides[currentIndex] || submitted) return;

    await supabase.from("slide_responses").insert({
      slide_id: slides[currentIndex].id,
      participant_id: participantId,
      participant_name: name || "Anonymous",
      response_data: data,
    });

    setSubmitted(true);

    // Refresh responses
    const { data: responses } = await supabase
      .from("slide_responses")
      .select("*")
      .eq("slide_id", slides[currentIndex].id)
      .order("created_at", { ascending: false });
    setAllResponses((responses || []) as SlideResponse[]);
  }, [currentIndex, slides, participantId, name, submitted]);

  // Submit Q&A question
  const submitQnaQuestion = useCallback(async () => {
    if (!newQnaQuestion.trim() || !slides[currentIndex]) return;

    await supabase.from("qna_questions").insert({
      slide_id: slides[currentIndex].id,
      participant_id: participantId,
      participant_name: name || "Anonymous",
      question: newQnaQuestion.trim(),
    });

    setNewQnaQuestion("");

    const { data: qnas } = await supabase
      .from("qna_questions")
      .select("*")
      .eq("slide_id", slides[currentIndex].id)
      .order("upvotes", { ascending: false });
    setQnaQuestions((qnas || []) as QnaQuestion[]);
  }, [currentIndex, slides, participantId, name, newQnaQuestion]);

  // Upvote Q&A question
  const upvoteQna = useCallback(async (qnaId: string, currentUpvotes: number) => {
    await supabase.from("qna_questions").update({ upvotes: currentUpvotes + 1 }).eq("id", qnaId);
    const { data: qnas } = await supabase
      .from("qna_questions")
      .select("*")
      .eq("slide_id", slides[currentIndex].id)
      .order("upvotes", { ascending: false });
    setQnaQuestions((qnas || []) as QnaQuestion[]);
  }, [currentIndex, slides]);

  if (loading) {
    return <div className="container" style={{ paddingTop: "4rem", textAlign: "center" }}>Loading...</div>;
  }

  // Name entry screen
  if (!nameSet && !isHost) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "2rem" }}>
        <div className="card" style={{ padding: "2rem", maxWidth: 400, width: "100%", textAlign: "center" }}>
          <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>🎤</div>
          <h1 className="font-display" style={{ fontSize: "1.5rem", fontWeight: 800, marginBottom: "0.5rem" }}>{title}</h1>
          <p style={{ color: "var(--muted)", marginBottom: "1.5rem" }}>Enter your name to join</p>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name…"
            style={{ width: "100%", padding: "0.75rem 1rem", fontSize: "1rem", border: "1.5px solid var(--line)", borderRadius: "var(--radius-xl)", outline: "none", marginBottom: "1rem" }}
            onKeyDown={(e) => { if (e.key === "Enter" && name.trim()) { setParticipantName(name.trim()); setNameSet(true); } }}
            autoFocus
          />
          <button
            onClick={() => { setParticipantName(name.trim() || "Anonymous"); setNameSet(true); }}
            disabled={!name.trim()}
            className="btn btn-primary btn-lg"
            style={{ width: "100%" }}
          >
            Join Presentation
          </button>
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
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.5rem 1rem", borderBottom: "1px solid var(--line)", background: "var(--surface)" }}>
          <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--muted)" }}>{currentIndex + 1}/{slides.length}</span>
          <div style={{ flex: 1 }} />
          <span style={{ fontSize: "0.7rem", fontWeight: 700, color: "var(--accent)" }}>Code: {joinCode}</span>
          <button
            onClick={() => setCurrentIndex(Math.max(0, currentIndex - 1))}
            disabled={currentIndex === 0}
            style={{ padding: "0.35rem 0.75rem", fontSize: "0.75rem", fontWeight: 700, borderRadius: "var(--radius-full)", border: "1px solid var(--line)", background: "var(--surface)", cursor: "pointer" }}
          >← Prev</button>
          <button
            onClick={() => setCurrentIndex(Math.min(slides.length - 1, currentIndex + 1))}
            disabled={currentIndex === slides.length - 1}
            style={{ padding: "0.35rem 0.75rem", fontSize: "0.75rem", fontWeight: 700, borderRadius: "var(--radius-full)", border: "none", background: "var(--accent)", color: "#fff", cursor: "pointer" }}
          >Next →</button>
          <button
            onClick={async () => {
              await supabase.from("presentations").update({ status: "finished", finished_at: new Date().toISOString() }).eq("id", code);
              router.push(`/present/${code}/report`);
            }}
            style={{ padding: "0.35rem 0.75rem", fontSize: "0.75rem", fontWeight: 700, borderRadius: "var(--radius-full)", border: "1px solid var(--primary)", background: "transparent", color: "var(--primary)", cursor: "pointer" }}
          >End</button>
        </div>
      )}

      {/* Slide content */}
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "2rem" }}>
        <div style={{ maxWidth: 720, width: "100%", textAlign: "center" }}>

          {/* Content slide */}
          {currentSlide.slide_type === "content" && (
            <div className="card" style={{ padding: "3rem", textAlign: "left" }}>
              <h2 className="font-display" style={{ fontSize: "1.5rem", fontWeight: 800, marginBottom: "1rem" }}>{currentSlide.title}</h2>
              <div style={{ fontSize: "1.125rem", lineHeight: 1.7, whiteSpace: "pre-wrap" }}>{currentSlide.content?.text || ""}</div>
            </div>
          )}

          {/* Word Cloud */}
          {currentSlide.slide_type === "word_cloud" && (
            <div>
              <h2 className="font-display" style={{ fontSize: "1.5rem", fontWeight: 800, marginBottom: "1.5rem" }}>{currentSlide.content?.prompt || "What comes to mind?"}</h2>
              {sortedWords.length > 0 ? (
                <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "0.5rem", marginBottom: "2rem" }}>
                  {sortedWords.map(([word, count]) => (
                    <span
                      key={word}
                      style={{
                        padding: "0.5rem 1rem", borderRadius: "999px",
                        background: "var(--accent-light)", color: "var(--accent)",
                        fontSize: `${Math.min(1 + count * 0.3, 2.5)}rem`, fontWeight: 700,
                      }}
                    >{word} ({count})</span>
                  ))}
                </div>
              ) : (
                <p style={{ color: "var(--muted)", fontSize: "1.125rem" }}>Waiting for responses…</p>
              )}
              {!submitted && !isHost && (
                <div style={{ display: "flex", gap: "0.5rem", maxWidth: 400, margin: "0 auto" }}>
                  <input
                    value={response}
                    onChange={(e) => setResponse(e.target.value)}
                    placeholder="Type a word…"
                    style={{ flex: 1, padding: "0.75rem", border: "1.5px solid var(--line)", borderRadius: "var(--radius-xl)", outline: "none" }}
                    onKeyDown={(e) => { if (e.key === "Enter" && response.trim()) { void submitResponse({ words: response.trim() }); } }}
                  />
                  <button onClick={() => { if (response.trim()) void submitResponse({ words: response.trim() }); }} className="btn btn-primary">Submit</button>
                </div>
              )}
              {submitted && <p style={{ color: "var(--success)", fontWeight: 700, marginTop: "1rem" }}>✅ Submitted!</p>}
            </div>
          )}

          {/* Open Text */}
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
                  <input
                    value={response}
                    onChange={(e) => setResponse(e.target.value)}
                    placeholder="Type your response…"
                    style={{ flex: 1, padding: "0.75rem", border: "1.5px solid var(--line)", borderRadius: "var(--radius-xl)", outline: "none" }}
                    onKeyDown={(e) => { if (e.key === "Enter" && response.trim()) void submitResponse({ text: response.trim() }); }}
                  />
                  <button onClick={() => { if (response.trim()) void submitResponse({ text: response.trim() }); }} className="btn btn-primary">Submit</button>
                </div>
              )}
              {submitted && <p style={{ color: "var(--success)", fontWeight: 700, marginTop: "1rem" }}>✅ Submitted!</p>}
            </div>
          )}

          {/* Poll */}
          {currentSlide.slide_type === "poll" && (
            <div>
              <h2 className="font-display" style={{ fontSize: "1.5rem", fontWeight: 800, marginBottom: "1.5rem" }}>{currentSlide.title || "Vote"}</h2>
              <div style={{ display: "grid", gap: "0.75rem", maxWidth: 400, margin: "0 auto" }}>
                {(currentSlide.content?.options || []).map((opt) => {
                  const count = pollCounts[opt.id] || 0;
                  const total = Object.values(pollCounts).reduce((s, c) => s + c, 0);
                  const pct = total > 0 ? Math.round(count / total * 100) : 0;
                  return (
                    <button
                      key={opt.id}
                      onClick={() => { if (!submitted && !isHost) { setSelectedOption(opt.id); void submitResponse({ option_id: opt.id }); } }}
                      disabled={submitted || isHost}
                      style={{
                        padding: "1rem", borderRadius: "var(--radius-xl)", border: selectedOption === opt.id ? "2px solid var(--accent)" : "1.5px solid var(--line)",
                        background: selectedOption === opt.id ? "var(--accent-light)" : "var(--surface)", cursor: submitted || isHost ? "default" : "pointer",
                        textAlign: "left", position: "relative", overflow: "hidden",
                      }}
                    >
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

          {/* Quiz */}
          {currentSlide.slide_type === "quiz" && (
            <div>
              <h2 className="font-display" style={{ fontSize: "1.5rem", fontWeight: 800, marginBottom: "1.5rem" }}>{currentSlide.title || "Quiz"}</h2>
              <div style={{ display: "grid", gap: "0.75rem", maxWidth: 500, margin: "0 auto" }}>
                {(currentSlide.content?.answers || []).map((ans, i) => (
                  <button
                    key={ans.id}
                    onClick={() => { if (!submitted && !isHost) void submitResponse({ answer_id: ans.id, is_correct: ans.is_correct }); }}
                    disabled={submitted || isHost}
                    style={{
                      padding: "1rem", borderRadius: "var(--radius-xl)", border: "1.5px solid var(--line)",
                      background: submitted && ans.is_correct ? "var(--accent-light)" : "var(--surface)",
                      cursor: submitted || isHost ? "default" : "pointer", textAlign: "left",
                      display: "flex", alignItems: "center", gap: "0.75rem",
                    }}
                  >
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

          {/* Scale */}
          {currentSlide.slide_type === "scale" && (
            <div>
              <h2 className="font-display" style={{ fontSize: "1.5rem", fontWeight: 800, marginBottom: "1.5rem" }}>{currentSlide.title || "Rate"}</h2>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.5rem", fontSize: "0.75rem", color: "var(--muted)", fontWeight: 600 }}>
                <span>{currentSlide.content?.min_label || currentSlide.content?.min || 1}</span>
                <span>{currentSlide.content?.max_label || currentSlide.content?.max || 10}</span>
              </div>
              <input
                type="range"
                min={currentSlide.content?.min ?? 1}
                max={currentSlide.content?.max ?? 10}
                value={scaleValue}
                onChange={(e) => setScaleValue(Number(e.target.value))}
                disabled={submitted || isHost}
                style={{ width: "100%", marginBottom: "1rem" }}
              />
              <div style={{ fontSize: "2rem", fontWeight: 900, color: "var(--accent)" }}>{scaleValue}</div>
              {!submitted && !isHost && (
                <button onClick={() => void submitResponse({ value: scaleValue })} className="btn btn-primary" style={{ marginTop: "1rem" }}>Submit</button>
              )}
              {submitted && <p style={{ color: "var(--success)", fontWeight: 700, marginTop: "1rem" }}>✅ Submitted!</p>}
              {scaleValues.length > 0 && (
                <p style={{ color: "var(--muted)", fontSize: "0.875rem", marginTop: "0.5rem" }}>Average: {scaleAvg} ({scaleValues.length} responses)</p>
              )}
            </div>
          )}

          {/* Q&A */}
          {currentSlide.slide_type === "qna" && (
            <div>
              <h2 className="font-display" style={{ fontSize: "1.5rem", fontWeight: 800, marginBottom: "1.5rem" }}>{currentSlide.title || "Q&A"}</h2>
              {qnaQuestions.length > 0 && (
                <div style={{ display: "grid", gap: "0.5rem", marginBottom: "2rem", maxHeight: 300, overflowY: "auto" }}>
                  {qnaQuestions.map((q) => (
                    <div key={q.id} className="card" style={{ padding: "0.75rem 1rem", display: "flex", alignItems: "center", gap: "0.75rem", textAlign: "left" }}>
                      <button
                        onClick={() => void upvoteQna(q.id, q.upvotes)}
                        style={{ padding: "0.25rem 0.5rem", borderRadius: "var(--radius-lg)", border: "1px solid var(--line)", background: "var(--surface)", cursor: "pointer", fontWeight: 700, fontSize: "0.875rem" }}
                      >▲ {q.upvotes}</button>
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
                  <input
                    value={newQnaQuestion}
                    onChange={(e) => setNewQnaQuestion(e.target.value)}
                    placeholder="Ask a question…"
                    style={{ flex: 1, padding: "0.75rem", border: "1.5px solid var(--line)", borderRadius: "var(--radius-xl)", outline: "none" }}
                    onKeyDown={(e) => { if (e.key === "Enter" && newQnaQuestion.trim()) void submitQnaQuestion(); }}
                  />
                  <button onClick={submitQnaQuestion} className="btn btn-primary">Ask</button>
                </div>
              )}
            </div>
          )}

        </div>
      </div>

      {/* Slide indicator */}
      {!isHost && (
        <div style={{ textAlign: "center", padding: "0.5rem", fontSize: "0.75rem", color: "var(--muted)" }}>
          {currentIndex + 1} / {slides.length}
        </div>
      )}
    </div>
  );
}
