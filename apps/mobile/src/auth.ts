export type AccountUser = { id: string; email?: string };
export type AuthSession = { user: AccountUser; refreshToken: string; expiresAt?: number };
export type AuthTransport = {
  login(email: string, password: string): Promise<AuthSession>;
  restore(refreshToken: string): Promise<AuthSession>;
  logout(): Promise<void>;
};
export type CredentialStore = {
  get(): Promise<string | null>;
  set(token: string): Promise<void>;
  remove(): Promise<void>;
};
export type AuthState = {
  user: AccountUser | null;
  phase: 'loading' | 'ready' | 'busy' | 'locked';
  error: string;
  revision: number;
  expiresAt?: number;
};

/** One serialized owner for the SDK and credential store. Never expose tokens to React. */
export function createAuthController(transport: AuthTransport, storage: CredentialStore) {
  let state: AuthState = { user: null, phase: 'loading', error: '', revision: 0 };
  const listeners = new Set<() => void>();
  let generation = 0;
  let queue = Promise.resolve();
  const publish = (next: Omit<AuthState, 'revision'>) => {
    state = { ...next, revision: state.revision + 1 };
    listeners.forEach(fn => fn());
  };
  const enqueue = (work: () => Promise<void>) => {
    const result = queue.then(work);
    queue = result.catch(() => {});
    return result;
  };
  const accept = async (session: AuthSession, epoch: number) => {
    if (epoch !== generation) return;
    await storage.set(session.refreshToken);
    if (epoch === generation) publish({ user: session.user, phase: 'ready', error: '', expiresAt: session.expiresAt });
  };
  const fail = (epoch: number, message: string) => {
    if (epoch === generation) publish({ user: null, phase: 'locked', error: message });
  };
  return {
    getSnapshot: () => state,
    subscribe(fn: () => void) { listeners.add(fn); return () => { listeners.delete(fn); }; },
    restore() {
      if (state.phase === 'busy') return queue;
      const epoch = ++generation;
      // Revalidation is fail closed: cached account data is hidden until the server confirms identity.
      publish({ user: null, phase: 'loading', error: '' });
      return enqueue(async () => {
        if (epoch !== generation) return;
        try {
          const token = await storage.get();
          if (epoch !== generation) return;
          if (token) await accept(await transport.restore(token), epoch);
          else publish({ user: null, phase: 'ready', error: '' });
        } catch { fail(epoch, 'Could not verify your saved session. Connect and retry, or forget this session to practise as a guest.'); }
      });
    },
    signIn(email: string, password: string) {
      if (state.phase !== 'ready' || state.user) return queue;
      const epoch = ++generation;
      publish({ user: null, phase: 'busy', error: '' });
      return enqueue(async () => {
        try { await accept(await transport.login(email.trim(), password), epoch); }
        catch { fail(epoch, 'Sign-in failed. Check your email/password and connection. Session storage must be available; accounts requiring MFA must use the website.'); }
      });
    },
    signOut() {
      const epoch = ++generation;
      publish({ user: null, phase: 'busy', error: '' });
      return enqueue(async () => {
        try { await storage.remove(); }
        catch { fail(epoch, 'Could not clear secure session storage. Sign-out is not complete. Retry forgetting this session before sharing this device.'); return; }
        let error = '';
        try { await transport.logout(); }
        catch { error = 'Signed out on this device. Server revocation could not be confirmed; other sessions are unchanged.'; }
        if (epoch === generation) publish({ user: null, phase: 'ready', error });
      });
    },
  };
}
