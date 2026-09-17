// Only erased, platform-neutral contracts are reused from the website.
import type { StudyQuestion } from '../../../../lib/study/types';
export type Question = StudyQuestion & { answers: NonNullable<StudyQuestion['answers']> };
export type Pack = { id: string; revision: string; title: string; category: string; source: 'bundled' | 'public'; sourceLabel: string; questions: Question[] };
export type Mode = 'quickfire' | 'flashcard' | 'review';
export type Response = { questionId: string; correct: boolean; answerId: string | null };
export type Session = { id: string; pack: Pack; mode: Mode; index: number; responses: Response[]; startedAt: number; completedAt: number | null };
export type Review = { key: string; packId: string; revision: string; title: string; category: string; source: Pack['source']; sourceLabel: string; question: Question; dueAt: number; successes: number };
export type History = { id: string; title: string; mode: Mode; correct: number; total: number; completedAt: number };
export type StudyState = { version: 1; active: Session | null; reviews: Review[]; history: History[]; sync?: import('../personal-contract').PersonalState };
