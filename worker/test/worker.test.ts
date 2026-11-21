import test from 'node:test';
import assert from 'node:assert/strict';
import { handleRequest } from '../src/index.ts';
import type { Env } from '../src/types.ts';

function createMockEnv(): Env {
  const mockProviders = [
    {
      id: 'groq',
      name: 'Groq',
      base_url: 'https://api.groq.com/openai/v1',
      free_tier_json: '{"daily_requests":1000}',
      priority: 100,
      status: 'healthy',
      last_checked: 0,
    },
  ];
  const mockModels = [
    {
      id: 'groq-llama-3.3-70b',
      provider_id: 'groq',
      model_id: 'llama-3.3-70b-versatile',
      display_name: 'Llama 3.3 70B',
      context_len: 131072,
      speed_class: 'instant',
      is_free: 1,
      enabled: 1,
    },
  ];

  const DB = {
    prepare(sql: string) {
      return {
        bind() {
          return this;
        },
        async all() {
          if (sql.includes('FROM models')) return { results: mockModels };
          if (sql.includes('FROM providers')) return { results: mockProviders };
          if (sql.includes('FROM usage')) return { results: [] };
          return { results: [] };
        },
      };
    },
  } as unknown as D1Database;

  const CACHE = {
    async get() {
      return null;
    },
    async put() {},
  } as unknown as KVNamespace;

  return { DB, CACHE };
}

test('GET /v1/health returns ok and degraded list', async () => {
  const res = await handleRequest(new Request('https://worker.test/v1/health'), createMockEnv());
  assert.equal(res.status, 200);
  const body = (await res.json()) as { ok: boolean; degraded: string[] };
  assert.equal(body.ok, true);
  assert.deepEqual(body.degraded, []);
});

test('GET /v1/models returns enabled models', async () => {
  const res = await handleRequest(new Request('https://worker.test/v1/models'), createMockEnv());
  assert.equal(res.status, 200);
  const body = (await res.json()) as { models: Array<{ id: string }> };
  assert.equal(body.models.length, 1);
  assert.equal(body.models[0].id, 'groq-llama-3.3-70b');
});
