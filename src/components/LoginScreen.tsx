import React, { useState } from 'react';

const ACCOUNTS_URL =
  (import.meta as unknown as { env?: Record<string, string> }).env?.VITE_BANSIFY_ACCOUNTS_URL ||
  'https://accounts.bansify.com';

interface LoginScreenProps {
  onSuccess?: () => void;
}

export default function LoginScreen({ onSuccess }: LoginScreenProps) {
  const [error, setError] = useState<string | null>(null);

  const handleBansifyAccounts = () => {
    const redirectUri = encodeURIComponent(window.location.origin);
    window.location.href = `${ACCOUNTS_URL}/login?redirect=${redirectUri}`;
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
          <p className="text-sm text-zinc-500">Sign in with your Bansify Account to continue.</p>
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

        </div>
      </div>
    </div>
  );
}
