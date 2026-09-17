import React, {useState} from 'react';
import {Text, View, StyleSheet, Pressable,useWindowDimensions} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import type {Navigation} from '../navigation';
import {usePractice} from '../state';
import {samples} from '../samples';
import {Page,Heading,Title,Body,Meta,Card,Button,Notice,s,colors} from '../ui';
import {TopicArt,Icon} from '../art';
import {checkPublicAccess} from '../public-access';
export function Home(){
 const {fontScale}=useWindowDimensions();const nav=useNavigation<Navigation>();const {state,error}=usePractice();
 const [resumeError,setResumeError]=useState('');const [checking,setChecking]=useState(false);
 const active=state.active;const resumable=active && active.completedAt===null;
 const due=state.reviews.filter(r=>r.dueAt<=Date.now()).length;
 const resume=async()=>{if(!active)return;setChecking(true);setResumeError('');try{await checkPublicAccess(active.pack);nav.navigate('Study');}catch(e){setResumeError(e instanceof Error?e.message:'Could not check access.');}finally{setChecking(false);}};
 return <Page>
 <View><Text style={s.kicker}>{state.history.length||resumable?'BACK FOR ANOTHER DISCOVERY?':'A SMALL SESSION. A BIG DISCOVERY.'}</Text><Heading>{resumable?'Keep your curiosity\ngoing.':'Hello, curious mind.'}</Heading></View>
 <Notice message={error||resumeError}/>
 {resumable?<Card dark><Text style={[s.kicker,s.pale]}>PICK UP YOUR PRACTICE</Text><Text style={[s.title,s.white]}>{active.pack.title}</Text><Text style={[s.body,s.pale]}>Question {active.index+1} of {active.pack.questions.length} · checkpoint saved</Text><Button label={checking?'Checking access…':'Resume practice'} disabled={checking} signal onPress={()=>{void resume();}}/></Card>:due>0?<Card dark><Icon name="review" color={colors.signal}/><Text style={[s.title,s.white]}>{due} {due===1?'question':'questions'} worth another look.</Text><Text style={[s.body,s.pale]}>A mistake is a useful place to start.</Text><Button label="Review mistakes" signal onPress={()=>nav.navigate('Review')}/></Card>:<View style={h.feature}>
 <View style={[h.featureTop,fontScale>1.3&&{flexDirection:'column',alignItems:'flex-start'}]}><View style={h.featureText}><Text style={h.pill}>THE STARTER SAMPLE</Text><Text style={h.heroTitle}>A world of discovery.</Text><Meta>{samples[0].questions.length} questions · Geography</Meta></View><View style={h.art}><TopicArt size={135}/></View></View>
 <View style={h.peek}><Text style={s.kicker}>QUESTION PREVIEW</Text><Text style={h.preview}>{samples[0].questions[0].text}</Text><View style={h.chips}>{samples[0].questions[0].answers.slice(0,2).map(a=><Text key={a.id} style={h.chip}>{a.text}</Text>)}<Text style={h.more}>+2</Text></View></View>
 <Button label="Try a sample" onPress={()=>nav.navigate('Detail',{pack:samples[0]})}/><Text style={h.footnote}>No timer. No account. Just curiosity.</Text>
 </View>}
 <View style={h.section}><Title>Pick your next rabbit hole</Title><Meta>Bundled samples · ready offline</Meta></View>
 <View style={[h.topics,fontScale>1.3&&{flexDirection:'column'}]}>{samples.map((pack,i)=><Pressable key={pack.id} accessibilityRole="button" accessibilityLabel={`Open ${pack.title}`} onPress={()=>nav.navigate('Detail',{pack})} style={({pressed})=>[h.topic,{backgroundColor:i?'#f0e7fc':'#e3eefb'},pressed&&s.pressed]}><TopicArt topic={pack.category} size={82}/><Text style={h.topicTitle}>{pack.title}</Text><Meta>{pack.questions.length} questions</Meta></Pressable>)}</View>
 {state.reviews.length?<Card><Title>Make it stick</Title><Meta>{due} due now · {state.reviews.length-due} scheduled for later</Meta><Button label="Open review queue" secondary onPress={()=>nav.navigate('Review')}/></Card>:<View style={h.note}><Icon name="review"/><View style={{flex:1}}><Text style={h.noteTitle}>Room to get it wrong.</Text><Meta>Missed answers come back here for another go.</Meta></View></View>}
 {state.history.length>0?<><Title>On this device</Title>{state.history.slice(0,3).map(item=><Card key={item.id}><Body>{item.title}</Body><Meta>{item.correct} of {item.total} {item.mode==='flashcard'?'self-reported recalled':'correct'} · {new Date(item.completedAt).toLocaleDateString()}</Meta></Card>)}</>:null}
 <Meta>Personal practice · saved on this device, not synced.</Meta>
 </Page>;
}
const h=StyleSheet.create({feature:{backgroundColor:'#dcfa60',borderRadius:28,padding:18,gap:16},featureTop:{flexDirection:'row',alignItems:'center'},featureText:{flex:1,zIndex:1},art:{marginRight:-14,marginLeft:-20},pill:{fontSize:11,fontWeight:'800',letterSpacing:1,color:colors.ink,marginBottom:10},heroTitle:{fontFamily:'Bricolage',fontSize:30,lineHeight:32,fontWeight:'800',color:colors.ink,marginBottom:10},peek:{backgroundColor:'#f6ffce',borderRadius:17,padding:15,gap:8},preview:{fontSize:18,lineHeight:24,fontWeight:'700',color:colors.ink},chips:{flexDirection:'row',gap:8,alignItems:'center'},chip:{paddingHorizontal:12,paddingVertical:6,borderRadius:9,backgroundColor:'#fff',fontSize:13,color:colors.ink},more:{fontSize:13,color:colors.muted},footnote:{textAlign:'center',fontSize:12,color:colors.ink},section:{gap:3},topics:{flexDirection:'row',gap:12},topic:{flex:1,borderRadius:22,padding:14,gap:6,alignItems:'flex-start'},topicTitle:{fontFamily:'Bricolage',fontSize:19,lineHeight:23,fontWeight:'700',color:colors.ink},note:{flexDirection:'row',gap:12,paddingVertical:8,alignItems:'center'},noteTitle:{fontSize:15,fontWeight:'700',color:colors.ink}});
