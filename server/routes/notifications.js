'use strict';
/**
 * routes/notifications.js
 * GET /api/notifications?page=1&limit=50  — paginated, newest first
 */

const { Router } = require('express');
const db = require('../db');

const router = Router();

router.get('/', (req, res) => {
  const page  = Math.max(1, parseInt(req.query.page,  10) || 1);
  const limit = Math.min(100, parseInt(req.query.limit, 10) || 50);
  const offset = (page - 1) * limit;

  const rows = db.prepare(`
    SELECT * FROM notification_logs
    ORDER BY created_at DESC
    LIMIT ? OFFSET ?
  `).all(limit, offset);

  const total = db.prepare('SELECT COUNT(*) AS n FROM notification_logs').get().n;

  const notifications = rows.map(r => ({
    id: String(r.id),
    type: r.type,
    message: r.message,
    timestamp: r.created_at,
  }));

  res.json({ notifications, total, page, limit });
});

module.exports = router;
