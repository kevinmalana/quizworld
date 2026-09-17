import React, {useEffect, useRef, useState} from 'react';
import {AccessibilityInfo, Animated, View} from 'react-native';
import Svg, {Circle, Ellipse, Path, Rect, G} from 'react-native-svg';

const ink = '#172c4b';
/** Original vector field notes: a globe, a cassette and a completed card. */
export function TopicArt({topic='Geography', size=140, complete=false}:{topic?:string;size?:number;complete?:boolean}) {
 return <View accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants"><Svg width={size} height={size} viewBox="0 0 160 160">
 <Circle cx="80" cy="80" r="68" fill={complete?'#dcfa60':topic==='Geography'?'#c4e4ff':'#eed8ff'}/>
 <Path d="M13 42l9 3 3 9 3-9 9-3-9-3-3-9-3 9zM127 117l7 3 3 7 3-7 7-3-7-3-3-7-3 7z" fill={ink}/>
 {complete?<G transform="rotate(-9 80 80)"><Rect x="40" y="30" width="80" height="104" rx="16" fill="#fff" stroke={ink} strokeWidth="3"/><Circle cx="80" cy="72" r="23" fill={ink}/><Path d="M68 72l9 9 17-20" fill="none" stroke="#dcfa60" strokeWidth="5" strokeLinecap="round"/><Path d="M61 109h38" stroke={ink} strokeWidth="4" strokeLinecap="round"/></G>:topic==='Geography'?<G transform="rotate(-18 80 80)"><Circle cx="80" cy="75" r="43" fill="#dcfa60" stroke={ink} strokeWidth="3"/><Ellipse cx="80" cy="75" rx="19" ry="43" fill="none" stroke={ink} strokeWidth="2"/><Path d="M38 75h84M44 54h72M44 96h72M80 32v86M28 76a52 52 0 0 0 104 0M80 128v12M61 141h38" fill="none" stroke={ink} strokeWidth="3" strokeLinecap="round"/><Circle cx="98" cy="55" r="7" fill="#ff886f" stroke={ink} strokeWidth="2"/></G>:<G transform="rotate(-12 80 80)"><Rect x="29" y="46" width="102" height="73" rx="13" fill="#ffad96" stroke={ink} strokeWidth="3"/><Rect x="41" y="56" width="78" height="35" rx="8" fill="#fff6da" stroke={ink} strokeWidth="2"/><Circle cx="57" cy="74" r="10" fill="#bba5ef" stroke={ink} strokeWidth="3"/><Circle cx="103" cy="74" r="10" fill="#bba5ef" stroke={ink} strokeWidth="3"/><Path d="M59 118l7-20h30l7 20M72 74h16M117 26v14m0-14 13-3v14" fill="none" stroke={ink} strokeWidth="3" strokeLinecap="round"/></G>}
 </Svg></View>;
}
export function Icon({name,color=ink,size=24}:{name:string;color?:string;size?:number}) {
 const paths:Record<string,string>={Study:'M4 4h6c2 0 2 2 2 2s0-2 2-2h6v15h-6c-2 0-2 2-2 2s0-2-2-2H4zM12 6v15',Library:'M4 4h4v16H4zM11 4h4v16h-4zM18 5l3 14',Account:'M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0M4 21v-3a8 8 0 0 1 16 0v3',review:'M4 10a8 8 0 1 1 1 8M4 4v6h6',check:'M5 12l4 4L19 6'};
 return <Svg accessible={false} width={size} height={size} viewBox="0 0 24 24"><Path d={paths[name]||paths.Study} fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></Svg>;
}
/** Fail closed until the OS preference resolves; stop if it changes. */
export function Reveal({children}:{children:React.ReactNode}) {
 const value=useRef(new Animated.Value(1)).current;
 const [reduce,setReduce]=useState(true);
 useEffect(()=>{let live=true;void AccessibilityInfo.isReduceMotionEnabled().then(v=>{if(live)setReduce(v);});const sub=AccessibilityInfo.addEventListener('reduceMotionChanged',setReduce);return()=>{live=false;sub.remove();};},[]);
 useEffect(()=>{if(reduce){value.stopAnimation();value.setValue(1);return;}value.setValue(0);const animation=Animated.timing(value,{toValue:1,duration:240,useNativeDriver:true});animation.start();return()=>animation.stop();},[reduce,value]);
 return <Animated.View style={{gap:16,opacity:value,transform:[{translateY:value.interpolate({inputRange:[0,1],outputRange:[12,0]})}]}}>{children}</Animated.View>;
}
