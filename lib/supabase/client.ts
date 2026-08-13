import { createBrowserClient } from '@supabase/ssr'
import type { SupabaseClient } from '@supabase/supabase-js'

// 2026-08-13: When env vars are missing (e.g., during CI build prerender), return a
// throw-on-anything stub instead of calling createBrowserClient which would crash
// the entire module load with a synchronous throw from the @supabase/ssr internals.

class UnconfiguredSupabaseError extends Error {
  constructor() {
    super(
      "Supabase is not configured: NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY are missing. " +
      "Set them in .env.local (local) or Vercel project env vars (production)."
    )
    this.name = "UnconfiguredSupabaseError"
  }
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ""
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ""

// Type is SupabaseClient (broadly compatible). At runtime, every method throws
// until env vars are provided.
const _proxyTarget: SupabaseClient = new Proxy(function() { throw new UnconfiguredSupabaseError() } as any, {
  get() { throw new UnconfiguredSupabaseError() },
  apply() { throw new UnconfiguredSupabaseError() },
}) as any as SupabaseClient

export const supabase: SupabaseClient = (SUPABASE_URL && SUPABASE_ANON_KEY)
  ? createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : _proxyTarget
