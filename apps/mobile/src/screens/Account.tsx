import React, {useState} from 'react';
import {Linking,Platform,Share,TextInput} from 'react-native';
import {usePractice} from '../state';
import {useAuth} from '../auth-state';
import {website} from '../config';
import {Page,Heading,Title,Body,Meta,Card,Button,Notice,s} from '../ui';

export function Account(){
 const store=usePractice();
 const auth=useAuth();
 const [confirm,setConfirm]=useState(false);
 const [confirmCloud,setConfirmCloud]=useState(false);
 const [confirmDownloads,setConfirmDownloads]=useState(false);
 const [confirmSignOut,setConfirmSignOut]=useState(false);
 const [exported,setExported]=useState('');
 const [message,setMessage]=useState('');
 const [email,setEmail]=useState('');
 const [password,setPassword]=useState('');
 const open=async(path:string)=>{try{await Linking.openURL(website+path);}catch{setMessage('Could not open your browser. Visit www.quizworld.xyz.');}};
 const exportData=async()=>{const text=JSON.stringify(store.state,null,2);setExported(text);try{await Share.share({message:text,title:'QuizWorld personal practice'});}catch{setMessage('Sharing is unavailable here. Select and copy the export below.');}};
 return <Page>
  <Heading>Your space.</Heading>
  <Body muted>{auth.user?`Signed in as ${auth.user.email??auth.user.id}`:'You are practising as a guest.'}</Body>
  <Notice message={store.error||auth.error||message}/>
  <Card>
   <Title>On this device, for you</Title>
   <Body>Checked answers and your last 100 completed sessions stay on this device. Optional personal sync shares public-quiz answer identifiers and recall, never question text or official results.</Body>
   <Meta>{auth.user?'Practice is separated by your verified account. Signing out hides it; signing back into this account restores it.':'Guest practice stays separate and is not copied into an account when you sign in.'}</Meta>
   <Meta>Practice data is unencrypted; do not use this build for private student records. No analytics or ads. Personal sync is separate from website history and XP. Exports contain practice only, never account credentials.</Meta>
   <Meta>Storage estimate: {(JSON.stringify(store.state).length*2/1024).toFixed(1)} KiB / 1,953 KiB local limit.</Meta>
  </Card>
  <Card>
   <Title>QuizWorld account</Title>
   {auth.user?<>
    <Meta>{Platform.OS==='web'?'Browser preview: your session is saved in this tab only, not encrypted native storage.':'Your refresh session is saved in device secure storage, not in practice data.'}</Meta>
    {!confirmSignOut?<Button label="Sign out" secondary disabled={store.busy} onPress={()=>setConfirmSignOut(true)}/>:<>
     <Body>Sign out on this device? Your unsynced practice stays in this account’s local storage, hidden from guests and other signed-in accounts. Export or clear it first if this is a shared device. Other website sessions are unchanged.</Body>
     <Button label="Confirm sign out" disabled={store.busy} onPress={()=>{setPassword('');setExported('');void auth.signOut();}}/>
     <Button label="Stay signed in" secondary onPress={()=>setConfirmSignOut(false)}/>
    </>}
   </>:auth.configured?<>
    <Body>Sign in with your existing email and password.</Body>
    <Meta>Signing in does not sync or merge guest practice. Google-only and MFA accounts, signup and password recovery remain on the website.</Meta>
    <TextInput accessibilityLabel="Account email" placeholder="Email" placeholderTextColor="#536580" value={email} onChangeText={setEmail} autoCapitalize="none" autoCorrect={false} autoComplete="email" keyboardType="email-address" textContentType="username" maxLength={254} style={s.input}/>
    <TextInput accessibilityLabel="Account password" placeholder="Password" placeholderTextColor="#536580" value={password} onChangeText={setPassword} autoCapitalize="none" autoCorrect={false} secureTextEntry autoComplete="current-password" textContentType="password" maxLength={1024} style={s.input}/>
    <Button label="Sign in" disabled={!email.trim()||!password||store.busy} onPress={()=>{const value=password;setPassword('');void auth.signIn(email,value);}}/>
   </>:<><Body>Account sign-in is not configured for this build.</Body><Meta>Bundled guest practice still works. A developer must supply the public Supabase project URL and anon/publishable key; never a service-role key.</Meta></>}
   <Button label="Account help on website" secondary onPress={()=>{void open('/login');}}/>
  </Card>
  {auth.user?<Card><Title>Personal cloud practice</Title><Body>{store.syncMessage}</Body><Meta>{store.state.sync?.outbox.length??0} pending events. Bundled samples and past device history stay local. Only new public practice after connecting is queued. Sync is manual; current public access is still required for review.</Meta>{store.state.sync?.clearExpected!==undefined?<Notice message="Cloud clear pending. Retry sync to confirm it; new uploads are paused."/>:null}<Button label={store.state.sync?'Sync personal practice':'Connect personal sync'} disabled={store.busy} onPress={()=>{void store.syncNow();}}/>{store.state.sync?confirmCloud?<><Body>Clear personal cloud practice for this account on all devices? Older queued uploads will be rejected permanently. Public downloaded practice on this device is removed after server confirmation. Other accounts, bundled practice and official website results are unchanged.</Body><Button label="Confirm clear personal cloud practice" disabled={store.busy} onPress={()=>{setExported('');void store.clearCloud().then(ok=>{if(ok)setConfirmCloud(false);});}}/><Button label="Keep cloud practice" secondary onPress={()=>setConfirmCloud(false)}/></>:<Button label="Clear personal cloud practice" secondary disabled={store.busy} onPress={()=>setConfirmCloud(true)}/>:null}</Card>:null}
  <Card><Title>Study Plus · in development</Title><Body>Subscriptions are not available in this build.</Body><Meta>A seven-day trial and US$5.99/month are proposed, not an available offer. Pricing, eligibility and store configuration are not finalized.</Meta><Meta>No trial has started and no charge can be made here. Purchase, restore and subscription management will appear only after verified store billing is connected.</Meta></Card>
  {!confirmDownloads?<Button label="Clear downloaded data" secondary disabled={store.busy} onPress={()=>setConfirmDownloads(true)}/>:<Card><Title>Remove saved public content?</Title><Body>This clears the current account or guest’s public checkpoint, public review questions and all local session history titles. Bundled practice and bundled review remain. You will return to Home. Other accounts, secure sign-in and website results are unchanged.</Body><Meta>Device practice is unencrypted. This is an app-level clear, not guaranteed forensic erasure or deletion from device backups. This discards pending uploads on this device, not cloud receipts. Sync can restore accessible cloud review. Use Clear personal cloud practice for all-device clearing.</Meta><Button label="Confirm clear downloaded data" disabled={store.busy} onPress={()=>{setExported('');void store.clearDownloads();}}/><Button label="Keep downloaded data" secondary onPress={()=>setConfirmDownloads(false)}/></Card>}
  <Title>Your practice data</Title><Button label="Export device practice" secondary disabled={store.busy} onPress={()=>{void exportData();}}/>
  {exported?<><Meta>Only share this with people you choose. Select and copy if your device cannot share.</Meta><TextInput accessibilityLabel="Practice export JSON" multiline editable={false} value={exported} style={s.input}/><Button label="Close export" secondary onPress={()=>setExported('')}/></>:null}
  {!confirm?<Button label="Clear device practice" secondary disabled={store.busy} onPress={()=>setConfirm(true)}/>:<Card><Title>Clear practice on this device?</Title><Body>This removes only the current {auth.user?'account’s':'guest’s'} checkpoint, review queue and local history. It does not delete your QuizWorld website account, another account’s local practice or cancel a subscription.</Body><Button label="Confirm clear device practice" disabled={store.busy} onPress={()=>{void store.reset().then(ok=>{if(ok){setConfirm(false);setExported('');setMessage('');}});}}/><Button label="Keep my practice" secondary onPress={()=>setConfirm(false)}/></Card>}
  <Title>Privacy & support</Title><Meta>Website account deletion is a separate support process. An authenticated in-app account deletion flow is not implemented; this development build is not store-ready.</Meta><Button label="Website privacy policy" secondary onPress={()=>{void open('/privacy');}}/><Button label="Website terms" secondary onPress={()=>{void open('/terms');}}/>
  <Meta>Content issue? Use the support contact in the website privacy policy. Include the quiz title, not another learner’s data.</Meta><Meta>QuizWorld mobile · development companion · 0.1.0</Meta>
 </Page>;
}
