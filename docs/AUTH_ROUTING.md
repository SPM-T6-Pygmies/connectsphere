# Authentication & Routing Guide

**For:** Understanding how auth cookies work, accessing user data, and routing based on roles.

---

## Auth Flow Overview

```
1. User submits login form (email + password)
   ↓
2. Server Action (loginAction) calls LoginUseCase
   ↓
3. LoginUseCase:
   - Calls AuthAdapter.login(email, password)
   - Queries UserRepository.findByAuthUserId(userId) for roles
   - Maps all errors to generic InvalidCredentialsError
   ↓
4. SupabaseAuthAdapter:
   - Calls client.auth.signInWithPassword()
   - Supabase creates session + auth token
   - Returns userId + expiresAt
   ↓
5. Server Action:
   - Updates user metadata with roles: user_metadata.roles = ["Event Coordinator", ...]
   - Redirects to /staff/[role]/ based on primary role
   ↓
6. Middleware:
   - Runs on every request
   - Calls updateSession() to refresh token
   - Checks hasAuthCookie for route protection
   - Redirects unauthenticated users from /staff/* to /auth/login
   ↓
7. Browser stores session cookie + user can access protected routes
```

---

## What Happens On Login

### Step 1: Auth Adapter Creates Session
```typescript
const { data, error } = await supabase.auth.signInWithPassword({
  email,
  password,
});
// Returns: { user: { id: "uuid...", email }, session: { ... } }
```

### Step 2: User Roles Are Queried
```typescript
// LoginUseCase queries the database
const user = await userRepository.findByAuthUserId(userId);
// Returns: { userId, name, roles: ["Event Coordinator", "Event Operations Manager"] }
```

### Step 3: Roles Stored in Auth Metadata
```typescript
// Server Action updates auth user with role data
await supabase.auth.updateUser({
  data: { roles: ["Event Coordinator", "Event Operations Manager"] }
});
```

### Step 4: Redirect to Role Page
```typescript
const primaryRole = result.roles[0]; // "Event Coordinator"
const path = roleToPagePath(primaryRole); // "/staff/coordinator"
redirect(path);
```

---

## Auth Cookie Contents & Structure

### Cookie Name
```
sb-<project-id>-auth-token
```

Example: `sb-naavldrvigibbakisnmv-auth-token`

### Cookie Value (JWT)
The auth cookie is a **JWT token** that contains:

```
Header.Payload.Signature
```

**Payload (decoded) contains:**
```json
{
  "iss": "https://naavldrvigibbakisnmv.supabase.co/auth/v1",
  "sub": "62c04872-047e-4f3f-82ec-91ce3d7610d6",
  "email": "coordinator@test.com",
  "email_verified": false,
  "phone_verified": false,
  "app_metadata": {
    "provider": "email"
  },
  "user_metadata": {
    "roles": ["Event Coordinator"]
  },
  "aud": "authenticated",
  "created_at": 1726142760,
  "updated_at": 1726142760,
  "exp": 1726229160
}
```

**Key fields for routing/data retrieval:**
- `sub` → User's auth UUID (matches `auth.users.id`)
- `email` → User's email
- `user_metadata.roles` → Role array (stored by loginAction)
- `exp` → Token expiration (Unix timestamp)

---

## Accessing Auth Data in Your Pages

### Server Component (Recommended for Protected Pages)

```tsx
// src/app/staff/coordinator/page.tsx
import { createClient } from "@/lib/supabase/server";

export default async function CoordinatorPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getSession();
  
  const userId = data.session.user.id; // UUID from cookie
  const roles = data.session.user.user_metadata.roles; // From metadata
  const email = data.session.user.email;
  
  // Use userId to fetch role-specific data
  const requests = await supabase
    .from('connection_request')
    .select('*')
    .eq('assigned_to', userId);
  
  return (
    <div>
      <h1>Coordinator Dashboard</h1>
      <p>Welcome, {email}</p>
      <p>Your roles: {roles.join(', ')}</p>
    </div>
  );
}
```

### Client Component (for UI logic)

```tsx
// src/components/user-info.tsx
'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export function UserInfo() {
  const [user, setUser] = useState(null);
  
  useEffect(() => {
    const loadUser = async () => {
      const supabase = createClient();
      const { data } = await supabase.auth.getSession();
      setUser({
        id: data.session?.user.id,
        email: data.session?.user.email,
        roles: data.session?.user.user_metadata?.roles || []
      });
    };
    loadUser();
  }, []);
  
  if (!user) return <div>Loading...</div>;
  
  return (
    <div>
      <p>User ID: {user.id}</p>
      <p>Email: {user.email}</p>
      <p>Roles: {user.roles.join(', ')}</p>
    </div>
  );
}
```

---

## Cookie Storage & Lifecycle

### Where Is It Stored?

| Environment | Storage | Managed By |
|-------------|---------|-----------|
| Browser | HTTP-Only Cookie | Supabase SDK |
| Server | HTTP Request Headers | Middleware (via cookies) |

### Cookie Attributes

```
Set-Cookie: sb-...-auth-token=<JWT>; 
  Path=/; 
  HttpOnly;           # ← Can't be accessed by JavaScript (security)
  Secure;             # ← HTTPS only
  SameSite=Lax;       # ← CSRF protection
  Max-Age=86400       # ← Expires in 24 hours
```

---

## What Happens WITHOUT Auth Cookie

### No Cookie → Request Reaches Middleware
```typescript
// src/middleware.ts
const hasAuthCookie = request.cookies.has('sb-...-auth-token');

if (pathname.startsWith('/staff')) {
  if (!hasAuthCookie) {
    // Redirect to login
    return NextResponse.redirect(new URL('/auth/login', request.url));
  }
}
```

### Result
- ✅ `/events` → Accessible (public route)
- ✅ `/auth/login` → Accessible (public route)
- ❌ `/staff/coordinator` → Redirects to `/auth/login`

---

## What Happens WITH Auth Cookie

### Cookie Present → Middleware Allows Access
```typescript
if (hasAuthCookie) {
  // Continue to page
  return response;
}
```

### Page Can Access User Data
```tsx
const { data } = await supabase.auth.getSession();
const userId = data.session.user.id;
const roles = data.session.user.user_metadata.roles;

// Fetch user-specific data
const assignments = await supabase
  .from('connection_request')
  .select('*')
  .eq('assigned_to', userId);
```

---

## Common Patterns

### Pattern 1: Route Protection via Middleware
```
Request → Middleware checks auth cookie
  ✓ Has cookie → Allow
  ✗ No cookie → Redirect to /auth/login
```

### Pattern 2: Role-Based Redirects
```
After login:
  Get primary role → Map to /staff/[role]/ → User lands on their page
```

### Pattern 3: Data Filtering by User ID
```
Server Component:
  Get userId from session
  Query database WHERE assigned_to = userId
  Return only that user's data
```

### Pattern 4: Metadata for Quick Access
```
Instead of querying roles every page load:
  Roles stored in user_metadata
  Available instantly in getSession()
  No database round-trip needed
```

---

## Session Expiration & Refresh

### Automatic Refresh (Middleware)
```typescript
// src/middleware.ts calls updateSession()
const response = await updateSession(request);
// Supabase automatically extends session if close to expiration
```

### Token Refresh Logic
- Token expires in 24 hours (`exp` in JWT)
- Supabase SDK checks expiration on every request
- If <5 min from expiry, automatically requests new token
- New token cookie set in response

### After Expiration
- Old cookie invalid
- `getSession()` returns `null`
- Middleware redirects to `/auth/login`
- User must re-login

---

## Security Considerations

### HttpOnly Cookies
✅ **Safe**: Stored in browser, not accessible to JavaScript (prevents XSS theft)
- Middleware can read (server-side)
- Client-side JavaScript CANNOT read directly
- Sent automatically with every request

### User Metadata Storage
✅ **Safe**: Not sensitive data
- Roles are non-secret information
- Stored in JWT payload (visible if decoded)
- Prevents repeated database queries

### Service Role Key vs Publishable Key
- **Service Role Key**: Used on server for database operations (full access)
- **Publishable Key**: Used in browser (limited read-only per RLS)
- Auth always uses service key on server for security

---

## Testing Auth Flow

### Test 1: Verify Cookie Created
```bash
1. Login at http://localhost:3000/auth/login
2. DevTools → Application → Cookies
3. Should see: sb-<id>-auth-token cookie
```

### Test 2: Verify Roles in Metadata
```bash
1. After login, open DevTools Console
2. Run:
   const { data } = await supabase.auth.getSession()
   console.log(data.session.user.user_metadata.roles)
3. Should print: ["Event Coordinator"]
```

### Test 3: Verify Route Protection
```bash
1. Open http://localhost:3000/staff/coordinator/ (without login)
2. Should redirect to /auth/login
3. After login, should load coordinator page
```

### Test 4: Verify Session Persistence
```bash
1. Login
2. Refresh page (F5)
3. Should stay on /staff/coordinator/ (cookie persists)
4. Cookie valid for 24 hours or until you logout
```

---

## Related Documentation

- **Setup guide:** [docs/LOGIN_FEATURE_SETUP_GUIDE.md](LOGIN_FEATURE_SETUP_GUIDE.md)
- **Supabase Auth:** https://supabase.com/docs/guides/auth
- **Session Management:** https://supabase.com/docs/guides/auth/server-side-rendering
- **Architecture:** [docs/ARCHITECTURE.md](ARCHITECTURE.md)
