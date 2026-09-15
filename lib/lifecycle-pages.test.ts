import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { chromium, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';

type Snapshot = { presentation: { title: string; creator_id: string; run_id: string; join_code: string; status: string; slides: { id: string; slide_type: string; order_index: number; content: { title: string } }[] } };
type FixtureWindow = {
  user: { id: string } | null; code: string; queries: unknown[]; calls: string[]; activities: number;
  subscriptions: { callbacks: Record<string, (data?: unknown) => void> }[]; disconnects: number;
  rows: Record<string, Record<string, unknown>[]>;
  presentation: (code: string, status?: string) => Snapshot;
  fetchPresentation: (code: string) => Promise<Snapshot>;
  release: () => void; render: () => void;
};

const evidence = process.env.LIFECYCLE_EVIDENCE;
async function fixture(kind: 'study' | 'present', run: (page: Page) => Promise<void>, setup?: (page: Page) => Promise<void>) {
  const mocks: Record<string, string> = {
    'next/link': `import React from 'react';export default p=><a {...p}/>;`,
    'next/navigation': `export const useParams=()=>({code:window.code});const router={push(){}};export const useRouter=()=>router;`,
    '@/components/supabase-provider': `export const useAuth=()=>({user:window.user,loading:false});`,
    '@/lib/supabase/client': `export const supabase={from(table){const filters=[];let head=false;const q={select(s,o){head=o?.head;return q},eq(k,v){filters.push(r=>r[k]===v);return q},is(k,v){filters.push(r=>r[k]===v);return q},in(k,v){filters.push(r=>v.includes(r[k]));return q},or(){return q},order(){return q},limit(){return q},ilike(k,v){filters.push(r=>r[k].toLowerCase().includes(v.replaceAll('%','').toLowerCase()));return q},maybeSingle(){return q},then(resolve){window.queries.push({table,head});const data=(window.rows[table]||[]).filter(r=>filters.every(f=>f(r)));return Promise.resolve({data:table==='profiles'?data[0]:data,count:data.length}).then(resolve)}};return q}};`,
    '@/lib/presentation/client': `export const readParticipantSession=()=>null;export const readPresenterToken=()=> 'local-fixture-token';export const fetchPhoenixPresentation=(code)=>{window.calls.push(code);return window.fetchPresentation(code)};export const fetchPhoenixSlideActivity=()=>{window.activities++;return Promise.resolve({responses:[],questions:[]})};`,
    '@/lib/presentation/presentation-socket': `export function subscribeToPresentation(o){window.subscriptions.push(o);const c={disconnect(){window.disconnects++},nextSlide(){},prevSlide(){},setResultsHidden(){},endPresentation(){o.callbacks.onPresentationEnded()}};return c}`,
  };
  const bundle = await build({stdin:{loader:'tsx',resolveDir:process.cwd(),contents:`import React from 'react';import{createRoot}from'react-dom/client';import Page from './app/${kind==='study'?'study':'present/[code]/live'}/page';window.root=createRoot(document.getElementById('root'));window.render=()=>window.root.render(<Page/>);window.render();`},bundle:true,write:false,platform:'browser',jsx:'automatic',plugins:[{name:'fixtures',setup(b){b.onResolve({filter:/.*/},a=>mocks[a.path]?{path:a.path,namespace:'fixture'}:undefined);b.onLoad({filter:/.*/,namespace:'fixture'},a=>({contents:mocks[a.path],loader:'jsx',resolveDir:process.cwd()}));}}]});
  const browser = await chromium.launch();
  try {
    const page=await browser.newPage();
    page.on('pageerror', error => console.error(error.message));
    await page.route('**/*',r=>r.request().url()==='http://qw-lifecycle.local/' ? r.fulfill({contentType:'text/html',body:'<p>LOCAL COMPONENT FIXTURE — no production auth proof</p><main id="root"></main>'}) : r.abort());
    await page.goto('http://qw-lifecycle.local/');
    await page.addScriptTag({content:'window.__name = (fn) => fn; window.process={env:{}};'});
    await page.evaluate(()=>{
      const w=window as unknown as FixtureWindow;w.user={id:'owner'};w.code='A';w.queries=[];w.calls=[];w.activities=0;w.subscriptions=[];w.disconnects=0;
      const quiz=(id:string,archived_at:string|null)=>({id,title:id,archived_at,category:'Science & Nature',created_at:'2026-01-01',questions:[{id:'q'}]});
      w.rows={quizzes:[quiz('archived assigned quiz','2026-01-02'),quiz('available private quiz',null)],study_progress:[{user_id:'owner',quiz_id:'archived assigned quiz',questions_studied:4,correct:3,mastery:75,last_studied:'2026-01-01'}],study_sessions:[{user_id:'owner',id:'session',xp_earned:295,correct:3,total:4,created_at:'2026-01-01'}],profiles:[{id:'owner',total_xp:295}],classroom_members:[{user_id:'owner',classroom_id:'class'}],classroom_assignments:[{classroom_id:'class',quiz_id:'archived assigned quiz'}]};
      w.presentation=(code:string,status='live')=>({presentation:{title:'Deck '+code,creator_id:'owner',run_id:'run-'+code,join_code:'123456',status,slides:[{id:'slide-'+code,slide_type:'content',order_index:0,content:{title:'Content '+code}}]}});
      w.fetchPresentation=(code:string)=>Promise.resolve(w.presentation(code));
    });
    await setup?.(page);
    await page.addScriptTag({content:bundle.outputFiles[0].text});
    await run(page);
  } finally {await browser.close();}
}
async function shot(page:Page,name:string){if(evidence){mkdirSync(evidence,{recursive:true});await page.screenshot({path:`${evidence}/${name}.png`,fullPage:true});}}

test('Study excludes archived assigned resume while retaining earned history',async()=>fixture('study',async page=>{
  await page.getByRole('heading',{name:/Study Hall/}).waitFor();
  await shot(page,'study');
  assert.equal(await page.getByRole('link',{name:'Resume',exact:true}).count(),0);
  assert.equal(await page.getByText('archived assigned quiz',{exact:true}).count(),0);
  assert.equal(await page.getByText('+295',{exact:true}).count(),1);
  assert.equal(await page.locator('.study-stat-card').filter({hasText:'Quizzes Studied'}).locator('.study-stat-card__value').innerText(),'1');
  assert.equal(await page.getByText('75%',{exact:true}).count(),2);
  assert.equal(await page.getByRole('link',{name:'Study Now',exact:true}).count(),1);
}));

test('Presentation end stops fallback polling and disconnects',async()=>fixture('present',async page=>{
  await page.waitForFunction(()=>(window as unknown as FixtureWindow).subscriptions.length===1);
  await page.evaluate(()=>{const w=window as unknown as FixtureWindow;w.subscriptions[0].callbacks.onJoined();w.subscriptions[0].callbacks.onPresentationEnded();});
  await page.getByText('Thanks for taking part',{exact:true}).waitFor();
  const before=await page.evaluate(()=>({calls:(window as unknown as FixtureWindow).calls.length,activities:(window as unknown as FixtureWindow).activities}));
  await page.waitForTimeout(5300);
  await shot(page,'ended');
  assert.deepEqual(await page.evaluate(()=>({calls:(window as unknown as FixtureWindow).calls.length,activities:(window as unknown as FixtureWindow).activities})),before);
  assert.equal(await page.evaluate(()=>(window as unknown as FixtureWindow).disconnects),1);
}));

test('Finished initial snapshot never fetches activity or subscribes',async()=>fixture('present',async page=>{
  await page.getByText('Thanks for taking part',{exact:true}).waitFor();
  await page.waitForTimeout(2700);
  assert.equal(await page.evaluate(()=>(window as unknown as FixtureWindow).activities),0);
  assert.equal(await page.evaluate(()=>(window as unknown as FixtureWindow).subscriptions.length),0);
},async page=>{await page.evaluate(()=>{const w=window as unknown as FixtureWindow;w.fetchPresentation=(code:string)=>Promise.resolve(w.presentation(code,'finished'));});}));

test('Disconnected fallback recognizes finished snapshot and stops',async()=>fixture('present',async page=>{
  await page.waitForFunction(()=>(window as unknown as FixtureWindow).subscriptions.length===1);
  await page.evaluate(()=>{const w=window as unknown as FixtureWindow;w.fetchPresentation=(code:string)=>Promise.resolve(w.presentation(code,'finished'));});
  await page.getByText('Thanks for taking part',{exact:true}).waitFor({timeout:6000});
  const calls=await page.evaluate(()=>(window as unknown as FixtureWindow).calls.length);
  await page.waitForTimeout(2800);
  assert.equal(await page.evaluate(()=>(window as unknown as FixtureWindow).calls.length),calls);
}));

test('Late old-room snapshot and channel callbacks cannot overwrite new room',async()=>fixture('present',async page=>{
  await page.waitForFunction(()=>(window as unknown as FixtureWindow).subscriptions.length===1);
  await page.evaluate(()=>{const w=window as unknown as FixtureWindow;w.fetchPresentation=(code:string)=>code==='A'?new Promise(resolve=>{w.release=()=>resolve(w.presentation('A','finished'));}):Promise.resolve(w.presentation(code));});
  await page.waitForFunction(()=>Boolean((window as unknown as FixtureWindow).release));
  await page.evaluate(()=>{const w=window as unknown as FixtureWindow;w.code='B';w.render();});
  await page.getByText('Deck B',{exact:true}).waitFor();
  await page.evaluate(()=>{const w=window as unknown as FixtureWindow;w.release();w.subscriptions[0].callbacks.onPresentationEnded();});
  await page.waitForTimeout(100);
  assert.equal(await page.getByText('Thanks for taking part',{exact:true}).count(),0);
  assert.equal(await page.getByText('Deck B',{exact:true}).count(),1);
  assert.equal(await page.getByText('Content A',{exact:true}).count(),0);
}));


test('Unavailable Study rows stay absent and search reports no matches',async()=>fixture('study',async page=>{
  await page.getByRole('heading',{name:/Study Hall/}).waitFor();
  assert.equal(await page.getByRole('link',{name:'Resume',exact:true}).count(),0);
  await page.getByPlaceholder('Search study sets...').fill('no-such-set');
  await page.getByText('No matching quizzes',{exact:true}).waitFor();
  assert.equal(await page.getByRole('link',{name:'Study Now',exact:true}).count(),0);
},async page=>{await page.evaluate(()=>{const w=window as unknown as FixtureWindow;w.rows.quizzes=w.rows.quizzes.filter(r=>r.archived_at===null);});}));

test('Live reconnect continues polling after transient failure',async()=>fixture('present',async page=>{
  await page.waitForFunction(()=>(window as unknown as FixtureWindow).subscriptions.length===1);
  await page.evaluate(()=>{const w=window as unknown as FixtureWindow;w.fetchPresentation=()=>Promise.reject(new Error('temporary network error'));});
  await page.waitForFunction(()=>(window as unknown as FixtureWindow).calls.length>=2);
  await page.evaluate(()=>{const w=window as unknown as FixtureWindow;w.fetchPresentation=(code:string)=>Promise.resolve(w.presentation(code));});
  await page.waitForFunction(()=>(window as unknown as FixtureWindow).calls.length>=3);
  await page.evaluate(()=>(window as unknown as FixtureWindow).subscriptions[0].callbacks.onJoined());
  assert.equal(await page.getByText('Thanks for taking part',{exact:true}).count(),0);
  assert.equal(await page.evaluate(()=>(window as unknown as FixtureWindow).disconnects),0);
}));

test('Pending fallback cannot resurrect a room after End',async()=>fixture('present',async page=>{
  await page.waitForFunction(()=>(window as unknown as FixtureWindow).subscriptions.length===1);
  await page.evaluate(()=>{const w=window as unknown as FixtureWindow;w.fetchPresentation=()=>new Promise(resolve=>{w.release=()=>resolve(w.presentation('A'));});});
  await page.waitForFunction(()=>Boolean((window as unknown as FixtureWindow).release));
  const activities=await page.evaluate(()=>(window as unknown as FixtureWindow).activities);
  await page.evaluate(()=>{const w=window as unknown as FixtureWindow;w.subscriptions[0].callbacks.onPresentationEnded();w.release();});
  await page.getByText('Thanks for taking part',{exact:true}).waitFor();
  await page.waitForTimeout(2800);
  assert.equal(await page.evaluate(()=>(window as unknown as FixtureWindow).activities),activities);
}));

test('Unavailable initial presentation does not subscribe or poll',async()=>fixture('present',async page=>{
  await page.getByText('local unavailable',{exact:true}).waitFor();
  await page.waitForTimeout(2800);
  assert.equal(await page.evaluate(()=>(window as unknown as FixtureWindow).calls.length),1);
  assert.equal(await page.evaluate(()=>(window as unknown as FixtureWindow).subscriptions.length),0);
},async page=>{await page.evaluate(()=>{const w=window as unknown as FixtureWindow;w.fetchPresentation=()=>Promise.reject(new Error('local unavailable'));});}));

test('Changing code after End starts a fresh live session',async()=>fixture('present',async page=>{
  await page.waitForFunction(()=>(window as unknown as FixtureWindow).subscriptions.length===1);
  await page.evaluate(()=>(window as unknown as FixtureWindow).subscriptions[0].callbacks.onPresentationEnded());
  await page.getByText('Thanks for taking part',{exact:true}).waitFor();
  await page.evaluate(()=>{const w=window as unknown as FixtureWindow;w.code='B';w.render();});
  await page.getByText('Deck B',{exact:true}).waitFor();
  assert.equal(await page.getByText('Thanks for taking part',{exact:true}).count(),0);
  assert.equal(await page.evaluate(()=>(window as unknown as FixtureWindow).subscriptions.length),2);
}));


test('Finished reconnect snapshot ends without a separate ended event',async()=>fixture('present',async page=>{
  await page.waitForFunction(()=>(window as unknown as FixtureWindow).subscriptions.length===1);
  await page.evaluate(()=>{const w=window as unknown as FixtureWindow;w.subscriptions[0].callbacks.onJoined();w.subscriptions[0].callbacks.onPresentationUpdate(w.presentation('A','finished').presentation);});
  await page.getByText('Thanks for taking part',{exact:true}).waitFor({timeout:1000});
  assert.equal(await page.evaluate(()=>(window as unknown as FixtureWindow).disconnects),1);
}));
