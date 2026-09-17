import {PersonalSyncError} from './personal-sync';
import type {PersonalRpc} from './personal-contract';
/** Only the auth transport supplies a session-bound token; no credential enters app state. */
export function createPersonalRpc(url:string,key:string,token:()=>Promise<string>,request:typeof fetch=fetch):PersonalRpc {
 return async(action,payload={})=>{
  const bearer=await token();const abort=new AbortController();const timer=setTimeout(()=>abort.abort(),12000);
  try{
   const response=await request(new URL('/rest/v1/rpc/personal_sync_v1',url),{method:'POST',headers:{apikey:key,Authorization:`Bearer ${bearer}`,'Content-Type':'application/json'},body:JSON.stringify({p_action:action,p_payload:payload}),signal:abort.signal,credentials:'omit'});
   if(!response.ok){
    const body=await response.json().catch(()=>({}));
    const reasons:Record<string,string>={personal_generation_changed:'Cloud was cleared elsewhere. Sync again to reconcile; old uploads stay blocked.',personal_replay_conflict:'Personal event conflict. No changed retry was accepted.',personal_event_limit:'Personal cloud storage limit reached. Clear personal cloud practice to continue.',personal_revision_changed:'Quiz version changed. This practice remains unsent.',personal_access_denied:'Quiz is no longer public. This practice remains unsent.',personal_unsupported:'Quiz is not supported for personal cloud practice.'};
    throw new PersonalSyncError(reasons[body?.message]??'Cloud sync unavailable. Pending practice stays on this device. Connect and retry.');
   }
   const text=await response.text();if(text.length>4_000_000)throw new Error('Too large');return JSON.parse(text);
  }catch(error){if(error instanceof PersonalSyncError)throw error;throw new PersonalSyncError('Cloud sync unavailable. Pending practice stays on this device. Connect and retry.');}
  finally{clearTimeout(timer);}
 };
}
