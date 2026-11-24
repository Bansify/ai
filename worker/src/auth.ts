// =============================================================================
// Bansify Accounts single sign-on for the AI worker.
//
// The pattern is copied from Bansify Mail (`mail/worker/src/session.ts`) so every
// Bansify product validates a token the same way:
//
//   native + web client  --Authorization: Bearer <access_token>-->  this worker
//   this worker          --GET {ACCOUNTS_API_URL}/api/oauth/userinfo-->  Accounts
//
// Accounts owns the session. This worker never stores a password, a refresh
// token or a browser cookie: it only asks Accounts who the bearer belongs to and
// keeps that answer in KV for a minute so a chatty client does not hammer the
// identity service.
//
// A token that Accounts says is invalid is "signed out". A token that is valid
// but was minted for another Bansify app is *not* accepted here: it is refused,
// so a Mail or Store token can never read AI conversations.
// =============================================================================

import type { AiUser, Env } from './types.ts';
import { sha256Hex } from './cache.ts';

/** First-party OAuth clients allowed to use the AI API. */
const ACCEPTED_CLIENT_IDS = new Set(['gothwad-ai', 'bansify-ai', 'kiwi-store']);

const DEFAULT_ACCOUNTS_API_URL = 'https://api.bansify.com';

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

function textOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function accountsBase(env: Env): string {
  return (env.ACCOUNTS_API_URL || DEFAULT_ACCOUNTS_API_URL).trim().replace(/\/+$/, '');
}

function bearerToken(request: Request): string | null {
  const header = request.headers.get('authorization');
  if (!header) return null;
  const match = /^bearer\s+(.+)$/i.exec(header.trim());
  const token = match?.[1]?.trim();
  return token ? token : null;
}

function toUser(body: OAuthUserInfoBody): AiUser | null {
  const username = textOrNull(body.preferred_username) ?? textOrNull(body.username);
  if (!username) return null;
  const id = textOrNull(body.sub) ?? textOrNull(body.id) ?? username;
  const email = textOrNull(body.email) ?? undefined;
  const name = textOrNull(body.name) ?? undefined;
  const clientId = textOrNull(body.client_id) ?? undefined;
  return { id, username, email, name, clientId };
}

/**
 * Resolves the caller's Bansify identity, or `null` for an anonymous/guest call.
 *
 * Never throws: a guest chat must still work when Accounts is having a bad day,
 * and the routes decide for themselves whether identity is required.
 */
export async function resolveUser(request: Request, env: Env): Promise<AiUser | null> {
  const token = bearerToken(request);
  if (!token) return null;

  const cacheKey = `token:${await sha256Hex(token)}`;
  const cached = await env.CACHE.get(cacheKey).catch(() => null);
  if (cached) {
    try {
      const parsed = JSON.parse(cached) as AiUser;
      if (parsed && typeof parsed.id === 'string' && parsed.id) return parsed;
    } catch {
      // fall through and re-resolve
    }
  }

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

  const user = toUser(body);
  if (!user) return null;
  user.clientId = clientId;

  await env.CACHE.put(cacheKey, JSON.stringify(user), { expirationTtl: 60 }).catch(() => undefined);
  return user;
}

/** Forgets a cached token answer (used by /v1/me after a 401 upstream). */
export async function forgetToken(request: Request, env: Env): Promise<void> {
  const token = bearerToken(request);
  if (!token) return;
  await env.CACHE.delete(`token:${await sha256Hex(token)}`).catch(() => undefined);
}

export { bearerToken, ACCEPTED_CLIENT_IDS };
