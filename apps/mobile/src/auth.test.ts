import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createAuthController,type AuthTransport,type AuthSession} from './auth';

// Isolated mock auth transport: no credentials, mail, or production calls.
const session=(id:string):AuthSession=>({user:{id,email:`${id}@fixture.invalid`},refreshToken:`fixture-${id}`});
function fixture(){
 let token:string|null=null;
 const storage={get:async()=>token,set:async(v:string)=>{token=v;},remove:async()=>{token=null;}};
 const transport:AuthTransport={login:async()=>session('A'),restore:async()=>session('A'),logout:async()=>{}};
 return {storage,transport,token:()=>token};
}
test('verified login persists only refresh capability; logout hides identity before transport and permits B',async()=>{
 const f=fixture(),auth=createAuthController(f.transport,f.storage);
 await auth.restore();
 assert.equal(auth.getSnapshot().user,null);
 await auth.signIn('a@fixture.invalid','synthetic');
 assert.equal(auth.getSnapshot().user?.id,'A');
 assert.equal(f.token(),'fixture-A');
 const out=auth.signOut();
 assert.equal(auth.getSnapshot().user,null);
 await out;
 assert.equal(f.token(),null);
 f.transport.login=async()=>session('B');
 await auth.signIn('b@fixture.invalid','synthetic');
 assert.equal(auth.getSnapshot().user?.id,'B');
});

function deferred<T>() { let resolve!: (v:T)=>void; const promise=new Promise<T>(r=>{resolve=r;}); return {promise,resolve}; }
test('stale login cannot resurrect credentials or identity after logout',async()=>{
 const f=fixture(),pending=deferred<AuthSession>(); f.transport.login=()=>pending.promise;
 const auth=createAuthController(f.transport,f.storage); await auth.restore();
 const login=auth.signIn('a@fixture.invalid','synthetic'); await Promise.resolve();
 const logout=auth.signOut(); pending.resolve(session('A')); await Promise.all([login,logout]);
 assert.equal(auth.getSnapshot().user,null); assert.equal(f.token(),null);
});
test('failed restore never publishes cached identity; retry recovers and removal failure stays locked',async()=>{
 const f=fixture(); await f.storage.set('fixture-A'); f.transport.restore=async()=>{throw Error('offline');};
 const auth=createAuthController(f.transport,f.storage); await auth.restore();
 assert.equal(auth.getSnapshot().phase,'locked'); assert.equal(auth.getSnapshot().user,null);
 assert.equal(f.token(),'fixture-A');
 f.transport.restore=async()=>session('A'); await auth.restore(); assert.equal(auth.getSnapshot().user?.id,'A');
 f.storage.remove=async()=>{throw Error('keychain locked');}; await auth.signOut();
 assert.equal(auth.getSnapshot().phase,'locked'); assert.equal(auth.getSnapshot().user,null);
});
test('resume and authenticated expiry failures hide account data; old refresh cannot beat logout/B',async()=>{
 const f=fixture(),auth=createAuthController(f.transport,f.storage); await auth.restore(); await auth.signIn('a','synthetic');
 const pending=deferred<AuthSession>(); f.transport.restore=()=>pending.promise;
 const restore=auth.restore(); await Promise.resolve(); await Promise.resolve();
 assert.equal(auth.getSnapshot().user,null);
 const logout=auth.signOut(); pending.resolve(session('A')); await Promise.all([restore,logout]);
 f.transport.login=async()=>session('B'); await auth.signIn('b','synthetic');
 assert.equal(auth.getSnapshot().user?.id,'B'); assert.equal(f.token(),'fixture-B');
 f.transport.restore=async()=>{throw Error('401 refresh rejected');}; await auth.restore();
 assert.equal(auth.getSnapshot().user,null); assert.equal(auth.getSnapshot().phase,'locked');
});
test('credential save failures never expose the signed-in account',async()=>{
 const f=fixture(); f.storage.set=async()=>{throw Error('storage unavailable');};
 const auth=createAuthController(f.transport,f.storage); await auth.restore(); await auth.signIn('a','synthetic');
 assert.equal(auth.getSnapshot().user,null); assert.equal(auth.getSnapshot().phase,'locked');
});

test('session expiry is exposed for foreground refresh scheduling without exposing tokens',async()=>{
 const f=fixture(); f.transport.login=async()=>({...session('A'),expiresAt:123456});
 const auth=createAuthController(f.transport,f.storage); await auth.restore(); await auth.signIn('a','synthetic');
 assert.equal(auth.getSnapshot().expiresAt,123456);
 assert.equal('refreshToken' in auth.getSnapshot(),false);
});

test('offline logout still clears device credentials and reports unconfirmed server revocation',async()=>{
 const f=fixture(),auth=createAuthController(f.transport,f.storage);await auth.restore();await auth.signIn('a','synthetic');
 f.transport.logout=async()=>{throw Error('offline');};await auth.signOut();
 assert.equal(f.token(),null);assert.equal(auth.getSnapshot().user,null);assert.equal(auth.getSnapshot().phase,'ready');
 assert.match(auth.getSnapshot().error,/Server revocation could not be confirmed/);
});
test('logout clears a refresh write already in flight before allowing a different account',async()=>{
 const f=fixture(),pending=deferred<void>(); let entered=false;
 const original=f.storage.set;f.storage.set=async token=>{entered=true;await pending.promise;await original(token);};
 const auth=createAuthController(f.transport,f.storage);await auth.restore();const login=auth.signIn('a','synthetic');
 await Promise.resolve();await Promise.resolve();assert.equal(entered,true);
 const logout=auth.signOut();assert.equal(auth.getSnapshot().user,null);pending.resolve();await Promise.all([login,logout]);
 assert.equal(f.token(),null);assert.equal(auth.getSnapshot().phase,'ready');
});
