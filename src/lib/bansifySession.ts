/**
 * Bansify single sign-on for the AI app.
 *
 * The accounts session cookie lives on `.bansify.com`, so any sibling subdomain can
 * read it with `credentials: 'include'`. Drive and Mail expose a session endpoint that
 * answers `{ authenticated, user, accounts }`; we ask those, exactly like the official
 * website does, and only a parsed JSON body with `authenticated: false` counts as
 * "signed out" — an HTML fallback must never be mistaken for one.
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

const CANDIDATES = [
  'https://drive.bansify.com/api/me',
  'https://mail.bansify.com/api/session?meta=0',
];

const EMPTY: BansifySession = { authenticated: false, user: null, accounts: [], activeId: null, authuser: 0 };

export async function fetchBansifySession(): Promise<BansifySession> {
  for (const url of CANDIDATES) {
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

export const ACCOUNTS_WEB_ORIGIN = 'https://accounts.bansify.com';
