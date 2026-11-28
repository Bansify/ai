// =============================================================================
// Maps Bansify AI's session onto the shared account widget's `open(state, opts)`.
//
// Copied from Bansify Mail (`src/services/accountMenu.ts`) on purpose: the sheet
// is Accounts-hosted, so the only thing each app supplies is this mapping. Mail's
// shape is the contract the widget expects — the previous AI code passed a
// different set of options (appDomain / accountsApiOrigin / manageAccountHref and
// no handlers), which is why the sheet never opened at all.
//
// Pure: no React, no DOM reads beyond what is passed in.
// =============================================================================

export interface MenuUser {
  username: string;
  name: string | null;
  firstName?: string;
  lastName?: string;
  email: string;
  avatarUrl?: string | null;
}

export interface MenuAccount {
  id: string;
  authuser: number;
  username: string;
  name?: string | null;
  email?: string | null;
  avatarUrl?: string | null;
}

/** One extra row the sheet shows under the account list (Settings, Theme). */
export interface MenuExtraAction {
  label: string;
  onClick: () => void;
}

export interface BuildMenuArgs {
  user: MenuUser;
  accounts: MenuAccount[];
  activeId: string | null;
  authuser: number;
  theme: 'light' | 'dark';
  accountsWebOrigin: string;
  /** Current address, used as the return target after "Add another account". */
  href: string;
  anchorEl: HTMLElement | null;
  extras?: MenuExtraAction[];
  handlers: {
    onSignOutAccount?: (slotId: string) => void;
    onSignOutAll?: () => void;
    onError?: (message: string) => void;
    onClose: () => void;
  };
}

export interface AccountMenuInput {
  state: Record<string, unknown>;
  opts: Record<string, unknown>;
}

function trimOrigin(raw: string): string {
  return (raw || '').trim().replace(/\/+$/, '');
}

/** Google's `/u/<n>/` shape: a path, so Ctrl/middle-click stays inside the app. */
export function accountHrefFor(account: { authuser?: number }): string {
  const index = Number.isInteger(account.authuser) ? Math.min(Math.max(account.authuser ?? 0, 0), 5) : 0;
  return `/u/${index}/`;
}

/** Accounts' profile page for this account. */
export function manageHrefFor(accountsWebOrigin: string, authuser: number): string {
  const origin = trimOrigin(accountsWebOrigin);
  const index = Number.isInteger(authuser) ? Math.min(Math.max(authuser, 0), 5) : 0;
  return origin ? `${origin}/u/${index}/me` : '';
}

/** Builds the two arguments the widget's `open()` expects. */
export function buildAccountMenu(args: BuildMenuArgs): AccountMenuInput {
  const origin = trimOrigin(args.accountsWebOrigin);

  const state = {
    user: {
      username: args.user.username,
      name: args.user.name,
      firstName: args.user.firstName ?? '',
      lastName: args.user.lastName ?? '',
      email: args.user.email,
      avatarUrl: args.user.avatarUrl ?? null,
    },
    accounts: args.accounts,
    activeId: args.activeId,
    authuser: args.authuser,
  };

  const opts = {
    anchorEl: args.anchorEl,
    theme: args.theme,
    accountHref: accountHrefFor,
    nextUrl: args.href,
    manageAccountHref: manageHrefFor(origin, args.authuser),
    ...(origin ? { accountsWebOrigin: origin } : {}),
    ecosystemName: 'Bansify',
    extraActions: args.extras ?? [],
    ...(args.handlers.onSignOutAccount ? { onSignOutAccount: args.handlers.onSignOutAccount } : {}),
    ...(args.handlers.onSignOutAll ? { onSignOutAll: args.handlers.onSignOutAll } : {}),
    ...(args.handlers.onError ? { onError: args.handlers.onError } : {}),
    onClose: args.handlers.onClose,
  };

  return { state, opts };
}
