import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'fs';
import { dirname } from 'path';

export function createDb(dbPath) {
  if (dbPath !== ':memory:') {
    mkdirSync(dirname(dbPath), { recursive: true });
  }

  const db = new DatabaseSync(dbPath);
  db.exec('PRAGMA foreign_keys = ON');
  db.exec('PRAGMA journal_mode = WAL');

  db.exec(`
    CREATE TABLE IF NOT EXISTS accounts (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      name       TEXT NOT NULL,
      type       TEXT,
      currency   TEXT NOT NULL DEFAULT 'DOP',
      color      TEXT NOT NULL DEFAULT '#3B82F6',
      is_active  INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS transactions (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      account_id  INTEGER NOT NULL REFERENCES accounts(id),
      type        TEXT NOT NULL CHECK(type IN ('INCOME','EXPENSE')),
      amount      REAL NOT NULL CHECK(amount > 0),
      date        TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      category    TEXT NOT NULL DEFAULT 'otros',
      metadata    TEXT NOT NULL DEFAULT '{}',
      created_at  TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS notes (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      title      TEXT NOT NULL DEFAULT '',
      content    TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS transfers (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      from_account_id INTEGER NOT NULL REFERENCES accounts(id),
      to_account_id   INTEGER NOT NULL REFERENCES accounts(id),
      amount_from     REAL NOT NULL CHECK(amount_from > 0),
      amount_to       REAL NOT NULL CHECK(amount_to > 0),
      date            TEXT NOT NULL,
      description     TEXT NOT NULL DEFAULT '',
      created_at      TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS settings (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS account_types (
      id       INTEGER PRIMARY KEY AUTOINCREMENT,
      slug     TEXT NOT NULL UNIQUE,
      name     TEXT NOT NULL,
      position INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS categories (
      id       INTEGER PRIMARY KEY AUTOINCREMENT,
      slug     TEXT NOT NULL UNIQUE,
      name     TEXT NOT NULL,
      color    TEXT NOT NULL DEFAULT '#94a3b8',
      kind     TEXT NOT NULL DEFAULT 'EXPENSE' CHECK(kind IN ('INCOME','EXPENSE','BOTH')),
      position INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS custom_fields (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      key        TEXT NOT NULL UNIQUE,
      name       TEXT NOT NULL,
      type       TEXT NOT NULL CHECK(type IN ('text','number','select','date','boolean')),
      options    TEXT NOT NULL DEFAULT '[]',
      applies_to TEXT NOT NULL DEFAULT 'BOTH' CHECK(applies_to IN ('INCOME','EXPENSE','BOTH')),
      position   INTEGER NOT NULL DEFAULT 0
    );
  `);

  // Databases created before the category feature need the column added.
  const txCols = db.prepare(`PRAGMA table_info(transactions)`).all();
  if (!txCols.some(c => c.name === 'category')) {
    db.exec(`ALTER TABLE transactions ADD COLUMN category TEXT NOT NULL DEFAULT 'otros'`);
  }
  if (!txCols.some(c => c.name === 'tags')) {
    db.exec(`ALTER TABLE transactions ADD COLUMN tags TEXT NOT NULL DEFAULT '[]'`);
  }

  seedCatalogs(db);

  return db;
}

// First run (or first run after the catalogs feature): populate the editable
// catalogs with the values that used to be hardcoded in the client.
function seedCatalogs(db) {
  if (db.prepare(`SELECT COUNT(*) AS c FROM account_types`).get().c === 0) {
    const ins = db.prepare(`INSERT INTO account_types (slug, name, position) VALUES (?, ?, ?)`);
    [['bank', 'Banco'], ['cash', 'Efectivo'], ['savings', 'Ahorros'], ['other', 'Otro']]
      .forEach(([slug, name], i) => ins.run(slug, name, i));
  }

  if (db.prepare(`SELECT COUNT(*) AS c FROM categories`).get().c === 0) {
    const ins = db.prepare(`INSERT INTO categories (slug, name, color, kind, position) VALUES (?, ?, ?, ?, ?)`);
    const expense = [
      ['comida', 'Comida', '#f59e0b'],
      ['supermercado', 'Supermercado', '#84cc16'],
      ['transporte', 'Transporte', '#06b6d4'],
      ['vivienda', 'Vivienda', '#8b5cf6'],
      ['servicios', 'Servicios', '#0ea5e9'],
      ['salud', 'Salud', '#e11d48'],
      ['educacion', 'Educación', '#6366f1'],
      ['entretenimiento', 'Entretenimiento', '#d946ef'],
      ['compras', 'Compras', '#f97316'],
      ['ropa', 'Ropa', '#ec4899'],
      ['viajes', 'Viajes', '#14b8a6'],
      ['mascotas', 'Mascotas', '#a3e635'],
      ['deudas', 'Deudas', '#64748b'],
      ['familia', 'Familia', '#fb7185'],
    ];
    const income = [
      ['salario', 'Salario', '#059669'],
      ['negocio', 'Negocio', '#10b981'],
      ['freelance', 'Freelance', '#22c55e'],
      ['inversiones', 'Inversiones', '#84cc16'],
      ['regalo', 'Regalo', '#f59e0b'],
      ['reembolso', 'Reembolso', '#06b6d4'],
    ];
    let pos = 0;
    for (const [slug, name, color] of expense) ins.run(slug, name, color, 'EXPENSE', pos++);
    for (const [slug, name, color] of income)  ins.run(slug, name, color, 'INCOME', pos++);
    ins.run('otros', 'Otros', '#94a3b8', 'BOTH', pos);
  }

  if (db.prepare(`SELECT COUNT(*) AS c FROM custom_fields`).get().c === 0) {
    db.prepare(
      `INSERT INTO custom_fields (key, name, type, options, applies_to, position) VALUES (?, ?, ?, ?, ?, 0)`
    ).run(
      'metodo_pago', 'Método de pago', 'select',
      JSON.stringify(['Efectivo', 'Tarjeta', 'Transferencia', 'Otro']), 'BOTH'
    );
  }
}
