import { type NextRequest, NextResponse } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

/**
 * Route Protection Middleware
 *
 * Enforces authentication rules for different route groups:
 * - /staff/* → Protected (staff only, requires login)
 * - /events* → Public (attendees, no login required)
 * - /auth/* → Public (login form, accessible to all)
 * - / → Public (homepage)
 *
 * This middleware runs on EVERY request, after Supabase session refresh.
 * It is a DRIVING ADAPTER (Next.js middleware layer), not core business logic.
 */

export async function middleware(request: NextRequest) {
  // Step 1: Refresh Supabase session (token management)
  // This handles cookie refresh, token expiration, etc.
  // updateSession() returns a response with updated cookies.
  const response = await updateSession(request)

  // Step 2: Get the request pathname (e.g., "/staff/organiser/role-landing-view")
  const pathname = request.nextUrl.pathname

  // Step 3: Extract session from request (set by updateSession via cookies)
  // The session is stored in the response cookies by Supabase middleware.
  // We need to check if a user is logged in by examining the auth state.
  // In Supabase SSR, this is available via getClaims() (called in updateSession).
  // For route protection, we check if the response would have redirected.
  // However, updateSession() already redirects unauthenticated users.
  // We need a different approach: check if the user made it past updateSession.

  // Alternative: Extract auth state from request/response
  // The Supabase middleware sets cookies; if no auth token cookie exists, user is not authenticated.
  const hasAuthCookie = request.cookies.has('sb-' + process.env.NEXT_PUBLIC_SUPABASE_URL?.split('//')[1]?.split('.')[0] + '-auth-token')

  // Step 4: Apply route-specific rules
  // ─────────────────────────────────

  // Rule 1: /staff/* routes require authentication
  if (pathname.startsWith('/staff')) {
    // If user is accessing a protected route without auth, redirect to login
    if (!hasAuthCookie) {
      const url = request.nextUrl.clone()
      url.pathname = '/auth/login'
      return NextResponse.redirect(url)
    }
    // User is authenticated, allow request
    return response
  }

  // Rule 2: /events routes are always public (attendees, no login)
  if (pathname.startsWith('/events')) {
    return response
  }

  // Rule 3: /auth routes are always public (login page, signup, etc.)
  if (pathname.startsWith('/auth')) {
    return response
  }

  // Rule 4: Homepage is public
  if (pathname === '/') {
    return response
  }

  // Step 5: Default behavior (allow request, let Next.js routing handle it)
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
