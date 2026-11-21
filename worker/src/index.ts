import type { ChatRequestBody, Env, ModelRow, ProviderRow } from './types.ts';
import { buildSystemPrompt, trimMessages } from './prompt.ts';
import { openProviderStream, ProviderError } from './providers.ts';
import { getNextUtcReset, getUtcDay, markDegraded, rankProviders, recordUsage } from './scheduler.ts';
import { checkRateLimit, createGuestToken, getCachedAnswer, setCachedAnswer, sha256Hex } from './cache.ts';

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Guest-Token, X-Admin-Token',
};

export function jsonResponse(data: unknown, status = 200, extraHeaders: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS, ...extraHeaders },
  });
}

function sseFromText(text: string, cacheHit = false): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ delta: text })}\n\n`));
      controller.enqueue(encoder.encode('data: [DONE]\n\n'));
      controller.close();
    },
  });
  return new Response(stream, {
    status: 200,
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      ...(cacheHit ? { 'x-cache': 'hit' } : {}),
      ...CORS_HEADERS,
    },
  });
}

function isAdmin(request: Request, env: Env): boolean {
  const token = request.headers.get('X-Admin-Token');
  return Boolean(env.ADMIN_SERVICE_TOKEN && token && token === env.ADMIN_SERVICE_TOKEN);
}

export async function handleRequest(request: Request, env: Env): Promise<Response> {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  const url = new URL(request.url);
  const path = url.pathname;

  if (request.method === 'GET' && path === '/v1/health') {
    const { results } = await env.DB.prepare(
      'SELECT id, name, status, last_checked FROM providers ORDER BY priority DESC'
    ).all<Pick<ProviderRow, 'id' | 'name' | 'status' | 'last_checked'>>();
    const degraded = (results ?? []).filter((p) => p.status !== 'healthy').map((p) => p.id);
    return jsonResponse({ ok: true, service: 'bansify-ai-worker', timestamp: Date.now(), degraded, providers: results ?? [] });
  }

  if (request.method === 'GET' && path === '/v1/models') {
    const { results } = await env.DB.prepare(
      'SELECT id, provider_id, model_id, display_name, context_len, speed_class, is_free, enabled FROM models WHERE enabled = 1 ORDER BY is_free DESC, display_name ASC'
    ).all<ModelRow>();
    return jsonResponse({ models: results ?? [] });
  }

  if (request.method === 'GET' && path === '/v1/providers') {
    const day = getUtcDay();
    const { results: providers } = await env.DB.prepare(
      'SELECT id, name, base_url, free_tier_json, priority, status, last_checked FROM providers ORDER BY priority DESC'
    ).all<Omit<ProviderRow, 'key_env_name'>>();
    const { results: usageRows } = await env.DB.prepare(
      'SELECT provider_id, requests FROM usage WHERE day = ?'
    ).bind(day).all<{ provider_id: string; requests: number }>();

    const usageMap = new Map((usageRows ?? []).map((u) => [u.provider_id, u.requests]));
    const enriched = (providers ?? []).map((p) => {
      let dailyLimit = 0;
      try { dailyLimit = JSON.parse(p.free_tier_json).daily_requests ?? 0; } catch { dailyLimit = 0; }
      const used = usageMap.get(p.id) ?? 0;
      return {
        id: p.id, name: p.name, status: p.status, priority: p.priority, last_checked: p.last_checked,
        daily_limit: dailyLimit, used_today: used, remaining_today: Math.max(0, dailyLimit - used),
      };
    });
    return jsonResponse({ providers: enriched, day });
  }

  if (request.method === 'POST' && path === '/v1/guest') {
    const ip = request.headers.get('CF-Connecting-IP') ?? 'unknown';
    const rl = await checkRateLimit(env, `guest:${ip}:${getUtcDay()}`, 20);
    if (!rl.allowed) return jsonResponse({ error: 'Too many guest token requests' }, 429);
    return jsonResponse({ token: createGuestToken(), expires_in: 86400 });
  }

  if (request.method === 'POST' && path === '/v1/feedback') {
    const body = (await request.json().catch(() => null)) as { model_id?: string; message_hash?: string; vote?: number } | null;
    if (!body?.model_id || !body?.message_hash || (body.vote !== 1 && body.vote !== -1)) {
      return jsonResponse({ error: 'Invalid feedback payload' }, 400);
    }
    const id = crypto.randomUUID();
    await env.DB.prepare(
      'INSERT INTO feedback (id, user_id, model_id, message_hash, vote, created_at) VALUES (?, ?, ?, ?, ?, ?)'
    ).bind(id, 'anon', body.model_id, body.message_hash, body.vote, Date.now()).run();
    return jsonResponse({ ok: true, id });
  }

  if (request.method === 'POST' && path === '/v1/chat') {
    const ip = request.headers.get('CF-Connecting-IP') ?? 'unknown';
    const rl = await checkRateLimit(env, `chat:${ip}:${getUtcDay()}`, 100);
    if (!rl.allowed) {
      return jsonResponse({ error: 'Abhi free quota khatam hai, kal reset hoga', reset_at: getNextUtcReset() }, 429);
    }

    const body = (await request.json().catch(() => null)) as ChatRequestBody | null;
    if (!body || !Array.isArray(body.messages) || body.messages.length === 0) {
      return jsonResponse({ error: 'messages[] is required' }, 400);
    }

    const systemPrompt = buildSystemPrompt(body.persona, body.style);
    const trimmed = trimMessages(body.messages);
    const hasImage = body.messages.some((m) => Boolean(m.hasImage));
    const qHash = await sha256Hex(JSON.stringify({ systemPrompt, trimmed, model: body.model ?? 'auto' }));

    if (!hasImage) {
      const cached = await getCachedAnswer(env, qHash);
      if (cached) return sseFromText(cached, true);
    }

    const candidates = await rankProviders(env, body.model);
    for (const candidate of candidates) {
      try {
        const stream = await openProviderStream({
          provider: candidate.provider,
          modelId: candidate.modelId,
          systemPrompt,
          messages: trimmed,
          env,
          onComplete: (fullText) => {
            if (!hasImage) void setCachedAnswer(env, qHash, fullText);
          },
        });
        await recordUsage(env, candidate.provider.id);
        return new Response(stream, {
          status: 200,
          headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'x-provider': candidate.provider.id,
            'x-model': candidate.modelId,
            ...CORS_HEADERS,
          },
        });
      } catch (err) {
        if (err instanceof ProviderError && (err.status === 429 || err.status >= 500)) {
          await markDegraded(env, candidate.provider.id);
        }
      }
    }

    return jsonResponse(
      { error: 'Abhi free quota khatam hai, kal reset hoga', reset_at: getNextUtcReset() },
      503
    );
  }

  // Admin routes
  if (path.startsWith('/admin/')) {
    if (!isAdmin(request, env)) return jsonResponse({ error: 'Unauthorized' }, 401);

    if (request.method === 'GET' && path === '/admin/usage') {
      const { results } = await env.DB.prepare('SELECT * FROM usage ORDER BY day DESC LIMIT 100').all();
      return jsonResponse({ usage: results ?? [] });
    }

    if (request.method === 'POST' && path === '/admin/providers') {
      const body = (await request.json().catch(() => null)) as Partial<ProviderRow> | null;
      if (!body?.id || !body?.name || !body?.base_url || !body?.key_env_name) {
        return jsonResponse({ error: 'Missing provider fields' }, 400);
      }
      await env.DB.prepare(
        `INSERT INTO providers (id, name, base_url, key_env_name, free_tier_json, priority, status, last_checked)
         VALUES (?, ?, ?, ?, ?, ?, 'healthy', ?)
         ON CONFLICT(id) DO UPDATE SET name=excluded.name, base_url=excluded.base_url, free_tier_json=excluded.free_tier_json, priority=excluded.priority`
      ).bind(body.id, body.name, body.base_url, body.key_env_name, body.free_tier_json ?? '{"daily_requests":100}', body.priority ?? 50, Date.now()).run();
      return jsonResponse({ ok: true });
    }
  }

  return jsonResponse({ error: 'Not found' }, 404);
}

export default {
  fetch(request: Request, env: Env): Promise<Response> {
    return handleRequest(request, env);
  },
};
