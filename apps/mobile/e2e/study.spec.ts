import { test, expect } from '@playwright/test';

test('guest sample, persisted mistake, resume, offline review and truthful account', async ({ page, context }) => {
  const errors: string[] = [];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/');
  await page.getByRole('button',{name:'Try a sample'}).click();
  await page.getByRole('button',{name:'Start quickfire'}).click();
  await expect(page.getByText('Which is the largest continent by area?',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Africa',exact:true}).click();
  await page.getByRole('button',{name:'Check answer',exact:true}).click();
  await expect(page.getByText('Not quite',{exact:true})).toBeVisible();
  await page.reload();
  await page.getByRole('button',{name:'Resume practice'}).click();
  await expect(page.getByText('Not quite',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Next question',exact:true}).click();
  await page.getByRole('button',{name:'Tokyo',exact:true}).click();
  await page.getByRole('button',{name:'Check answer',exact:true}).click();
  await page.getByRole('button',{name:'See results',exact:true}).click();
  await expect(page.getByText('1 of 2 correct',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Back to Home',exact:true}).click();
  await page.getByRole('button',{name:'Review mistakes',exact:true}).click();
  await page.getByRole('button',{name:/Review World Geography Basics/}).click();
  await context.setOffline(true);
  await page.getByRole('button',{name:'Asia',exact:true}).click();
  await page.getByRole('button',{name:'Check answer',exact:true}).click();
  await page.getByRole('button',{name:'See results',exact:true}).click();
  await expect(page.getByText('1 of 1 correct',{exact:true})).toBeVisible();
  await context.setOffline(false);
  await page.getByRole('button',{name:'Back to Home',exact:true}).click();
  await page.getByRole('tab',{name:'Account'}).click();
  await expect(page.getByText('Subscriptions are not available in this build.',{exact:true})).toBeVisible();
  await expect(page.getByText('Sign in with your existing email and password.',{exact:true})).toBeVisible();
  expect(errors).toEqual([]);
});

test('a public detail left open cannot start after access is revoked', async ({ page }) => {
  // Synthetic local transport fixture, never live content or authorization evidence.
  const quiz = { id: '15381af4-f5fd-41ed-beb9-0b6e4a57622d', title: 'Local access test fixture', category: 'Test', is_public: true, archived_at: null, questions: [{ id: 'q', text: 'Fixture question?', question_type: 'multiple_choice', order_index: 0, answers: [{ id: 'a', text: 'A', is_correct: true }, { id: 'b', text: 'B', is_correct: false }] }] };
  let revoked = false;
  await page.route('**/rest/v1/quizzes?**', route => route.fulfill({ json: revoked ? [] : [quiz] }));
  await page.goto('/');
  await page.getByRole('tab', { name: 'Library' }).click();
  await page.getByRole('button', { name: 'Browse public quizzes' }).click();
  await page.getByRole('button', { name: `Open ${quiz.title}`, exact: true }).click();
  await expect(page.getByRole('button', { name: 'Start quickfire', exact: true })).toBeVisible();
  revoked = true;
  await page.getByRole('button', { name: 'Start quickfire', exact: true }).click();
  await expect(page.getByText(/This quiz is no longer public/)).toBeVisible();
  await expect(page.getByText('Fixture question?', { exact: true })).toHaveCount(0);
  const saved = await page.evaluate(() => localStorage.getItem('quizworld:guest-study:v1'));
  expect(saved === null || JSON.parse(saved).active === null).toBe(true);
});

test('corrupt local data is retained until an explicit confirmed reset', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.setItem('quizworld:guest-study:v1', '{broken'));
  await page.reload();
  await expect(page.getByText('Your data needs attention', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Retry saved practice', exact: true }).click();
  await expect(page.getByText('Your data needs attention', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('quizworld:guest-study:v1'))).toBe('{broken');
  await page.getByRole('button', { name: 'Reset device practice', exact: true }).click();
  await page.getByRole('button', { name: 'Cancel reset', exact: true }).click();
  expect(await page.evaluate(() => localStorage.getItem('quizworld:guest-study:v1'))).toBe('{broken');
  await page.getByRole('button', { name: 'Reset device practice', exact: true }).click();
  await page.getByRole('button', { name: 'Confirm reset', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Try a sample', exact: true })).toBeVisible();
  expect(JSON.parse((await page.evaluate(() => localStorage.getItem('quizworld:guest-study:v1')))!)).toEqual({ version: 1, active: null, reviews: [], history: [] });
});
