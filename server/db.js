'use strict';
/**
 * db.js
 * sql.js-backed SQLite with a synchronous better-sqlite3-compatible API.
 *
 * Why sql.js?  better-sqlite3 requires native compilation (node-gyp + MSVC)
 * which is not available in all environments.  sql.js is pure WASM — no build
 * tools required.  All database operations are still synchronous after init.
 *
 * Usage:
 *   const db = require('./db');
 *   await db.init();                // once at server startup
 *   db.prepare('SELECT …').get()   // synchronous from here on
 */

const fs   = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'urbanguard.db');

// ── Named-param conversion ──────────────────────────────────────────────────
// better-sqlite3 uses @name in SQL + { name: value } in .run() / .get() / .all()
// sql.js       uses @name in SQL + { '@name': value } in .bind()
// We only need to prefix the object keys — no SQL rewriting required.

function convertParams(params) {
  if (params === undefined || params === null) return undefined;
  if (Array.isArray(params)) {
    return params.map(v => (v === undefined ? null : v));
  }
  if (typeof params === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(params)) {
      // Already has a prefix → keep it; plain name → add @
      const key = /^[:@$]/.test(k) ? k : `@${k}`;
      out[key] = v === undefined ? null : v;
    }
    return out;
  }
  // Scalar — wrap in array so sql.js treats it as positional
  return [params === undefined ? null : params];
}

// ── Statement ───────────────────────────────────────────────────────────────
class Statement {
  /** @param {import('sql.js').Database} sqlDb */
  constructor(sqlDb, sql, compat) {
    this._sqlDb  = sqlDb;
    this._sql    = sql;
    this._compat = compat;          // DbCompat — needed for _save / _txDepth
    this._stmt   = sqlDb.prepare(sql);
  }

  _bind(params) {
    this._stmt.reset();
    const converted = convertParams(params);
    if (converted !== undefined) {
      this._stmt.bind(converted);
    }
  }

  /** Execute a DML statement (INSERT / UPDATE / DELETE). Returns { lastInsertRowid, changes }. */
  run(...args) {
    const params = args.length === 1 ? args[0] : args;
    this._bind(params);
    try {
      this._stmt.step();
    } catch (e) {
      this._stmt.reset();
      throw e;
    }
    this._stmt.reset();
    this._compat._save();

    // Retrieve last inserted rowid
    const res = this._sqlDb.exec('SELECT last_insert_rowid()');
    const rowid = res[0]?.values?.[0]?.[0] ?? 0;
    return { lastInsertRowid: rowid, changes: 1 };
  }

  /** Execute a SELECT statement and return the first row, or undefined. */
  get(...args) {
    const params = args.length === 1 ? args[0] : args;
    this._bind(params);
    let result;
    try {
      result = this._stmt.step() ? this._stmt.getAsObject() : undefined;
    } finally {
      this._stmt.reset();
    }
    return result;
  }

  /** Execute a SELECT statement and return all rows as an array. */
  all(...args) {
    const params = args.length === 1 ? args[0] : args;
    this._bind(params);
    const rows = [];
    try {
      while (this._stmt.step()) {
        rows.push({ ...this._stmt.getAsObject() });
      }
    } finally {
      this._stmt.reset();
    }
    return rows;
  }
}

// ── DbCompat ────────────────────────────────────────────────────────────────
// Wraps a raw sql.js Database and provides the better-sqlite3 surface.
class DbCompat {
  /** @param {import('sql.js').Database} sqlDb */
  constructor(sqlDb, dbPath) {
    this._sqlDb   = sqlDb;
    this._dbPath  = dbPath;
    this._txDepth = 0;     // suppress mid-transaction disk writes
  }

  /** Persist the in-memory DB to disk (suppressed inside transactions). */
  _save() {
    if (this._txDepth > 0) return;
    const data = this._sqlDb.export();
    fs.writeFileSync(this._dbPath, Buffer.from(data));
  }

  /** Prepare a statement and return a Statement wrapper. */
  prepare(sql) {
    return new Statement(this._sqlDb, sql, this);
  }

  /**
   * Execute one or more SQL statements (DDL or DML without params).
   * Uses sql.js exec() which handles semicolon-separated statements.
   */
  exec(sql) {
    this._sqlDb.exec(sql);
    this._save();
  }

  /** Run a PRAGMA. WAL / foreign_keys etc. — best-effort; errors are swallowed. */
  pragma(str) {
    try { this._sqlDb.run(`PRAGMA ${str}`); } catch { /* sql.js ignores some pragmas */ }
  }

  /**
   * Wrap a function in a SQLite transaction.
   * Returns a new function; calling it executes fn inside BEGIN … COMMIT.
   * Mirrors better-sqlite3's db.transaction() API exactly.
   */
  transaction(fn) {
    return (...args) => {
      this._sqlDb.run('BEGIN');
      this._txDepth++;
      try {
        const result = fn(...args);
        this._txDepth--;
        this._sqlDb.run('COMMIT');
        this._save();           // single disk write after commit
        return result;
      } catch (err) {
        this._txDepth--;
        try { this._sqlDb.run('ROLLBACK'); } catch { /* ignore */ }
        throw err;
      }
    };
  }
}

// ── Schema DDL ──────────────────────────────────────────────────────────────
const SCHEMA_SQL = `
  CREATE TABLE IF NOT EXISTS complaints (
    id                 TEXT PRIMARY KEY,
    title              TEXT NOT NULL,
    category           TEXT NOT NULL,
    department         TEXT NOT NULL,
    severity           TEXT NOT NULL,
    water_level        REAL DEFAULT 0,
    lat                REAL NOT NULL,
    lon                REAL NOT NULL,
    upvotes_count      INTEGER DEFAULT 1,
    status             TEXT DEFAULT 'OPEN',
    created_at         TEXT NOT NULL,
    sla_mins           INTEGER NOT NULL,
    escalation_level   INTEGER DEFAULT 1,
    description        TEXT NOT NULL,
    reported_by        TEXT DEFAULT 'Citizen (Via Mobile App)',
    dispatched_worker  TEXT,
    resolved_image     TEXT,
    resolved_proof     TEXT,
    updated_at         TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS upvotes (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    complaint_id   TEXT NOT NULL,
    client_id      TEXT NOT NULL,
    created_at     TEXT NOT NULL,
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
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    badge_id        TEXT UNIQUE NOT NULL,
    password_hash   TEXT NOT NULL,
    display_name    TEXT NOT NULL,
    created_at      TEXT NOT NULL
  );
`;

// ── DbWrapper — public singleton ─────────────────────────────────────────────
// Exported by this module. Call `await db.init()` once at server startup.
// After that, all db.prepare() / db.exec() / db.transaction() calls are sync.
class DbWrapper {
  constructor() {
    this._compat = null;
  }

  /**
   * Initialize sql.js WASM engine, open (or create) the DB file, run schema.
   * Safe to call multiple times — subsequent calls are no-ops.
   */
  async init() {
    if (this._compat) return this;

    const initSqlJs = require('sql.js');

    // Corrected path to point to root node_modules instead of server/node_modules
    const wasmBinary = fs.readFileSync(
      path.join(__dirname, '../node_modules', 'sql.js', 'dist', 'sql-wasm.wasm')
    );
    const SQL = await initSqlJs({ wasmBinary });

    // Load existing DB file, or start fresh
    let sqlDb;
    if (fs.existsSync(DB_PATH)) {
      const buf = fs.readFileSync(DB_PATH);
      sqlDb = new SQL.Database(buf);
      console.log(`  📂 Loaded existing database: ${DB_PATH}`);
    } else {
      sqlDb = new SQL.Database();
      console.log(`  🆕 Created new database: ${DB_PATH}`);
    }

    this._compat = new DbCompat(sqlDb, DB_PATH);
    this._compat.exec(SCHEMA_SQL);   // CREATE TABLE IF NOT EXISTS (idempotent)
    return this;
  }

  // ── Delegate better-sqlite3 surface to DbCompat ────────────────────────
  prepare(sql)    { return this._compat.prepare(sql); }
  exec(sql)       { return this._compat.exec(sql); }
  pragma(str)     { return this._compat.pragma(str); }
  transaction(fn) { return this._compat.transaction(fn); }
}

// Export the singleton — `require('./db')` always returns the same instance.
const db = new DbWrapper();
module.exports = db;