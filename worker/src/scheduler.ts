import type { Env, ModelRow, ProviderRow } from './types.ts';

export interface RankedCandidate {
  provider: ProviderRow;
  modelId: string;
  remaining: number;
  dailyLimit: number;
  tier: number;
}

export function getUtcDay(): string {
  return new Date().toISOString().slice(0, 10);
}

export function getNextUtcReset(): string {
  const now = new Date();
  const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 0));
  return next.toISOString();
}

export async function rankProviders(
  env: Env,
  requestedModelId?: string
): Promise<RankedCandidate[]> {
  const day = getUtcDay();
  const { results: providers } = await env.DB.prepare(
    'SELECT * FROM providers ORDER BY priority DESC'
  ).all<ProviderRow>();

  const { results: usageRows } = await env.DB.prepare(
    'SELECT provider_id, requests FROM usage WHERE day = ?'
  ).bind(day).all<{ provider_id: string; requests: number }>();

  // Ordered, because `pModels[0]` is the model a provider answers with when the
  // caller did not pick one: biggest context first, free before paid, then name.
  const { results: models } = await env.DB.prepare(
    'SELECT * FROM models WHERE enabled = 1 ORDER BY is_free DESC, context_len DESC, display_name ASC'
  ).all<ModelRow>();

  const usageMap = new Map((usageRows ?? []).map((u) => [u.provider_id, u.requests]));
  const modelsByProvider = new Map<string, ModelRow[]>();
  for (const m of models ?? []) {
    const list = modelsByProvider.get(m.provider_id) ?? [];
    list.push(m);
    modelsByProvider.set(m.provider_id, list);
  }

  const candidates: RankedCandidate[] = [];
  for (const p of providers ?? []) {
    const degradedFlag = await env.CACHE.get(`degraded:${p.id}`);
    if (degradedFlag) continue;

    let dailyLimit = 0;
    try {
      dailyLimit = JSON.parse(p.free_tier_json).daily_requests ?? 0;
    } catch {
      dailyLimit = 0;
    }

    const used = usageMap.get(p.id) ?? 0;
    const remaining = Math.max(0, dailyLimit - used);
    if (dailyLimit > 0 && remaining <= 0) continue;

    const pModels = modelsByProvider.get(p.id) ?? [];
    if (pModels.length === 0) continue;

    const matched = requestedModelId
      ? pModels.find((m) => m.id === requestedModelId || m.model_id === requestedModelId)
      : undefined;
    const chosenModel = matched ?? pModels[0];

    const usedRatio = dailyLimit > 0 ? used / dailyLimit : 0;
    const tier = usedRatio > 0.8 ? 0 : 1;

    candidates.push({
      provider: p,
      modelId: chosenModel.model_id,
      remaining,
      dailyLimit,
      tier,
    });
  }

  return sortCandidates(candidates);
}

/**
 * The fallback chain, in the order a request walks it.
 *
 * 1. `tier`   — a provider past 80% of its daily budget drops behind healthy ones.
 * 2. priority — the operator's own ranking (Sarvam first, then the free tiers in
 *               the order they want them tried). This is what makes the chain
 *               predictable: before, a provider with a huge free quota always won
 *               and priority only broke ties.
 * 3. remaining — the same priority twice: spend the one with more left.
 */
export function sortCandidates<T extends { provider: { priority: number }; remaining: number; tier: number }>(
  candidates: T[]
): T[] {
  return [...candidates].sort((a, b) => {
    if (b.tier !== a.tier) return b.tier - a.tier;
    if (b.provider.priority !== a.provider.priority) return b.provider.priority - a.provider.priority;
    return b.remaining - a.remaining;
  });
}

export async function markDegraded(env: Env, providerId: string): Promise<void> {
  await env.CACHE.put(`degraded:${providerId}`, '1', { expirationTtl: 60 });
  await env.DB.prepare(
    "UPDATE providers SET status = 'degraded', last_checked = ? WHERE id = ?"
  ).bind(Date.now(), providerId).run();
}

export async function recordUsage(env: Env, providerId: string): Promise<void> {
  const day = getUtcDay();
  const id = `${day}:${providerId}`;
  await env.DB.prepare(
    `INSERT INTO usage (id, day, provider_id, requests, tokens_in, tokens_out)
     VALUES (?, ?, ?, 1, 0, 0)
     ON CONFLICT(day, provider_id) DO UPDATE SET requests = requests + 1`
  ).bind(id, day, providerId).run();
}
