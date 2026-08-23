import React from 'react';
import { ShieldCheck, Radio, PlusCircle, LogOut, User, Shield } from 'lucide-react';
import { useUrbanGuard } from '../context/UrbanGuardContext';

export default function Header({ onReportClick }) {
  const { currentUser, logout } = useUrbanGuard();

  const isCitizen = currentUser?.role === 'CITIZEN';
  const isAuthority = currentUser?.role === 'AUTHORITY';

  return (
    <header className="sticky top-0 z-40 w-full bg-[#0f172a]/90 backdrop-blur-md border-b border-slate-800 px-4 md:px-6 py-3.5 flex flex-col md:flex-row justify-between items-center gap-3">

      {/* ── Brand ── */}
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-lg shadow-inner border ${
          isAuthority
            ? 'bg-red-950/40 border-red-500/30'
            : 'bg-blue-950/40 border-blue-500/30'
        }`}>
          <ShieldCheck className={`w-5 h-5 ${isAuthority ? 'text-red-400' : 'text-blue-400'} animate-pulse`} />
        </div>
        <div>
          <h1 className="text-base font-black tracking-tight text-white flex items-center gap-1.5 leading-none">
            UrbanGuard
            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded uppercase tracking-widest font-mono border ${
              isAuthority
                ? 'bg-red-900/30 text-red-400 border-red-500/20'
                : 'bg-blue-600/20 text-blue-400 border-blue-500/20'
            }`}>
              {isAuthority ? 'Command' : 'Civic'}
            </span>
          </h1>
          <p className="text-[10px] text-slate-400 mt-0.5 font-medium font-mono uppercase tracking-wider">
            Monsoon Civic Response System · Ward 14
          </p>
        </div>
      </div>

      {/* ── Right Controls ── */}
      <div className="flex flex-wrap items-center justify-center gap-2.5">

        {/* Socket Status Badge */}
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-900 border border-slate-800 text-[10px] font-semibold text-slate-300">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
          <Radio className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
          <span>🟢 Socket Active (Ward 14 - Cyberabad)</span>
        </div>

        {/* Citizen: Report New Hazard Button */}
        {isCitizen && (
          <button
            onClick={onReportClick}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white text-xs font-bold rounded-lg shadow-lg transition-all hover:scale-105 hover:shadow-blue-500/20 border border-blue-500/40 animate-pulse cursor-pointer"
          >
            <PlusCircle className="w-4 h-4" />
            + Report New Hazard
          </button>
        )}

        {/* User Profile Badge */}
        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-[11px] font-semibold ${
          isAuthority
            ? 'bg-red-950/30 border-red-500/30 text-red-300'
            : 'bg-slate-800/60 border-slate-700 text-slate-200'
        }`}>
          {isAuthority ? (
            <>
              <Shield className="w-3.5 h-3.5 text-red-400" />
              <span>🛡️ Officer ({currentUser?.name || 'GHMC Command Center'})</span>
            </>
          ) : (
            <>
              <User className="w-3.5 h-3.5 text-blue-400" />
              <span>👤 Citizen (Ward 14)</span>
            </>
          )}
        </div>

        {/* Logout Button */}
        <button
          onClick={logout}
          title="Logout and return to Authentication Gateway"
          className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800/60 hover:bg-slate-700 border border-slate-700/60 hover:border-slate-600 text-slate-300 hover:text-white rounded-lg text-xs font-semibold transition-all"
        >
          <LogOut className="w-3.5 h-3.5" />
          Logout
        </button>

      </div>
    </header>
  );
}
