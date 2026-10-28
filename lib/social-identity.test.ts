import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { chromium, type Page } from '@playwright/test';

type SocialFixture = { user: {id:string}|null; room: string; holdA: boolean; releases: (()=>void)[]; navigations: string[]; render: ()=>void };
declare global {interface Window { socialFixture: SocialFixture }}

async function fixture(kind: 'classrooms'|'groups', run:(page:Page)=>Promise<void>, holdA=false) {
  const mocks:Record<string,string>={
    'next/link':`import React from 'react';export default p=><a {...p}/>;`,
    'next/navigation':`const router={push:p=>window.socialFixture.navigations.push(p)};export const useRouter=()=>router;export const useParams=()=>({id:window.socialFixture.room});`,
    '@/components/supabase-provider':`export const useAuth=()=>({user:window.socialFixture.user,loading:false});`,
    '@/lib/supabase/client':`export const supabase={from(table){const actor=window.socialFixture.user?.id;const room=window.socialFixture.room;const q={select(){return q},eq(){return q},in(){return q},is(){return q},order(){return q},limit(){return q},single(){return q},maybeSingle(){return q},then(resolve,reject){
      const f=window.socialFixture;
      const result=()=>{
        if(table==='classrooms'||table==='trivia_groups')return {data:actor?{id:room,name:room+' private ${kind}',description:'Local synthetic fixture',join_code:'LOCAL0',created_by:actor,is_public:false,emoji:'X'}:null,error:null};
        if(table==='classroom_members'||table==='trivia_group_members')return {data:actor?[{id:'member-'+room,user_id:actor,role:table==='trivia_group_members'?(actor==='A'?'admin':'member'):(actor==='A'?'teacher':'student')}]:[],error:null};
        if(table==='profiles')return {data:actor?[{id:actor,username:'member-'+actor,display_name:actor+' private member',total_xp:0}]:[],error:null};
        return {data:[],error:null};
      };
      const pending=f.holdA&&room==='A'&&(table==='classrooms'||table==='trivia_groups')?new Promise(r=>f.releases.push(()=>r({data:null,error:{message:'Late old failure'}}))):Promise.resolve(result());
      return pending.then(resolve,reject);
    }};return q}};`,
  };
  const bundled=await build({stdin:{resolveDir:process.cwd(),loader:'tsx',contents:`import React from 'react';import{createRoot}from'react-dom/client';import{flushSync}from'react-dom';import Page from './app/${kind}/[id]/page';const root=createRoot(document.getElementById('root'));window.socialFixture.render=()=>flushSync(()=>root.render(<React.StrictMode><Page/></React.StrictMode>));window.socialFixture.render();`},bundle:true,write:false,platform:'browser',jsx:'automatic',plugins:[{name:'local-boundaries',setup(b){b.onResolve({filter:/.*/},a=>a.path.endsWith('.css')?{path:a.path,namespace:'css-empty'}:mocks[a.path]?{path:a.path,namespace:'fixture'}:undefined);b.onLoad({filter:/.*/,namespace:'fixture'},a=>({resolveDir:process.cwd(),loader:'jsx',contents:mocks[a.path]}));b.onLoad({filter:/.*/,namespace:'css-empty'},()=>({loader:'js',contents:''}));}}]});
  const browser=await chromium.launch();
  try {const page=await browser.newPage();const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await page.route('**/*',r=>r.request().url()==='http://social-fixture.local/'?r.fulfill({contentType:'text/html',body:'<div id="root"></div>'}):r.abort());await page.goto('http://social-fixture.local/');await page.addScriptTag({content:'window.__name=(fn)=>fn;window.process={env:{}};'});await page.evaluate((holdA)=>{window.socialFixture={user:{id:'A'},room:'A',holdA,releases:[],navigations:[],render:()=>{}}},holdA);await page.addScriptTag({content:bundled.outputFiles[0].text});await run(page);assert.deepEqual(errors,[]);}finally{await browser.close();}
}

for(const kind of ['classrooms','groups'] as const){
  test(`${kind}: sign-out immediately hides already displayed private state`,()=>fixture(kind,async page=>{
    await page.getByRole('heading',{name:new RegExp(`A private ${kind}`)}).waitFor();
    const visible=await page.evaluate((kind)=>{window.socialFixture.user=null;window.socialFixture.render();return document.body.innerText.includes('A private '+kind)},kind);
    assert.equal(visible,false,'prior signed-in private state must not remain after sign-out');
  }));
  test(`${kind}: a route/actor replacement hides the old scope before new data arrives`,()=>fixture(kind,async page=>{
    await page.getByRole('heading',{name:new RegExp(`A private ${kind}`)}).waitFor();
    const visible=await page.evaluate((kind)=>{window.socialFixture.user={id:'B'};window.socialFixture.room='B';window.socialFixture.render();return document.body.innerText.includes('A private '+kind)},kind);
    assert.equal(visible,false,'old room content must disappear in the identity-changing commit');
    await page.getByRole('heading',{name:new RegExp(`B private ${kind}`)}).waitFor();
  }));
  test(`${kind}: a late failed old load cannot navigate away from the new scope`,()=>fixture(kind,async page=>{
    await page.waitForFunction(()=>window.socialFixture.releases.length>0);
    await page.evaluate(()=>{window.socialFixture.user={id:'B'};window.socialFixture.room='B';window.socialFixture.holdA=false;window.socialFixture.render();});
    await page.getByRole('heading',{name:new RegExp(`B private ${kind}`)}).waitFor();
    await page.evaluate(async()=>{window.socialFixture.releases.forEach(release=>release());for(let i=0;i<12;i++)await Promise.resolve();});
    assert.deepEqual(await page.evaluate(()=>window.socialFixture.navigations),[]);
    assert.equal(await page.getByRole('heading',{name:new RegExp(`B private ${kind}`)}).count(),1);
  },true));
}
