import {test,expect} from '@playwright/test';
import {build} from 'esbuild';

test('real PracticeProvider fences old reads/writes and synchronously resets on account switch',async({page})=>{
 // Real React/provider/repository/model. Only native persistence is a deferred fixture.
 const bundle=await build({stdin:{contents:`
 import React from 'react'; import {createRoot} from 'react-dom/client'; import {flushSync} from 'react-dom';
 import {PracticeProvider,usePractice} from './src/state';
 import {emptyState,startSession} from './src/study/model'; import {pack} from './src/study/fixture';
 const fixture=window.fixture={reads:{},writes:[],pendingWrites:[],holdWrites:false,memory:{}};
 fixture.sample=JSON.stringify(startSession(emptyState(),pack,'quickfire','A-only',1));
 function Probe(){const store=usePractice();window.store=store;return <pre id="state">{JSON.stringify({ready:store.ready,id:store.state.active?.id??null})}</pre>;}
 const root=createRoot(document.getElementById('root'));
 window.switchTo=id=>flushSync(()=>root.render(<PracticeProvider accountId={id}><Probe/></PracticeProvider>));
 window.saveA=()=>{window.writeResult='pending';window.store.update(()=>startSession(emptyState(),pack,'quickfire','late-A',1)).then(ok=>window.writeResult=ok);};
 `,resolveDir:process.cwd(),loader:'tsx'},bundle:true,write:false,platform:'browser',format:'iife',plugins:[{name:'native-storage-fixture',setup(b){
  b.onResolve({filter:/^@react-native-async-storage\/async-storage$/},()=>({path:'storage',namespace:'fixture'}));
  b.onLoad({filter:/.*/,namespace:'fixture'},()=>({contents:`export default {
   getItem:key=>new Promise(resolve=>{window.fixture.reads[key]=()=>resolve(window.fixture.memory[key]??null);}),
   setItem:(key,value)=>new Promise((resolve,reject)=>{if(window.fixture.failWrites){reject(new Error("Device full"));return;}const done=()=>{window.fixture.memory[key]=value;window.fixture.writes.push(key);resolve();};if(window.fixture.holdWrites)window.fixture.pendingWrites.push(done);else done();})
  };`}));
 }}]});
 await page.route('**/*',route=>route.abort());
 await page.setContent('<div id="root"></div>'); await page.addScriptTag({content:bundle.outputFiles[0].text});
 await page.evaluate(`switchTo('A')`);
 await page.evaluate(`fixture.memory['quizworld:account-study:v1:A']=fixture.sample;switchTo('B')`);
 await expect(page.locator('#state')).toHaveText('{"ready":false,"id":null}');
 await page.evaluate(`fixture.reads['quizworld:account-study:v1:B']()`);
 await expect(page.locator('#state')).toHaveText('{"ready":true,"id":null}');
 await page.evaluate(`fixture.reads['quizworld:account-study:v1:A']()`);
 await expect(page.locator('#state')).toHaveText('{"ready":true,"id":null}');
 await page.evaluate(`switchTo('A')`); await page.evaluate(`fixture.reads['quizworld:account-study:v1:A']()`);
 await expect(page.locator('#state')).toContainText('A-only');
 await page.evaluate(`fixture.holdWrites=true;saveA();switchTo('B')`);
 await page.evaluate(`fixture.reads['quizworld:account-study:v1:B']();fixture.pendingWrites[0]()`);
 await expect(page.locator('#state')).toHaveText('{"ready":true,"id":null}');
 expect(await page.evaluate('writeResult')).toBe(false);
 expect(await page.evaluate('fixture.writes')).toEqual(['quizworld:account-study:v1:A']);
 expect(await page.evaluate(`fixture.memory['quizworld:account-study:v1:B']??null`)).toBeNull();
 // Clearing invalidates callbacks captured before the clear and remounts navigation.
 await page.evaluate(`fixture.holdWrites=false;window.staleUpdate=store.update;window.oldStore=store;store.clearDownloads()`);
 await expect.poll(()=>page.evaluate(`store!==oldStore`)).toBe(true);
 expect(await page.evaluate(`staleUpdate(()=>JSON.parse(fixture.sample))`)).toBe(false);
 await expect(page.locator('#state')).toHaveText('{"ready":true,"id":null}');
 expect(await page.evaluate(`JSON.parse(fixture.memory['quizworld:account-study:v1:B']).active`)).toBeNull();
 expect(await page.evaluate(`JSON.parse(fixture.memory['quizworld:account-study:v1:A']).active.id`)).toBe('late-A');
 await page.evaluate(`store.update(()=>JSON.parse(fixture.sample))`);
 await expect(page.locator('#state')).toContainText('A-only');
 await page.evaluate(`fixture.failWrites=true;window.beforeClear=fixture.memory['quizworld:account-study:v1:B']`);
 expect(await page.evaluate(`store.clearDownloads()`)).toBe(false);
 expect(await page.evaluate(`store.error`)).toBe('Device full');
 expect(await page.evaluate(`fixture.memory['quizworld:account-study:v1:B']`)).toBe(await page.evaluate(`beforeClear`));
 await expect(page.locator('#state')).toContainText('A-only');
});
