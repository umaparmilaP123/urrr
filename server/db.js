'use strict';
/**
 * db.js — sql.js WASM SQLite with better-sqlite3-compatible synchronous API.
 *
 * Production (Vercel):  loads WASM from CDN; DB file lives in /tmp (writable).
 * Development:          reads WASM from local node_modules; DB file in server/.
 */

const fs   = require('fs');
const path = require('path');

const IS_PROD = process.env.NODE_ENV === 'production';

// /tmp is the only writable path on Vercel's Lambda filesystem.
const DB_PATH = IS_PROD
  ? '/tmp/urbanguard.db'
  : path.join(__dirname, 'urbanguard.db');

// ── Named-param conversion ─────────────────────────────────────────────────
function convertParams(params) {
  if (params === undefined || params === null) return undefined;
  if (Array.isArray(params)) return params.map(v => (v === undefined ? null : v));
  if (typeof params === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(params)) {
      const key = /^[:@$]/.test(k) ? k : `@${k}`;
      out[key] = v === undefined ? null : v;
    }
    return out;
  }
  return [params === undefined ? null : params];
}

// ── Statement ──────────────────────────────────────────────────────────────
class Statement {
  constructor(sqlDb, sql, compat) {
    this._sqlDb  = sqlDb;
    this._sql    = sql;
    this._compat = compat;
    this._stmt   = sqlDb.prepare(sql);
  }

  _bind(params) {
    this._stmt.reset();
    const converted = convertParams(params);
    if (converted !== undefined) this._stmt.bind(converted);
  }

  run(...args) {
    const params = args.length === 1 ? args[0] : args;
    this._bind(params);
    try { this._stmt.step(); } catch (e) { this._stmt.reset(); throw e; }
    this._stmt.reset();
    this._compat._save();
    const res = this._sqlDb.exec('SELECT last_insert_rowid()');
    return { lastInsertRowid: res[0]?.values?.[0]?.[0] ?? 0, changes: 1 };
  }

  get(...args) {
    const params = args.length === 1 ? args[0] : args;
    this._bind(params);
    let result;
    try { result = this._stmt.step() ? this._stmt.getAsObject() : undefined; }
    finally { this._stmt.reset(); }
    return result;
  }

  all(...args) {
    const params = args.length === 1 ? args[0] : args;
    this._bind(params);
    const rows = [];
    try { while (this._stmt.step()) rows.push({ ...this._stmt.getAsObject() }); }
    finally { this._stmt.reset(); }
    return rows;
  }
}

// ── DbCompat ───────────────────────────────────────────────────────────────
class DbCompat {
  constructor(sqlDb, dbPath) {
    this._sqlDb   = sqlDb;
    this._dbPath  = dbPath;
    this._txDepth = 0;
  }

  _save() {
    if (this._txDepth > 0) return;
    try {
      const data = this._sqlDb.export();
      fs.writeFileSync(this._dbPath, Buffer.from(data));
    } catch (e) {
      // On Vercel /tmp writes can occasionally fail — log and continue
      console.warn('[db] _save failed:', e.message);
    }
  }

  prepare(sql)    { return new Statement(this._sqlDb, sql, this); }
  exec(sql)       { this._sqlDb.exec(sql); this._save(); }
  pragma(str)     { try { this._sqlDb.run(`PRAGMA ${str}`); } catch { /* ignore */ } }

  transaction(fn) {
    return (...args) => {
      this._sqlDb.run('BEGIN');
      this._txDepth++;
      try {
        const result = fn(...args);
        this._txDepth--;
        this._sqlDb.run('COMMIT');
        this._save();
        return result;
      } catch (err) {
        this._txDepth--;
        try { this._sqlDb.run('ROLLBACK'); } catch { /* ignore */ }
        throw err;
      }
    };
  }
}

// ── Schema ─────────────────────────────────────────────────────────────────
const SCHEMA_SQL = `
  CREATE TABLE IF NOT EXISTS complaints (
    id               TEXT PRIMARY KEY,
    title            TEXT NOT NULL,
    category         TEXT NOT NULL,
    department       TEXT NOT NULL,
    severity         TEXT NOT NULL,
    water_level      REAL DEFAULT 0,
    lat              REAL NOT NULL,
    lon              REAL NOT NULL,
    upvotes_count    INTEGER DEFAULT 1,
    status           TEXT DEFAULT 'OPEN',
    created_at       TEXT NOT NULL,
    sla_mins         INTEGER NOT NULL,
    escalation_level INTEGER DEFAULT 1,
    description      TEXT NOT NULL,
    reported_by      TEXT DEFAULT 'Citizen (Via Mobile App)',
    dispatched_worker TEXT,
    resolved_image   TEXT,
    resolved_proof   TEXT,
    updated_at       TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS upvotes (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    complaint_id TEXT NOT NULL,
    client_id    TEXT NOT NULL,
    created_at   TEXT NOT NULL,
    UNIQUE(complaint_id, client_id)
  );
  CREATE TABLE IF NOT EXISTS iot_sensors (
    id         TEXT PRIMARY KEY,
    name       TEXT NOT NULL,
    capacity   INTEGER NOT NULL,
    status     TEXT NOT NULL,
    lat        REAL NOT NULL,
    lon        REAL NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS notification_logs (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    type       TEXT NOT NULL,
    message    TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS authorities (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    badge_id      TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    display_name  TEXT NOT NULL,
    created_at    TEXT NOT NULL
  );
`;

// ── DbWrapper — public singleton ───────────────────────────────────────────
class DbWrapper {
  constructor() { this._compat = null; }

  async init() {
    if (this._compat) return this;

    const initSqlJs = require('sql.js');
    let SQL;

    if (IS_PROD) {
      // In serverless (Vercel), load WASM from cdnjs to avoid bundle issues.
      // The sql.js 1.x WASM API is stable; patch versions are wire-compatible.
      SQL = await initSqlJs({
        locateFile: file =>
          `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.12.0/${file}`,
      });
    } else {
      const wasmBinary = fs.readFileSync(
        path.join(__dirname, 'node_modules', 'sql.js', 'dist', 'sql-wasm.wasm')
      );
      SQL = await initSqlJs({ wasmBinary });
    }

    let sqlDb;
    if (fs.existsSync(DB_PATH)) {
      const buf = fs.readFileSync(DB_PATH);
      sqlDb = new SQL.Database(buf);
      console.log(`  📂 Loaded DB: ${DB_PATH}`);
    } else {
      sqlDb = new SQL.Database();
      console.log(`  🆕 Created DB: ${DB_PATH}`);
    }

    this._compat = new DbCompat(sqlDb, DB_PATH);
    this._compat.exec(SCHEMA_SQL);
    return this;
  }

  prepare(sql)    { return this._compat.prepare(sql); }
  exec(sql)       { return this._compat.exec(sql); }
  pragma(str)     { return this._compat.pragma(str); }
  transaction(fn) { return this._compat.transaction(fn); }
}

const db = new DbWrapper();
module.exports = db;