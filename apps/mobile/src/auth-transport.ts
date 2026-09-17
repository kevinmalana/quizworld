import { createClient, type Session } from '@supabase/supabase-js';
import { createPersonalRpc } from './personal-transport';
import type { AuthSession, AuthTransport } from './auth';

export function createSupabaseAuthTransport(url: string, key: string, request: typeof fetch = fetch): AuthTransport {
  // No browser storage/URL session detection, SDK background refresh, or service credential.
  // The controller is the sole owner of rotation, persistence and operation ordering.
  const client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: async (input, init) => {
      const abort = new AbortController();
      const timer = setTimeout(() => abort.abort(), 12000);
      try { return await request(input, { ...init, signal: abort.signal }); }
      finally { clearTimeout(timer); }
    } },
  });
  let personalSession:Session|null=null;
  async function verified(session: Session | null): Promise<AuthSession> {
    if (!session) throw new Error('No session');
    const { data, error } = await client.auth.getUser(session.access_token);
    if (error || !data.user || data.user.id !== session.user.id) throw new Error('Session validation failed');
    // MFA challenge UI is not implemented; do not silently treat aal1 as complete sign-in.
    if (data.user.factors?.some(f => f.status === 'verified')) throw new Error('MFA requires website');
    if (!session.expires_at || session.expires_at * 1000 <= Date.now()) throw new Error('Session expired');
    personalSession=session;
    return { user: { id: data.user.id, email: data.user.email }, refreshToken: session.refresh_token, expiresAt: session.expires_at * 1000 };
  }
  return {
    async personalRpc(owner,action,payload) {
      return createPersonalRpc(url,key,async()=>{
        const session=personalSession;
        if(!session||session.user.id!==owner||!session.expires_at||session.expires_at*1000<=Date.now())throw new Error('Session unavailable');
        return session.access_token;
      },request)(action,payload);
    },
    async login(email, password) {
      const { data, error } = await client.auth.signInWithPassword({ email, password });
      if (error) throw error;
      return verified(data.session);
    },
    async restore(refreshToken) {
      const { data, error } = await client.auth.refreshSession({ refresh_token: refreshToken });
      if (error) throw error;
      return verified(data.session);
    },
    async logout() {
      personalSession=null;
      const { error } = await client.auth.signOut({ scope: 'local' });
      if (error) throw error;
    },
  };
}
