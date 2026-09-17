import { catalogConfig, catalogConfigured } from './config';
import { getJson, publicCatalogUrl } from './catalog';
import type { Pack } from './study/types';
export async function checkPublicAccess(pack:Pack):Promise<void>{
 if(pack.source==='bundled')return;
 if(!catalogConfigured)throw new Error('Connect a public catalog to check access to this saved quiz.');
 const url=new URL(publicCatalogUrl(catalogConfig.url));url.searchParams.set('id',`eq.${pack.id}`);url.searchParams.set('select','id,is_public,archived_at');
 const result=await getJson(url.toString(),catalogConfig.key);
 if(!Array.isArray(result)||result.length!==1||result[0].id!==pack.id||result[0].is_public!==true||result[0].archived_at!==null)throw new Error('This quiz is no longer public. Remove its saved questions from Review. It cannot be started or resumed.');
}
