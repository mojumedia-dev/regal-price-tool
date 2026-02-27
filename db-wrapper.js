/**
 * Drop-in replacement for better-sqlite3 using sql.js (pure JS, no native bindings)
 * Implements the subset of better-sqlite3 API used by this project
 */
const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

let SQL;
const initPromise = initSqlJs().then(s => { SQL = s; });

class Statement {
  constructor(db, sql) {
    this.db = db;
    this.sql = sql;
  }
  run(...params) {
    const flatParams = params.length === 1 && Array.isArray(params[0]) ? params[0] : params;
    this.db.run(this.sql, flatParams);
    const changes = this.db.getRowsModified();
    const stmt = this.db.prepare('SELECT last_insert_rowid() as id');
    stmt.step();
    const lastInsertRowid = stmt.getAsObject().id;
    stmt.free();
    return { changes, lastInsertRowid };
  }
  get(...params) {
    const flatParams = params.length === 1 && Array.isArray(params[0]) ? params[0] : params;
    const stmt = this.db.prepare(this.sql);
    stmt.bind(flatParams.length ? flatParams : undefined);
    if (stmt.step()) {
      const row = stmt.getAsObject();
      stmt.free();
      return row;
    }
    stmt.free();
    return undefined;
  }
  all(...params) {
    const flatParams = params.length === 1 && Array.isArray(params[0]) ? params[0] : params;
    const results = [];
    const stmt = this.db.prepare(this.sql);
    if (flatParams.length) stmt.bind(flatParams);
    while (stmt.step()) {
      results.push(stmt.getAsObject());
    }
    stmt.free();
    return results;
  }
}

class Database {
  constructor(filePath) {
    if (!SQL) throw new Error('sql.js not initialized. Call Database.init() first');
    this.filePath = filePath;
    if (fs.existsSync(filePath)) {
      const buffer = fs.readFileSync(filePath);
      this.db = new SQL.Database(buffer);
    } else {
      this.db = new SQL.Database();
    }
    this._saveInterval = setInterval(() => this.save(), 5000);
  }
  
  static async init() {
    await initPromise;
  }

  prepare(sql) {
    return new Statement(this.db, sql);
  }

  exec(sql) {
    this.db.exec(sql);
    this.save();
  }

  pragma(str) {
    try {
      this.db.exec(`PRAGMA ${str}`);
    } catch(e) { /* ignore unsupported pragmas */ }
  }

  save() {
    try {
      const data = this.db.export();
      const buffer = Buffer.from(data);
      const dir = path.dirname(this.filePath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(this.filePath, buffer);
    } catch(e) {
      console.error('DB save error:', e.message);
    }
  }

  close() {
    clearInterval(this._saveInterval);
    this.save();
    this.db.close();
  }
}

module.exports = Database;
