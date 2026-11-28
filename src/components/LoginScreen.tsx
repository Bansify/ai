import React, { useState } from 'react';
import { createGuestToken } from '../services/workerClient';

const ACCOUNTS_URL =
  (import.meta as unknown as { env?: Record<string, string> }).env?.VITE_BANSIFY_ACCOUNTS_URL ||
  'https://accounts.bansify.com';

interface LoginScreenProps {
  onGuestSuccess?: (token: string) => void;
  onSuccess?: () => void;
}

export default function LoginScreen({ onGuestSuccess, onSuccess }: LoginScreenProps) {
  const [loadingGuest, setLoadingGuest] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleBansifyAccounts = () => {
    const redirectUri = encodeURIComponent(window.location.origin);
    window.location.href = `${ACCOUNTS_URL}/login?redirect=${redirectUri}`;
  };

  const handleGuest = async () => {
    setLoadingGuest(true);
    setError(null);
    try {
      const token = await createGuestToken();
      localStorage.setItem('bansify_guest_token', token);
      onGuestSuccess?.(token);
      onSuccess?.();
    } catch (err) {
      setError((err as Error).message || 'Guest login failed');
    } finally {
      setLoadingGuest(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 p-4">
      <div className="w-full max-w-sm rounded-3xl border border-zinc-200 dark:border-zinc-800 p-6 space-y-6">
        <div className="text-center space-y-2">
          <div
            className="w-14 h-14 rounded-2xl mx-auto flex items-center justify-center text-white font-bold text-2xl"
            style={{ background: 'linear-gradient(135deg, #2F6BFF, #7A5CFF)' }}
          >
            B
          </div>
          <h1 className="text-2xl font-semibold">Bansify AI</h1>
          <p className="text-sm text-zinc-500">Sign in with your Bansify Account or continue as Guest.</p>
        </div>

        {error && (
          <div className="p-3 rounded-xl text-sm text-white" style={{ backgroundColor: '#D93025' }}>
            {error}
          </div>
        )}

        <div className="space-y-3">
          <button
            onClick={handleBansifyAccounts}
            className="w-full py-3 px-4 rounded-2xl text-white font-medium text-sm transition-opacity hover:opacity-95"
            style={{ backgroundColor: '#2F6BFF' }}
          >
            Continue with Bansify Accounts
          </button>

          <button
            onClick={() => void handleGuest()}
            disabled={loadingGuest}
            className="w-full py-3 px-4 rounded-2xl border border-zinc-300 dark:border-zinc-700 font-medium text-sm hover:bg-zinc-50 dark:hover:bg-zinc-900 disabled:opacity-50"
          >
            {loadingGuest ? 'Starting guest session...' : 'Continue as Guest'}
          </button>
        </div>
      </div>
    </div>
  );
}
