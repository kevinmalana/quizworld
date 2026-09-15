"""Adjacent authorization checks against the disposable local fixture, never live."""
import unittest
import test_permissions as base
from test_permissions import GROUP, ROOM, ACTOR, OWNER, ASSIGNMENT

PUBLIC_GROUP = '20000000-0000-0000-0000-000000000002'
QUIZ = '40000000-0000-0000-0000-000000000001'

class Hardening(unittest.TestCase):
    ok = base.Permissions.ok
    denied = base.Permissions.denied
    def test_private_pins_hidden_public_pins_visible(self):
        for role, actor in [('authenticated', ACTOR), ('anon', '')]:
            self.ok(f"SELECT count(*) FROM group_pinned_quizzes WHERE group_id='{GROUP}'; SELECT count(*) FROM group_pinned_quizzes WHERE group_id='{PUBLIC_GROUP}'", '0\n1', role=role, actor=actor)

    def test_nonmember_cannot_pin(self):
        for group in [GROUP, PUBLIC_GROUP]:
            self.denied(f"INSERT INTO group_pinned_quizzes(group_id,quiz_id,pinned_by) VALUES('{group}','{QUIZ}','{ACTOR}')")

    def test_nonmember_manual_completion_denied(self):
        self.denied(f"INSERT INTO assignment_completions(assignment_id,user_id,source) VALUES('{ASSIGNMENT}','{ACTOR}','manual')")

    def test_manual_completion_cannot_retarget_after_leaving(self):
        self.denied(f"SELECT join_classroom_by_code('AB12CD'); INSERT INTO assignment_completions(assignment_id,user_id,source) VALUES('{ASSIGNMENT}','{ACTOR}','manual'); DELETE FROM classroom_members WHERE user_id=auth.uid(); UPDATE assignment_completions SET assignment_id='{ASSIGNMENT}' WHERE user_id=auth.uid()")

    def test_helpers_do_not_enumerate_other_users(self):
        for fn, resource in [('is_group_member', GROUP), ('is_classroom_member', ROOM), ('is_classroom_teacher', ROOM)]:
            self.ok(f"SELECT {fn}('{resource}','{OWNER}')", 'f')
            self.ok(f"SELECT {fn}('{resource}','{OWNER}')", 'f', actor='', role='anon')
            self.ok(f"SELECT {fn}('{resource}','{OWNER}')", 't', actor=OWNER)

    def test_members_can_read_pin_and_unpin_own_only(self):
        prefix = "SELECT join_trivia_group_by_code('CD12AB'); "
        self.ok(prefix + f"SELECT count(*) FROM group_pinned_quizzes WHERE group_id='{GROUP}'; INSERT INTO group_pinned_quizzes(group_id,quiz_id,pinned_by) VALUES('{GROUP}','{QUIZ}','{ACTOR}'); WITH d AS (DELETE FROM group_pinned_quizzes WHERE group_id='{GROUP}' RETURNING id) SELECT count(*) FROM d", f'{GROUP}\n1\n1')
        self.denied(prefix + f"INSERT INTO group_pinned_quizzes(group_id,quiz_id,pinned_by) VALUES('{GROUP}','{QUIZ}','{OWNER}')")
        self.denied(prefix + f"INSERT INTO group_pinned_quizzes(group_id,quiz_id,pinned_by) VALUES('{PUBLIC_GROUP}','{QUIZ}','{ACTOR}')")

    def test_anonymous_pin_and_completion_inserts_denied(self):
        self.denied(f"INSERT INTO group_pinned_quizzes(group_id,quiz_id,pinned_by) VALUES('{GROUP}','{QUIZ}','{OWNER}')", role='anon', actor='')
        self.denied(f"INSERT INTO assignment_completions(assignment_id,user_id,source) VALUES('{ASSIGNMENT}','{OWNER}','manual')", role='anon', actor='')

    def test_student_and_teacher_manual_completion_works(self):
        for actor, prefix in [(OWNER, ''), (ACTOR, "SELECT join_classroom_by_code('AB12CD'); ")]:
            self.ok(prefix + f"INSERT INTO assignment_completions(assignment_id,user_id,source) VALUES('{ASSIGNMENT}','{actor}','manual') RETURNING source; UPDATE assignment_completions SET source='manual' WHERE user_id=auth.uid() RETURNING source; DELETE FROM assignment_completions WHERE user_id=auth.uid() RETURNING source", (f'{ROOM}\n' if prefix else '') + 'manual\nmanual\nmanual', actor=actor)

    def test_completion_identity_and_source_spoof_denied(self):
        prefix = "SELECT join_classroom_by_code('AB12CD'); "
        for user, source in [(OWNER, 'manual'), (ACTOR, 'study')]:
            self.denied(prefix + f"INSERT INTO assignment_completions(assignment_id,user_id,source) VALUES('{ASSIGNMENT}','{user}','{source}')")
        for field, value in [('source', 'study'), ('user_id', OWNER)]:
            self.denied(prefix + f"INSERT INTO assignment_completions(assignment_id,user_id,source) VALUES('{ASSIGNMENT}','{ACTOR}','manual'); UPDATE assignment_completions SET {field}='{value}' WHERE user_id=auth.uid()")

    def test_completion_cross_resource_retarget_denied(self):
        other = '30000000-0000-0000-0000-000000000003'
        prefix = f"INSERT INTO classrooms(id,name,join_code,created_by) VALUES('10000000-0000-0000-0000-000000000003','Other','AA0001','{ACTOR}'); INSERT INTO classroom_members(classroom_id,user_id,role) VALUES('10000000-0000-0000-0000-000000000003','{ACTOR}','teacher'); INSERT INTO classroom_assignments(id,classroom_id,assigned_by) VALUES('{other}','10000000-0000-0000-0000-000000000003','{ACTOR}'); "
        self.denied(prefix + f"INSERT INTO assignment_completions(assignment_id,user_id,source) VALUES('{ASSIGNMENT}','{ACTOR}','manual')")
        self.denied(prefix + f"INSERT INTO assignment_completions(assignment_id,user_id,source) VALUES('{other}','{ACTOR}','manual'); UPDATE assignment_completions SET assignment_id='{ASSIGNMENT}' WHERE user_id=auth.uid()")

    def test_helper_metadata_and_null_identity(self):
        self.ok("SELECT count(*), bool_and(prosecdef AND proconfig=ARRAY['search_path=\"\"']) FROM pg_proc WHERE proname IN ('is_group_member','is_classroom_member','is_classroom_teacher')", '3|t')
        for fn, resource in [('is_group_member', GROUP), ('is_classroom_member', ROOM), ('is_classroom_teacher', ROOM)]:
            self.ok(f"SELECT {fn}('{resource}',NULL)", 'f', actor='')
            self.ok(f"SELECT NOT EXISTS (SELECT 1 FROM pg_proc p, LATERAL aclexplode(p.proacl) a WHERE p.oid='public.{fn}(uuid,uuid)'::regprocedure AND a.grantee=0)", 't')

    def test_direct_promotion_and_admin_removal_stay_denied(self):
        self.ok(f"SELECT join_classroom_by_code('AB12CD'); WITH u AS (UPDATE classroom_members SET role='teacher' WHERE user_id=auth.uid() RETURNING id) SELECT count(*) FROM u", f'{ROOM}\n0')
        self.ok(f"SELECT join_trivia_group_by_code('CD12AB'); WITH d AS (DELETE FROM trivia_group_members WHERE user_id='{OWNER}' RETURNING id) SELECT count(*) FROM d", f'{GROUP}\n0')

if __name__ == '__main__': unittest.main(verbosity=2)
