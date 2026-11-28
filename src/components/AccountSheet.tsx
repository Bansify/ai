// =============================================================================
// The account menu host — the same sheet Mail opens.
//
// AI does not draw its own switcher. It opens the Accounts-hosted widget
// (`${accountsWebOrigin}/widget/account-menu.js`, loaded as an ES module) exactly
// like Mail does, because that widget is the product's account control centre:
// active user, other signed-in accounts, "Add another account", manage and
// sign-out rows.
//
// The previous implementation loaded the widget with a <script> tag and looked
// for `window.GothwadAccountMenu`. The widget is an ES module, so that global was
// never set and `widget?.open()` silently did nothing — the avatar either did
// nothing or fell back to a redirect.
//
// This component only: opens with Mail's (state, opts) shape, closes in sync when
// the widget closes itself, and renders a small in-app sheet if the module cannot
// load, so the avatar is never dead.
// =============================================================================

import React, { useCallback, useEffect, useState } from 'react';
import {
  accountWidgetError,
  closeAccountWidget,
  isAccountWidgetOpen,
  openAccountWidget,
  preloadAccountWidget,
} from '../services/accountWidget';
import { buildAccountMenu, type MenuAccount, type MenuUser } from '../services/accountMenu';
import { ACCOUNTS_WEB_ORIGIN, type BansifySession } from '../lib/bansifySession';

export interface AccountSheetProps {
  isOpen: boolean;
  /** The avatar that opened it: the widget positions the card under it. */
  anchorEl: HTMLElement | null;
  session: BansifySession | null;
  theme: 'light' | 'dark';
  onClose: () => void;
  onSignOut: () => void;
  onOpenSettings: () => void;
  onToggleTheme: () => void;
}

const ORIGIN = ACCOUNTS_WEB_ORIGIN;

function toMenuUser(session: BansifySession | null): MenuUser {
  const user = session?.user ?? null;
  return {
    username: user?.username || 'user',
    name: user?.name ?? null,
    email: user?.email || '',
    avatarUrl: user?.avatarUrl ?? user?.avatar_url ?? null,
  };
}

function toMenuAccounts(session: BansifySession | null): MenuAccount[] {
  const list = session?.accounts?.length ? session.accounts : session?.user ? [session.user] : [];
  return list.map((account, index) => ({
    id: account.id || account.username || `account-${index}`,
    authuser: index,
    username: account.username || 'user',
    name: account.name ?? null,
    email: account.email ?? null,
    avatarUrl: account.avatarUrl ?? account.avatar_url ?? null,
  }));
}

export const AccountSheet: React.FC<AccountSheetProps> = ({
  isOpen,
  anchorEl,
  session,
  theme,
  onClose,
  onSignOut,
  onOpenSettings,
  onToggleTheme,
}) => {
  // Non-null means the shared widget could not open; show the local sheet.
  const [fallbackReason, setFallbackReason] = useState<string | null>(null);

  // Warm the module as soon as we know who is signed in, so the first tap is instant.
  useEffect(() => {
    if (session?.authenticated) preloadAccountWidget(ORIGIN);
  }, [session?.authenticated]);

  const open = useCallback(async () => {
    const accounts = toMenuAccounts(session);
    const activeIndex = Math.max(
      accounts.findIndex((account) => account.id === session?.activeId),
      0
    );

    const { state, opts } = buildAccountMenu({
      user: toMenuUser(session),
      accounts,
      activeId: accounts[activeIndex]?.id ?? null,
      authuser: activeIndex,
      theme,
      accountsWebOrigin: ORIGIN,
      href: window.location.href,
      anchorEl,
      extras: [
        {
          label: 'AI settings',
          onClick: () => {
            onClose();
            onOpenSettings();
          },
        },
        {
          label: theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme',
          onClick: () => onToggleTheme(),
        },
      ],
      handlers: {
        onSignOutAll: () => {
          onClose();
          onSignOut();
        },
        onError: (message) => setFallbackReason(message),
        onClose,
      },
    });

    const result = await openAccountWidget(ORIGIN, state, opts);
    if (result.ok) {
      setFallbackReason(null);
    } else {
      setFallbackReason((result as { message?: string }).message ?? 'Account widget unavailable');
    }
  }, [session, theme, anchorEl, onClose, onOpenSettings, onToggleTheme, onSignOut]);

  useEffect(() => {
    if (!isOpen) return;
    void open();
  }, [isOpen, open]);

  // Keep React in sync when the widget closes itself (Esc, backdrop tap).
  useEffect(() => {
    if (!isOpen) return;
    const timer = window.setInterval(() => {
      if (!isAccountWidgetOpen() && !fallbackReason) onClose();
    }, 400);
    return () => window.clearInterval(timer);
  }, [isOpen, fallbackReason, onClose]);

  if (!isOpen) return null;

  // The widget renders itself; nothing to draw here.
  if (!fallbackReason) return null;

  // --- Fallback: the shared widget could not load -------------------------
  const user = toMenuUser(session);
  const initial = (user.name || user.username || 'B').slice(0, 1).toUpperCase();

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-start sm:justify-end sm:p-4">
      <button
        type="button"
        aria-label="Close account menu"
        className="absolute inset-0 bg-black/40"
        onClick={() => {
          closeAccountWidget();
          onClose();
        }}
      />
      <div className="relative z-10 mb-[env(safe-area-inset-bottom)] w-full max-w-sm rounded-t-3xl border border-zinc-200 bg-white p-4 shadow-2xl sm:rounded-3xl dark:border-[#333333] dark:bg-[#212121]">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#0494f4] text-sm font-bold text-white">
            {user.avatarUrl ? (
              <img src={user.avatarUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              initial
            )}
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold text-neutral-800 dark:text-neutral-100">
              {user.name || user.username}
            </span>
            <span className="block truncate text-xs text-neutral-500 dark:text-neutral-400">
              {user.email}
            </span>
          </span>
        </div>

        <p className="mt-3 text-[11px] text-neutral-500 dark:text-neutral-400">
          Account centre load nahi ho paya: {accountWidgetError() || fallbackReason}
        </p>

        <div className="mt-3 divide-y divide-neutral-200 dark:divide-[#333333]">
          <a
            href={`${ORIGIN}/account`}
            className="flex min-h-[48px] items-center px-1 text-sm text-neutral-800 hover:bg-neutral-100 dark:text-neutral-200 dark:hover:bg-[#2a2a2a]"
          >
            Manage your Bansify Account
          </a>
          <button
            type="button"
            onClick={() => {
              onClose();
              onOpenSettings();
            }}
            className="flex min-h-[48px] w-full items-center px-1 text-left text-sm text-neutral-800 hover:bg-neutral-100 dark:text-neutral-200 dark:hover:bg-[#2a2a2a]"
          >
            AI settings
          </button>
          <button
            type="button"
            onClick={() => {
              onClose();
              onSignOut();
            }}
            className="flex min-h-[48px] w-full items-center px-1 text-left text-sm text-red-600 hover:bg-red-50 dark:hover:bg-[#2a2a2a]"
          >
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
};

export default AccountSheet;
