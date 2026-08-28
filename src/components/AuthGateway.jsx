import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldCheck, User, Lock, Smartphone, Radio, AlertTriangle, LogIn, ChevronRight, Zap, Eye, EyeOff } from 'lucide-react';
import { useUrbanGuard } from '../context/UrbanGuardContext';

// AUTHORITY_PATTERN kept purely as a cosmetic UX hint — it no longer gates
// access. The real security boundary is the server-side bcrypt check.
const AUTHORITY_PATTERN = /^GHMC[-_]?/i;

const API_BASE = import.meta.env.VITE_API_BASE_URL || '';

/**
 * Safely parse a fetch Response as JSON.
 * If the server returns HTML (e.g. Vercel 404 page), this throws a clear
 * error instead of an opaque SyntaxError.
 */
async function safeJson(res) {
  const ct = res.headers.get('content-type') || '';
  if (!ct.includes('application/json')) {
    const text = await res.text();
    throw new Error(
      `Server returned non-JSON response (${res.status}): ${text.slice(0, 200)}`
    );
  }
  return res.json();
}


export default function AuthGateway() {
  const { loginCitizen, loginAuthority } = useUrbanGuard();

  const [mode, setMode] = useState('citizen');
  const [citizenContact, setCitizenContact] = useState('');
  const [citizenError, setCitizenError] = useState('');
  const [deptId, setDeptId] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [authError, setAuthError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // ── Citizen login ────────────────────────────────────────────────────────
  const handleCitizenSubmit = async (e) => {
    e?.preventDefault();
    setCitizenError('');

    // Cosmetic hint — no longer a real security gate
    if (AUTHORITY_PATTERN.test(citizenContact.trim())) {
      setCitizenError('⚠️ This looks like an authority ID. Switch to the Municipal Authority tab to log in.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name: citizenContact.trim() || 'Ward 14 Guest Resident' }),
      });
      const data = await safeJson(res);
      if (!res.ok) throw new Error(data.error || 'Login failed');
      loginCitizen(data.user.name);
    } catch (err) {
      setCitizenError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGuestLogin = async () => {
    setCitizenError('');
    setIsLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name: 'Ward 14 Guest Resident' }),
      });
      const data = await safeJson(res);
      if (!res.ok) throw new Error(data.error || 'Login failed');
      loginCitizen(data.user.name);
    } catch (err) {
      setCitizenError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // ── Authority login ──────────────────────────────────────────────────────
  const handleAuthoritySubmit = async (e) => {
    e.preventDefault();
    setAuthError('');
    setIsLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/auth/authority-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ badge_id: deptId.trim(), password }),
      });
      const data = await safeJson(res);
      if (!res.ok) throw new Error(data.error || 'Authentication failed');
      loginAuthority(data.user.name);
    } catch (err) {
      setAuthError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const switchMode = (newMode) => {
    setMode(newMode);
    setCitizenError('');
    setAuthError('');
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#0f172a] overflow-hidden">

      {/* Animated Background Grid */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div
          className="absolute inset-0 opacity-[0.035]"
          style={{
            backgroundImage: `linear-gradient(rgba(37,99,235,0.8) 1px, transparent 1px),
              linear-gradient(90deg, rgba(37,99,235,0.8) 1px, transparent 1px)`,
            backgroundSize: '56px 56px',
          }}
        />
        {/* Radial glow */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_55%_at_50%_55%,rgba(37,99,235,0.07),transparent_70%)]" />
        {/* Scan-line sweep */}
        <motion.div
          className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-blue-500/50 to-transparent"
          animate={{ y: ['0vh', '100vh'] }}
          transition={{ duration: 6, repeat: Infinity, ease: 'linear', repeatDelay: 2.5 }}
        />
        {/* Corner tech accents */}
        <div className="absolute top-6 left-6 w-10 h-10 border-t-2 border-l-2 border-blue-500/25 rounded-tl" />
        <div className="absolute top-6 right-6 w-10 h-10 border-t-2 border-r-2 border-blue-500/25 rounded-tr" />
        <div className="absolute bottom-6 left-6 w-10 h-10 border-b-2 border-l-2 border-blue-500/25 rounded-bl" />
        <div className="absolute bottom-6 right-6 w-10 h-10 border-b-2 border-r-2 border-blue-500/25 rounded-br" />
        {/* Floating orbs */}
        <motion.div
          className="absolute top-1/4 -left-20 w-64 h-64 rounded-full bg-blue-600/5 blur-3xl"
          animate={{ x: [0, 30, 0], opacity: [0.4, 0.7, 0.4] }}
          transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          className="absolute bottom-1/4 -right-20 w-64 h-64 rounded-full bg-red-600/4 blur-3xl"
          animate={{ x: [0, -30, 0], opacity: [0.3, 0.6, 0.3] }}
          transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut' }}
        />
      </div>

      {/* Live Socket Badge — top center */}
      <div className="absolute top-5 left-1/2 -translate-x-1/2 flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-900/85 border border-slate-800 backdrop-blur-md text-[10px] font-semibold text-slate-300 whitespace-nowrap shadow-lg">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
        <Radio className="w-3 h-3 text-emerald-400" />
        <span>🟢 Live Socket Active — Ward 14 (Cyberabad)</span>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 28, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="w-full max-w-md relative z-10 px-4"
      >
        {/* Brand Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-blue-950/60 border border-blue-500/30 shadow-2xl mb-4 relative">
            <ShieldCheck className="w-8 h-8 text-blue-400" />
            <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-emerald-500 border-2 border-[#0f172a] animate-pulse" />
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight">UrbanGuard</h1>
          <p className="text-sm font-bold text-blue-400 mt-0.5 tracking-wide">Monsoon Civic Response System</p>
          <p className="text-[11px] text-slate-500 font-mono mt-1.5 uppercase tracking-widest">Ward 14 — Cyberabad, GHMC</p>
        </div>

        {/* Main Login Card */}
        <div className="bg-slate-900/80 backdrop-blur-xl border border-slate-800/80 rounded-2xl shadow-2xl overflow-hidden">

          {/* Mode Toggle Tabs */}
          <div className="flex border-b border-slate-800">
            <button
              onClick={() => switchMode('citizen')}
              className={`flex-1 flex items-center justify-center gap-2 py-3.5 text-xs font-bold uppercase tracking-wider transition-all ${
                mode === 'citizen'
                  ? 'bg-blue-600/15 text-blue-400 border-b-2 border-blue-500'
                  : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/30'
              }`}
            >
              <User className="w-3.5 h-3.5" />
              Citizen Portal
            </button>
            <button
              onClick={() => switchMode('authority')}
              className={`flex-1 flex items-center justify-center gap-2 py-3.5 text-xs font-bold uppercase tracking-wider transition-all ${
                mode === 'authority'
                  ? 'bg-red-950/30 text-red-400 border-b-2 border-red-500'
                  : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/30'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              Municipal Authority
            </button>
          </div>

          <AnimatePresence mode="wait">
            {/* CITIZEN MODE */}
            {mode === 'citizen' && (
              <motion.div
                key="citizen"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.2 }}
                className="p-6 flex flex-col gap-4"
              >
                <div className="flex flex-col gap-1.5">
                  <h2 className="text-base font-bold text-slate-100">Welcome, Resident</h2>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Report hazards, track civic issues, and participate in community safety responses for Ward 14.
                  </p>
                </div>

                <form onSubmit={handleCitizenSubmit} className="flex flex-col gap-3">
                  <div>
                    <label className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold mb-1 block">Mobile Number (10 digits, Optional)</label>
                    <div className="relative">
                      <Smartphone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                      <input
                        type="text"
                        placeholder="+91 98765 43210"
                        value={citizenContact}
                        onChange={(e) => { setCitizenContact(e.target.value); setCitizenError(''); }}
                        className="w-full pl-9 pr-4 py-2.5 bg-slate-950/60 border border-slate-800 rounded-lg text-slate-200 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 placeholder-slate-600 transition-all"
                      />
                    </div>
                  </div>

                  {/* Citizen Error Banner */}
                  <AnimatePresence>
                    {citizenError && (
                      <motion.div
                        initial={{ opacity: 0, height: 0, marginTop: 0 }}
                        animate={{ opacity: 1, height: 'auto', marginTop: 0 }}
                        exit={{ opacity: 0, height: 0 }}
                        className="flex items-start gap-2 p-3 bg-amber-950/50 border border-amber-500/50 rounded-lg text-xs text-amber-200 font-medium overflow-hidden"
                      >
                        <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                        <span>{citizenError}</span>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full py-3 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-bold rounded-lg text-sm transition-all flex items-center justify-center gap-2 shadow-lg hover:shadow-blue-500/20 disabled:opacity-60"
                  >
                    {isLoading ? (
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <>
                        <LogIn className="w-4 h-4" />
                        Access Citizen Portal
                      </>
                    )}
                  </button>
                </form>

                {/* Divider */}
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-px bg-slate-800" />
                  <span className="text-[10px] text-slate-600 font-medium">OR</span>
                  <div className="flex-1 h-px bg-slate-800" />
                </div>

                {/* 1-Click Guest Login */}
                <button
                  onClick={handleGuestLogin}
                  disabled={isLoading}
                  className="w-full py-2.5 bg-slate-800/60 hover:bg-slate-800 border border-slate-700 text-slate-300 font-semibold rounded-lg text-sm transition-all flex items-center justify-center gap-2 hover:border-slate-600 disabled:opacity-60"
                >
                  <ChevronRight className="w-4 h-4 text-emerald-400" />
                  Continue as Ward 14 Resident
                </button>

                <div className="flex items-start gap-2 p-2.5 bg-blue-950/20 border border-blue-900/30 rounded-lg text-[10px] text-blue-300 leading-relaxed">
                  <Zap className="w-3.5 h-3.5 text-blue-400 shrink-0 mt-0.5" />
                  <span>Report hazards, upvote community issues, and track status via interactive map. Your data helps prioritize GHMC dispatch times.</span>
                </div>
              </motion.div>
            )}

            {/* AUTHORITY MODE */}
            {mode === 'authority' && (
              <motion.div
                key="authority"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
                className="p-6 flex flex-col gap-4"
              >
                <div className="flex flex-col gap-1.5">
                  <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-red-400" />
                    Authority Access Gateway
                  </h2>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Restricted to GHMC municipal officers. Unauthorized access attempts are logged and audited.
                  </p>
                </div>

                <form onSubmit={handleAuthoritySubmit} className="flex flex-col gap-3">
                  <div>
                    <label className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold mb-1 block">Official Employee ID / Badge Number</label>
                    <div className="relative">
                      <ShieldCheck className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                      <input
                        type="text"
                        placeholder="e.g. GHMC-ENG-2026"
                        value={deptId}
                        onChange={(e) => { setDeptId(e.target.value); setAuthError(''); }}
                        className="w-full pl-9 pr-4 py-2.5 bg-slate-950/60 border border-slate-800 rounded-lg text-slate-200 text-sm focus:outline-none focus:border-red-500/50 focus:ring-1 focus:ring-red-500/10 placeholder-slate-600 transition-all"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold mb-1 block">Badge Password</label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => { setPassword(e.target.value); setAuthError(''); }}
                        className="w-full pl-9 pr-10 py-2.5 bg-slate-950/60 border border-slate-800 rounded-lg text-slate-200 text-sm focus:outline-none focus:border-red-500/50 focus:ring-1 focus:ring-red-500/10 placeholder-slate-600 transition-all"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Auth Error Banner */}
                  <AnimatePresence>
                    {authError && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="flex items-center gap-2 p-2.5 bg-red-950/50 border border-red-500/40 rounded-lg text-xs text-red-300 font-medium overflow-hidden"
                      >
                        <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                        {authError}
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full py-3 bg-red-700 hover:bg-red-600 active:bg-red-800 text-white font-bold rounded-lg text-sm transition-all flex items-center justify-center gap-2 shadow-lg hover:shadow-red-700/20 disabled:opacity-60"
                  >
                    {isLoading ? (
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <>
                        <ShieldCheck className="w-4 h-4" />
                        Authenticate &amp; Enter Command Center
                      </>
                    )}
                  </button>
                </form>

                <div className="flex items-start gap-2 p-2.5 bg-red-950/15 border border-red-900/25 rounded-lg text-[10px] text-red-300/70 leading-relaxed">
                  <AlertTriangle className="w-3.5 h-3.5 text-red-400/70 shrink-0 mt-0.5" />
                  <span>Authority accounts have dispatch, escalation, and resolution capabilities. Citizen complaint submission is disabled for this role. All actions are audit-logged.</span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer */}
        <p className="text-center text-[10px] text-slate-600 font-mono mt-6 uppercase tracking-widest">
          UrbanGuard Civic Response System © 2026 · GHMC Ward 14 · Cyberabad
        </p>
      </motion.div>
    </div>
  );
}