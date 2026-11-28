import React, { useState } from 'react';
import { LogOut, RefreshCw, User } from 'lucide-react';

const ACCOUNTS_URL =
  (import.meta as unknown as { env?: Record<string, string> }).env?.VITE_BANSIFY_ACCOUNTS_URL ||
  'https://accounts.bansify.com';

interface AccountCentreProps {
  name?: string;
  email?: string;
  onSignOut?: () => void;
}

export default function AccountCentre({ name = 'Bansify User', email = 'Guest session', onSignOut }: AccountCentreProps) {
  const [open, setOpen] = useState(false);

  const handleSwitchAccount = () => {
    const redirectUri = encodeURIComponent(window.location.origin);
    window.location.href = `${ACCOUNTS_URL}/login?prompt=select_account&redirect=${redirectUri}`;
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Account Centre"
        className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-semibold shrink-0 border border-zinc-200/60 dark:border-zinc-700/60"
        style={{ background: 'linear-gradient(135deg, #2F6BFF, #7A5CFF)' }}
      >
        {name.charAt(0).toUpperCase()}
      </button>

      {open && (
        <div className="absolute right-0 bottom-12 lg:left-0 lg:right-auto lg:bottom-12 w-64 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-lg p-3 z-50 space-y-3">
          <div className="flex items-center gap-3 pb-2 border-b border-zinc-200/70 dark:border-zinc-800">
            <div
              className="w-9 h-9 rounded-full flex items-center justify-center text-white font-semibold shrink-0"
              style={{ background: 'linear-gradient(135deg, #2F6BFF, #7A5CFF)' }}
            >
              <User className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-medium truncate">{name}</div>
              <div className="text-xs text-zinc-500 truncate">{email}</div>
            </div>
          </div>

          <button
            onClick={handleSwitchAccount}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800 text-left"
          >
            <RefreshCw className="w-4 h-4 text-[#2F6BFF]" />
            <span>Switch Bansify Account</span>
          </button>

          {onSignOut && (
            <button
              onClick={() => {
                setOpen(false);
                onSignOut();
              }}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-[#D93025] hover:bg-zinc-100 dark:hover:bg-zinc-800 text-left"
            >
              <LogOut className="w-4 h-4" />
              <span>Sign out</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
