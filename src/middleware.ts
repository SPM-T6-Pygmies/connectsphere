import { type NextRequest, NextResponse } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

/**
 * Route Protection Middleware
 *
 * Enforces authentication rules for different route groups:
 * - /staff/* → Protected (staff only, requires login)
 * - everything else → Public (attendees and visitors, no login required),
 *   including /events*, /registrations/*, /auth/* and the homepage.
 *
 * This middleware runs on EVERY request, after Supabase session refresh.
 * It is a DRIVING ADAPTER (Next.js middleware layer), not core business logic.
 */

export async function middleware(request: NextRequest) {
  // Step 1: Refresh Supabase session (token management) and read who, if
  // anyone, is signed in. updateSession() does not gate routes itself.
  const { response, user } = await updateSession(request)

  // Step 2: /staff/* is the only protected route group. Gate on the claims
  // updateSession resolved: a cookie can be present but expired, and Supabase
  // splits a large session across chunked cookie names.
  if (request.nextUrl.pathname.startsWith('/staff') && !user) {
    const url = request.nextUrl.clone()
    url.pathname = '/auth/login'
    return NextResponse.redirect(url)
  }

  return response
}

/**
 * Matcher Configuration
 *
 * Specifies which routes this middleware should run on.
 * We run on all routes so we can protect /staff/* globally.
 *
 * Middleware runs BEFORE Next.js routing, so it can redirect
 * before the page component loads.
 */
export const config = {
  matcher: [
    // Run on all routes
    '/((?!_next/static|_next/image|favicon.ico|public).*)',
  ],
}
