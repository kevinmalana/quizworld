import type { QnaQuestion, Slide, SlideResponse } from "@/lib/presentation/types";

type WordCloudWord = [string, number];

type LiveSlideStageProps = {
  currentSlide: Slide;
  isHost: boolean;
  resultsHidden: boolean;
  responseCount: number;
  allResponses: SlideResponse[];
  qnaQuestions: QnaQuestion[];
  sortedWords: WordCloudWord[];
  pollCounts: Record<string, number>;
  scaleValues: number[];
  scaleAvg: number;
  response: string;
  selectedOption: string | null;
  scaleValue: number;
  submitted: boolean;
  newQnaQuestion: string;
  setResponse: (value: string) => void;
  setScaleValue: (value: number) => void;
  setSelectedOption: (value: string | null) => void;
  setNewQnaQuestion: (value: string) => void;
  submitResponse: (data: Record<string, unknown>) => void;
  submitQnaQuestion: () => void;
  upvoteQna: (qnaId: string) => void;
};

export function LiveSlideStage({
  currentSlide,
  isHost,
  resultsHidden,
  responseCount,
  allResponses,
  qnaQuestions,
  sortedWords,
  pollCounts,
  scaleValues,
  scaleAvg,
  response,
  selectedOption,
  scaleValue,
  submitted,
  newQnaQuestion,
  setResponse,
  setScaleValue,
  setSelectedOption,
  setNewQnaQuestion,
  submitResponse,
  submitQnaQuestion,
  upvoteQna,
}: LiveSlideStageProps) {
  const shouldShowResults = !isHost || !resultsHidden;

  return (
    <div className={isHost ? "present-live-stage is-host" : "present-live-stage"}>
      <div className={isHost ? "present-live-content is-host" : "present-live-content"}>
        {currentSlide.slide_type === "content" && (
          <div className="card present-slide-card present-slide-card--content">
            <h2 className="font-display present-slide-title">{currentSlide.title}</h2>
            {currentSlide.content?.image_url && (
              <div className="present-slide-image">
                <img src={currentSlide.content.image_url} alt={currentSlide.title || "Slide"} />
              </div>
            )}
            {currentSlide.content?.text && (
              <div className="present-content-text">{currentSlide.content.text}</div>
            )}
          </div>
        )}

        {currentSlide.slide_type === "word_cloud" && (
          <div>
            <h2 className="font-display present-slide-title is-centered">{currentSlide.content?.prompt || "What comes to mind?"}</h2>
            {shouldShowResults && sortedWords.length > 0 ? (
              <div className="present-word-cloud">
                {sortedWords.map(([word, count]) => (
                  <span key={word} className="present-word-chip" style={{ fontSize: `${Math.min(1 + count * 0.3, 2.8)}rem` }}>{word}</span>
                ))}
              </div>
            ) : <p className="present-waiting-text">{resultsHidden && isHost ? `Responses hidden · ${responseCount} received` : "Waiting for responses…"}</p>}
            {!submitted && !isHost && (
              <div className="present-response-row present-response-row--word">
                <input value={response} onChange={(e) => setResponse(e.target.value)} placeholder="Type a word…"
                  className="present-response-input"
                  onKeyDown={(e) => { if (e.key === "Enter" && response.trim()) submitResponse({ words: response.trim() }); }} />
                <button onClick={() => { if (response.trim()) submitResponse({ words: response.trim() }); }} className="btn btn-primary">Submit</button>
              </div>
            )}
            {submitted && <p className="present-submitted-text">✅ Submitted!</p>}
          </div>
        )}

        {currentSlide.slide_type === "open_text" && (
          <div>
            <h2 className="font-display present-slide-title is-centered">{currentSlide.content?.question || "What do you think?"}</h2>
            {shouldShowResults && allResponses.length > 0 && (
              <div className="present-response-list">
                {allResponses.map((r, i) => (
                  <div key={i} className="card present-open-response">
                    <span className="present-open-response-text">{r.response_data?.text as string}</span>
                    <span className="present-response-author">— {r.participant_name}</span>
                  </div>
                ))}
              </div>
            )}
            {isHost && resultsHidden && <p className="present-waiting-text with-space">Responses hidden · {responseCount} received</p>}
            {!submitted && !isHost && (
              <div className="present-response-row present-response-row--open">
                <input value={response} onChange={(e) => setResponse(e.target.value)} placeholder="Type your response…"
                  className="present-response-input"
                  onKeyDown={(e) => { if (e.key === "Enter" && response.trim()) submitResponse({ text: response.trim() }); }} />
                <button onClick={() => { if (response.trim()) submitResponse({ text: response.trim() }); }} className="btn btn-primary">Submit</button>
              </div>
            )}
            {submitted && <p className="present-submitted-text">✅ Submitted!</p>}
          </div>
        )}

        {currentSlide.slide_type === "poll" && (
          <div>
            <h2 className="font-display present-slide-title is-centered">{currentSlide.title || "Vote"}</h2>
            <div className="present-option-list present-option-list--poll">
              {(currentSlide.content?.options || []).map((opt) => {
                const count = pollCounts[opt.id] || 0;
                const total = Object.values(pollCounts).reduce((s, c) => s + c, 0);
                const pct = total > 0 ? Math.round(count / total * 100) : 0;
                return (
                  <button key={opt.id} onClick={() => { if (!submitted && !isHost) { setSelectedOption(opt.id); submitResponse({ option_id: opt.id }); } }}
                    disabled={submitted || isHost}
                    className={selectedOption === opt.id ? "present-poll-option is-selected" : "present-poll-option"}>
                    {shouldShowResults && <div className="present-poll-bar" style={{ width: `${pct}%` }} />}
                    <div className="present-poll-option-content">
                      <span className={isHost ? "present-poll-label is-host" : "present-poll-label"}>{opt.text}</span>
                      <span className="present-poll-result">{shouldShowResults ? `${pct}% (${count})` : "Hidden"}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {currentSlide.slide_type === "quiz" && (
          <div>
            <h2 className="font-display present-slide-title is-centered">{currentSlide.title || "Quiz"}</h2>
            <div className="present-option-list present-option-list--quiz">
              {(currentSlide.content?.answers || []).map((ans, i) => (
                <button key={ans.id} onClick={() => { if (!submitted && !isHost) submitResponse({ answer_id: ans.id, is_correct: ans.is_correct }); }}
                  disabled={submitted || isHost}
                  className={submitted && ans.is_correct ? "present-quiz-option is-correct" : "present-quiz-option"}>
                  <span className="present-answer-letter">{String.fromCharCode(65 + i)}</span>
                  <span className="present-answer-text">{ans.text}</span>
                  {submitted && ans.is_correct && <span className="present-correct-mark">✅</span>}
                </button>
              ))}
            </div>
            {submitted && <p className="present-submitted-text">✅ Answered!</p>}
            <p className="present-response-count">{allResponses.length} responses</p>
          </div>
        )}

        {currentSlide.slide_type === "scale" && (
          <div>
            <h2 className="font-display present-slide-title is-centered">{currentSlide.title || "Rate"}</h2>
            <div className="present-scale-labels">
              <span>{currentSlide.content?.min_label || currentSlide.content?.min || 1}</span>
              <span>{currentSlide.content?.max_label || currentSlide.content?.max || 10}</span>
            </div>
            <input type="range" min={currentSlide.content?.min ?? 1} max={currentSlide.content?.max ?? 10} value={scaleValue}
              onChange={(e) => setScaleValue(Number(e.target.value))} disabled={submitted || isHost}
              className="present-scale-input" />
            <div className="present-scale-value">{scaleValue}</div>
            {!submitted && !isHost && <button onClick={() => submitResponse({ value: scaleValue })} className="btn btn-primary present-scale-submit">Submit</button>}
            {submitted && <p className="present-submitted-text">✅ Submitted!</p>}
            {scaleValues.length > 0 && <p className="present-scale-summary">{shouldShowResults ? `Average: ${scaleAvg} (${scaleValues.length} responses)` : `Responses hidden · ${scaleValues.length} received`}</p>}
          </div>
        )}

        {currentSlide.slide_type === "qna" && (
          <div>
            <h2 className="font-display present-slide-title is-centered">{currentSlide.title || "Q&A"}</h2>
            {shouldShowResults && qnaQuestions.length > 0 && (
              <div className="present-qna-list">
                {qnaQuestions.map((q) => (
                  <div key={q.id} className="card present-qna-item">
                    <button onClick={() => upvoteQna(q.id)} className="present-qna-upvote">▲ {q.upvotes}</button>
                    <div className="present-qna-body">
                      <div className="present-qna-question">{q.question}</div>
                      <div className="present-qna-author">{q.participant_name}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {!isHost && (
              <div className="present-response-row present-response-row--open">
                <input value={newQnaQuestion} onChange={(e) => setNewQnaQuestion(e.target.value)} placeholder="Ask a question…"
                  className="present-response-input"
                  onKeyDown={(e) => { if (e.key === "Enter" && newQnaQuestion.trim()) submitQnaQuestion(); }} />
                <button onClick={submitQnaQuestion} className="btn btn-primary">Ask</button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
