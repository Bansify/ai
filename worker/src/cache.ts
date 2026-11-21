import type { Env } from './types.ts';

export async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function getCachedAnswer(env: Env, qHash: string): Promise<string | null> {
  return env.CACHE.get(`cache:${qHash}`);
}

export async function setCachedAnswer(env: Env, qHash: string, answer: string): Promise<void> {
  if (!answer.trim()) return;
  await env.CACHE.put(`cache:${qHash}`, answer, { expirationTtl: 86400 });
}

export async function checkRateLimit(
  env: Env,
  key: string,
  limit: number,
  windowSec = 86400
): Promise<{ allowed: boolean; remaining: number }> {
  const kvKey = `ratelimit:${key}`;
  const raw = await env.CACHE.get(kvKey);
  const count = raw ? parseInt(raw, 10) || 0 : 0;
  if (count >= limit) {
    return { allowed: false, remaining: 0 };
  }
  await env.CACHE.put(kvKey, String(count + 1), { expirationTtl: windowSec });
  return { allowed: true, remaining: Math.max(0, limit - count - 1) };
}

export function createGuestToken(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return 'guest_' + Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
}
