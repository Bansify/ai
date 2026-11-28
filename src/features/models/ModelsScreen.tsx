import React, { useEffect, useState } from 'react';
import { fetchModels, fetchProviders, WorkerModel, WorkerProvider } from '../../services/workerClient';

export default function ModelsScreen({
  selectedModel,
  onSelectModel,
}: {
  selectedModel?: string;
  onSelectModel?: (modelId: string) => void;
}) {
  const [models, setModels] = useState<WorkerModel[]>([]);
  const [providers, setProviders] = useState<WorkerProvider[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([fetchModels(), fetchProviders()])
      .then(([m, p]) => {
        setModels(m);
        setProviders(p);
      })
      .catch((e) => setError((e as Error).message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="p-4 text-sm text-zinc-500">Loading models...</div>;
  if (error) return <div className="p-4 text-sm text-[#D93025]">{error}</div>;

  return (
    <div className="p-4 space-y-6 overflow-y-auto h-full">
      {providers.map((p) => {
        const pModels = models.filter((m) => m.provider_id === p.id);
        const healthy = p.status === 'healthy';
        return (
          <div key={p.id} className="rounded-2xl border border-neutral-200 dark:border-zinc-800 p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span
                  className="w-2.5 h-2.5 rounded-full"
                  style={{ backgroundColor: healthy ? '#12A150' : '#E8A100' }}
                />
                <h3 className="font-semibold text-base">{p.name}</h3>
              </div>
              <span className="text-xs px-2.5 py-1 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300">
                {p.remaining_today}/{p.daily_limit} left
              </span>
            </div>

            <div className="space-y-2">
              {pModels.map((m) => (
                <button
                  key={m.id}
                  onClick={() => onSelectModel?.(m.id)}
                  className={`w-full text-left p-3 rounded-xl border transition-colors ${
                    selectedModel === m.id
                      ? 'border-[#2F6BFF] bg-[#2F6BFF]/5'
                      : 'border-neutral-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-900'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-sm">{m.display_name}</span>
                    {m.is_free === 1 && (
                      <span
                        className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
                        style={{ color: '#0E7A4A', backgroundColor: '#E3F5EC' }}
                      >
                        FREE
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-zinc-500 mt-1 flex gap-3">
                    <span>{Math.round(m.context_len / 1024)}k ctx</span>
                    <span>{m.speed_class}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
