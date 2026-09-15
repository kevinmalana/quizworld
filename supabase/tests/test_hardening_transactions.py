"""Exact-file forward/disable transaction checks on a disposable LOCAL database."""
from pathlib import Path
import subprocess
from test_permissions import BASE

root = Path(__file__).resolve().parents[2]
db = 'qw_hardening_dryrun'
def run(query, target=db):
    args = BASE.copy()
    args[args.index('-d') + 1] = target
    result = subprocess.run(args + ['-c', query], text=True, capture_output=True)
    if result.returncode:
        raise RuntimeError(result.stderr)
    return result.stdout.strip()
def file(name):
    return (root / name).read_text()

run(f'CREATE DATABASE {db}', 'postgres')
try:
    fixture = file('supabase/tests/permission-fixture.sql').replace('CREATE ROLE anon;', '').replace('CREATE ROLE authenticated;', '')
    run(fixture)
    run(file('supabase/tests/hardening-fixture.sql'))
    run(file('supabase/migrations/20260915120000_private_code_membership_permissions.sql'))
    migration = file('supabase/migrations/20260915133000_adjacent_membership_hardening.sql')
    probe = "SELECT qual FROM pg_policies WHERE tablename='group_pinned_quizzes' AND policyname='Anyone can read pins';"
    before = run(probe)
    inside = run('BEGIN;' + migration + probe + 'ROLLBACK;')
    assert before == 'true' and inside != before and run(probe) == before
    print('PASS exact forward bytes apply inside transaction and rollback restores baseline')
    run('BEGIN;' + migration + 'COMMIT;')
    hardened = run(probe)
    disable = file('supabase/tests/hardening-safe-disable.sql')
    assert run('BEGIN;' + disable + probe + 'ROLLBACK;') == 'false'
    assert run(probe) == hardened
    print('PASS exact safe-disable bytes deny reads inside transaction; rollback restores hardened policy')
    run('BEGIN;' + disable + 'COMMIT;')
    assert run(probe) == 'false'
    check = "SELECT bool_and(with_check='false') FROM pg_policies WHERE policyname IN ('Members can pin','Users insert manual completions','Users update manual completions');"
    assert run(check) == 't'
    assert run("SELECT bool_and(proconfig=ARRAY['search_path=\"\"']) FROM pg_proc WHERE proname IN ('is_group_member','is_classroom_member','is_classroom_teacher')") == 't'
    run('BEGIN;' + migration + 'COMMIT;')
    assert run(probe) == hardened
    print('PASS committed fail-closed disable retains helpers; exact forward bytes safely re-enable')
finally:
    run(f'DROP DATABASE {db}', 'postgres')
