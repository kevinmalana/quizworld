"""Local-only real PostgreSQL RPC regression; no remote URL accepted.
COMPLETION_BASELINE=1 runs unchanged recovery RPC and must fail authorization.
Reuses the isolated assignment harness, not the host's running database.
"""
import json
import os
import unittest
from pathlib import Path
from test_assignment_access import AssignmentAccess, ROOT, USER, QUIZ, ROOM

MIGRATION = ROOT / 'supabase/migrations/20260915200000_study_completion_access_guard.sql'
RPC = 'public.complete_study_session_atomic'
SIGNATURE = '(uuid,uuid,text,jsonb,integer)'

class CompletionGuard(unittest.TestCase):
    exec = classmethod(AssignmentAccess.exec.__func__)
    cleanup = classmethod(AssignmentAccess.cleanup.__func__)
    query = AssignmentAccess.query

    @classmethod
    def setUpClass(cls):
        AssignmentAccess.setUpClass.__func__(cls)
        cls.exec('''
CREATE ROLE service_role NOLOGIN;
CREATE TABLE profiles(id uuid PRIMARY KEY,total_xp integer DEFAULT 0,study_streak integer DEFAULT 0,longest_streak integer DEFAULT 0,last_study_date date);
INSERT INTO profiles(id) SELECT ('00000000-0000-0000-0000-00000000000'||n)::uuid FROM generate_series(1,5) n;
CREATE TABLE study_sessions(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid REFERENCES profiles,quiz_id uuid REFERENCES quizzes,attempt_id uuid,xp_earned integer,correct integer,total integer,study_mode text,duration_secs integer,UNIQUE(user_id,attempt_id));
CREATE TABLE study_progress(user_id uuid REFERENCES profiles,quiz_id uuid REFERENCES quizzes,questions_studied integer,correct integer,mastery numeric,last_studied timestamptz,PRIMARY KEY(user_id,quiz_id));
CREATE TABLE assignment_completions(assignment_id uuid REFERENCES classroom_assignments ON DELETE CASCADE,user_id uuid REFERENCES profiles,source text,PRIMARY KEY(assignment_id,user_id));
''')
        source = (ROOT/'supabase/migrations/20260820140000_quizworld_recovery_compatibility.sql').read_text()
        cls.exec(source[source.index('CREATE OR REPLACE FUNCTION public.complete_study_session_atomic('):source.index('CREATE OR REPLACE FUNCTION public.increment_xp(')])
        cls.original_body = cls.exec(f"SELECT prosrc FROM pg_proc WHERE oid='{RPC}{SIGNATURE}'::regprocedure")
        if os.environ.get('COMPLETION_BASELINE') != '1':
            before = cls.exec("SELECT jsonb_agg(to_jsonb(p) ORDER BY oid) FROM pg_proc p WHERE pronamespace='public'::regnamespace")
            cls.exec('BEGIN;' + MIGRATION.read_text() + 'ROLLBACK;')
            assert before == cls.exec("SELECT jsonb_agg(to_jsonb(p) ORDER BY oid) FROM pg_proc p WHERE pronamespace='public'::regnamespace"), 'Migration rollback changed functions'
            cls.exec('BEGIN;' + MIGRATION.read_text() + 'COMMIT;')

    def call(self, quiz=1, attempt=1, mode='flashcard', question=None, answer=None, function=RPC):
        question = quiz if question is None else question
        answer = quiz if answer is None else answer
        payload = json.dumps([{'question_id':f'30000000-0000-0000-0000-00000000000{question}', 'answer_id':f'40000000-0000-0000-0000-00000000000{answer}'}])
        return f"{function}('{QUIZ}{quiz}','50000000-0000-0000-0000-{attempt:012d}','{mode}','{payload}'::jsonb,NULL)"

    def deny(self, actor=3, quiz=1, setup='', role='authenticated', call=None, error='Quiz is not accessible.'):
        # Catch inside a subtransaction so ledger assertions run after rejection.
        sql = f"""BEGIN; {setup}; SET LOCAL ROLE {role}; SET LOCAL request.jwt.claim.sub='{USER+str(actor) if actor else ''}';
DO $test$ BEGIN
  BEGIN
    PERFORM {call or self.call(quiz)};
    RAISE EXCEPTION 'UNEXPECTED COMPLETION SUCCESS';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%{error}%' THEN RAISE; END IF;
  END;
END $test$;
RESET ROLE;
SELECT (SELECT count(*) FROM study_sessions), (SELECT count(*) FROM study_progress), (SELECT count(*) FROM assignment_completions), (SELECT sum(total_xp) FROM profiles);
ROLLBACK;"""
        self.assertEqual(self.exec(sql), '0|0|0|0')

    def test_nonmember_guessed_private_completion_denied_without_writes(self):
        self.deny()

    def test_assigned_student_scoring_and_ledgers(self):
        result = self.query(f'SELECT {self.call()}; RESET ROLE; SELECT correct,total,xp_earned FROM study_sessions; SELECT questions_studied,correct,mastery FROM study_progress; SELECT total_xp,study_streak FROM profiles WHERE id=\'{USER}2\'; SELECT source FROM assignment_completions').splitlines()
        self.assertEqual(json.loads(result[0])['xp_earned'],175)
        self.assertEqual(json.loads(result[0])['assignment_completions'],1)
        self.assertEqual(result[1:],['1|1|175','1|1|100','175|1','study_session'])

    def test_unassigned_private_and_other_class_teacher_denied(self):
        self.deny(actor=2, quiz=2)
        self.deny(actor=4)

    def test_revoked_assignment_and_left_class_denied(self):
        self.deny(actor=2, setup=f"DELETE FROM classroom_assignments WHERE quiz_id='{QUIZ}1'")
        self.deny(actor=2, setup=f"DELETE FROM classroom_members WHERE user_id='{USER}2'")

    def test_guessed_assignment_by_noncreator_denied(self):
        self.deny(actor=4, quiz=2, setup=f"INSERT INTO classroom_assignments(classroom_id,quiz_id,assigned_by) VALUES('10000000-0000-0000-0000-000000000002','{QUIZ}2','{USER}4')")

    def test_archived_private_and_public_denied(self):
        self.deny(actor=2, quiz=4)
        self.deny(actor=3, quiz=5)
        self.deny(actor=2, setup=f"UPDATE quizzes SET archived_at=now() WHERE id='{QUIZ}1'")

    def test_public_owner_and_coteacher_positive(self):
        for actor, quiz in [(3,3),(1,1),(1,2),(1,4),(1,5),(5,1)]:
            with self.subTest(actor=actor, quiz=quiz):
                result = json.loads(self.query(f'SELECT {self.call(quiz,mode="quickfire")}', actor=actor))
                self.assertEqual(result['xp_earned'],195)
                self.assertEqual(result['assignment_completions'],0)

    def test_restore_allows_assigned_student(self):
        result = json.loads(self.query(f'SELECT {self.call(4)}', setup=f"UPDATE quizzes SET archived_at=NULL WHERE id='{QUIZ}4'"))
        self.assertEqual(result['assignment_completions'],1)

    def test_idempotent_replay_does_not_double_award(self):
        lines = self.query(f'SELECT {self.call()}; SELECT {self.call()}; RESET ROLE; SELECT count(*) FROM study_sessions; SELECT total_xp FROM profiles WHERE id=\'{USER}2\'; SELECT questions_studied FROM study_progress; SELECT count(*) FROM assignment_completions').splitlines()
        first, replay = map(json.loads, lines[:2])
        self.assertEqual(first['session_id'],replay['session_id'])
        self.assertTrue(replay['idempotent_replay'])
        self.assertEqual(replay['assignment_completions'],0)
        self.assertEqual(lines[2:],['1','175','1','1'])

    def test_revocation_denies_replay_without_extra_writes(self):
        for mutation in [f"DELETE FROM classroom_assignments WHERE quiz_id='{QUIZ}1'",f"DELETE FROM classroom_members WHERE user_id='{USER}2'"]:
            sql = f"""BEGIN; SET LOCAL ROLE authenticated; SET LOCAL request.jwt.claim.sub='{USER}2';
SELECT {self.call()}; RESET ROLE; {mutation}; SET LOCAL ROLE authenticated;
DO $test$ BEGIN
  BEGIN
    PERFORM {self.call()};
    RAISE EXCEPTION 'UNEXPECTED COMPLETION SUCCESS';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END $test$;
RESET ROLE; SELECT count(*) FROM study_sessions; SELECT total_xp FROM profiles WHERE id='{USER}2'; SELECT questions_studied FROM study_progress; ROLLBACK;"""
            self.assertEqual(self.exec(sql).splitlines()[1:],['1','175','1'])

    def test_invalid_question_and_answer_still_rejected(self):
        for call in [self.call(question=2),self.call(answer=2)]:
            self.deny(actor=2, call=call, error='Submitted answer does not belong to the quiz question.')

    def test_anonymous_and_missing_identity_denied(self):
        self.deny(actor=0, role='anon', error='permission denied for function')
        self.deny(actor=0, error='Authentication required.')
        self.deny(actor=0, role='service_role', error='Authentication required.')

    def test_missing_quiz_denied(self):
        self.deny(quiz=9)

    def test_internal_function_not_client_callable(self):
        for role in ['anon','authenticated','service_role']:
            self.deny(actor=2, role=role, call=self.call(function=RPC+'_internal'), error='permission denied for function')
        self.assertEqual(self.exec(f"SELECT prosrc FROM pg_proc WHERE oid='{RPC}_internal{SIGNATURE}'::regprocedure"),self.original_body)
        # Compare complete explicit ACL, owner, security mode, search path and default.
        self.assertEqual(self.exec(f"SELECT proacl::text, pg_get_userbyid(proowner), prosecdef, proconfig::text, pronargdefaults FROM pg_proc WHERE oid='{RPC}{SIGNATURE}'::regprocedure"),'{postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}|postgres|t|{search_path=public}|1')
        self.assertEqual(self.exec(f"SELECT proacl::text FROM pg_proc WHERE oid='{RPC}_internal{SIGNATURE}'::regprocedure"),'{postgres=X/postgres}')

if __name__ == '__main__':
    unittest.main(verbosity=2)
