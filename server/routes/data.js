import { Router } from 'express';

export function createDataRouter(db) {
  const router = Router();

  router.get('/export', (_req, res) => {
    res.json({
      app: 'agenda-financiera',
      version: 1,
      exported_at: new Date().toISOString(),
      accounts:      db.prepare(`SELECT * FROM accounts ORDER BY id`).all(),
      transactions:  db.prepare(`SELECT * FROM transactions ORDER BY id`).all(),
      transfers:     db.prepare(`SELECT * FROM transfers ORDER BY id`).all(),
      notes:         db.prepare(`SELECT * FROM notes ORDER BY id`).all(),
      settings:      db.prepare(`SELECT * FROM settings ORDER BY key`).all(),
      account_types: db.prepare(`SELECT * FROM account_types ORDER BY id`).all(),
      categories:    db.prepare(`SELECT * FROM categories ORDER BY id`).all(),
      custom_fields: db.prepare(`SELECT * FROM custom_fields ORDER BY id`).all(),
    });
  });

  router.post('/import', (req, res) => {
    const data = req.body ?? {};
    for (const key of ['accounts', 'transactions', 'transfers', 'notes']) {
      if (!Array.isArray(data[key])) {
        return res.status(400).json({ error: `El backup no es válido: falta la lista "${key}"` });
      }
    }

    const insertAccount = db.prepare(`
      INSERT INTO accounts (id, name, type, currency, color, is_active, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    const insertTx = db.prepare(`
      INSERT INTO transactions (id, account_id, type, amount, date, description, category, metadata, tags, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const insertAccountType = db.prepare(`
      INSERT INTO account_types (id, slug, name, position) VALUES (?, ?, ?, ?)
    `);
    const insertCategory = db.prepare(`
      INSERT INTO categories (id, slug, name, color, kind, position) VALUES (?, ?, ?, ?, ?, ?)
    `);
    const insertCustomField = db.prepare(`
      INSERT INTO custom_fields (id, key, name, type, options, applies_to, position)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    const insertTransfer = db.prepare(`
      INSERT INTO transfers (id, from_account_id, to_account_id, amount_from, amount_to, date, description, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const insertNote = db.prepare(`
      INSERT INTO notes (id, title, content, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?)
    `);
    const upsertSetting = db.prepare(`
      INSERT INTO settings (key, value) VALUES (?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `);

    const now = () => new Date().toISOString().slice(0, 19).replace('T', ' ');

    db.exec('BEGIN');
    try {
      db.exec('DELETE FROM transactions');
      db.exec('DELETE FROM transfers');
      db.exec('DELETE FROM notes');
      db.exec('DELETE FROM accounts');

      for (const a of data.accounts) {
        insertAccount.run(
          a.id ?? null, String(a.name ?? ''), a.type ?? null,
          a.currency ?? 'DOP', a.color ?? '#3B82F6',
          a.is_active === 0 ? 0 : 1, a.created_at ?? now()
        );
      }
      for (const t of data.transactions) {
        insertTx.run(
          t.id ?? null, t.account_id, t.type, t.amount, t.date,
          t.description ?? '', t.category ?? 'otros',
          t.metadata ?? '{}', t.tags ?? '[]', t.created_at ?? now()
        );
      }
      for (const t of data.transfers) {
        insertTransfer.run(
          t.id ?? null, t.from_account_id, t.to_account_id,
          t.amount_from, t.amount_to, t.date,
          t.description ?? '', t.created_at ?? now()
        );
      }
      for (const n of data.notes) {
        insertNote.run(
          n.id ?? null, n.title ?? '', n.content ?? '',
          n.created_at ?? now(), n.updated_at ?? now()
        );
      }
      for (const s of data.settings ?? []) {
        if (s?.key) upsertSetting.run(String(s.key), String(s.value ?? ''));
      }

      // Catálogos: solo se reemplazan si el backup los trae (backups viejos no).
      if (Array.isArray(data.account_types) && data.account_types.length) {
        db.exec('DELETE FROM account_types');
        for (const t of data.account_types) {
          insertAccountType.run(t.id ?? null, t.slug, t.name, t.position ?? 0);
        }
      }
      if (Array.isArray(data.categories) && data.categories.length) {
        db.exec('DELETE FROM categories');
        for (const c of data.categories) {
          insertCategory.run(c.id ?? null, c.slug, c.name, c.color ?? '#94a3b8', c.kind ?? 'EXPENSE', c.position ?? 0);
        }
      }
      if (Array.isArray(data.custom_fields)) {
        db.exec('DELETE FROM custom_fields');
        for (const f of data.custom_fields) {
          insertCustomField.run(f.id ?? null, f.key, f.name, f.type, f.options ?? '[]', f.applies_to ?? 'BOTH', f.position ?? 0);
        }
      }

      db.exec('COMMIT');
    } catch (err) {
      db.exec('ROLLBACK');
      return res.status(400).json({ error: `El backup no se pudo importar: ${err.message}` });
    }

    res.json({
      success: true,
      accounts: data.accounts.length,
      transactions: data.transactions.length,
      transfers: data.transfers.length,
      notes: data.notes.length,
    });
  });

  router.post('/wipe', (req, res) => {
    if (req.body?.confirm !== true) {
      return res.status(400).json({ error: 'Se requiere confirm: true para borrar los datos' });
    }
    db.exec('BEGIN');
    try {
      db.exec('DELETE FROM transactions');
      db.exec('DELETE FROM transfers');
      db.exec('DELETE FROM notes');
      db.exec('DELETE FROM accounts');
      db.exec('COMMIT');
    } catch (err) {
      db.exec('ROLLBACK');
      throw err;
    }
    res.json({ success: true });
  });

  return router;
}
