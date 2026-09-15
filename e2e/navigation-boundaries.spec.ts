import { test, expect, type Locator } from '@playwright/test';
import { build } from 'esbuild';

// Real Navigation + NotificationBell, with local auth/data/router seams only.
// No signed-in session: this proves component layout/interaction, not authentication.
let bundle: string;
test.beforeAll(async () => {
  const result = await build({
    stdin: { contents: `import React from 'react'; import {createRoot} from 'react-dom/client'; import {Navigation} from './components/navigation'; createRoot(document.getElementById('fixture')).render(<Navigation/>);`, resolveDir: process.cwd(), loader: 'tsx' },
    bundle: true, write: false, platform: 'browser', jsx: 'automatic',
    plugins: [{ name: 'local-navigation-seams', setup(b) {
      b.onResolve({ filter: /^(next\/link|next\/navigation|@\/components\/supabase-provider|@\/lib\/supabase\/client|@\/lib\/friendship-notifications)$/ }, args => ({ path: args.path, namespace: 'fixture' }));
      b.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({ resolveDir: process.cwd(), loader: 'jsx', contents:
        args.path === 'next/link' ? `import React from 'react'; export default function Link({prefetch, ...props}) { return <a {...props}/>; }` :
        args.path === 'next/navigation' ? `export const usePathname=()=>'/join'; export const useRouter=()=>({push:()=>{}});` :
        args.path.includes('supabase-provider') ? `export const useAuth=()=>({loading:false,user:window.fixtureRole==='guest'?null:{id:'local-fixture'}});` :
        args.path.includes('friendship-notifications') ? `export const loadFriendshipNotifications=async()=>({data:[]});` :
        `export const supabase={auth:{signOut:async()=>{}},from:(table)=>{const q=new Proxy({}, {get:(_,key)=>key==='then'?resolve=>resolve({data:table==='profiles'?{is_admin:window.fixtureRole==='admin',display_name:'Fixture',username:'fixture'}:[]}):()=>q});return q;}};`
      }));
    }}],
  });
  bundle = result.outputFiles[0].text;
});

async function reachable(control: Locator, width: number) {
  await expect(control).toBeVisible();
  await control.focus();
  await expect(control).toBeFocused();
  const bounds = await control.evaluate(el => {
    const r = el.getBoundingClientRect();
    const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
    return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, hit: !!hit && el.contains(hit) };
  });
  expect(bounds.left).toBeGreaterThanOrEqual(0);
  expect(bounds.right).toBeLessThanOrEqual(width);
  expect(bounds.top).toBeGreaterThanOrEqual(0);
  expect(bounds.bottom).toBeLessThanOrEqual(900);
  expect(bounds.hit).toBe(true);
}

for (const role of ['guest', 'member', 'admin']) {
  for (const width of [320, 390, 639, 640, 641, 767, 768, 959, 960, 961, 1440]) {
    test(`${role} navigation reachable at ${width}px (local role fixture)`, async ({ page, baseURL }, testInfo) => {
      expect(new URL(baseURL!).hostname).toMatch(/^(127\.0\.0\.1|localhost)$/);
      await page.setViewportSize({ width, height: 900 });
      await page.emulateMedia({ reducedMotion: 'reduce' });
      const response = await page.request.get('/join');
      const html = (await response.text()).replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '').replace(/<body([^>]*)>[\s\S]*<\/body>/, '<body$1><div id="fixture"></div></body>');
      await page.route('**/*', route => {
        const url = new URL(route.request().url());
        if (url.origin !== new URL(baseURL!).origin) return route.abort();
        if (url.pathname === '/__nav_fixture') return route.fulfill({ contentType: 'text/html', body: html });
        return route.continue();
      });
      await page.goto('/__nav_fixture');
      await page.evaluate(value => { Object.assign(window, { fixtureRole: value }); }, role);
      await page.addScriptTag({ content: bundle });
      await page.evaluate(() => document.fonts.ready);
      const header = page.locator('header');
      if (role === 'admin') await expect(header.locator('a[href="/admin"]')).toBeAttached();
      const logoClearance = await header.evaluate(el => {
        const logo = el.querySelector('.nav-logo')!;
        const range = document.createRange();
        range.selectNodeContents(logo);
        const text = range.getBoundingClientRect();
        return el.querySelector('.nav-right')!.getBoundingClientRect().left - text.right;
      });
      expect(logoClearance).toBeGreaterThanOrEqual(16);
      const controls = header.locator('a:visible, button:visible');
      for (const control of await controls.all()) await reachable(control, width);
      await page.screenshot({ path: testInfo.outputPath('header.png') });
      const menu = header.getByRole('button', { name: 'Menu', exact: true });
      if (width < 960) {
        await reachable(menu, width);
        await menu.press('Enter');
        const dialog = page.getByRole('dialog', { name: 'Navigation' });
        await expect(dialog).toBeVisible();
        const destinations = ['/', '/join', '/host', '/explore', '/study', '/leaderboard', '/friends', '/classrooms', '/groups', '/achievements', '/present', '/create/activity', ...(role === 'guest' ? ['/login'] : ['/profile', '/dashboard']), ...(role === 'admin' ? ['/admin'] : [])];
        if (role !== 'guest') await expect(dialog.getByRole('button', { name: 'Sign Out', exact: true })).toHaveCount(1);
        for (const href of destinations) await expect(dialog.locator(`a[href="${href}"]`)).toHaveCount(1);
        expect((await dialog.locator('a[href="/host"]').boundingBox())!.y).toBeLessThan(360);
        await page.screenshot({ path: testInfo.outputPath('menu.png') });
        // Native Tab navigation must reach every control, scrolling the panel as needed.
        await dialog.locator('a').first().focus();
        for (const control of await dialog.locator('a, button').all()) {
          await expect(control).toBeFocused();
          await reachable(control, width);
          await page.keyboard.press('Tab');
        }
        // Chromium visits browser chrome between the final and first modal control.
        // It must never focus the inert background header during that boundary.
        expect(await header.evaluate(el => el.contains(document.activeElement))).toBe(false);
        if (await page.evaluate(() => document.activeElement === document.body)) await page.keyboard.press('Tab');
        await expect(dialog.locator('a').first()).toBeFocused();
        await page.keyboard.press('Escape');
        await expect(dialog).not.toBeVisible();
        await expect(menu).toBeFocused();
      } else {
        await expect(menu).not.toBeVisible();
        await reachable(header.locator('a[href="/host"]'), width);
      }
      if (role !== 'guest') {
        await reachable(header.getByRole('button', { name: 'Notifications', exact: true }), width);
      }
    });
  }
}
