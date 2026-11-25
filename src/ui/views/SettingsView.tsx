import React from 'react';
import { Sun, Moon, Trash2, ExternalLink, Cpu } from 'lucide-react';

interface SettingsViewProps {
  isDark: boolean;
  onToggleTheme: () => void;
  selectedModel?: string;
  onSelectModel: (id: string | undefined) => void;
  modelCount: number;
  userEmail?: string;
  accountHref: string;
  onSignOut?: () => void;
}

const Row: React.FC<{ label: string; value: string; action: string; onClick: () => void; danger?: boolean }> = ({
  label,
  value,
  action,
  onClick,
  danger,
}) => (
  <div className="flex items-center gap-3 px-4 py-3">
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

/** Settings render inside the content card — no dialog, no backdrop. */
const SettingsView: React.FC<SettingsViewProps> = ({
  isDark,
  onToggleTheme,
  selectedModel,
  onSelectModel,
  modelCount,
  userEmail,
  accountHref,
  onSignOut,
}) => (
  <div className="mx-auto max-w-2xl px-4 py-5 space-y-4 overflow-y-auto h-full">
    <h2 className="text-[16px] font-bold">Settings</h2>

    <div className="rounded-2xl border border-zinc-200 dark:border-[#333333] divide-y divide-zinc-200 dark:divide-[#333333]">
      <div className="flex items-center gap-3 px-4 py-3">
        <div className="min-w-0">
          <p className="text-[13px] font-semibold">Appearance</p>
          <p className="text-[12px] text-zinc-500">{isDark ? 'Dark' : 'Light'}</p>
        </div>
        <button
          type="button"
          onClick={onToggleTheme}
          className="ml-auto shrink-0 w-9 h-9 rounded-xl border border-zinc-200 dark:border-[#333333] flex items-center justify-center hover:border-[#0494f4]/40 hover:text-[#0494f4]"
          aria-label="Toggle theme"
        >
          {isDark ? <Sun className="w-4 h-4" strokeWidth={1.75} /> : <Moon className="w-4 h-4" strokeWidth={1.75} />}
        </button>
      </div>

      <div className="flex items-center gap-3 px-4 py-3">
        <div className="min-w-0">
          <p className="text-[13px] font-semibold">Default model</p>
          <p className="text-[12px] text-zinc-500">
            {selectedModel ? selectedModel : `Auto — best free (${modelCount} models available)`}
          </p>
        </div>
        <button
          type="button"
          onClick={() => onSelectModel(undefined)}
          className="ml-auto shrink-0 inline-flex items-center gap-1.5 rounded-full border border-zinc-200 dark:border-[#333333] px-3 py-1.5 text-[12px] font-semibold hover:border-[#0494f4]/40 hover:text-[#0494f4]"
        >
          <Cpu className="w-3.5 h-3.5" strokeWidth={1.75} /> Reset to Auto
        </button>
      </div>

      <Row
        label="Account"
        value={userEmail || 'Not signed in'}
        action="Manage"
        onClick={() => {
          window.location.href = accountHref;
        }}
      />
      <Row
        label="Plan and billing"
        value="Bansify account"
        action="Open Pay"
        onClick={() => {
          window.location.href = 'https://pay.bansify.com';
        }}
      />
      <Row
        label="Local history"
        value="Chats cached in this browser"
        action="Clear"
        danger
        onClick={() => {
          try {
            localStorage.removeItem('bansify-ai-history');
            Object.keys(localStorage)
              .filter((k) => k.startsWith('bansify-ai'))
              .forEach((k) => localStorage.removeItem(k));
          } catch {
            /* storage disabled */
          }
        }}
      />
      <Row
        label="Account centre"
        value="Switch account, security, devices"
        action="Open"
        onClick={() => {
          window.location.href = accountHref;
        }}
      />
    </div>

    <a
      href="https://bansify.com"
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 text-[12px] text-zinc-500 hover:text-[#0494f4]"
    >
      Bansify ecosystem <ExternalLink className="w-3 h-3" strokeWidth={1.75} />
    </a>

    {onSignOut && (
      <button
        type="button"
        onClick={onSignOut}
        className="block rounded-full border border-red-300 px-4 py-2 text-[12px] font-semibold text-red-600 hover:bg-red-50"
      >
        Sign out
      </button>
    )}
  </div>
);

export default SettingsView;
