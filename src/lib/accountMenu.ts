/**
 * The Bansify account menu — the same overlay Mail, Drive and the website open.
 * It is a small script served by the accounts app; we preload it so the first click
 * is instant, then hand it the session we already have.
 */

import type { BansifySession } from './bansifySession';
import { ACCOUNTS_WEB_ORIGIN } from './bansifySession';

const WIDGET_URL = `${ACCOUNTS_WEB_ORIGIN}/widget/account-menu.js`;
let loading: Promise<void> | null = null;

export function preloadAccountMenu(): void {
  if (typeof document === 'undefined') return;
  if ((window as unknown as { GothwadAccountMenu?: unknown }).GothwadAccountMenu) return;
  if (loading) return;
  loading = new Promise<void>((resolve) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${WIDGET_URL}"]`);
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true });
      resolve();
      return;
    }
    const script = document.createElement('script');
    script.src = WIDGET_URL;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => resolve();
    document.head.appendChild(script);
  });
}

export function openAccountMenu(session: BansifySession, anchor?: HTMLElement | null): void {
  preloadAccountMenu();
  const widget = (window as unknown as {
    GothwadAccountMenu?: { open: (state: unknown, options: unknown) => void };
  }).GothwadAccountMenu;

  widget?.open(
    {
      user: session.user,
      accounts: session.accounts,
      activeId: session.activeId,
      authuser: session.authuser,
    },
    {
      appDomain: 'bansify.com',
      accountsWebOrigin: ACCOUNTS_WEB_ORIGIN,
      accountsApiOrigin: 'https://api.bansify.com/api',
      ecosystemName: 'Bansify',
      anchorEl: anchor ?? null,
      manageAccountHref: `${ACCOUNTS_WEB_ORIGIN}/account`,
    },
  );
}
