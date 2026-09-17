import { test } from 'node:test';
import assert from 'node:assert/strict';
import { publicCatalogUrl, parsePublicPack, parseCatalog, getJson } from './catalog';

const quiz = { id: '15381af4-f5fd-41ed-beb9-0b6e4a57622d', title: 'Example', category: 'Geography', is_public: true, archived_at: null, questions: [{ id: 'q', text: 'Question', question_type: 'multiple_choice', order_index: 0, answers: [{ id: 'a', text: 'A', is_correct: true }, { id: 'b', text: 'B', is_correct: false }] }] };

test('catalog requests only public unarchived quizzes and validates response', () => {
 const url = new URL(publicCatalogUrl('https://example.supabase.co', '  GEOgraphy ', 0));
 assert.equal(url.searchParams.get('is_public'), 'eq.true');
 assert.equal(url.searchParams.get('archived_at'), 'is.null');
 assert.match(url.searchParams.get('or')!, /geography/);
 assert.equal(url.searchParams.get('limit'), '20');
 assert.equal(parseCatalog([quiz])[0].title, 'Example');
 assert.throws(() => parseCatalog([{...quiz, is_public:false}]), /public/i);
});

test('public packs are revisioned and fail closed on private, archived, media or unscored content', () => {
 const pack = parsePublicPack(quiz);
 assert.equal(pack.questions.length, 1);
 assert.equal(pack.revision, parsePublicPack(quiz).revision);
 assert.notEqual(pack.revision, parsePublicPack({...quiz, questions:[{...quiz.questions[0],text:'Revised'}]}).revision);
 for (const change of [{is_public:false}, {archived_at:'2026-01-01'}, {questions:[{...quiz.questions[0],image_url:'https://example.com/image.png'}]}, {questions:[{...quiz.questions[0],question_type:'poll'}]}, {questions:[{...quiz.questions[0],answers:quiz.questions[0].answers.map(a=>({...a,is_correct:false}))}]}]) {
  assert.throws(() => parsePublicPack({...quiz,...change}));
 }
});

test('public transport surfaces HTTP failure rather than treating it as empty', async () => {
 await assert.rejects(getJson('https://example.supabase.co/rest/v1/quizzes', 'public', async () => new Response('{}',{status:503})), /unavailable/i);
});
