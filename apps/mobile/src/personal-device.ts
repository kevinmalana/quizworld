import {AppState} from 'react-native';
import {randomUUID} from 'expo-crypto';
import {getJson,parsePublicPack,publicPackUrl} from './catalog';
import {catalogConfig} from './config';
import type {PersonalDevice} from './state';
/** Native effects are injected into the platform-neutral provider for lifecycle tests. */
export const personalDevice:PersonalDevice={uuid:randomUUID,lifecycle:AppState,async loadPack(id){
 const rows=await getJson(publicPackUrl(catalogConfig.url,id),catalogConfig.key);
 if(!Array.isArray(rows)||rows.length!==1)throw new Error('Public quiz unavailable');
 return parsePublicPack(rows[0]);
}};
