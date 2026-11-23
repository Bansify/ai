import React, { useMemo, useState } from 'react';
import {
  MessageSquare,
  History,
  Cpu,
  FolderGit2,
  Library,
  CalendarClock,
  Settings,
  Plus,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Sun,
  Moon,
  Search,
  ArrowUpRight,
  Paperclip,
} from 'lucide-react';
import ChatV2 from '../features/chat/v2/ChatV2';

export interface ShellUser {
  name?: string;
  username?: string;
  email?: string;
  avatarUrl?: string | null;
}

type Section = 'chat' | 'history' | 'models' | 'studio' | 'library' | 'scheduled' | 'settings';

interface BansifyShellProps {
  user?: ShellUser | null;
  themeMode: string;
  onToggleTheme: () => void;
  onLogout?: () => void;
  accountHref: string;
  models?: string[];
}

const NAV: Array<{ id: Section; label: string; icon: React.ComponentType<{ className?: string; strokeWidth?: number }> }> = [
  { id: 'chat', label: 'Chat', icon: MessageSquare },
  { id: 'history', label: 'History', icon: History },
  { id: 'models', label: 'Models', icon: Cpu },
  { id: 'studio', label: 'Studio', icon: FolderGit2 },
  { id: 'library', label: 'Library', icon: Library },
  { id: 'scheduled', label: 'Scheduled', icon: CalendarClock },
];

const SUGGESTIONS = [
  { title: 'Explain a codebase', body: 'Paste a repo and ask how the pieces fit together.', prompt: 'Explain the structure of this project and where the main entry points are.' },
  { title: 'Write it better', body: 'Turn rough notes into a clean, readable draft.', prompt: 'Rewrite these notes as a clear, well-structured summary.' },
  { title: 'Debug with me', body: 'Describe a failure and work towards the cause.', prompt: 'Here is an error I am seeing. Help me find the root cause step by step.' },
  { title: 'Plan a launch', body: 'Break a big goal into a week of small steps.', prompt: 'Help me plan a one-week launch for a small product.' },
];

/** Clean chat-first workspace: sidebar, suggestion cards, soft gradients, brand blue. */
export const BansifyShell: React.FC<BansifyShellProps> = ({ user, themeMode, onToggleTheme, onLogout, accountHref, models }) => {
  const [section, setSection] = useState<Section>('chat');
  const [collapsed, setCollapsed] = useState(false);
  const [model, setModel] = useState<string | undefined>(undefined);
  const [query, setQuery] = useState('');
  const isDark = themeMode === 'dark';

  const displayName = user?.name || user?.username || 'Bansify user';
  const initial = displayName.slice(0, 1).toUpperCase();

  const title = useMemo(() => NAV.find((n) => n.id === section)?.label ?? 'Chat', [section]);

  const nav = (
    <nav className="px-2 space-y-0.5">
      {NAV.map((item) => {
        const Icon = item.icon;
        const active = section === item.id;
        return (
          <button
            key={item.id}
            type="button"
            title={item.label}
            aria-current={active ? 'page' : undefined}
            onClick={() => setSection(item.id)}
            className={`relative w-full flex items-center rounded-xl text-[13px] transition-colors cursor-pointer ${
              collapsed ? 'w-11 h-11 mx-auto justify-center' : 'gap-2.5 px-2.5 py-2'
            } ${
              active
                ? 'bg-[#0494f4]/12 text-[#0494f4] font-semibold'
                : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-[#2a2a2a]'
            }`}
          >
            {active && <span className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-full bg-[#0494f4]" />}
            <Icon className="w-[18px] h-[18px] shrink-0" strokeWidth={1.75} />
            {!collapsed && <span className="truncate">{item.label}</span>}
          </button>
        );
      })}
    </nav>
  );

  return (
    <div className="flex h-full w-full bg-white dark:bg-[#212121] text-zinc-900 dark:text-zinc-100">
      {/* Sidebar */}
      <aside
        className={`hidden md:flex shrink-0 flex-col border-r border-zinc-200 dark:border-[#333333] transition-[width] duration-200 ${
          collapsed ? 'w-[68px]' : 'w-64'
        }`}
      >
        <div className={`flex items-center h-14 shrink-0 ${collapsed ? 'justify-center px-0' : 'gap-2.5 px-4'}`}>
          <span className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#0494f4] to-[#7c5cff] text-white flex items-center justify-center shrink-0">
            <Sparkles className="w-[18px] h-[18px]" strokeWidth={1.75} />
          </span>
          {!collapsed && <span className="text-[17px] font-black tracking-tight">Bansify AI</span>}
          {!collapsed && (
            <button
              type="button"
              onClick={() => setCollapsed(true)}
              aria-label="Collapse sidebar"
              className="ml-auto w-7 h-7 rounded-lg flex items-center justify-center text-zinc-400 hover:bg-zinc-100 dark:hover:bg-[#2a2a2a] cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" strokeWidth={1.75} />
            </button>
          )}
        </div>
        {collapsed && (
          <div className="flex justify-center pb-2">
            <button
              type="button"
              onClick={() => setCollapsed(false)}
              aria-label="Expand sidebar"
              className="w-7 h-7 rounded-lg flex items-center justify-center text-zinc-400 hover:bg-zinc-100 dark:hover:bg-[#2a2a2a] cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" strokeWidth={1.75} />
            </button>
          </div>
        )}

        <div className={`pb-3 ${collapsed ? 'px-0 flex justify-center' : 'px-3'}`}>
          <button
            type="button"
            onClick={() => setSection('chat')}
            className={`flex items-center justify-center gap-2 rounded-xl bg-[#0494f4] hover:bg-[#0382d6] text-white font-semibold transition ${
              collapsed ? 'w-11 h-11' : 'w-full h-10 text-[13px]'
            }`}
          >
            <Plus className="w-[18px] h-[18px]" strokeWidth={2} />
            {!collapsed && <span>New chat</span>}
          </button>
        </div>

        {!collapsed && (
          <div className="px-3 pb-3">
            <div className="flex items-center gap-2 h-9 px-3 rounded-full border border-zinc-200 dark:border-[#333333] focus-within:border-[#0494f4]/40 transition">
              <Search className="w-4 h-4 text-zinc-400" strokeWidth={1.75} />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search chats"
                className="flex-1 min-w-0 bg-transparent outline-none text-[13px] placeholder:text-zinc-400"
              />
            </div>
          </div>
        )}

        {nav}

        <div className="mt-auto">
          <div className={`mx-3 h-px bg-zinc-200 dark:bg-[#333333] ${collapsed ? 'mx-2' : ''}`} />
          <div className={`flex items-center gap-1 py-2 ${collapsed ? 'flex-col items-center px-0' : 'px-3'}`}>
            <button
              type="button"
              onClick={onToggleTheme}
              aria-label="Toggle theme"
              className="w-9 h-9 rounded-xl flex items-center justify-center text-zinc-500 hover:bg-zinc-100 dark:hover:bg-[#2a2a2a] cursor-pointer"
            >
              {isDark ? <Sun className="w-[18px] h-[18px]" strokeWidth={1.75} /> : <Moon className="w-[18px] h-[18px]" strokeWidth={1.75} />}
            </button>
            <button
              type="button"
              onClick={() => setSection('settings')}
              aria-label="Settings"
              className="w-9 h-9 rounded-xl flex items-center justify-center text-zinc-500 hover:bg-zinc-100 dark:hover:bg-[#2a2a2a] cursor-pointer"
            >
              <Settings className="w-[18px] h-[18px]" strokeWidth={1.75} />
            </button>
          </div>
          <div className={`mx-3 h-px bg-zinc-200 dark:bg-[#333333] ${collapsed ? 'mx-2' : ''}`} />
          <a
            href={accountHref}
            className={`flex items-center gap-2.5 py-3 hover:bg-zinc-50 dark:hover:bg-[#2a2a2a] ${collapsed ? 'justify-center px-0' : 'px-3'}`}
            title={user?.email}
          >
            <span className="w-9 h-9 rounded-full overflow-hidden shrink-0 bg-gradient-to-br from-[#0494f4] to-[#7c5cff] text-white flex items-center justify-center text-xs font-bold">
              {user?.avatarUrl ? <img src={user.avatarUrl} alt="" className="w-full h-full object-cover" /> : initial}
            </span>
            {!collapsed && (
              <span className="min-w-0 text-left">
                <span className="block text-[13px] font-semibold truncate">{displayName}</span>
                <span className="block text-[11px] text-zinc-500 truncate">{user?.email}</span>
              </span>
            )}
          </a>
        </div>
      </aside>

      {/* Canvas */}
      <main className="flex-1 min-w-0 flex flex-col overflow-hidden">
        <header className="flex items-center gap-2 h-14 px-4 sm:px-6 shrink-0 border-b border-zinc-200 dark:border-[#333333]">
          <span className="text-[13px] font-semibold">{title}</span>
          {models && models.length > 0 && section === 'chat' && (
            <select
              value={model ?? ''}
              onChange={(e) => setModel(e.target.value || undefined)}
              className="ml-2 h-8 rounded-lg bg-transparent border border-zinc-200 dark:border-[#333333] text-[12px] px-2 outline-none"
            >
              <option value="">Auto model</option>
              {models.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          )}
          <a
            href="https://bansify.com"
            target="_blank"
            rel="noopener noreferrer"
            className="ml-auto inline-flex items-center gap-1 text-[11px] text-zinc-500 hover:text-[#0494f4]"
          >
            bansify.com <ArrowUpRight className="w-3 h-3" strokeWidth={1.75} />
          </a>
        </header>

        <div className="flex-1 min-h-0 overflow-hidden">
          {section === 'chat' && (
            <div className="h-full flex flex-col">
              <div className="flex-1 min-h-0 overflow-y-auto">
                <div className="mx-auto max-w-3xl px-4 py-6">
                  <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#0494f4]/10 via-transparent to-[#7c5cff]/10 p-6 mb-6">
                    <h1 className="text-2xl font-black tracking-tight">What should we build today?</h1>
                    <p className="mt-1 text-sm text-zinc-500">
                      Ask anything — code, writing, planning or analysis. Your Bansify account keeps the history.
                    </p>
                    <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {SUGGESTIONS.map((s) => (
                        <div key={s.title} className="rounded-2xl border border-zinc-200 dark:border-[#333333] bg-white/60 dark:bg-[#2a2a2a]/60 backdrop-blur p-3">
                          <p className="text-[13px] font-semibold">{s.title}</p>
                          <p className="mt-0.5 text-[12px] text-zinc-500">{s.body}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                  <ChatV2 selectedModel={model} />
                </div>
              </div>
            </div>
          )}

          {section === 'history' && (
            <Empty title="History" body="Every conversation you start is kept with your Bansify account. The list appears here." />
          )}
          {section === 'models' && (
            <div className="mx-auto max-w-3xl px-4 py-6">
              <h2 className="text-lg font-bold">Models</h2>
              <p className="mt-1 text-sm text-zinc-500">Pick a model per conversation, or leave it on Auto.</p>
              <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                {(models && models.length > 0 ? models : ['Auto — best available']).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => { setModel(m.startsWith('Auto') ? undefined : m); setSection('chat'); }}
                    className="rounded-2xl border border-zinc-200 dark:border-[#333333] p-4 text-left hover:border-[#0494f4]/40 transition"
                  >
                    <p className="text-[13px] font-semibold">{m}</p>
                    <p className="mt-0.5 text-[12px] text-zinc-500">Use for the next conversation</p>
                  </button>
                ))}
              </div>
            </div>
          )}
          {section === 'studio' && (
            <Empty title="Studio" body="Repositories and files live here. Connect a repository to browse and edit it with the assistant." />
          )}
          {section === 'library' && (
            <Empty title="Library" body="Generated images, documents and exports will collect here." />
          )}
          {section === 'scheduled' && (
            <Empty title="Scheduled" body="Prompts you schedule will run on their own and appear here." />
          )}
          {section === 'settings' && (
            <div className="mx-auto max-w-2xl px-4 py-6 space-y-4">
              <h2 className="text-lg font-bold">Settings</h2>
              <div className="rounded-2xl border border-zinc-200 dark:border-[#333333] divide-y divide-zinc-200 dark:divide-[#333333]">
                <Row label="Appearance" value={isDark ? 'Dark' : 'Light'} action="Toggle" onClick={onToggleTheme} />
                <Row label="Account" value={user?.email || 'Not signed in'} action="Manage" onClick={() => { window.location.href = accountHref; }} />
                <Row label="Plan" value="Bansify account" action="View" onClick={() => { window.location.href = 'https://pay.bansify.com'; }} />
                {onLogout && <Row label="Sign out" value="Ends this session" action="Sign out" onClick={onLogout} danger />}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

const Empty: React.FC<{ title: string; body: string }> = ({ title, body }) => (
  <div className="h-full grid place-items-center px-6">
    <div className="max-w-md text-center">
      <div className="mx-auto w-12 h-12 rounded-2xl bg-gradient-to-br from-[#0494f4] to-[#7c5cff] text-white grid place-items-center">
        <Paperclip className="w-5 h-5" strokeWidth={1.75} />
      </div>
      <h2 className="mt-4 text-lg font-bold">{title}</h2>
      <p className="mt-1 text-sm text-zinc-500">{body}</p>
    </div>
  </div>
);

const Row: React.FC<{ label: string; value: string; action: string; onClick: () => void; danger?: boolean }> = ({
  label,
  value,
  action,
  onClick,
  danger,
}) => (
  <div className="flex items-center gap-3 p-4">
    <div className="min-w-0">
      <p className="text-[13px] font-semibold">{label}</p>
      <p className="text-[12px] text-zinc-500 truncate">{value}</p>
    </div>
    <button
      type="button"
      onClick={onClick}
      className={`ml-auto shrink-0 rounded-full px-3 py-1.5 text-[12px] font-semibold border transition ${
        danger
          ? 'border-red-300 text-red-600 hover:bg-red-50'
          : 'border-zinc-200 dark:border-[#333333] hover:border-[#0494f4]/40 hover:text-[#0494f4]'
      }`}
    >
      {action}
    </button>
  </div>
);
