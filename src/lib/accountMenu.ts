/**
 * The Bansify account menu — the same overlay Mail, Drive and the website open.
 * It is a small script served by the accounts app; we preload it so the first click
 * is instant, then hand it the session we already have.
 */

import type { BansifySession } from './bansifySession';
import { ACCOUNTS_WEB_ORIGIN } from './bansifySession';

const WIDGET_URL = `${ACCOUNTS_WEB_ORIGIN}/widget/account-menu.js`;
let loading: Promise<void> | null = null;

export function preloadAccountMenu(): Promise<void> {
  if (typeof document === 'undefined') return Promise.resolve();
  if ((window as unknown as { GothwadAccountMenu?: unknown }).GothwadAccountMenu) return Promise.resolve();
  if (loading) return loading;
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
  return loading;
}

/**
 * Opens the shared account control centre (the same sheet Mail and Drive show).
 *
 * Returns `true` when the widget took the click. The caller uses that to decide
 * whether to fall back to a navigation, so a click never does nothing.
 */
export function openAccountMenu(session: BansifySession, anchor?: HTMLElement | null): boolean {
  const widget = (window as unknown as {
    GothwadAccountMenu?: { open: (state: unknown, options: unknown) => void };
  }).GothwadAccountMenu;

  if (!widget) {
    // First click before the script finished loading: load it, then open.
    preloadAccountMenu().then(() => {
      const ready = (window as unknown as {
        GothwadAccountMenu?: { open: (state: unknown, options: unknown) => void };
      }).GothwadAccountMenu;
      if (ready) {
        openWith(ready, session, anchor);
      } else if (typeof window !== 'undefined') {
        window.location.href = `${ACCOUNTS_WEB_ORIGIN}/account`;
      }
    });
    return true;
  }

  openWith(widget, session, anchor);
  return true;
}

function openWith(
  widget: { open: (state: unknown, options: unknown) => void },
  session: BansifySession,
  anchor?: HTMLElement | null
): void {

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
