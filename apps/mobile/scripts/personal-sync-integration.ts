import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createPersonalRpc} from '../src/personal-transport';
import {capturePersonalChange,synchronizePersonal} from '../src/personal-sync';
import {getJson,parsePublicPack,publicPackUrl} from '../src/catalog';
import {emptyState,startSession,answerCurrent} from '../src/study/model';
import {createRepository,type StorageAdapter} from '../src/storage';
import type {PersonalRpc} from '../src/personal-contract';
import {capabilitySchema,pullSchema} from '../src/personal-contract';
import type {StudyState} from '../src/study/types';

async function main(){
 const url=process.env.QW_PERSONAL_URL!;
 assert.equal(new URL(url).hostname,'127.0.0.1','Never run against remote services');
 const a='00000000-0000-4000-8000-000000000001',b='00000000-0000-4000-8000-000000000002';
 const quiz='20000000-0000-4000-8000-000000000001';
 // PostgREST is real. This adapter only removes Supabase gateway's /rest/v1 prefix.
 const direct:typeof fetch=(input,init)=>{const mapped=new URL(String(input));mapped.pathname=mapped.pathname.replace(/^\/rest\/v1/,'');return fetch(mapped,init);};
 const rpcA=createPersonalRpc(url,'local-fixture',async()=>process.env.QW_PERSONAL_A!,direct);
 const rpcA2=createPersonalRpc(url,'local-fixture',async()=>process.env.QW_PERSONAL_A!,direct);
 const rpcB=createPersonalRpc(url,'local-fixture',async()=>process.env.QW_PERSONAL_B!,direct);
 const load=async(id:string)=>{const rows=await getJson(publicPackUrl(url,id),'fixture',direct);assert.ok(Array.isArray(rows)&&rows.length===1);return parsePublicPack(rows[0]);};
 if(process.env.QW_PERSONAL_UNAVAILABLE==='1'){
  await assert.rejects(()=>synchronizePersonal(emptyState(),a,rpcA,load),/Cloud sync unavailable/);
  console.log('PASS: actual absent PostgreSQL RPC is unavailable to the app transport, never synced');return;
 }
 const pack=await load(quiz);
 function device():StorageAdapter{const data=new Map<string,string>();return {getItem:async k=>data.get(k)??null,setItem:async(k,v)=>{data.set(k,v);}};}
 const storage1=device(),storage2=device();const repo1=createRepository(storage1,a),repo2=createRepository(storage2,a),repoB=createRepository(storage2,b);
 const connect=async(s:StudyState,who:string,rpc:PersonalRpc)=>(await synchronizePersonal(s,who,rpc,load)).state;
 let s1=await connect(await repo1.load(),a,rpcA);await repo1.save(s1);
 s1=startSession(s1,pack,'quickfire',randomUUID(),1);
 s1=capturePersonalChange(s1,answerCurrent(s1,pack.questions[0].answers.find(v=>!v.is_correct)!.id,2),randomUUID,2);
 await repo1.save(s1);assert.equal((await repo1.load()).sync?.outbox.length,1);
 const immutable=JSON.stringify(s1.sync!.outbox[0]);
 // Lost HTTP response after an actual COMMIT; outbox survives. No synthetic cloud receipt.
 const lost:PersonalRpc=async(action,payload)=>{const value=await rpcA(action,payload);if(action==='submit'||action==='pull')throw new Error('simulated lost response');return value;};
 await assert.rejects(()=>connect(s1,a,lost));assert.equal(JSON.stringify((await repo1.load()).sync!.outbox[0]),immutable);
 const accepted=pullSchema.parse(await rpcA2('pull'));assert.equal(accepted.events.length,1);
 s1=await connect(await repo1.load(),a,rpcA);await repo1.save(s1);
 assert.equal(s1.sync?.outbox.length,0);assert.equal(pullSchema.parse(await rpcA('pull')).events.length,1);
 let s2=await connect(await repo2.load(),a,rpcA2);await repo2.save(s2);
 assert.equal(s2.reviews.length,1);assert.equal(s2.reviews[0].question.text,pack.questions[0].text);
 assert.equal((await createRepository(storage2,a).load()).reviews.length,1,'second device reload persisted imported review');
 const isolated=await connect(await repoB.load(),b,rpcB);await repoB.save(isolated);assert.equal(isolated.reviews.length,0);
 assert.equal(pullSchema.parse(await rpcB('pull')).events.length,0);
 // Actual server-computed revision agrees with the client including Unicode/delimiters.
 assert.equal(accepted.events[0].event.revision,pack.revision);
 assert.equal(JSON.stringify(accepted).includes(pack.questions[0].text),false);
 assert.equal(JSON.stringify(accepted).includes(pack.title),false);
 // Removal is an ordered metadata event, not a writable text snapshot.
 const removed=capturePersonalChange(s2,{...s2,reviews:[]},randomUUID,3);await repo2.save(removed);
 s2=await connect(await repo2.load(),a,rpcA2);await repo2.save(s2);assert.equal(s2.reviews.length,0);
 s1=await connect(s1,a,rpcA);assert.equal(s1.reviews.length,0);
 // Older device has queued unknown work. Clear wins and never relabels it with new generation.
 let stale=startSession({...s1,active:null},pack,'quickfire',randomUUID(),4);
 stale=capturePersonalChange(stale,answerCurrent(stale,pack.questions[0].answers.find(v=>!v.is_correct)!.id,5),randomUUID,5);
 const old=stale.sync!.outbox[0];await repo1.save(stale);
 const pendingClear={...s2,sync:{...s2.sync!,clearExpected:s2.sync!.generation}};await repo2.save(pendingClear);
 const lostClear:PersonalRpc=async(action,payload)=>{const value=await rpcA2(action,payload);if(action==='clear')throw new Error('lost clear response');return value;};
 await assert.rejects(()=>connect(pendingClear,a,lostClear));
 const generation=capabilitySchema.parse(await rpcA('status')).generation;assert.equal(generation,'1');
 s2=await connect(await repo2.load(),a,rpcA2);await repo2.save(s2);assert.equal(s2.sync?.generation,'1');assert.equal(s2.reviews.length,0);
 await assert.rejects(()=>rpcA('submit',old),/Cloud was cleared/);
 const reconciled=await synchronizePersonal(await repo1.load(),a,rpcA,load);
 assert.equal(reconciled.state.sync?.outbox[0].generation,'0');assert.equal(reconciled.state.reviews.length,0);assert.match(reconciled.message,/blocked/);
 assert.equal(pullSchema.parse(await rpcA('pull')).events.length,0);
 // Null/anonymous token cannot claim an account; wrong-owner response cannot publish.
 const anonymous=createPersonalRpc(url,'fixture',async()=>'',direct);
 await assert.rejects(()=>anonymous('status'),/Cloud sync unavailable/);
 await assert.rejects(()=>connect(emptyState(),b,rpcA),/identity changed/);
 // Lifecycle/account disposal during real HTTP read prevents a returned state.
 let alive=true;const disposed:PersonalRpc=async(action,payload)=>{const result=await rpcA(action,payload);alive=false;return result;};
 await assert.rejects(()=>synchronizePersonal(emptyState(),a,disposed,load,()=>alive),/interrupted/);
 // Revoked/unavailable content is never rehydrated even with retained cloud receipts.
 const fresh={...old,eventId:randomUUID(),generation:'1'};await rpcA('submit',fresh);
 const hidden=await synchronizePersonal(emptyState(),a,rpcA,async()=>{throw Error('access revoked');});
 assert.equal(hidden.state.reviews.length,0);assert.match(hidden.message,/hidden/);
 assert.equal((await repoB.load()).reviews.length,0);
 console.log('PASS: metadata outbox persists -> actual RPC COMMIT -> lost response/retry/readback -> second-device review/reload; B isolation; remove; uncertain clear CAS; stale generation; lifecycle fence; access-gated hydration');
}
main().catch(error=>{console.error(error);process.exitCode=1;});
