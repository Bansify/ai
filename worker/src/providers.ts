import type { Env, ProviderRow } from './types.ts';

export interface StreamOptions {
  provider: ProviderRow;
  modelId: string;
  systemPrompt: string;
  messages: Array<{ role: 'user' | 'assistant'; content: string }>;
  env: Env;
  onComplete?: (fullText: string) => void;
}

export class ProviderError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

/**
 * Resolves a provider's key from its `key_env_name` column.
 *
 * Deliberately dynamic: adding a provider (Z.ai, SambaNova, Workers AI, ...) is
 * one `providers` row plus one Worker secret, with no code change and no deploy
 * of a new map. A row whose secret is missing simply fails this candidate and
 * the scheduler moves to the next provider.
 */
function getApiKey(env: Env, keyEnvName: string): string | undefined {
  const name = String(keyEnvName || '').trim();
  if (!/^[A-Z][A-Z0-9_]{2,63}$/.test(name)) return undefined;
  const value = (env as unknown as Record<string, unknown>)[name];
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

/**
 * Sarvam wants its key twice: as a bearer token AND in `api-subscription-key`.
 * Every other provider is plain OpenAI-compatible (`Authorization: Bearer`).
 */
function providerHeaders(provider: ProviderRow, apiKey: string): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${apiKey}`,
  };
  if (provider.id === 'sarvam') {
    headers['api-subscription-key'] = apiKey;
  }
  return headers;
}

export async function openProviderStream(opts: StreamOptions): Promise<ReadableStream<Uint8Array>> {
  const apiKey = getApiKey(opts.env, opts.provider.key_env_name);
  if (!apiKey) {
    throw new ProviderError(`Missing secret ${opts.provider.key_env_name}`, 503);
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);

  try {
    if (opts.provider.id === 'gemini') {
      return await streamGemini(opts, apiKey, controller.signal);
    }
    return await streamOpenAICompatible(opts, apiKey, controller.signal);
  } finally {
    clearTimeout(timer);
  }
}

async function streamGemini(
  opts: StreamOptions,
  apiKey: string,
  signal: AbortSignal
): Promise<ReadableStream<Uint8Array>> {
  const url = `${opts.provider.base_url}/models/${opts.modelId}:streamGenerateContent?alt=sse&key=${encodeURIComponent(apiKey)}`;
  const body = {
    systemInstruction: { parts: [{ text: opts.systemPrompt }] },
    contents: opts.messages.map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    })),
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  });

  if (!res.ok || !res.body) {
    throw new ProviderError(`Gemini error ${res.status}`, res.status);
  }

  return normalizeSseStream(res.body, (data) => {
    const parsed = JSON.parse(data);
    return parsed?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
  }, opts.onComplete);
}

async function streamOpenAICompatible(
  opts: StreamOptions,
  apiKey: string,
  signal: AbortSignal
): Promise<ReadableStream<Uint8Array>> {
  const url = `${opts.provider.base_url}/chat/completions`;
  const body = {
    model: opts.modelId,
    stream: true,
    messages: [
      { role: 'system', content: opts.systemPrompt },
      ...opts.messages,
    ],
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: providerHeaders(opts.provider, apiKey),
    body: JSON.stringify(body),
    signal,
  });

  if (!res.ok || !res.body) {
    throw new ProviderError(`${opts.provider.name} error ${res.status}`, res.status);
  }

  return normalizeSseStream(res.body, (data) => {
    const parsed = JSON.parse(data);
    return parsed?.choices?.[0]?.delta?.content ?? '';
  }, opts.onComplete);
}

function normalizeSseStream(
  upstream: ReadableStream<Uint8Array>,
  extractDelta: (jsonStr: string) => string,
  onComplete?: (fullText: string) => void
): ReadableStream<Uint8Array> {
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let buffer = '';
  let fullText = '';

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      const reader = upstream.getReader();
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() ?? '';

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith('data:')) continue;
            const payload = trimmed.slice(5).trim();
            if (!payload || payload === '[DONE]') continue;
            try {
              const delta = extractDelta(payload);
              if (delta) {
                fullText += delta;
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ delta })}\n\n`));
              }
            } catch {
              // Ignore partial/malformed SSE chunk
            }
          }
        }
        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        onComplete?.(fullText);
        controller.close();
      } catch (err) {
        controller.error(err);
      } finally {
        reader.releaseLock();
      }
    },
  });
}
