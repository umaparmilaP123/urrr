'use strict';
/**
 * index.js — UrbanGuard Express server entry point
 */

require('dotenv').config();

const express = require('express');
const cors    = require('cors');
const path    = require('path');
const session = require('express-session');
const MemoryStore = require('memorystore')(session);

const db = require('./db');

const complaintsRouter    = require('./routes/complaints');
const sensorsRouter       = require('./routes/sensors');
const notificationsRouter = require('./routes/notifications');
const authRouter          = require('./routes/auth');
const visionRouter        = require('./routes/vision');
const { startSlaCron }    = require('./sla');

const app  = express();
const PORT = process.env.PORT || 3000;

// ── CORS ───────────────────────────────────────────────────────────────────
// Allow the Vite dev server; credentials: true is required so the browser
// sends the session cookie cross-origin during development.
app.use(cors({
  origin: process.env.CLIENT_ORIGIN || 'http://localhost:3000',
  credentials: true,
}));

// ── Body parsing ───────────────────────────────────────────────────────────
// Larger limit to handle base64 proof images / Gemini vision uploads
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ── Session ────────────────────────────────────────────────────────────────
const SESSION_SECRET = process.env.SESSION_SECRET || 'change_me_in_production';
if (SESSION_SECRET === 'change_me_in_production') {
  console.warn('⚠  SESSION_SECRET not set — using default dev secret.');
}

app.use(session({
  store: new MemoryStore({ checkPeriod: 86_400_000 }), // prune expired entries daily
  name: 'urbanguard.sid',
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
    maxAge: 24 * 60 * 60 * 1000, // 24 h
  },
}));

// ── Routes ─────────────────────────────────────────────────────────────────
app.use('/api/complaints',            complaintsRouter);
app.use('/api/iot-sensors',       sensorsRouter);
app.use('/api/notifications',      notificationsRouter);
app.use('/api/auth',                authRouter);
app.use('/api/vision/analyze-hazard', visionRouter);

// Health check
app.get('/api/health', (req, res) =>
  res.json({ status: 'ok', ts: new Date().toISOString() })
);

// API 404 fallback (ensures missing /api/* routes return JSON instead of serving index.html)
app.use((req, res, next) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: `Route not found: ${req.method} ${req.path}` });
  }
  next();
});

// ── Frontend Static Serving ────────────────────────────────────────────────
app.use(express.static(path.join(__dirname, '../dist')));

// SPA client-side routing fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../dist/index.html'));
});

// Error handler
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, _next) => {
  console.error('[ERROR]', err.message);
  res.status(500).json({ error: 'Internal server error', detail: err.message });
});

// ── Async startup ──────────────────────────────────────────────────────────
async function start() {
  console.log('\n🛡  UrbanGuard — initialising database…');
  await db.init();

  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    startSlaCron();
  });
}

start().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});