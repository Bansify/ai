import React, { useEffect, useState } from 'react';
import LoginScreen from './components/LoginScreen';
import BansifyShell from './features/shell/BansifyShell';
import { wipeLegacyGothwadKeys } from './utils/wipeLegacyKeys';

function readInitialAuth(): boolean {
  try {
    const params = new URLSearchParams(window.location.search);
    const urlToken = params.get('token') || params.get('access_token');
    if (urlToken) {
      localStorage.setItem('bansify_session_token', urlToken);
      params.delete('token');
      params.delete('access_token');
      const cleanSearch = params.toString();
      const nextUrl = window.location.pathname + (cleanSearch ? `?${cleanSearch}` : '') + window.location.hash;
      window.history.replaceState({}, '', nextUrl);
      return true;
    }
    return Boolean(
      localStorage.getItem('bansify_session_token') ||
      localStorage.getItem('bansify_guest_token')
    );
  } catch {
    return false;
  }
}

export default function App() {
  const [authenticated, setAuthenticated] = useState<boolean>(readInitialAuth);
  const [legacyNotice, setLegacyNotice] = useState<boolean>(false);

  useEffect(() => {
    if (wipeLegacyGothwadKeys()) {
      setLegacyNotice(true);
      const t = setTimeout(() => setLegacyNotice(false), 5000);
      return () => clearTimeout(t);
    }
  }, []);

  const handleSignOut = () => {
    localStorage.removeItem('bansify_session_token');
    localStorage.removeItem('bansify_guest_token');
    setAuthenticated(false);
  };

  return (
    <>
      {legacyNotice && (
        <div className="fixed top-3 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-full text-xs font-medium text-white bg-[#212121] border border-white/10 shadow-lg">
          Keys ab server par rehti hain.
        </div>
      )}
      {authenticated ? (
        <BansifyShell onSignOut={handleSignOut} />
      ) : (
        <LoginScreen onSuccess={() => setAuthenticated(true)} />
      )}
    </>
  );
}
