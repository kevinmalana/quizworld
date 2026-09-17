import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRepository} from './storage';
import {emptyState,startSession} from './study/model';
import {pack} from './study/fixture';

test('guest, A and B never share checkpoints; delayed A writes stay in A',async()=>{
 const memory=new Map<string,string>();
 const adapter={getItem:async(k:string)=>memory.get(k)??null,setItem:async(k:string,v:string)=>{memory.set(k,v);}};
 const guest=createRepository(adapter),a=createRepository(adapter,'account-a'),b=createRepository(adapter,'account-b');
 const state=startSession(emptyState(),pack,'quickfire','A',1);
 await a.save(state);
 assert.deepEqual(await b.load(),emptyState());
 assert.deepEqual(await guest.load(),emptyState());
 assert.deepEqual(await createRepository(adapter,'account-a').load(),state);
});

import {playerStore} from './live-store';
test('live player capabilities are also scoped; a signed-in user never inherits guest/A room identity',async()=>{
 const keys:string[]=[]; const adapter={get:async(k:string)=>{keys.push(k);return null;},set:async()=>{},remove:async()=>{}};
 await playerStore(adapter).load(); await playerStore(adapter,'account-a').load(); await playerStore(adapter,'account-b').load();
 assert.equal(new Set(keys).size,3); assert.equal(keys[0],'quizworld.live-player.v1');
});

test('remounting the same account waits for its previous pending save, without blocking B',async()=>{
 let finish!:()=>void; const pending=new Promise<void>(r=>{finish=r;}); const memory=new Map<string,string>();
 const adapter={getItem:async(k:string)=>memory.get(k)??null,setItem:async(k:string,v:string)=>{await pending;memory.set(k,v);}};
 const expected=startSession(emptyState(),pack,'quickfire','A',1);
 const saving=createRepository(adapter,'A').save(expected);let loaded=false;
 const loading=createRepository(adapter,'A').load().then(s=>{loaded=true;return s;});
 await Promise.resolve();await Promise.resolve();assert.equal(loaded,false);
 assert.deepEqual(await createRepository(adapter,'B').load(),emptyState());
 finish();await saving;assert.deepEqual(await loading,expected);
});
