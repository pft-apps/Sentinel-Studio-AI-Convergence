/**
 * =====================================================================
 * SENTINEL STUDIO™ — EXECUTIVE WORKSTATION REACT ROOT
 * =====================================================================
 */

import React from 'react';
import { GoogleAuthControl } from './components/GoogleAuthControl';

export default function App() {
  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 p-8 flex flex-col items-center justify-center">
      <div className="max-w-xl w-full bg-slate-800 border border-slate-700 rounded-2xl p-6 shadow-2xl space-y-6">
        <div className="flex items-center justify-between border-b border-slate-700 pb-4">
          <div>
            <h1 className="text-lg font-bold text-white flex items-center gap-2">
              <span>🛡️</span> Sentinel Studio Desktop Authentication
            </h1>
            <p className="text-xs text-slate-400">
              Desktop App OAuth 2.0 Loopback (RFC 8252 &amp; PKCE)
            </p>
          </div>
          <span className="text-[10px] px-2.5 py-1 rounded-full bg-cyan-950 text-cyan-400 border border-cyan-800 font-mono font-bold">
            127.0.0.1:0 Loopback
          </span>
        </div>

        <div className="space-y-3">
          <label className="text-xs font-semibold text-slate-300">Google Authentication Status</label>
          <GoogleAuthControl variant="card" />
        </div>

        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-700/60 text-xs text-slate-400 space-y-2">
          <div className="font-semibold text-cyan-400 flex items-center gap-1.5">
            <span>ℹ️</span> Security Rationale
          </div>
          <p className="text-[11px] leading-relaxed">
            Embedded web containers, WebViews, and iframes are strictly blocked by Google for WebAuthn, passkeys, and account authentication (Disallowed User-Agent error). This workstation uses the desktop loopback pattern: opening an external browser and receiving tokens securely at an ephemeral loopback endpoint.
          </p>
        </div>
      </div>
    </div>
  );
}
