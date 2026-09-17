import {test,expect} from '@playwright/test';
import {build} from 'esbuild';

test('actual Account UI reports missing RPC unavailable and never enables/sends practice',async({page})=>{
 const id='00000000-0000-4000-8000-000000000001';let rpcCalls=0;
 const user={id,email:'a@fixture.invalid',aud:'authenticated',role:'authenticated',created_at:'2026-01-01T00:00:00Z'};
 await page.addInitScript(()=>sessionStorage.setItem('quizworld.auth.refresh.v1','fixture-A'));
 await page.route('https://**/*',async route=>{
  const url=route.request().url();
  if(url.includes('/auth/v1/user'))return route.fulfill({json:user});
  if(url.includes('/auth/v1/token'))return route.fulfill({json:{access_token:'fixture-A',refresh_token:'fixture-A',expires_in:3600,token_type:'bearer',user}});
  if(url.endsWith('/rest/v1/rpc/personal_sync_v1')){rpcCalls++;expect(route.request().postDataJSON().p_action).toBe('status');return route.fulfill({status:404,json:{code:'PGRST202',message:'Missing function'}});}
  return route.abort();
 });
 await page.goto('/');await page.getByRole('tab',{name:'Account',exact:true}).click();
 await page.getByRole('button',{name:'Connect personal sync',exact:true}).click();
 await expect(page.getByText('Cloud sync unavailable. Pending practice stays on this device. Connect and retry.',{exact:true}).first()).toBeVisible();
 expect(rpcCalls).toBe(1);await expect(page.getByRole('button',{name:'Clear personal cloud practice',exact:true})).toHaveCount(0);
 expect(await page.evaluate(id=>JSON.parse(localStorage.getItem(`quizworld:account-study:v1:${id}`)??'{}').sync,id)).toBeUndefined();
});

test('real provider atomically queues and fences sync on background, account switch and clear',async({page})=>{
 // Synthetic RPC/lifecycle/storage boundaries here; real SQL/HTTP acceptance is a separate mandatory script.
 const bundle=await build({stdin:{contents:`
 import React from 'react';import {createRoot} from 'react-dom/client';import {flushSync} from 'react-dom';
 import {PracticeProvider,usePractice} from './src/state';import {startSession,answerCurrent} from './src/study/model';import {parsePublicPack} from './src/catalog';import {publicRow} from './src/personal-fixture';
 const f=window.f={memory:{},held:null,hold:false,fail:false,events:[],generation:'0',serial:0};
 const a='00000000-0000-4000-8000-000000000001', b='00000000-0000-4000-8000-000000000002';
 const device={uuid:()=> '60000000-0000-4000-8000-'+String(++f.serial).padStart(12,'0'),loadPack:async()=>parsePublicPack(publicRow),lifecycle:{currentState:'active',addEventListener:(name,fn)=>{f.lifecycle=fn;return{remove(){}}}}};
 const rpc=owner=>async(action,payload)=>{if(f.hold){await new Promise(resolve=>f.held=resolve);f.hold=false;} const result={contract:1,owner,generation:f.generation,eventLimit:1000};if(action==='pull')return {...result,events:[]};if(action==='clear'){f.generation=String(Number(f.generation)+1);return {...result,generation:f.generation};}return result;};
 function Probe(){window.store=usePractice();return <pre id="state">{JSON.stringify({ready:store.ready,generation:store.state.sync?.generation,pending:store.state.sync?.outbox.length,id:store.state.active?.id})}</pre>}
 const root=createRoot(document.getElementById('root'));window.switchTo=who=>flushSync(()=>root.render(<PracticeProvider accountId={who==='A'?a:b} personalRpc={rpc(who==='A'?a:b)} personalDevice={device}><Probe/></PracticeProvider>));
 window.start=()=>store.update(s=>startSession(s,parsePublicPack(publicRow),'quickfire','50000000-0000-4000-8000-000000000001',1));
 window.answer=()=>store.update(s=>answerCurrent(s,publicRow.questions[0].answers[1].id,2));
 `,resolveDir:process.cwd(),loader:'tsx'},bundle:true,write:false,platform:'browser',format:'iife',plugins:[{name:'storage',setup(b){
 b.onResolve({filter:/^@react-native-async-storage\/async-storage$/},()=>({path:'storage',namespace:'fixture'}));
 b.onLoad({filter:/.*/,namespace:'fixture'},()=>({contents:`export default {getItem:async key=>window.f.memory[key]??null,setItem:async(key,value)=>{if(window.f.fail)throw Error('Device full');window.f.memory[key]=value;}};`}));
 }}]});
 await page.route('**/*',route=>route.abort());await page.setContent('<div id="root"></div>');await page.addScriptTag({content:bundle.outputFiles[0].text});
 await page.evaluate(`switchTo('A')`);await expect(page.locator('#state')).toContainText('"ready":true');
 expect(await page.evaluate(`store.syncNow()`)).toBe(true);
 expect(await page.evaluate(`start()`)).toBe(true);
 await page.evaluate(`f.fail=true`);expect(await page.evaluate(`answer()`)).toBe(false);
 await expect(page.locator('#state')).toContainText('"pending":0');
 await page.evaluate(`f.fail=false`);expect(await page.evaluate(`answer()`)).toBe(true);
 await expect(page.locator('#state')).toContainText('"pending":1');
 const stored=await page.evaluate(`Object.values(f.memory)[0]`);expect(String(stored)).toContain('"outbox":[{"version":1');
 await page.evaluate(`f.hold=true;window.result=null;void store.syncNow().then(ok=>window.result=ok)`);
 await expect.poll(()=>page.evaluate(`!!f.held`)).toBe(true);
 await page.evaluate(`f.lifecycle('background');f.held()`);await expect.poll(()=>page.evaluate('result')).toBe(false);
 await expect(page.locator('#state')).toContainText('"pending":1');
 await page.evaluate(`f.lifecycle('active');f.held=null;f.hold=true;void store.syncNow().then(ok=>window.result=ok)`);await expect.poll(()=>page.evaluate('!!f.held')).toBe(true);
 await page.evaluate(`switchTo('B');f.held()`);await expect(page.locator('#state')).toHaveText('{"ready":true}');
 await page.evaluate(`switchTo('A')`);await expect(page.locator('#state')).toContainText('"pending":1');
 await page.evaluate(`window.oldUpdate=store.update`);expect(await page.evaluate('store.clearCloud()')).toBe(true);
 await expect(page.locator('#state')).toHaveText('{"ready":true,"generation":"1","pending":0}');
 expect(await page.evaluate(`oldUpdate(s=>({...s,history:[]}))`)).toBe(false);
});
