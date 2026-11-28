import React, { useEffect, useMemo, useState } from 'react';
import { Trash2, MessageSquare, RefreshCw, Search } from 'lucide-react';
import {
  listConversations,
  getConversation,
  deleteConversation,
  type RemoteConversation,
  type RemoteMessage,
} from '../../services/workerClient';

/** Saved conversations from D1: search, read, resume and delete. */
const HistoryView: React.FC<{ onResume: (id: string) => void }> = ({ onResume }) => {
  const [items, setItems] = useState<RemoteConversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  const [messages, setMessages] = useState<RemoteMessage[]>([]);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      setItems(await listConversations());
    } catch {
      setError('Could not load your conversations.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? items.filter((c) => (c.title ?? '').toLowerCase().includes(q)) : items;
  }, [items, query]);

  const open = async (id: string) => {
    setOpenId(id);
    setMessages([]);
    try {
      const detail = await getConversation(id);
      setMessages(detail?.messages ?? []);
    } catch {
      setError('Could not open that conversation.');
    }
  };

  const remove = async (id: string) => {
    setItems((list) => list.filter((c) => c.id !== id));
    if (openId === id) setOpenId(null);
    try {
      await deleteConversation(id);
    } catch {
      setError('Could not delete that conversation.');
      void load();
    }
  };

  return (
    <div className="flex h-full min-h-0">
      <div className="flex w-1/2 min-w-0 flex-col border-r border-zinc-200 dark:border-[#333333]">
        <div className="flex items-center gap-2 h-12 px-4 shrink-0 border-b border-zinc-200 dark:border-[#333333]">
          <Search className="w-4 h-4 text-zinc-400" strokeWidth={1.75} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search conversations"
            className="flex-1 min-w-0 bg-transparent outline-none text-[13px] placeholder:text-zinc-400"
          />
          <button type="button" onClick={load} title="Refresh" aria-label="Refresh" className="text-zinc-400 hover:text-[#0494f4]">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} strokeWidth={1.75} />
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto divide-y divide-zinc-200 dark:divide-[#333333]">
          {error && <p className="p-4 text-[12px] text-red-500">{error}</p>}
          {!loading && filtered.length === 0 && !error && (
            <p className="p-4 text-[13px] text-zinc-500">No saved conversations yet.</p>
          )}
          {filtered.map((c) => (
            <div
              key={c.id}
              className={`group flex items-center gap-2 px-4 py-3 cursor-pointer ${
                openId === c.id ? 'bg-[#0494f4]/10' : 'hover:bg-zinc-50 dark:hover:bg-[#303030]'
              }`}
              onClick={() => void open(c.id)}
            >
              <MessageSquare className="w-4 h-4 text-zinc-400 shrink-0" strokeWidth={1.75} />
              <span className="min-w-0 flex-1">
                <span className="block text-[13px] font-medium truncate">{c.title || 'Untitled chat'}</span>
                <span className="block text-[11px] text-zinc-500 truncate">{c.updated_at ?? c.created_at ?? ''}</span>
              </span>
              <button
                type="button"
                title="Delete"
                aria-label="Delete conversation"
                onClick={(e) => {
                  e.stopPropagation();
                  void remove(c.id);
                }}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-zinc-400 hover:text-red-500 hover:bg-zinc-100 dark:hover:bg-[#333333]"
              >
                <Trash2 className="w-4 h-4" strokeWidth={1.75} />
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="flex-1 min-w-0 overflow-y-auto p-4">
        {!openId && <p className="text-[13px] text-zinc-500">Pick a conversation to read it.</p>}
        {openId && (
          <div className="space-y-3">
            {messages.map((m) => (
              <div key={m.id ?? `${m.role}-${m.created_at}`} className="rounded-xl bg-zinc-50 dark:bg-[#303030] p-3">
                <p className="text-[11px] font-bold uppercase tracking-wide text-zinc-500">{m.role}</p>
                <p className="mt-1 text-[13px] whitespace-pre-wrap">{m.content}</p>
              </div>
            ))}
            {messages.length === 0 && <p className="text-[13px] text-zinc-500">This conversation has no messages.</p>}
            <button
              type="button"
              onClick={() => onResume(openId)}
              className="rounded-full bg-[#0494f4] px-4 py-2 text-[12px] font-semibold text-white hover:bg-[#0382d6]"
            >
              Continue in Chat
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default HistoryView;
