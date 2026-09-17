"""Exact SQL on private disposable PostgreSQL 16; no remote DB accepted."""
import json, os, pwd, shutil, subprocess, tempfile, unittest
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
PG='/usr/lib/postgresql/16/bin'
MIGRATION=ROOT/'supabase/migrations/20260917210000_personal_sync_v1.sql'
A='00000000-0000-4000-8000-000000000001'
B='00000000-0000-4000-8000-000000000002'
Q='20000000-0000-4000-8000-000000000001'
class PersonalSync(unittest.TestCase):
 @classmethod
 def setUpClass(cls):
  cls.directory=Path(tempfile.mkdtemp(prefix='qw-personal-',dir='/dev/shm'))
  account=pwd.getpwnam('postgres'); os.chown(cls.directory,account.pw_uid,account.pw_gid)
  cls.admin=['runuser','-u','postgres','--']
  def run(args): subprocess.run(cls.admin+args,check=True,capture_output=True,text=True)
  run([f'{PG}/initdb','-D',str(cls.directory/'data'),'-A','trust','--no-locale','--encoding=UTF8'])
  run([f'{PG}/pg_ctl','-D',str(cls.directory/'data'),'-l',str(cls.directory/'log'),'-o',f"-k {cls.directory} -p 55449 -h ''",'-w','start'])
  cls.addClassCleanup(cls.cleanup)
  cls.base=['psql','-X','-qAt','-v','ON_ERROR_STOP=1','-h',str(cls.directory),'-p','55449','-U','postgres','-d','postgres']
  cls.exec((ROOT/'supabase/tests/personal-sync-fixture.sql').read_text())
  cls.original=cls.official()
  if os.environ.get('PERSONAL_BASELINE')!='1':
   cls.exec('BEGIN;'+MIGRATION.read_text()+'ROLLBACK;')
   assert cls.exec("SELECT count(*) FROM pg_class WHERE relname LIKE 'personal_%'")=='0'
   assert cls.original==cls.official(), 'transaction rollback changed official objects'
   cls.exec('BEGIN;'+MIGRATION.read_text()+'COMMIT;')
   assert cls.original==cls.official(), 'migration changed official objects'
 @classmethod
 def official(cls):
  return cls.exec("SELECT jsonb_build_object('sessions',(SELECT jsonb_agg(s) FROM study_sessions s),'progress',(SELECT jsonb_agg(s) FROM study_progress s),'assignments',(SELECT jsonb_agg(s) FROM assignment_completions s),'profiles',(SELECT jsonb_agg(s) FROM profiles s),'functions',(SELECT jsonb_agg(to_jsonb(p) ORDER BY oid) FROM pg_proc p WHERE pronamespace='public'::regnamespace AND proname NOT LIKE 'personal_%'),'policies',(SELECT jsonb_agg(to_jsonb(p)) FROM pg_policies p WHERE tablename NOT LIKE 'personal_%'),'relations',(SELECT jsonb_agg(to_jsonb(c) ORDER BY oid) FROM pg_class c WHERE relnamespace='public'::regnamespace AND relname NOT LIKE 'personal_%'))")
 @classmethod
 def cleanup(cls):
  subprocess.run(cls.admin+[f'{PG}/pg_ctl','-D',str(cls.directory/'data'),'-m','immediate','-w','stop'],capture_output=True)
  shutil.rmtree(cls.directory)
 @classmethod
 def exec(cls,sql):
  r=subprocess.run(cls.base,input=sql,text=True,capture_output=True)
  if r.returncode: raise AssertionError(r.stderr)
  return r.stdout.strip()
 @classmethod
 def rpc(cls,action,payload=None,actor=A,role='authenticated'):
  data=json.dumps(payload or {}).replace("'","''")
  return json.loads(cls.exec(f"BEGIN; SET LOCAL ROLE {role}; SET LOCAL request.jwt.claim.sub='{actor}'; SELECT public.personal_sync_v1('{action}','{data}'::jsonb); COMMIT;"))
 def event(self, **changes):
  result={'version':1,'eventId':'60000000-0000-4000-8000-000000000001','generation':'0','sessionId':'50000000-0000-4000-8000-000000000001','quizId':Q,'revision':self.exec(f"SELECT public.personal_public_revision_v1('{Q}')"),'questionId':'30000000-0000-4000-8000-000000000001','answerId':'40000000-0000-4000-8000-000000000002','correct':False,'kind':'answer','clientAt':1}
  return result|changes
 def setUp(self):
  if os.environ.get('PERSONAL_BASELINE')!='1': self.exec('TRUNCATE personal_practice_events,personal_sync_accounts; UPDATE personal_sync_limits SET event_limit=1000;')
 def test_null_and_unknown_fields_are_not_metadata_events(self):
  for field in ['version','eventId','generation','sessionId','quizId','revision','questionId','correct','kind','clientAt']:
   with self.subTest(field=field):
    with self.assertRaises(AssertionError): self.rpc('submit',self.event(**{field:None}))
  with self.assertRaisesRegex(AssertionError,'personal_invalid'): self.rpc('submit',self.event(questionText='secret'))
 def test_capability_is_actual_authenticated_server_generation(self):
  result=self.rpc('status')
  self.assertEqual(result['contract'],1)
  self.assertEqual(result['owner'],A)
  self.assertEqual(result['generation'],'0')
 def test_canonical_revision_shared_source_fields_and_unicode_vectors(self):
  source="SELECT jsonb_build_object('revision',personal_public_revision_v1(q.id),'row',to_jsonb(q)||jsonb_build_object('questions',(SELECT jsonb_agg(to_jsonb(x)||jsonb_build_object('answers',(SELECT jsonb_agg(to_jsonb(a) ORDER BY a.id DESC) FROM answers a WHERE a.question_id=x.id)) ORDER BY x.order_index DESC,x.id DESC) FROM questions x WHERE x.quiz_id=q.id))) FROM quizzes q"
  vectors=[]
  changes=["", "UPDATE quizzes SET title='Title | 4: 🧠'", "UPDATE quizzes SET category='Cat:é'", "UPDATE questions SET text=E'quote \\\" newline\\n'", "UPDATE questions SET explanation='explanation'", "UPDATE questions SET explanation=''", "UPDATE answers SET text='changed answer' WHERE is_correct=false", "UPDATE answers SET is_correct=NOT is_correct", "INSERT INTO questions SELECT '30000000-0000-4000-8000-000000000002',quiz_id,text||'2',explanation,image_url,video_url,question_type,-1 FROM questions; INSERT INTO answers SELECT CASE WHEN is_correct THEN '40000000-0000-4000-8000-000000000003'::uuid ELSE '40000000-0000-4000-8000-000000000004'::uuid END,'30000000-0000-4000-8000-000000000002',text,is_correct,image_url FROM answers"]
  setup=''
  for change in changes:
   setup+=change+';';vectors.append(json.loads(self.exec('BEGIN;'+setup+source+';ROLLBACK;')))
  r=subprocess.run(['./node_modules/.bin/tsx','scripts/personal-revision-vectors.ts'],cwd=ROOT/'apps/mobile',input=json.dumps(vectors),capture_output=True,text=True)
  self.assertEqual(r.returncode,0,r.stdout+r.stderr);print(r.stdout.strip())
 def test_persistence_owner_rls_and_payload_bound_replay(self):
  e=self.event(); first=self.rpc('submit',e)
  self.assertEqual(first,self.rpc('submit',dict(reversed(list(e.items())))))
  self.assertEqual(self.rpc('pull')['events'],[first['receipt']])
  self.assertEqual(self.rpc('pull',actor=B)['events'],[])
  self.assertEqual(self.exec(f"SET ROLE authenticated; SET request.jwt.claim.sub='{B}'; SELECT count(*) FROM personal_practice_events"),'0')
  with self.assertRaisesRegex(AssertionError,'personal_replay_conflict'): self.rpc('submit',e|{'correct':True})
  for sql in ['DELETE FROM personal_practice_events','UPDATE personal_sync_accounts SET generation=99','INSERT INTO personal_sync_accounts(user_id) VALUES(auth.uid())','SELECT * FROM personal_sync_limits',f"SELECT personal_public_revision_v1('{Q}')"]:
   with self.subTest(sql=sql):
    with self.assertRaisesRegex(AssertionError,'permission denied'):self.exec(f"SET ROLE authenticated; SET request.jwt.claim.sub='{A}'; {sql}")
  with self.assertRaisesRegex(AssertionError,'permission denied'):self.rpc('status',role='anon',actor='')
  with self.assertRaisesRegex(AssertionError,'personal_auth_required'):self.rpc('status',actor='')
 def test_private_archive_revision_media_and_invalid_references(self):
  e=self.event();self.rpc('submit',e)
  for change in ["is_public=false","archived_at=now()"]:
   self.exec(f'UPDATE quizzes SET {change}')
   with self.assertRaisesRegex(AssertionError,'personal_access_denied'):self.rpc('submit',e)
   self.exec('UPDATE quizzes SET is_public=true,archived_at=NULL')
  self.exec("UPDATE questions SET explanation='Changed'")
  with self.assertRaisesRegex(AssertionError,'personal_revision_changed'):self.rpc('submit',e)
  self.exec('UPDATE questions SET explanation=NULL')
  self.exec("UPDATE questions SET image_url='media'")
  with self.assertRaisesRegex(AssertionError,'personal_unsupported'):self.rpc('submit',e)
  self.exec('UPDATE questions SET image_url=NULL')
  with self.assertRaisesRegex(AssertionError,'personal_invalid_reference'):self.rpc('submit',e|{'questionId':'30000000-0000-4000-8000-000000000009'})
 def test_atomic_concurrent_first_receipts_and_conflicts(self):
  from concurrent.futures import ThreadPoolExecutor
  e=self.event()
  with ThreadPoolExecutor(max_workers=8) as pool: receipts=list(pool.map(lambda _:self.rpc('submit',e),range(8)))
  self.assertTrue(all(r==receipts[0] for r in receipts));self.assertEqual(len(self.rpc('pull')['events']),1)
  def conflicting(i):
   try:return self.rpc('submit',e|{'eventId':'60000000-0000-4000-8000-000000000002','clientAt':i})
   except AssertionError as error:return str(error)
  with ThreadPoolExecutor(max_workers=2) as pool: results=list(pool.map(conflicting,[1,2]))
  self.assertEqual(sum(isinstance(r,dict) for r in results),1)
  self.assertTrue(any('personal_replay_conflict' in r for r in results if isinstance(r,str)))
 def test_clear_is_generation_authoritative_retry_safe_and_permanent(self):
  e=self.event();self.rpc('submit',e);self.rpc('submit',e,actor=B)
  self.assertEqual(self.rpc('clear',{'generation':'0'})['generation'],'1')
  self.assertEqual(self.rpc('pull')['events'],[])
  with self.assertRaisesRegex(AssertionError,'personal_generation_changed'):self.rpc('submit',e)
  fresh=e|{'generation':'1'};self.rpc('submit',fresh)
  self.assertEqual(self.rpc('clear',{'generation':'0'})['generation'],'1')
  self.assertEqual(len(self.rpc('pull')['events']),1)
  self.assertEqual(len(self.rpc('pull',actor=B)['events']),1)
  with self.assertRaisesRegex(AssertionError,'personal_generation_changed'):self.rpc('submit',e|{'generation':'999'})
 def test_clear_and_upload_concurrency_never_resurrects_old_generation(self):
  from concurrent.futures import ThreadPoolExecutor
  e=self.event()
  def upload():
   try:self.rpc('submit',e)
   except AssertionError as error:self.assertIn('personal_generation_changed',str(error))
  with ThreadPoolExecutor(max_workers=2) as pool:
   u=pool.submit(upload);c=pool.submit(self.rpc,'clear',{'generation':'0'});u.result();c.result()
  self.assertEqual(self.rpc('pull')['events'],[])
 def test_configurable_cap_replays_allowed_and_clear_reclaims_capacity(self):
  self.exec('UPDATE personal_sync_limits SET event_limit=1')
  e=self.event();self.rpc('submit',e);self.rpc('submit',e)
  with self.assertRaisesRegex(AssertionError,'personal_event_limit'):self.rpc('submit',e|{'eventId':'60000000-0000-4000-8000-000000000002'})
  self.assertEqual(self.rpc('status')['eventLimit'],1)
  with self.assertRaises(AssertionError):self.exec('UPDATE personal_sync_limits SET event_limit=2001')
  self.rpc('clear',{'generation':'0'});self.rpc('submit',e|{'generation':'1'})
 def test_disable_rollback_retains_generation_and_official_objects(self):
  self.rpc('clear',{'generation':'0'})
  before=self.exec('SELECT generation FROM personal_sync_accounts')
  disable=(ROOT/'supabase/rollback/20260917210000_personal_sync_v1_disable.sql').read_text()
  self.exec('BEGIN;'+disable+'ROLLBACK;');self.rpc('status')
  self.exec(disable)
  with self.assertRaisesRegex(AssertionError,'permission denied'):self.rpc('status')
  self.assertEqual(before,self.exec('SELECT generation FROM personal_sync_accounts'))
  self.assertEqual(self.original,self.official())
  self.exec('GRANT EXECUTE ON FUNCTION personal_sync_v1(text,jsonb) TO authenticated')
 def tearDown(self):
  if os.environ.get('PERSONAL_BASELINE')!='1':self.assertEqual(self.original,self.official())
if __name__=='__main__': unittest.main(verbosity=2)
