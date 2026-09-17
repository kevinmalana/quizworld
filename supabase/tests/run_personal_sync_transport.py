"""Local-only real PostgREST + PostgreSQL + mobile TS transport acceptance.
POSTGREST_BIN must name an installed binary. JWTs/auth tables are disposable fixtures,
not GoTrue signup, a production schema clone, or installed-device acceptance.
"""
import base64, hashlib, hmac, json, os, socket, subprocess, time, urllib.request
from pathlib import Path
from test_personal_sync import PersonalSync, ROOT, A, B

def token(actor,secret):
 def enc(value): return base64.urlsafe_b64encode(json.dumps(value,separators=(',',':')).encode()).rstrip(b'=')
 body=enc({'alg':'HS256','typ':'JWT'})+b'.'+enc({'role':'authenticated','sub':actor,'exp':int(time.time())+600})
 return (body+b'.'+base64.urlsafe_b64encode(hmac.new(secret.encode(),body,hashlib.sha256).digest()).rstrip(b'=')).decode()

def generate_types():
 rows=json.loads(PersonalSync.exec("SELECT jsonb_agg(jsonb_build_object('table',table_name,'name',column_name,'type',data_type,'nullable',is_nullable) ORDER BY table_name,ordinal_position) FROM information_schema.columns WHERE table_schema='public' AND table_name IN ('personal_sync_accounts','personal_sync_limits','personal_practice_events')"))
 text='// Generated from the exact migration applied to disposable PostgreSQL.\n// Regenerate: UPDATE_PERSONAL_TYPES=1 POSTGREST_BIN=... python3 supabase/tests/run_personal_sync_transport.py\nexport type PersonalDatabase = {\n  Tables: {\n'
 mapping={'uuid':'string','bigint':'number','integer':'number','boolean':'boolean','jsonb':'unknown','timestamp with time zone':'string'}
 for table in sorted({r['table'] for r in rows}):
  text+=f'    {table}: {{ Row: {{\n'
  for r in rows:
   if r['table']==table:text+=f"      {r['name']}: {mapping[r['type']]}"+(' | null' if r['nullable']=='YES' else '')+';\n'
  text+='    } };\n'
 args=PersonalSync.exec("SELECT pg_get_function_arguments('public.personal_sync_v1(text,jsonb)'::regprocedure)")
 assert args=="p_action text, p_payload jsonb DEFAULT '{}'::jsonb",args
 text+='  };\n  Functions: { personal_sync_v1: { Args: { p_action: string; p_payload?: unknown }; Returns: unknown } };\n};\n'
 path=ROOT/'apps/mobile/src/personal-db.generated.ts'
 if os.environ.get('UPDATE_PERSONAL_TYPES')=='1':path.write_text(text)
 else: assert path.read_text()==text,'Generated personal types differ'

if __name__=='__main__':
 binary=os.environ.get('POSTGREST_BIN')
 if not binary or not Path(binary).is_file():raise SystemExit('Set POSTGREST_BIN to an installed PostgREST binary; no remote fallback.')
 PersonalSync.setUpClass(); server=None
 try:
  generate_types()
  with socket.socket() as sock:sock.bind(('127.0.0.1',0));port=sock.getsockname()[1]
  secret='local-disposable-personal-sync-fixture-only-32-plus-bytes'
  env=os.environ|{'PGRST_DB_URI':f'postgresql://authenticator@/postgres?host={PersonalSync.directory}&port=55449','PGRST_DB_SCHEMAS':'public','PGRST_DB_ANON_ROLE':'anon','PGRST_JWT_SECRET':secret,'PGRST_SERVER_HOST':'127.0.0.1','PGRST_SERVER_PORT':str(port)}
  log=open(PersonalSync.directory/'postgrest.log','w')
  server=subprocess.Popen([binary],env=env,stdout=log,stderr=log)
  url=f'http://127.0.0.1:{port}'
  for _ in range(100):
   try:
    with urllib.request.urlopen(url+'/quizzes?select=id',timeout=.5) as r:
     if r.status==200:break
   except Exception:time.sleep(.05)
  else:raise AssertionError('PostgREST did not become ready: '+(PersonalSync.directory/'postgrest.log').read_text())
  testenv=os.environ|{'QW_PERSONAL_URL':url,'QW_PERSONAL_A':token(A,secret),'QW_PERSONAL_B':token(B,secret)}
  subprocess.run(['./node_modules/.bin/tsx','scripts/personal-sync-integration.ts'],cwd=ROOT/'apps/mobile',env=testenv,check=True)
  PersonalSync.exec("DROP FUNCTION public.personal_sync_v1(text,jsonb); NOTIFY pgrst,'reload schema'")
  subprocess.run(['./node_modules/.bin/tsx','scripts/personal-sync-integration.ts'],cwd=ROOT/'apps/mobile',env=testenv|{'QW_PERSONAL_UNAVAILABLE':'1'},check=True)
  assert PersonalSync.original==PersonalSync.official(),'Official objects changed'
  print('PASS: real PostgreSQL/PostgREST persisted receipts, mobile transport and two-device/account assertions; official objects unchanged')
 finally:
  if server:server.terminate();server.wait(timeout=10)
  PersonalSync.doClassCleanups()
