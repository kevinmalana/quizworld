import React,{useEffect,useState} from 'react';
import {Linking} from 'react-native';
import {randomUUID} from 'expo-crypto';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import type {Routes} from '../navigation';
import {usePractice} from '../state';
import {catalogConfig,website} from '../config';
import {getJson,parsePublicPack,publicPackUrl} from '../catalog';
import {startSession} from '../study/model';
import type {Mode,Pack} from '../study/types';
import {Page,Heading,Title,Body,Meta,Card,Button,Notice,Loading} from '../ui';
export function Detail({route,navigation}:NativeStackScreenProps<Routes,'Detail'>){
 const [pack,setPack]=useState<Pack|undefined>(route.params.pack);const [loading,setLoading]=useState(!pack);const [error,setError]=useState('');const [retry,setRetry]=useState(0);const [confirm,setConfirm]=useState(false);const store=usePractice();
 useEffect(()=>{if(route.params.pack)return;let active=true;setLoading(true);setError('');
 getJson(publicPackUrl(catalogConfig.url,route.params.id!),catalogConfig.key).then(data=>{if(!Array.isArray(data)||data.length!==1)throw new Error('This quiz is no longer public or could not be found.');return parsePublicPack(data[0]);}).then(p=>{if(active)setPack(p);}).catch(e=>{if(active)setError(e instanceof Error?e.message:'Could not load the quiz.');}).finally(()=>{if(active)setLoading(false);});return()=>{active=false;};},[route.params.id,route.params.pack,retry]);
 const start=async(mode:Mode)=>{if(!pack)return;const saved=await store.update(s=>startSession(s,pack,mode,randomUUID(),Date.now()));if(saved)navigation.navigate('Study');};
 const inProgress=store.state.active&&store.state.active.completedAt===null;
 if(loading)return <Page><Loading label="Getting the quiz ready…"/></Page>;
 return <Page><Notice message={error||store.error}/>{!pack?<><Heading>Practice unavailable</Heading><Body>Nothing was downloaded. Try another quiz, or retry when connected.</Body><Button label="Retry quiz" onPress={()=>setRetry(r=>r+1)}/><Button secondary label="Open quiz on website" onPress={()=>{void Linking.openURL(`${website}/quiz/${route.params.id}`).catch(()=>setError('Could not open your browser.'));}}/></>:<>
 <Meta>{pack.category.toUpperCase()} · {pack.questions.length} QUESTIONS</Meta><Heading>{pack.title}</Heading><Card><Title>How would you like to practise?</Title><Body>Quickfire</Body><Meta>Choose an answer, check it, then continue. No countdown in this version.</Meta><Body>Flashcards</Body><Meta>Recall the answer before revealing it. Mark your own recall, without a score or timer.</Meta></Card>
 {inProgress?<Card><Title>You have a saved session</Title><Body>Resume it from Home, or discard that checkpoint to start this quiz. Previously checked answers and review items are kept.</Body>{!confirm?<Button secondary label="Discard current checkpoint" disabled={store.busy} onPress={()=>setConfirm(true)}/>:<><Button label="Confirm discard" disabled={store.busy} onPress={()=>{void store.update(s=>({...s,active:null})).then(ok=>{if(ok)setConfirm(false);});}}/><Button secondary label="Keep current session" onPress={()=>setConfirm(false)}/></>}</Card>:<><Button label="Start quickfire" disabled={store.busy} onPress={()=>{void start('quickfire');}}/><Button label="Start flashcards" secondary disabled={store.busy} onPress={()=>{void start('flashcard');}}/></>}
 <Title>About this content</Title><Body>{pack.sourceLabel}</Body><Meta>{pack.source==='bundled'?'Included with the app. This complete text sample is available offline.':'Fetched from the public library. Your session saves a text snapshot for personal practice. Public access is checked when you resume; this is not a licensed or permanently downloadable study pack.'}</Meta><Meta>Answers are from the source. Explanations appear only where supplied. No certification accuracy or exam-pass claims.</Meta><Meta>Progress stays on this device. It will not update website XP or classroom assignments.</Meta></>}</Page>;
}
