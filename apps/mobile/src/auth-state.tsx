import React, {createContext,useContext,useEffect,useState,useSyncExternalStore} from 'react';
import {AppState} from 'react-native';
import {createAuthController,type AuthState} from './auth';
import {createSupabaseAuthTransport} from './auth-transport';
import {credentialStore} from './auth-device-store';
import {validAuthConfig} from './auth-config';
import {bindAuthLifecycle} from './auth-lifecycle';
import {catalogConfig} from './config';
import {Page,Heading,Body,Button,Loading,Notice} from './ui';

type AuthContextValue=AuthState & {
 configured:boolean;
 personalRpc:import('./personal-contract').PersonalRpc;
 signIn(email:string,password:string):Promise<void>;
 signOut():Promise<void>;
 retry():Promise<void>;
};
const Context=createContext<AuthContextValue|null>(null);
const configured=validAuthConfig(catalogConfig.url,catalogConfig.key);
const guest:AuthState={user:null,phase:'ready',error:'',revision:0};
const subscribeGuest=()=>()=>{};
export function AuthProvider({children}:{children:React.ReactNode}){
 const [auth]=useState(()=>configured?createAuthController(createSupabaseAuthTransport(catalogConfig.url,catalogConfig.key),credentialStore):null);
 const state=useSyncExternalStore(auth?.subscribe??subscribeGuest,auth?.getSnapshot??(()=>guest),()=>guest);
 useEffect(()=>{
  if(!auth)return;
  const cleanup=bindAuthLifecycle(auth,AppState);
  void auth.restore();
  return cleanup;
 },[auth]);
 return <Context.Provider value={{...state,configured,personalRpc:(action,payload)=>auth&&state.user?auth.personalRpc(state.user.id,action,payload):Promise.reject(new Error('Cloud sync unavailable')),signIn:(email,password)=>auth?.signIn(email,password)??Promise.resolve(),signOut:()=>auth?.signOut()??Promise.resolve(),retry:()=>auth?.restore()??Promise.resolve()}}>{children}</Context.Provider>;
}
export function useAuth(){const auth=useContext(Context);if(!auth)throw new Error('Missing auth provider');return auth;}
/** Remove the entire account/navigation subtree, including exports and async callbacks, before a new identity can render. */
export function AccountBoundary({children}:{children:React.ReactNode}){
 const auth=useAuth();
 if(auth.phase==='loading'||auth.phase==='busy')return <Page><Loading label="Checking account session…"/>{auth.phase==='loading'?<Button label="Forget session / use guest" secondary onPress={()=>{void auth.signOut();}}/>:null}</Page>;
 if(auth.phase==='locked')return <Page><Heading>Your session needs attention</Heading><Notice message={auth.error}/><Body>Account practice stays hidden until your identity is verified. Forgetting the session does not delete local practice or your website account.</Body><Button label="Retry saved session" onPress={()=>{void auth.retry();}}/><Button label="Forget session / use guest" secondary onPress={()=>{void auth.signOut();}}/></Page>;
 return <React.Fragment key={auth.user?.id??'guest'}>{children}</React.Fragment>;
}
