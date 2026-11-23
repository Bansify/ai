const WORKER_BASE = (import.meta as unknown as { env?: Record<string, string> }).env?.VITE_WORKER_URL || 'http://127.0.0.1:8787';

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

export async function fetchModels(): Promise<WorkerModel[]> {
  const res = await fetch(`${WORKER_BASE}/v1/models`);
  if (!res.ok) throw new Error('Failed to load models');
  const data = (await res.json()) as { models: WorkerModel[] };
  return data.models ?? [];
}

export async function fetchProviders(): Promise<WorkerProvider[]> {
  const res = await fetch(`${WORKER_BASE}/v1/providers`);
  if (!res.ok) throw new Error('Failed to load providers');
  const data = (await res.json()) as { providers: WorkerProvider[] };
  return data.providers ?? [];
}

export async function streamChat(params: {
  messages: ChatMsg[];
  model?: string;
  signal?: AbortSignal;
  onDelta: (delta: string) => void;
  onMeta?: (meta: { cached: boolean; provider?: string; model?: string }) => void;
}): Promise<void> {
  const res = await fetch(`${WORKER_BASE}/v1/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages: params.messages, model: params.model }),
    signal: params.signal,
  });

  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string; reset_at?: string };
    throw new Error(err.error || `Request failed (${res.status})`);
  }

  params.onMeta?.({
    cached: res.headers.get('x-cache') === 'hit',
    provider: res.headers.get('x-provider') ?? undefined,
    model: res.headers.get('x-model') ?? undefined,
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
