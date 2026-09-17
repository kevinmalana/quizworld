import React,{useEffect,useRef,useState} from 'react';
import {Keyboard,TextInput,View} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import type {Navigation} from '../navigation';
import {samples} from '../samples';
import {catalogConfig,catalogConfigured} from '../config';
import {getJson,parseCatalog,publicCatalogUrl,type CatalogItem} from '../catalog';
import {Page,Heading,Title,Body,Meta,Card,Button,Notice,Loading,s} from '../ui';
export function Library(){
 const nav=useNavigation<Navigation>();const [search,setSearch]=useState('');const [query,setQuery]=useState(''); const [page,setPage]=useState(0);const [items,setItems]=useState<CatalogItem[]>([]);const [enabled,setEnabled]=useState(false);const [loading,setLoading]=useState(false);const [error,setError]=useState('');const [retry,setRetry]=useState(0);const epoch=useRef(0);
 useEffect(()=>{const request=++epoch.current;if(!enabled)return;setLoading(true);setError('');
 getJson(publicCatalogUrl(catalogConfig.url,query,page),catalogConfig.key).then(parseCatalog).then(rows=>{if(request===epoch.current)setItems(rows);}).catch(e=>{if(request===epoch.current)setError(e instanceof Error?e.message:'Could not load quizzes.');}).finally(()=>{if(request===epoch.current)setLoading(false);});
 return ()=>{epoch.current++;};},[enabled,query,page,retry]);
 const searchNow=()=>{Keyboard.dismiss();setPage(0);setQuery(search.trim());setRetry(r=>r+1);};
 return <Page><Heading>Your next discovery</Heading><Body muted>Small samples here. More public quizzes when you are online.</Body><Title>Ready without internet</Title>
 {samples.map(pack=><Card key={pack.id}><Meta>{pack.category.toUpperCase()} · BUNDLED SAMPLE</Meta><Title>{pack.title}</Title><Body>{pack.questions.length} questions · flashcards or quickfire</Body><Button secondary label={`Open ${pack.title}`} onPress={()=>nav.navigate('Detail',{pack})}/></Card>)}
 <Title>Public QuizWorld library</Title><Meta>Community content, not a reviewed exam bank. Public text quizzes only; no private or classroom content. Search matches titles and categories.</Meta>
 {!catalogConfigured?<Card><Body>Public catalog is not configured.</Body><Meta>The bundled samples still work. A developer must add public Supabase configuration; no account or service-role key is needed.</Meta></Card>:!enabled?<Button label="Browse public quizzes" onPress={()=>setEnabled(true)}/>:<>
 <TextInput accessibilityLabel="Search quiz titles or categories" placeholder="Search titles or categories" placeholderTextColor="#536580" style={s.input} value={search} onChangeText={setSearch} onSubmitEditing={searchNow} returnKeyType="search" maxLength={100}/><Button label="Search quizzes" onPress={searchNow}/>
 {loading?<Loading label="Loading public quizzes…"/>:error?<><Notice message={error}/><Button label="Retry catalog" secondary onPress={()=>setRetry(r=>r+1)}/></>:<>
 <Meta>Page {page+1} · {items.length} results{query?` for “${query}”`:''}</Meta>
 {!items.length?<Card><Body>No matching public quizzes.</Body><Meta>Try a different title or category.</Meta></Card>:items.map(item=><Card key={item.id}><Meta>{item.category} · {item.count} questions</Meta><Title>{item.title}</Title><Button secondary label={`Open ${item.title}`} onPress={()=>nav.navigate('Detail',{id:item.id})}/></Card>)}
 <View style={s.row}>{page>0?<Button label="Previous page" secondary onPress={()=>setPage(p=>p-1)}/>:null}{items.length===20?<Button label="Next page" secondary onPress={()=>setPage(p=>p+1)}/>:null}</View></>}
 </>}</Page>;
}
