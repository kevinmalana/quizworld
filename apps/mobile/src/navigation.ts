import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { Pack } from './study/types';
export type Routes = { Main:undefined; Detail:{pack?:Pack;id?:string}; Study:undefined; Live:undefined; Review:undefined };
export type Navigation = NativeStackNavigationProp<Routes>;
