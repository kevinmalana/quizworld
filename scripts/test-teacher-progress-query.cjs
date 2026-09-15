/* Exact classroom query through real Supabase JS -> local PostgREST -> PG RLS.
 * Local signed fixture identities only; no hosted Auth, browser, or production.
 * Dependency injection only rewrites Supabase's /rest/v1 prefix for PostgREST.
 */
const assert = require('node:assert/strict');
const {spawn,execFileSync} = require('node:child_process');
const {readFileSync} = require('node:fs');
const {createHmac,randomBytes} = require('node:crypto');
const {createClient} = require('@supabase/supabase-js');
(async()=>{
  const socket=process.env.TEACHER_PROGRESS_PG_SOCKET;
  assert.match(socket||'', /^\/dev\/shm\/qw-teacher-progress-[\w-]+$/);
  const secret=randomBytes(48).toString('hex');
  const user=n=>'00000000-0000-0000-0000-00000000000'+n;
  const quiz=n=>'20000000-0000-0000-0000-00000000000'+n;
  function jwt(n) {
    const d=[{alg:'HS256',typ:'JWT'},{role:n?'authenticated':'anon',...(n?{sub:user(n)}:{}),exp:Math.floor(Date.now()/1000)+300}].map(x=>Buffer.from(JSON.stringify(x)).toString('base64url')).join('.');
    return d+'.'+createHmac('sha256',secret).update(d).digest('base64url');
  }
  const psql=sql=>execFileSync('psql',['-X','-qAt','-v','ON_ERROR_STOP=1','-h',socket,'-p','55451','-U','postgres','-d','postgres'],{input:sql,encoding:'utf8'});
  const pg=spawn(process.env.POSTGREST_BIN||'postgrest',[],{env:{...process.env,PGRST_DB_URI:`postgresql://authenticator@/postgres?host=${socket}&port=55451`,PGRST_DB_SCHEMAS:'public',PGRST_DB_ANON_ROLE:'anon',PGRST_JWT_SECRET:secret,PGRST_SERVER_HOST:'127.0.0.1',PGRST_SERVER_PORT:'55452'},stdio:['ignore','ignore','pipe']});
  let errors=''; pg.stderr.on('data',d=>errors+=d); pg.on('error',e=>errors+=e.message);
  try {
    let ready=false;
    for(let i=0;i<100;i++) {try {if((await fetch('http://127.0.0.1:55452/')).ok){ready=true;break;}}catch{} await new Promise(r=>setTimeout(r,100));}
    assert.ok(ready,errors);
    const client=n=>createClient('http://127.0.0.1:55452',jwt(0),{global:{headers:{Authorization:'Bearer '+jwt(n)},fetch:(url,options)=>fetch(String(url).replace('/rest/v1/','/'),options)},auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
    const source=readFileSync('app/classrooms/[id]/page.tsx','utf8');
    const expression=source.match(/supabase\.from\("study_progress"\)[^\n]+/)[0];
    const actualQuery=new Function('supabase','userIds','qIds','return '+expression);
    const read=async(n=1,users=[user(2)],quizzes=[quiz(1)])=>{
      const r=await actualQuery(client(n),users,quizzes); assert.equal(r.error,null); assert.equal(r.status,200); return r.data;
    };
    const baseline=await read(); assert.deepEqual(baseline,[]);
    console.log('RED: exact classroom Supabase query HTTP 200 [] despite saved 100% student row');
    const sql=readFileSync('supabase/migrations/20260915210000_teacher_assigned_study_progress.sql','utf8');
    psql('BEGIN;'+sql+'COMMIT;');
    const green=await read(); assert.equal(green.length,1); assert.equal(green[0].mastery,100); assert.equal(green[0].correct,2); assert.equal(green[0].questions_studied,2); assert.ok(green[0].last_studied);
    assert.deepEqual(Object.keys(green[0]).sort(),['user_id','quiz_id','mastery','correct','questions_studied','last_studied'].sort());
    console.log('GREEN: unchanged classroom query returns exact saved mastery/correct/studied/last_studied');
    assert.equal((await read(5)).length,1);
    for(const n of [0,3,4]) assert.deepEqual(await read(n),[]);
    const ids=[1,2,3,4,5].map(quiz);
    assert.equal((await read(2,[user(2)],ids)).length,5);
    assert.deepEqual((await read(1,[user(2),user(3),user(5)],ids)).map(x=>[x.user_id,x.quiz_id]),[[user(2),quiz(1)]]);
    const direct=await client(1).from('study_progress').select('*'); assert.equal(direct.error,null); assert.equal(direct.data.length,1);
    console.log('PASS: co-teacher, own history, anon/outsider/other-class, broad enumeration and unrelated history boundaries');
    psql(`UPDATE quizzes SET archived_at=now() WHERE id='${quiz(1)}'`); assert.deepEqual(await read(),[]);
    psql(`UPDATE quizzes SET archived_at=null WHERE id='${quiz(1)}'`); assert.equal((await read()).length,1);
    psql(`DELETE FROM classroom_members WHERE user_id='${user(2)}'`); assert.deepEqual(await read(),[]);
    assert.equal((await read(2,[user(2)],ids)).length,5);
    console.log('PASS: archive/restore/left-student revocation on real HTTP queries; own history unaffected');
  } finally {
    if(pg.exitCode===null) {const stopped=new Promise(r=>pg.once('exit',r));pg.kill('SIGTERM');await stopped;}
  }
})().catch(e=>{console.error(e);process.exitCode=1;});
