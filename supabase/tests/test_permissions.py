"""Disposable local PostgreSQL regression harness; refuses network DB targets.
Bootstrap a new local DB with permission-fixture.sql, then apply proposed migration.
Run: python3 supabase/tests/test_permissions.py
All regular tests rollback. Concurrency test removes its local fixture memberships.
"""
import concurrent.futures
import subprocess
import unittest

SOCKET = '/dev/shm/qw-permissions-pg'
BASE = ['psql', '-X', '-qAt', '-v', 'ON_ERROR_STOP=1', '-h', SOCKET, '-p', '55439', '-U', 'postgres', '-d', 'postgres']
OWNER = '00000000-0000-0000-0000-000000000001'
ACTOR = '00000000-0000-0000-0000-000000000002'
ROOM = '10000000-0000-0000-0000-000000000001'
GROUP = '20000000-0000-0000-0000-000000000001'
ASSIGNMENT = '30000000-0000-0000-0000-000000000001'

def sql(query, actor=ACTOR, role='authenticated', rollback=True):
    prefix = f"BEGIN; SET LOCAL ROLE {role}; SET LOCAL request.jwt.claim.sub='{actor}';"
    return subprocess.run(BASE + ['-c', prefix + query + (';ROLLBACK;' if rollback else ';COMMIT;')], text=True, capture_output=True)

class Permissions(unittest.TestCase):
    def ok(self, query, expected, **kwargs):
        result = sql(query, **kwargs)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(result.stdout.strip(), expected)

    def denied(self, query, **kwargs):
        result = sql(query, **kwargs)
        self.assertNotEqual(result.returncode, 0, result.stdout)
        self.assertRegex(result.stderr, 'row-level security|permission denied|Authentication required|Invalid .*code')

    def test_private_select_remains_hidden(self):
        self.ok(f"SELECT count(*) FROM classrooms WHERE id='{ROOM}'; SELECT count(*) FROM trivia_groups WHERE id='{GROUP}'", '0\n0')

    def test_teacher_delete(self):
        self.ok(f"WITH removed AS (DELETE FROM classroom_assignments WHERE id='{ASSIGNMENT}' RETURNING id) SELECT count(*) FROM removed; SELECT count(*) FROM classroom_assignments WHERE id='{ASSIGNMENT}'", '1\n0', actor=OWNER)

    def test_nonmember_delete_denied(self):
        self.ok(f"WITH removed AS (DELETE FROM classroom_assignments WHERE id='{ASSIGNMENT}' RETURNING id) SELECT count(*) FROM removed", '0')

    def test_no_direct_private_student_join(self):
        self.denied(f"INSERT INTO classroom_members(classroom_id,user_id,role) VALUES('{ROOM}','{ACTOR}','student')")

    def test_no_self_teacher_escalation(self):
        self.denied(f"INSERT INTO classroom_members(classroom_id,user_id,role) VALUES('{ROOM}','{ACTOR}','teacher')")

    def test_no_self_admin_escalation(self):
        self.denied(f"INSERT INTO trivia_group_members(group_id,user_id,role) VALUES('{GROUP}','{ACTOR}','admin')")

    def test_no_direct_private_group_join(self):
        self.denied(f"INSERT INTO trivia_group_members(group_id,user_id,role) VALUES('{GROUP}','{ACTOR}','member')")

    def test_no_nonmember_assignment_creation(self):
        self.denied(f"INSERT INTO classroom_assignments(classroom_id,assigned_by) VALUES('{ROOM}','{ACTOR}')")

    def test_public_group_join(self):
        self.ok(f"INSERT INTO trivia_group_members(group_id,user_id,role) VALUES('20000000-0000-0000-0000-000000000002','{ACTOR}','member') RETURNING role", 'member')

    def test_code_join_duplicate_leave_rejoin(self):
        for rpc, table, fk, rid, code, member_role in [
            ('join_classroom_by_code','classroom_members','classroom_id',ROOM,'ab12cd','student'),
            ('join_trivia_group_by_code','trivia_group_members','group_id',GROUP,'cd12ab','member')]:
            with self.subTest(rpc=rpc):
                self.ok(f"SELECT {rpc}(' {code} '); SELECT {rpc}('{code.upper()}'); SELECT role FROM {table} WHERE {fk}='{rid}' AND user_id=auth.uid(); DELETE FROM {table} WHERE {fk}='{rid}' AND user_id=auth.uid(); SELECT {rpc}('{code}'); SELECT count(*) FROM {table} WHERE user_id=auth.uid()", f'{rid}\n{rid}\n{member_role}\n{rid}\n1')

    def test_join_preserves_owner_roles(self):
        self.ok(f"SELECT join_classroom_by_code('AB12CD'); SELECT role FROM classroom_members WHERE user_id=auth.uid(); SELECT join_trivia_group_by_code('CD12AB'); SELECT role FROM trivia_group_members WHERE user_id=auth.uid()", f'{ROOM}\nteacher\n{GROUP}\nadmin', actor=OWNER)

    def test_invalid_codes(self):
        for rpc in ['join_classroom_by_code','join_trivia_group_by_code']:
            for value in ["NULL", "''", "'ABC'", "'ABCDEF7'", "'AB%_CD'", "'ZZZZZZ'", "'AA BB CC'"]:
                with self.subTest(rpc=rpc,value=value): self.denied(f'SELECT {rpc}({value})')

    def test_no_anonymous_redemption(self):
        for rpc, code in [('join_classroom_by_code','AB12CD'),('join_trivia_group_by_code','CD12AB')]:
            self.denied(f"SELECT {rpc}('{code}')", actor='', role='anon')
            self.denied(f"SELECT {rpc}('{code}')", actor='')

    def test_student_cannot_create_or_delete_assignments(self):
        prefix="SELECT join_classroom_by_code('AB12CD'); "
        self.denied(prefix + f"INSERT INTO classroom_assignments(classroom_id,assigned_by) VALUES('{ROOM}','{ACTOR}')")
        self.ok(prefix + f"WITH removed AS (DELETE FROM classroom_assignments WHERE id='{ASSIGNMENT}' RETURNING id) SELECT count(*) FROM removed", f'{ROOM}\n0')

    def test_teacher_can_create(self):
        self.ok(f"INSERT INTO classroom_assignments(classroom_id,assigned_by) VALUES('{ROOM}','{OWNER}') RETURNING classroom_id", ROOM, actor=OWNER)

    def test_rpc_security_metadata(self):
        self.ok("SELECT bool_and(prosecdef AND proconfig=ARRAY['search_path=\"\"']) FROM pg_proc WHERE proname IN ('join_classroom_by_code','join_trivia_group_by_code'); SELECT has_function_privilege('anon','public.join_classroom_by_code(text)','EXECUTE'),has_function_privilege('authenticated','public.join_classroom_by_code(text)','EXECUTE'),has_function_privilege('anon','public.join_trivia_group_by_code(text)','EXECUTE')", 't\nf|t|f')

    def test_spoofed_membership_user_denied(self):
        self.denied(f"INSERT INTO trivia_group_members(group_id,user_id,role) VALUES('20000000-0000-0000-0000-000000000002','{OWNER}','member')")

    def test_owner_bootstrap_still_allowed(self):
        self.ok(f"INSERT INTO trivia_groups(id,name,join_code,is_public,created_by) VALUES('20000000-0000-0000-0000-000000000003','New','AA0001',false,'{ACTOR}'); INSERT INTO trivia_group_members(group_id,user_id,role) VALUES('20000000-0000-0000-0000-000000000003','{ACTOR}','admin') RETURNING role", 'admin')
        self.ok(f"INSERT INTO classrooms(id,name,join_code,created_by) VALUES('10000000-0000-0000-0000-000000000003','New','AA0001','{ACTOR}'); INSERT INTO classroom_members(classroom_id,user_id,role) VALUES('10000000-0000-0000-0000-000000000003','{ACTOR}','teacher') RETURNING role", 'teacher')

    def test_other_classroom_teacher_cannot_delete(self):
        self.ok(f"INSERT INTO classrooms(id,name,join_code,created_by) VALUES('10000000-0000-0000-0000-000000000003','New','AA0001','{ACTOR}'); INSERT INTO classroom_members(classroom_id,user_id,role) VALUES('10000000-0000-0000-0000-000000000003','{ACTOR}','teacher'); WITH removed AS (DELETE FROM classroom_assignments WHERE id='{ASSIGNMENT}' RETURNING id) SELECT count(*) FROM removed", '0')

    def test_concurrent_duplicate_redemption(self):
        query="SELECT join_classroom_by_code('AB12CD'); SELECT join_trivia_group_by_code('CD12AB')"
        try:
            with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:
                results=list(pool.map(lambda _: sql(query, rollback=False), range(8)))
            for result in results:
                self.assertEqual(result.returncode,0,result.stderr)
                self.assertEqual(result.stdout.strip(),f'{ROOM}\n{GROUP}')
            self.ok('SELECT count(*) FROM classroom_members WHERE user_id=auth.uid(); SELECT count(*) FROM trivia_group_members WHERE user_id=auth.uid()', '1\n1')
        finally:
            sql('DELETE FROM classroom_members WHERE user_id=auth.uid(); DELETE FROM trivia_group_members WHERE user_id=auth.uid()', rollback=False)

if __name__ == '__main__': unittest.main(verbosity=2)
