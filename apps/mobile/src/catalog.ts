import { z } from 'zod';
import { personalRevision } from './personal-revision';
import { packSchema } from './schema';
import type { Pack } from './study/types';

const uuid = z.string().uuid();
const rowSchema = z.object({ id: uuid, title: z.string().min(1).max(1000), category: z.string().max(200).nullable(), is_public: z.literal(true), archived_at: z.null(), questions: z.array(z.object({ id: z.string() })).max(1000).default([]) });
export type CatalogItem = { id: string; title: string; category: string; count: number };
export function parseCatalog(value: unknown): CatalogItem[] {
  const result = z.array(rowSchema).max(20).safeParse(value);
  if (!result.success) throw new Error('The public catalog returned unsupported data.');
  return result.data.map(r => ({ id: r.id, title: r.title, category: r.category || 'Other', count: r.questions.length }));
}
const questionRow = z.object({ id: z.string(), text: z.string(), explanation: z.string().nullable().optional(), image_url: z.string().nullable().optional(), video_url: z.string().nullable().optional(), question_type: z.enum(['multiple_choice', 'true_false']), order_index: z.number(), answers: z.array(z.object({ id: z.string(), text: z.string(), is_correct: z.boolean(), image_url: z.string().nullable().optional() })) });
export function parsePublicPack(value: unknown): Pack {
  const raw = rowSchema.extend({ questions: z.array(questionRow).min(1).max(100) }).safeParse(value);
  if (!raw.success || raw.data.questions.some(q => q.image_url || q.video_url || q.answers.some(a => a.image_url))) {
    throw new Error('This quiz is not available for native practice. Only public text quizzes with one correct answer per question are supported. Try another quiz or open the website.');
  }
  const questions = [...raw.data.questions].sort((a,b) => a.order_index - b.order_index || a.id.localeCompare(b.id)).map(q => ({ id:q.id, text:q.text, explanation:q.explanation, answers: [...q.answers].sort((a,b)=>a.id.localeCompare(b.id)).map(a=>({id:a.id,text:a.text,is_correct:a.is_correct})) }));
  const result = packSchema.safeParse({ id: raw.data.id, title: raw.data.title, category: raw.data.category || 'Other', source: 'public', sourceLabel: 'Public QuizWorld quiz · author-provided answers', revision: personalRevision({id:raw.data.id,title:raw.data.title,category:raw.data.category||'Other',questions}), questions });
  if (!result.success) throw new Error('This quiz needs a complete set of text answers and exactly one correct answer per question.');
  return result.data;
}
export function publicCatalogUrl(origin: string, search = '', page = 0): string {
  const url = new URL('/rest/v1/quizzes', origin);
  url.searchParams.set('select', 'id,title,category,is_public,archived_at,questions(id)');
  url.searchParams.set('is_public','eq.true'); url.searchParams.set('archived_at','is.null');
  url.searchParams.set('order','title.asc,id.asc'); url.searchParams.set('limit','20');
  url.searchParams.set('offset', String(Math.max(0, Math.floor(page)) * 20));
  const term = search.trim().replace(/\s+/g,' ').toLowerCase().slice(0,100);
  if (term) {
    const literal = term.replace(/[\\%_*]/g, '\\$&').replace(/"/g,'\\"');
    url.searchParams.set('or', `(title.ilike."%${literal}%",category.ilike."%${literal}%")`);
  }
  return url.toString();
}
export function publicPackUrl(origin: string, id: string): string {
  uuid.parse(id);
  const url = new URL(publicCatalogUrl(origin));
  url.searchParams.set('id',`eq.${id}`);
  url.searchParams.set('select','id,title,category,is_public,archived_at,questions(id,text,explanation,image_url,video_url,question_type,order_index,answers(id,text,is_correct,image_url))');
  return url.toString();
}
export class CatalogConnectionError extends Error {
  constructor() { super('Could not connect. Try again when you are online.'); }
}
export async function getJson(url: string, publicKey: string, transport: typeof fetch = fetch): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const response = await transport(url, { method:'GET', headers:{ apikey:publicKey, Accept:'application/json' }, signal:controller.signal, credentials:'omit' });
    if (!response.ok) throw new Error('Public quizzes are unavailable right now. Your saved practice is still here.');
    const text = await response.text();
    if (text.length > 1_000_000) throw new Error('This quiz is too large for this version.');
    return JSON.parse(text);
  } catch (error) {
    if (controller.signal.aborted || error instanceof TypeError) throw new CatalogConnectionError();
    throw error;
  } finally { clearTimeout(timer); }
}
