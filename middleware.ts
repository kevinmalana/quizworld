import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { normalizePostLoginRedirect } from './lib/auth/redirects'

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Protect /admin — redirect to /login if no session
  if (pathname === '/admin' || pathname.startsWith('/admin/')) {
    const response = NextResponse.next()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll()
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              request.cookies.set(name, value)
              response.cookies.set(name, value, options)
            })
          },
        },
      }
    )

    const { data: { user }, error } = await supabase.auth.getUser()

    if (error || !user) {
      // One supported return-path convention: the login page and
      // /auth/callback consume `next` (validated by normalizePostLoginRedirect,
      // which rejects absolute/protocol-relative URLs before any redirect).
      const loginUrl = request.nextUrl.clone();
      loginUrl.pathname = "/login";
      loginUrl.search = "";
      loginUrl.searchParams.set("next", normalizePostLoginRedirect(`${pathname}${request.nextUrl.search}`));
      const redirect = NextResponse.redirect(loginUrl);
      response.cookies.getAll().forEach(cookie => redirect.cookies.set(cookie));
      return redirect;
    }
    return response;
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/admin/:path*'],
}
