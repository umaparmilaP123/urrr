'use strict';
/**
 * seed.js
 *
 * Exports seedIfEmpty() — idempotent, called by index.js on every cold start.
 * Also runnable as a standalone script: node seed.js
 */

const bcrypt = require('bcryptjs');
const db = require('./db');

const NOW = Date.now();
function iso(msAgo) { return new Date(NOW - msAgo).toISOString(); }

async function seedIfEmpty() {
  const existing = db.prepare('SELECT COUNT(*) AS n FROM complaints').get();
  if (existing && existing.n > 0) {
    console.log('  ✅ DB already seeded — skipping.');
    return;
  }

  console.log('  🌱 Seeding database…');

  // ── Complaints ───────────────────────────────────────────────────────────
  const insertComplaint = db.prepare(`
    INSERT OR IGNORE INTO complaints
      (id, title, category, department, severity, water_level, lat, lon,
       upvotes_count, status, created_at, sla_mins, escalation_level,
       description, reported_by, dispatched_worker, resolved_image, resolved_proof, updated_at)
    VALUES
      (@id, @title, @category, @department, @severity, @water_level, @lat, @lon,
       @upvotes_count, @status, @created_at, @sla_mins, @escalation_level,
       @description, @reported_by, @dispatched_worker, @resolved_image, @resolved_proof, @updated_at)
  `);

  const complaints = [
    {
      id: '101', title: 'Severe Flooding & Submerged Vehicles',
      category: 'Sanitation & Drainage', department: 'Sanitation & Drainage',
      severity: 'CRITICAL', water_level: 3.2, lat: 17.4435, lon: 78.3772,
      upvotes_count: 14, status: 'OPEN', created_at: iso(35 * 60 * 1000),
      sla_mins: 120, escalation_level: 1,
      description: 'Cyber Towers Flyover underpass is completely flooded. Several vehicles are stuck. Water depth is exceeding 3 feet. Emergency evacuation required.',
      reported_by: 'Citizen (Via Mobile App)', dispatched_worker: null,
      resolved_image: null, resolved_proof: null, updated_at: iso(35 * 60 * 1000),
    },
    {
      id: '102', title: 'Exposed Transformer Wire in Standing Water',
      category: 'Electricity', department: 'Electricity Board',
      severity: 'CRITICAL', water_level: 1.8, lat: 17.4388, lon: 78.3810,
      upvotes_count: 8, status: 'OPEN', created_at: iso(75 * 60 * 1000),
      sla_mins: 120, escalation_level: 2,
      description: 'Main transformer junction at Mindspace Gate 2 has live cables submerged in accumulated rainwater. High danger of fatal electric shock.',
      reported_by: 'Citizen (Via Mobile App)', dispatched_worker: null,
      resolved_image: null, resolved_proof: null, updated_at: iso(75 * 60 * 1000),
    },
    {
      id: '103', title: 'Unmarked Open Manhole on Pedestrian Path',
      category: 'Sanitation & Drainage', department: 'Sanitation & Drainage',
      severity: 'HIGH', water_level: 1.2, lat: 17.4320, lon: 78.3715,
      upvotes_count: 4, status: 'IN_PROGRESS', created_at: iso(220 * 60 * 1000),
      sla_mins: 720, escalation_level: 1,
      description: 'Near the entrance of Bio-Diversity Park, a storm drainage cover has popped off and is fully covered by murky water. Serious pedestrian hazard.',
      reported_by: 'Citizen (Via Mobile App)', dispatched_worker: 'Drainage Team A (Ramesh)',
      resolved_image: null, resolved_proof: null, updated_at: iso(60 * 60 * 1000),
    },
    {
      id: '104', title: 'Deep Pothole Cluster Causing Traffic Stall',
      category: 'Roads & Infrastructure', department: 'Roads & Buildings',
      severity: 'MEDIUM', water_level: 0.4, lat: 17.4481, lon: 78.3698,
      upvotes_count: 2, status: 'OPEN', created_at: iso(40 * 60 * 1000),
      sla_mins: 2880, escalation_level: 1,
      description: 'A group of deep potholes at IKEA junction is causing vehicles to brake abruptly and gridlocking the street.',
      reported_by: 'Citizen (Via Mobile App)', dispatched_worker: null,
      resolved_image: null, resolved_proof: null, updated_at: iso(40 * 60 * 1000),
    },
  ];

  const seedComplaints = db.transaction(() => {
    for (const c of complaints) insertComplaint.run(c);
  });
  seedComplaints();
  console.log(`  ✔ ${complaints.length} complaints`);

  // ── IoT Sensors ──────────────────────────────────────────────────────────
  const insertSensor = db.prepare(`
    INSERT OR IGNORE INTO iot_sensors (id, name, capacity, status, lat, lon, updated_at)
    VALUES (@id, @name, @capacity, @status, @lat, @lon, @updated_at)
  `);

  const sensors = [
    { id: 'S1', name: 'Sector 4 Underpass Drain',      capacity: 88, status: 'CRITICAL', lat: 17.4420, lon: 78.3705 },
    { id: 'S2', name: 'Cyber Towers Drainage Terminal', capacity: 65, status: 'WARNING',  lat: 17.4445, lon: 78.3765 },
    { id: 'S3', name: 'Mindspace Road Main Trunk',      capacity: 42, status: 'NORMAL',   lat: 17.4395, lon: 78.3820 },
    { id: 'S4', name: 'Bio-Diversity Junction Intake',  capacity: 55, status: 'NORMAL',   lat: 17.4315, lon: 78.3725 },
  ];

  const seedSensors = db.transaction(() => {
    for (const s of sensors)
      insertSensor.run({ ...s, updated_at: new Date().toISOString() });
  });
  seedSensors();
  console.log(`  ✔ ${sensors.length} IoT sensors`);

  // ── Authority ─────────────────────────────────────────────────────────────
  const existingAuth = db
    .prepare("SELECT COUNT(*) AS n FROM authorities WHERE badge_id = 'GHMC-ENG-2026'")
    .get();
  if (!existingAuth || existingAuth.n === 0) {
    const hash = bcrypt.hashSync('admin', 12);
    db.prepare(`
      INSERT INTO authorities (badge_id, password_hash, display_name, created_at)
      VALUES (?, ?, ?, ?)
    `).run('GHMC-ENG-2026', hash, 'GHMC Command Center', new Date().toISOString());
    console.log('  ✔ Authority GHMC-ENG-2026 (password: admin)');
  }

  // ── Notification ──────────────────────────────────────────────────────────
  db.prepare(`
    INSERT INTO notification_logs (type, message, created_at) VALUES (?, ?, ?)
  `).run(
    'system',
    'UrbanGuard Civic Response System initialized. Connected to Ward 14 (Cyberabad).',
    new Date().toISOString()
  );

  console.log('  ✅ Seed complete.');
}

module.exports = { seedIfEmpty };

// ── Standalone script: node seed.js ──────────────────────────────────────
if (require.main === module) {
  require('dotenv').config();
  (async () => {
    console.log('🌱 Initializing database…');
    await db.init();
    await seedIfEmpty();
  })().catch(err => { console.error('Seed failed:', err); process.exit(1); });
}
