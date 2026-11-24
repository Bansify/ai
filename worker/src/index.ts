import type { AiUser, ChatRequestBody, Env, ModelRow, ProviderRow } from './types.ts';
import { buildSystemPrompt, trimMessages } from './prompt.ts';
import { openProviderStream, ProviderError } from './providers.ts';
import { getNextUtcReset, getUtcDay, markDegraded, rankProviders, recordUsage } from './scheduler.ts';
import { checkRateLimit, createGuestToken, getCachedAnswer, setCachedAnswer, sha256Hex } from './cache.ts';
import { resolveUser } from './auth.ts';
import { probeProvider } from './diag.ts';
import {
  appendMessage,
  cleanMessageText,
  createConversation,
  deleteAllConversations,
  deleteConversation,
  ensureConversation,
  getConversation,
  listConversations,
  renameConversation,
  titleFromFirstTurn,
} from './conversations.ts';

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Guest-Token, X-Admin-Token, X-Gothwad-Authuser',
  'Access-Control-Expose-Headers': 'x-cache, x-provider, x-model, x-conversation-id',
};

/** Signed-in daily cap per account; guests get the smaller IP-keyed cap. */
const AUTHED_DAILY_LIMIT = 300;
const GUEST_DAILY_LIMIT = 100;

/**
 * `/api/v1/health` and `/v1/health` both become `/v1/health`.
 * Anything else is left exactly as it arrived.
 */
export function normalizePath(pathname: string): string {
  if (pathname === '/api') return '/';
  if (pathname.startsWith('/api/')) return pathname.slice(4);
  return pathname;
}

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

function authRequired(): Response {
  return jsonResponse(
    { error: 'Bansify Account se sign in karo', code: 'auth_required' },
    401
  );
}

/**
 * Conversation routes. Every one of them needs a verified bearer token: chat
 * history belongs to an account, not to a device or an IP.
 */
async function handleConversations(
  request: Request,
  env: Env,
  user: AiUser | null,
  segments: string[]
): Promise<Response> {
  if (!user) return authRequired();

  // /v1/conversations
  if (segments.length === 0) {
    if (request.method === 'GET') {
      const conversations = await listConversations(env, user.id);
      return jsonResponse({ conversations });
    }
    if (request.method === 'POST') {
      const body = (await request.json().catch(() => null)) as
        | { title?: unknown; model?: unknown }
        | null;
      const conversation = await createConversation(env, user.id, body?.title, body?.model);
      return jsonResponse({ conversation }, 201);
    }
    if (request.method === 'DELETE') {
      const removed = await deleteAllConversations(env, user.id);
      return jsonResponse({ ok: true, removed });
    }
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  const conversationId = segments[0];
  if (!conversationId) return jsonResponse({ error: 'Not found' }, 404);

  // /v1/conversations/:id
  if (segments.length === 1) {
    if (request.method === 'GET') {
      const found = await getConversation(env, user.id, conversationId);
      if (!found) return jsonResponse({ error: 'Conversation not found' }, 404);
      return jsonResponse(found);
    }
    if (request.method === 'PATCH') {
      const body = (await request.json().catch(() => null)) as { title?: unknown } | null;
      const ok = await renameConversation(env, user.id, conversationId, body?.title);
      return ok ? jsonResponse({ ok: true }) : jsonResponse({ error: 'Conversation not found' }, 404);
    }
    if (request.method === 'DELETE') {
      const ok = await deleteConversation(env, user.id, conversationId);
      return ok ? jsonResponse({ ok: true }) : jsonResponse({ error: 'Conversation not found' }, 404);
    }
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  // /v1/conversations/:id/messages — clients that run their own streaming loop
  if (segments.length === 2 && segments[1] === 'messages' && request.method === 'POST') {
    const found = await getConversation(env, user.id, conversationId);
    if (!found) return jsonResponse({ error: 'Conversation not found' }, 404);
    const body = (await request.json().catch(() => null)) as
      | { role?: unknown; content?: unknown; model?: unknown; provider?: unknown }
      | null;
    const role = body?.role === 'assistant' ? 'assistant' : body?.role === 'user' ? 'user' : null;
    const content = cleanMessageText(body?.content);
    if (!role || !content.trim()) return jsonResponse({ error: 'role and content are required' }, 400);
    const message = await appendMessage(env, conversationId, role, content, {
      modelId: typeof body?.model === 'string' ? body.model : null,
      providerId: typeof body?.provider === 'string' ? body.provider : null,
    });
    if (role === 'user') await titleFromFirstTurn(env, found.conversation, content);
    return jsonResponse({ message }, 201);
  }

  return jsonResponse({ error: 'Not found' }, 404);
}

export async function handleRequest(
  request: Request,
  env: Env,
  ctx?: ExecutionContext
): Promise<Response> {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  const url = new URL(request.url);
  // The production route is `ai.bansify.com/api/*`, so the Worker sees
  // `/api/v1/chat`. Strip that one prefix (and nothing else) so the same build
  // also answers a direct `*.workers.dev/v1/chat` call, and so `..` tricks
  // cannot reach a different path.
  const path = normalizePath(url.pathname);

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

  // Who am I? The web app and the Android app both call this right after sign-in
  // to prove the token works before they show the chat screen.
  if (request.method === 'GET' && path === '/v1/me') {
    const user = await resolveUser(request, env);
    if (!user) return jsonResponse({ authenticated: false }, 401);
    return jsonResponse({
      authenticated: true,
      user,
      limits: { daily_requests: AUTHED_DAILY_LIMIT },
      reset_at: getNextUtcReset(),
    });
  }

  if (request.method === 'POST' && path === '/v1/feedback') {
    const body = (await request.json().catch(() => null)) as { model_id?: string; message_hash?: string; vote?: number } | null;
    if (!body?.model_id || !body?.message_hash || (body.vote !== 1 && body.vote !== -1)) {
      return jsonResponse({ error: 'Invalid feedback payload' }, 400);
    }
    const user = await resolveUser(request, env);
    const id = crypto.randomUUID();
    await env.DB.prepare(
      'INSERT INTO feedback (id, user_id, model_id, message_hash, vote, created_at) VALUES (?, ?, ?, ?, ?, ?)'
    ).bind(id, user?.id ?? 'anon', body.model_id, body.message_hash, body.vote, Date.now()).run();
    return jsonResponse({ ok: true, id });
  }

  // ---- Conversations (synced chat history across web + Android) -------------
  if (path === '/v1/conversations' || path.startsWith('/v1/conversations/')) {
    const user = await resolveUser(request, env);
    const segments = path.replace('/v1/conversations', '').split('/').filter(Boolean);
    return handleConversations(request, env, user, segments);
  }

  if (request.method === 'POST' && path === '/v1/chat') {
    const user = await resolveUser(request, env);
    const ip = request.headers.get('CF-Connecting-IP') ?? 'unknown';
    const limitKey = user ? `chat:user:${user.id}:${getUtcDay()}` : `chat:${ip}:${getUtcDay()}`;
    const limit = user ? AUTHED_DAILY_LIMIT : GUEST_DAILY_LIMIT;
    const rl = await checkRateLimit(env, limitKey, limit);
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

    // Persist the turn first, so a dropped stream still leaves the question saved.
    let conversationId: string | undefined;
    const lastUserMessage = [...body.messages].reverse().find((m) => m.role === 'user');
    if (user && body.conversation_id) {
      const conversation = await ensureConversation(
        env,
        user.id,
        body.conversation_id,
        body.conversation_title ?? lastUserMessage?.content,
        body.model
      );
      conversationId = conversation.id;
      if (lastUserMessage?.content) {
        await appendMessage(env, conversation.id, 'user', lastUserMessage.content, { modelId: body.model ?? null });
        await titleFromFirstTurn(env, conversation, lastUserMessage.content);
      }
    }

    const conversationHeaders: Record<string, string> = conversationId
      ? { 'x-conversation-id': conversationId }
      : {};

    if (!hasImage) {
      const cached = await getCachedAnswer(env, qHash);
      if (cached) {
        if (conversationId) {
          const saved = appendMessage(env, conversationId, 'assistant', cached, { modelId: body.model ?? null });
          if (ctx) ctx.waitUntil(saved); else await saved;
        }
        const response = sseFromText(cached, true);
        if (conversationId) response.headers.set('x-conversation-id', conversationId);
        return response;
      }
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
            if (conversationId && fullText.trim()) {
              const saved = appendMessage(env, conversationId, 'assistant', fullText, {
                modelId: candidate.modelId,
                providerId: candidate.provider.id,
              });
              if (ctx) ctx.waitUntil(saved);
            }
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
            ...conversationHeaders,
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

  // Provider diagnostics: one tiny request per provider, so a dead key or a
  // retired model id is visible before a user hits it.
  if (request.method === 'GET' && path === '/v1/diag') {
    // Public like /v1/health, but it does spend one tiny request per provider,
    // so an anonymous caller gets one run a minute and a hard daily cap.
    if (!isAdmin(request, env)) {
      const ip = request.headers.get('CF-Connecting-IP') ?? 'unknown';
      const perIp = await checkRateLimit(env, `diag:${ip}:${Math.floor(Date.now() / 60000)}`, 1, 60);
      const daily = await checkRateLimit(env, `diag:total:${getUtcDay()}`, 300);
      if (!perIp.allowed || !daily.allowed) {
        return jsonResponse({ error: 'Too many diagnostic runs, try again in a minute' }, 429);
      }
    }

    const { results: providers } = await env.DB.prepare(
      'SELECT * FROM providers ORDER BY priority DESC'
    ).all<ProviderRow>();
    const { results: models } = await env.DB.prepare(
      'SELECT * FROM models WHERE enabled = 1 ORDER BY is_free DESC, context_len DESC, display_name ASC'
    ).all<ModelRow>();
    const firstModel = new Map<string, string>();
    for (const m of models ?? []) {
      if (!firstModel.has(m.provider_id)) firstModel.set(m.provider_id, m.model_id);
    }

    const probes = await Promise.all(
      (providers ?? [])
        .filter((p) => firstModel.has(p.id))
        .map((p) => probeProvider(env, p, firstModel.get(p.id) as string))
    );
    // `?chat=1` also runs one real turn through the normal fallback path, so the
    // streaming pipeline itself is covered and not just the keys.
    let smoke: Record<string, unknown> | undefined;
    if (url.searchParams.get('chat') === '1') {
      const started = Date.now();
      const candidates = await rankProviders(env);
      const first = candidates[0];
      if (!first) {
        smoke = { ok: false, error: 'No provider available' };
      } else {
        try {
          const stream = await openProviderStream({
            provider: first.provider,
            modelId: first.modelId,
            systemPrompt: 'Reply with exactly: pong',
            messages: [{ role: 'user', content: 'ping' }],
            env,
          });
          const reader = stream.getReader();
          const decoder = new TextDecoder();
          let raw = '';
          while (raw.length < 4000) {
            const { done, value } = await reader.read();
            if (done) break;
            raw += decoder.decode(value, { stream: true });
          }
          const text = raw
            .split('\n')
            .filter((line) => line.startsWith('data:'))
            .map((line) => line.slice(5).trim())
            .filter((data) => data && data !== '[DONE]')
            .map((data) => {
              try { return (JSON.parse(data) as { delta?: string }).delta ?? ''; } catch { return ''; }
            })
            .join('');
          smoke = {
            ok: text.trim().length > 0,
            provider: first.provider.id,
            model: first.modelId,
            ms: Date.now() - started,
            text: text.slice(0, 200),
          };
        } catch (err) {
          smoke = {
            ok: false,
            provider: first.provider.id,
            model: first.modelId,
            ms: Date.now() - started,
            error: err instanceof Error ? err.message : String(err),
          };
        }
      }
    }

    return jsonResponse({
      checked_at: new Date().toISOString(),
      ok: probes.filter((p) => p.ok).length,
      total: probes.length,
      probes,
      ...(smoke ? { smoke } : {}),
    });
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
  fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    return handleRequest(request, env, ctx);
  },
};
