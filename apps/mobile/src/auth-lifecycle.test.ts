import {test} from 'node:test';
import assert from 'node:assert/strict';
import {bindAuthLifecycle} from './auth-lifecycle';
import {createAuthController} from './auth';

test('native lifecycle cancels background timers, revalidates resume and cleans listeners',async()=>{
 let refreshes=0,listener:(state:string)=>void=()=>{},timer:(()=>void)|null=null,delay=0,removed=false;
 const session={user:{id:'fixture-A'},refreshToken:'fixture',expiresAt:100000};
 const auth=createAuthController({login:async()=>session,restore:async()=>{refreshes++;return session;},logout:async()=>{}},{get:async()=> 'fixture',set:async()=>{},remove:async()=>{}});
 await auth.restore();
 const cleanup=bindAuthLifecycle(auth,{currentState:'active',addEventListener:(_event,fn)=>{listener=fn;return {remove:()=>{removed=true;}};}},{now:()=>1000,set:(fn,ms)=>{timer=fn;delay=ms;return 1;},clear:()=>{timer=null;}});
 assert.equal(delay,69000); assert.ok(timer);
 listener('background'); assert.equal(timer,null);
 listener('active'); await auth.restore(); assert.ok(refreshes>=2);
 const run=timer as (()=>void)|null; assert.ok(run); run!(); await auth.restore();
 cleanup(); assert.equal(removed,true); assert.equal(timer,null);
});
