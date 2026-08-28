'use strict';
require('dotenv').config();

const express      = require('express');
const cors         = require('cors');
const session      = require('express-session');
const MemoryStore  = require('memorystore')(session);
const rateLimit    = require('express-rate-limit');

const db                = require('./db');
const { seedIfEmpty }   = require('./seed');
const { startSlaCron }  = require('./sla');
const complaintsRouter  = require('./routes/complaints');
const sensorsRouter     = require('./routes/sensors');
const notifRouter       = require('./routes/notifications');
const authRouter        = require('./routes/auth');
const visionRouter      = require('./routes/vision');

const app    = express();
const PORT   = parseInt(process.env.PORT || '5000', 10);
const IS_PROD = process.env.NODE_ENV === 'production';

// ── CORS ───────────────────────────────────────────────────────────────────
// In production (Vercel) frontend + API share the same domain, so CORS is
// a no-op for same-origin requests.  Allow any origin in prod for flexibility;
// in dev, restrict to the Vite dev server.
app.use(cors({
  origin: IS_PROD
    ? (process.env.CLIENT_ORIGIN || true)   // reflect origin; set CLIENT_ORIGIN in Vercel dashboard if needed
    : (process.env.CLIENT_ORIGIN || 'http://localhost:3000'),
  credentials: true,
}));

// ── Body parsing ───────────────────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ── Sessions ───────────────────────────────────────────────────────────────
// memorystore is ephemeral — sessions reset on cold start in serverless.
// Acceptable for a demo; swap for Redis/Postgres sessions for production SLAs.
const sessionSecret = process.env.SESSION_SECRET;
if (!sessionSecret || sessionSecret === 'change_me_to_a_long_random_secret_in_production') {
  console.warn('⚠  SESSION_SECRET not set — using default dev secret.');
}
app.use(session({
  store: new MemoryStore({ checkPeriod: 86_400_000 }),
  secret: sessionSecret || 'urbanguard-dev-secret',
  resave: false,
  saveUninitialized: false,
  name: 'urbanguard.sid',
  cookie: {
    httpOnly: true,
    secure: IS_PROD,
    sameSite: IS_PROD ? 'none' : 'lax',
    maxAge: 8 * 60 * 60 * 1000,
  },
}));

// ── Global rate limit ──────────────────────────────────────────────────────
app.use('/api', rateLimit({ windowMs: 60_000, max: 120, standardHeaders: true, legacyHeaders: false }));

// ── Lazy DB initialisation (serverless-safe) ───────────────────────────────
// On Vercel each cold start needs to init + seed the in-memory DB before
// handling any request.  Subsequent warm invocations reuse _initPromise.
let _initPromise = null;
function ensureReady() {
  if (!_initPromise) {
    _initPromise = (async () => {
      console.log('🛡  UrbanGuard — initialising database…');
      await db.init();
      await seedIfEmpty();
    })();
  }
  return _initPromise;
}

// This middleware runs before every route, ensuring the DB is ready.
app.use((req, res, next) => {
  ensureReady().then(() => next()).catch(next);
});

// ── Health ─────────────────────────────────────────────────────────────────
app.get('/api/health', (_req, res) => res.json({ status: 'ok', ts: new Date() }));

// ── Routes ─────────────────────────────────────────────────────────────────
app.use('/api/complaints',   complaintsRouter);
app.use('/api/iot-sensors',  sensorsRouter);
app.use('/api/notifications', notifRouter);
app.use('/api/auth',         authRouter);
app.use('/api/vision',       visionRouter);

// ── 404 + error handlers ───────────────────────────────────────────────────
app.use((_req, res) => res.status(404).json({ error: 'Not found' }));
app.use((err, _req, res, _next) => {
  console.error('[UrbanGuard] unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// ── Dev server ─────────────────────────────────────────────────────────────
// In production (Vercel), the Lambda runtime invokes module.exports directly.
// SLA cron requires a persistent long-running process — not possible in serverless.
if (!IS_PROD) {
  ensureReady()
    .then(() => {
      app.listen(PORT, () => {
        console.log(`\n🛡  UrbanGuard API  →  http://localhost:${PORT}`);
        console.log('   GET  /api/complaints');
        console.log('   GET  /api/iot-sensors');
        console.log('   GET  /api/notifications');
        console.log('   POST /api/auth/authority-login');
        console.log('   POST /api/vision/analyze-hazard\n');
        startSlaCron();
        console.log('⏱  SLA cron started (10 s interval)\n');
      });
    })
    .catch(err => { console.error('Failed to start server:', err); process.exit(1); });
}

// ── Vercel serverless entrypoint ────────────────────────────────────────────
module.exports = app;