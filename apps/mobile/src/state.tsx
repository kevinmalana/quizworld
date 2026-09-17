import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createRepository } from './storage';
import { emptyState } from './study/model';
import type { StudyState } from './study/types';

const repository = createRepository(AsyncStorage);
type Store = { state:StudyState; ready:boolean; loading:boolean; busy:boolean; error:string; retry:()=>void; update:(change:(state:StudyState)=>StudyState)=>Promise<boolean>; reset:()=>Promise<boolean> };
const Context = createContext<Store | null>(null);
export function PracticeProvider({children}:{children:React.ReactNode}) {
 const [state,setState] = useState(emptyState);
 const [loading,setLoading] = useState(true);
 const [ready,setReady]=useState(false);
 const [busy,setBusy] = useState(false);
 const [error,setError] = useState('');
 const current = useRef(state); const locked=useRef(false); const readable=useRef(false);
 const load = useCallback(async()=>{
  if(locked.current) return;
  locked.current=true; setLoading(true); setError('');
  try {const data=await repository.load(); current.current=data; setState(data); readable.current=true;setReady(true);}
  catch(e){setError(e instanceof Error ? e.message : 'Could not load device practice.');}
  finally{locked.current=false;setLoading(false);}
 },[]);
 useEffect(()=>{void load();},[load]);
 const write = async(change:(s:StudyState)=>StudyState, reset=false)=>{
  if(locked.current || (!readable.current && !reset)) return false;
  locked.current=true;setBusy(true);setError('');
  try {const next=change(current.current); await repository.save(next);current.current=next;setState(next);readable.current=true;setReady(true);return true;}
  catch(e){setError(e instanceof Error ? e.message : 'Could not save. Please retry.');return false;}
  finally{locked.current=false;setBusy(false);}
 };
 return <Context.Provider value={{state,ready,loading,busy,error,retry:()=>{void load();},update:change=>write(change),reset:()=>write(emptyState,true)}}>{children}</Context.Provider>;
}
export function usePractice(){const value=useContext(Context);if(!value)throw new Error('Missing practice provider');return value;}
