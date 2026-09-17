import React from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
export const colors={canvas:'#f3f6fc',ink:'#172c4b',muted:'#536580',line:'#dce4ef',strong:'#78869b',signal:'#dcfa60',blue:'#264dd9',success:'#117450',successBg:'#e7f6ef',danger:'#b52942',dangerBg:'#fff0f3'};
export function Page({children}:{children:React.ReactNode}){return <SafeAreaView style={s.page} edges={['left','right','bottom']}><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.content}>{children}</ScrollView></SafeAreaView>;}
export function Heading({children}:{children:React.ReactNode}){return <Text accessibilityRole="header" style={s.heading}>{children}</Text>;}
export function Title({children}:{children:React.ReactNode}){return <Text accessibilityRole="header" style={s.title}>{children}</Text>;}
export function Body({children,muted=false}:{children:React.ReactNode;muted?:boolean}){return <Text style={[s.body,muted&&s.muted]}>{children}</Text>;}
export function Meta({children}:{children:React.ReactNode}){return <Text style={s.meta}>{children}</Text>;}
export function Card({children,dark=false}:{children:React.ReactNode;dark?:boolean}){return <View style={[s.card,dark&&s.dark]}>{children}</View>;}
export function Button({label,onPress,secondary=false,disabled=false,signal=false}:{label:string;onPress:()=>void;secondary?:boolean;disabled?:boolean;signal?:boolean}){return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{disabled}} disabled={disabled} onPress={onPress} style={({pressed})=>[s.button,secondary&&s.secondary,signal&&s.signal,pressed&&s.pressed,disabled&&s.disabled]}><Text style={[s.buttonText,(secondary||signal)&&s.ink]}>{label}</Text></Pressable>;}
export function Notice({message}:{message:string}){return message?<View accessibilityRole="alert" accessibilityLiveRegion="polite" style={s.notice}><Text style={s.noticeText}>{message}</Text></View>:null;}
export function Loading({label='Loading…'}:{label?:string}){return <View style={s.loading}><ActivityIndicator color={colors.ink}/><Body>{label}</Body></View>;}
export const s=StyleSheet.create({
 page:{flex:1,backgroundColor:colors.canvas}, content:{padding:20,gap:20,width:'100%',maxWidth:680,alignSelf:'center',paddingBottom:32},
 heading:{fontSize:32,lineHeight:39,fontWeight:'800',color:colors.ink,letterSpacing:-0.8},title:{fontSize:21,lineHeight:28,fontWeight:'700',color:colors.ink},body:{fontSize:17,lineHeight:25,color:colors.ink},muted:{color:colors.muted},meta:{fontSize:14,lineHeight:21,color:colors.muted},
 card:{backgroundColor:'#fff',borderWidth:1,borderColor:colors.line,borderRadius:20,padding:20,gap:14},dark:{backgroundColor:colors.ink,borderColor:colors.ink},
 button:{minHeight:52,paddingVertical:14,paddingHorizontal:18,borderRadius:12,backgroundColor:colors.ink,alignItems:'center',justifyContent:'center',borderWidth:1,borderColor:colors.ink},buttonText:{color:'#fff',fontSize:17,lineHeight:23,fontWeight:'700',textAlign:'center'},secondary:{backgroundColor:'#fff',borderColor:colors.strong},signal:{backgroundColor:colors.signal,borderColor:colors.signal},ink:{color:colors.ink},pressed:{opacity:0.8},disabled:{opacity:0.5},
 notice:{backgroundColor:colors.dangerBg,padding:16,borderRadius:12,borderWidth:1,borderColor:colors.danger},noticeText:{fontSize:16,lineHeight:24,color:colors.danger},loading:{padding:24,gap:16,alignItems:'center'},row:{flexDirection:'row',gap:12,alignItems:'center',flexWrap:'wrap'},grow:{flex:1},white:{color:'#fff'},pale:{color:'#dce4ef'},kicker:{color:colors.muted,fontSize:13,fontWeight:'800',letterSpacing:1.2},
 input:{borderWidth:1,borderColor:colors.strong,borderRadius:12,backgroundColor:'#fff',color:colors.ink,padding:16,fontSize:17,minHeight:54},divider:{height:1,backgroundColor:colors.line},
});
