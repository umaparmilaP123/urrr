'use strict';
/**
 * middleware/requireAuthority.js
 * Guards authority-only mutation endpoints.
 * Rejects with 401 if no session, 403 if session exists but role ≠ AUTHORITY.
 */

function requireAuthority(req, res, next) {
  if (!req.session || !req.session.role) {
    return res.status(401).json({ error: 'Authentication required. Please log in.' });
  }
  if (req.session.role !== 'AUTHORITY') {
    return res.status(403).json({ error: 'Forbidden. This action requires Authority privileges.' });
  }
  next();
}

module.exports = requireAuthority;
