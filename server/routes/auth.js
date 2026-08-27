'use strict';
/**
 * routes/auth.js
 *
 * POST /api/auth/login           — citizen login (name-optional, just starts a session)
 * POST /api/auth/authority-login — badge_id + password, checked against bcrypt hash in DB
 * POST /api/auth/logout          — destroys the session
 * GET  /api/auth/me              — returns current session user (used on frontend mount)
 */

const { Router } = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');

const router = Router();

// ── GET /api/auth/me ───────────────────────────────────────────────────────
router.get('/me', (req, res) => {
  if (!req.session || !req.session.role) {
    return res.json({ user: null });
  }
  res.json({
    user: {
      role: req.session.role,
      name: req.session.name || 'Ward 14 Resident',
    },
  });
});

// ── POST /api/auth/login (citizen) ────────────────────────────────────────
router.post('/login', (req, res) => {
  const name = (req.body.name || '').trim() || 'Ward 14 Guest Resident';
  req.session.role = 'CITIZEN';
  req.session.name = name;
  res.json({ user: { role: 'CITIZEN', name } });
});

// ── POST /api/auth/authority-login ────────────────────────────────────────
router.post('/authority-login', (req, res) => {
  const { badge_id, password } = req.body;

  if (!badge_id || !password) {
    return res.status(400).json({ error: 'badge_id and password are required' });
  }

  const authority = db.prepare('SELECT * FROM authorities WHERE badge_id = ?').get(badge_id.trim());
  if (!authority) {
    // Generic message — don't reveal whether the badge_id exists
    return res.status(401).json({ error: 'Unauthorized Access: Invalid Municipal Credentials' });
  }

  const match = bcrypt.compareSync(password, authority.password_hash);
  if (!match) {
    return res.status(401).json({ error: 'Unauthorized Access: Invalid Municipal Credentials' });
  }

  req.session.role = 'AUTHORITY';
  req.session.name = authority.display_name;
  req.session.badge_id = authority.badge_id;

  res.json({
    user: {
      role: 'AUTHORITY',
      name: authority.display_name,
      badge_id: authority.badge_id,
    },
  });
});

// ── POST /api/auth/logout ─────────────────────────────────────────────────
router.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('urbanguard.sid');
    res.json({ ok: true });
  });
});

module.exports = router;
