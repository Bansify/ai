/**
 * Bansify single sign-on for the AI app.
 *
 * The session cookie lives on `.bansify.com`, so this app does not need to ask
 * another product who you are. It asks its OWN worker:
 *
 *     GET /api/v1/me        (same-origin, cookie sent automatically)
 *     ->  { authenticated: true, user: {...} }
 *
 * The worker then forwards the cookie to Accounts server-side
 * (`/api/auth/me`), which is why no CORS grant is needed anywhere.
 *
 * This used to call `drive.bansify.com/api/me` and `mail.bansify.com/api/session`
 * cross-origin. Those workers only allow their own origin (their CORS allowlist
 * is [mailUrl] + ALLOWED_ORIGINS, which is empty in production), so every check
 * failed and the app fell back to the login screen on each visit — no auto
 * sign-in, ever. The cross-origin calls stay below as a last resort.
 */

export interface BansifyUser {
  id?: string;
  username?: string;
  name?: string;
  email?: string;
  avatarUrl?: string | null;
  avatar_url?: string | null;
}

export interface BansifySession {
  authenticated: boolean;
  user: BansifyUser | null;
  accounts: BansifyUser[];
  activeId: string | null;
  authuser: number;
}

/** Same-origin first: our own worker reads the .bansify.com cookie server-side. */
const SAME_ORIGIN_CANDIDATE = '/api/v1/me';

/** Last resort only: other products, which need a CORS grant we cannot rely on. */
const CROSS_ORIGIN_CANDIDATES = [
  'https://drive.bansify.com/api/me',
  'https://mail.bansify.com/api/session?meta=0',
];

const EMPTY: BansifySession = { authenticated: false, user: null, accounts: [], activeId: null, authuser: 0 };

interface MeResponse {
  authenticated?: boolean;
  user?: {
    id?: string;
    username?: string;
    email?: string | null;
    name?: string | null;
    avatarUrl?: string | null;
  } | null;
}

async function readSameOrigin(): Promise<BansifySession | null> {
  try {
    const res = await fetch(SAME_ORIGIN_CANDIDATE, {
      credentials: 'include',
      cache: 'no-store',
      headers: { Accept: 'application/json' },
    });
    const type = (res.headers.get('content-type') || '').toLowerCase();
    if (!type.includes('application/json')) return null;

    // 401 is a real answer here: the worker checked the cookie with Accounts.
    if (res.status === 401) return { ...EMPTY };

    const body = (await res.json().catch(() => null)) as MeResponse | null;
    if (!body?.authenticated || !body.user) return { ...EMPTY };

    const user: BansifyUser = {
      id: body.user.id,
      username: body.user.username,
      name: body.user.name ?? undefined,
      email: body.user.email ?? undefined,
      avatarUrl: body.user.avatarUrl ?? null,
    };
    return {
      authenticated: true,
      user,
      accounts: [user],
      activeId: user.id ?? null,
      authuser: 0,
    };
  } catch {
    // Network error: let the cross-origin fallback try, then give up signed out.
    return null;
  }
}

async function readCrossOrigin(): Promise<BansifySession> {
  for (const url of CROSS_ORIGIN_CANDIDATES) {
    try {
      const res = await fetch(url, { credentials: 'include', cache: 'no-store', headers: { Accept: 'application/json' } });
      const type = (res.headers.get('content-type') || '').toLowerCase();
      if (!type.includes('application/json')) continue;
      const data = (await res.json().catch(() => null)) as
        | (Partial<BansifySession> & { authenticated?: boolean })
        | null;
      if (!data) continue;
      if (data.authenticated) {
        return {
          authenticated: true,
          user: (data.user as BansifyUser) ?? null,
          accounts: (data.accounts as BansifyUser[]) ?? [],
          activeId: (data.activeId as string) ?? null,
          authuser: typeof data.authuser === 'number' ? data.authuser : 0,
        };
      }
      // A real "not signed in" answer: stop here.
      if (data.authenticated === false) return { ...EMPTY };
    } catch {
      /* try the next endpoint */
    }
  }
  return { ...EMPTY };
}

export async function fetchBansifySession(): Promise<BansifySession> {
  const sameOrigin = await readSameOrigin();
  if (sameOrigin) return sameOrigin;
  return readCrossOrigin();
}

export const ACCOUNTS_WEB_ORIGIN = 'https://accounts.bansify.com';
