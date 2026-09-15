/* Real local policy/browser integration. Never use against production.
 * Only Next navigation/Auth context/client configuration are fixture adapters;
 * StudyPageClient, solo page, React, Supabase JS, HTTP/PostgREST and SQL are real.
 * Does not exercise SSR, hosted Auth, classroom navigation or persistence RPCs.
 */
const assert = require('node:assert/strict');
const { spawn, execFileSync } = require('node:child_process');
const { createHmac, randomBytes } = require('node:crypto');
const http = require('node:http');
const { readFileSync } = require('node:fs');
const { build } = require('esbuild');
const { chromium, expect } = require('@playwright/test');
const { createClient } = require('@supabase/supabase-js');
const path = require('node:path');

(async () => {
  const socket = process.env.ASSIGNMENT_PG_SOCKET;
  assert.match(socket || '', /^\/dev\/shm\/qw-assignment-[\w-]+$/);
  const secret = randomBytes(48).toString('hex');
  const uid = '00000000-0000-0000-0000-000000000002';
  const quiz = '20000000-0000-0000-0000-000000000001';
  function jwt(role, sub) {
    const data = [ {alg:'HS256',typ:'JWT'}, {role,sub,exp:Math.floor(Date.now()/1000)+600} ].map(x => Buffer.from(JSON.stringify(x)).toString('base64url')).join('.');
    return data+'.'+createHmac('sha256',secret).update(data).digest('base64url');
  }
  const token = jwt('authenticated',uid);
  const anon = jwt('anon',undefined);
  const psql = sql => execFileSync('psql',['-X','-qAt','-v','ON_ERROR_STOP=1','-h',socket,'-p','55441','-U','postgres','-d','postgres'],{input:sql,encoding:'utf8'});
  const pg = spawn(process.env.POSTGREST_BIN || 'postgrest', [], {env:{...process.env,
    PGRST_DB_URI:`postgresql://authenticator@/postgres?host=${socket}&port=55441`,
    PGRST_DB_SCHEMAS:'public', PGRST_DB_ANON_ROLE:'anon', PGRST_JWT_SECRET:secret,
    PGRST_SERVER_HOST:'127.0.0.1',PGRST_SERVER_PORT:'55442'},stdio:['ignore','ignore','pipe']});
  let pgError=''; pg.stderr.on('data',d=>{pgError+=d.toString();});
  let browser, server;
  try {
    let ready=false;
    for(let i=0;i<100;i++) {
      try { const r=await fetch('http://127.0.0.1:55442/'); if(r.ok) {ready=true;break;} } catch {}
      await new Promise(r=>setTimeout(r,100));
    }
    assert.ok(ready,'Local PostgREST not ready: '+pgError);
    const modules = {
      'next/navigation': `export const useParams=()=>({id:location.pathname.split('/').pop()}); export const useRouter=()=>({push:p=>{location.href=p}});`,
      '@/components/supabase-provider': `export const useAuth=()=>({user:{id:${JSON.stringify(uid)}}});`,
      '@/lib/supabase/client': `import {createClient} from '@supabase/supabase-js'; export const supabase=createClient(location.origin,${JSON.stringify(anon)},{global:{headers:{Authorization:'Bearer '+${JSON.stringify(token)}}},auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});`,
    };
    const bundled = await build({stdin:{contents:`import React from 'react'; import {createRoot} from 'react-dom/client'; import Study from './app/study/[id]/StudyPageClient'; import Solo from './app/solo/[id]/page'; createRoot(document.getElementById('root')).render(React.createElement(location.pathname.startsWith('/solo/')?Solo:Study));`,resolveDir:process.cwd(),loader:'tsx'},bundle:true,write:false,platform:'browser',jsx:'automatic',define:{'process.env.NODE_ENV':'"test"'},plugins:[{name:'fixture-context',setup(b){b.onResolve({filter:/^(next\/navigation|@\/components\/supabase-provider|@\/lib\/supabase\/client)$/},args=>({path:args.path,namespace:'fixture'}));b.onLoad({filter:/.*/,namespace:'fixture'},args=>({contents:modules[args.path],loader:'js',resolveDir:process.cwd()}));}}]});
    server=http.createServer((req,res)=>{
      if(req.url.startsWith('/rest/v1/')) {
        const upstream=http.request({hostname:'127.0.0.1',port:55442,path:req.url.replace('/rest/v1',''),method:req.method,headers:{...req.headers,host:'127.0.0.1:55442'}},r=>{res.writeHead(r.statusCode,r.headers);r.pipe(res);});
        upstream.on('error',()=>{res.writeHead(502);res.end();}); req.pipe(upstream); return;
      }
      res.setHeader('Content-Type',req.url==='/bundle.js'?'application/javascript':'text/html');
      res.end(req.url==='/bundle.js'?bundled.outputFiles[0].contents:'<!doctype html><html><body><div id="root"></div><script src="/bundle.js"></script></body></html>');
    });
    await new Promise(r=>server.listen(55443,'127.0.0.1',r));
    const client=(bearer)=>createClient('http://127.0.0.1:55443',anon,{global:{headers:{Authorization:'Bearer '+bearer}},auth:{persistSession:false,autoRefreshToken:false}});
    const student=client(token);
    const read=()=>student.from('quizzes').select('*, questions(*, answers(*))').eq('id',quiz).is('archived_at',null).single();
    const baseline=await read();
    assert.equal(baseline.status,406); assert.equal(baseline.error.code,'PGRST116');
    browser=await chromium.launch({headless:true,args:['--no-sandbox']});
    const page=await browser.newPage();
    const errors=[]; page.on('pageerror',e=>{errors.push(e.message); console.error('Browser error:',e.message);});
    page.on('console',msg=>{if(msg.type()==='error') console.error('Browser console:',msg.text());});
    await page.goto('http://127.0.0.1:55443/study/'+quiz);
    await expect(page.getByRole('heading',{name:'Quiz not found',exact:true})).toBeVisible();
    console.log('RED: real Supabase query returns 406/PGRST116; actual Study component shows Quiz not found');
    const migration=readFileSync(path.join(process.cwd(),'supabase/migrations/20260915190000_assigned_private_quiz_access.sql'),'utf8');
    psql('BEGIN;'+migration+'COMMIT;');
    const fixed=await read(); assert.equal(fixed.error,null); assert.equal(fixed.data.is_public,false);
    assert.equal(fixed.data.questions[0].answers[0].text,'Paris'); assert.equal(fixed.data.questions[0].answers[0].is_correct,true);
    await page.reload();
    try {
      await expect(page.getByRole('heading',{name:'Assigned private quiz',exact:true})).toBeVisible({timeout:15000});
    } catch (error) {
      console.error('Post-migration fixture DOM:',await page.locator('body').innerText());
      throw error;
    }
    await page.getByRole('button',{name:/Flashcards/}).click();
    await expect(page.getByText('What is the capital of France?',{exact:true})).toBeVisible();
    await page.getByRole('button',{name:'Reveal answers',exact:true}).click();
    await expect(page.getByRole('button',{name:/Paris/})).toBeVisible();
    console.log('GREEN: actual Study title, question and revealed answer render from real RLS-protected embedded response');
    await page.goto('http://127.0.0.1:55443/study/fixture-1');
    await expect(page.getByRole('heading',{name:'Assigned private quiz',exact:true})).toBeVisible();
    await page.goto('http://127.0.0.1:55443/solo/'+quiz);
    await expect(page.getByRole('heading',{name:'Assigned private quiz',exact:true})).toBeVisible();
    console.log('GREEN: actual Study slug lookup and solo loading query');
    for (const bearer of [anon,jwt('authenticated','00000000-0000-0000-0000-000000000003')]) {
      const denied=client(bearer);
      for(const [table,prefix] of [['quizzes','2'],['questions','3'],['answers','4']]) {
        const r=await denied.from(table).select('*').eq('id',prefix+quiz.slice(1));
        assert.equal(r.error,null); assert.deepEqual(r.data,[]);
      }
    }
    psql(`DELETE FROM classroom_members WHERE user_id='${uid}';`);
    assert.equal((await read()).error.code,'PGRST116');
    await page.goto('http://127.0.0.1:55443/study/'+quiz);
    await expect(page.getByRole('heading',{name:'Quiz not found',exact:true})).toBeVisible();
    assert.deepEqual(errors,[]);
    console.log('GREEN: real PostgREST anonymous/outsider direct subresources denied; leaving class revokes query and actual Study UI access');
  } finally {
    if(browser) await browser.close();
    if(server) await new Promise(r=>server.close(r));
    pg.kill('SIGTERM');
    await new Promise(r=>pg.exitCode===null?pg.once('exit',r):r());
  }
})().catch(e=>{console.error(e);process.exitCode=1;});
