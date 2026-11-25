import React, { useMemo, useState } from 'react';
import { Library, Plus, Trash2 } from 'lucide-react';

export interface PromptTemplate {
  id: string;
  title: string;
  prompt: string;
}

const KEY = 'bansify-ai-prompt-library';

const DEFAULTS: PromptTemplate[] = [
  { id: 'explain', title: 'Explain a codebase', prompt: 'Explain the structure of this project and where the main entry points are.' },
  { id: 'rewrite', title: 'Rewrite for clarity', prompt: 'Rewrite the text below so it is clear, short and easy to follow.' },
  { id: 'debug', title: 'Find the root cause', prompt: 'Here is an error. Walk me through the root cause step by step.' },
  { id: 'plan', title: 'Plan a launch', prompt: 'Help me plan a one-week launch for a small product.' },
  { id: 'review', title: 'Review this diff', prompt: 'Review this change for bugs, edge cases and readability.' },
];

function load(): PromptTemplate[] {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? (JSON.parse(raw) as PromptTemplate[]) : null;
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : DEFAULTS;
  } catch {
    return DEFAULTS;
  }
}

/** Prompt templates saved on this device, ready to send into a chat. */
const LibraryView: React.FC<{ onUse: (prompt: string) => void }> = ({ onUse }) => {
  const [items, setItems] = useState<PromptTemplate[]>(() => load());
  const [title, setTitle] = useState('');
  const [prompt, setPrompt] = useState('');

  const save = (next: PromptTemplate[]) => {
    setItems(next);
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      /* storage disabled — the list simply resets next time */
    }
  };

  const add = () => {
    if (!prompt.trim()) return;
    save([{ id: `p-${Date.now()}`, title: title.trim() || prompt.trim().slice(0, 40), prompt: prompt.trim() }, ...items]);
    setTitle('');
    setPrompt('');
  };

  const count = useMemo(() => items.length, [items]);

  return (
    <div className="h-full overflow-y-auto p-4 space-y-4">
      <div className="flex items-center gap-2">
        <Library className="w-4 h-4 text-[#0494f4]" strokeWidth={1.75} />
        <p className="text-[13px] font-semibold">Prompt library</p>
        <span className="text-[11px] text-zinc-500">{count} saved</span>
      </div>

      <div className="rounded-2xl border border-zinc-200 dark:border-[#333333] p-3 space-y-2">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Title"
          className="w-full rounded-lg border border-zinc-200 dark:border-[#333333] bg-transparent px-3 py-2 text-[13px] outline-none"
        />
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Prompt"
          rows={3}
          className="w-full rounded-lg border border-zinc-200 dark:border-[#333333] bg-transparent px-3 py-2 text-[13px] outline-none resize-y"
        />
        <button
          type="button"
          onClick={add}
          className="inline-flex items-center gap-1.5 rounded-full bg-[#0494f4] px-4 py-2 text-[12px] font-semibold text-white hover:bg-[#0382d6]"
        >
          <Plus className="w-3.5 h-3.5" strokeWidth={2} /> Save prompt
        </button>
      </div>

      <div className="divide-y divide-zinc-200 dark:divide-[#333333] rounded-2xl border border-zinc-200 dark:border-[#333333] overflow-hidden">
        {items.map((item) => (
          <div key={item.id} className="flex items-start gap-3 px-4 py-3">
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-medium truncate">{item.title}</p>
              <p className="text-[12px] text-zinc-500 line-clamp-2">{item.prompt}</p>
            </div>
            <button
              type="button"
              onClick={() => onUse(item.prompt)}
              className="rounded-full border border-zinc-200 dark:border-[#333333] px-3 py-1.5 text-[12px] font-semibold hover:border-[#0494f4]/40 hover:text-[#0494f4]"
            >
              Use
            </button>
            <button
              type="button"
              onClick={() => save(items.filter((i) => i.id !== item.id))}
              title="Delete"
              aria-label="Delete prompt"
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

export default LibraryView;
