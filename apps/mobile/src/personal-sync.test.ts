import {test} from 'node:test';
import assert from 'node:assert/strict';
import {emptyState,startSession,answerCurrent} from './study/model';
import {parsePublicPack} from './catalog';
import {publicRow} from './personal-fixture';
import {capturePersonalChange,synchronizePersonal} from './personal-sync';
test('one atomic state contains answer and stable metadata-only outbox, guest remains local',()=>{
 const started=startSession(emptyState(),parsePublicPack(publicRow),'quickfire','50000000-0000-4000-8000-000000000001',1);
 const answered=answerCurrent(started,publicRow.questions[0].answers[1].id,2);
 assert.equal(capturePersonalChange(started,answered,()=> '60000000-0000-4000-8000-000000000001',2).sync,undefined);
 const connected={...started,sync:{generation:'0',outbox:[]}};
 const result=capturePersonalChange(connected,{...answered,sync:connected.sync},()=> '60000000-0000-4000-8000-000000000001',2);
 assert.equal(result.sync?.outbox.length,1);
 assert.equal(result.sync?.outbox[0].correct,false);
 assert.equal(JSON.stringify(result.sync).includes('Unicode'),false);
 assert.deepEqual(capturePersonalChange(result,result,()=>{throw Error('duplicate');},3),result);
});
test('connecting preserves pre-contract public review as explicitly local, never uploads historical answers',async()=>{
 const account='00000000-0000-4000-8000-000000000001';
 const pack=parsePublicPack(publicRow);
 const local=answerCurrent(startSession(emptyState(),pack,'quickfire','50000000-0000-4000-8000-000000000001',1),publicRow.questions[0].answers[1].id,2);
 const actions:string[]=[];
 const rpc=async(action:string)=>{actions.push(action);return {contract:1,owner:account,generation:'0',eventLimit:1000,events:[]};};
 const result=await synchronizePersonal(local,account,rpc,async()=>pack);
 assert.deepEqual(result.state.reviews,local.reviews);assert.deepEqual(actions,['status','pull']);assert.equal(result.state.sync?.outbox.length,0);
 assert.match(result.message,/local-only/);
});
