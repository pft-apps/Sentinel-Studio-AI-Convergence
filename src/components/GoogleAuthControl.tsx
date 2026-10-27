import React, { useEffect, useState } from 'react';
import { googleAuth, GoogleAuthState } from '../googleAuth';

interface GoogleAuthControlProps {
  variant?: 'header' | 'card' | 'compact';
  className?: string;
  onSuccess?: () => void;
}

export const GoogleAuthControl: React.FC<GoogleAuthControlProps> = ({
  variant = 'header',
  className = '',
  onSuccess,
}) => {
  const [authState, setAuthState] = useState<GoogleAuthState>(googleAuth.getState());
  const [showDetails, setShowDetails] = useState<boolean>(false);

  useEffect(() => {
    const unsubscribe = googleAuth.subscribe((newState) => {
      setAuthState(newState);
      if (newState.status === 'authenticated' && onSuccess) {
        onSuccess();
      }
    });
    return unsubscribe;
  }, [onSuccess]);

  const handleSignIn = async () => {
    await googleAuth.signIn();
  };

  const handleCancel = async () => {
    await googleAuth.cancel();
  };

  const handleSignOut = async () => {
    await googleAuth.signOut();
    setShowDetails(false);
  };

  const handleOpenConfig = () => {
    googleAuth.openConfigModal();
  };

  // 1. State: Waiting for authentication in external browser...
  if (authState.status === 'listening') {
    if (variant === 'card') {
      return (
        <div
          className={`flex flex-col items-center justify-center p-6 text-center space-y-4 rounded-2xl bg-amber-50/50 dark:bg-amber-950/20 border-2 border-dashed border-amber-300 dark:border-amber-700/60 ${className}`}
        >
          <div className="w-12 h-12 rounded-2xl bg-amber-100 dark:bg-amber-900/60 flex items-center justify-center text-amber-600 dark:text-amber-400">
            <div className="w-6 h-6 border-3 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
          <div className="space-y-1">
            <h4 className="font-bold text-sm text-gray-900 dark:text-white">
              Waiting for authentication in external browser...
            </h4>
            <p className="text-xs text-gray-600 dark:text-slate-300 max-w-sm">
              Please complete Google Sign-In in your default browser tab. The local loopback server is listening on:
            </p>
            <div className="inline-block mt-1 px-2.5 py-0.5 rounded-full bg-amber-200/80 dark:bg-amber-900/80 font-mono text-[11px] font-bold text-amber-900 dark:text-amber-200">
              http://127.0.0.1:{authState.loopbackPort || '0'}/auth/callback
            </div>
          </div>
          <div className="flex items-center gap-2 pt-2">
            <button
              onClick={handleCancel}
              className="px-4 py-2 rounded-xl bg-gray-200 hover:bg-gray-300 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-800 dark:text-slate-200 text-xs font-bold transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={handleSignIn}
              className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold transition shadow-xs cursor-pointer"
            >
              Retry / Relaunch
            </button>
          </div>
        </div>
      );
    }

    // Header or compact variant
    return (
      <div
        className={`flex items-center gap-2 px-3 py-1.5 rounded-xl bg-amber-50 dark:bg-amber-950/70 border border-amber-300 dark:border-amber-700/80 text-amber-900 dark:text-amber-200 text-xs shadow-xs animate-pulse ${className}`}
      >
        <div className="w-3.5 h-3.5 border-2 border-amber-600 dark:border-amber-400 border-t-transparent rounded-full animate-spin shrink-0"></div>
        <div className="flex items-center gap-1.5 truncate">
          <span className="font-semibold hidden sm:inline">Waiting for browser...</span>
          <span className="font-semibold sm:hidden">Waiting...</span>
          <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-amber-200/80 dark:bg-amber-900/80 text-amber-950 dark:text-amber-200">
            127.0.0.1:{authState.loopbackPort || '...'}
          </span>
        </div>
        <button
          onClick={handleCancel}
          className="ml-1 px-2 py-0.5 rounded-lg bg-amber-200 hover:bg-amber-300 dark:bg-amber-800 dark:hover:bg-amber-700 text-amber-950 dark:text-amber-100 font-bold text-[11px] transition cursor-pointer"
          title="Cancel external browser listener"
        >
          Cancel
        </button>
      </div>
    );
  }

  // 2. State: Authenticated with Active Session
  if (authState.status === 'authenticated' && authState.user) {
    const user = authState.user;
    const initial = (user.name || user.email || 'G').charAt(0).toUpperCase();

    if (variant === 'card') {
      return (
        <div
          className={`p-5 rounded-2xl bg-white dark:bg-intel-900 border border-emerald-300 dark:border-emerald-800/80 shadow-md space-y-4 ${className}`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-emerald-600 text-white font-bold text-lg flex items-center justify-center overflow-hidden shadow">
                {user.picture ? (
                  <img src={user.picture} alt={user.name} className="w-full h-full object-cover" />
                ) : (
                  initial
                )}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="font-bold text-sm text-gray-950 dark:text-white">{user.name}</h4>
                  <span className="text-[9px] px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 font-mono font-bold">
                    ✓ Google Verified
                  </span>
                </div>
                <p className="text-xs text-gray-500 dark:text-slate-400 font-mono">{user.email}</p>
              </div>
            </div>
            <button
              onClick={handleSignOut}
              className="px-3 py-1.5 rounded-xl bg-red-50 hover:bg-red-100 dark:bg-red-950/40 dark:hover:bg-red-900/60 text-red-600 dark:text-red-300 text-xs font-bold border border-red-200 dark:border-red-800 transition cursor-pointer"
            >
              Sign Out
            </button>
          </div>

          <div className="p-3 rounded-xl bg-gray-50 dark:bg-intel-850 border border-gray-200 dark:border-intel-border space-y-1.5 text-xs">
            <div className="flex justify-between text-[11px] text-gray-600 dark:text-slate-300">
              <span>Authentication Protocol:</span>
              <span className="font-mono font-semibold text-blue-600 dark:text-cyan-400">
                Desktop App Loopback (RFC 8252)
              </span>
            </div>
            <div className="flex justify-between text-[11px] text-gray-600 dark:text-slate-300">
              <span>WebAuthn / Passkey Status:</span>
              <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                Native Browser Verified
              </span>
            </div>
            <div className="flex justify-between text-[11px] text-gray-600 dark:text-slate-300">
              <span>OAuth Client ID:</span>
              <span className="font-mono text-gray-500 dark:text-slate-400 truncate max-w-[180px]">
                {authState.clientId}
              </span>
            </div>
          </div>
        </div>
      );
    }

    // Header or compact variant
    return (
      <div className={`relative ${className}`}>
        <button
          onClick={() => setShowDetails(!showDetails)}
          className="flex items-center gap-2 px-2.5 py-1 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800 hover:border-emerald-500 text-emerald-950 dark:text-emerald-100 transition shadow-2xs cursor-pointer"
          title="Active Google Session (Click to view session details or sign out)"
        >
          <div className="w-6 h-6 rounded-full bg-emerald-600 text-white font-bold text-[11px] flex items-center justify-center overflow-hidden shrink-0 shadow-2xs">
            {user.picture ? (
              <img src={user.picture} alt={user.name} className="w-full h-full object-cover" />
            ) : (
              initial
            )}
          </div>
          <div className="text-left hidden lg:block leading-tight">
            <div className="text-xs font-bold text-gray-900 dark:text-white truncate max-w-[110px]">
              {user.name}
            </div>
            <div className="text-[9px] text-emerald-700 dark:text-emerald-400 font-mono truncate max-w-[120px]">
              {user.email}
            </div>
          </div>
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-200 dark:bg-emerald-900/90 text-emerald-800 dark:text-emerald-200 font-mono font-bold hidden sm:inline">
            Google ID
          </span>
          <svg
            className={`w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400 transition-transform ${
              showDetails ? 'rotate-180' : ''
            }`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {showDetails && (
          <div className="absolute right-0 mt-1.5 w-72 bg-white dark:bg-intel-900 border border-gray-200 dark:border-intel-border rounded-2xl shadow-2xl p-4 z-50 text-xs space-y-3">
            <div className="flex items-center gap-3 pb-3 border-b border-gray-200 dark:border-intel-border">
              <div className="w-10 h-10 rounded-full bg-blue-600 text-white font-bold text-base flex items-center justify-center shrink-0 shadow">
                {initial}
              </div>
              <div className="min-w-0">
                <div className="font-bold text-gray-950 dark:text-white truncate">{user.name}</div>
                <div className="text-[11px] text-gray-500 dark:text-slate-400 truncate">{user.email}</div>
                <span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 font-mono font-bold">
                  ✓ PKCE Loopback Verified
                </span>
              </div>
            </div>

            <div className="space-y-1.5 text-[11px] font-mono text-gray-600 dark:text-slate-300">
              <div className="flex justify-between">
                <span>Application Type:</span>
                <span className="font-bold text-blue-600 dark:text-cyan-400">Desktop App</span>
              </div>
              <div className="flex justify-between">
                <span>Loopback Status:</span>
                <span className="text-emerald-600 dark:text-emerald-400 font-semibold">Ready</span>
              </div>
            </div>

            <div className="pt-2 border-t border-gray-200 dark:border-intel-border flex items-center justify-between gap-2">
              <button
                onClick={handleOpenConfig}
                className="px-2.5 py-1 text-[11px] rounded-lg bg-gray-100 hover:bg-gray-200 dark:bg-intel-850 dark:hover:bg-intel-800 text-gray-800 dark:text-slate-200 font-semibold transition cursor-pointer"
              >
                ⚙️ Config
              </button>
              <button
                onClick={handleSignOut}
                className="px-3 py-1 text-[11px] rounded-lg bg-red-600 hover:bg-red-700 text-white font-bold transition shadow-xs cursor-pointer flex items-center gap-1"
              >
                <span>🚪</span> Sign Out
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // 3. State: Unauthenticated (Explicit "Sign in with Google" button)
  return (
    <div className={`flex items-center gap-1.5 ${className}`}>
      <button
        onClick={handleSignIn}
        className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white hover:bg-gray-50 dark:bg-intel-850 dark:hover:bg-intel-800 text-gray-800 dark:text-white border border-gray-300 dark:border-intel-border text-xs font-semibold shadow-xs transition duration-150 cursor-pointer"
        title="Sign in with Google via Desktop Loopback Flow (Resolves WebAuthn & Passkey Blocks)"
      >
        {/* Google G Logo */}
        <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
          <path
            fill="#4285F4"
            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
          />
          <path
            fill="#34A853"
            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
          />
          <path
            fill="#FBBC05"
            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
          />
          <path
            fill="#EA4335"
            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
          />
        </svg>
        <span className="hidden sm:inline font-bold">Sign in with Google</span>
        <span className="sm:hidden font-bold">Google</span>
      </button>

      <button
        onClick={handleOpenConfig}
        className="p-1.5 rounded-xl text-gray-500 hover:text-gray-900 dark:text-slate-400 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-intel-800 transition cursor-pointer"
        title="Google Cloud Console OAuth 2.0 Desktop Configuration"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
          />
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
          />
        </svg>
      </button>
    </div>
  );
};
