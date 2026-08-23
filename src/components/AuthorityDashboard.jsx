import React, { useState, useEffect } from 'react';
import { useUrbanGuard } from '../context/UrbanGuardContext';
import MapContainer from './MapContainer';
import ProofOfWorkModal from './ProofOfWorkModal';
import {
  AlertCircle, Shield, Wrench, ShieldAlert, Cpu, Activity,
  UserPlus, CheckCircle, Navigation, ChevronDown, ChevronUp,
  Clock, Zap, Droplets, MapPin
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// Live SLA Countdown
const SlaCountdown = ({ createdAt, slaMins, status }) => {
  const [timeStr, setTimeStr] = useState('');
  const [isBreached, setIsBreached] = useState(false);
  const [pct, setPct] = useState(0);

  useEffect(() => {
    if (status === 'RESOLVED') return;

    const update = () => {
      const totalMs = slaMins * 60 * 1000;
      const elapsed = Date.now() - new Date(createdAt).getTime();
      const remaining = totalMs - elapsed;
      const p = Math.min(100, (elapsed / totalMs) * 100);
      setPct(p);

      if (remaining <= 0) {
        setTimeStr('BREACHED');
        setIsBreached(true);
      } else {
        const s = Math.floor(remaining / 1000);
        const h = Math.floor(s / 3600);
        const m = Math.floor((s % 3600) / 60);
        const sec = s % 60;
        setTimeStr(`${h}h ${m}m ${sec}s`);
        setIsBreached(false);
      }
    };

    update();
    const iv = setInterval(update, 1000);
    return () => clearInterval(iv);
  }, [createdAt, slaMins, status]);

  if (status === 'RESOLVED') {
    return <span className="text-emerald-400 font-bold font-mono text-[10px] uppercase">✓ Resolved</span>;
  }

  return (
    <div className="flex flex-col gap-0.5">
      <span className={`font-mono text-[10px] font-bold px-2 py-0.5 rounded ${
        isBreached
          ? 'bg-red-600 text-white animate-pulse'
          : pct >= 75
          ? 'bg-orange-950/60 text-orange-300 border border-orange-500/25'
          : 'bg-slate-800 text-yellow-400 border border-yellow-500/20'
      }`}>
        ⏰ {isBreached ? 'SLA BREACHED' : timeStr}
      </span>
      {/* Progress bar */}
      <div className="w-full h-1 bg-slate-800 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${
            isBreached || pct >= 100 ? 'bg-red-500 animate-pulse' : pct >= 75 ? 'bg-orange-500' : pct >= 50 ? 'bg-yellow-500' : 'bg-emerald-500'
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
};

const DEPT_COLORS = {
  'All': 'text-slate-300 border-slate-700 bg-slate-800/40',
  'Electricity Board': 'text-yellow-300 border-yellow-700/40 bg-yellow-950/20',
  'Sanitation & Drainage': 'text-blue-300 border-blue-700/40 bg-blue-950/20',
  'Roads & Buildings': 'text-orange-300 border-orange-700/40 bg-orange-950/20',
  'Solid Waste Management': 'text-emerald-300 border-emerald-700/40 bg-emerald-950/20',
};

const DEPT_ACTIVE = {
  'All': 'text-white border-red-500/50 bg-red-950/50 shadow-md',
  'Electricity Board': 'text-yellow-200 border-yellow-500/50 bg-yellow-950/40 shadow-md',
  'Sanitation & Drainage': 'text-blue-200 border-blue-500/50 bg-blue-950/40 shadow-md',
  'Roads & Buildings': 'text-orange-200 border-orange-500/50 bg-orange-950/40 shadow-md',
  'Solid Waste Management': 'text-emerald-200 border-emerald-500/50 bg-emerald-950/40 shadow-md',
};

const CAT_IMG = {
  'Electricity': 'https://images.unsplash.com/photo-1544724569-5f546fd6f2b5?auto=format&fit=crop&w=300&q=80',
  'Sanitation & Drainage': 'https://images.unsplash.com/photo-1585320806297-9794b3e4eeae?auto=format&fit=crop&w=300&q=80',
  'Roads & Infrastructure': 'https://images.unsplash.com/photo-1515162305285-0293e4767cc2?auto=format&fit=crop&w=300&q=80',
  'Solid Waste Management': 'https://images.unsplash.com/photo-1611284446314-60a58ac0deb9?auto=format&fit=crop&w=300&q=80',
};

export default function AuthorityDashboard() {
  const {
    complaints,
    iotSensors,
    activeDepartment,
    setActiveDepartment,
    notificationLogs,
    dispatchWorker,
    escalateComplaint,
  } = useUrbanGuard();

  const [focusedComplaint, setFocusedComplaint] = useState(null);
  const [dispatchingId, setDispatchingId] = useState(null);
  const [resolvingId, setResolvingId] = useState(null);
  const [selectedWorker, setSelectedWorker] = useState('');
  const [statusFilter, setStatusFilter] = useState('ACTIVE');

  const departments = ['All', 'Electricity Board', 'Sanitation & Drainage', 'Roads & Buildings', 'Solid Waste Management'];

  const workerPool = {
    'Electricity Board': ['Unit Spark-1 (Jeevan)', 'Grid Force 4 (Sanjay)', 'Line Dispatch C (Prasad)'],
    'Sanitation & Drainage': ['Drainage Team A (Ramesh)', 'Pump Station 2 (Venkatesh)', 'Hydro Squad (Vijay)'],
    'Roads & Buildings': ['Pothole Patchers (Anand)', 'Structural Engineers (Reddy)', 'Civil Team B (Naidu)'],
    'Solid Waste Management': ['Clean Sweep A (Satish)', 'Debris Loader 3 (Mahesh)', 'Solid Disposal D (Kumar)'],
  };

  const filtered = complaints.filter(c => {
    const deptOk = activeDepartment === 'All' || c.department === activeDepartment;
    const statusOk = statusFilter === 'ALL' ? true : statusFilter === 'ACTIVE' ? c.status !== 'RESOLVED' : c.status === 'RESOLVED';
    return deptOk && statusOk;
  });

  const sorted = [...filtered].sort((a, b) => {
    if (a.status === 'RESOLVED' && b.status !== 'RESOLVED') return 1;
    if (a.status !== 'RESOLVED' && b.status === 'RESOLVED') return -1;
    const w = { CRITICAL: 3, HIGH: 2, MEDIUM: 1 };
    return (w[b.severity] || 0) - (w[a.severity] || 0) || new Date(a.createdAt) - new Date(b.createdAt);
  });

  const activeCount = complaints.filter(c => c.status !== 'RESOLVED').length;
  const criticalCount = complaints.filter(c => c.status !== 'RESOLVED' && c.severity === 'CRITICAL').length;
  const escalatedCount = complaints.filter(c => c.status === 'ESCALATED' || c.escalationLevel === 3).length;
  const inProgressCount = complaints.filter(c => c.status === 'IN_PROGRESS').length;

  const getEscLabel = (lv) => ['', 'L1 Field Op', 'L2 Supervisor', 'L3 Chief Breach'][lv] || 'L1 Field Op';
  const getEscStyle = (lv) => lv === 3 ? 'text-red-400 bg-red-950/40 border-red-500/30 animate-pulse' : lv === 2 ? 'text-orange-400 bg-orange-950/40 border-orange-500/30' : 'text-slate-400 bg-slate-800/40 border-slate-700/30';

  const handleFocus = (comp) => setFocusedComplaint({ ...comp, timestamp: Date.now() });

  const startDispatch = (comp) => {
    setDispatchingId(comp.id);
    setSelectedWorker((workerPool[comp.department] || [])[0] || '');
  };

  const confirmDispatch = (id) => {
    if (!selectedWorker) return;
    dispatchWorker(id, selectedWorker);
    setDispatchingId(null);
  };

  return (
    <div className="flex flex-col gap-5 p-4 md:p-6 max-w-7xl mx-auto w-full">

      {/* Ops Stats Banner */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="glass-card px-4 py-3 rounded-xl border border-emerald-500/15 flex items-center justify-between">
          <div>
            <p className="text-[10px] text-slate-400 uppercase tracking-widest font-mono">Ops Status</p>
            <p className="text-base font-black text-emerald-400">STABLE</p>
          </div>
          <Activity className="w-5 h-5 text-emerald-400 animate-pulse" />
        </div>
        <div className="glass-card px-4 py-3 rounded-xl border border-slate-800 flex items-center justify-between">
          <div>
            <p className="text-[10px] text-slate-400 uppercase tracking-widest font-mono">Active</p>
            <p className="text-xl font-black text-white">{activeCount}</p>
          </div>
          <Shield className="w-5 h-5 text-blue-400" />
        </div>
        <div className="glass-card px-4 py-3 rounded-xl border border-red-500/20 flex items-center justify-between">
          <div>
            <p className="text-[10px] text-slate-400 uppercase tracking-widest font-mono">Critical</p>
            <p className="text-xl font-black text-red-500 animate-pulse">{criticalCount}</p>
          </div>
          <ShieldAlert className="w-5 h-5 text-red-500 animate-bounce" />
        </div>
        <div className="glass-card px-4 py-3 rounded-xl border border-orange-500/15 flex items-center justify-between">
          <div>
            <p className="text-[10px] text-slate-400 uppercase tracking-widest font-mono">L3 Breaches</p>
            <p className="text-xl font-black text-orange-500">{escalatedCount}</p>
          </div>
          <AlertCircle className="w-5 h-5 text-orange-500" />
        </div>
      </div>

      {/* Department Filter Tabs */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 border-b border-slate-800/60 pb-4">
        <div className="flex flex-wrap items-center gap-1.5">
          {departments.map(dept => (
            <button
              key={dept}
              onClick={() => setActiveDepartment(dept)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                activeDepartment === dept
                  ? DEPT_ACTIVE[dept] || DEPT_ACTIVE['All']
                  : DEPT_COLORS[dept] || DEPT_COLORS['All']
              }`}
            >
              {dept === 'All' ? 'All Departments' : dept}
            </button>
          ))}
        </div>

        <div className="flex bg-slate-950/80 p-0.5 rounded-lg border border-slate-800 shrink-0">
          {['ACTIVE', 'RESOLVED', 'ALL'].map(sf => (
            <button
              key={sf}
              onClick={() => setStatusFilter(sf)}
              className={`px-2.5 py-1.5 rounded text-[10px] font-bold uppercase transition-all ${
                statusFilter === sf
                  ? sf === 'RESOLVED'
                    ? 'bg-emerald-950/60 border border-emerald-500/20 text-emerald-400'
                    : 'bg-slate-800 text-slate-100'
                  : 'text-slate-500 hover:text-slate-400'
              }`}
            >
              {sf === 'ACTIVE' ? 'Active' : sf === 'RESOLVED' ? 'Resolved' : 'All'}
            </button>
          ))}
        </div>
      </div>

      {/* Main Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Dispatch Queue (2 cols) */}
        <div className="lg:col-span-2 flex flex-col gap-4">
          <div className="flex justify-between items-center px-1">
            <div>
              <h3 className="text-sm font-bold text-slate-100 flex items-center gap-1.5 uppercase tracking-wider font-mono">
                <Wrench className="w-4 h-4 text-red-500" />
                Dispatch Desk: Priority Queue
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">Sorted CRITICAL-first, then by oldest submission time</p>
            </div>
            <span className="text-[10px] text-slate-500 font-bold font-mono bg-slate-900/60 px-2 py-1 rounded border border-slate-800">
              {sorted.length} tickets
            </span>
          </div>

          <div className="flex flex-col gap-3 max-h-[780px] overflow-y-auto pr-1">
            {sorted.length === 0 ? (
              <div className="glass-card p-12 rounded-xl border border-slate-800 text-center flex flex-col items-center justify-center gap-2">
                <Shield className="w-10 h-10 text-slate-700" />
                <p className="text-slate-400 text-sm font-medium">No pending tickets in this view.</p>
                <p className="text-xs text-slate-600">WebSocket events will auto-add new incidents.</p>
              </div>
            ) : (
              sorted.map(comp => {
                const isCrit = comp.status !== 'RESOLVED' && comp.severity === 'CRITICAL';
                const imgSrc = (comp.status === 'RESOLVED' && comp.resolvedImage)
                  ? comp.resolvedImage
                  : CAT_IMG[comp.category] || 'https://images.unsplash.com/photo-1584467541268-b040f83be3fd?auto=format&fit=crop&w=300&q=80';

                return (
                  <motion.div
                    key={comp.id}
                    layout
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`glass-card p-4 rounded-xl border transition-all ${
                      isCrit
                        ? 'border-red-500 bg-red-950/10 animate-glow-red'
                        : 'border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row gap-4">
                      {/* Thumbnail */}
                      <div className="relative w-full sm:w-28 h-20 rounded-lg border border-slate-800 bg-slate-950 overflow-hidden shrink-0">
                        <img src={imgSrc} alt="Incident" className="w-full h-full object-cover" />
                        {/* Severity badge overlay */}
                        <span className={`absolute top-1.5 left-1.5 text-[9px] font-black px-1.5 py-0.5 rounded uppercase ${
                          comp.severity === 'CRITICAL' ? 'bg-red-600 text-white' : comp.severity === 'HIGH' ? 'bg-orange-600 text-white' : 'bg-yellow-500 text-slate-900'
                        }`}>{comp.severity}</span>
                        {comp.waterLevel > 0 && (
                          <span className="absolute bottom-1 right-1 px-1 bg-slate-900/90 backdrop-blur text-[8px] text-blue-300 font-mono border border-blue-500/25 rounded">
                            💧{comp.waterLevel}ft
                          </span>
                        )}
                      </div>

                      {/* Info & Actions */}
                      <div className="flex-1 flex flex-col justify-between gap-2.5">
                        <div>
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <h4 className="font-extrabold text-sm text-slate-100">
                              #{comp.id} — {comp.title}
                            </h4>
                            <div className="flex items-center gap-2 shrink-0">
                              <SlaCountdown createdAt={comp.createdAt} slaMins={comp.slaMins} status={comp.status} />
                              {comp.status !== 'RESOLVED' && (
                                <span className={`text-[9px] px-1.5 py-0.5 rounded border uppercase font-bold ${getEscStyle(comp.escalationLevel)}`}>
                                  {getEscLabel(comp.escalationLevel)}
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="text-[10px] text-slate-400 mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                            <span className="font-semibold text-slate-300">{comp.category}</span>
                            <span>•</span>
                            <span className="font-mono bg-slate-900 px-1 py-0.5 rounded border border-slate-800 text-[9px]">
                              📍 {comp.coordinates[0].toFixed(4)}, {comp.coordinates[1].toFixed(4)}
                            </span>
                            <span>•</span>
                            <span>🗣️ {comp.upvotesCount} citizen voices</span>
                          </div>

                          <p className="text-xs text-slate-400 leading-relaxed mt-2 p-2 bg-slate-950/40 rounded border border-slate-800/60 line-clamp-2">
                            {comp.description}
                          </p>

                          {comp.dispatchedWorker && comp.status !== 'RESOLVED' && (
                            <div className="mt-2 text-[10px] text-blue-300 bg-blue-950/15 border border-blue-900/25 px-2 py-1 rounded inline-flex items-center gap-1">
                              👷 Worker: <span className="font-bold">{comp.dispatchedWorker}</span>
                            </div>
                          )}
                          {comp.status === 'RESOLVED' && comp.resolvedProof && (
                            <div className="mt-2 text-[10px] text-emerald-300 bg-emerald-950/15 border border-emerald-900/25 px-2 py-1.5 rounded flex items-start gap-1.5">
                              <CheckCircle className="w-3 h-3 text-emerald-400 shrink-0 mt-0.5" />
                              <span className="italic">"{comp.resolvedProof}"</span>
                            </div>
                          )}
                        </div>

                        {/* Action Buttons */}
                        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-800/60">
                          {/* Focus map */}
                          <button
                            onClick={() => handleFocus(comp)}
                            className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded font-semibold text-xs transition-colors flex items-center gap-1"
                          >
                            <Navigation className="w-3.5 h-3.5 text-blue-400" />
                            📍 Focus on Map
                          </button>

                          {comp.status !== 'RESOLVED' && (
                            <>
                              {/* Dispatch */}
                              {dispatchingId === comp.id ? (
                                <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-800 p-1.5 rounded-lg">
                                  <select
                                    value={selectedWorker}
                                    onChange={e => setSelectedWorker(e.target.value)}
                                    className="bg-slate-950 border border-slate-800 text-slate-200 text-xs px-2 py-1 rounded focus:outline-none"
                                  >
                                    {(workerPool[comp.department] || []).map(w => (
                                      <option key={w} value={w}>{w}</option>
                                    ))}
                                  </select>
                                  <button onClick={() => confirmDispatch(comp.id)} className="px-2.5 py-1 bg-blue-600 text-white rounded text-[10px] font-bold">Confirm</button>
                                  <button onClick={() => setDispatchingId(null)} className="px-2 py-1 bg-slate-800 text-slate-400 rounded text-[10px] font-bold">Cancel</button>
                                </div>
                              ) : (
                                <button
                                  onClick={() => startDispatch(comp)}
                                  className="px-2.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded font-semibold text-xs transition-colors flex items-center gap-1"
                                >
                                  <UserPlus className="w-3.5 h-3.5" />
                                  👷 1-Click Dispatch
                                </button>
                              )}

                              {/* Escalate */}
                              {comp.escalationLevel < 3 && (
                                <button
                                  onClick={() => escalateComplaint(comp.id)}
                                  className="px-2.5 py-1.5 bg-orange-950/60 hover:bg-orange-900/60 text-orange-300 rounded font-semibold text-xs transition-colors flex items-center gap-1 border border-orange-700/30"
                                >
                                  ⚠️ Escalate
                                </button>
                              )}

                              {/* Resolve */}
                              <button
                                onClick={() => setResolvingId(comp.id)}
                                className="px-2.5 py-1.5 bg-emerald-950/60 hover:bg-emerald-900/60 text-emerald-300 rounded font-semibold text-xs transition-colors flex items-center gap-1 border border-emerald-700/30 ml-auto"
                              >
                                ✅ Mark Resolved
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Sidebar: Map + IoT + Logs */}
        <div className="flex flex-col gap-5">

          {/* Authority Map */}
          <div className="flex flex-col gap-2">
            <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wider font-mono flex items-center gap-1.5">
              <MapPin className="w-4 h-4 text-red-500" />
              Live Monitor Layer
            </h3>
            <MapContainer
              complaints={complaints}
              focusedComplaint={focusedComplaint}
              viewMode="authority"
            />
          </div>

          {/* IoT Telemetry */}
          <div className="glass-card p-4 rounded-xl border border-slate-800 flex flex-col gap-4">
            <div className="flex items-center gap-1.5 border-b border-slate-800/60 pb-2.5">
              <Cpu className="w-4 h-4 text-red-400" />
              <h3 className="text-xs font-bold text-slate-300 uppercase tracking-widest font-mono">Municipal IoT Telemetry</h3>
            </div>
            <div className="flex flex-col gap-3">
              {iotSensors.map(sensor => (
                <div key={sensor.id} className="flex flex-col gap-1.5">
                  <div className="flex justify-between text-[11px]">
                    <span className="font-semibold text-slate-200">{sensor.name}</span>
                    <span className={`font-mono font-bold ${
                      sensor.status === 'CRITICAL' ? 'text-red-400' : sensor.status === 'WARNING' ? 'text-yellow-400' : 'text-emerald-400'
                    }`}>
                      {sensor.capacity}% <span className="text-[9px] uppercase">{sensor.status}</span>
                    </span>
                  </div>
                  <div className="w-full bg-slate-950 h-2.5 rounded-full overflow-hidden border border-slate-800">
                    <motion.div
                      className={`h-full rounded-full ${
                        sensor.status === 'CRITICAL' ? 'bg-red-500' : sensor.status === 'WARNING' ? 'bg-yellow-500' : 'bg-emerald-500'
                      } ${sensor.status === 'CRITICAL' ? 'animate-pulse' : ''}`}
                      initial={{ width: 0 }}
                      animate={{ width: `${sensor.capacity}%` }}
                      transition={{ duration: 1, ease: 'easeOut' }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Socket Log Stream */}
          <div className="glass-card p-4 rounded-xl border border-slate-800 flex flex-col gap-2.5 max-h-[320px]">
            <div className="flex items-center justify-between border-b border-slate-800/60 pb-2.5">
              <div className="flex items-center gap-1.5">
                <Activity className="w-4 h-4 text-emerald-400" />
                <h3 className="text-xs font-bold text-slate-300 uppercase tracking-widest font-mono">Socket Stream Logs</h3>
              </div>
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
            </div>
            <div className="flex-1 overflow-y-auto flex flex-col gap-2 pr-1">
              {notificationLogs.map(log => {
                const cols = {
                  escalation: 'text-orange-400',
                  merge: 'text-blue-300',
                  report: 'text-red-300',
                  resolution: 'text-emerald-300',
                  telemetry: 'text-cyan-300',
                  upvote: 'text-purple-300',
                };
                return (
                  <div key={log.id} className="text-[10px] leading-relaxed border-b border-slate-800/40 pb-1.5">
                    <div className="flex justify-between text-[8px] text-slate-500 mb-0.5 font-mono">
                      <span>[{log.type.toUpperCase()}]</span>
                      <span>{new Date(log.timestamp).toLocaleTimeString()}</span>
                    </div>
                    <p className={`font-mono ${cols[log.type] || 'text-slate-400'}`}>{log.message}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Proof of Work Modal */}
      <ProofOfWorkModal
        isOpen={resolvingId !== null}
        onClose={() => setResolvingId(null)}
        complaintId={resolvingId}
      />
    </div>
  );
}