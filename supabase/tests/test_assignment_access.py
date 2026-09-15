"""Self-contained disposable LOCAL PostgreSQL RLS reproduction (not a Supabase clone).
Run normally for proposed migration; ASSIGNMENT_BASELINE=1 reproduces missing access.
Uses a private Unix socket in tmpfs; never accepts a remote connection string.
"""
import os
from pathlib import Path
import pwd
import shutil
import subprocess
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[2]
MIGRATION = ROOT / 'supabase/migrations/20260915190000_assigned_private_quiz_access.sql'
PG = '/usr/lib/postgresql/16/bin'
USER = '00000000-0000-0000-0000-00000000000'
QUIZ = '20000000-0000-0000-0000-00000000000'
ROOM = '10000000-0000-0000-0000-000000000001'

class AssignmentAccess(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.directory = Path(tempfile.mkdtemp(prefix='qw-assignment-', dir='/dev/shm'))
        account = pwd.getpwnam('postgres')
        os.chown(cls.directory, account.pw_uid, account.pw_gid)
        cls.admin = ['runuser','-u','postgres','--']
        def run(args):
            subprocess.run(cls.admin + args, check=True, capture_output=True, text=True)
        run([f'{PG}/initdb','-D',str(cls.directory/'data'),'-A','trust','--no-locale'])
        run([f'{PG}/pg_ctl','-D',str(cls.directory/'data'),'-l',str(cls.directory/'log'),'-o',f"-k {cls.directory} -p 55441 -h ''",'-w','start'])
        cls.base = ['psql','-X','-qAt','-v','ON_ERROR_STOP=1','-h',str(cls.directory),'-p','55441','-U','postgres','-d','postgres']
        cls.addClassCleanup(cls.cleanup)
        cls.exec((ROOT/'supabase/tests/assignment-access-fixture.sql').read_text())
        if os.environ.get('ASSIGNMENT_BASELINE') != '1':
            before = cls.exec("SELECT jsonb_agg(to_jsonb(p) ORDER BY tablename,policyname) FROM pg_policies p")
            cls.exec('BEGIN;' + MIGRATION.read_text() + 'ROLLBACK;')
            after = cls.exec("SELECT jsonb_agg(to_jsonb(p) ORDER BY tablename,policyname) FROM pg_policies p")
            assert before == after, 'Forward transaction rollback changed baseline policies'
            cls.exec('BEGIN;' + MIGRATION.read_text() + 'COMMIT;')

    @classmethod
    def cleanup(cls):
        subprocess.run(cls.admin + [f'{PG}/pg_ctl','-D',str(cls.directory/'data'),'-m','immediate','-w','stop'], capture_output=True)
        shutil.rmtree(cls.directory)

    @classmethod
    def exec(cls, query):
        result = subprocess.run(cls.base, input=query, text=True, capture_output=True)
        if result.returncode:
            raise AssertionError(result.stderr)
        return result.stdout.strip()

    def query(self, query, actor=2, role='authenticated', setup=''):
        uid = USER + str(actor) if actor else ''
        return self.exec(f"BEGIN; {setup}; SET LOCAL ROLE {role}; SET LOCAL request.jwt.claim.sub='{uid}'; {query}; ROLLBACK;")

    def counts(self, number=1):
        return ';'.join(f"SELECT count(*) FROM {table} WHERE id='{prefix}0000000-0000-0000-0000-00000000000{number}'" for table,prefix in [('quizzes','2'),('questions','3'),('answers','4')])

    def test_student_can_read_assigned_private_quiz_and_study_answers(self):
        self.assertEqual(self.query(self.counts()), '1\n1\n1')

    def test_outsider_cannot_read_private_subresources(self):
        self.assertEqual(self.query(self.counts(), actor=3), '0\n0\n0')

    def test_child_access_does_not_depend_on_legacy_allow_all(self):
        self.assertEqual(self.query(self.counts(), setup='DROP POLICY "read questions" ON questions; DROP POLICY "read answers" ON answers'), '1\n1\n1')

    def test_unassigned_private_quiz_denied(self):
        self.assertEqual(self.query(self.counts(2)), '0\n0\n0')

    def test_anonymous_private_denied_public_unchanged(self):
        self.assertEqual(self.query(self.counts(), actor=0, role='anon'), '0\n0\n0')
        self.assertEqual(self.query(self.counts(3), actor=0, role='anon'), '1\n1\n1')

    def test_other_classroom_teacher_denied(self):
        self.assertEqual(self.query(self.counts(), actor=4), '0\n0\n0')

    def test_current_coteacher_can_study_without_ownership(self):
        self.assertEqual(self.query(self.counts(), actor=5), '1\n1\n1')

    def test_assignment_revocation_removes_all_access(self):
        self.assertEqual(self.query(self.counts(), setup=f"DELETE FROM classroom_assignments WHERE quiz_id='{QUIZ}1'"), '0\n0\n0')

    def test_leaving_class_removes_all_access(self):
        self.assertEqual(self.query(f"DELETE FROM classroom_members WHERE user_id=auth.uid(); {self.counts()}"), '0\n0\n0')

    def test_archived_private_and_public_denied_for_nonowner(self):
        for number in (4,5):
            self.assertEqual(self.query(self.counts(number)), '0\n0\n0')
            self.assertEqual(self.query(self.counts(number),actor=0,role='anon'), '0\n0\n0')

    def test_archive_restore_toggles_assigned_access(self):
        self.assertEqual(self.query(self.counts(), setup=f"UPDATE quizzes SET archived_at=now() WHERE id='{QUIZ}1'"), '0\n0\n0')
        self.assertEqual(self.query(self.counts(4), setup=f"UPDATE quizzes SET archived_at=null WHERE id='{QUIZ}4'"), '1\n1\n1')

    def test_owner_preserves_active_and_archived_access(self):
        for number in range(1,6):
            self.assertEqual(self.query(self.counts(number),actor=1), '1\n1\n1')

    def test_guessing_private_quiz_id_in_teacher_assignment_cannot_share_it(self):
        query = f"INSERT INTO classroom_assignments(classroom_id,quiz_id,assigned_by) VALUES('10000000-0000-0000-0000-000000000002','{QUIZ}2',auth.uid()); {self.counts(2)}"
        self.assertEqual(self.query(query,actor=4), '0\n0\n0')

    def test_public_discovery_filter_excludes_private_assignment(self):
        self.assertEqual(self.query('SELECT title FROM quizzes WHERE is_public=true AND archived_at IS NULL'), 'Public quiz')

    def test_student_cannot_mutate_assigned_content(self):
        for table, prefix in [('quizzes','2'),('questions','3'),('answers','4')]:
            identifier = f'{prefix}0000000-0000-0000-0000-000000000001'
            field = 'title' if table == 'quizzes' else 'text'
            for mutation in [f"UPDATE {table} SET {field}='changed' WHERE id='{identifier}' RETURNING id", f"DELETE FROM {table} WHERE id='{identifier}' RETURNING id"]:
                self.assertEqual(self.query(f'WITH changed AS ({mutation}) SELECT count(*) FROM changed'), '0')
        for mutation in [f"INSERT INTO quizzes VALUES(gen_random_uuid(),'{USER}1','bad',false,null)",f"INSERT INTO questions VALUES(gen_random_uuid(),'{QUIZ}1','bad')", "INSERT INTO answers VALUES(gen_random_uuid(),'30000000-0000-0000-0000-000000000001','bad',true)"]:
            with self.assertRaisesRegex(AssertionError,'row-level security'):
                self.query(mutation)

    def test_safe_disable_keeps_privacy_and_can_rollback(self):
        disable = (ROOT/'supabase/tests/assignment-access-safe-disable.sql').read_text()
        self.assertEqual(self.query(self.counts(),setup=disable), '0\n0\n0')
        self.assertEqual(self.query(self.counts(),actor=0,role='anon',setup=disable), '0\n0\n0')
        self.assertEqual(self.query(self.counts(3),actor=0,role='anon',setup=disable), '1\n1\n1')
        self.assertEqual(self.query(self.counts(4),actor=1,setup=disable), '1\n1\n1')
        self.assertEqual(self.query(self.counts()), '1\n1\n1')

if __name__ == '__main__':
    unittest.main(verbosity=2)
