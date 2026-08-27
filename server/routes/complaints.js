'use strict';
/**
 * routes/complaints.js
 *
 * GET  /api/complaints              – list (optional ?department= filter)
 * POST /api/complaints              – create (spatial merge + SLA + dept mapping)
 * POST /api/complaints/:id/upvote   – increment; reject duplicate via upvotes table (409)
 * POST /api/complaints/:id/dispatch – AUTHORITY ONLY
 * POST /api/complaints/:id/escalate – AUTHORITY ONLY
 * POST /api/complaints/:id/resolve  – AUTHORITY ONLY
 */

const { Router } = require('express');
const db = require('../db');
const requireAuthority = require('../middleware/requireAuthority');

const router = Router();

// ── Helpers ────────────────────────────────────────────────────────────────

/** Haversine distance in metres between two [lat, lon] pairs */
function haversine([lat1, lon1], [lat2, lon2]) {
  const R = 6_371_000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const DEPT_MAP = {
  'Electricity': 'Electricity Board',
  'Sanitation & Drainage': 'Sanitation & Drainage',
  'Solid Waste Management': 'Solid Waste Management',
  'Roads & Infrastructure': 'Roads & Buildings',
};

function slaMins(severity) {
  if (severity === 'CRITICAL') return 120;
  if (severity === 'HIGH') return 720;
  return 2880;
}

/** Re-check severity escalation thresholds based on upvote count */
function recalcSeverity(current, upvotes) {
  let { severity, sla_mins } = current;
  if (upvotes >= 10 && severity !== 'CRITICAL') { severity = 'CRITICAL'; sla_mins = 120; }
  else if (upvotes >= 5 && severity === 'MEDIUM') { severity = 'HIGH'; sla_mins = 720; }
  return { severity, sla_mins };
}

/** Convert a DB row to the camelCase shape the frontend expects */
function rowToComplaint(row) {
  return {
    id: row.id,
    title: row.title,
    category: row.category,
    department: row.department,
    severity: row.severity,
    waterLevel: row.water_level,
    coordinates: [row.lat, row.lon],
    upvotesCount: row.upvotes_count,
    status: row.status,
    createdAt: row.created_at,
    slaMins: row.sla_mins,
    escalationLevel: row.escalation_level,
    description: row.description,
    reportedBy: row.reported_by,
    dispatchedWorker: row.dispatched_worker,
    resolvedImage: row.resolved_image,
    resolvedProof: row.resolved_proof,
    updatedAt: row.updated_at,
  };
}

const addNotification = (type, message) =>
  db.prepare('INSERT INTO notification_logs (type, message, created_at) VALUES (?, ?, ?)').run(
    type, message, new Date().toISOString()
  );

// ── GET /api/complaints ────────────────────────────────────────────────────
router.get('/', (req, res) => {
  const { department } = req.query;
  let rows;
  if (department && department !== 'All') {
    rows = db.prepare('SELECT * FROM complaints WHERE department = ? ORDER BY created_at DESC').all(department);
  } else {
    rows = db.prepare('SELECT * FROM complaints ORDER BY created_at DESC').all();
  }
  res.json(rows.map(rowToComplaint));
});

// ── POST /api/complaints ───────────────────────────────────────────────────
router.post('/', (req, res) => {
  const { title, category, severity, waterLevel, coordinates, description, reportedBy } = req.body;

  // Validation
  if (!title || typeof title !== 'string' || !title.trim()) {
    return res.status(400).json({ error: 'title is required' });
  }
  if (!category || typeof category !== 'string') {
    return res.status(400).json({ error: 'category is required' });
  }
  if (!Array.isArray(coordinates) || coordinates.length !== 2 ||
      typeof coordinates[0] !== 'number' || typeof coordinates[1] !== 'number') {
    return res.status(400).json({ error: 'coordinates must be [lat, lon] numbers' });
  }
  if (!description || typeof description !== 'string' || !description.trim()) {
    return res.status(400).json({ error: 'description is required' });
  }

  const [lat, lon] = coordinates;
  const department = DEPT_MAP[category] || 'Roads & Buildings';
  const sla = slaMins(severity || 'MEDIUM');
  const now = new Date().toISOString();

  // Spatial merge — find open ticket in same category within 20 m
  const openSameCategory = db.prepare(`
    SELECT * FROM complaints WHERE status != 'RESOLVED' AND category = ?
  `).all(category);

  let matched = null;
  for (const c of openSameCategory) {
    if (haversine([lat, lon], [c.lat, c.lon]) <= 20) {
      matched = c;
      break;
    }
  }

  if (matched) {
    // Merge: increment upvotes, possibly escalate severity
    const newUpvotes = matched.upvotes_count + 1;
    const { severity: newSev, sla_mins: newSla } = recalcSeverity(matched, newUpvotes);

    db.prepare(`
      UPDATE complaints
      SET upvotes_count = ?, severity = ?, sla_mins = ?, updated_at = ?
      WHERE id = ?
    `).run(newUpvotes, newSev, newSla, now, matched.id);

    addNotification(
      'merge',
      `Report matched existing ${category} hazard within 20m. Merged & upvoted Incident #${matched.id}. Total voices: ${newUpvotes}.`
    );

    const updated = db.prepare('SELECT * FROM complaints WHERE id = ?').get(matched.id);
    return res.status(200).json({ merged: true, complaint: rowToComplaint(updated) });
  }

  // New ticket
  const existing = db.prepare('SELECT id FROM complaints').all();
  const id = String(100 + existing.length + 1 + Math.floor(Math.random() * 100));

  db.prepare(`
    INSERT INTO complaints
      (id, title, category, department, severity, water_level, lat, lon,
       upvotes_count, status, created_at, sla_mins, escalation_level,
       description, reported_by, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, 'OPEN', ?, ?, 1, ?, ?, ?)
  `).run(
    id, title.trim(), category, department,
    severity || 'MEDIUM',
    parseFloat(waterLevel) || 0,
    lat, lon,
    now, sla,
    description.trim(),
    reportedBy || 'Citizen (Via Mobile App)',
    now
  );

  addNotification('report', `New Incident #${id} Filed: ${category} — ${severity || 'MEDIUM'} severity`);

  const created = db.prepare('SELECT * FROM complaints WHERE id = ?').get(id);
  res.status(201).json({ merged: false, complaint: rowToComplaint(created) });
});

// ── POST /api/complaints/:id/upvote ───────────────────────────────────────
router.post('/:id/upvote', (req, res) => {
  const { id } = req.params;
  const clientId = req.headers['x-client-id'];

  if (!clientId) {
    return res.status(400).json({ error: 'X-Client-Id header is required' });
  }

  const complaint = db.prepare('SELECT * FROM complaints WHERE id = ?').get(id);
  if (!complaint) return res.status(404).json({ error: 'Complaint not found' });

  // Dedup check
  try {
    db.prepare(`
      INSERT INTO upvotes (complaint_id, client_id, created_at) VALUES (?, ?, ?)
    `).run(id, clientId, new Date().toISOString());
  } catch (err) {
    if (err.message.includes('UNIQUE constraint')) {
      return res.status(409).json({ error: 'You have already upvoted this complaint.' });
    }
    throw err;
  }

  const newUpvotes = complaint.upvotes_count + 1;
  const { severity, sla_mins } = recalcSeverity(complaint, newUpvotes);
  const now = new Date().toISOString();

  db.prepare(`
    UPDATE complaints
    SET upvotes_count = ?, severity = ?, sla_mins = ?, updated_at = ?
    WHERE id = ?
  `).run(newUpvotes, severity, sla_mins, now, id);

  addNotification('upvote', `Ticket #${id} upvoted. Total voices: ${newUpvotes}`);

  const updated = db.prepare('SELECT * FROM complaints WHERE id = ?').get(id);
  res.json(rowToComplaint(updated));
});

// ── POST /api/complaints/:id/dispatch ─────────────────────────────────────
router.post('/:id/dispatch', requireAuthority, (req, res) => {
  const { id } = req.params;
  const { workerName } = req.body;

  if (!workerName || !workerName.trim()) {
    return res.status(400).json({ error: 'workerName is required' });
  }

  const complaint = db.prepare('SELECT * FROM complaints WHERE id = ?').get(id);
  if (!complaint) return res.status(404).json({ error: 'Complaint not found' });

  const now = new Date().toISOString();
  db.prepare(`
    UPDATE complaints
    SET status = 'IN_PROGRESS', dispatched_worker = ?, updated_at = ?
    WHERE id = ?
  `).run(workerName.trim(), now, id);

  addNotification('dispatch', `Unit '${workerName.trim()}' dispatched to Incident #${id}. Status → IN_PROGRESS.`);

  const updated = db.prepare('SELECT * FROM complaints WHERE id = ?').get(id);
  res.json(rowToComplaint(updated));
});

// ── POST /api/complaints/:id/escalate ─────────────────────────────────────
router.post('/:id/escalate', requireAuthority, (req, res) => {
  const { id } = req.params;
  const complaint = db.prepare('SELECT * FROM complaints WHERE id = ?').get(id);
  if (!complaint) return res.status(404).json({ error: 'Complaint not found' });

  const lvl = Math.min(3, complaint.escalation_level + 1);
  const names = ['', 'L1 Field Op', 'L2 Supervisor', 'L3 Dept Chief Breach'];
  const now = new Date().toISOString();

  db.prepare(`
    UPDATE complaints
    SET escalation_level = ?, status = ?, updated_at = ?
    WHERE id = ?
  `).run(lvl, lvl === 3 ? 'ESCALATED' : complaint.status, now, id);

  addNotification('escalation', `Incident #${id} manually escalated to ${names[lvl]}.`);

  const updated = db.prepare('SELECT * FROM complaints WHERE id = ?').get(id);
  res.json(rowToComplaint(updated));
});

// ── POST /api/complaints/:id/resolve ──────────────────────────────────────
router.post('/:id/resolve', requireAuthority, (req, res) => {
  const { id } = req.params;
  const { afterImage, proofNote } = req.body;

  const complaint = db.prepare('SELECT * FROM complaints WHERE id = ?').get(id);
  if (!complaint) return res.status(404).json({ error: 'Complaint not found' });

  const now = new Date().toISOString();
  // afterImage is stored as base64 text; proofNote is plain text
  db.prepare(`
    UPDATE complaints
    SET status = 'RESOLVED', resolved_image = ?, resolved_proof = ?, updated_at = ?
    WHERE id = ?
  `).run(
    afterImage || null,
    proofNote || 'Resolved and cleared.',
    now,
    id
  );

  addNotification('resolution', `Incident #${id} resolved. Proof-of-work verified.`);

  const updated = db.prepare('SELECT * FROM complaints WHERE id = ?').get(id);
  res.json(rowToComplaint(updated));
});

module.exports = router;
