"""Self-contained disposable LOCAL PostgreSQL RLS reproduction (not a Supabase clone).
Run normally for proposed migration; TEACHER_PROGRESS_BASELINE=1 reproduces missing access.
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
MIGRATION = ROOT / 'supabase/migrations/20260915210000_teacher_assigned_study_progress.sql'
PG = '/usr/lib/postgresql/16/bin'
USER = '00000000-0000-0000-0000-00000000000'
QUIZ = '20000000-0000-0000-0000-00000000000'
ROOM = '10000000-0000-0000-0000-000000000001'

class TeacherProgress(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.directory = Path(tempfile.mkdtemp(prefix='qw-teacher-progress-', dir='/dev/shm'))
        account = pwd.getpwnam('postgres')
        os.chown(cls.directory, account.pw_uid, account.pw_gid)
        cls.admin = ['runuser','-u','postgres','--']
        def run(args):
            subprocess.run(cls.admin + args, check=True, capture_output=True, text=True)
        run([f'{PG}/initdb','-D',str(cls.directory/'data'),'-A','trust','--no-locale'])
        run([f'{PG}/pg_ctl','-D',str(cls.directory/'data'),'-l',str(cls.directory/'log'),'-o',f"-k {cls.directory} -p 55451 -h ''",'-w','start'])
        cls.base = ['psql','-X','-qAt','-v','ON_ERROR_STOP=1','-h',str(cls.directory),'-p','55451','-U','postgres','-d','postgres']
        cls.addClassCleanup(cls.cleanup)
        cls.exec((ROOT/'supabase/tests/teacher-progress-fixture.sql').read_text())
        if os.environ.get('TEACHER_PROGRESS_BASELINE') != '1':
            before = cls.exec("SELECT jsonb_agg(to_jsonb(p) ORDER BY tablename,policyname) FROM pg_policies p")
            invariants_sql = "SELECT jsonb_build_object('grants',(SELECT jsonb_agg(to_jsonb(g) ORDER BY grantee,table_name,privilege_type) FROM information_schema.role_table_grants g WHERE table_schema='public'),'functions',(SELECT jsonb_agg(pg_get_functiondef(p.oid) ORDER BY p.oid) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname IN ('public','auth')))"
            invariants = cls.exec(invariants_sql)
            cls.exec('BEGIN;' + MIGRATION.read_text() + 'ROLLBACK;')
            after = cls.exec("SELECT jsonb_agg(to_jsonb(p) ORDER BY tablename,policyname) FROM pg_policies p")
            assert before == after, 'Forward transaction rollback changed baseline policies'
            cls.exec('BEGIN;' + MIGRATION.read_text() + 'COMMIT;')
            assert cls.exec(invariants_sql) == invariants, 'Migration changed grants or functions'

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

    def test_teacher_reads_saved_student_mastery(self):
        self.assertEqual(self.query("SELECT mastery FROM study_progress WHERE user_id='" + USER + "2' AND quiz_id='" + QUIZ + "1'",actor=1), '100')

    def rows(self, actor=1, setup='', role='authenticated'):
        return self.query(f"SELECT quiz_id FROM study_progress WHERE user_id='{USER}2' ORDER BY quiz_id", actor=actor, setup=setup, role=role)

    def test_no_unassigned_or_archived_history(self):
        self.assertEqual(self.rows(), QUIZ+'1')

    def test_coteacher_authorized_without_quiz_ownership(self):
        self.assertEqual(self.rows(actor=5), QUIZ+'1')

    def test_outsider_other_teacher_and_anonymous_denied(self):
        for actor,role in [(3,'authenticated'),(4,'authenticated'),(0,'anon')]:
            self.assertEqual(self.rows(actor=actor,role=role), '')

    def test_peer_student_denied(self):
        setup=f"INSERT INTO classroom_members(classroom_id,user_id,role) VALUES('{ROOM}','{USER}3','student')"
        self.assertEqual(self.rows(actor=3,setup=setup), '')

    def test_teacher_cannot_see_coteacher_or_nonmember_progress(self):
        for actor in [3,5]:
            self.assertEqual(self.query(f"SELECT count(*) FROM study_progress WHERE user_id='{USER}{actor}'",actor=1), '0')

    def test_own_history_preserved(self):
        self.assertEqual(self.rows(actor=2), '\n'.join(QUIZ+str(i) for i in range(1,6)))

    def test_student_leave_or_kick_revokes(self):
        self.assertEqual(self.rows(setup=f"DELETE FROM classroom_members WHERE user_id='{USER}2'"), '')

    def test_teacher_leave_or_demotion_revokes(self):
        for change in [f"DELETE FROM classroom_members WHERE user_id='{USER}1'", f"UPDATE classroom_members SET role='student' WHERE user_id='{USER}1'"]:
            self.assertEqual(self.rows(setup=change), '')

    def test_student_promoted_to_teacher_is_not_student_history(self):
        self.assertEqual(self.rows(setup=f"UPDATE classroom_members SET role='teacher' WHERE user_id='{USER}2'"), '')

    def test_assignment_delete_revokes(self):
        self.assertEqual(self.rows(setup=f"DELETE FROM classroom_assignments WHERE quiz_id='{QUIZ}1'"), '')

    def test_archive_revokes_even_for_owner_teacher(self):
        self.assertEqual(self.rows(setup=f"UPDATE quizzes SET archived_at=now() WHERE id='{QUIZ}1'"), '')

    def test_restore_reenables_current_assignment(self):
        self.assertEqual(self.rows(setup=f"UPDATE quizzes SET archived_at=null WHERE id='{QUIZ}4'"), QUIZ+'1\n'+QUIZ+'4')

    def test_assignment_creator_consent_withdrawn_revokes(self):
        self.assertEqual(self.rows(setup=f"UPDATE classroom_assignments SET assigned_by='{USER}5' WHERE quiz_id='{QUIZ}1'"), '')

    def test_assigned_public_quiz_authorized_then_private_revokes(self):
        setup=f"INSERT INTO classroom_assignments(classroom_id,quiz_id,assigned_by) VALUES('{ROOM}','{QUIZ}3','{USER}5')"
        self.assertEqual(self.rows(actor=5,setup=setup), QUIZ+'1\n'+QUIZ+'3')
        self.assertEqual(self.rows(actor=5,setup=setup+f"; UPDATE quizzes SET is_public=false WHERE id='{QUIZ}3'"), QUIZ+'1')

    def test_cross_class_assignment_cannot_launder_private_access(self):
        # Student and co-teacher belong to both rooms, but creator shared quiz only
        # in room 1. A guessed assignment in room 2 must not share room-2 history.
        other='10000000-0000-0000-0000-000000000002'
        setup=f"INSERT INTO classroom_members(classroom_id,user_id,role) VALUES('{other}','{USER}2','student'),('{other}','{USER}5','teacher'); INSERT INTO classroom_assignments(classroom_id,quiz_id,assigned_by) VALUES('{other}','{QUIZ}1','{USER}5'); DELETE FROM classroom_members WHERE classroom_id='{ROOM}' AND user_id='{USER}2'"
        self.assertEqual(self.rows(actor=5,setup=setup), '')

    def test_no_cross_product_between_classrooms(self):
        other='10000000-0000-0000-0000-000000000002'
        setup=f"UPDATE classroom_assignments SET classroom_id='{other}' WHERE quiz_id='{QUIZ}1'"
        self.assertEqual(self.rows(setup=setup), '')

    def test_no_client_write_grants(self):
        for actor in [1,2,5]:
            for verb in ['INSERT','UPDATE','DELETE']:
                sql={
                    'INSERT':f"INSERT INTO study_progress(user_id,quiz_id) VALUES('{USER}1','{QUIZ}1')",
                    'UPDATE':'UPDATE study_progress SET mastery=0',
                    'DELETE':'DELETE FROM study_progress',
                }[verb]
                with self.assertRaisesRegex(AssertionError,'permission denied for table study_progress'):
                    self.query(sql,actor=actor)

    def test_disable_restores_owner_only(self):
        self.assertEqual(self.rows(setup='DROP POLICY "Teachers read current assigned student progress" ON study_progress'), '')

    def test_only_additive_select_policy_no_other_catalog_changes(self):
        self.assertEqual(self.exec("SELECT cmd||':'||array_to_string(roles,',') FROM pg_policies WHERE policyname='Teachers read current assigned student progress'"),'SELECT:authenticated')
        self.assertEqual(self.exec("SELECT count(*) FROM pg_policies WHERE tablename='study_progress'"),'6')
        self.assertEqual(self.exec("SELECT relrowsecurity FROM pg_class WHERE oid='public.study_progress'::regclass"),'t')

if __name__ == '__main__':
    unittest.main(verbosity=2)
