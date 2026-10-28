import test from 'node:test';
import assert from 'node:assert/strict';
import { readPlayerSession, writePlayerSession, clearPlayerSession, getPlayerSessionStorageKey } from './player-session';
import { readHostSession, readHostSessionAge, writeHostSession, clearHostSession, getHostSessionStorageKey } from './host-session';

function storage(initial: Record<string,string> = {}) {
  const values = new Map(Object.entries(initial));
  return { getItem: (k:string) => values.get(k) ?? null, setItem: (k:string,v:string) => {values.set(k,v)}, removeItem: (k:string) => {values.delete(k)} };
}
function denied() { throw new Error('Storage is denied'); }
async function withStores(session: ReturnType<typeof storage> | typeof denied, local: ReturnType<typeof storage> | typeof denied, run: ()=>void) {
  const originals = new Map(['window','sessionStorage','localStorage'].map(k=>[k,Object.getOwnPropertyDescriptor(globalThis,k)]));
  Object.defineProperty(globalThis,'window',{configurable:true,value:{}});
  for (const [key,value] of [['sessionStorage',session],['localStorage',local]] as const)
    Object.defineProperty(globalThis,key,{configurable:true,...(typeof value==='function'?{get:value}:{value})});
  try {run()} finally {for(const [key,descriptor] of originals) {if(descriptor)Object.defineProperty(globalThis,key,descriptor);else Reflect.deleteProperty(globalThis,key);}}
}

test('player credentials fall back when the sessionStorage getter itself is denied',()=>withStores(denied,storage({[getPlayerSessionStorageKey('ABC123')]:JSON.stringify({playerId:'p',playerToken:'local-synthetic',expiresAt:Date.now()+60000})}),()=>{
  assert.deepEqual(readPlayerSession('ABC123'),{playerId:'p',playerToken:'local-synthetic'});
}));
test('host credentials fall back when the sessionStorage getter itself is denied',()=>withStores(denied,storage({[getHostSessionStorageKey('ABC123')]:JSON.stringify({hostId:'h',hostToken:'local-synthetic',expiresAt:Date.now()+60000})}),()=>{
  assert.deepEqual(readHostSession('ABC123'),{hostId:'h',hostToken:'local-synthetic'});
}));
test('a denied local store does not invalidate a successful player session write',()=>withStores(storage(),denied,()=>{
  assert.doesNotThrow(()=>writePlayerSession('ABC123',{playerId:'p',playerToken:'synthetic'}));
  assert.equal(readPlayerSession('ABC123')?.playerId,'p');
}));
test('a denied session store does not prevent a successful local host write',()=>withStores(denied,storage(),()=>{
  assert.doesNotThrow(()=>writeHostSession('ABC123',{hostId:'h',hostToken:'synthetic'}));
  assert.equal(readHostSession('ABC123')?.hostId,'h');
}));
test('credential cleanup attempts the remaining store when one is denied',()=>{
  const local=storage({[getPlayerSessionStorageKey('ABC123')]:'saved',[getHostSessionStorageKey('ABC123')]:'saved'});
  return withStores(denied,local,()=>{
    assert.doesNotThrow(()=>clearPlayerSession('ABC123'));assert.doesNotThrow(()=>clearHostSession('ABC123'));
    assert.equal(local.getItem(getPlayerSessionStorageKey('ABC123')),null);assert.equal(local.getItem(getHostSessionStorageKey('ABC123')),null);
  });
});
test('failed writes cannot leave an older preferred-store credential shadowing the new role',()=>{
  const session=storage({[getPlayerSessionStorageKey('ABC123')]:JSON.stringify({playerId:'old',playerToken:'old-synthetic',expiresAt:Date.now()+60000})});
  session.setItem=()=>{throw new Error('Quota exceeded')};
  return withStores(session,storage(),()=>{
    writePlayerSession('ABC123',{playerId:'new',playerToken:'new-synthetic'});
    assert.equal(readPlayerSession('ABC123')?.playerId,'new');
  });
});
test('an immutable stale preferred store cannot produce a false save acknowledgment',()=>{
  const session=storage({[getPlayerSessionStorageKey('ABC123')]:'old'});
  session.setItem=denied;session.removeItem=denied;
  return withStores(session,storage(),()=>{
    assert.throws(()=>writePlayerSession('ABC123',{playerId:'new',playerToken:'new-synthetic'}),/cannot save game access/);
  });
});

test('expired host sessions have no active-session age',()=>withStores(storage({[getHostSessionStorageKey('ABC123')]:JSON.stringify({hostId:'h',hostToken:'synthetic',expiresAt:Date.now()-1000})}),storage(),()=>{
  assert.equal(readHostSessionAge('ABC123'),null);
}));
