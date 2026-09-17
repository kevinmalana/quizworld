import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createRepository } from './storage';
import { clearDownloadedPractice } from './practice-access';
import { emptyState } from './study/model';
import type { Pack, StudyState } from './study/types';
import type {PersonalRpc} from './personal-contract';
import {capturePersonalChange,synchronizePersonal,personalError} from './personal-sync';
export type PersonalDevice={uuid:()=>string;loadPack:(id:string)=>Promise<Pack>;lifecycle:{currentState:string|null;addEventListener:(event:'change',fn:(value:string)=>void)=>{remove:()=>void}}};

type Props={children:React.ReactNode;accountId?:string;personalRpc?:PersonalRpc;personalDevice?:PersonalDevice};
type Store = { state:StudyState; ready:boolean; loading:boolean; busy:boolean; error:string; syncMessage:string; syncNow:()=>Promise<boolean>; clearCloud:()=>Promise<boolean>; retry:()=>void; update:(change:(state:StudyState)=>StudyState)=>Promise<boolean>; clearDownloads:()=>Promise<boolean>; reset:()=>Promise<boolean> };
const Context = createContext<Store | null>(null);
export function PracticeProvider({children,accountId,personalRpc,personalDevice}:Props) {
 return <ScopedPracticeProvider key={accountId??'guest'} accountId={accountId} personalRpc={personalRpc} personalDevice={personalDevice}>{children}</ScopedPracticeProvider>;
}
function ScopedPracticeProvider({children,accountId,personalRpc,personalDevice}:Props) {
 const [repository]=useState(()=>createRepository(AsyncStorage,accountId));
 const alive=useRef(true);
 const [state,setState] = useState(emptyState);
 const [loading,setLoading] = useState(true);
 const [ready,setReady]=useState(false);
 const [busy,setBusy] = useState(false);
 const [error,setError] = useState('');
 const [syncMessage,setSyncMessage]=useState('Cloud sync not connected. Connect to check availability.');
 const generation=useRef(0); const renderGeneration=generation.current;
 const lifecycle=useRef(0);const foreground=useRef(personalDevice?.lifecycle.currentState!=='background'&&personalDevice?.lifecycle.currentState!=='inactive');
 const [cacheGeneration,setCacheGeneration]=useState(0);
 const current = useRef(state); const locked=useRef(false); const readable=useRef(false);
 const load = useCallback(async()=>{
  if(locked.current) return;
  locked.current=true; setLoading(true); setError('');
  try {const data=await repository.load(); if(!alive.current)return;current.current=data; setState(data); readable.current=true;setReady(true);}
  catch(e){if(alive.current)setError(e instanceof Error ? e.message : 'Could not load device practice.');}
  finally{locked.current=false;if(alive.current)setLoading(false);}
 },[repository]);
 useEffect(()=>{alive.current=true;void load();const listener=personalDevice?.lifecycle.addEventListener('change',value=>{foreground.current=value==='active';lifecycle.current++;});return()=>{alive.current=false;lifecycle.current++;listener?.remove();};},[load]);
 const write = async(change:(s:StudyState)=>StudyState|Promise<StudyState>, reset=false, clear=false, capture=false, valid=()=>true)=>{
  if(!alive.current || generation.current!==renderGeneration || locked.current || (!readable.current && !reset)) return false;
  locked.current=true;setBusy(true);setError('');
  try {
   const changed=change(current.current);
   let next=changed instanceof Promise?await changed:changed;
   if(!alive.current||!valid())return false;
   if(capture&&accountId&&personalDevice)next=capturePersonalChange(current.current,next,personalDevice.uuid,Date.now());
   await repository.save(next);if(!alive.current||!valid())return false;
   if(capture&&next.sync&&next.sync.outbox.length>(current.current.sync?.outbox.length??0))setSyncMessage('Personal practice pending. Sync to upload and confirm server receipts.');
   current.current=next;setState(next);readable.current=true;setReady(true);if(reset||clear){generation.current++;setCacheGeneration(generation.current);}return true;
  }
  catch(e){if(alive.current)setError(e instanceof Error ? e.message : 'Could not save. Please retry.');return false;}
  finally{locked.current=false;if(alive.current)setBusy(false);}
 };
 const syncNow=async()=>{
  if(!accountId||!personalRpc||!personalDevice||!foreground.current)return false;
  const epoch=lifecycle.current;const cache= generation.current;
  const active=()=>alive.current&&foreground.current&&epoch===lifecycle.current&&cache===generation.current;
  let message='';let resetRoutes=false;
  const ok=await write(async saved=>{
   try{
    const result=await synchronizePersonal(saved,accountId,personalRpc,personalDevice.loadPack,active);
    if(!active())throw new Error('Sync interrupted.');
    message=result.message;resetRoutes=saved.sync?.generation!==result.state.sync?.generation||saved.sync?.clearExpected!==undefined;
    return result.state;
   }catch(e){message=personalError(e);throw new Error(message);}
  },false,false,false,active);
  if(active()){
   setSyncMessage(ok?message:(message||'Cloud sync interrupted; pending practice retained.'));
   if(ok&&resetRoutes){generation.current++;setCacheGeneration(generation.current);}
  }
  return ok;
 };
 const clearCloud=async()=>{
  if(!accountId||!current.current.sync)return false;
  // Persist the CAS intent before sending, so an uncertain response is safely retryable.
  const ok=await write(s=>s.sync?{...s,sync:{...s.sync,clearExpected:s.sync.clearExpected??s.sync.generation}}:s);
  return ok?syncNow():false;
 };
 const localClear=(s:StudyState)=>{const next=clearDownloadedPractice(s);return {...next,sync:s.sync?{...s.sync,outbox:[],localOnlyKeys:[]}:undefined};};
 return <Context.Provider value={{state,ready,loading,busy,error,syncMessage,syncNow,clearCloud,retry:()=>{void load();},update:change=>write(change,false,false,true),clearDownloads:()=>write(localClear,false,true),reset:()=>write(emptyState,true)}}><React.Fragment key={cacheGeneration}>{children}</React.Fragment></Context.Provider>;
}
export function usePractice(){const value=useContext(Context);if(!value)throw new Error('Missing practice provider');return value;}
