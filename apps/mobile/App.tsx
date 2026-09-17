import React,{useState} from 'react';
import {useFonts} from 'expo-font';
import {Icon} from './src/art';
import {StatusBar} from 'expo-status-bar';
import {NavigationContainer,DefaultTheme} from '@react-navigation/native';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import type {Routes} from './src/navigation';
import {PracticeProvider,usePractice} from './src/state';
import {Home} from './src/screens/Home';
import {Library} from './src/screens/Library';
import {Account} from './src/screens/Account';
import {Detail} from './src/screens/Detail';
import {Study} from './src/screens/Study';
import {Review} from './src/screens/Review';
import {Live} from './src/screens/Live';
import {Page,Heading,Body,Button,Loading,Notice,colors} from './src/ui';
const Stack=createNativeStackNavigator<Routes>();
const Tabs=createBottomTabNavigator();
const theme={...DefaultTheme,colors:{...DefaultTheme.colors,primary:colors.ink,background:colors.canvas,card:'#fff',text:colors.ink,border:colors.line}};
function Main(){return <Tabs.Navigator screenOptions={({route})=>({tabBarIcon:({color})=><Icon name={route.name==='Home'?'Study':route.name} color={color}/>,headerTitle:'quizworld.',headerTitleStyle:{fontWeight:'800',fontSize:24},headerShadowVisible:false,tabBarActiveTintColor:colors.ink,tabBarInactiveTintColor:colors.muted,tabBarLabelStyle:{fontSize:15,lineHeight:22,fontWeight:'700',minHeight:22},tabBarItemStyle:{paddingVertical:4,minHeight:56},tabBarStyle:{height:72,paddingBottom:8,paddingTop:4}})}><Tabs.Screen name="Home" component={Home} options={{tabBarLabel:'Study',tabBarAccessibilityLabel:'Study'}}/><Tabs.Screen name="Library" component={Library}/><Tabs.Screen name="Account" component={Account}/></Tabs.Navigator>;}
function Shell(){const store=usePractice();const [confirm,setConfirm]=useState(false);
 if(store.loading)return <Page><Loading label="Loading saved practice…"/></Page>;
 if(!store.ready)return <Page><Heading>Your data needs attention</Heading><Notice message={store.error}/><Button label="Retry saved practice" onPress={store.retry}/>{confirm?<><Body>Reset will permanently remove local practice. It will not affect your website account.</Body><Button label="Confirm reset" disabled={store.busy} onPress={()=>{void store.reset();}}/><Button label="Cancel reset" secondary onPress={()=>setConfirm(false)}/></>:<Button label="Reset device practice" secondary onPress={()=>setConfirm(true)}/>}</Page>;
 return <NavigationContainer theme={theme}><Stack.Navigator screenOptions={{headerStyle:{backgroundColor:'#fff'},headerTintColor:colors.ink,headerShadowVisible:false,animation:'none'}}><Stack.Screen name="Main" component={Main} options={{headerShown:false}}/><Stack.Screen name="Detail" component={Detail} options={{title:'Choose your practice'}}/><Stack.Screen name="Study" component={Study} options={{title:'Practice',headerBackTitle:'Back'}}/><Stack.Screen name="Live" component={Live} options={{title:'Join live game'}}/><Stack.Screen name="Review" component={Review} options={{title:'Your review queue'}}/></Stack.Navigator></NavigationContainer>;
}
export default function App(){useFonts({Bricolage:require('./assets/fonts/BricolageGrotesque.ttf')});return <SafeAreaProvider><StatusBar style="dark"/><PracticeProvider><Shell/></PracticeProvider></SafeAreaProvider>;}
