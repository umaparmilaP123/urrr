import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';

const UrbanGuardContext = createContext(null);

const API_BASE = import.meta.env.VITE_API_BASE_URL || '';

// ── Client identity (upvote dedup) ─────────────────────────────────────────
// A UUID generated on first visit and persisted to localStorage.
// Sent as X-Client-Id header so the server can prevent duplicate upvotes.
function getClientId() {
  let id = localStorage.getItem('urbanguard_client_id');
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem('urbanguard_client_id', id);
  }
  return id;
}

// ── Audio Alert (Web Audio API chime) ─────────────────────────────────────
const playCriticalChime = () => {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx  = new AudioCtx();
    const osc  = ctx.createOscillator();
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

// ── Haversine Distance (metres) — kept for spatial-merge reporting ─────────
export const getHaversineDistance = (c1, c2) => {
  const [lat1, lon1] = c1;
  const [lat2, lon2] = c2;
  const R = 6_371_000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

// ── Shared fetch helper ────────────────────────────────────────────────────
async function apiFetch(path, options = {}) {
  const clientId = getClientId();
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      'X-Client-Id': clientId,
      ...(options.headers || {}),
    },
    ...options,
  });
  return res;
}

/**
 * Safely parse a fetch Response as JSON.
 * Throws a clear error instead of an opaque SyntaxError when the server
 * returns an HTML page (e.g. Vercel 404 catch-all instead of the API).
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


// ── Provider ───────────────────────────────────────────────────────────────
export const UrbanGuardProvider = ({ children }) => {
  const [currentUser, setCurrentUser]         = useState(null);
  const [complaints, setComplaints]           = useState([]);
  const [iotSensors, setIotSensors]           = useState([]);
  const [activeDepartment, setActiveDepartment] = useState('All');
  const [notificationLogs, setNotificationLogs] = useState([]);
  const [toastMessage, setToastMessage]       = useState(null);

  // Track previous complaint IDs / escalation levels to detect new events
  const prevComplaintsRef = useRef({});

  // ── Toast / chime helpers ────────────────────────────────────────────────
  const showToast = useCallback((message, type = 'info') => {
    setToastMessage({ message, type });
    setTimeout(() => setToastMessage(null), 5000);
  }, []);

  // ── Session restore on mount ─────────────────────────────────────────────
  // Checks GET /api/auth/me so a page-refresh doesn't force re-login.
  useEffect(() => {
    apiFetch('/api/auth/me')
      .then(r => safeJson(r))
      .then(data => {
        if (data.user) setCurrentUser(data.user);
      })
      .catch(() => { /* ignore — user stays logged out */ });
  }, []);

  // ── Auth ──────────────────────────────────────────────────────────────────
  // loginCitizen / loginAuthority are called by AuthGateway after a successful
  // server round-trip. They just update local state.
  const loginCitizen   = useCallback((name) => setCurrentUser({ role: 'CITIZEN',   name: name || 'Ward 14 Resident' }), []);
  const loginAuthority = useCallback((name) => setCurrentUser({ role: 'AUTHORITY', name: name || 'GHMC Officer' }), []);
  const logout = useCallback(async () => {
    try { await apiFetch('/api/auth/logout', { method: 'POST' }); } catch { /* ignore */ }
    setCurrentUser(null);
    setActiveDepartment('All');
  }, []);

  // ── Polling fetches ───────────────────────────────────────────────────────
  const fetchComplaints = useCallback(async () => {
    try {
      const res  = await apiFetch('/api/complaints');
      const data = await safeJson(res);
      if (!res.ok) return;

      setComplaints(prev => {
        // Detect newly escalated / newly created complaints for chime/toast
        const prevMap = prevComplaintsRef.current;
        data.forEach(c => {
          const old = prevMap[c.id];
          if (!old) {
            // Brand new complaint arrived via poll
            if (c.severity === 'CRITICAL') playCriticalChime();
          } else if (c.escalationLevel > old.escalationLevel) {
            if (c.escalationLevel === 3) playCriticalChime();
          }
        });
        // Update prev snapshot
        const newMap = {};
        data.forEach(c => { newMap[c.id] = c; });
        prevComplaintsRef.current = newMap;
        return data;
      });
    } catch { /* network error — keep stale data */ }
  }, []);

  const fetchSensors = useCallback(async () => {
    try {
      const res  = await apiFetch('/api/iot-sensors');
      const data = await safeJson(res);
      if (res.ok) setIotSensors(data);
    } catch { /* ignore */ }
  }, []);

  const fetchNotifications = useCallback(async () => {
    try {
      const res  = await apiFetch('/api/notifications?limit=50');
      const data = await safeJson(res);
      if (res.ok) setNotificationLogs(data.notifications || []);
    } catch { /* ignore */ }
  }, []);

  // ── Initial load + poll every 8 s ─────────────────────────────────────────
  useEffect(() => {
    // Immediate first load
    fetchComplaints();
    fetchSensors();
    fetchNotifications();

    // Poll
    const iv = setInterval(() => {
      fetchComplaints();
      fetchSensors();
      fetchNotifications();
    }, 8_000);

    return () => clearInterval(iv);
  }, [fetchComplaints, fetchSensors, fetchNotifications]);

  // ── Submit Complaint ──────────────────────────────────────────────────────
  // POSTs to the backend. The server handles spatial merge + SLA + dept mapping.
  // On success we immediately refresh, rather than waiting for the next poll.
  const submitComplaint = useCallback(async (newReport) => {
    try {
      const res = await apiFetch('/api/complaints', {
        method: 'POST',
        body: JSON.stringify({
          title:       newReport.title,
          category:    newReport.category,
          severity:    newReport.severity,
          waterLevel:  newReport.waterLevel,
          coordinates: newReport.coordinates,
          description: newReport.description,
          reportedBy:  newReport.reportedBy || 'Citizen (Via Mobile App)',
        }),
      });
      const data = await safeJson(res);
      if (!res.ok) {
        showToast(`Error: ${data.error}`, 'warning');
        return;
      }
      if (data.merged) {
        const c = data.complaint;
        showToast(`Report merged with existing #${c.id}. Total voices: ${c.upvotesCount}`, 'warning');
      } else {
        const c = data.complaint;
        showToast(`Incident #${c.id} reported successfully.`, 'success');
        if (c.severity === 'CRITICAL') playCriticalChime();
      }
      // Refresh immediately so the new/updated item appears
      fetchComplaints();
      fetchNotifications();
    } catch (err) {
      showToast(`Failed to submit: ${err.message}`, 'warning');
    }
  }, [showToast, fetchComplaints, fetchNotifications]);

  // ── Upvote ────────────────────────────────────────────────────────────────
  const upvoteComplaint = useCallback(async (id) => {
    try {
      const res  = await apiFetch(`/api/complaints/${id}/upvote`, { method: 'POST' });
      const data = await safeJson(res);
      if (res.status === 409) {
        showToast('You have already upvoted this complaint.', 'warning');
        return;
      }
      if (!res.ok) {
        showToast(`Error: ${data.error}`, 'warning');
        return;
      }
      showToast(`👍 Ticket #${id} upvoted (${data.upvotesCount} voices)`, 'info');
      if (data.severity === 'CRITICAL') playCriticalChime();
      // Optimistic update — replace the complaint in state immediately
      setComplaints(prev => prev.map(c => c.id === id ? data : c));
      fetchNotifications();
    } catch (err) {
      showToast(`Failed to upvote: ${err.message}`, 'warning');
    }
  }, [showToast, fetchNotifications]);

  // ── Dispatch Worker ───────────────────────────────────────────────────────
  const dispatchWorker = useCallback(async (id, workerName) => {
    try {
      const res  = await apiFetch(`/api/complaints/${id}/dispatch`, {
        method: 'POST',
        body: JSON.stringify({ workerName }),
      });
      const data = await safeJson(res);
      if (!res.ok) { showToast(`Error: ${data.error}`, 'warning'); return; }
      showToast(`👷 ${workerName} dispatched to Incident #${id}.`, 'success');
      setComplaints(prev => prev.map(c => c.id === id ? data : c));
      fetchNotifications();
    } catch (err) {
      showToast(`Failed to dispatch: ${err.message}`, 'warning');
    }
  }, [showToast, fetchNotifications]);

  // ── Escalate ──────────────────────────────────────────────────────────────
  const escalateComplaint = useCallback(async (id) => {
    try {
      const res  = await apiFetch(`/api/complaints/${id}/escalate`, { method: 'POST' });
      const data = await safeJson(res);
      if (!res.ok) { showToast(`Error: ${data.error}`, 'warning'); return; }
      const names = ['', 'L1 Field Op', 'L2 Supervisor', 'L3 Dept Chief Breach'];
      showToast(`⚠️ Incident #${id} escalated to ${names[data.escalationLevel]}`, 'warning');
      setComplaints(prev => prev.map(c => c.id === id ? data : c));
      fetchNotifications();
    } catch (err) {
      showToast(`Failed to escalate: ${err.message}`, 'warning');
    }
  }, [showToast, fetchNotifications]);

  // ── Resolve ───────────────────────────────────────────────────────────────
  const resolveComplaint = useCallback(async (id, proofData) => {
    try {
      const res  = await apiFetch(`/api/complaints/${id}/resolve`, {
        method: 'POST',
        body: JSON.stringify({
          afterImage: proofData.afterImage || null,
          proofNote:  proofData.proofNote  || 'Resolved and cleared.',
        }),
      });
      const data = await safeJson(res);
      if (!res.ok) { showToast(`Error: ${data.error}`, 'warning'); return; }
      showToast(`✅ Incident #${id} marked as RESOLVED.`, 'success');
      setComplaints(prev => prev.map(c => c.id === id ? data : c));
      fetchNotifications();
    } catch (err) {
      showToast(`Failed to resolve: ${err.message}`, 'warning');
    }
  }, [showToast, fetchNotifications]);

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