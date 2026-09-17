import { CatalogConnectionError } from './catalog';
import type { Pack, StudyState } from './study/types';

export type AccessPhase = 'pending' | 'current' | 'bundled' | 'offline' | 'error';
export type AccessState = { phase: AccessPhase; pack: Pack | null };

/** A display/interaction guard, NOT an offline license or verified-result authority. */
export function createPracticeAccess(check: (pack: Pack) => Promise<void>) {
  let state: AccessState = { phase: 'pending', pack: null };
  let generation = 0;
  let disposed = false;
  let acting = false;
  const listeners = new Set<() => void>();
  const publish = (next: AccessState) => {
    state = next;
    for (const listener of listeners) listener();
  };
  const validate = async (pack: Pack) => {
    if (disposed) return false;
    const version = ++generation;
    if (pack.source === 'bundled') {
      publish({ phase: 'bundled', pack });
      return true;
    }
    publish({ phase: 'pending', pack });
    try {
      await check(pack);
      if (disposed || generation !== version) return false;
      publish({ phase: 'current', pack });
      return true;
    } catch (error) {
      if (disposed || generation !== version) return false;
      // Never surface raw network/server messages, URLs, headers or tokens.
      publish({ phase: error instanceof CatalogConnectionError ? 'offline' : 'error', pack });
      return false;
    }
  };
  return {
    getSnapshot: () => state,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    check: validate,
    activate() { disposed = false; generation++; },
    async run(pack: Pack, action: () => Promise<unknown>) {
      if (disposed || acting) return false;
      acting = true;
      try {
        const expected = generation + 1;
        if (!await validate(pack) || disposed || generation !== expected) return false;
        await action();
        return !disposed;
      } finally { acting = false; }
    },
    suspend() {
      if (disposed) return;
      generation++;
      publish({ phase: 'pending', pack: null });
    },
    dispose() { disposed = true; generation++; listeners.clear(); },
  };
}

/** Legacy history has no source/pack reference: erase all titles rather than guess. */
export function clearDownloadedPractice(state: StudyState): StudyState {
  return {
    ...state,
    active: state.active?.pack.source === 'public' ? null : state.active,
    reviews: state.reviews.filter(item => item.source === 'bundled'),
    history: [],
  };
}
