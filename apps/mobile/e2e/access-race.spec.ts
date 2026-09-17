import { test, expect } from '@playwright/test';
import { build } from 'esbuild';

test('real access hook fences account changes, foreground and StrictMode pending checks', async ({ page }) => {
  const bundle = await build({ stdin: { contents: `
    import React from 'react'; import {createRoot} from 'react-dom/client'; import {flushSync} from 'react-dom';
    import {usePracticeAccess} from './src/use-practice-access'; import {pack} from './src/study/fixture';
    const publicPack={...pack,source:'public'};
    window.fixture={checks:[],listeners:new Set(),writes:[],current:'active'};
    function Probe({id}) {
      const access=usePracticeAccess(publicPack);
      window.run=()=>access.run(async()=>{fixture.writes.push(id);});
      window.retry=access.retry;
      return <pre id="state">{id+':'+access.phase}</pre>;
    }
    const root=createRoot(document.getElementById('root'));
    window.switchTo=id=>flushSync(()=>root.render(<React.StrictMode><Probe key={id} id={id}/></React.StrictMode>));
    window.phase=p=>{fixture.current=p;for(const listener of fixture.listeners)listener(p);};
    window.finish=()=>{for(const check of fixture.checks.splice(0))check();};
  `, resolveDir: process.cwd(), loader: 'tsx' }, bundle: true, write: false, platform: 'browser', format: 'iife', plugins: [{ name: 'access-fixture', setup(b) {
    b.onResolve({ filter: /^react-native$/ }, () => ({ path: 'native', namespace: 'fixture' }));
    b.onResolve({ filter: /^@react-navigation\/native$/ }, () => ({ path: 'navigation', namespace: 'fixture' }));
    b.onResolve({ filter: /^\.\/public-access$/ }, () => ({ path: 'access', namespace: 'fixture' }));
    b.onLoad({ filter: /.*/, namespace: 'fixture' }, ({ path }) => ({ contents: path === 'native' ? `export const AppState={get currentState(){return window.fixture.current},addEventListener:(_,listener)=>{window.fixture.listeners.add(listener);return {remove:()=>window.fixture.listeners.delete(listener)}}};` : path === 'navigation' ? `export const useIsFocused=()=>true;` : `export const checkPublicAccess=()=>new Promise(resolve=>window.fixture.checks.push(resolve));` }));
  } }] });
  await page.route('**/*', route => route.abort());
  await page.setContent('<div id="root"></div>'); await page.addScriptTag({ content: bundle.outputFiles[0].text });
  await page.evaluate(`switchTo('A')`);
  await expect(page.locator('#state')).toHaveText('A:pending');
  await page.evaluate(`finish()`);
  await expect(page.locator('#state')).toHaveText('A:current');
  await page.evaluate(`run();switchTo('B');finish()`);
  await expect(page.locator('#state')).toHaveText('B:current');
  expect(await page.evaluate(`fixture.writes`)).toEqual([]);
  await page.evaluate(`run();phase('background');finish()`);
  await expect(page.locator('#state')).toHaveText('B:pending');
  expect(await page.evaluate(`fixture.writes`)).toEqual([]);
  await page.evaluate(`phase('active')`);
  await expect(page.locator('#state')).toHaveText('B:pending');
  await page.evaluate(`finish()`);
  await expect(page.locator('#state')).toHaveText('B:current');
  await page.evaluate(`run();finish()`);
  await expect.poll(() => page.evaluate(`fixture.writes`)).toEqual(['B']);
  expect(await page.evaluate(`fixture.listeners.size`)).toBe(1);
});
