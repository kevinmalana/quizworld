import { createBrowserClient } from '@supabase/ssr'

// 2026-08-13: Provide empty-string fallbacks so module instantiation doesn't throw
// when NEXT_PUBLIC_SUPABASE_URL is unset (e.g., during CI build prerender).
// At runtime the env vars are required; if they're missing, requests fail with a
// clear network error instead of blowing up the page module.
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ""
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ""

export const supabase = createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY)
