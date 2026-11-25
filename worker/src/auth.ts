// =============================================================================
// Bansify Accounts single sign-on for the AI worker.
//
// The pattern is copied from Bansify Mail (`mail/worker/src/session.ts`) so every
// Bansify product validates identity the same way. Two callers, two paths:
//
//   1. Bearer path  — native clients (the Android app) and anything scripted:
//        GET {ACCOUNTS_API_URL}/api/oauth/userinfo  with the access token.
//        The token must have been minted for a first-party AI client.
//
//   2. Cookie path  — the website on ai.bansify.com, which signs in through the
//        .bansify.com session cookie exactly like Mail and Drive:
//        GET {ACCOUNTS_API_URL}/api/auth/me  with the browser's Cookie header.
//
// Accounts owns the session. This worker never stores a password, a refresh
// token or a cookie: it asks Accounts who the caller is and keeps that answer in
// KV for a minute so a chatty client does not hammer the identity service.
// =============================================================================

import type { AiUser, Env } from './types.ts';
import { sha256Hex } from './cache.ts';

/** First-party OAuth clients allowed to use the AI API. */
const ACCEPTED_CLIENT_IDS = new Set(['gothwad-ai', 'bansify-ai', 'kiwi-store']);

const DEFAULT_ACCOUNTS_API_URL = 'https://api.bansify.com';
const TOKEN_TTL_SECONDS = 60;

interface OAuthUserInfoBody {
  sub?: unknown;
  id?: unknown;
  preferred_username?: unknown;
  username?: unknown;
  email?: unknown;
  name?: unknown;
  client_id?: unknown;
  aud?: unknown;
  scopes?: unknown;
  scope?: unknown;
}

interface SessionMeBody {
  authenticated?: unknown;
  user?: {
    id?: unknown;
    username?: unknown;
    email?: unknown;
    name?: unknown;
  } | null;
}

function textOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function accountsBase(env: Env): string {
  return (env.ACCOUNTS_API_URL || DEFAULT_ACCOUNTS_API_URL).trim().replace(/\/+$/, '');
}

export function bearerToken(request: Request): string | null {
  const header = request.headers.get('authorization');
  if (!header) return null;
  const match = /^bearer\s+(.+)$/i.exec(header.trim());
  const token = match?.[1]?.trim();
  return token ? token : null;
}

async function readCached(env: Env, key: string): Promise<AiUser | null> {
  const cached = await env.CACHE.get(key).catch(() => null);
  if (!cached) return null;
  try {
    const parsed = JSON.parse(cached) as AiUser;
    if (parsed && typeof parsed.id === 'string' && parsed.id) return parsed;
  } catch {
    // fall through and re-resolve
  }
  return null;
}

async function writeCached(env: Env, key: string, user: AiUser): Promise<void> {
  await env.CACHE.put(key, JSON.stringify(user), { expirationTtl: TOKEN_TTL_SECONDS }).catch(() => undefined);
}

async function resolveBearer(token: string, env: Env): Promise<AiUser | null> {
  const cacheKey = `token:${await sha256Hex(token)}`;
  const cached = await readCached(env, cacheKey);
  if (cached) return cached;

  let res: Response;
  try {
    res = await fetch(`${accountsBase(env)}/api/oauth/userinfo`, {
      headers: { authorization: `Bearer ${token}`, accept: 'application/json' },
    });
  } catch {
    return null;
  }
  if (!res.ok) return null;


  const body = (await res.json().catch(() => null)) as OAuthUserInfoBody | null;
  if (!body || typeof body !== 'object') return null;

  // Audience check: a token minted for another Bansify product must not work here.
  const clientId = textOrNull(body.client_id) ?? textOrNull(body.aud);
  if (!clientId || !ACCEPTED_CLIENT_IDS.has(clientId)) return null;

  const username = textOrNull(body.preferred_username) ?? textOrNull(body.username);
  if (!username) return null;

  const user: AiUser = {
    id: textOrNull(body.sub) ?? textOrNull(body.id) ?? username,
    username,
    email: textOrNull(body.email) ?? undefined,
    name: textOrNull(body.name) ?? undefined,
    clientId,
  };
  await writeCached(env, cacheKey, user);
  return user;
}

/**
 * Website path. The browser sends its `.bansify.com` session cookie because the
 * call is same-origin (`/api/...` on ai.bansify.com); we forward it, never read
 * it. A second tab signed into another account passes `X-Gothwad-Authuser`, and
 * that selector is forwarded unchanged, exactly like Mail does.
 */
/**
 * Rotated session cookies that Accounts returned while we resolved the caller. Keyed by
 * the request object, so the top-level handler can append them to the outgoing response:
 * the session lives on .bansify.com, and dropping a rotation would sign the user out.
 */
const rotatedCookies = new WeakMap<Request, string[]>();

const SESSION_COOKIE = /^(?:gothwad|bansify)_[a-z0-9_]+=/i;

/** The Set-Cookie values collected for this request, if any. */
export function takeRotatedCookies(request: Request): string[] {
  const list = rotatedCookies.get(request);
  rotatedCookies.delete(request);
  return list ?? [];
}

async function resolveCookie(request: Request, env: Env): Promise<AiUser | null> {
  const cookie = request.headers.get('cookie');
  if (!cookie) return null;

  const selector = request.headers.get('x-gothwad-authuser') ?? request.headers.get('x-bansify-authuser');
  const cacheKey = `cookie:${await sha256Hex(`${selector ?? ''}|${cookie}`)}`;
  const cached = await readCached(env, cacheKey);
  if (cached) return cached;

  const headers: Record<string, string> = { cookie, accept: 'application/json' };
  if (selector) headers['x-gothwad-authuser'] = selector;

  let res: Response;
  try {
    res = await fetch(`${accountsBase(env)}/api/auth/me`, { headers });
  } catch {
    return null;
  }
  if (!res.ok) return null;

  // Accounts rotates the session cookie on some responses; pass it on or the browser keeps
  // a cookie the server no longer accepts.
  const headersWithCookies = res.headers as Headers & { getSetCookie?: () => string[] };
  const setCookies = typeof headersWithCookies.getSetCookie === 'function' ? headersWithCookies.getSetCookie() : [];
  const rotated = setCookies.filter((value: string) => SESSION_COOKIE.test(value));
  if (rotated.length > 0) rotatedCookies.set(request, rotated);

  const body = (await res.json().catch(() => null)) as SessionMeBody | null;
  if (!body || body.authenticated !== true || !body.user) return null;

  const username = textOrNull(body.user.username);
  if (!username) return null;

  const user: AiUser = {
    id: textOrNull(body.user.id) ?? username,
    username,
    email: textOrNull(body.user.email) ?? undefined,
    name: textOrNull(body.user.name) ?? undefined,
    clientId: 'gothwad-ai',
  };
  await writeCached(env, cacheKey, user);
  return user;
}

/**
 * Resolves the caller's Bansify identity, or `null` for an anonymous/guest call.
 *
 * Never throws: a guest chat must still work when Accounts is having a bad day,
 * and the routes decide for themselves whether identity is required.
 */
export async function resolveUser(request: Request, env: Env): Promise<AiUser | null> {
  const token = bearerToken(request);
  if (token) return resolveBearer(token, env);
  return resolveCookie(request, env);
}

/** Forgets a cached answer (used when Accounts reports the caller signed out). */
export async function forgetCaller(request: Request, env: Env): Promise<void> {
  const token = bearerToken(request);
  if (token) {
    await env.CACHE.delete(`token:${await sha256Hex(token)}`).catch(() => undefined);
    return;
  }
  const cookie = request.headers.get('cookie');
  if (!cookie) return;
  const selector = request.headers.get('x-gothwad-authuser') ?? request.headers.get('x-bansify-authuser');
  await env.CACHE.delete(`cookie:${await sha256Hex(`${selector ?? ''}|${cookie}`)}`).catch(() => undefined);
}

export { ACCEPTED_CLIENT_IDS };
