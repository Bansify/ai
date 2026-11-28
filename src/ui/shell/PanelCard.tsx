import React from 'react';
import { ChevronLeft, ChevronRight, Settings, Sun, Moon } from 'lucide-react';
import type { RailItem } from '../BansifyShell';

export interface PanelSection {
  id: string;
  label: string;
  icon: RailItem['icon'];
}

interface PanelCardProps {
  open: boolean;
  drawer: boolean;
  brandName: string;
  product: string;
  logoSrc: string;
  sections: PanelSection[];
  activeSection: string;
  settingsActive: boolean;
  onSelect: (id: string) => void;
  onOpenSettings: () => void;
  onToggleOpen: () => void;
  onCloseDrawer: () => void;
  isDark: boolean;
  onToggleTheme: () => void;
  displayName: string;
  email?: string;
  avatarUrl?: string | null;
  accountHref: string;
  onAccount: () => void;
}

const Row: React.FC<{
  section: PanelSection;
  open: boolean;
  active: boolean;
  onSelect: () => void;
}> = ({ section, open, active, onSelect }) => {
  const Icon = section.icon;
  return (
    <button
      type="button"
      onClick={onSelect}
      title={section.label}
      aria-label={section.label}
      aria-current={active ? 'page' : undefined}
      className={`group relative flex items-center h-10 rounded-xl cursor-pointer ${
        open ? 'w-full' : 'w-10'
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
      {open && (
        <span className={`relative ml-2 truncate text-[13px] ${active ? 'font-semibold' : 'font-medium'}`}>
          {section.label}
        </span>
      )}
    </button>
  );
};

/** Card 1: brand, the section rows, Settings, and the account block with the theme toggle. */
const PanelCard: React.FC<PanelCardProps> = ({
  open,
  drawer,
  brandName,
  product,
  logoSrc,
  sections,
  activeSection,
  settingsActive,
  onSelect,
  onOpenSettings,
  onToggleOpen,
  onCloseDrawer,
  isDark,
  onToggleTheme,
  displayName,
  email,
  avatarUrl,
  onAccount,
}) => {
  const isOpen = drawer ? true : open;
  const initial = (displayName || 'B').slice(0, 1).toUpperCase();

  return (
    <div
      className={`flex h-full flex-col overflow-hidden rounded-2xl border border-neutral-200 bg-white dark:border-[#333333] dark:bg-[#2a2a2a] ${
        isOpen ? 'w-[260px]' : 'w-16'
      }`}
    >
      <div className={`flex items-center h-16 shrink-0 ${isOpen ? 'gap-2.5 px-3' : 'justify-center px-0'}`}>
        <button
          type="button"
          onClick={onToggleOpen}
          title={isOpen ? 'Collapse panel' : 'Expand panel'}
          aria-label={isOpen ? 'Collapse panel' : 'Expand panel'}
          className="w-9 h-9 rounded-[10px] bg-[#0494f4] overflow-hidden shrink-0 ring-1 ring-black/5 dark:ring-white/10"
        >
          <img src={logoSrc} alt={brandName} className="w-full h-full object-cover" />
        </button>
        {isOpen && (
          <span className="min-w-0 text-[16px] font-black tracking-tight leading-none truncate">
            <span className="text-[#0494f4]">{brandName}</span>{' '}
            <span className="text-zinc-900 dark:text-zinc-100">{product}</span>
          </span>
        )}
        {isOpen && (
          <button
            type="button"
            onClick={drawer ? onCloseDrawer : onToggleOpen}
            title="Collapse"
            aria-label="Collapse panel"
            className="ml-auto w-7 h-7 rounded-lg flex items-center justify-center text-zinc-400 hover:bg-zinc-100 dark:hover:bg-[#333333] cursor-pointer shrink-0"
          >
            {drawer ? (
              <ChevronLeft className="w-4 h-4" strokeWidth={1.75} />
            ) : (
              <ChevronLeft className="w-4 h-4" strokeWidth={1.75} />
            )}
          </button>
        )}
      </div>

      <div className={`flex-1 min-h-0 overflow-y-auto flex flex-col gap-1 ${isOpen ? 'px-3' : 'px-0 items-center'}`}>
        {sections.map((section) => (
          <Row
            key={section.id}
            section={section}
            open={isOpen}
            active={activeSection === section.id}
            onSelect={() => onSelect(section.id)}
          />
        ))}
        <button
          type="button"
          onClick={onOpenSettings}
          title="Settings"
          aria-label="Settings"
          className={`group relative flex items-center h-10 rounded-xl cursor-pointer text-zinc-900 dark:text-zinc-100 ${
            isOpen ? 'w-full' : 'w-10'
          }`}
        >
          <span
            aria-hidden
            className={`absolute inset-x-0 top-[2px] bottom-[2px] rounded-xl transition-colors ${
              settingsActive
                ? 'bg-[#0494f4] shadow-sm shadow-[#0494f4]/25'
                : 'bg-zinc-100/80 group-hover:bg-zinc-200/80 dark:bg-[#303030] dark:group-hover:bg-[#3a3a3a]'
            }`}
          />
          <span className={`relative w-10 h-10 flex items-center justify-center shrink-0 ${settingsActive ? 'text-white' : ''}`}>
            <Settings className="w-[18px] h-[18px]" strokeWidth={1.75} />
          </span>
          {isOpen && (
            <span className={`relative ml-2 truncate text-[13px] ${settingsActive ? 'font-semibold text-white' : 'font-medium'}`}>
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
              onClick={onToggleOpen}
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
          onClick={onAccount}
          title={email}
          className={`w-full flex items-center gap-2.5 py-3 hover:bg-zinc-50 dark:hover:bg-[#333333] text-left cursor-pointer ${
            isOpen ? 'px-3' : 'justify-center px-0'
          }`}
        >
          <span className="w-9 h-9 rounded-full overflow-hidden bg-[#0494f4] text-white flex items-center justify-center text-xs font-bold shrink-0">
            {avatarUrl ? <img src={avatarUrl} alt="" className="w-full h-full object-cover" /> : initial}
          </span>
          {isOpen && (
            <span className="min-w-0 text-left">
              <span className="block text-[13px] font-semibold text-zinc-900 dark:text-zinc-100 truncate">{displayName}</span>
              <span className="block text-[11px] text-zinc-500 truncate">{email}</span>
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

export default PanelCard;
