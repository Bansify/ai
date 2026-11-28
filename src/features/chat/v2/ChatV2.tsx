import React, { useEffect, useRef, useState } from 'react';
import { ArrowUp, Plus, Square } from 'lucide-react';
import {
  ChatMsg,
  getConversation,
  listConversations,
  streamChat,
} from '../../../services/workerClient';

interface UiMessage extends ChatMsg {
  id: string;
  cached?: boolean;
  /** Which provider actually answered — visible so switching is not a guess. */
  via?: string;
}

const SUGGESTIONS = [
  { title: 'Explain this code', body: 'Paste a snippet and ask what it does.', prompt: 'Explain what this code does, step by step:\n\n' },
  { title: 'Write it better', body: 'Turn rough notes into clean writing.', prompt: 'Rewrite the following notes as a clear, well-structured paragraph:\n\n' },
  { title: 'Plan my week', body: 'Break a goal into small steps.', prompt: 'Help me plan my week. My main goal is ' },
  { title: 'Debug an error', body: 'Describe a failure, find the cause.', prompt: 'Here is an error I am seeing. Help me find the root cause:\n\n' },
];

export default function ChatV2({ selectedModel }: { selectedModel?: string }) {
  const [messages, setMessages] = useState<UiMessage[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

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

  // Keep the newest turn in view while it streams.
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' });
  }, [messages]);

  // Grow the composer with the text, up to a cap.
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, [input]);

  const startNewChat = () => {
    abortRef.current?.abort();
    setMessages([]);
    setError(null);
    setConversationId(null);
    setInput('');
    inputRef.current?.focus();
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
          const via = [meta.provider, meta.model].filter(Boolean).join(' · ');
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId ? { ...m, cached: meta.cached, via: via || m.via } : m
            )
          );
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

  const usePrompt = (prompt: string) => {
    setInput(prompt);
    inputRef.current?.focus();
  };

  return (
    <div className="flex h-full flex-col bg-white text-zinc-900 dark:bg-[#212121] dark:text-zinc-100">
      {/* Slim header: thread state on the left, New chat on the right. */}
      <div className="flex shrink-0 items-center justify-between border-b border-zinc-200 px-4 py-2 dark:border-[#333333]">
        <span className="truncate text-[13px] font-medium text-zinc-500 dark:text-zinc-400">
          {conversationId ? 'Chat' : 'New chat'}
        </span>
        <button
          type="button"
          onClick={startNewChat}
          className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-semibold text-zinc-600 transition hover:bg-zinc-100 hover:text-[#0494f4] dark:text-zinc-300 dark:hover:bg-[#2a2a2a]"
        >
          <Plus className="h-3.5 w-3.5" strokeWidth={2} />
          New chat
        </button>
      </div>

      {/* Transcript */}
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-3xl px-4 py-6">
          {messages.length === 0 && (
            <div className="flex min-h-[45vh] flex-col justify-center">
              <div
                className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl text-lg font-semibold text-white"
                style={{ background: 'linear-gradient(135deg, #0494f4, #7c5cff)' }}
              >
                B
              </div>
              <h1 className="text-[26px] font-semibold leading-tight tracking-tight">
                Namaste 👋
              </h1>
              <p className="mt-1 text-[15px] text-zinc-500 dark:text-zinc-400">
                Kya jaanna hai? English, Hindi ya Hinglish — jis tarah likhoge, usi tarah jawab milega.
              </p>

              <div className="mt-6 grid grid-cols-1 gap-2 sm:grid-cols-2">
                {SUGGESTIONS.map((suggestion) => (
                  <button
                    key={suggestion.title}
                    type="button"
                    onClick={() => usePrompt(suggestion.prompt)}
                    className="rounded-2xl border border-zinc-200 p-3 text-left transition hover:border-[#0494f4]/40 hover:bg-[#0494f4]/[0.04] dark:border-[#333333] dark:hover:border-[#0494f4]/40 dark:hover:bg-[#2a2a2a]"
                  >
                    <span className="block text-[13px] font-semibold">{suggestion.title}</span>
                    <span className="mt-0.5 block text-[12px] text-zinc-500 dark:text-zinc-400">
                      {suggestion.body}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-7">
            {messages.map((message) =>
              message.role === 'user' ? (
                <div key={message.id} className="flex justify-end">
                  <div className="max-w-[85%] rounded-3xl bg-[#0494f4] px-4 py-2.5 text-[15px] leading-relaxed text-white">
                    {message.content}
                  </div>
                </div>
              ) : (
                <div key={message.id} className="w-full">
                  <div className="whitespace-pre-wrap text-[15.5px] leading-[1.7] text-zinc-800 dark:text-zinc-100">
                    {message.content}
                    {streaming && message === messages[messages.length - 1] && (
                      <span className="ml-0.5 inline-block h-[1.05em] w-[2px] translate-y-[3px] animate-pulse bg-[#0494f4] align-baseline" />
                    )}
                  </div>
                  {(message.via || message.cached) && (
                    <div className="mt-2 flex items-center gap-2 text-[11px] text-zinc-400">
                      {message.via && <span>{message.via}</span>}
                      {message.cached && (
                        <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-zinc-500 dark:bg-[#2a2a2a]">
                          cached
                        </span>
                      )}
                    </div>
                  )}
                </div>
              )
            )}
          </div>

          {error && (
            <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-3 text-[13px] text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300">
              {error}
            </div>
          )}

          <div ref={bottomRef} />
        </div>
      </div>

      {/* Composer: one rounded field with the action button inside, like Gemini. */}
      <div className="shrink-0 px-3 pb-3 pt-1">
        <div className="mx-auto w-full max-w-3xl">
          <div className="flex items-end gap-2 rounded-[26px] border border-zinc-200 bg-white px-3 py-2 shadow-sm transition focus-within:border-[#0494f4]/50 dark:border-[#333333] dark:bg-[#2a2a2a]">
            <textarea
              ref={inputRef}
              rows={1}
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault();
                  void handleSend();
                }
              }}
              placeholder="Message Bansify AI…"
              className="max-h-[200px] flex-1 resize-none bg-transparent py-1.5 text-[15.5px] leading-relaxed outline-none placeholder:text-zinc-400"
            />
            {streaming ? (
              <button
                type="button"
                onClick={handleStop}
                aria-label="Stop"
                className="mb-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-zinc-800 text-white dark:bg-zinc-100 dark:text-zinc-900"
              >
                <Square className="h-3.5 w-3.5" strokeWidth={2.5} />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => void handleSend()}
                disabled={!input.trim()}
                aria-label="Send"
                className="mb-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#0494f4] text-white transition disabled:bg-zinc-200 disabled:text-zinc-400 dark:disabled:bg-[#3a3a3a] dark:disabled:text-zinc-500"
              >
                <ArrowUp className="h-4 w-4" strokeWidth={2.5} />
              </button>
            )}
          </div>
          <p className="mt-2 text-center text-[11px] text-zinc-400">
            Bansify AI galat bhi ho sakta hai — zaroori baat verify kar lena.
          </p>
        </div>
      </div>
    </div>
  );
}
