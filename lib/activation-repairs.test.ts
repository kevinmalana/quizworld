import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const source = (path: string) => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
test('host uses shared paginated catalog and explicit retry without clearing selection', () => {
 const page = source('app/host/page.tsx');
 assert.match(page, /fetchCatalogPage/);
 assert.match(page, /Load more quizzes/);
 assert.match(page, /Retry/);
 assert.doesNotMatch(page, /const q = search\.toLowerCase\(\)/);
});
test('study results offer retry and do not claim unpersisted XP', () => {
 const page = source('app/study/[id]/StudyPageClient.tsx');
 const panel = source('components/study/study-session-panels.tsx');
 assert.match(page, /onRetrySave=/);
 assert.match(page, /qw_pending_study/);
 assert.match(panel, /Retry save/);
 assert.match(panel, /saved \? "⭐ XP Earned"/);
 assert.match(page, /finally/);
});
test('structured paste is parsed before the AI account guard and source input survives login', () => {
 const page = source('app/create/page.tsx');
 const handler = page.slice(page.indexOf('const handlePasteImport'), page.indexOf('const handleUrlFetch'));
 assert.ok(handler.indexOf('parseImportedQuestions') < handler.indexOf('if (!user)'));
 assert.match(page, /useSourceLoginRecovery/);
 assert.match(source("lib/builder/use-source-login-recovery.ts"), /qw_pending_source/);
 assert.match(source('components/builder/CreateSourceModals.tsx'), /Sign in to use AI/);
});

test('classroom insights use student-only completed-work scores', () => {
 const page = source('app/classrooms/[id]/page.tsx');
 assert.match(page, /if \(!studentIds.has\(row.user_id\)\) return/);
 assert.doesNotMatch(page, /map\(c => c.mastery \?\? 0\)/);
 assert.match(page, /average mastery across studied assignments/);
});

test('AWS exam actions preserve the specific code in real discovery', () => {
 const page = source('app/aws-practice-test/page.tsx');
 assert.match(page, /`\/explore\?q=\$\{encodeURIComponent\(exam.code\)\}`/);
 assert.match(page, /source=topic&topic=/);
 assert.match(source('app/create/page.tsx'), /searchParams.get\("topic"\)/);
});
test('onboarding only counts verifiable checklist items', () => {
 const checklist = source('components/shared/OnboardingChecklist.tsx');
 assert.doesNotMatch(checklist, /completed: false/);
});
test('Kahoot comparison states the supported participant capacity', () => {
 const page = source('app/kahoot-alternative/page.tsx');
 assert.doesNotMatch(page, /no participant limits|without the paywalls or participant limits|quizworld: "✅ Unlimited"/i);
 assert.match(page, /200/);
});

test('rendered study results distinguish preview, failed save, persisted XP and sign-in actions', async () => {
 const React = await import('react');
 Object.assign(globalThis, { React });
 const { renderToStaticMarkup } = await import('react-dom/server');
 const { StudyResultPanel } = await import('../components/study/study-session-panels');
 const props = { result: {correct: 1, total: 1, wrongQuestions: []}, mode: 'flashcard' as const,
   saving: false, saveMessage: 'Could not save progress.', onReset() {}, onBack() {} };
 const failed = renderToStaticMarkup(React.createElement(StudyResultPanel, {...props, onRetrySave() {}}));
 assert.match(failed, /XP preview — not saved/);
 assert.match(failed, /Retry save/);
 assert.doesNotMatch(failed, /XP Earned/);
 const guest = renderToStaticMarkup(React.createElement(StudyResultPanel, {...props, onSignIn() {}}));
 assert.match(guest, /Sign in to save this session/);
 const saved = renderToStaticMarkup(React.createElement(StudyResultPanel, {...props, saved: true, totalXp: 175}));
 assert.match(saved, /XP Earned/);
 assert.doesNotMatch(saved, /Retry save|XP preview/);
});

test('host own catalog uses the same bounded, ordered and failure-aware query contract', async () => {
 const { createClient } = await import('@supabase/supabase-js');
 const { fetchCatalogPage } = await import('./catalog-discovery');
 const urls: URL[] = [];
 let fail = true;
 const client = createClient('https://quizworld-local-fixture.invalid', 'fixture', {global: {fetch: async (input, init) => {
   const url = new URL(String(input)); urls.push(url);
   assert.equal(url.searchParams.get('creator_id'), 'eq.owner');
   assert.equal(url.searchParams.has('is_public'), false);
   assert.equal(url.searchParams.get('archived_at'), 'is.null');
   assert.match(url.searchParams.getAll('or').join('&'), /geography/);
   if (fail) return new Response(JSON.stringify({message:'offline'}), {status:503});
   if (init?.method === 'HEAD') return new Response(null, {headers:{'Content-Range':'*/25'}});
   assert.equal(url.searchParams.get('limit'), '24');
   assert.equal(url.searchParams.get('order'), 'plays.desc,id.asc');
   return new Response(JSON.stringify([{id:'last',title:'Geography',plays:1,created_at:'2026-01-01'}]), {headers:{'Content-Type':'application/json'}});
 }}});
 const options = {creatorId:'owner', search:'  GEOgraphy ', cursor:{primary:2,id:'before'}, loadedCount:24};
 await assert.rejects(fetchCatalogPage(client, options), /Could not load/);
 const failed = urls.map(url => url.href);
 fail = false;
 const page = await fetchCatalogPage(client, options);
 assert.equal(page.hasMore, false);
 assert.deepEqual(urls.slice(2).map(url=>url.href).sort(), failed.sort());
});

test('an explicit source template is not replaced by an older local authoring draft', () => {
 assert.match(source('app/create/page.tsx'), /skipLocalRecovery: Boolean\(sourceParam\)/);
 assert.match(source('lib/builder/use-quiz-authoring-recovery.ts'), /if \(skipLocalRecovery \|\| draftParam/);
});

test('guest missed-question review stays free without discarding the original save intent', () => {
 const page=source('app/study/[id]/StudyPageClient.tsx');
 assert.doesNotMatch(page, /onReview=\{saved &&/);
 assert.match(page, /completedAttemptRef/);
});
