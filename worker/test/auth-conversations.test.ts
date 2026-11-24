import test from 'node:test';
import assert from 'node:assert/strict';
import { handleRequest } from '../src/index.ts';
import { openProviderStream } from '../src/providers.ts';
import type { Env } from '../src/types.ts';

// -----------------------------------------------------------------------------
// A tiny in-memory stand-in for D1. It matches on SQL fragments instead of
// parsing SQL, which is enough to prove the routes scope every query by user_id.
// -----------------------------------------------------------------------------
interface FakeState {
  conversations: Array<Record<string, unknown>>;
  messages: Array<Record<string, unknown>>;
}

function createMockEnv(state: FakeState = { conversations: [], messages: [] }): { env: Env; state: FakeState } {
  const kv = new Map<string, string>();

  const DB = {
    prepare(sql: string) {
      let bound: unknown[] = [];
      const api = {
        bind(...args: unknown[]) {
          bound = args;
          return api;
        },
        async all() {
          if (sql.includes('FROM conversations')) {
            const userId = bound[0] as string;
            const rows = state.conversations
              .filter((c) => c.user_id === userId && c.archived === 0)
              .sort((a, b) => Number(b.updated_at) - Number(a.updated_at));
            return { results: rows };
          }
          if (sql.includes('FROM messages')) {
            const conversationId = bound[0] as string;
            return { results: state.messages.filter((m) => m.conversation_id === conversationId) };
          }
          return { results: [] };
        },
        async first() {
          if (sql.includes('FROM conversations')) {
            if (sql.includes('WHERE id = ? AND user_id = ?')) {
              const [id, userId] = bound as [string, string];
              return state.conversations.find((c) => c.id === id && c.user_id === userId) ?? null;
            }
            const [id] = bound as [string];
            return state.conversations.find((c) => c.id === id) ?? null;
          }
          return null;
        },
        async run() {
          if (sql.startsWith('INSERT INTO conversations')) {
            const [id, user_id, title, model_id, preview, created_at, updated_at] = bound as [
              string, string, string, string | null, string, number, number,
            ];
            state.conversations.push({ id, user_id, title, model_id, preview, created_at, updated_at, archived: 0 });
            return { meta: { changes: 1 } };
          }
          if (sql.startsWith('INSERT INTO messages')) {
            const [id, conversation_id, role, content, model_id, provider_id, created_at] = bound as [
              string, string, string, string, string | null, string | null, number,
            ];
            state.messages.push({ id, conversation_id, role, content, model_id, provider_id, created_at });
            return { meta: { changes: 1 } };
          }
          if (sql.startsWith('UPDATE conversations SET title')) {
            const [title, id] = bound as [string, string];
            const row = state.conversations.find((c) => c.id === id);
            if (row) row.title = title;
            return { meta: { changes: row ? 1 : 0 } };
          }
          if (sql.startsWith('UPDATE conversations SET preview')) {
            const [preview, updated_at, id] = bound as [string, number, string];
            const row = state.conversations.find((c) => c.id === id);
            if (row) { row.preview = preview; row.updated_at = updated_at; }
            return { meta: { changes: row ? 1 : 0 } };
          }
          if (sql.startsWith('DELETE FROM messages')) {
            const [conversationId] = bound as [string];
            state.messages = state.messages.filter((m) => m.conversation_id !== conversationId);
            return { meta: { changes: 1 } };
          }
          if (sql.startsWith('DELETE FROM conversations')) {
            const [id] = bound as [string];
            state.conversations = state.conversations.filter((c) => c.id !== id);
            return { meta: { changes: 1 } };
          }
          return { meta: { changes: 0 } };
        },
      };
      return api;
    },
  } as unknown as D1Database;

  const CACHE = {
    async get(key: string) {
      return kv.get(key) ?? null;
    },
    async put(key: string, value: string) {
      kv.set(key, value);
    },
    async delete(key: string) {
      kv.delete(key);
    },
  } as unknown as KVNamespace;

  return { env: { DB, CACHE, ACCOUNTS_API_URL: 'https://api.bansify.com' }, state };
}

/** Stubs the Accounts userinfo call for the duration of one test. */
function stubAccounts(body: Record<string, unknown> | null, status = 200): () => void {
  const original = globalThis.fetch;
  globalThis.fetch = (async () =>
    new Response(body ? JSON.stringify(body) : 'null', {
      status,
      headers: { 'Content-Type': 'application/json' },
    })) as typeof fetch;
  return () => {
    globalThis.fetch = original;
  };
}

const USERINFO = {
  sub: 'user_123',
  preferred_username: 'pawan',
  email: 'pawan@bansify.com',
  name: 'Pawan Gothwad',
  client_id: 'gothwad-ai',
  scopes: ['profile', 'email', 'offline_access'],
};

function authedRequest(path: string, init: RequestInit = {}): Request {
  return new Request(`https://worker.test${path}`, {
    ...init,
    headers: { Authorization: 'Bearer access_token_abc', ...(init.headers as Record<string, string>) },
  });
}

test('GET /v1/me without a bearer token is unauthenticated', async () => {
  const { env } = createMockEnv();
  const res = await handleRequest(new Request('https://worker.test/v1/me'), env);
  assert.equal(res.status, 401);
  const body = (await res.json()) as { authenticated: boolean };
  assert.equal(body.authenticated, false);
});

test('GET /v1/me resolves a Bansify Accounts token', async () => {
  const { env } = createMockEnv();
  const restore = stubAccounts(USERINFO);
  try {
    const res = await handleRequest(authedRequest('/v1/me'), env);
    assert.equal(res.status, 200);
    const body = (await res.json()) as { authenticated: boolean; user: { id: string; username: string } };
    assert.equal(body.authenticated, true);
    assert.equal(body.user.id, 'user_123');
    assert.equal(body.user.username, 'pawan');
  } finally {
    restore();
  }
});

test('a token minted for another Bansify app is refused', async () => {
  const { env } = createMockEnv();
  const restore = stubAccounts({ ...USERINFO, client_id: 'gothwad-mail' });
  try {
    const res = await handleRequest(authedRequest('/v1/me'), env);
    assert.equal(res.status, 401);
  } finally {
    restore();
  }
});

test('conversation routes require a signed-in Bansify Account', async () => {
  const { env } = createMockEnv();
  const res = await handleRequest(new Request('https://worker.test/v1/conversations'), env);
  assert.equal(res.status, 401);
  const body = (await res.json()) as { code: string };
  assert.equal(body.code, 'auth_required');
});

test('a conversation is created, listed and deleted for its own user only', async () => {
  const { env, state } = createMockEnv();
  const restore = stubAccounts(USERINFO);
  try {
    const created = await handleRequest(
      authedRequest('/v1/conversations', {
        method: 'POST',
        body: JSON.stringify({ title: 'Sarvam test chat' }),
        headers: { 'Content-Type': 'application/json' },
      }),
      env
    );
    assert.equal(created.status, 201);
    const createdBody = (await created.json()) as { conversation: { id: string; title: string } };
    assert.equal(createdBody.conversation.title, 'Sarvam test chat');
    assert.equal(state.conversations.length, 1);
    assert.equal(state.conversations[0].user_id, 'user_123');

    const listed = await handleRequest(authedRequest('/v1/conversations'), env);
    assert.equal(listed.status, 200);
    const listedBody = (await listed.json()) as { conversations: Array<{ id: string }> };
    assert.equal(listedBody.conversations.length, 1);

    const removed = await handleRequest(
      authedRequest(`/v1/conversations/${createdBody.conversation.id}`, { method: 'DELETE' }),
      env
    );
    assert.equal(removed.status, 200);
    assert.equal(state.conversations.length, 0);
  } finally {
    restore();
  }
});

test('another account cannot read a conversation by id', async () => {
  const { env, state } = createMockEnv();
  state.conversations.push({
    id: 'conv_owned_by_someone_else',
    user_id: 'user_999',
    title: 'Private',
    model_id: null,
    preview: '',
    created_at: 1,
    updated_at: 1,
    archived: 0,
  });
  const restore = stubAccounts(USERINFO);
  try {
    const res = await handleRequest(authedRequest('/v1/conversations/conv_owned_by_someone_else'), env);
    assert.equal(res.status, 404);
  } finally {
    restore();
  }
});

test('Sarvam is called with both auth headers and streams OpenAI-shaped deltas', async () => {
  const original = globalThis.fetch;
  let seen: { url: string; headers: Record<string, string> } | null = null;
  globalThis.fetch = (async (url: string, init: RequestInit) => {
    seen = { url: String(url), headers: init.headers as Record<string, string> };
    const sse =
      'data: {"choices":[{"delta":{"content":"Namaste"}}]}\n\n' +
      'data: {"choices":[{"delta":{"content":" ji"}}]}\n\n' +
      'data: [DONE]\n\n';
    return new Response(sse, { status: 200, headers: { 'Content-Type': 'text/event-stream' } });
  }) as typeof fetch;

  try {
    let full = '';
    const stream = await openProviderStream({
      provider: {
        id: 'sarvam',
        name: 'Sarvam AI',
        base_url: 'https://api.sarvam.ai/v1',
        key_env_name: 'SARVAM_API_KEY',
        free_tier_json: '{"daily_requests":100000}',
        priority: 120,
        status: 'healthy',
        last_checked: 0,
      },
      modelId: 'sarvam-105b',
      systemPrompt: 'You are Bansify AI.',
      messages: [{ role: 'user', content: 'Hi' }],
      env: { SARVAM_API_KEY: 'sk_test' } as Env,
      onComplete: (text) => { full = text; },
    });

    const reader = stream.getReader();
    let out = '';
    const decoder = new TextDecoder();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      out += decoder.decode(value, { stream: true });
    }
    assert.ok(out.includes('Namaste'));
    assert.equal(full, 'Namaste ji');
    assert.ok(seen, 'fetch was called');
    const captured = seen as { url: string; headers: Record<string, string> };
    assert.equal(captured.url, 'https://api.sarvam.ai/v1/chat/completions');
    assert.equal(captured.headers['api-subscription-key'], 'sk_test');
    assert.equal(captured.headers.Authorization, 'Bearer sk_test');
  } finally {
    globalThis.fetch = original;
  }
});

test('the /api route prefix is stripped, so ai.bansify.com/api/v1/* hits the same routes', async () => {
  const { env } = createMockEnv();
  const res = await handleRequest(new Request('https://ai.bansify.com/api/v1/health'), env);
  assert.equal(res.status, 200);
  const body = (await res.json()) as { ok: boolean };
  assert.equal(body.ok, true);

  // A lookalike prefix must NOT be treated as the API root.
  const other = await handleRequest(new Request('https://ai.bansify.com/apix/v1/health'), env);
  assert.equal(other.status, 404);
});
