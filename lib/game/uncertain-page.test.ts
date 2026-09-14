import assert from 'node:assert/strict';
import test from 'node:test';
import {build} from 'esbuild';
import {chromium} from '@playwright/test';

async function fixture(executed: boolean, readFails=false, host=false) {
 const bundle=await build({stdin:{resolveDir:process.cwd(),loader:'tsx',contents:`
  import React from 'react';import {createRoot} from 'react-dom/client';import Page from './app/game/[pin]/page';
  window.executed=${executed};window.readFails=${readFails};window.commands=0;window.publicReads=0;window.privateReads=0;
  window.holdRead=false;window.pendingReads=[];window.events=[];window.advanceRevision=false;
  window.holdCommand=false;window.pendingCommands=[];
  window.snapshot={pin:'TEST01',game_instance_id:'instance-A',status:'active',updated_at:new Date().toISOString(),question_started_at:new Date().toISOString(),current_question_index:0,players:[{id:'me',nickname:'Me',score:0}],current_answers:[],quiz:{questions:[{id:'q',order_index:0}]},current_question:{id:'q',text:'Which answer?',question_type:'multiple_choice',time_limit:120,answers:[{id:'a',text:'First'},{id:'b',text:'Second'}]}};
  if (${host}) {window.snapshot.status='waiting';window.snapshot.host_id='host-user'}
  createRoot(document.getElementById('root')).render(<Page/>);
 `},bundle:true,write:false,platform:'browser',jsx:'automatic',define:{'process.env':'{}'},plugins:[{name:'boundaries',setup(b){
 b.onResolve({filter:/^(next\/link|next\/navigation|@\/components\/supabase-provider|@\/lib\/supabase\/client|@\/lib\/game-engine\/(client|config)|@\/lib\/(player-session|host-session)|@\/lib\/game\/(use-game-audio|use-phoenix-game-channel))$/},a=>({path:a.path,namespace:'fixture'}));
 b.onLoad({filter:/.*/,namespace:'fixture'},a=>({resolveDir:process.cwd(),loader:'jsx',contents:
 a.path==='next/link'?`import React from 'react';export default function Link(p){return <a {...p}/>}`:
 a.path==='next/navigation'?`export const useParams=()=>({pin:'TEST01'});export const useRouter=()=>({push(){}});`:
 a.path.includes('supabase-provider')?`export const useAuth=()=>({user:${host?"{id:'host-user'}":"null"}});`:
 a.path.includes('supabase/client')?`export const supabase={};`:
 a.path.endsWith('/config')?`export const isPhoenixGameEngine=true,legacySupabaseGameEngine=false,liveGameEngineMisconfigured=false;`:
 a.path.endsWith('player-session')?`export const readPlayerSession=()=>(${host?"null":"{playerId:'me',playerToken:'own-token'}"});export const clearPlayerSession=()=>{};export const shouldDiscardPlayerSession=()=>false;`:
 a.path.endsWith('host-session')?`export const readHostSession=()=>(${host?"{hostToken:'host-token',hostId:'host-user'}":"null"});export const clearHostSession=()=>{};`:
 a.path.endsWith('use-game-audio')?`export const useGameAudio=()=>({playCorrect(){},playWrong(){},playTick(){},playFanfare(){}});`:
 a.path.endsWith('use-phoenix-game-channel')?`export const usePhoenixGameChannel=(options)=>{window.channel=options;return {connected:false,hasConnectedOnce:false,sendCommand(){throw Error('unexpected socket')}}};`:
 `export async function fetchPhoenixSession(){window.publicReads++;const s={...window.snapshot};delete s.current_answers;return {session:s}}
 export async function reconnectPhoenixSession(pin,payload){window.privateReads++;window.events.push({action:'read',commands:window.commands,payload});if(${host?"payload.host_token!=='host-token'":"payload.player_token!=='own-token'"})throw Error('wrong identity');const snapshot=structuredClone(window.snapshot);if(window.holdRead)return new Promise((resolve,reject)=>window.pendingReads.push({snapshot,resolve,reject}));if(window.commands&&window.readFails)throw Object.assign(Error('Read temporarily unavailable'),{reason:'unavailable'});return {session:snapshot}}
 export async function answerPhoenixSession(){window.commands++;window.events.push({action:'answer'});if(window.executed){window.snapshot.current_answers=[{player_id:'me',answer_id:'a'}];if(window.advanceRevision)window.snapshot.updated_at=new Date(Date.parse(window.snapshot.updated_at)+1000).toISOString();}if(window.holdCommand)return new Promise((resolve,reject)=>window.pendingCommands.push({resolve,reject}));throw Object.assign(Error('Outcome unknown'),{reason:'timeout'})}
 export async function advancePhoenixSession(){}export async function readyPhoenixSession(){}export async function revealPhoenixSession(){}export async function startPhoenixSession(){window.commands++;if(window.executed)window.snapshot.status='active';throw Object.assign(Error('Outcome unknown'),{reason:'timeout'})}`
 }));
 }}]});
 const browser=await chromium.launch();const page=await browser.newPage();page.setDefaultTimeout(5000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await page.route('**/*',r=>r.abort());await page.route('http://fixture.local/',r=>r.fulfill({contentType:'text/html',body:'<div id="root"></div>'}));await page.goto('http://fixture.local/');await page.addScriptTag({content:bundle.outputFiles[0].text});
 try { await (host?page.getByRole('button',{name:/Start game/i}):page.locator('.game-answer-btn').first()).waitFor(); } catch(e) {console.log(errors,await page.locator('body').innerText());await browser.close();throw e;}
 return {browser,page};
}

for (const executed of [true, false]) {
 test(`pre-command read cannot resolve unknown answer (${executed ? 'accepted' : 'not executed'})`, async t => {
  const {browser,page}=await fixture(executed,true);
  try {
   await page.evaluate(`window.holdRead=true; void window.channel.loadSnapshot()`);
   await page.waitForFunction('window.pendingReads.length===1');
   await page.evaluate(`window.holdRead=false; window.advanceRevision=true`);
   await page.locator('.game-answer-btn').filter({hasText:'First'}).click();
   await page.getByText('Game state is not confirmed. Check your connection, then check game status.',{exact:true}).waitFor();
   await page.evaluate(`const r=window.pendingReads.shift(); r.resolve({session:r.snapshot})`);
   await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
   assert.equal(await page.locator('.game-answer-btn').filter({hasText:'Second'}).isDisabled(),true,
    'pre-command empty private evidence must not resolve a later unknown command');
   assert.equal(await page.getByRole('button',{name:'Check game status',exact:true}).count(),1);
   await page.getByRole('button',{name:'Check game status',exact:true}).click();
   await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
   assert.equal(await page.getByRole('button',{name:'Check game status',exact:true}).count(),1);
   await page.evaluate('window.readFails=false');
   await page.getByRole('button',{name:'Check game status',exact:true}).click();
   await page.getByText(executed?'Answer locked. Waiting for the reveal.':'Choose one answer. Your choice submits immediately.',{exact:true}).waitFor();
   assert.equal(await page.locator('.game-answer-btn').filter({hasText:'Second'}).isDisabled(),executed);
   assert.equal(await page.getByRole('button',{name:'Check game status',exact:true}).count(),0);
   const events=await page.evaluate('window.events') as {action:string;payload?:{player_token?:string}}[];
   assert.deepEqual(events.map(e=>e.action),['read','read','answer','read','read','read']);
   assert.ok(events.filter(e=>e.action==='read').every(e=>e.payload?.player_token==='own-token'));
   t.diagnostic(JSON.stringify({executed,events,controls:await page.locator('body').innerText()}));
  } finally {await browser.close()}
 });
}

test('stale read errors cannot expire credentials or overwrite a newer phase notice',async()=>{
 const {browser,page}=await fixture(false);
 try {
  await page.evaluate(`window.holdRead=true; void window.channel.loadSnapshot()`);
  await page.waitForFunction('window.pendingReads.length===1');
  await page.evaluate(`window.channel.onSnapshot({...window.snapshot,status:'reveal',updated_at:new Date(Date.parse(window.snapshot.updated_at)+1000).toISOString()})`);
  await page.getByRole('heading',{name:'Answer Reveal',exact:true}).waitFor();
  const before=await page.locator('body').innerText();
  await page.evaluate(`window.pendingReads.shift().reject(Object.assign(Error('Expired old read'),{reason:'invalid_token'}))`);
  await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
  assert.equal(await page.locator('body').innerText(),before);
 } finally {await browser.close()}
});

for (const completion of ['success','error']) {
 test(`old command ${completion} cannot change the new round or clear its pending submission`,async()=>{
  const {browser,page}=await fixture(false,true);
  try {
   await page.evaluate('window.holdCommand=true');
   await page.locator('.game-answer-btn').filter({hasText:'First'}).click();
   await page.waitForFunction('window.pendingCommands.length===1');
   await page.evaluate(`window.oldSnapshot=structuredClone(window.snapshot); window.snapshot={...window.snapshot,current_question_index:1,current_question:{...window.snapshot.current_question,id:'q2',text:'New round?'},updated_at:new Date(Date.parse(window.snapshot.updated_at)+1000).toISOString()}; window.channel.onSnapshot(window.snapshot)`);
   await page.getByRole('heading',{name:'New round?',exact:true}).waitFor();
   assert.equal(await page.locator('.game-answer-btn').first().isEnabled(),true,'new round must not retain the previous command loading lock');
   await page.locator('.game-answer-btn').filter({hasText:'First'}).click();
   await page.waitForFunction('window.pendingCommands.length===2');
   // Equal-revision private evidence clears selection, but not an in-flight command.
   await page.evaluate('window.channel.onSnapshot({...window.snapshot},{allowEqual:true})');
   await page.evaluate(completion==='success'
    ? `window.pendingCommands.shift().resolve({session:{...window.oldSnapshot,updated_at:new Date(Date.parse(window.snapshot.updated_at)+1000).toISOString()}})`
    : `window.pendingCommands.shift().reject(Object.assign(Error('Old timeout'),{reason:'timeout'}))`);
   await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
   assert.equal(await page.getByRole('heading',{name:'New round?',exact:true}).count(),1);
   assert.equal(await page.locator('.game-answer-btn').first().isDisabled(),true,'old finally must not clear the new command loading lock');
   assert.equal(await page.getByRole('button',{name:'Check game status',exact:true}).count(),0);
   assert.equal(await page.evaluate('window.privateReads'),1,'old command completion must not start reconciliation');
  } finally {await browser.close()}
 });
}

test('uncertain accepted answer reconciles privately at the same revision and stays locked',async()=>{
 const {browser,page}=await fixture(true);try{
  await page.locator('.game-answer-btn').filter({hasText:'First'}).click();
  await page.getByText('Answer locked. Waiting for the reveal.',{exact:true}).waitFor();
  assert.equal(await page.locator('.game-answer-btn').filter({hasText:'Second'}).isDisabled(),true);
  assert.equal(await page.evaluate(()=> (window as unknown as {commands:number}).commands),1);
 }finally{await browser.close()}
});

test('failed reconciliation retains unknown state and retries only the private read',async()=>{
 const {browser,page}=await fixture(false,true);try{
  await page.locator('.game-answer-btn').filter({hasText:'First'}).click();
  await page.getByRole('button',{name:'Check game status',exact:true}).waitFor();
  assert.equal(await page.getByRole('heading',{name:'Which answer?',exact:true}).isVisible(),true);
  assert.equal(await page.locator('.game-answer-btn').filter({hasText:'Second'}).isDisabled(),true);
  await page.evaluate(()=>{Object.assign(window,{readFails:false})});
  await page.getByRole('button',{name:'Check game status',exact:true}).click();
  await page.getByText('Choose one answer. Your choice submits immediately.',{exact:true}).waitFor();
  assert.equal(await page.locator('.game-answer-btn').filter({hasText:'Second'}).isEnabled(),true);
  const counts=await page.evaluate(()=>({commands:(window as unknown as {commands:number}).commands,publicReads:(window as unknown as {publicReads:number}).publicReads,privateReads:(window as unknown as {privateReads:number}).privateReads}));
  assert.equal(counts.commands,1);assert.equal(counts.publicReads,0);assert.ok(counts.privateReads>=2);
 }finally{await browser.close()}
});

test('uncertain host start keeps the lobby visible and reconciles without replay',async()=>{
 const {browser,page}=await fixture(true,true,true);try{
  await page.getByRole('button',{name:/Start game/i}).click();
  await page.getByRole('button',{name:'Check game status',exact:true}).waitFor();
  assert.equal(await page.getByRole('button',{name:/Start game/i}).isVisible(),true);
  await page.getByRole('button',{name:/Start game/i}).click();
  assert.equal(await page.evaluate(()=> (window as unknown as {commands:number}).commands),1);
  await page.evaluate(()=>Object.assign(window,{readFails:false}));
  await page.getByRole('button',{name:'Check game status',exact:true}).click();
  await page.getByRole('heading',{name:'Which answer?',exact:true}).waitFor();
  assert.equal(await page.evaluate(()=> (window as unknown as {commands:number}).commands),1);
 }finally{await browser.close()}
});
