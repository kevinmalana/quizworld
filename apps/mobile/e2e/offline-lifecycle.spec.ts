import { test, expect } from '@playwright/test';

const quiz = { id: '15381af4-f5fd-41ed-beb9-0b6e4a57622d', title: 'Lifecycle fixture', category: 'Test', is_public: true, archived_at: null, questions: [{ id: 'q', text: 'Public fixture question?', question_type: 'multiple_choice', order_index: 0, answers: [{ id: 'a', text: 'Public answer A', is_correct: true }, { id: 'b', text: 'Public answer B', is_correct: false }] }] };

test('public answer rechecks offline, revision and revocation without any completion upload; clear removes cache', async ({ page }) => {
  let mode: 'current' | 'offline' | 'changed' | 'revoked' | 'pending' = 'current';
  let release!: () => void;
  const pending = new Promise<void>(resolve => { release = resolve; });
  const writes: string[] = [];
  await page.route('https://**/*', async route => {
    if (route.request().method() !== 'GET') writes.push(route.request().url());
    if (!route.request().url().startsWith('https://quizworld-mobile-fixture.invalid/rest/v1/quizzes?')) return route.abort();
    if (mode === 'offline') return route.abort('internetdisconnected');
    if (mode === 'pending') await pending;
    return route.fulfill({ json: mode === 'revoked' ? [] : [{ ...quiz, questions: mode === 'changed' ? [{ ...quiz.questions[0], text: 'New revision' }] : quiz.questions }] });
  });
  await page.goto('/');
  await page.getByRole('tab', { name: 'Library', exact: true }).click();
  await page.getByRole('button', { name: 'Browse public quizzes' }).click();
  await page.getByRole('button', { name: `Open ${quiz.title}`, exact: true }).click();
  await page.getByRole('button', { name: 'Start quickfire', exact: true }).click();
  await expect(page.getByText('Public fixture question?', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Public answer B', exact: true }).click();
  mode = 'offline';
  await page.getByRole('button', { name: 'Check answer', exact: true }).click();
  await expect(page.getByText('Offline · public practice paused', { exact: true })).toBeVisible();
  await expect(page.getByText('Public fixture question?', { exact: true })).toHaveCount(0);
  const saved = () => page.evaluate(() => JSON.parse(localStorage.getItem('quizworld:guest-study:v1')!));
  expect((await saved()).active.responses).toEqual([]);
  mode = 'changed';
  await page.getByRole('button', { name: 'Retry access check' }).click();
  await expect(page.getByText('Saved quiz unavailable', { exact: true })).toBeVisible();
  expect((await saved()).active.responses).toEqual([]);
  mode = 'current';
  await page.getByRole('button', { name: 'Retry access check' }).click();
  await page.getByRole('button', { name: 'Public answer B', exact: true }).click();
  mode = 'pending';
  await page.getByRole('button', { name: 'Check answer', exact: true }).click();
  await expect(page.getByText('Checking saved quiz…', { exact: true })).toBeVisible();
  await expect(page.getByText('Public fixture question?', { exact: true })).toHaveCount(0);
  mode = 'current'; release();
  await expect(page.getByText('Not quite', { exact: true })).toBeVisible();
  expect((await saved()).active.responses).toHaveLength(1);
  mode = 'revoked';
  await page.getByRole('button', { name: 'See results', exact: true }).click();
  await expect(page.getByText('Saved quiz unavailable', { exact: true })).toBeVisible();
  expect((await saved()).history).toEqual([]);
  await page.getByRole('button', { name: 'Back to Home', exact: true }).click();
  await page.getByRole('tab', { name: 'Account', exact: true }).click();
  await page.getByRole('button', { name: 'Clear downloaded data', exact: true }).click();
  await page.getByRole('button', { name: 'Keep downloaded data', exact: true }).click();
  expect((await saved()).active.responses).toHaveLength(1);
  await page.getByRole('button', { name: 'Clear downloaded data', exact: true }).click();
  await page.getByRole('button', { name: 'Confirm clear downloaded data', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Try a sample', exact: true })).toBeVisible();
  expect(await saved()).toEqual({ version: 1, active: null, reviews: [], history: [] });
  expect(writes).toEqual([]);
});

test('public flashcard reveal cannot bypass a new access denial', async ({ page }) => {
  let revoked = false;
  await page.route('https://**/*', route => {
    if (!route.request().url().startsWith('https://quizworld-mobile-fixture.invalid/rest/v1/quizzes?')) return route.abort();
    return route.fulfill({ json: revoked ? [] : [quiz] });
  });
  await page.goto('/');
  await page.getByRole('tab', { name: 'Library', exact: true }).click();
  await page.getByRole('button', { name: 'Browse public quizzes' }).click();
  await page.getByRole('button', { name: `Open ${quiz.title}`, exact: true }).click();
  await page.getByRole('button', { name: 'Start flashcards', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Show answer', exact: true })).toBeVisible();
  revoked = true;
  await page.getByRole('button', { name: 'Show answer', exact: true }).click();
  await expect(page.getByText('Saved quiz unavailable', { exact: true })).toBeVisible();
  await expect(page.getByText('Public answer A', { exact: true })).toHaveCount(0);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('quizworld:guest-study:v1')!).active.responses)).toEqual([]);
});
