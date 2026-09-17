import type { Mode, Pack, StudyState } from './types';
export const emptyState = (): StudyState => ({ version: 1, active: null, reviews: [], history: [] });
export function startSession(state: StudyState, pack: Pack, mode: Mode, id: string, now: number): StudyState {
  if (!pack.questions.length) throw new Error('This quiz has no supported questions.');
  if (state.active && !state.active.completedAt) throw new Error('Finish or discard the current session first.');
  return { ...state, active: { id, pack, mode, index: 0, responses: [], startedAt: now, completedAt: null } };
}
export function answerCurrent(state: StudyState, answer: string | boolean, now: number): StudyState {
  const session = state.active;
  if (!session || session.completedAt !== null || session.responses.length > session.index) return state;
  const question = session.pack.questions[session.index];
  const selected = typeof answer === 'string' ? question.answers.find(a => a.id === answer) : null;
  if (typeof answer === 'string' && !selected) throw new Error('Choose an answer from this question.');
  if (typeof answer === 'boolean' && session.mode !== 'flashcard') throw new Error('Only flashcards support self-assessment.');
  const correct = typeof answer === 'boolean' ? answer : selected!.is_correct;
  const key = JSON.stringify([session.pack.id, session.pack.revision, question.id]);
  const previous = state.reviews.find(r => r.key === key);
  let reviews = state.reviews;
  if (!correct || previous) {
    const successes = correct ? (previous?.successes ?? 0) + 1 : 0;
    const days = successes === 1 ? 1 : successes === 2 ? 3 : 7;
    const review = { key, packId: session.pack.id, revision: session.pack.revision, title: session.pack.title, category: session.pack.category, source: session.pack.source, sourceLabel: session.pack.sourceLabel, question, dueAt: correct ? now + days * 86400000 : now, successes };
    reviews = [...reviews.filter(r => r.key !== key), review];
  }
  return { ...state, reviews, active: { ...session, responses: [...session.responses, { questionId: question.id, correct, answerId: typeof answer === 'string' ? answer : null }] } };
}
export function advanceSession(state: StudyState, now: number): StudyState {
  const session = state.active;
  if (!session || session.completedAt !== null || session.responses.length <= session.index) return state;
  if (session.index + 1 < session.pack.questions.length) return { ...state, active: { ...session, index: session.index + 1 } };
  const result = { id: session.id, title: session.pack.title, mode: session.mode, correct: session.responses.filter(a => a.correct).length, total: session.responses.length, completedAt: now };
  return { ...state, active: { ...session, completedAt: now }, history: [result, ...state.history.filter(h => h.id !== session.id)].slice(0, 100) };
}
