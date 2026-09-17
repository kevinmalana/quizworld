import { z } from 'zod';
import {personalStateSchema} from './personal-contract';
const text = z.string().min(1).max(12000);
const id = z.string().min(1).max(200);
const timestamp = z.number().finite().nonnegative();
export const questionSchema = z.object({ id, text, explanation: z.string().max(12000).nullable().optional(), answers: z.array(z.object({ id, text, is_correct: z.boolean() })).min(2).max(8) }).refine(q => q.answers.filter(a => a.is_correct).length === 1 && new Set(q.answers.map(a => a.id)).size === q.answers.length, 'Only single-answer text questions are supported.');
export const packSchema = z.object({ id, revision: id, title: text, category: text, source: z.enum(['bundled', 'public']), sourceLabel: text, questions: z.array(questionSchema).min(1).max(100) }).refine(p => new Set(p.questions.map(q => q.id)).size === p.questions.length);
const mode = z.enum(['quickfire', 'flashcard', 'review']);
export const stateSchema = z.object({
  version: z.literal(1),
  sync: personalStateSchema.optional(),
  active: z.object({ id, pack: packSchema, mode, index: z.number().int().nonnegative(), responses: z.array(z.object({ questionId: id, correct: z.boolean(), answerId: id.nullable() })).max(100), startedAt: timestamp, completedAt: timestamp.nullable() }).refine(s => s.index < s.pack.questions.length && s.responses.length >= s.index && s.responses.length <= s.index + 1 && s.responses.every((r, i) => {
    const question = s.pack.questions[i];
    if (!question || r.questionId !== question.id) return false;
    if (s.mode === 'flashcard') return r.answerId === null;
    const answer = question.answers.find(a => a.id === r.answerId);
    return !!answer && r.correct === answer.is_correct;
  }) && (s.completedAt === null || s.responses.length === s.pack.questions.length)).nullable(),
  reviews: z.array(z.object({ key: z.string().max(1000), packId: id, revision: id, title: text, category: text, source: z.enum(['bundled', 'public']), sourceLabel: text, question: questionSchema, dueAt: timestamp, successes: z.number().int().nonnegative() })).max(500),
  history: z.array(z.object({ id, title: text, mode, correct: z.number().int().nonnegative(), total: z.number().int().positive(), completedAt: timestamp }).refine(h => h.correct <= h.total)).max(100),
});
