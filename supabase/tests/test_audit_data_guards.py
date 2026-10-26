"""Disposable PostgreSQL regression. No remote connections or paid AI calls.
AUDIT_GUARDS_BASELINE=1 proves the profile exploit against the reported live grants.
"""
import concurrent.futures
import json
import os
from pathlib import Path
import pwd
import shutil
import subprocess
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[2]
PG = '/usr/lib/postgresql/16/bin'
UID = '00000000-0000-0000-0000-000000000001'
MIGRATION = ROOT / 'supabase/migrations/20261025120000_profile_guards_durable_ai_quota.sql'

class AuditDataGuards(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        # Private tmpfs cluster, same isolated harness as existing database tests.
        cls.directory = Path(tempfile.mkdtemp(prefix='qw-audit-', dir='/dev/shm'))
        account = pwd.getpwnam('postgres')
        os.chown(cls.directory, account.pw_uid, account.pw_gid)
        cls.admin = ['runuser', '-u', 'postgres', '--']
        for args in [[f'{PG}/initdb', '-D', str(cls.directory/'data'), '-A', 'trust', '--no-locale'],
                     [f'{PG}/pg_ctl', '-D', str(cls.directory/'data'), '-l', str(cls.directory/'log'), '-o', f"-k {cls.directory} -p 55442 -h ''", '-w', 'start']]:
            subprocess.run(cls.admin + args, check=True, capture_output=True, text=True)
        cls.addClassCleanup(cls.cleanup)
        cls.base = ['psql','-X','-qAt','-v','ON_ERROR_STOP=1','-h',str(cls.directory),'-p','55442','-U','postgres','-d','postgres']
        cls.sql('''
CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN; CREATE ROLE service_role NOLOGIN BYPASSRLS;
CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
GRANT USAGE ON SCHEMA auth TO anon,authenticated,service_role;
CREATE TABLE auth.users(id uuid PRIMARY KEY,email text,raw_user_meta_data jsonb);
CREATE TABLE public.profiles(id uuid PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,username text,avatar text,created_at timestamptz DEFAULT now(),is_admin boolean DEFAULT false,display_name text,updated_at timestamptz,username_changed_at timestamptz,total_xp integer DEFAULT 0,study_streak integer DEFAULT 0,longest_streak integer DEFAULT 0,last_study_date date);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY read_profiles ON profiles FOR SELECT USING(true);
CREATE POLICY owner_update ON profiles FOR UPDATE USING(id=auth.uid());
CREATE POLICY owner_delete ON profiles FOR DELETE USING(id=auth.uid());
GRANT SELECT,INSERT,UPDATE,DELETE ON profiles TO anon,authenticated,service_role;
-- Include explicit legacy column grants: table REVOKE alone does not clear them.
GRANT INSERT(is_admin),UPDATE(is_admin,total_xp) ON profiles TO authenticated;
CREATE FUNCTION public.handle_new_user() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$ BEGIN INSERT INTO public.profiles(id,username) VALUES(NEW.id,NEW.raw_user_meta_data->>'username'); RETURN NEW; END $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
CREATE FUNCTION public.set_default_display_name() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
  IF NEW.display_name IS NULL THEN NEW.display_name := split_part((SELECT email FROM auth.users WHERE id=NEW.id),'@',1); END IF;
  IF NEW.avatar IS NULL THEN NEW.avatar := 'fixture-avatar'; END IF;
  RETURN NEW; END $$;
CREATE TRIGGER on_profile_created BEFORE INSERT ON profiles FOR EACH ROW EXECUTE FUNCTION public.set_default_display_name();
CREATE FUNCTION public.increment_xp(user_uuid uuid,xp_amount integer) RETURNS void LANGUAGE sql SECURITY DEFINER AS $$ UPDATE public.profiles SET total_xp=total_xp+xp_amount WHERE id=user_uuid $$;
CREATE FUNCTION public.update_study_streak(user_uuid uuid) RETURNS void LANGUAGE sql SECURITY DEFINER AS $$ UPDATE public.profiles SET study_streak=study_streak+1 WHERE id=user_uuid $$;
''')
        if os.environ.get('AUDIT_GUARDS_BASELINE') != '1':
            before = cls.sql("SELECT relacl FROM pg_class WHERE oid='public.profiles'::regclass")
            cls.sql('BEGIN;' + MIGRATION.read_text() + 'ROLLBACK;')
            assert before == cls.sql("SELECT relacl FROM pg_class WHERE oid='public.profiles'::regclass")
            assert cls.sql("SELECT to_regclass('public.ai_request_quotas') IS NULL") == 't'
            cls.sql('BEGIN;' + MIGRATION.read_text() + 'COMMIT;')

    @classmethod
    def cleanup(cls):
        subprocess.run(cls.admin + [f'{PG}/pg_ctl','-D',str(cls.directory/'data'),'-m','immediate','-w','stop'], capture_output=True)
        shutil.rmtree(cls.directory)

    @classmethod
    def sql(cls, query):
        result = subprocess.run(cls.base, input=query, text=True, capture_output=True)
        if result.returncode: raise AssertionError(result.stderr)
        return result.stdout.strip()

    def setUp(self):
        self.sql(f"TRUNCATE auth.users CASCADE; INSERT INTO auth.users VALUES('{UID}','fixture@example.test','{{\"username\":\"fixture\"}}');")

    def as_role(self, query, role='authenticated'):
        return self.sql(f"BEGIN; SET LOCAL ROLE {role}; SET LOCAL request.jwt.claim.sub='{UID}'; {query}; ROLLBACK;")

    def test_sensitive_owner_updates_and_inserts_denied(self):
        for column, value in [('is_admin','true'),('total_xp','999'),('study_streak','9'),('longest_streak','9'),('last_study_date','CURRENT_DATE'),('id',f"'{UID}'"),('created_at','now()')]:
            with self.subTest(column=column):
                with self.assertRaisesRegex(AssertionError,'permission denied'):
                    self.as_role(f'UPDATE profiles SET {column}={value}')
        for role in ['anon','authenticated']:
            with self.assertRaisesRegex(AssertionError,'permission denied'):
                self.as_role(f"INSERT INTO profiles(id,is_admin) VALUES('{UID}',true)",role)

    def test_real_profile_edit_shape_and_signup_survive(self):
        self.assertEqual(self.as_role("UPDATE profiles SET username='edited',display_name='Edited',avatar='lion',updated_at=now(),username_changed_at=now() RETURNING username"),'edited')
        self.assertEqual(self.sql('SELECT username,is_admin,total_xp,display_name,avatar FROM profiles'),'fixture|f|0|fixture|fixture-avatar')
        self.assertEqual(self.as_role("UPDATE profiles SET username='other' WHERE id <> auth.uid() RETURNING username"),'')
        with self.assertRaisesRegex(AssertionError,'permission denied'):
            self.as_role("UPDATE profiles SET username='anon'",'anon')

    def test_legacy_xp_and_streak_helpers_not_directly_callable(self):
        for role in ['anon','authenticated']:
            for call in [f"increment_xp('{UID}',999)",f"update_study_streak('{UID}')"]:
                with self.assertRaisesRegex(AssertionError,'permission denied for function'):
                    self.as_role('SELECT '+call,role)

    def consume(self, path='/api/ai-game-insights'):
        return json.loads(self.sql(f"SET ROLE service_role; SELECT public.consume_ai_request_quota('{UID}','{path}')"))

    def test_atomic_concurrent_route_limit_persists_across_connections(self):
        with concurrent.futures.ThreadPoolExecutor(max_workers=16) as pool:
            results = list(pool.map(lambda _: self.consume(), range(30)))
        self.assertEqual(sum(row['allowed'] for row in results),10)
        self.assertEqual(self.sql('SELECT daily_count FROM ai_request_quotas'),'10')
        self.assertFalse(self.consume()['allowed'])

    def test_daily_allowance_shared_between_routes_and_expiry(self):
        paths=['/api/ai-enrich','/api/ai-source-draft','/api/ai-presentation-draft','/api/ai-game-insights']
        for i in range(50):
            self.sql("UPDATE ai_request_quotas SET route_windows='{}'")
            self.assertTrue(self.consume(paths[i%4])['allowed'])
        denied=self.consume('/api/ai-source-draft')
        self.assertFalse(denied['allowed']); self.assertEqual(denied['reason'],'daily')
        self.assertGreater(denied['retry_after'],0)
        self.sql("UPDATE ai_request_quotas SET daily_reset_at=now()-interval '1 second'")
        self.assertTrue(self.consume()['allowed'])
        self.assertEqual(self.sql('SELECT daily_count FROM ai_request_quotas'),'1')

    def test_imports_have_durable_route_limit_without_spending_daily_ai_allowance(self):
        for _ in range(10): self.assertTrue(self.consume('/api/import-url')['allowed'])
        self.assertFalse(self.consume('/api/import-url')['allowed'])
        self.assertEqual(self.sql('SELECT daily_count FROM ai_request_quotas'),'0')
        self.sql("UPDATE ai_request_quotas SET route_windows='{}'")
        self.assertTrue(self.consume('/api/import-url')['allowed'])

    def test_all_existing_route_limits_are_preserved(self):
        limits = {'/api/ai-source-draft':15, '/api/ai-presentation-draft':10, '/api/ai-enrich':20,
                  '/api/ai-game-insights':10, '/api/import-url':10,
                  '/api/present/import-pdf':10, '/api/present/import-deck':10}
        for path, limit in limits.items():
            with self.subTest(path=path):
                self.sql('TRUNCATE ai_request_quotas')
                for _ in range(limit): self.assertTrue(self.consume(path)['allowed'])
                denied = self.consume(path)
                self.assertFalse(denied['allowed'])
                self.assertEqual((denied['reason'],denied['limit']),('route',limit))
        # Expired route window resets without any wall-clock sleep.
        self.sql("UPDATE ai_request_quotas SET route_windows=jsonb_build_object('/api/present/import-deck',jsonb_build_object('count',10,'reset_at',now()-interval '1 second'))")
        self.assertTrue(self.consume('/api/present/import-deck')['allowed'])
        self.assertEqual(self.sql("SELECT route_windows->'/api/present/import-deck'->>'count' FROM ai_request_quotas"),'1')

    def test_ai_daily_window_starts_on_first_ai_not_an_earlier_import(self):
        self.consume('/api/import-url')
        self.sql("UPDATE ai_request_quotas SET daily_reset_at=now()+interval '1 hour'")
        self.assertTrue(self.consume()['allowed'])
        self.assertEqual(self.sql("SELECT daily_reset_at > now()+interval '23 hours' FROM ai_request_quotas"),'t')

    def test_daily_cap_is_atomic_across_different_routes(self):
        self.consume('/api/ai-enrich')
        self.sql("UPDATE ai_request_quotas SET daily_count=49,route_windows='{}'")
        paths = ['/api/ai-enrich','/api/ai-source-draft','/api/ai-presentation-draft','/api/ai-game-insights'] * 5
        with concurrent.futures.ThreadPoolExecutor(max_workers=16) as pool:
            results = list(pool.map(self.consume, paths))
        self.assertEqual(sum(row['allowed'] for row in results),1)
        self.assertEqual(self.sql('SELECT daily_count FROM ai_request_quotas'),'50')

    def test_quota_safe_disable_is_reversible_without_resetting_counters(self):
        self.consume()
        self.assertEqual(self.sql("BEGIN; REVOKE EXECUTE ON FUNCTION public.consume_ai_request_quota(uuid,text) FROM service_role; SELECT has_function_privilege('service_role','public.consume_ai_request_quota(uuid,text)','EXECUTE'); ROLLBACK;"),'f')
        self.assertEqual(self.sql("SELECT has_function_privilege('service_role','public.consume_ai_request_quota(uuid,text)','EXECUTE'); SELECT daily_count FROM ai_request_quotas"),'t\n1')

    def test_quota_account_deletion_cascades(self):
        self.consume()
        self.sql('DELETE FROM auth.users')
        self.assertEqual(self.sql('SELECT count(*) FROM ai_request_quotas'),'0')

    def test_quota_service_only_no_forgery_or_counter_reset(self):
        for role in ['anon','authenticated']:
            with self.assertRaisesRegex(AssertionError,'permission denied for function'):
                self.as_role(f"SELECT consume_ai_request_quota('{UID}','/api/ai-enrich')",role)
        for role in ['anon','authenticated','service_role']:
            for query in ['SELECT * FROM ai_request_quotas',"UPDATE ai_request_quotas SET daily_count=0",'DELETE FROM ai_request_quotas']:
                with self.assertRaisesRegex(AssertionError,'permission denied'):
                    self.as_role(query,role)
        with self.assertRaisesRegex(AssertionError,'Unsupported quota route'):
            self.consume('/api/unlimited')
        self.assertEqual(self.sql("SELECT relrowsecurity FROM pg_class WHERE oid='public.ai_request_quotas'::regclass"),'t')

if __name__ == '__main__': unittest.main(verbosity=2)
