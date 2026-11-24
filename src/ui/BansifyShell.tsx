import React, { useEffect, useMemo, useState } from 'react';
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
  Sun,
  Moon,
  Search,
  X,
  Menu,
} from 'lucide-react';
import ChatV2 from '../features/chat/v2/ChatV2';
import { ComingSoon } from './ComingSoon';
import { fetchModels, type WorkerModel } from '../services/workerClient';
import { APP_DOCK } from '../data/dock';
import { SOCIAL_LINKS } from '../data/social';

export interface ShellUser {
  name?: string;
  username?: string;
  email?: string;
  avatarUrl?: string | null;
}

export interface RailItem {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  url?: string;
  logoSrc?: string;
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

const PROVIDER_LABELS: Record<string, string> = {
  groq: 'Groq (free)',
  gemini: 'Google Gemini (free)',
  'cloudflare-ai': 'Cloudflare Workers AI (free)',
  zai: 'Z.ai GLM (free)',
  openrouter: 'OpenRouter (free)',
  sambanova: 'SambaNova (free)',
  sarvam: 'Sarvam AI (paid — best quality)',
};

const providerLabel = (id: string): string => PROVIDER_LABELS[id] ?? id;

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

const DockTile: React.FC<{ item: RailItem; active?: boolean }> = ({ item, active }) => {
  const [failed, setFailed] = useState(false);
  const Icon = item.icon;
  return (
    <span
      className={`w-[34px] h-[34px] rounded-[10px] bg-[#0494f4] overflow-hidden flex items-center justify-center ring-1 ring-black/5 dark:ring-white/10 transition group-hover:brightness-110 ${
        active ? 'outline outline-2 outline-offset-2 outline-[#0494f4]/60' : ''
      }`}
    >
      {item.logoSrc && !failed ? (
        <img src={item.logoSrc} alt="" loading="lazy" onError={() => setFailed(true)} className="w-full h-full object-cover" />
      ) : (
        <Icon className="w-1/2 h-1/2 text-white" strokeWidth={1.75} />
      )}
    </span>
  );
};

/** The website's five-card layout: rail, search pill, content, social card and dock. */
export const BansifyShell: React.FC<BansifyShellProps> = ({ user, themeMode, onToggleTheme, onLogout, accountHref }) => {
  const [section, setSection] = useState<Section>('chat');
  const [open, setOpen] = useState(true);
  const [mobileNav, setMobileNav] = useState(false);
  const [panes, setPanes] = useState<RailItem[]>([]);
  const [paneCollapsed, setPaneCollapsed] = useState<Record<string, boolean>>({});
  const [model, setModel] = useState<string | undefined>(undefined);
  const [catalog, setCatalog] = useState<WorkerModel[]>([]);
  const [query, setQuery] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await fetchModels();
        if (!cancelled) setCatalog(list);
      } catch {
        // Offline or signed out: leave the picker on Auto.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const modelGroups = useMemo(() => {
    const byProvider = new Map<string, WorkerModel[]>();
    for (const m of catalog) {
      const list = byProvider.get(m.provider_id) ?? [];
      list.push(m);
      byProvider.set(m.provider_id, list);
    }
    return Array.from(byProvider.entries());
  }, [catalog]);

  // The rest of the app lets the user pick an accent, which paints gradients and glows the
  // website does not have. Inside the shell the palette is fixed to the brand blue, so AI
  // looks like Mail and bansify.com; the choice is restored on the way out.
  useEffect(() => {
    const root = document.documentElement;
    const prevPrimary = root.style.getPropertyValue('--primary');
    const prevGradient = root.style.getPropertyValue('--primary-gradient');
    root.style.setProperty('--primary', '#0494f4');
    root.style.setProperty('--primary-gradient', 'linear-gradient(135deg, #0494f4 0%, #0494f4dd 100%)');
    return () => {
      if (prevPrimary) root.style.setProperty('--primary', prevPrimary);
      if (prevGradient) root.style.setProperty('--primary-gradient', prevGradient);
    };
  }, []);

  const isDark = themeMode === 'dark';
  const displayName = user?.name || user?.username || 'Bansify user';
  const initial = displayName.slice(0, 1).toUpperCase();
  const title = useMemo(() => NAV.find((n) => n.id === section)?.label ?? 'Chat', [section]);

  const openPane = (item: RailItem) =>
    setPanes((list) => (list.some((p) => p.id === item.id) ? list : [...list, item].slice(-2)));

  const row = (item: { id: Section; label: string; icon: RailItem['icon'] }, isOpen: boolean) => {
    const Icon = item.icon;
    const active = section === item.id;
    return (
      <button
        key={item.id}
        type="button"
        onClick={() => setSection(item.id)}
        title={item.label}
        aria-label={item.label}
        aria-current={active ? 'page' : undefined}
        className={`group relative flex items-center h-10 rounded-xl cursor-pointer ${
          isOpen ? 'w-full' : 'w-10'
        } ${active ? 'text-white' : 'text-zinc-900 dark:text-zinc-100'}`}
      >
        <span
          aria-hidden
          className={`absolute inset-x-0 top-[2px] bottom-[2px] rounded-xl transition-colors ${
            active
              ? 'bg-[#0494f4] shadow-sm shadow-[#0494f4]/25'
              : 'bg-zinc-100/80 group-hover:bg-zinc-200/80 dark:bg-[#303030] dark:group-hover:bg-[#3a3a3a]'
          }`}
        />
        <span className="relative w-10 h-10 flex items-center justify-center shrink-0">
          <Icon className="w-[18px] h-[18px]" strokeWidth={1.75} />
        </span>
        {isOpen && (
          <span className={`relative ml-2 truncate text-[13px] ${active ? 'font-semibold' : 'font-medium'}`}>
            {item.label}
          </span>
        )}
      </button>
    );
  };

  const panel = (variant: 'desktop' | 'drawer') => {
    const isOpen = variant === 'drawer' ? true : open;
    return (
      <div
        className={`flex h-full flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white dark:border-[#333333] dark:bg-[#2a2a2a] ${
          isOpen ? 'w-[260px]' : 'w-16'
        }`}
      >
        <div className={`flex items-center h-16 shrink-0 ${isOpen ? 'gap-2.5 px-3' : 'justify-center px-0'}`}>
          {isOpen ? (
            <>
              <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                title="Collapse panel"
                aria-label="Collapse panel"
                className="w-9 h-9 rounded-[10px] bg-[#0494f4] overflow-hidden shrink-0 ring-1 ring-black/5 dark:ring-white/10"
              >
                <img src="/icon-192.png" alt="Bansify AI" className="w-full h-full object-cover" />
              </button>
              <span className="min-w-0 text-[16px] font-black tracking-tight leading-none truncate">
                <span className="text-[#0494f4]">Bansify</span>{' '}
                <span className="text-zinc-900 dark:text-zinc-100">AI</span>
              </span>
              <button
                type="button"
                onClick={() => (variant === 'drawer' ? setMobileNav(false) : setOpen(false))}
                title="Collapse"
                aria-label="Collapse panel"
                className="ml-auto w-7 h-7 rounded-lg flex items-center justify-center text-zinc-400 hover:bg-zinc-100 dark:hover:bg-[#333333] cursor-pointer shrink-0"
              >
                {variant === 'drawer' ? <X className="w-4 h-4" strokeWidth={1.75} /> : <ChevronLeft className="w-4 h-4" strokeWidth={1.75} />}
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              title="Expand panel"
              aria-label="Expand panel"
              className="w-9 h-9 rounded-[10px] bg-[#0494f4] overflow-hidden ring-1 ring-black/5 dark:ring-white/10"
            >
              <img src="/icon-192.png" alt="Bansify AI" className="w-full h-full object-cover" />
            </button>
          )}
        </div>

        <div className={`pb-2 ${isOpen ? 'px-3' : 'px-0 flex justify-center'}`}>
          <button
            type="button"
            onClick={() => setSection('chat')}
            title="New chat"
            className={`flex items-center justify-center gap-2 rounded-xl bg-[#0494f4] hover:bg-[#0382d6] text-white font-semibold transition ${
              isOpen ? 'w-full h-10 text-[13px]' : 'w-10 h-10'
            }`}
          >
            <Plus className="w-[18px] h-[18px]" strokeWidth={2} />
            {isOpen && <span>New chat</span>}
          </button>
        </div>

        <div className={`flex-1 min-h-0 overflow-y-auto flex flex-col gap-1 ${isOpen ? 'px-3' : 'px-0 items-center'}`}>
          {NAV.map((item) => row(item, isOpen))}
          <button
            type="button"
            onClick={() => setSection('settings')}
            title="Settings"
            aria-label="Settings"
            className={`group relative flex items-center h-10 rounded-xl cursor-pointer text-zinc-900 dark:text-zinc-100 ${
              isOpen ? 'w-full' : 'w-10'
            }`}
          >
            <span
              aria-hidden
              className={`absolute inset-x-0 top-[2px] bottom-[2px] rounded-xl transition-colors ${
                section === 'settings'
                  ? 'bg-[#0494f4] shadow-sm shadow-[#0494f4]/25'
                  : 'bg-zinc-100/80 group-hover:bg-zinc-200/80 dark:bg-[#303030] dark:group-hover:bg-[#3a3a3a]'
              }`}
            />
            <span className={`relative w-10 h-10 flex items-center justify-center shrink-0 ${section === 'settings' ? 'text-white' : ''}`}>
              <Settings className="w-[18px] h-[18px]" strokeWidth={1.75} />
            </span>
            {isOpen && (
              <span className={`relative ml-2 truncate text-[13px] ${section === 'settings' ? 'font-semibold text-white' : 'font-medium'}`}>
                Settings
              </span>
            )}
          </button>
        </div>

        <div className="shrink-0">
          <div className={`mx-3 h-px bg-zinc-200 dark:bg-[#333333] ${isOpen ? '' : 'mx-2'}`} />

          {!isOpen && (
            <div className="flex justify-center pt-2">
              <button
                type="button"
                onClick={() => setOpen(true)}
                title="Expand panel"
                aria-label="Expand panel"
                className="w-8 h-8 rounded-lg flex items-center justify-center text-zinc-400 hover:bg-zinc-100 dark:hover:bg-[#333333] cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" strokeWidth={1.75} />
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={() => { window.location.href = accountHref; }}
            title={user?.email}
            className={`w-full flex items-center gap-2.5 py-3 hover:bg-zinc-50 dark:hover:bg-[#333333] text-left cursor-pointer ${
              isOpen ? 'px-3' : 'justify-center px-0'
            }`}
          >
            <span className="w-9 h-9 rounded-full overflow-hidden bg-[#0494f4] text-white flex items-center justify-center text-xs font-bold shrink-0">
              {user?.avatarUrl ? <img src={user.avatarUrl} alt="" className="w-full h-full object-cover" /> : initial}
            </span>
            {isOpen && (
              <span className="min-w-0 text-left">
                <span className="block text-[13px] font-semibold text-zinc-900 dark:text-zinc-100 truncate">{displayName}</span>
                <span className="block text-[11px] text-zinc-500 truncate">{user?.email}</span>
              </span>
            )}
            {isOpen && (
              <span
                role="button"
                tabIndex={0}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onToggleTheme();
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onToggleTheme();
                  }
                }}
                title={isDark ? 'Switch to light' : 'Switch to dark'}
                aria-label="Toggle theme"
                className="ml-auto w-8 h-8 rounded-lg flex items-center justify-center text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-[#333333] cursor-pointer shrink-0"
              >
                {isDark ? <Sun className="w-4 h-4" strokeWidth={1.75} /> : <Moon className="w-4 h-4" strokeWidth={1.75} />}
              </span>
            )}
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="flex h-[100dvh] w-full flex-col gap-3 bg-[#f5f6f7] p-3 dark:bg-[#212121] text-zinc-900 dark:text-zinc-100">
      <div className="flex flex-1 min-h-0 gap-3">
        <div className="hidden md:block shrink-0">{panel('desktop')}</div>

        {mobileNav && (
          <div className="fixed inset-0 z-50 md:hidden">
            <button
              type="button"
              aria-label="Close navigation"
              onClick={() => setMobileNav(false)}
              className="absolute inset-0 bg-black/40 cursor-default"
            />
            <div className="absolute left-3 top-3 bottom-3">{panel('drawer')}</div>
          </div>
        )}

        <div className="flex flex-1 min-w-0 flex-col gap-3">
          {/* search pill and social card, above the content only */}
          <div className="flex gap-3 shrink-0">
            <div className="flex-1 min-w-0 flex items-center gap-2 h-12 px-4 rounded-full border border-zinc-200 bg-white dark:border-[#333333] dark:bg-[#2a2a2a]">
              <button
                type="button"
                onClick={() => setMobileNav(true)}
                aria-label="Open navigation"
                className="md:hidden w-6 h-6 rounded-lg flex items-center justify-center text-zinc-500 cursor-pointer shrink-0"
              >
                <Menu className="w-5 h-5" strokeWidth={1.75} />
              </button>
              <Search className="w-4 h-4 text-zinc-400 shrink-0" strokeWidth={1.75} />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search chats"
                className="flex-1 min-w-0 bg-transparent outline-none text-[13px] placeholder:text-zinc-400"
              />
            </div>

            <div className="hidden sm:flex items-center gap-1.5 h-12 px-3 rounded-2xl border border-zinc-200 bg-white dark:border-[#333333] dark:bg-[#2a2a2a] overflow-x-auto">
              {SOCIAL_LINKS.map((social) => {
                const Icon = social.icon;
                return (
                  <a
                    key={social.id}
                    href={social.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={`${social.label} · ${social.handle}`}
                    aria-label={`${social.label} ${social.handle}`}
                    style={{ backgroundColor: social.color }}
                    className="group w-[34px] h-[34px] rounded-[10px] flex items-center justify-center shrink-0 ring-1 ring-black/10 dark:ring-white/15 transition group-hover:brightness-110"
                  >
                    <Icon className="w-4 h-4 text-white" strokeWidth={1.75} />
                  </a>
                );
              })}
            </div>
          </div>

          <main className="flex flex-1 min-h-0 flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white dark:border-[#333333] dark:bg-[#2a2a2a]">
            <div className="flex items-center gap-2 h-12 px-4 shrink-0 border-b border-zinc-200 dark:border-[#333333]">
              <span className="text-[13px] font-semibold">{title}</span>
              {section === 'chat' && (
                <select
                  value={model ?? ''}
                  onChange={(e) => setModel(e.target.value || undefined)}
                  aria-label="Model and provider"
                  title="Auto = free providers in order. Pick a model to force its provider."
                  className="ml-2 h-8 max-w-[220px] rounded-lg bg-transparent border border-zinc-200 dark:border-[#333333] text-[12px] px-2 outline-none"
                >
                  <option value="">Auto — best free</option>
                  {modelGroups.map(([providerId, list]) => (
                    <optgroup key={providerId} label={providerLabel(providerId)}>
                      {list.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.display_name}
                          {m.is_free ? '' : ' · paid'}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              )}
            </div>

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
                <ComingSoon
                  title="History"
                  body="Chat history is already saved with your Bansify account — the list view ships next release."
                  onBack={() => setSection('chat')}
                />
              )}
              {section === 'models' && (
                <ComingSoon
                  title="Model catalog"
                  body="Sarvam aur OpenRouter ke saare models, limits ke saath — next release me. Abhi header ke dropdown se model chuno."
                  onBack={() => setSection('chat')}
                />
              )}
              {section === 'studio' && (
                <ComingSoon title="Studio" body="Repo browsing, file editing and previews ship next release." onBack={() => setSection('chat')} />
              )}
              {section === 'library' && (
                <ComingSoon title="Library" body="Generated images, documents and exports ship next release." onBack={() => setSection('chat')} />
              )}
              {section === 'scheduled' && (
                <ComingSoon title="Scheduled" body="Queued prompts that run on their own ship next release." onBack={() => setSection('chat')} />
              )}
              {section === 'settings' && (
                <div className="mx-auto max-w-2xl px-4 py-6 space-y-4 overflow-y-auto h-full">
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

        {panes.map((item) => {
          const isCollapsed = !!paneCollapsed[item.id];
          return (
            <section
              key={item.id}
              className={`hidden lg:flex shrink-0 flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white dark:border-[#333333] dark:bg-[#2a2a2a] ${
                isCollapsed ? 'w-14' : 'w-[38%] max-w-[560px]'
              }`}
              aria-label={item.label}
            >
              <div className={`flex items-center gap-2 h-12 px-3 shrink-0 border-b border-zinc-200 dark:border-[#333333] ${isCollapsed ? 'justify-center px-0' : ''}`}>
                {isCollapsed ? (
                  <button
                    type="button"
                    onClick={() => setPaneCollapsed((m) => ({ ...m, [item.id]: false }))}
                    title={item.label}
                    aria-label={`Expand ${item.label}`}
                    className="group w-10 h-10 rounded-xl flex items-center justify-center hover:bg-zinc-100 dark:hover:bg-[#333333] cursor-pointer"
                  >
                    <DockTile item={item} />
                  </button>
                ) : (
                  <>
                    <DockTile item={item} />
                    <span className="text-[13px] font-semibold truncate">{item.label}</span>
                    <button
                      type="button"
                      onClick={() => setPaneCollapsed((m) => ({ ...m, [item.id]: true }))}
                      title="Collapse"
                      aria-label="Collapse"
                      className="ml-auto w-7 h-7 rounded-lg flex items-center justify-center text-zinc-400 hover:bg-zinc-100 dark:hover:bg-[#333333] cursor-pointer"
                    >
                      <ChevronRight className="w-4 h-4" strokeWidth={1.75} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setPanes((list) => list.filter((p) => p.id !== item.id))}
                      title="Close"
                      aria-label="Close"
                      className="w-7 h-7 rounded-lg flex items-center justify-center text-zinc-400 hover:bg-zinc-100 dark:hover:bg-[#333333] cursor-pointer"
                    >
                      <X className="w-4 h-4" strokeWidth={1.75} />
                    </button>
                  </>
                )}
              </div>
              {!isCollapsed && item.url && (
                <iframe src={item.url} title={item.label} className="flex-1 w-full border-0 bg-white" loading="lazy" />
              )}
            </section>
          );
        })}

        <aside
          className="hidden lg:flex w-16 shrink-0 flex-col items-center gap-1.5 rounded-2xl border border-zinc-200 bg-white py-3 dark:border-[#333333] dark:bg-[#2a2a2a]"
          aria-label="Bansify apps"
        >
          <button
            type="button"
            onClick={() => { window.location.href = accountHref; }}
            title={user?.email}
            aria-label="Account"
            className="mb-1 w-9 h-9 rounded-full overflow-hidden bg-[#0494f4] text-white flex items-center justify-center text-xs font-bold cursor-pointer"
          >
            {user?.avatarUrl ? <img src={user.avatarUrl} alt="" className="w-full h-full object-cover" /> : initial}
          </button>
          <div className="w-6 h-px bg-zinc-200 dark:bg-[#333333] mb-1" />

          {APP_DOCK.map((item) => (
            <React.Fragment key={item.id}>
              <button
                type="button"
                onClick={() => openPane(item)}
                title={item.label}
                aria-label={`Open ${item.label}`}
                className="group cursor-pointer rounded-[10px]"
              >
                <DockTile item={item} active={panes.some((p) => p.id === item.id)} />
              </button>
              <div className="w-5 h-px bg-zinc-200 dark:bg-[#333333]" />
            </React.Fragment>
          ))}
        </aside>
      </div>
    </div>
  );
};

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
