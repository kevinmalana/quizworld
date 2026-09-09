import assert from "node:assert/strict";
import test from "node:test";
import { build } from "esbuild";
import { chromium } from "@playwright/test";

type PendingRequest = {
  identity: string;
  kind: string;
  resolve: (result: { data: object[] | null; error: { message: string } | null }) => void;
};
type FixtureWindow = Window & {
  pending: PendingRequest[];
  renderIdentity: (id: string | null) => void;
  poll: () => void;
  timers: Map<number, () => void>;
  storageWrites: string[][];
};

// Real React component in an isolated browser; all transport/auth are synthetic.
async function fixture() {
  const bundle = await build({
    stdin: { contents: `
      import React from 'react';
      import {createRoot} from 'react-dom/client';
      import {flushSync} from 'react-dom';
      import {NotificationBell} from './components/shared/notification-bell';
      window.identity = 'A'; window.pending = []; window.timers = new Map();
      window.storageWrites = [];
      Object.defineProperty(window, 'localStorage', {value:{getItem:()=>null,setItem:(...args)=>window.storageWrites.push(args)}});
      let timerId = 0;
      window.setInterval = fn => { window.timers.set(++timerId, fn); return timerId; };
      window.clearInterval = id => window.timers.delete(id);
      window.poll = () => [...window.timers.values()].forEach(fn => fn());
      window.root = createRoot(document.getElementById('root'));
      window.renderIdentity = id => { window.identity = id; flushSync(() => window.root.render(<NotificationBell/>)); };
      window.renderIdentity('A');
    `, resolveDir: process.cwd(), loader: "tsx" },
    bundle: true, write: false, platform: "browser", jsx: "automatic",
    plugins: [{ name: "synthetic-boundaries", setup(b) {
      b.onResolve({ filter: /^(next\/link|next\/navigation|@\/components\/supabase-provider|@\/lib\/supabase\/client)$/ }, args => ({ path: args.path, namespace: "fixture" }));
      b.onLoad({ filter: /.*/, namespace: "fixture" }, args => ({ resolveDir: process.cwd(), loader: "jsx", contents:
        args.path === "next/link" ? `import React from 'react'; export default function Link(p) {return <a {...p} onClick={e=>{e.preventDefault();p.onClick?.(e)}}/>}` :
        args.path === "next/navigation" ? `export const usePathname = () => '/dashboard';` :
        args.path.includes("supabase-provider") ? `export const useAuth = () => ({user: window.identity ? {id:window.identity} : null});` :
        `export const supabase = {
          from(table) { const q = {select(){return q},eq(){return q},is(){return q},order(){return q},gte(){return q},limit(){return q},
            then(resolve) {if(table === 'notifications') return new Promise(r=>window.pending.push({identity:window.identity,kind:'poll',resolve:r})).then(resolve); return Promise.resolve({data:[],error:null}).then(resolve)} }; return q; },
          rpc(name,args) { return new Promise(resolve=>window.pending.push({identity:window.identity,kind:'dismiss',args,resolve})); }
        };`
      }));
    }}],
  });
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.route("**/*", route => route.abort());
  await page.setContent('<div id="root"></div>');
  await page.addScriptTag({ content: bundle.outputFiles[0].text });
  await page.waitForFunction(() => (window as unknown as FixtureWindow).pending.length === 1);
  const switchTo = async (id: string | null) => {
    await page.evaluate(id => (window as unknown as FixtureWindow).renderIdentity(id), id);
  };
  const resolve = async (identity: string, title: string, kind = "poll", error = false, newest = false) => {
    await page.evaluate(({identity,title,kind,error,newest}) => {
      const w = window as unknown as FixtureWindow;
      const index = w.pending[newest ? "findLastIndex" : "findIndex"]((p: PendingRequest) => p.identity === identity && p.kind === kind);
      if(index < 0) throw new Error('No pending synthetic request');
      w.pending.splice(index,1)[0].resolve({data: kind === 'poll' ? [{id:'shared-id',type:'classroom_nudge',title,message:'fixture',href:'/fixture'}] : null,error:error ? {message:'synthetic failure'} : null});
    }, {identity,title,kind,error,newest});
    await page.evaluate(() => new Promise(requestAnimationFrame));
  };
  const open = async () => { if(await page.locator('.notif-dropdown').count() === 0) await page.getByRole('button', {name:/Notifications/}).click(); };
  return {browser,page,switchTo,resolve,open};
}

test("identity change synchronously hides old items, badge, dropdown and error", async () => {
  const f = await fixture();
  try {
    await f.resolve('A','A notification');
    await f.open();
    await f.page.getByRole('button', {name:'Clear all'}).click();
    await f.resolve('A','','dismiss',true);
    assert.equal(await f.page.getByRole('alert').count(), 1);
    const snapshot = await f.page.evaluate(() => {
      (window as unknown as FixtureWindow).renderIdentity('B');
      return {text:document.body.textContent,badge:document.querySelector('.notif-badge'),menu:document.querySelector('.notif-dropdown')};
    });
    assert.equal(snapshot.badge, null);
    assert.equal(snapshot.menu, null);
    assert.ok(!snapshot.text?.includes('A notification'));
    await f.open();
    assert.equal(await f.page.getByRole('alert').count(), 0);
  } finally { await f.browser.close(); }
});

for (const action of ['one','all']) {
  for (const error of [false,true]) {
    test(`late ${action} dismissal (${error ? 'error' : 'success'}) leaves B intact`, async () => {
      const f = await fixture();
      try {
        await f.resolve('A','A notification');
        await f.open();
        await (action === 'one' ? f.page.locator('.notif-item') : f.page.getByRole('button',{name:'Clear all'})).click();
        await f.switchTo('B');
        await f.resolve('B','B notification');
        await f.open();
        await f.resolve('A','','dismiss',error);
        assert.equal(await f.page.locator('.notif-title').textContent(),'B notification');
        assert.equal(await f.page.getByRole('alert').count(),0);
      } finally { await f.browser.close(); }
    });
  }
}

test("unmount removes the polling interval and pending work stays invisible", async () => {
  const f = await fixture();
  try {
    await f.switchTo(null);
    assert.equal(await f.page.evaluate(() => (window as unknown as FixtureWindow).timers.size),0);
    await f.resolve('A','Old notification');
    assert.equal(await f.page.locator('.notif-bell-wrap').count(),0);
    await f.switchTo('A');
    await f.resolve('A','Fresh notification');
    await f.open();
    assert.equal(await f.page.locator('.notif-title').textContent(),'Fresh notification');
  } finally { await f.browser.close(); }
});

for (const action of ['one','all']) {
  test(`ordinary ${action} dismissal still handles error then success`, async () => {
    const f = await fixture();
    try {
      await f.resolve('A','A notification');
      await f.open();
      const click = () => (action === 'one' ? f.page.locator('.notif-item') : f.page.getByRole('button',{name:'Clear all'})).click();
      await click();
      await f.resolve('A','','dismiss',true);
      assert.equal(await f.page.getByRole('alert').count(),1);
      assert.equal(await f.page.locator('.notif-title').textContent(),'A notification');
      await click();
      await f.resolve('A','','dismiss');
      await f.open();
      assert.equal(await f.page.locator('.notif-title').count(),0);
      assert.equal(await f.page.getByRole('alert').count(),0);
    } finally { await f.browser.close(); }
  });
}

test("late clear-all completion cannot write shared storage after identity change", async () => {
  const f = await fixture();
  try {
    await f.resolve('A','A notification');
    await f.open();
    await f.page.getByRole('button', {name:'Clear all'}).click();
    await f.switchTo('B');
    await f.resolve('B','B notification');
    await f.resolve('A','','dismiss');
    assert.equal(await f.page.evaluate(() => (window as unknown as FixtureWindow).storageWrites.length), 0);
    await f.open();
    assert.equal(await f.page.locator('.notif-title').textContent(), 'B notification');
  } finally { await f.browser.close(); }
});

test("newest same-identity poll wins when responses arrive out of order", async () => {
  const f = await fixture();
  try {
    await f.page.evaluate(() => (window as unknown as FixtureWindow).poll());
    await f.resolve('A','New notification','poll',false,true);
    await f.resolve('A','Old notification');
    await f.open();
    assert.equal(await f.page.locator('.notif-title').textContent(), 'New notification');
  } finally { await f.browser.close(); }
});

test("late A poll cannot overwrite B after a direct identity switch", async () => {
  const f = await fixture();
  try {
    await f.switchTo('B');
    await f.resolve('B','B notification');
    await f.resolve('A','A notification');
    await f.open();
    assert.equal(await f.page.locator('.notif-title').textContent(), 'B notification');
  } finally { await f.browser.close(); }
});
