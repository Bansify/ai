import type { Env, ModelRow, ProviderRow } from './types.ts';

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Guest-Token, X-Admin-Token',
};

export function jsonResponse(data: unknown, status = 200, extraHeaders: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...CORS_HEADERS,
      ...extraHeaders,
    },
  });
}

export function getUtcDay(): string {
  return new Date().toISOString().slice(0, 10);
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
    return jsonResponse({
      ok: true,
      service: 'bansify-ai-worker',
      timestamp: Date.now(),
      degraded,
      providers: results ?? [],
    });
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
      try {
        dailyLimit = JSON.parse(p.free_tier_json).daily_requests ?? 0;
      } catch {
        dailyLimit = 0;
      }
      const used = usageMap.get(p.id) ?? 0;
      return {
        id: p.id,
        name: p.name,
        status: p.status,
        priority: p.priority,
        last_checked: p.last_checked,
        daily_limit: dailyLimit,
        used_today: used,
        remaining_today: Math.max(0, dailyLimit - used),
      };
    });

    return jsonResponse({ providers: enriched, day });
  }

  return jsonResponse({ error: 'Not found' }, 404);
}

export default {
  fetch(request: Request, env: Env): Promise<Response> {
    return handleRequest(request, env);
  },
};
