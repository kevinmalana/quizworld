import type {Pack,Review,StudyState} from './study/types';
import {capabilitySchema,pullSchema,receiptSchema,type PersonalEvent,type PersonalRpc} from './personal-contract';
import {clearDownloadedPractice} from './practice-access';
const key=(e:PersonalEvent)=>JSON.stringify([e.quizId,e.revision,e.questionId]);
/** Called inside the same device repository write as the answer/removal. Never backfills guests/history. */
export function capturePersonalChange(before:StudyState,next:StudyState,uuid:()=>string,now:number):StudyState {
 if(!before.sync||before.sync.clearExpected!==undefined)return next;
 const added:PersonalEvent[]=[];const s=next.active;
 if(s?.pack.source==='public'&&s.id===before.active?.id){
  for(const r of s.responses.slice(before.active.responses.length))added.push({version:1,eventId:uuid(),generation:before.sync.generation,sessionId:s.id,quizId:s.pack.id,revision:s.pack.revision,questionId:r.questionId,answerId:r.answerId,correct:r.correct,kind:'answer',clientAt:now});
 }
 for(const r of before.reviews){if(r.source==='public'&&!next.reviews.some(n=>n.key===r.key))added.push({version:1,eventId:uuid(),generation:before.sync.generation,sessionId:uuid(),quizId:r.packId,revision:r.revision,questionId:r.question.id,answerId:null,correct:false,kind:'remove',clientAt:now});}
 if(!added.length)return next;
 if(before.sync.outbox.length+added.length>2000)throw new Error('Personal pending limit reached. Sync or clear personal cloud practice before continuing.');
 return {...next,sync:{...before.sync,outbox:[...before.sync.outbox,...added],localOnlyKeys:before.sync.localOnlyKeys?.filter(k=>!added.some(e=>key(e)===k))}};
}
export class PersonalSyncError extends Error {}
export function personalError(error:unknown):string {
 const message=error instanceof PersonalSyncError?error.message:'';
 return message||'Cloud sync unavailable. Pending practice stays on this device. Connect and retry.';
}
function owner<T extends {owner:string}>(value:T,account:string):T{if(value.owner!==account)throw new PersonalSyncError('Cloud identity changed. Retry after signing in.');return value;}
/** Pure workflow; caller holds a device write lock and lifecycle fence across this operation.
 * All receipts are read back through pull before any outbox event is acknowledged.
 * A thrown/uncertain response leaves the original persisted outbox intact. */
export async function synchronizePersonal(state:StudyState,account:string,rpc:PersonalRpc,loadPack:(id:string)=>Promise<Pack>,active:()=>boolean=()=>true):Promise<{state:StudyState;message:string}> {
 const check=()=>{if(!active())throw new PersonalSyncError('Sync interrupted. Pending practice is retained.');};
 check();const capability=owner(capabilitySchema.parse(await rpc('status')),account);check();
 let generation=capability.generation;let outbox=state.sync?.outbox??[];
 let next=state;
 let localOnlyKeys=state.sync?.localOnlyKeys??(state.sync?[]:state.reviews.filter(r=>r.source==='public').map(r=>r.key));
 if(state.sync?.clearExpected!==undefined){
  const cleared=owner(capabilitySchema.parse(await rpc('clear',{generation:state.sync.clearExpected})),account);check();
  generation=cleared.generation;next=clearDownloadedPractice(next);outbox=[];localOnlyKeys=[];
 }
 if(state.sync&&state.sync.generation!==generation){next=clearDownloadedPractice(next);localOnlyKeys=[];}
 let problem='';let failedEventId:string|undefined;
 for(const event of outbox){
  check();
  if(event.generation!==generation){problem='Older pending practice was blocked by a cloud clear. Clear personal cloud practice to discard it.';continue;}
  try{
   const result=await rpc('submit',event);check();
   const parsed=owner(capabilitySchema.extend({receipt:receiptSchema}).parse(result),account);
   if(JSON.stringify(parsed.receipt.event)!==JSON.stringify(event)||parsed.generation!==generation)throw new Error('Receipt mismatch');
  }catch(error){check();failedEventId=event.eventId;problem=personalError(error);break;}
 }
 check();const pulled=owner(pullSchema.parse(await rpc('pull')),account);check();
 // A concurrent clear must win over this device's just-submitted work.
 if(pulled.generation!==generation){next=clearDownloadedPractice(next);localOnlyKeys=[];generation=pulled.generation;problem='Cloud was cleared on another device. Older pending practice is blocked.';}
 const seen=new Map(pulled.events.map(r=>[r.event.eventId,r.event]));
 outbox=outbox.filter(e=>{const stored=seen.get(e.eventId);return !stored||JSON.stringify(stored)!==JSON.stringify(e);});
 if(failedEventId&&!outbox.some(e=>e.eventId===failedEventId))problem=outbox.length?'Some personal practice is still pending. Sync again to continue.':'';
 const derived=new Map<string,{event:PersonalEvent;dueAt:number;successes:number}>();
 let cursor=0n;
 for(const receipt of pulled.events){
  if(receipt.event.generation!==generation||BigInt(receipt.cursor)<=cursor)throw new Error('Invalid receipt stream');
  cursor=BigInt(receipt.cursor);const e=receipt.event;const k=key(e);
  if(e.kind==='remove'){derived.delete(k);continue;}
  const prev=derived.get(k);if(e.correct&&!prev)continue;
  const successes=e.correct?(prev?.successes??0)+1:0;
  derived.set(k,{event:e,successes,dueAt:Date.parse(receipt.receivedAt)+(e.correct?(successes===1?1:successes===2?3:7)*86400000:0)});
 }
 const packs=new Map<string,Pack|null>();const reviews:Review[]=[];let hidden=0;
 for(const [k,r] of derived){
  check();if(!packs.has(r.event.quizId)){try{packs.set(r.event.quizId,await loadPack(r.event.quizId));}catch{packs.set(r.event.quizId,null);}check();}
  const p=packs.get(r.event.quizId);const q=p?.questions.find(q=>q.id===r.event.questionId);
  if(!p||p.source!=='public'||p.id!==r.event.quizId||p.revision!==r.event.revision||!q){hidden++;continue;}
  reviews.push({key:k,packId:p.id,revision:p.revision,title:p.title,category:p.category,source:'public',sourceLabel:p.sourceLabel,question:q,dueAt:r.dueAt,successes:r.successes});
 }
 // Unsent local work remains visible only through the existing access-gated review flow.
 const pendingKeys=new Set(outbox.filter(e=>e.generation===generation).map(key));
 const retained=next.reviews.filter(r=>r.source==='bundled'||pendingKeys.has(r.key)||localOnlyKeys.includes(r.key));
 const retainedKeys=new Set(retained.map(r=>r.key));
 const combined=[...retained,...reviews.filter(r=>!retainedKeys.has(r.key))];
 if(combined.length>500)problem='Device review limit reached: showing 500 items. Remaining metadata is still in the cloud.';
 if(state.sync?.clearExpected!==undefined&&pulled.events.length)problem='Clear generation confirmed; newer cloud practice was preserved. Confirm clear again to remove newer practice.';
 check();return {state:{...next,reviews:combined.slice(0,500),sync:{generation,outbox,localOnlyKeys}},message:problem||`${outbox.length?'Pending personal practice':'Personal practice synced'} · ${pulled.events.length} server receipts. ${localOnlyKeys.length} older review items remain local-only.${hidden?` ${hidden} review items hidden: current public access/version unavailable.`:''} Not official results or XP.`};
}
