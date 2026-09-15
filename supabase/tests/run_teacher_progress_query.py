"""Disposable local PG + actual Supabase query + real PostgREST. No remote target.
Run with POSTGREST_BIN and NODE_PATH pointing to existing read-only dependencies.
"""
import os
import subprocess
from test_teacher_progress import TeacherProgress, ROOT

if __name__ == '__main__':
    os.environ['TEACHER_PROGRESS_BASELINE'] = '1'
    TeacherProgress.setUpClass()
    try:
        TeacherProgress.exec('CREATE ROLE authenticator LOGIN NOINHERIT; GRANT anon,authenticated TO authenticator;')
        subprocess.run(['node','scripts/test-teacher-progress-query.cjs'], cwd=ROOT,
                       env={**os.environ, 'TEACHER_PROGRESS_PG_SOCKET':str(TeacherProgress.directory)}, check=True)
    finally:
        TeacherProgress.doClassCleanups()
