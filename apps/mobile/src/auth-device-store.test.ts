import {test} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import vm from 'node:vm';

test('actual native credential adapter uses only SecureStore, device-only protection, and distinct key',async()=>{
 const calls:unknown[]=[]; const memory=new Map<string,string>();
 const result=await build({entryPoints:['src/auth-device-store.ts'],bundle:true,write:false,platform:'node',format:'cjs',plugins:[{name:'native-fixture',setup(b){
  b.onResolve({filter:/^expo-secure-store$/},()=>({path:'fixture',namespace:'secure'}));
  b.onLoad({filter:/.*/,namespace:'secure'},()=>({contents:`export const WHEN_UNLOCKED_THIS_DEVICE_ONLY=6; export const getItemAsync=globalThis.fixture.get; export const setItemAsync=globalThis.fixture.set; export const deleteItemAsync=globalThis.fixture.remove;`}));
 }}]});
 const module={exports:{} as {credentialStore:{get():Promise<string|null>;set(v:string):Promise<void>;remove():Promise<void>}}};
 vm.runInNewContext(result.outputFiles[0].text,{module,exports:module.exports,fixture:{
  get:async(k:string)=>memory.get(k)??null,
  set:async(k:string,v:string,options:unknown)=>{calls.push({k,options});memory.set(k,v);},
  remove:async(k:string)=>{memory.delete(k);},
 }});
 const store=module.exports.credentialStore;
 await store.set('synthetic-refresh'); assert.equal(await store.get(),'synthetic-refresh');
 assert.equal(JSON.stringify(calls),JSON.stringify([{k:'quizworld.auth.refresh.v1',options:{keychainAccessible:6}}]));
 await store.remove(); assert.equal(await store.get(),null);
});
