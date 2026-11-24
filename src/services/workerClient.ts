/**
 * Client for the Bansify AI Worker.
 *
 * The worker answers on `/api/*` of whatever host serves this app, so the default
 * base is RELATIVE: on ai.bansify.com the browser calls `https://ai.bansify.com/api/v1/chat`,
 * the Cloudflare route hands `/api/*` to the Worker, and the `.bansify.com`
 * session cookie rides along automatically — same-origin, so there is no CORS
 * preflight and no token to leak.
 *
 * `VITE_WORKER_URL` still overrides the base for a local Worker
 * (`http://127.0.0.1:8787`) or a separate host.
 */
const WORKER_BASE = (
  (import.meta as unknown as { env?: Record<string, string> }).env?.VITE_WORKER_URL || '/api'
).replace(/\/+$/, '');

/** The cookie session is what signs the website in, so every call sends it. */
const REQUEST_OPTIONS: RequestInit = { credentials: 'include' };

export interface WorkerModel {
  id: string;
  provider_id: string;
  model_id: string;
  display_name: string;
  context_len: number;
  speed_class: string;
  is_free: number;
}

export interface WorkerProvider {
  id: string;
  name: string;
  status: string;
  priority: number;
  daily_limit: number;
  used_today: number;
  remaining_today: number;
}

export interface ChatMsg {
  role: 'user' | 'assistant';
  content: string;
}

export interface RemoteConversation {
  id: string;
  title: string;
  preview: string;
  model_id: string | null;
  created_at: number;
  updated_at: number;
}

export interface RemoteMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: number;
}

export interface MeResult {
  authenticated: boolean;
  user?: { id: string; username: string; email?: string | null; name?: string | null };
  limits?: { daily_requests: number };
  reset_at?: string;
}

async function readError(res: Response): Promise<Error> {
  const body = (await res.json().catch(() => ({}))) as { error?: string; code?: string };
  const error = new Error(body.error || `Request failed (${res.status})`);
  (error as Error & { status?: number; code?: string }).status = res.status;
  (error as Error & { status?: number; code?: string }).code =
    body.code ?? (res.status === 401 ? 'auth_required' : res.status === 429 ? 'quota_exhausted' : undefined);
  return error;
}

/** Who is signed in? Returns null instead of throwing when nobody is. */
export async function fetchMe(): Promise<MeResult | null> {
  const res = await fetch(`${WORKER_BASE}/v1/me`, { ...REQUEST_OPTIONS, headers: { Accept: 'application/json' } });
  if (res.status === 401) return null;
  if (!res.ok) throw await readError(res);
  return (await res.json()) as MeResult;
}

export async function fetchModels(): Promise<WorkerModel[]> {
  const res = await fetch(`${WORKER_BASE}/v1/models`, { ...REQUEST_OPTIONS, headers: { Accept: 'application/json' } });
  if (!res.ok) throw await readError(res);
  const data = (await res.json()) as { models: WorkerModel[] };
  return data.models ?? [];
}

export async function fetchProviders(): Promise<WorkerProvider[]> {
  const res = await fetch(`${WORKER_BASE}/v1/providers`, { ...REQUEST_OPTIONS, headers: { Accept: 'application/json' } });
  if (!res.ok) throw await readError(res);
  const data = (await res.json()) as { providers: WorkerProvider[] };
  return data.providers ?? [];
}

// --- Conversation sync -------------------------------------------------------
// History lives in the worker's D1 database, so the website and the Android app
// show the same threads for the same account.

export async function listConversations(): Promise<RemoteConversation[]> {
  const res = await fetch(`${WORKER_BASE}/v1/conversations`, { ...REQUEST_OPTIONS, headers: { Accept: 'application/json' } });
  if (!res.ok) throw await readError(res);
  const data = (await res.json()) as { conversations: RemoteConversation[] };
  return data.conversations ?? [];
}

export async function getConversation(
  id: string
): Promise<{ conversation: RemoteConversation; messages: RemoteMessage[] }> {
  const res = await fetch(`${WORKER_BASE}/v1/conversations/${encodeURIComponent(id)}`, {
    ...REQUEST_OPTIONS,
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) throw await readError(res);
  return (await res.json()) as { conversation: RemoteConversation; messages: RemoteMessage[] };
}

export async function renameConversation(id: string, title: string): Promise<void> {
  const res = await fetch(`${WORKER_BASE}/v1/conversations/${encodeURIComponent(id)}`, {
    ...REQUEST_OPTIONS,
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title }),
  });
  if (!res.ok) throw await readError(res);
}

export async function deleteConversation(id: string): Promise<void> {
  const res = await fetch(`${WORKER_BASE}/v1/conversations/${encodeURIComponent(id)}`, {
    ...REQUEST_OPTIONS,
    method: 'DELETE',
  });
  if (!res.ok) throw await readError(res);
}

export async function streamChat(params: {
  messages: ChatMsg[];
  model?: string;
  conversationId?: string | null;
  conversationTitle?: string;
  style?: 'concise' | 'detailed' | 'hinglish';
  signal?: AbortSignal;
  onDelta: (delta: string) => void;
  onMeta?: (meta: { cached: boolean; provider?: string; model?: string; conversationId?: string | null }) => void;
}): Promise<void> {
  const res = await fetch(`${WORKER_BASE}/v1/chat`, {
    ...REQUEST_OPTIONS,
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messages: params.messages,
      model: params.model,
      style: params.style,
      conversation_id: params.conversationId ?? undefined,
      conversation_title: params.conversationTitle,
    }),
    signal: params.signal,
  });

  if (!res.ok) throw await readError(res);

  params.onMeta?.({
    cached: res.headers.get('x-cache') === 'hit',
    provider: res.headers.get('x-provider') ?? undefined,
    model: res.headers.get('x-model') ?? undefined,
    conversationId: res.headers.get('x-conversation-id') ?? params.conversationId ?? null,
  });

  if (!res.body) throw new Error('Empty response stream');
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

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
      if (payload === '[DONE]') return;
      try {
        const parsed = JSON.parse(payload) as { delta?: string };
        if (parsed.delta) params.onDelta(parsed.delta);
      } catch {
        // Ignore partial JSON chunk
      }
    }
  }
}
