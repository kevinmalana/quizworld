import React,{useState} from 'react';
import {useNavigation} from '@react-navigation/native';
import {randomUUID} from 'expo-crypto';
import type {Navigation} from '../navigation';
import {usePractice} from '../state';
import {startSession} from '../study/model';
import type {Review as ReviewItem,Pack} from '../study/types';
import {checkPublicAccess} from '../public-access';
import {Page,Heading,Title,Body,Meta,Card,Button,Notice} from '../ui';
export function Review(){
 const nav=useNavigation<Navigation>();const {state,busy,error,update}=usePractice();const [accessError,setAccessError]=useState('');const [checking,setChecking]=useState(false);const [removing,setRemoving]=useState<string|null>(null);
 const due=state.reviews.filter(r=>r.dueAt<=Date.now());const later=state.reviews.filter(r=>r.dueAt>Date.now());
 const groups=Array.from(new Set(due.map(r=>JSON.stringify([r.packId,r.revision])))).map(key=>due.filter(r=>JSON.stringify([r.packId,r.revision])===key));
 const begin=async(items:ReviewItem[])=>{const item=items[0];const pack:Pack={id:item.packId,revision:item.revision,title:item.title,category:item.category,source:item.source,sourceLabel:item.sourceLabel,questions:items.map(r=>r.question)};
 setChecking(true);setAccessError('');try{await checkPublicAccess(pack);const saved=await update(s=>startSession(s,pack,'review',randomUUID(),Date.now()));if(saved)nav.navigate('Study');}catch(e){setAccessError(e instanceof Error?e.message:'Could not check access.');}finally{setChecking(false);}};
 return <Page><Heading>Make mistakes useful.</Heading><Body muted>These are questions you missed, not a measure of your ability.</Body><Notice message={accessError||error}/><Title>{due.length} due now</Title>
 {state.active&&state.active.completedAt===null?<Card><Body>Finish your saved session first.</Body><Button label="Back to Home" onPress={()=>nav.popToTop()}/></Card>:groups.map(items=><Card key={JSON.stringify([items[0].packId,items[0].revision])}><Title>{items[0].title}</Title><Meta>{items.length} missed {items.length===1?'question':'questions'} · saved version</Meta><Button label={`Review ${items[0].title}`} disabled={busy||checking} onPress={()=>{void begin(items);}}/></Card>)}
 {!due.length?<Card><Title>Nothing due. Room to explore.</Title><Body>Practise a sample, or return when your next review is ready. Your past results stay in Home.</Body></Card>:null}
 <Card><Title>A simple review rhythm</Title><Body>A missed answer is due now. A correct retry returns after 1 day, then 3 days, then 7 days. Another miss restarts the rhythm.</Body><Meta>This is a simple schedule, not an adaptive memory model. Scheduled review is free in this development build. No subscription is active.</Meta></Card>
 {later.length?<Title>{later.length} scheduled for later</Title>:null}
 {[...due,...later].map(item=><Card key={item.key}><Body>{item.question.text}</Body><Meta>{item.title} · {item.successes?'Correct on retry':'Missed in practice'} · {item.dueAt<=Date.now()?'Due now':`Due ${new Date(item.dueAt).toLocaleString()}`}</Meta>{removing===item.key?<><Meta>Remove this question from review? Your completed session history is kept.</Meta><Button label="Confirm removal" disabled={busy} onPress={()=>{void update(s=>({...s,reviews:s.reviews.filter(r=>r.key!==item.key)})).then(ok=>{if(ok)setRemoving(null);});}}/><Button label="Keep question" secondary onPress={()=>setRemoving(null)}/></>:<Button secondary label={`Remove from review: ${item.question.text}`} disabled={busy} onPress={()=>setRemoving(item.key)}/>}</Card>)}
 <Meta>Review uses saved question versions. Public content requires a connection to recheck access before starting a new review. No cross-device sync.</Meta></Page>;
}
