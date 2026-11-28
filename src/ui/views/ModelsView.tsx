import React, { useEffect, useMemo, useState } from 'react';
import { Cpu, Check } from 'lucide-react';
import { fetchModels, fetchProviders, type WorkerModel, type WorkerProvider } from '../../services/workerClient';

const PROVIDER_NAMES: Record<string, string> = {
  groq: 'Groq',
  gemini: 'Google Gemini',
  'cloudflare-ai': 'Cloudflare Workers AI',
  zai: 'Z.ai GLM',
  openrouter: 'OpenRouter',
  sambanova: 'SambaNova',
  sarvam: 'Sarvam AI',
};

/** The live catalogue from the Worker: providers, their quota, and every model. */
const ModelsView: React.FC<{ selected?: string; onSelect: (id: string | undefined) => void }> = ({ selected, onSelect }) => {
  const [models, setModels] = useState<WorkerModel[]>([]);
  const [providers, setProviders] = useState<WorkerProvider[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [m, p] = await Promise.all([fetchModels(), fetchProviders()]);
        if (!cancelled) {
          setModels(m);
          setProviders(p);
        }
      } catch {
        if (!cancelled) setError('Could not load the model catalogue.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const groups = useMemo(() => {
    const byProvider = new Map<string, WorkerModel[]>();
    for (const m of models) {
      const list = byProvider.get(m.provider_id) ?? [];
      list.push(m);
      byProvider.set(m.provider_id, list);
    }
    return Array.from(byProvider.entries());
  }, [models]);

  const providerById = useMemo(() => new Map(providers.map((p) => [p.id, p])), [providers]);

  return (
    <div className="h-full overflow-y-auto p-4 space-y-4">
      <div className="flex items-center gap-2">
        <Cpu className="w-4 h-4 text-[#0494f4]" strokeWidth={1.75} />
        <p className="text-[13px] font-semibold">Model catalogue</p>
        <button
          type="button"
          onClick={() => onSelect(undefined)}
          className={`ml-auto rounded-full px-3 py-1.5 text-[12px] font-semibold border transition ${
            !selected ? 'border-[#0494f4] text-[#0494f4]' : 'border-neutral-200 dark:border-[#333333] hover:text-[#0494f4]'
          }`}
        >
          {!selected && <Check className="inline w-3 h-3 mr-1" strokeWidth={2} />}Auto — best free
        </button>
      </div>

      {error && <p className="text-[12px] text-red-500">{error}</p>}
      {loading && <p className="text-[13px] text-zinc-500">Loading the catalogue…</p>}

      {groups.map(([providerId, list]) => {
        const provider = providerById.get(providerId);
        return (
          <section key={providerId} className="rounded-2xl border border-neutral-200 dark:border-[#333333] overflow-hidden">
            <header className="flex flex-wrap items-center gap-2 px-4 py-3 border-b border-neutral-200 dark:border-[#333333]">
              <span className="text-[13px] font-semibold">{PROVIDER_NAMES[providerId] ?? providerId}</span>
              {provider && (
                <span className="text-[11px] text-zinc-500">
                  {provider.status} · {provider.remaining_today}/{provider.daily_limit} left today
                </span>
              )}
            </header>
            <div className="divide-y divide-neutral-200 dark:divide-[#333333]">
              {list.map((m) => {
                const active = selected === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => onSelect(m.id)}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition ${
                      active ? 'bg-[#0494f4]/10' : 'hover:bg-zinc-50 dark:hover:bg-[#303030]'
                    }`}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block text-[13px] font-medium truncate">{m.display_name}</span>
                      <span className="block text-[11px] text-zinc-500">
                        {m.context_len ? `${Math.round(m.context_len / 1000)}k context` : 'context unknown'}
                        {m.speed_class ? ` · ${m.speed_class}` : ''}
                        {m.is_free ? '' : ' · paid'}
                      </span>
                    </span>
                    {active && <Check className="w-4 h-4 text-[#0494f4]" strokeWidth={2} />}
                  </button>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
};

export default ModelsView;
