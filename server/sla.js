'use strict';
/**
 * sla.js
 * In-process SLA cron — runs every 10 seconds.
 * Mirrors the logic from the client-side setInterval in UrbanGuardContext.jsx:
 *   - 50% SLA elapsed + undispatched + status OPEN → escalate to L2
 *   - 100% SLA elapsed + escalation < 3            → force ESCALATED / L3
 * Writes escalation events to notification_logs.
 *
 * NOTE: statements are prepared lazily inside runSlaCron() so that this
 * module can be required before db.init() is awaited.
 */

const db = require('./db');

function runSlaCron() {
  const now = Date.now();

  const open = db.prepare(`
    SELECT id, created_at, sla_mins, escalation_level, status, dispatched_worker
    FROM complaints
    WHERE status != 'RESOLVED'
  `).all();

  const doUpdates = db.transaction(() => {
    for (const c of open) {
      const elapsed = (now - new Date(c.created_at).getTime()) / 60000;
      const pct = (elapsed / c.sla_mins) * 100;
      let esc    = c.escalation_level;
      let status = c.status;
      let changed = false;

      // 50% SLA elapsed, still open, no worker dispatched → L2
      if (pct >= 50 && esc === 1 && status === 'OPEN' && !c.dispatched_worker) {
        esc = 2;
        changed = true;
        db.prepare('INSERT INTO notification_logs (type, message, created_at) VALUES (?, ?, ?)').run(
          'escalation',
          `SLA Cron: Incident #${c.id} hit 50% SLA without dispatch. Auto-escalated → L2 (Supervisor).`,
          new Date().toISOString()
        );
      }

      // 100% SLA elapsed → L3 breach
      if (pct >= 100 && esc < 3) {
        esc = 3;
        status = 'ESCALATED';
        changed = true;
        db.prepare('INSERT INTO notification_logs (type, message, created_at) VALUES (?, ?, ?)').run(
          'escalation',
          `🚨 SLA BREACH: Incident #${c.id} exceeded ${c.sla_mins} min SLA. Auto-escalated → L3 (Dept Chief).`,
          new Date().toISOString()
        );
      }

      if (changed) {
        db.prepare(`
          UPDATE complaints
          SET escalation_level = ?, status = ?, updated_at = ?
          WHERE id = ?
        `).run(esc, status, new Date().toISOString(), c.id);
      }
    }
  });

  doUpdates();
}

function startSlaCron() {
  console.log('⏱  SLA cron started (10 s interval)');
  setInterval(runSlaCron, 10_000);
}

module.exports = { startSlaCron };
