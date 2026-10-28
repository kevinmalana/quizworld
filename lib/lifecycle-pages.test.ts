import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { chromium, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import type { PresentationParticipantSession } from './presentation/client';
import type { PresentationCommandOutcome } from './presentation/command-outcome';

type Snapshot = { presentation: { title: string; creator_id: string; run_id: string; join_code: string; status: string; current_slide_index?: number; slides: { id: string; slide_type: string; order_index: number; title?: string; content: { title?: string; question?: string } }[] } };
type FixtureFrame = [string | null, string | null, string, string, unknown];
type FixtureSocket = {
  sent: FixtureFrame[];
  open: () => void; close: () => void;
  reply: (ref: string | null, status: string, response?: unknown) => void;
};
type FixtureWindow = {
  user: { id: string } | null; code: string; queries: unknown[]; calls: string[]; activities: number;
  subscriptions: { callbacks: Record<string, (data?: unknown) => void> }[]; disconnects: number;
  rows: Record<string, Record<string, unknown>[]>;
  presentation: (code: string, status?: string) => Snapshot;
  fetchPresentation: (code: string) => Promise<Snapshot>;
  release: () => void; render: () => void;
  answers: Record<string, boolean>; participant: PresentationParticipantSession | null; nextOutcome: PresentationCommandOutcome | null;
  index: number; submitPromise: Promise<PresentationCommandOutcome>; releaseSubmit: () => void;
  sockets: FixtureSocket[];
};

const evidence = process.env.LIFECYCLE_EVIDENCE;
async function fixture(kind: 'study' | 'present', run: (page: Page) => Promise<void>, setup?: (page: Page) => Promise<void>, realTransport = false) {
  const mocks: Record<string, string> = {
    'next/link': `import React from 'react';export default p=><a {...p}/>;`,
    'next/navigation': `export const useParams=()=>({code:window.code});const router={push(){}};export const useRouter=()=>router;`,
    '@/components/supabase-provider': `export const useAuth=()=>({user:window.user,loading:false});`,
    '@/lib/supabase/client': `export const supabase={from(table){const filters=[];let head=false;const q={select(s,o){head=o?.head;return q},eq(k,v){filters.push(r=>r[k]===v);return q},is(k,v){filters.push(r=>r[k]===v);return q},in(k,v){filters.push(r=>v.includes(r[k]));return q},or(){return q},order(){return q},limit(){return q},ilike(k,v){filters.push(r=>r[k].toLowerCase().includes(v.replaceAll('%','').toLowerCase()));return q},maybeSingle(){return q},then(resolve){window.queries.push({table,head});const data=(window.rows[table]||[]).filter(r=>filters.every(f=>f(r)));return Promise.resolve({data:table==='profiles'?data[0]:data,count:data.length}).then(resolve)}};return q}};`,
    '@/lib/presentation/client': `export const readParticipantSession=()=>window.participant||null;export const readPresenterToken=()=> 'local-fixture-token';export const fetchPhoenixPresentation=(code)=>{window.calls.push(code);return window.fetchPresentation(code)};export const fetchPhoenixSlideActivity=(code,id)=>{window.activities++;return Promise.resolve({responses:[],questions:[],own_response:((window.answers)||{})[id]?{id:'own-'+id}:null})};`,
    '@/lib/presentation/presentation-socket': `export function subscribeToPresentation(o){window.subscriptions.push(o);const outcome=()=>window.nextOutcome||{status:'confirmed'};const c={disconnect(){window.disconnects++},nextSlide:async()=>outcome(),prevSlide:async()=>outcome(),gotoSlide:async()=>outcome(),setResultsHidden:async()=>outcome(),revealQuizAnswers:async()=>outcome(),endPresentation(){o.callbacks.onPresentationEnded();return outcome()},submitResponse:async(id)=>{const result=await(window.submitPromise||outcome());if(result.status==='confirmed')window.answers[id]=true;return result},submitQna:async()=>outcome(),upvoteQna:async()=>outcome()};return c}`
  };
  if (realTransport) {
    delete mocks['@/lib/presentation/presentation-socket'];
    mocks['@/lib/game-engine/client'] = `export const getGameServiceSocketUrl=()=> 'ws://synthetic-presentation.invalid';`;
  }
  const bundle = await build({stdin:{loader:'tsx',resolveDir:process.cwd(),contents:`import React from 'react';import{createRoot}from'react-dom/client';import Page from './app/${kind==='study'?'study':'present/[code]/live'}/page';window.root=createRoot(document.getElementById('root'));window.render=()=>window.root.render(<Page/>);window.render();`},bundle:true,write:false,platform:'browser',jsx:'automatic',plugins:[{name:'fixtures',setup(b){b.onResolve({filter:/.*/},a=>mocks[a.path]?{path:a.path,namespace:'fixture'}:undefined);b.onLoad({filter:/.*/,namespace:'fixture'},a=>({contents:mocks[a.path],loader:'jsx',resolveDir:process.cwd()}));}}]});
  // Hosts without the bundled Playwright headless shell can point
  // QW_TEST_CHROME at a system Chrome (see audit 2026-10-28). Harness-only.
  const browser = await chromium.launch(process.env.QW_TEST_CHROME ? { executablePath: process.env.QW_TEST_CHROME } : undefined);
  try {
    const page=await browser.newPage();
    const pageErrors: string[] = [];
    page.on('pageerror', error => pageErrors.push(error.message));
    await page.route('**/*',r=>r.request().url()==='http://qw-lifecycle.local/' ? r.fulfill({contentType:'text/html',body:'<p>LOCAL COMPONENT FIXTURE — no production auth proof</p><main id="root"></main>'}) : r.abort());
    await page.goto('http://qw-lifecycle.local/');
    await page.addScriptTag({content:'window.__name = (fn) => fn; window.process={env:{}};'});
    await page.evaluate(()=>{
      const w=window as unknown as FixtureWindow;w.user={id:'owner'};w.code='A';w.queries=[];w.calls=[];w.activities=0;w.subscriptions=[];w.disconnects=0;w.answers={};w.participant=null;w.nextOutcome=null;
      const quiz=(id:string,archived_at:string|null)=>({id,title:id,archived_at,category:'Science & Nature',created_at:'2026-01-01',questions:[{id:'q'}]});
      w.rows={quizzes:[quiz('archived assigned quiz','2026-01-02'),quiz('available private quiz',null)],study_progress:[{user_id:'owner',quiz_id:'archived assigned quiz',questions_studied:4,correct:3,mastery:75,last_studied:'2026-01-01'}],study_sessions:[{user_id:'owner',id:'session',xp_earned:295,correct:3,total:4,created_at:'2026-01-01'}],profiles:[{id:'owner',total_xp:295}],classroom_members:[{user_id:'owner',classroom_id:'class'}],classroom_assignments:[{classroom_id:'class',quiz_id:'archived assigned quiz'}]};
      w.presentation=(code:string,status='live')=>({presentation:{title:'Deck '+code,creator_id:'owner',run_id:'run-'+code,join_code:'123456',status,slides:[{id:'slide-'+code,slide_type:'content',order_index:0,content:{title:'Content '+code}}]}});
      w.fetchPresentation=(code:string)=>Promise.resolve(w.presentation(code));
    });
    await setup?.(page);
    if (realTransport) await page.addScriptTag({content: `
      window.sockets=[];
      window.WebSocket=class extends EventTarget {
        static OPEN=1; static CONNECTING=0; static CLOSED=3;
        readyState=0; sent=[];
        constructor(){super();window.sockets.push(this)}
        open(){this.readyState=1;this.dispatchEvent(new Event('open'))}
        send(raw){this.sent.push(JSON.parse(raw))}
        close(){this.readyState=3;this.dispatchEvent(new Event('close'))}
        reply(ref,status,response={}){this.dispatchEvent(new MessageEvent('message',{data:JSON.stringify([null,ref,'presentation:A','phx_reply',{status,response}])}))}
        push(event,payload){this.dispatchEvent(new MessageEvent('message',{data:JSON.stringify([null,null,'presentation:A',event,payload])}))}
      };`});
    await page.addScriptTag({content:bundle.outputFiles[0].text});
    await run(page);
    assert.deepEqual(pageErrors, [], 'React fixture has no uncaught browser errors');
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

// ---- Presentation runtime/recovery regressions (audit 2026-10-28 F1/F2) ----
// Synthetic participant/host decks; only the transport and read adapters are
// stubbed. No production room, account or network is involved.

test('Late answer confirmation cannot submit the next slide',async()=>fixture('present',async page=>{
  await page.getByPlaceholder('Type your response…').fill('First answer');
  await page.evaluate(()=>{const w=window as unknown as FixtureWindow;w.submitPromise=new Promise(resolve=>{w.releaseSubmit=()=>resolve({status:'confirmed'})});});
  await page.getByRole('button',{name:'Submit',exact:true}).click();
  await page.evaluate(()=>{const w=window as unknown as FixtureWindow;w.index=1;w.subscriptions[0].callbacks.onSlideChanged(w.presentation('A').presentation);});
  await page.getByRole('heading',{name:'Question two'}).waitFor();
  await page.evaluate(()=>(window as unknown as FixtureWindow).releaseSubmit());
  await page.waitForTimeout(100);
  assert.equal(await page.getByText('✅ Submitted!',{exact:true}).count(),0);
  assert.equal(await page.getByPlaceholder('Type your response…').inputValue(),'');
},openTextParticipantDeck));

test('New run snapshot invalidates old credentials instead of silently reusing them',async()=>fixture('present',async page=>{
  await page.getByPlaceholder('Type your response…').fill('Private old-run draft');
  await page.evaluate(()=>{const w=window as unknown as FixtureWindow;const pres=w.presentation('A').presentation;pres.run_id='run-B';w.subscriptions[0].callbacks.onPresentationUpdate(pres);});
  await page.getByText('This presentation has started a new run. Rejoin to continue.',{exact:true}).waitFor();
  assert.equal(await page.getByPlaceholder('Type your response…').count(),0);
  assert.equal(await page.evaluate(()=>(window as unknown as FixtureWindow).disconnects)>=1,true);
},openTextParticipantDeck));

test('An older HTTP fallback cannot roll back a newer channel slide',async()=>fixture('present',async page=>{
  await page.getByPlaceholder('Type your response…').waitFor();
  await page.evaluate(()=>{const w=window as unknown as FixtureWindow;const old=w.presentation('A');w.fetchPresentation=()=>new Promise(resolve=>{w.release=()=>resolve(old)});});
  await page.waitForFunction(()=>Boolean((window as unknown as FixtureWindow).release));
  await page.evaluate(()=>{const w=window as unknown as FixtureWindow;w.index=1;w.subscriptions[0].callbacks.onSlideChanged(w.presentation('A').presentation);w.release();});
  await page.getByRole('heading',{name:'Question two'}).waitFor();
  await page.waitForTimeout(200);
  assert.equal(await page.getByRole('heading',{name:'Question one'}).count(),0);
},openTextParticipantDeck));

test('Real transport + React: uncertain submit, disconnect fallback, reconnect and authoritative evidence without replay',async()=>fixture('present',async page=>{
  await page.waitForFunction(()=>(window as unknown as FixtureWindow).sockets.length===1);
  await page.evaluate(()=>{const w=window as unknown as FixtureWindow;const s=w.sockets[0];s.open();s.reply(s.sent[0][1],'ok',{presentation:w.presentation('A').presentation});});
  await page.getByPlaceholder('Type your response…').fill('Only send once');
  await page.getByRole('button',{name:'Submit',exact:true}).click();
  await page.waitForFunction(()=>(window as unknown as FixtureWindow).sockets[0].sent.some((f:FixtureFrame)=>f[3]==='response:submit'));
  await page.evaluate(()=>{const w=window as unknown as FixtureWindow;w.sockets[0].close();w.answers.s0=true;});
  await page.getByText(/couldn't confirm that action/).waitFor();
  await page.getByText(/Using read-only fallback/).waitFor();
  await page.waitForFunction(()=>(window as unknown as FixtureWindow).sockets.length===2);
  await page.getByText('✅ Submitted!',{exact:true}).waitFor({timeout:6000});
  await page.evaluate(()=>{const w=window as unknown as FixtureWindow;const old=w.sockets[0],s=w.sockets[1];s.open();s.reply(old.sent[0][1],'ok',{presentation:{...w.presentation('A').presentation,current_slide_index:1}});});
  assert.equal(await page.getByRole('heading',{name:'Question two'}).count(),0);
  await page.evaluate(()=>{const w=window as unknown as FixtureWindow;const s=w.sockets[1];s.reply(s.sent[0][1],'ok',{presentation:w.presentation('A').presentation});});
  await page.waitForTimeout(200);
  const counts=await page.evaluate(()=> (window as unknown as FixtureWindow).sockets.map((s:FixtureSocket)=>s.sent.filter((f:FixtureFrame)=>f[3]==='response:submit').length));
  assert.deepEqual(counts,[1,0]);
  assert.equal(await page.getByText('✅ Submitted!',{exact:true}).count(),1);
  await shot(page,'real-transport-reconciled');
},openTextParticipantDeck,true));

test('Same-slide polling preserves an unsubmitted draft',async()=>fixture('present',async page=>{
  await page.getByPlaceholder('Type your response…').fill('Keep this draft');
  await page.waitForFunction(()=>(window as unknown as FixtureWindow).calls.length>=2);
  assert.equal(await page.getByPlaceholder('Type your response…').inputValue(),'Keep this draft');
  assert.equal(await page.getByText('✅ Submitted!',{exact:true}).count(),0);
},openTextParticipantDeck));

test('Slide transition resets the scale value and its local interaction/submission gate',async()=>fixture('present',async page=>{
  const slider=page.getByRole('slider');
  await slider.focus(); await slider.press('End');
  assert.equal(await slider.inputValue(),'10');
  assert.equal(await page.getByRole('button',{name:'Submit',exact:true}).isEnabled(),true);
  await page.evaluate(()=>{const w=window as unknown as FixtureWindow;w.index=1;w.subscriptions[0].callbacks.onSlideChanged(w.presentation('A').presentation);});
  await page.getByRole('heading',{name:'Scale two'}).waitFor();
  assert.equal(await slider.inputValue(),'5');
  assert.equal(await page.getByRole('button',{name:'Submit',exact:true}).isDisabled(),true);
  await page.getByText('Move the slider to set your rating',{exact:true}).waitFor();
},async page=>{
  await openTextParticipantDeck(page);
  await page.evaluate(()=>{const w=window as unknown as FixtureWindow;w.presentation=(code:string,status='live')=>({presentation:{title:'Scale deck',creator_id:'owner',run_id:'run-A',join_code:'123456',status,current_slide_index:w.index,slides:[
    {id:'scale0',order_index:0,slide_type:'scale',title:'Scale one',content:{}},
    {id:'scale1',order_index:1,slide_type:'scale',title:'Scale two',content:{}}]}});});
}));

async function openTextParticipantDeck(page: Page) {
  await page.evaluate(()=>{
    const w=window as unknown as FixtureWindow;
    w.user=null;
    w.participant={participantId:'reg-player',participantToken:'local-synthetic-token',runId:'run-A',participantName:'Reg player'};
    w.answers={};w.index=0;
    w.presentation=(code:string,status='live')=>({presentation:{title:'Reg deck',creator_id:'owner',run_id:'run-A',join_code:'123456',status,current_slide_index:w.index,slides:[
      {id:'s0',order_index:0,slide_type:'open_text',content:{question:'Question one'}},
      {id:'s1',order_index:1,slide_type:'open_text',content:{question:'Question two'}}]}});
    w.fetchPresentation=(code:string)=>Promise.resolve(w.presentation(code));
  });
}

test('Polling to a new slide clears the previous response draft',async()=>fixture('present',async page=>{
  await page.getByPlaceholder('Type your response…').waitFor();
  await page.getByPlaceholder('Type your response…').fill('Answer intended for question one');
  await page.getByRole('button',{name:'Submit',exact:true}).click();
  await page.getByText('✅ Submitted!',{exact:true}).waitFor();
  await page.evaluate(()=>{const w=window as unknown as FixtureWindow;w.index=1;});
  await page.getByRole('heading',{name:'Question two'}).waitFor({timeout:7000});
  const draft=await page.getByPlaceholder('Type your response…').inputValue();
  assert.equal(draft,'');
  await shot(page,'draft-polling');
},openTextParticipantDeck));

test('Channel slide change clears the previous response draft',async()=>fixture('present',async page=>{
  await page.getByPlaceholder('Type your response…').waitFor();
  await page.getByPlaceholder('Type your response…').fill('Answer intended for question one');
  await page.getByRole('button',{name:'Submit',exact:true}).click();
  await page.getByText('✅ Submitted!',{exact:true}).waitFor();
  await page.evaluate(()=>{const w=window as unknown as FixtureWindow;w.index=1;w.subscriptions[0].callbacks.onSlideChanged(w.presentation('A').presentation);});
  await page.getByRole('heading',{name:'Question two'}).waitFor({timeout:3000});
  assert.equal(await page.getByPlaceholder('Type your response…').inputValue(),'');
},openTextParticipantDeck));

test('Repeated activity update on the same slide preserves drafts and own-response evidence',async()=>fixture('present',async page=>{
  await page.getByPlaceholder('Type your response…').waitFor();
  await page.evaluate(()=>{const w=window as unknown as FixtureWindow;w.subscriptions[0].callbacks.onJoined();});
  await page.getByPlaceholder('Type your response…').fill('Half-written answer');
  await page.evaluate(()=>{const w=window as unknown as FixtureWindow;w.subscriptions[0].callbacks.onPresentationUpdate(w.presentation('A').presentation);});
  await page.waitForTimeout(200);
  assert.equal(await page.getByPlaceholder('Type your response…').inputValue(),'Half-written answer');

  await page.getByRole('button',{name:'Submit',exact:true}).click();
  await page.getByText('✅ Submitted!',{exact:true}).waitFor();
  await page.evaluate(()=>{const w=window as unknown as FixtureWindow;w.subscriptions[0].callbacks.onPresentationUpdate(w.presentation('A').presentation);});
  await page.waitForTimeout(200);
  assert.equal(await page.getByText('✅ Submitted!',{exact:true}).count(),1,'own-response evidence survives a repeated same-slide update');
  await shot(page,'draft-preserved');
},openTextParticipantDeck));

test('Presenter command failures are visible, honest and recoverable',async()=>fixture('present',async page=>{
  await page.getByRole('button',{name:'Next →'}).waitFor();
  await page.evaluate(()=>{const w=window as unknown as FixtureWindow;w.subscriptions[0].callbacks.onJoined();});
  await page.evaluate(()=>{const w=window as unknown as FixtureWindow;w.nextOutcome={status:'uncertain',reason:'No reply from the presentation service.'};});
  await page.getByRole('button',{name:'Next →'}).click();
  await page.getByText(/unconfirmed/i).waitFor({timeout:3000});
  await shot(page,'command-uncertain');

  await page.evaluate(()=>{const w=window as unknown as FixtureWindow;w.nextOutcome={status:'rejected',reason:'Presentation socket is not connected.'};});
  await page.getByRole('button',{name:'Next →'}).click();
  await page.getByText(/not sent/i).waitFor({timeout:3000});

  await page.evaluate(()=>{const w=window as unknown as FixtureWindow;w.nextOutcome=null;w.index=1;w.subscriptions[0].callbacks.onPresentationUpdate(w.presentation('A').presentation);});
  await page.getByRole('heading',{name:'Slide two'}).waitFor({timeout:3000});
  assert.equal(await page.getByText(/unconfirmed|not sent/i).count(),0,'successful recovery clears the notice');
},async page=>{await page.evaluate(()=>{
  const w=window as unknown as FixtureWindow;
  w.presentation=(code:string,status='live')=>({presentation:{title:'Host deck',creator_id:'owner',run_id:'run-A',join_code:'123456',status,current_slide_index:w.index||0,slides:[
    {id:'h0',order_index:0,slide_type:'content',title:'Slide one',content:{}},
    {id:'h1',order_index:1,slide_type:'content',title:'Slide two',content:{}}]}});
  w.fetchPresentation=(code:string)=>Promise.resolve(w.presentation(code));
});}));

test('Transport disconnect immediately resumes read-only fallback and own-response evidence',async()=>fixture('present',async page=>{
  await page.getByPlaceholder('Type your response…').waitFor();
  await page.evaluate(()=>{const w=window as unknown as FixtureWindow;w.subscriptions[0].callbacks.onJoined();});

  // The transport reports an unintentional disconnect; the UI must show the
  // fallback state at once and resume polling.
  await page.evaluate(()=>{const w=window as unknown as FixtureWindow;w.subscriptions[0].callbacks.onDisconnected?.('Realtime connection lost — reconnecting.');});
  await page.getByText(/Using read-only fallback/i).waitFor({timeout:2000});

  // A submit that definitely did not reach the server must say so honestly.
  await page.evaluate(()=>{const w=window as unknown as FixtureWindow;w.nextOutcome={status:'rejected',reason:'Presentation socket is not connected.'};});
  await page.getByPlaceholder('Type your response…').fill('Unsure answer');
  await page.getByRole('button',{name:'Submit',exact:true}).click();
  await page.getByText(/not sent/i).waitFor({timeout:2000});

  // Earlier uncertain submit recorded server-side: fallback polling must
  // surface own-response evidence again.
  await page.evaluate(()=>{const w=window as unknown as FixtureWindow;w.answers['s0']=true;});
  await page.getByText('✅ Submitted!',{exact:true}).waitFor({timeout:6000});
  await shot(page,'fallback-evidence');
},openTextParticipantDeck));
