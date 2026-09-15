"""Real Chromium + Supabase JS + local PostgREST + disposable PostgreSQL.
Requires POSTGREST_BIN (an existing PostgREST executable) and shared JS dependencies.
No network/production DB target can be supplied. No Supabase Auth or Next SSR claim.
"""
import os
import subprocess
from test_assignment_access import AssignmentAccess, ROOT

os.environ['ASSIGNMENT_BASELINE'] = '1'
AssignmentAccess.setUpClass()
try:
    AssignmentAccess.exec('CREATE ROLE authenticator LOGIN NOINHERIT; GRANT anon,authenticated TO authenticator;')
    subprocess.run(['node','scripts/test-assignment-access-browser.cjs'], cwd=ROOT,
                   env={**os.environ, 'ASSIGNMENT_PG_SOCKET':str(AssignmentAccess.directory)}, check=True)
finally:
    AssignmentAccess.doClassCleanups()
