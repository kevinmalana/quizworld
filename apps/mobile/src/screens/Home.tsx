import React, {useState} from 'react';
import { Text, View } from 'react-native';
import {useNavigation} from '@react-navigation/native';
import type {Navigation} from '../navigation';
import {usePractice} from '../state';
import {samples} from '../samples';
import {Page,Heading,Title,Body,Meta,Card,Button,Notice,s} from '../ui';
import {checkPublicAccess} from '../public-access';
export function Home(){
 const nav=useNavigation<Navigation>();const {state,error}=usePractice(); const [resumeError,setResumeError]=useState('');const [checking,setChecking]=useState(false);
 const active=state.active;const resumable=active && active.completedAt===null;
 const due=state.reviews.filter(r=>r.dueAt<=Date.now()).length;
 const resume=async()=>{if(!active)return;setChecking(true);setResumeError('');try{await checkPublicAccess(active.pack);nav.navigate('Study');}catch(e){setResumeError(e instanceof Error?e.message:'Could not check access.');}finally{setChecking(false);}};
 return <Page><Text style={s.kicker}>YOUR POCKET STUDY SPACE</Text><Heading>A little practice.
A clearer answer.</Heading><Body muted>Pick up where you left off, or learn something new.</Body>
 <Notice message={error||resumeError}/>
 {resumable?<Card dark><Text style={[s.title,s.white]}>Ready when you are</Text><Text style={[s.body,s.pale]}>{active.pack.title}</Text><Text style={[s.meta,s.pale]}>Question {active.index+1} of {active.pack.questions.length} · checkpoint saved</Text><Button label={checking?'Checking access…':'Resume practice'} disabled={checking} signal onPress={()=>{void resume();}}/></Card>:due>0?<Card dark><Text style={[s.title,s.white]}>{due} {due===1?'question is':'questions are'} ready to revisit</Text><Text style={[s.body,s.pale]}>A mistake is a useful place to start.</Text><Button label="Review mistakes" signal onPress={()=>nav.navigate('Review')}/></Card>:<Card dark><Text style={[s.title,s.white]}>Start with something small</Text><Text style={[s.body,s.pale]}>Two geography questions. No account, no timer, no payment.</Text><Button label="Try a sample" signal onPress={()=>nav.navigate('Detail',{pack:samples[0]})}/></Card>}
 <View style={s.row}><Title>Make it stick</Title></View><Card><Body>Revisit your missed questions</Body><Meta>{state.reviews.length?`${due} due now · ${state.reviews.length-due} scheduled for later`:'Your review queue starts with your first missed answer.'}</Meta><Button label="Open review queue" secondary onPress={()=>nav.navigate('Review')}/></Card>
 {resumable||due>0?<Button label="Try a sample" secondary onPress={()=>nav.navigate('Detail',{pack:samples[0]})}/>:null}
 <Title>On this device</Title><View style={s.row}><Body>{state.history.length} completed {state.history.length===1?'session':'sessions'}</Body></View>
 {state.history.slice(0,3).map(h=><Card key={h.id}><Body>{h.title}</Body><Meta>{h.correct} of {h.total} {h.mode==='flashcard'?'self-reported recalled':'correct'} · {new Date(h.completedAt).toLocaleDateString()}</Meta></Card>)}
 <Meta>Personal practice only. Not synced, not verified XP, and not classroom completion.</Meta></Page>;
}
