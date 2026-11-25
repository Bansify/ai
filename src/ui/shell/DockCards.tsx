import React, { useState } from 'react';
import { ChevronRight, X } from 'lucide-react';
import type { RailItem } from '../BansifyShell';

export const DockTile: React.FC<{ item: RailItem; active?: boolean }> = ({ item, active }) => {
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

interface DockProps {
  dock: RailItem[];
  panes: RailItem[];
  paneCollapsed: Record<string, boolean>;
  onOpenPane: (item: RailItem) => void;
  onTogglePane: (id: string) => void;
  onClosePane: (id: string) => void;
  accountHref: string;
  email?: string;
  avatarUrl?: string | null;
  displayName: string;
  onAccount: () => void;
}

/** Card 4: the account avatar and the ecosystem dock, plus any open app panes. */
export const DockCards: React.FC<DockProps> = ({
  dock,
  panes,
  paneCollapsed,
  onOpenPane,
  onTogglePane,
  onClosePane,
  email,
  avatarUrl,
  displayName,
  onAccount,
}) => {
  const initial = (displayName || 'B').slice(0, 1).toUpperCase();
  return (
    <>
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
            <div
              className={`flex items-center gap-2 h-12 px-3 shrink-0 border-b border-zinc-200 dark:border-[#333333] ${
                isCollapsed ? 'justify-center px-0' : ''
              }`}
            >
              {isCollapsed ? (
                <button
                  type="button"
                  onClick={() => onTogglePane(item.id)}
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
                  {item.url && (
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ml-auto text-[11px] text-zinc-500 hover:text-[#0494f4]"
                    >
                      Open in tab
                    </a>
                  )}
                  <button
                    type="button"
                    onClick={() => onTogglePane(item.id)}
                    title="Collapse"
                    aria-label="Collapse"
                    className="w-7 h-7 rounded-lg flex items-center justify-center text-zinc-400 hover:bg-zinc-100 dark:hover:bg-[#333333] cursor-pointer"
                  >
                    <ChevronRight className="w-4 h-4" strokeWidth={1.75} />
                  </button>
                  <button
                    type="button"
                    onClick={() => onClosePane(item.id)}
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
          onClick={onAccount}
          title={email}
          aria-label="Account"
          className="mb-1 w-9 h-9 rounded-full overflow-hidden bg-[#0494f4] text-white flex items-center justify-center text-xs font-bold cursor-pointer"
        >
          {avatarUrl ? <img src={avatarUrl} alt="" className="w-full h-full object-cover" /> : initial}
        </button>
        <div className="w-6 h-px bg-zinc-200 dark:bg-[#333333] mb-1" />

        {dock.map((item) => (
          <React.Fragment key={item.id}>
            <button
              type="button"
              onClick={() => onOpenPane(item)}
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
    </>
  );
};

export default DockCards;
