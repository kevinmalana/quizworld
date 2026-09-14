import {test, expect} from '@playwright/test';

test('local font loading keeps mobile entry within the layout-shift budget',async({page})=>{
 await page.setViewportSize({width:390,height:960});
 await page.addInitScript(()=>{let cls=0;new PerformanceObserver(list=>{for(const entry of list.getEntries() as (PerformanceEntry & {hadRecentInput:boolean;value:number})[]){if(!entry.hadRecentInput)cls+=entry.value;}Object.assign(window,{layoutShift:cls});}).observe({type:'layout-shift',buffered:true});});
 await page.goto('/',{waitUntil:'networkidle'});await expect(page.locator('body')).toHaveCSS('font-family',/DM Sans/);
 expect(await page.evaluate(()=>(window as Window & {layoutShift?:number}).layoutShift??0)).toBeLessThanOrEqual(.1);
});

test('desktop quiz detail gives its real title room to read',async({page})=>{
 await page.setViewportSize({width:1440,height:1000});await page.goto('/explore');
 await page.locator('.explore-quiz-title a').first().click();
 const title=page.locator('.quiz-detail-title');await expect(title).toBeVisible();
 expect((await title.boundingBox())!.width).toBeGreaterThan(280);
 expect((await title.boundingBox())!.height).toBeLessThan(190);
 await expect(page.getByRole('link',{name:/Play Solo/})).toBeVisible();
});

test('entry distinguishes game PIN from presentation codes without hiding join on a phone', async ({page}) => {
  await page.setViewportSize({width:320,height:844}); await page.goto('/');
  const pin=page.getByRole('textbox',{name:'Game PIN',exact:true});
  await expect(pin).toBeVisible(); await pin.fill('ABC123');
  expect(await pin.evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);
  const box=await pin.boundingBox(); expect(box!.y+box!.height).toBeLessThan(620);
  await expect(page.getByRole('link',{name:'Join a presentation',exact:true})).toHaveAttribute('href','/present/join');
  await expect(page.locator('body')).not.toContainText(/library of thousands|under 2 minutes|most popular categories/);
  await page.getByRole('button',{name:'Enter Game',exact:true}).click(); await expect(page).toHaveURL(/\/join\?pin=ABC123$/);
});

test('round illustration explains a phase through real controls without claiming a live room', async ({page}) => {
 await page.goto('/');
 const reveal=page.getByRole('button',{name:'3. Reveal',exact:true}); await reveal.click();
 await expect(reveal).toHaveAttribute('aria-pressed','true');
 await expect(page.locator('.round-preview')).toHaveAttribute('data-phase','reveal');
 await expect(page.getByRole('status').filter({hasText:'See the answer. See where you stand.'})).toBeVisible();
});

test('essential cookie notice stays compact on a phone with usable dismissal', async ({page})=>{
 await page.setViewportSize({width:320,height:844});await page.goto('/');
 const notice=page.getByRole('complementary',{name:'Cookie notice'});
 await expect(notice).toBeVisible();
 expect((await notice.boundingBox())!.height).toBeLessThan(175);
 await notice.getByRole('button',{name:'Dismiss cookie notice'}).click();await expect(notice).not.toBeVisible();
});

test('mobile navigation is a keyboard-contained dismissible dialog', async ({page})=>{
 await page.setViewportSize({width:390,height:844});await page.goto('/');
 const menu=page.getByRole('button',{name:'Menu',exact:true});await menu.click();
 const dialog=page.getByRole('dialog',{name:'Navigation'});await expect(dialog).toBeVisible();
 await expect(menu).toHaveAttribute('aria-expanded','true');
 await page.keyboard.press('Escape');await expect(dialog).not.toBeVisible();await expect(menu).toBeFocused();
});

test('mobile library reaches real content before 700px with optional topic disclosure', async ({ page }) => {
  await page.setViewportSize({width:390,height:844});
  await page.goto('/explore');
  const card=page.locator('.explore-quiz-card').first();
  await expect(card).toBeVisible();
  expect((await card.boundingBox())!.y).toBeLessThan(700);
  await page.getByText('Browse topics', {exact:true}).click();
  await expect(page.getByRole('button', {name:/Academic/})).toBeVisible();
});

test('library renders one honest catalogue, not duplicated misleading shelves', async ({page})=>{
 await page.goto('/explore');await expect(page.getByRole('searchbox',{name:'Search public quizzes'})).toHaveAttribute('placeholder','Search titles or categories');
 await expect(page.locator('body')).not.toContainText(/Trending this week|All-Time Greatest|Curated quiz paths/);
 const title=page.locator('.explore-quiz-title a').first();await expect(title).toHaveAttribute('href',/\/quiz\//);
});
