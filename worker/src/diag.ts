// =============================================================================
// Provider diagnostics.
//
// A fallback chain is only as good as the last time someone checked it. This
// sends one tiny non-streaming request to every configured provider and reports
// what came back, so a dead key or a retired model id shows up as a red row
// instead of as a user's failed message.
//
// It never returns key material: only the provider id, HTTP status, latency and
// a short provider error string.
// =============================================================================

import type { Env, ProviderRow } from './types.ts';

export interface ProviderProbe {
  provider: string;
  model: string;
  ok: boolean;
  status: number;
  ms: number;
  error?: string;
}

function keyFor(env: Env, keyEnvName: string): string | undefined {
  const name = String(keyEnvName || '').trim();
  if (!/^[A-Z][A-Z0-9_]{2,63}$/.test(name)) return undefined;
  const value = (env as unknown as Record<string, unknown>)[name];
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

/** A provider error body, trimmed, with anything that looks like a key removed. */
function shortError(text: string, key: string): string {
  const scrubbed = key ? text.split(key).join('[key]') : text;
  return scrubbed.replace(/\s+/g, ' ').trim().slice(0, 220);
}

export async function probeProvider(
  env: Env,
  provider: ProviderRow,
  modelId: string
): Promise<ProviderProbe> {
  const started = Date.now();
  const key = keyFor(env, provider.key_env_name);
  if (!key) {
    return { provider: provider.id, model: modelId, ok: false, status: 0, ms: 0, error: `Missing secret ${provider.key_env_name}` };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);

  try {
    let url: string;
    let headers: Record<string, string> = { 'Content-Type': 'application/json' };
    let body: unknown;

    if (provider.id === 'gemini') {
      url = `${provider.base_url}/models/${modelId}:generateContent?key=${encodeURIComponent(key)}`;
      body = {
        contents: [{ role: 'user', parts: [{ text: 'ping' }] }],
        generationConfig: { maxOutputTokens: 1 },
      };
    } else {
      url = `${provider.base_url}/chat/completions`;
      headers = {
        ...headers,
        Authorization: `Bearer ${key}`,
        ...(provider.id === 'sarvam' ? { 'api-subscription-key': key } : {}),
      };
      body = {
        model: modelId,
        messages: [{ role: 'user', content: 'ping' }],
        max_tokens: 1,
        stream: false,
        // Sarvam thinks before answering by default, which leaves `content`
        // empty; null keeps the probe (and normal chat) on the fast path.
        ...(provider.id === 'sarvam' ? { reasoning_effort: null } : {}),
      };
    }

    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const text = await res.text().catch(() => '');
    return {
      provider: provider.id,
      model: modelId,
      ok: res.ok,
      status: res.status,
      ms: Date.now() - started,
      ...(res.ok ? {} : { error: shortError(text, key) }),
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      provider: provider.id,
      model: modelId,
      ok: false,
      status: 0,
      ms: Date.now() - started,
      error: shortError(message, key),
    };
  } finally {
    clearTimeout(timer);
  }
}
