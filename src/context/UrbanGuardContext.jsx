import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';

const UrbanGuardContext = createContext(null);

// ── Audio Alert (Web Audio API chime) ─────────────────────────────────────
const playCriticalChime = () => {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(620, ctx.currentTime);
    osc.frequency.setValueAtTime(860, ctx.currentTime + 0.15);
    gain.gain.setValueAtTime(0.07, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.5);
  } catch (e) {
    console.warn('Web Audio chime blocked (user gesture required)', e);
  }
};

// ── Haversine Distance (meters) ───────────────────────────────────────────
export const getHaversineDistance = (c1, c2) => {
  const [lat1, lon1] = c1;
  const [lat2, lon2] = c2;
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

// ── Seed Data ─────────────────────────────────────────────────────────────
const NOW = Date.now();
const initialComplaints = [
  {
    id: '101',
    title: 'Severe Flooding & Submerged Vehicles',
    category: 'Sanitation & Drainage',
    department: 'Sanitation & Drainage',
    severity: 'CRITICAL',
    waterLevel: 3.2,
    coordinates: [17.4435, 78.3772],
    upvotesCount: 14,
    status: 'OPEN',
    createdAt: new Date(NOW - 35 * 60 * 1000).toISOString(),
    slaMins: 120,
    escalationLevel: 1,
    description: 'Cyber Towers Flyover underpass is completely flooded. Several vehicles are stuck. Water depth is exceeding 3 feet. Emergency evacuation required.',
    reportedBy: 'Citizen (Via Mobile App)',
    dispatchedWorker: null,
    resolvedImage: null,
    resolvedProof: null,
    updatedAt: new Date(NOW - 35 * 60 * 1000).toISOString(),
  },
  {
    id: '102',
    title: 'Exposed Transformer Wire in Standing Water',
    category: 'Electricity',
    department: 'Electricity Board',
    severity: 'CRITICAL',
    waterLevel: 1.8,
    coordinates: [17.4388, 78.3810],
    upvotesCount: 8,
    status: 'OPEN',
    createdAt: new Date(NOW - 75 * 60 * 1000).toISOString(),
    slaMins: 120,
    escalationLevel: 2,
    description: 'Main transformer junction at Mindspace Gate 2 has live cables submerged in accumulated rainwater. High danger of fatal electric shock.',
    reportedBy: 'Citizen (Via Mobile App)',
    dispatchedWorker: null,
    resolvedImage: null,
    resolvedProof: null,
    updatedAt: new Date(NOW - 75 * 60 * 1000).toISOString(),
  },
  {
    id: '103',
    title: 'Unmarked Open Manhole on Pedestrian Path',
    category: 'Sanitation & Drainage',
    department: 'Sanitation & Drainage',
    severity: 'HIGH',
    waterLevel: 1.2,
    coordinates: [17.4320, 78.3715],
    upvotesCount: 4,
    status: 'IN_PROGRESS',
    createdAt: new Date(NOW - 220 * 60 * 1000).toISOString(),
    slaMins: 720,
    escalationLevel: 1,
    description: 'Near the entrance of Bio-Diversity Park, a storm drainage cover has popped off and is fully covered by murky water. Serious pedestrian hazard.',
    reportedBy: 'Citizen (Via Mobile App)',
    dispatchedWorker: 'Drainage Team A (Ramesh)',
    resolvedImage: null,
    resolvedProof: null,
    updatedAt: new Date(NOW - 60 * 60 * 1000).toISOString(),
  },
  {
    id: '104',
    title: 'Deep Pothole Cluster Causing Traffic Stall',
    category: 'Roads & Infrastructure',
    department: 'Roads & Buildings',
    severity: 'MEDIUM',
    waterLevel: 0.4,
    coordinates: [17.4481, 78.3698],
    upvotesCount: 2,
    status: 'OPEN',
    createdAt: new Date(NOW - 40 * 60 * 1000).toISOString(),
    slaMins: 2880,
    escalationLevel: 1,
    description: 'A group of deep potholes at IKEA junction is causing vehicles to brake abruptly and gridlocking the street.',
    reportedBy: 'Citizen (Via Mobile App)',
    dispatchedWorker: null,
    resolvedImage: null,
    resolvedProof: null,
    updatedAt: new Date(NOW - 40 * 60 * 1000).toISOString(),
  },
];

const initialIotSensors = [
  { id: 'S1', name: 'Sector 4 Underpass Drain', capacity: 88, status: 'CRITICAL', location: [17.4420, 78.3705] },
  { id: 'S2', name: 'Cyber Towers Drainage Terminal', capacity: 65, status: 'WARNING', location: [17.4445, 78.3765] },
  { id: 'S3', name: 'Mindspace Road Main Trunk', capacity: 42, status: 'NORMAL', location: [17.4395, 78.3820] },
  { id: 'S4', name: 'Bio-Diversity Junction Intake', capacity: 55, status: 'NORMAL', location: [17.4315, 78.3725] },
];

// ── Provider ───────────────────────────────────────────────────────────────
export const UrbanGuardProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [complaints, setComplaints] = useState(initialComplaints);
  const [iotSensors, setIotSensors] = useState(initialIotSensors);
  const [activeDepartment, setActiveDepartment] = useState('All');
  const [notificationLogs, setNotificationLogs] = useState([
    {
      id: 'L0',
      type: 'system',
      message: 'UrbanGuard Civic Response System initialized. WebSocket connected to Ward 14 (Cyberabad).',
      timestamp: new Date().toISOString(),
    },
  ]);
  const [toastMessage, setToastMessage] = useState(null);

  // Use refs for data that background workers access, to avoid stale closures
  const complaintsRef = useRef(complaints);
  useEffect(() => { complaintsRef.current = complaints; }, [complaints]);

  // ── Auth ─────────────────────────────────────────────────────────────
  const loginCitizen = (name) => setCurrentUser({ role: 'CITIZEN', name: name || 'Ward 14 Resident' });
  const loginAuthority = (name) => setCurrentUser({ role: 'AUTHORITY', name: name || 'GHMC Officer' });
  const logout = () => { setCurrentUser(null); setActiveDepartment('All'); };

  // ── Helpers ──────────────────────────────────────────────────────────
  const addNotification = useCallback((type, message) => {
    setNotificationLogs(prev => [{
      id: 'L' + Math.random().toString(36).slice(2, 10),
      type,
      message,
      timestamp: new Date().toISOString(),
    }, ...prev.slice(0, 49)]);
  }, []);

  const showToast = useCallback((message, type = 'info') => {
    setToastMessage({ message, type });
    setTimeout(() => setToastMessage(null), 5000);
  }, []);

  // ── Submit Complaint (with Spatial Merge) ────────────────────────────
  const submitComplaint = useCallback((newReport) => {
    const { title, category, severity, waterLevel, coordinates, description, reportedBy } = newReport;

    const deptMap = {
      'Electricity': 'Electricity Board',
      'Sanitation & Drainage': 'Sanitation & Drainage',
      'Solid Waste Management': 'Solid Waste Management',
      'Roads & Infrastructure': 'Roads & Buildings',
    };
    const department = deptMap[category] || 'Roads & Buildings';

    const slaMins = severity === 'CRITICAL' ? 120 : severity === 'HIGH' ? 720 : 2880;

    const current = complaintsRef.current;
    const sameCategory = current.filter(c => c.status !== 'RESOLVED' && c.category === category);
    let matched = null;
    for (const c of sameCategory) {
      if (getHaversineDistance(coordinates, c.coordinates) <= 20) {
        matched = c;
        break;
      }
    }

    if (matched) {
      setComplaints(prev => prev.map(c => {
        if (c.id !== matched.id) return c;
        const upvotes = c.upvotesCount + 1;
        let sev = c.severity, sla = c.slaMins;
        if (upvotes >= 10 && sev !== 'CRITICAL') { sev = 'CRITICAL'; sla = 120; }
        else if (upvotes >= 5 && sev === 'MEDIUM') { sev = 'HIGH'; sla = 720; }
        return { ...c, upvotesCount: upvotes, severity: sev, slaMins: sla, updatedAt: new Date().toISOString() };
      }));
      const msg = `Your report matched an existing ${category} hazard within 20m. Merged report & added your voice! (Total: ${matched.upvotesCount + 1} citizen voices)`;
      addNotification('merge', msg);
      showToast(msg, 'warning');
    } else {
      const id = String(100 + current.length + 1 + Math.floor(Math.random() * 100));
      const ticket = {
        id,
        title,
        category,
        department,
        severity,
        waterLevel: parseFloat(waterLevel) || 0,
        coordinates,
        upvotesCount: 1,
        status: 'OPEN',
        createdAt: new Date().toISOString(),
        slaMins,
        escalationLevel: 1,
        description,
        reportedBy: reportedBy || 'Citizen (Via Mobile App)',
        dispatchedWorker: null,
        resolvedImage: null,
        resolvedProof: null,
        updatedAt: new Date().toISOString(),
      };
      setComplaints(prev => [ticket, ...prev]);
      addNotification('report', `New Incident #${id} Filed: ${category} — ${severity} severity`);
      showToast(`Incident #${id} reported successfully.`, 'success');
      if (severity === 'CRITICAL') playCriticalChime();
    }
  }, [addNotification, showToast]);

  // ── Upvote ───────────────────────────────────────────────────────────
  const upvoteComplaint = useCallback((id) => {
    setComplaints(prev => prev.map(c => {
      if (c.id !== id) return c;
      const upvotes = c.upvotesCount + 1;
      let sev = c.severity, sla = c.slaMins;
      if (upvotes >= 10 && sev !== 'CRITICAL') { sev = 'CRITICAL'; sla = 120; playCriticalChime(); }
      else if (upvotes >= 5 && sev === 'MEDIUM') { sev = 'HIGH'; sla = 720; }
      addNotification('upvote', `Ticket #${id} upvoted. Total voices: ${upvotes}`);
      showToast(`👍 Ticket #${id} upvoted (${upvotes} voices)`, 'info');
      return { ...c, upvotesCount: upvotes, severity: sev, slaMins: sla, updatedAt: new Date().toISOString() };
    }));
  }, [addNotification, showToast]);

  // ── Dispatch Worker ──────────────────────────────────────────────────
  const dispatchWorker = useCallback((id, workerName) => {
    setComplaints(prev => prev.map(c => {
      if (c.id !== id) return c;
      addNotification('dispatch', `Unit '${workerName}' dispatched to Incident #${id}. Status → IN_PROGRESS.`);
      showToast(`👷 ${workerName} dispatched to Incident #${id}.`, 'success');
      return { ...c, status: 'IN_PROGRESS', dispatchedWorker: workerName, updatedAt: new Date().toISOString() };
    }));
  }, [addNotification, showToast]);

  // ── Escalate ─────────────────────────────────────────────────────────
  const escalateComplaint = useCallback((id) => {
    setComplaints(prev => prev.map(c => {
      if (c.id !== id) return c;
      const lvl = Math.min(3, c.escalationLevel + 1);
      const names = ['', 'L1 Field Op', 'L2 Supervisor', 'L3 Dept Chief Breach'];
      addNotification('escalation', `Incident #${id} manually escalated to ${names[lvl]}.`);
      showToast(`⚠️ Incident #${id} escalated to ${names[lvl]}`, 'warning');
      return { ...c, escalationLevel: lvl, status: lvl === 3 ? 'ESCALATED' : c.status, updatedAt: new Date().toISOString() };
    }));
  }, [addNotification, showToast]);

  // ── Resolve ──────────────────────────────────────────────────────────
  const resolveComplaint = useCallback((id, proofData) => {
    setComplaints(prev => prev.map(c => {
      if (c.id !== id) return c;
      addNotification('resolution', `Incident #${id} resolved. Proof-of-work verified.`);
      showToast(`✅ Incident #${id} marked as RESOLVED.`, 'success');
      return {
        ...c,
        status: 'RESOLVED',
        resolvedImage: proofData.afterImage || 'https://images.unsplash.com/photo-1542038784456-1ea8e935640e?auto=format&fit=crop&w=600&q=80',
        resolvedProof: proofData.proofNote || 'Resolved and cleared.',
        updatedAt: new Date().toISOString(),
      };
    }));
  }, [addNotification, showToast]);

  // ── SLA Cron Worker (10s tick) ───────────────────────────────────────
  useEffect(() => {
    const iv = setInterval(() => {
      setComplaints(prev => {
        let dirty = false;
        const updated = prev.map(c => {
          if (c.status === 'RESOLVED') return c;
          const elapsed = (Date.now() - new Date(c.createdAt).getTime()) / 60000;
          const pct = (elapsed / c.slaMins) * 100;
          let esc = c.escalationLevel;
          let status = c.status;

          if (pct >= 50 && esc === 1 && status === 'OPEN' && !c.dispatchedWorker) {
            esc = 2;
            dirty = true;
            addNotification('escalation', `SLA Cron: Incident #${c.id} hit 50% SLA without dispatch. Auto-escalated → L2 (Supervisor).`);
          }
          if (pct >= 100 && esc < 3) {
            esc = 3;
            status = 'ESCALATED';
            dirty = true;
            addNotification('escalation', `🚨 SLA BREACH: Incident #${c.id} exceeded ${c.slaMins} min SLA. Auto-escalated → L3 (Dept Chief).`);
            playCriticalChime();
          }

          if (esc !== c.escalationLevel || status !== c.status) {
            return { ...c, escalationLevel: esc, status, updatedAt: new Date().toISOString() };
          }
          return c;
        });
        return dirty ? updated : prev;
      });
    }, 10000);
    return () => clearInterval(iv);
  }, [addNotification]);

  // ── Mock WebSocket (20s tick) ────────────────────────────────────────
  useEffect(() => {
    const iv = setInterval(() => {
      const roll = Math.floor(Math.random() * 3);

      if (roll === 0) {
        // IoT sensor update
        setIotSensors(prev => {
          const updated = prev.map(s => {
            const delta = Math.floor(Math.random() * 11) - 5;
            const cap = Math.min(100, Math.max(10, s.capacity + delta));
            const status = cap >= 85 ? 'CRITICAL' : cap >= 60 ? 'WARNING' : 'NORMAL';
            return { ...s, capacity: cap, status };
          });
          const target = updated[Math.floor(Math.random() * updated.length)];
          if (target) {
            addNotification('telemetry', `IoT Update: ${target.name} → ${target.capacity}% (${target.status})`);
          }
          return updated;
        });

      } else if (roll === 1) {
        // Citizen upvote simulation
        setComplaints(prev => {
          const open = prev.filter(c => c.status !== 'RESOLVED');
          if (!open.length) return prev;
          const target = open[Math.floor(Math.random() * open.length)];
          const upvotes = target.upvotesCount + 1;
          let sev = target.severity, sla = target.slaMins;
          if (upvotes >= 10 && sev !== 'CRITICAL') { sev = 'CRITICAL'; sla = 120; playCriticalChime(); }
          else if (upvotes >= 5 && sev === 'MEDIUM') { sev = 'HIGH'; sla = 720; }
          addNotification('upvote', `WebSocket: Citizen field-verified Incident #${target.id}. Voices now: ${upvotes}`);
          return prev.map(c => c.id === target.id ? { ...c, upvotesCount: upvotes, severity: sev, slaMins: sla, updatedAt: new Date().toISOString() } : c);
        });

      } else {
        // New incoming report via WebSocket
        const pool = [
          { title: 'Fallen Banyan Tree Blocking Roadway', category: 'Solid Waste Management', severity: 'HIGH', waterLevel: 0.2, coords: [17.4410, 78.3610], desc: 'Huge Banyan branch snapped and blocked both lanes near Gachibowli. Commuters gridlocked.' },
          { title: 'Open Junction Electrical Sparking', category: 'Electricity', severity: 'CRITICAL', waterLevel: 0.8, coords: [17.4465, 78.3745], desc: 'Sparks from pole junction near Narsingi pedestrian crossing. Heavy rain creating arc flash risk.' },
          { title: 'Gushing Water Vortex from Drain', category: 'Sanitation & Drainage', severity: 'MEDIUM', waterLevel: 1.5, coords: [17.4350, 78.3750], desc: 'Loose drain cover bubbling water upward at Financial District entry. Sidewalk flooded.' },
        ];
        const h = pool[Math.floor(Math.random() * pool.length)];
        const lat = h.coords[0] + (Math.random() - 0.5) * 0.003;
        const lon = h.coords[1] + (Math.random() - 0.5) * 0.003;
        submitComplaint({ ...h, coordinates: [lat, lon], reportedBy: 'WebSocket Live Sensor' });
      }
    }, 20000);
    return () => clearInterval(iv);
  }, [addNotification, submitComplaint]);

  return (
    <UrbanGuardContext.Provider
      value={{
        currentUser, loginCitizen, loginAuthority, logout,
        complaints, iotSensors,
        activeDepartment, setActiveDepartment,
        notificationLogs, toastMessage,
        submitComplaint, upvoteComplaint, dispatchWorker, escalateComplaint, resolveComplaint,
        showToast,
      }}
    >
      {children}
    </UrbanGuardContext.Provider>
  );
};

export const useUrbanGuard = () => {
  const ctx = useContext(UrbanGuardContext);
  if (!ctx) throw new Error('useUrbanGuard must be used within UrbanGuardProvider');
  return ctx;
};