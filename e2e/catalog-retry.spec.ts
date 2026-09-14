import {test, expect} from '@playwright/test';

test('Retry retains the failed search and sort rather than reloading', async ({page}) => {
  await page.goto('/explore');
  const sorted=page.waitForResponse(r=>r.url().includes('order=title.asc')&&r.ok());
  await page.getByRole('button', {name: /A → Z/}).click();
  await sorted;
  await expect(page.locator('.explore-quiz-card').first()).toBeVisible();
  const failedUrls: string[] = [];
  await page.route('**/rest/v1/quizzes?**', r => { failedUrls.push(r.request().method()+' '+r.request().url()); return r.fulfill({status:503,json:{message:'local failure'}}); });
  await page.getByRole('searchbox').fill('History');
  await expect(page.getByRole('button',{name:'Retry',exact:true})).toBeVisible();
  await page.unroute('**/rest/v1/quizzes?**');
  const retries: string[] = [];
  page.on('request',r=>{if(r.url().includes('/rest/v1/quizzes?'))retries.push(r.method()+' '+r.url());});
  await page.getByRole('button',{name:'Retry',exact:true}).click();
  await expect(page.getByRole('searchbox')).toHaveValue('History');
  await expect.poll(()=>retries.length).toBe(2);
  expect(retries.sort()).toEqual(failedUrls.sort());
  await expect(page.getByRole('button',{name:/A → Z/})).toHaveAttribute('aria-pressed','true');
  await expect(page.locator('.explore-quiz-card').first()).toBeVisible();
  await expect(page.locator('.explore-results-heading')).toContainText('Search Results');
});

test('append failure retains rows and retries the same cursor without duplicates', async ({page}) => {
  await page.goto('/explore');
  const cards = page.locator('.explore-quiz-title a');
  await expect(cards).toHaveCount(24);
  const before = await cards.evaluateAll(els => els.map(e => e.getAttribute('href')));
  let failedUrl = '';
  await page.route('**/rest/v1/quizzes?**', r => { if(r.request().method()==='GET')failedUrl=r.request().url(); return r.fulfill({status:503,json:{message:'append failure'}}); });
  await page.getByRole('button',{name:'Load more quizzes',exact:true}).click();
  await expect(page.getByRole('button',{name:'Retry loading more',exact:true})).toBeVisible();
  expect(await cards.evaluateAll(els=>els.map(e=>e.getAttribute('href')))).toEqual(before);
  await page.unroute('**/rest/v1/quizzes?**');
  const retry=page.waitForRequest(r=>r.method()==='GET'&&r.url().includes('/rest/v1/quizzes?'));
  await page.getByRole('button',{name:'Retry loading more',exact:true}).click();
  expect((await retry).url()).toBe(failedUrl);
  await expect(cards).toHaveCount(48);
  const after=await cards.evaluateAll(els=>els.map(e=>e.getAttribute('href')));
  expect(after.slice(0,before.length)).toEqual(before);
  expect(new Set(after).size).toBe(after.length);
});

test('late retry cannot replace a newer query', async ({page}) => {
  await page.goto('/explore');
  let requestCount=0;
  let release!: () => void;
  const gate=new Promise<void>(resolve=>{release=resolve;});
  await page.route('**/rest/v1/quizzes?**', async route => {
    if (!decodeURIComponent(route.request().url()).toLowerCase().includes('science')) return route.continue();
    requestCount++;
    if(requestCount<=2) return route.fulfill({status:503,json:{message:'retry race'}});
    const response=await route.fetch();
    await gate;
    await route.fulfill({response});
  });
  const search=page.getByRole('searchbox');
  await search.fill('Science');
  await page.getByRole('button',{name:'Retry',exact:true}).click();
  await expect.poll(()=>requestCount).toBe(4);
  await search.fill('History');
  await expect(page.locator('.explore-quiz-card').first()).toBeVisible();
  const current=await page.locator('.explore-quiz-title a').allTextContents();
  const retryResponses=['GET','HEAD'].map(method=>page.waitForResponse(r=>r.request().method()===method&&decodeURIComponent(r.url()).toLowerCase().includes('science')&&r.ok()));
  release();
  const responses=await Promise.all(retryResponses);
  await responses[0].json();
  await page.evaluate(()=>new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve()))));
  await expect(search).toHaveValue('History');
  await expect.poll(async()=>page.locator('.explore-quiz-title a').allTextContents()).toEqual(current);
  await expect(page.locator('.explore-quiz-card').first()).toBeVisible();
});
