import React, { useEffect, useRef, useState } from 'react';
import { Plus, Send, Square } from 'lucide-react';
import {
  ChatMsg,
  getConversation,
  listConversations,
  streamChat,
} from '../../../services/workerClient';

interface UiMessage extends ChatMsg {
  id: string;
  cached?: boolean;
}

export default function ChatV2({ selectedModel }: { selectedModel?: string }) {
  const [messages, setMessages] = useState<UiMessage[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // History lives on the account (worker D1), so opening the site on a new
  // device shows the same thread the Android app has.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await listConversations();
        if (cancelled || list.length === 0) return;
        const detail = await getConversation(list[0].id);
        if (cancelled) return;
        setConversationId(detail.conversation.id);
        setMessages(
          detail.messages.map((m) => ({ id: m.id, role: m.role, content: m.content }))
        );
      } catch {
        // Signed out, offline, or the worker is mid-deploy: start with an empty chat.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const startNewChat = () => {
    abortRef.current?.abort();
    setMessages([]);
    setError(null);
    setConversationId(null);
  };

  const handleSend = async () => {
    const text = input.trim();
    if (!text || streaming) return;

    setError(null);
    const userMsg: UiMessage = { id: crypto.randomUUID(), role: 'user', content: text };
    const assistantId = crypto.randomUUID();
    const nextHistory = [...messages, userMsg];

    setMessages([...nextHistory, { id: assistantId, role: 'assistant', content: '' }]);
    setInput('');
    setStreaming(true);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      await streamChat({
        messages: nextHistory.map(({ role, content }) => ({ role, content })),
        model: selectedModel,
        conversationId,
        conversationTitle: nextHistory[0]?.content,
        signal: controller.signal,
        onMeta: (meta) => {
          if (meta.conversationId && meta.conversationId !== conversationId) {
            setConversationId(meta.conversationId);
          }
          if (meta.cached) {
            setMessages((prev) => prev.map((m) => (m.id === assistantId ? { ...m, cached: true } : m)));
          }
        },
        onDelta: (delta) => {
          setMessages((prev) =>
            prev.map((m) => (m.id === assistantId ? { ...m, content: m.content + delta } : m))
          );
        },
      });
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        const code = (err as Error & { code?: string }).code;
        setError(
          code === 'auth_required'
            ? 'Bansify Account se sign in karo, phir dobara bhejo.'
            : (err as Error).message || 'Something went wrong'
        );
      }
    } finally {
      setStreaming(false);
      abortRef.current = null;
    }
  };

  const handleStop = () => {
    abortRef.current?.abort();
    setStreaming(false);
  };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100">
      <div className="flex items-center justify-between px-4 py-2 border-b border-zinc-200 dark:border-zinc-800">
        <span className="text-sm font-medium text-zinc-500">
          {conversationId ? 'Chat' : 'New chat'}
        </span>
        <button
          onClick={startNewChat}
          aria-label="New chat"
          className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-full border border-zinc-300 dark:border-zinc-700 hover:border-[#2F6BFF] hover:text-[#2F6BFF]"
        >
          <Plus className="w-4 h-4" />
          New chat
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-6">
        {messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-center px-4">
            <div
              className="w-12 h-12 rounded-2xl mb-3 flex items-center justify-center text-white font-semibold text-xl"
              style={{ background: 'linear-gradient(135deg, #2F6BFF, #7A5CFF)' }}
            >
              B
            </div>
            <h2 className="text-xl font-semibold">Bansify AI</h2>
            <p className="text-sm text-zinc-500 mt-1">Ask anything in English or Hinglish.</p>
          </div>
        )}

        {messages.map((m) =>
          m.role === 'user' ? (
            <div key={m.id} className="flex justify-end">
              <div
                className="max-w-[85%] px-4 py-2.5 rounded-3xl text-white text-[16px] leading-[1.5]"
                style={{ backgroundColor: '#2F6BFF' }}
              >
                {m.content}
              </div>
            </div>
          ) : (
            <div key={m.id} className="w-full text-[16px] leading-[1.5] whitespace-pre-wrap">
              {m.content || (streaming ? '...' : '')}
              {m.cached && (
                <span className="ml-2 inline-block text-[11px] px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-500">
                  cached
                </span>
              )}
            </div>
          )
        )}

        {error && (
          <div className="p-3 rounded-xl text-sm text-white" style={{ backgroundColor: '#D93025' }}>
            {error}
          </div>
        )}
      </div>

      <div className="p-3 border-t border-zinc-200 dark:border-zinc-800">
        <div className="flex items-end gap-2 max-w-3xl mx-auto">
          <textarea
            rows={1}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                void handleSend();
              }
            }}
            placeholder="Message Bansify AI..."
            className="flex-1 resize-none rounded-2xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 px-4 py-2.5 text-[16px] focus:outline-none focus:border-[#2F6BFF]"
          />
          {streaming ? (
            <button
              onClick={handleStop}
              aria-label="Stop"
              className="p-3 rounded-full text-white transition-transform duration-150"
              style={{ backgroundColor: '#D93025' }}
            >
              <Square className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={() => void handleSend()}
              disabled={!input.trim()}
              aria-label="Send"
              className="p-3 rounded-full text-white disabled:opacity-40 transition-transform duration-150"
              style={{ backgroundColor: '#2F6BFF' }}
            >
              <Send className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
