import React, { useState } from 'react';
import { Code2, Cpu, MessageSquare, Plus, Settings } from 'lucide-react';
import ChatV2 from '../chat/v2/ChatV2';
import ModelsScreen from '../models/ModelsScreen';
import AccountCentre from './AccountCentre';
import MediaFilesCard, { SessionMediaItem } from './MediaFilesCard';

type Tab = 'chat' | 'models' | 'studio' | 'settings';

interface ChatSessionSummary {
  id: string;
  title: string;
}

export default function BansifyShell({ onSignOut }: { onSignOut?: () => void }) {
  const [tab, setTab] = useState<Tab>('chat');
  const [selectedModel, setSelectedModel] = useState<string | undefined>(undefined);
  const [sessions, setSessions] = useState<ChatSessionSummary[]>([
    { id: 'default', title: 'New Chat' },
  ]);
  const [activeSessionId, setActiveSessionId] = useState('default');
  const [mediaItems] = useState<SessionMediaItem[]>([]);

  const handleNewChat = () => {
    const id = crypto.randomUUID();
    setSessions((prev) => [{ id, title: `Chat ${prev.length + 1}` }, ...prev]);
    setActiveSessionId(id);
    setTab('chat');
  };

  const navItems: Array<{ id: Tab; label: string; icon: React.ReactNode }> = [
    { id: 'chat', label: 'Chat', icon: <MessageSquare className="w-4 h-4" /> },
    { id: 'models', label: 'Models', icon: <Cpu className="w-4 h-4" /> },
    { id: 'studio', label: 'Studio', icon: <Code2 className="w-4 h-4" /> },
    { id: 'settings', label: 'Settings', icon: <Settings className="w-4 h-4" /> },
  ];

  return (
    <div className="h-screen w-full flex flex-col lg:flex-row bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex flex-col w-64 shrink-0 border-r border-zinc-200/70 dark:border-zinc-800/80 bg-white dark:bg-zinc-950 p-3">
        <div className="flex items-center justify-between px-2 py-2 mb-3">
          <div className="flex items-center gap-2">
            <div
              className="w-8 h-8 rounded-xl flex items-center justify-center text-white font-bold text-sm"
              style={{ background: 'linear-gradient(135deg, #2F6BFF, #7A5CFF)' }}
            >
              B
            </div>
            <span className="font-semibold text-base">Bansify AI</span>
          </div>
          <button
            onClick={handleNewChat}
            aria-label="New Chat"
            className="p-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-900 text-zinc-600 dark:text-zinc-300"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>

        <nav className="space-y-1">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setTab(item.id)}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-medium transition-colors ${
                tab === item.id
                  ? 'bg-[#2F6BFF]/10 text-[#2F6BFF]'
                  : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-900'
              }`}
            >
              {item.icon}
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        {/* Recent Chats directly in sidebar (no separate History tab) */}
        <div className="mt-6 flex-1 overflow-y-auto border-t border-zinc-200/70 dark:border-zinc-800/80 pt-3">
          <div className="px-2 pb-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
            Recent Chats
          </div>
          <div className="space-y-1">
            {sessions.map((s) => (
              <button
                key={s.id}
                onClick={() => {
                  setActiveSessionId(s.id);
                  setTab('chat');
                }}
                className={`w-full text-left px-3 py-2 rounded-xl text-xs truncate transition-colors ${
                  activeSessionId === s.id && tab === 'chat'
                    ? 'bg-zinc-100 dark:bg-zinc-900 font-medium text-zinc-900 dark:text-zinc-100'
                    : 'text-zinc-500 hover:bg-zinc-100/70 dark:hover:bg-zinc-900/70'
                }`}
              >
                {s.title}
              </button>
            ))}
          </div>
        </div>

        <div className="pt-3 border-t border-zinc-200/70 dark:border-zinc-800/80 flex items-center justify-between px-1">
          <AccountCentre onSignOut={onSignOut} />
          <span className="text-xs text-zinc-500">Account Centre</span>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 min-w-0 flex flex-col lg:p-3 lg:flex-row gap-3 overflow-hidden">
        <div className="flex-1 min-w-0 h-full lg:rounded-2xl lg:border border-zinc-200/70 dark:border-zinc-800/80 bg-white dark:bg-zinc-950 overflow-hidden">
          {tab === 'chat' && <ChatV2 key={activeSessionId} selectedModel={selectedModel} />}
          {tab === 'models' && (
            <ModelsScreen
              selectedModel={selectedModel}
              onSelectModel={(id) => {
                setSelectedModel(id);
                setTab('chat');
              }}
            />
          )}
          {tab === 'studio' && (
            <div className="p-6 text-sm text-zinc-500">Studio — Android parity pending.</div>
          )}
          {tab === 'settings' && (
            <div className="p-6 text-sm text-zinc-500">Settings — Android parity pending.</div>
          )}
        </div>

        {tab === 'chat' && <MediaFilesCard items={mediaItems} />}
      </main>

      {/* Mobile Bottom Nav */}
      <nav className="lg:hidden flex items-center justify-around border-t border-zinc-200/70 dark:border-zinc-800/80 bg-white dark:bg-zinc-950 py-2 px-2 shrink-0">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setTab(item.id)}
            className={`flex flex-col items-center gap-0.5 px-3 py-1 rounded-xl text-[11px] ${
              tab === item.id ? 'text-[#2F6BFF] font-medium' : 'text-zinc-500'
            }`}
          >
            {item.icon}
            <span>{item.label}</span>
          </button>
        ))}
        <AccountCentre onSignOut={onSignOut} />
      </nav>
    </div>
  );
}
