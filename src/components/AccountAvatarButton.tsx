// =============================================================================
// The profile avatar in the header — the same entry point Mail has.
//
// Ported from Bansify Mail (`src/components/AccountAvatarButton.tsx`) so the two
// products behave identically: the avatar is the door to the account sheet, and
// when more than one account is signed in it shows a stacked "+n" bubble. The
// button hands its own element to the caller because the shared widget positions
// its card directly under whichever avatar was tapped.
// =============================================================================

import React from 'react';

export interface AccountAvatarButtonProps {
  name?: string | null;
  username?: string | null;
  avatarUrl?: string | null;
  /** How many accounts are signed in (drives the "+n" bubble). */
  accountCount?: number;
  /** Tighter sizing for the narrow right-hand dock. */
  compact?: boolean;
  onOpen: (anchor: HTMLElement) => void;
}

export const AccountAvatarButton: React.FC<AccountAvatarButtonProps> = ({
  name,
  username,
  avatarUrl,
  accountCount = 1,
  compact = false,
  onOpen,
}) => {
  const initial = (name || username || 'B').slice(0, 1).toUpperCase();
  const size = compact ? 'h-9 w-9' : 'h-10 w-10';
  const bubbleSize = compact ? '-mr-1.5 h-6 w-6 text-[9px]' : '-mr-2.5 h-8 w-8 text-[10px]';
  const others = Math.max(accountCount - 1, 0);

  return (
    <button
      type="button"
      onClick={(event) => onOpen(event.currentTarget)}
      className={`relative flex shrink-0 items-center rounded-full shadow-sm transition-opacity hover:opacity-90 ${
        compact ? 'h-9' : 'h-10'
      }`}
      aria-label={accountCount > 1 ? `Accounts (${accountCount})` : 'Account'}
      aria-haspopup="dialog"
      title={accountCount > 1 ? 'Switch account' : 'Account'}
    >
      {others > 0 && (
        <span
          className={`${bubbleSize} flex items-center justify-center rounded-full border-2 border-white bg-neutral-400 font-bold text-white dark:border-[#212121] dark:bg-neutral-600`}
        >
          +{others}
        </span>
      )}
      <span
        className={`${size} flex items-center justify-center overflow-hidden rounded-full bg-[#0494f4] text-[13px] font-bold tracking-tight text-white`}
      >
        {avatarUrl ? (
          <img src={avatarUrl} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
        ) : (
          initial
        )}
      </span>
    </button>
  );
};

export default AccountAvatarButton;
