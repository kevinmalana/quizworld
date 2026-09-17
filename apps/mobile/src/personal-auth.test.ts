import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createAuthController} from './auth';
import {createPersonalRpc} from './personal-transport';
import {synchronizePersonal} from './personal-sync';
import {emptyState} from './study/model';

test('auth fences an accepted A request after logout and never retargets it to B',async()=>{
 let done!:(v:unknown)=>void;const calls:string[]=[];
 const auth=createAuthController({login:async id=>({user:{id},refreshToken:'fixture'}),restore:async()=>{throw Error('unused');},logout:async()=>{},personalRpc:async(owner)=>{calls.push(owner);return new Promise(resolve=>done=resolve);}},{get:async()=>null,set:async()=>{},remove:async()=>{}});
 await auth.restore();await auth.signIn('A','fixture');
 const request=auth.personalRpc('A','status');const rejection=assert.rejects(request,/identity changed/);
 await auth.signOut();await auth.signIn('B','fixture');done({owner:'A'});await rejection;
 await assert.rejects(()=>auth.personalRpc('A','submit',{}),/unavailable/);
 assert.deepEqual(calls,['A']);assert.equal(auth.getSnapshot().user?.id,'B');
});
test('missing deployment/network failure never fabricates a capability or sent receipt',async()=>{
 const unavailable=createPersonalRpc('https://fixture.invalid','public',async()=>'fixture',async()=>new Response(JSON.stringify({code:'PGRST202',message:'no rpc'}),{status:404}));
 await assert.rejects(()=>synchronizePersonal(emptyState(),'00000000-0000-4000-8000-000000000001',unavailable,async()=>{throw Error('must not hydrate');}),/Cloud sync unavailable/);
 const offline=createPersonalRpc('https://fixture.invalid','public',async()=>'fixture',async()=>{throw TypeError('network');});
 await assert.rejects(()=>offline('status'),/Cloud sync unavailable/);
});
