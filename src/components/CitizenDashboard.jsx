import React, { useState } from 'react';
import { useUrbanGuard } from '../context/UrbanGuardContext';
import MapContainer from './MapContainer';
import { AlertCircle, ThumbsUp, MapPin, Compass, PlusCircle, Droplets, Activity, TrendingUp } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const SEVERITY_BADGE = {
  CRITICAL: 'text-red-300 bg-red-950/50 border border-red-500/40',
  HIGH: 'text-orange-300 bg-orange-950/50 border border-orange-500/30',
  MEDIUM: 'text-yellow-300 bg-yellow-950/50 border border-yellow-500/30',
};

const STATUS_BADGE = {
  ESCALATED: 'text-red-400 bg-red-950/40 border border-red-500/30 animate-pulse',
  IN_PROGRESS: 'text-blue-400 bg-blue-950/40 border border-blue-500/30',
  RESOLVED: 'text-emerald-400 bg-emerald-950/40 border border-emerald-500/30',
  OPEN: 'text-slate-400 bg-slate-900/40 border border-slate-700/30',
};

const CATEGORY_ICON = {
  'Electricity': '⚡',
  'Sanitation & Drainage': '💧',
  'Solid Waste Management': '🪵',
  'Roads & Infrastructure': '🚧',
};

export default function CitizenDashboard({ onReportClick }) {
  const { complaints, upvoteComplaint } = useUrbanGuard();
  const [focusedComplaint, setFocusedComplaint] = useState(null);
  const [listFilter, setListFilter] = useState('ALL');

  const activeComplaints = complaints.filter(c => c.status !== 'RESOLVED');
  const resolvedComplaints = complaints.filter(c => c.status === 'RESOLVED');
  const criticalCount = activeComplaints.filter(c => c.severity === 'CRITICAL').length;
  const highCount = activeComplaints.filter(c => c.severity === 'HIGH').length;
  const totalVoices = activeComplaints.reduce((s, c) => s + (c.upvotesCount || 0), 0);

  const filteredList = listFilter === 'ALL'
    ? activeComplaints
    : activeComplaints.filter(c => c.severity === listFilter);

  const handleLocate = (comp) => setFocusedComplaint({ ...comp, timestamp: Date.now() });

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6 max-w-7xl mx-auto w-full">

      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {/* Report CTA */}
        <div
          onClick={onReportClick}
          className="col-span-2 md:col-span-1 glass-card p-4 rounded-xl border border-blue-500/25 bg-blue-950/10 hover:bg-blue-950/20 transition-all cursor-pointer group hover:border-blue-500/50 hover:shadow-lg hover:shadow-blue-500/10 flex items-center gap-3"
        >
          <div className="p-2.5 bg-blue-600/20 border border-blue-500/30 rounded-xl group-hover:bg-blue-600/30 transition-all shrink-0">
            <PlusCircle className="w-6 h-6 text-blue-400 group-hover:scale-110 transition-transform" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-blue-300">Report New Hazard</h4>
            <p className="text-[10px] text-slate-400 mt-0.5">Camera + GPS auto-fill</p>
          </div>
        </div>

        {/* Critical Count */}
        <div className="glass-card p-4 rounded-xl border border-red-500/15 flex items-center gap-3">
          <div className="p-2.5 bg-red-950/50 border border-red-500/20 rounded-lg shrink-0">
            <AlertCircle className="w-5 h-5 text-red-500 animate-pulse" />
          </div>
          <div>
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Critical</p>
            <p className="text-2xl font-black text-white">{criticalCount}</p>
            <p className="text-[10px] text-slate-500">SLA: 2hr dispatch</p>
          </div>
        </div>

        {/* High Count */}
        <div className="glass-card p-4 rounded-xl border border-orange-500/15 flex items-center gap-3">
          <div className="p-2.5 bg-orange-950/50 border border-orange-500/20 rounded-lg shrink-0">
            <Compass className="w-5 h-5 text-orange-500" />
          </div>
          <div>
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">High</p>
            <p className="text-2xl font-black text-white">{highCount}</p>
            <p className="text-[10px] text-slate-500">SLA: 12hr dispatch</p>
          </div>
        </div>

        {/* Community Voices */}
        <div className="glass-card p-4 rounded-xl border border-emerald-500/15 flex items-center gap-3">
          <div className="p-2.5 bg-emerald-950/50 border border-emerald-500/20 rounded-lg shrink-0">
            <Activity className="w-5 h-5 text-emerald-500" />
          </div>
          <div>
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Community Voices</p>
            <p className="text-2xl font-black text-white">{totalVoices}</p>
            <p className="text-[10px] text-slate-500">{resolvedComplaints.length} resolved</p>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Map (2 cols) */}
        <div className="lg:col-span-2 flex flex-col gap-3">
          <div className="flex justify-between items-center px-1">
            <div>
              <h3 className="text-base font-bold text-white">Interactive Community Hazard Map</h3>
              <p className="text-xs text-slate-400">Real-time geo-pinned complaints in Ward 14 — click any pin to interact</p>
            </div>
            <span className="text-[10px] text-blue-400 font-medium font-mono bg-blue-950/20 border border-blue-900/30 px-2 py-1 rounded">
              {activeComplaints.length} Active
            </span>
          </div>

          <MapContainer
            complaints={complaints}
            focusedComplaint={focusedComplaint}
            viewMode="citizen"
          />

          {/* Spatial Merge Info */}
          <div className="p-3 bg-blue-950/15 border border-blue-900/25 rounded-lg flex items-start gap-2 text-xs text-blue-300/80">
            <span className="shrink-0 flex items-center justify-center w-5 h-5 bg-blue-500/20 rounded-full font-mono font-bold text-[10px]">i</span>
            <p className="leading-relaxed">
              <strong>Spatial Merging Active:</strong> Submitting a hazard within 20m of an existing report in the same category will auto-merge and upvote. 5+ voices → HIGH. 10+ voices → CRITICAL.
            </p>
          </div>
        </div>

        {/* Reports Feed */}
        <div className="flex flex-col gap-3">
          <div className="px-1 flex justify-between items-center">
            <div>
              <h3 className="text-base font-bold text-white">Active Reports Feed</h3>
              <p className="text-xs text-slate-400">Community-verified hazards</p>
            </div>
          </div>

          {/* Severity Filter Tabs */}
          <div className="flex gap-1 p-1 bg-slate-950/60 rounded-lg border border-slate-800/80">
            {['ALL', 'CRITICAL', 'HIGH', 'MEDIUM'].map(f => (
              <button
                key={f}
                onClick={() => setListFilter(f)}
                className={`flex-1 py-1.5 rounded text-[10px] font-bold uppercase transition-all ${
                  listFilter === f
                    ? f === 'CRITICAL'
                      ? 'bg-red-600/80 text-white shadow-sm'
                      : f === 'HIGH'
                      ? 'bg-orange-600/80 text-white shadow-sm'
                      : f === 'MEDIUM'
                      ? 'bg-yellow-600/80 text-slate-900 shadow-sm'
                      : 'bg-slate-700 text-white shadow-sm'
                    : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                {f}
              </button>
            ))}
          </div>

          <div className="flex-1 max-h-[560px] overflow-y-auto pr-0.5 flex flex-col gap-3">
            {filteredList.length === 0 ? (
              <div className="glass-card p-8 rounded-xl border border-slate-800 text-center">
                <p className="text-slate-400 text-sm">No {listFilter !== 'ALL' ? listFilter.toLowerCase() : 'active'} hazards in Ward 14.</p>
                <p className="text-xs text-slate-600 mt-1">Be the first to report using the button above.</p>
              </div>
            ) : (
              filteredList.map((comp, idx) => (
                <motion.div
                  key={comp.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.04 }}
                  className={`glass-card p-4 rounded-xl border transition-all hover:border-slate-700 flex flex-col gap-3 ${
                    comp.severity === 'CRITICAL' && comp.status !== 'RESOLVED'
                      ? 'border-red-500/40 bg-red-950/5 animate-glow-red'
                      : 'border-slate-800/80'
                  }`}
                >
                  <div className="flex justify-between items-start gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span className="text-sm">{CATEGORY_ICON[comp.category] || '⚠️'}</span>
                        <h4 className="font-bold text-sm text-slate-100 line-clamp-1">{comp.title}</h4>
                      </div>
                      <p className="text-[10px] text-slate-500 font-mono">#{comp.id} · {comp.category}</p>
                    </div>
                    <span className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded uppercase shrink-0 ${SEVERITY_BADGE[comp.severity] || SEVERITY_BADGE.MEDIUM}`}>
                      {comp.severity}
                    </span>
                  </div>

                  <p className="text-xs text-slate-300 leading-normal line-clamp-2 bg-slate-950/40 p-2 rounded border border-slate-800/60">
                    {comp.description}
                  </p>

                  {/* Metadata */}
                  <div className="flex items-center gap-2 flex-wrap text-[10px]">
                    {comp.waterLevel > 0 && (
                      <span className="flex items-center gap-1 text-blue-300 bg-blue-950/20 border border-blue-900/30 px-1.5 py-0.5 rounded font-mono">
                        <Droplets className="w-3 h-3" /> {comp.waterLevel} ft
                      </span>
                    )}
                    <span className={`px-1.5 py-0.5 rounded border font-bold uppercase ${STATUS_BADGE[comp.status] || STATUS_BADGE.OPEN}`}>
                      {comp.status}
                    </span>
                    {comp.escalationLevel >= 2 && (
                      <span className="text-orange-400 bg-orange-950/20 border border-orange-500/20 px-1.5 py-0.5 rounded font-bold text-[9px]">
                        L{comp.escalationLevel} {comp.escalationLevel === 3 ? 'BREACH' : 'SUPERVISOR'}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center justify-between text-xs text-slate-400 border-t border-slate-800/60 pt-3">
                    <span className="text-[10px] text-slate-500 font-mono">🗣️ {comp.upvotesCount} Citizen voices</span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleLocate(comp)}
                        className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors flex items-center gap-1 text-[10px] font-bold"
                        title="Focus on Map"
                      >
                        <MapPin className="w-3.5 h-3.5" />
                        <span>Locate</span>
                      </button>
                      {comp.status !== 'RESOLVED' && (
                        <button
                          onClick={() => upvoteComplaint(comp.id)}
                          className="px-2.5 py-1.5 bg-blue-600/90 hover:bg-blue-600 active:bg-blue-700 text-white rounded font-bold transition-all flex items-center gap-1 text-[10px]"
                        >
                          <ThumbsUp className="w-3.5 h-3.5" />
                          <span>👍 I Have This Too</span>
                        </button>
                      )}
                    </div>
                  </div>
                </motion.div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}