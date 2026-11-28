import React, { useEffect, useMemo, useState } from 'react';
import { Search, Menu, X, MessageSquare, History, Cpu, FolderGit2, Library, CalendarClock } from 'lucide-react';
import ChatV2 from '../features/chat/v2/ChatV2';
import { fetchModels, type WorkerModel } from '../services/workerClient';
import { APP_DOCK } from '../data/dock';
import { SOCIAL_LINKS } from '../data/social';
import PanelCard from './shell/PanelCard';
import { DockCards } from './shell/DockCards';
import HistoryView from './views/HistoryView';
import ModelsView from './views/ModelsView';
import LibraryView from './views/LibraryView';
import ScheduledView from './views/ScheduledView';
import SettingsView from './views/SettingsView';

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
  /** Opens the shared account control centre; falls back to accountHref. */
  onOpenAccount?: (anchor: HTMLElement | null) => void;
  models?: string[];
}

const SECTIONS = [
  { id: 'chat', label: 'Chat', icon: MessageSquare },
  { id: 'history', label: 'History', icon: History },
  { id: 'models', label: 'Models', icon: Cpu },
  { id: 'studio', label: 'Studio', icon: FolderGit2 },
  { id: 'library', label: 'Library', icon: Library },
  { id: 'scheduled', label: 'Scheduled', icon: CalendarClock },
];

const PROVIDER_LABELS: Record<string, string> = {
  groq: 'Groq (free)',
  gemini: 'Google Gemini (free)',
  'cloudflare-ai': 'Cloudflare Workers AI (free)',
  zai: 'Z.ai GLM (free)',
  openrouter: 'OpenRouter (free)',
  sambanova: 'SambaNova (free)',
  sarvam: 'Sarvam AI (paid)',
};

const SUGGESTIONS = [
  { title: 'Explain a codebase', body: 'Paste a repo and ask how the pieces fit together.' },
  { title: 'Write it better', body: 'Turn rough notes into a clean, readable draft.' },
  { title: 'Debug with me', body: 'Describe a failure and work towards the cause.' },
  { title: 'Plan a launch', body: 'Break a big goal into a week of small steps.' },
];

/** The website's five-card layout: panel, search pill, content, social card, dock. */
export const BansifyShell: React.FC<BansifyShellProps> = ({ user, themeMode, onToggleTheme, onLogout, accountHref, onOpenAccount }) => {
  const [section, setSection] = useState<Section>('chat');
  const [open, setOpen] = useState(true);
  const [mobileNav, setMobileNav] = useState(false);
  const [panes, setPanes] = useState<RailItem[]>([]);
  const [paneCollapsed, setPaneCollapsed] = useState<Record<string, boolean>>({});
  const [model, setModel] = useState<string | undefined>(undefined);
  const [catalog, setCatalog] = useState<WorkerModel[]>([]);
  const [query, setQuery] = useState('');
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await fetchModels();
        if (!cancelled) setCatalog(list);
      } catch {
        // Offline or signed out: the picker stays on Auto.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    const prevPrimary = root.style.getPropertyValue('--primary');
    root.style.setProperty('--primary', '#0494f4');
    return () => {
      if (prevPrimary) root.style.setProperty('--primary', prevPrimary);
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

  const isDark = themeMode === 'dark';
  const displayName = user?.name || user?.username || 'Bansify user';
  const title = useMemo(() => SECTIONS.find((n) => n.id === section)?.label ?? 'Chat', [section]);

  const openPane = (item: RailItem) =>
    setPanes((list) => (list.some((p) => p.id === item.id) ? list : [...list, item].slice(-2)));

  const usePrompt = async (prompt: string) => {
    try {
      await navigator.clipboard.writeText(prompt);
      setNotice('Prompt copied — paste it into the composer.');
    } catch {
      setNotice(`Copy this prompt into the composer: ${prompt.slice(0, 80)}`);
    }
    setSection('chat');
    window.setTimeout(() => setNotice(null), 5000);
  };

  const panel = (drawer: boolean) => (
    <PanelCard
      open={open}
      drawer={drawer}
      brandName="Bansify"
      product="AI"
      logoSrc="/icon-192.png"
      sections={SECTIONS}
      activeSection={section}
      settingsActive={section === 'settings'}
      onSelect={(id) => setSection(id as Section)}
      onOpenSettings={() => setSection('settings')}
      onToggleOpen={() => setOpen((v) => !v)}
      onCloseDrawer={() => setMobileNav(false)}
      isDark={isDark}
      onToggleTheme={onToggleTheme}
      displayName={displayName}
      email={user?.email}
      avatarUrl={user?.avatarUrl}
      accountHref={accountHref}
      onAccount={(anchor) => {
        if (onOpenAccount) onOpenAccount(anchor);
        else window.location.href = accountHref;
      }}
    />
  );

  return (
    <div className="flex h-[100dvh] w-full flex-col gap-3 bg-[#f5f6f7] p-3 dark:bg-[#212121] text-zinc-900 dark:text-zinc-100">
      <div className="flex flex-1 min-h-0 gap-3">
        <div className="hidden md:block shrink-0">{panel(false)}</div>

        {mobileNav && (
          <div className="fixed inset-0 z-50 md:hidden">
            <button
              type="button"
              aria-label="Close navigation"
              onClick={() => setMobileNav(false)}
              className="absolute inset-0 bg-black/40 cursor-default"
            />
            <div className="absolute left-3 top-3 bottom-3">{panel(true)}</div>
          </div>
        )}

        <div className="flex flex-1 min-w-0 flex-col gap-3">
          <div className="flex gap-3 shrink-0">
            <div className="flex-1 min-w-0 flex items-center gap-2 h-12 px-4 rounded-full border border-neutral-200 bg-white dark:border-[#333333] dark:bg-[#2a2a2a]">
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
              {query && (
                <button type="button" onClick={() => setQuery('')} aria-label="Clear search" className="text-zinc-400">
                  <X className="w-4 h-4" strokeWidth={1.75} />
                </button>
              )}
            </div>

            <div className="hidden sm:flex items-center gap-1.5 h-12 px-3 rounded-2xl border border-neutral-200 bg-white dark:border-[#333333] dark:bg-[#2a2a2a] overflow-x-auto">
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

          <main className="flex flex-1 min-h-0 flex-col overflow-hidden rounded-2xl border border-neutral-200 bg-white dark:border-[#333333] dark:bg-[#2a2a2a]">
            <div className="flex items-center gap-2 h-12 px-4 shrink-0 border-b border-neutral-200 dark:border-[#333333]">
              <span className="text-[13px] font-semibold">{title}</span>
              {section === 'chat' && (
                <select
                  value={model ?? ''}
                  onChange={(e) => setModel(e.target.value || undefined)}
                  aria-label="Model and provider"
                  className="ml-2 h-8 max-w-[220px] rounded-lg bg-transparent border border-neutral-200 dark:border-[#333333] text-[12px] px-2 outline-none"
                >
                  <option value="">Auto — best free</option>
                  {modelGroups.map(([providerId, list]) => (
                    <optgroup key={providerId} label={PROVIDER_LABELS[providerId] ?? providerId}>
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

            {notice && (
              <div className="mx-4 mt-3 rounded-xl bg-[#0494f4]/10 px-3 py-2 text-[12px] text-[#0494f4]">{notice}</div>
            )}

            <div className="flex-1 min-h-0 overflow-hidden">
              {section === 'chat' && (
                <div className="h-full overflow-y-auto">
                  <div className="mx-auto max-w-3xl px-4 py-6">
                    <div className="rounded-3xl bg-gradient-to-br from-[#0494f4]/10 via-transparent to-[#7c5cff]/10 p-6 mb-6">
                      <h1 className="text-2xl font-black tracking-tight">What should we build today?</h1>
                      <p className="mt-1 text-sm text-zinc-500">
                        Ask anything — code, writing, planning or analysis. Your Bansify account keeps the history.
                      </p>
                      <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {SUGGESTIONS.map((s) => (
                          <div key={s.title} className="rounded-2xl border border-neutral-200 dark:border-[#333333] p-3">
                            <p className="text-[13px] font-semibold">{s.title}</p>
                            <p className="mt-0.5 text-[12px] text-zinc-500">{s.body}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                    <ChatV2 selectedModel={model} />
                  </div>
                </div>
              )}
              {section === 'history' && <HistoryView onResume={() => setSection('chat')} />}
              {section === 'models' && <ModelsView selected={model} onSelect={setModel} />}
              {section === 'studio' && (
                <div className="h-full overflow-y-auto p-4 space-y-3">
                  <p className="text-[13px] font-semibold">Studio</p>
                  <p className="text-[12px] text-zinc-500">
                    Repository browsing, file editing and previews need a GitHub connection. Connect an account
                    from Settings, then reopen Studio.
                  </p>
                  <a
                    href="https://github.com/settings/installations"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex rounded-full border border-neutral-200 dark:border-[#333333] px-4 py-2 text-[12px] font-semibold hover:border-[#0494f4]/40 hover:text-[#0494f4]"
                  >
                    Manage GitHub access
                  </a>
                </div>
              )}
              {section === 'library' && <LibraryView onUse={usePrompt} />}
              {section === 'scheduled' && <ScheduledView onRun={usePrompt} />}
              {section === 'settings' && (
                <SettingsView
                  isDark={isDark}
                  onToggleTheme={onToggleTheme}
                  selectedModel={model}
                  onSelectModel={setModel}
                  modelCount={catalog.length}
                  userEmail={user?.email}
                  accountHref={accountHref}
                  onSignOut={onLogout}
                />
              )}
            </div>
          </main>
        </div>

        <DockCards
          dock={APP_DOCK}
          panes={panes}
          paneCollapsed={paneCollapsed}
          onOpenPane={openPane}
          onTogglePane={(id) => setPaneCollapsed((m) => ({ ...m, [id]: !m[id] }))}
          onClosePane={(id) => setPanes((list) => list.filter((p) => p.id !== id))}
          accountHref={accountHref}
          email={user?.email}
          avatarUrl={user?.avatarUrl}
          displayName={displayName}
          onAccount={(anchor) => {
            if (onOpenAccount) onOpenAccount(anchor);
            else window.location.href = accountHref;
          }}
        />
      </div>
    </div>
  );
};
