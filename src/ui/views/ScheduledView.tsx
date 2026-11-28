import React, { useState } from 'react';
import { CalendarClock, Plus, Trash2, Info } from 'lucide-react';

interface QueuedPrompt {
  id: string;
  prompt: string;
  runAt: string;
}

const KEY = 'bansify-ai-scheduled';

function load(): QueuedPrompt[] {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? (JSON.parse(raw) as QueuedPrompt[]) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Prompts queued on this device. The Worker has no schedules API yet, so the queue is
 * local and runs when you open the app — no server state is implied.
 */
const ScheduledView: React.FC<{ onRun: (prompt: string) => void }> = ({ onRun }) => {
  const [items, setItems] = useState<QueuedPrompt[]>(() => load());
  const [prompt, setPrompt] = useState('');
  const [runAt, setRunAt] = useState('');

  const save = (next: QueuedPrompt[]) => {
    setItems(next);
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      /* storage disabled */
    }
  };

  const add = () => {
    if (!prompt.trim()) return;
    save([...items, { id: `s-${Date.now()}`, prompt: prompt.trim(), runAt: runAt || new Date().toISOString().slice(0, 16) }]);
    setPrompt('');
    setRunAt('');
  };

  return (
    <div className="h-full overflow-y-auto p-4 space-y-4">
      <div className="flex items-center gap-2">
        <CalendarClock className="w-4 h-4 text-[#0494f4]" strokeWidth={1.75} />
        <p className="text-[13px] font-semibold">Scheduled prompts</p>
      </div>

      <p className="flex items-start gap-2 rounded-xl bg-zinc-50 dark:bg-[#303030] p-3 text-[12px] text-zinc-500">
        <Info className="w-4 h-4 shrink-0" strokeWidth={1.75} />
        The queue lives on this device. It runs when you open Bansify AI; nothing is sent to a
        server while the app is closed.
      </p>

      <div className="rounded-2xl border border-zinc-200 dark:border-[#333333] p-3 space-y-2">
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Prompt to queue"
          rows={2}
          className="w-full rounded-lg border border-zinc-200 dark:border-[#333333] bg-transparent px-3 py-2 text-[13px] outline-none resize-y"
        />
        <div className="flex items-center gap-2">
          <input
            type="datetime-local"
            value={runAt}
            onChange={(e) => setRunAt(e.target.value)}
            className="rounded-lg border border-zinc-200 dark:border-[#333333] bg-transparent px-3 py-2 text-[12px] outline-none"
          />
          <button
            type="button"
            onClick={add}
            className="inline-flex items-center gap-1.5 rounded-full bg-[#0494f4] px-4 py-2 text-[12px] font-semibold text-white hover:bg-[#0382d6]"
          >
            <Plus className="w-3.5 h-3.5" strokeWidth={2} /> Queue
          </button>
        </div>
      </div>

      <div className="divide-y divide-zinc-200 dark:divide-[#333333] rounded-2xl border border-zinc-200 dark:border-[#333333] overflow-hidden">
        {items.length === 0 && <p className="px-4 py-3 text-[13px] text-zinc-500">Nothing queued.</p>}
        {items.map((item) => (
          <div key={item.id} className="flex items-center gap-3 px-4 py-3">
            <div className="min-w-0 flex-1">
              <p className="text-[13px] truncate">{item.prompt}</p>
              <p className="text-[11px] text-zinc-500">{item.runAt}</p>
            </div>
            <button
              type="button"
              onClick={() => onRun(item.prompt)}
              className="rounded-full border border-zinc-200 dark:border-[#333333] px-3 py-1.5 text-[12px] font-semibold hover:border-[#0494f4]/40 hover:text-[#0494f4]"
            >
              Run now
            </button>
            <button
              type="button"
              onClick={() => save(items.filter((i) => i.id !== item.id))}
              title="Remove"
              aria-label="Remove queued prompt"
              className="w-7 h-7 rounded-lg flex items-center justify-center text-zinc-400 hover:text-red-500 hover:bg-zinc-100 dark:hover:bg-[#333333]"
            >
              <Trash2 className="w-4 h-4" strokeWidth={1.75} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ScheduledView;
