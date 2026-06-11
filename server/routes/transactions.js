import { Router } from 'express';
import { isValidDate } from './validate.js';

export function createTransactionsRouter(db) {
  const router = Router();

  router.get('/', (req, res) => {
    const { account_id, type, category, from, to, q } = req.query;

    const page  = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const limit = Math.min(200, Math.max(1, Number.parseInt(req.query.limit, 10) || 50));

    const conds = [];
    const params = [];

    if (account_id) { conds.push('t.account_id = ?'); params.push(Number(account_id)); }
    if (type)       { conds.push('t.type = ?');       params.push(type); }
    if (category)   { conds.push('t.category = ?');   params.push(category); }
    if (from)       { conds.push('t.date >= ?');       params.push(from); }
    if (to)         { conds.push('t.date <= ?');       params.push(to); }
    if (q) {
      conds.push(`t.description LIKE ? ESCAPE '\\'`);
      params.push(`%${String(q).replace(/[\\%_]/g, m => '\\' + m)}%`);
    }

    const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
    const offset = (page - 1) * limit;

    const total = db.prepare(
      `SELECT COUNT(*) AS c FROM transactions t ${where}`
    ).get(...params).c;

    const data = db.prepare(`
      SELECT t.*, a.name AS account_name, a.color AS account_color, a.currency AS account_currency
      FROM transactions t
      JOIN accounts a ON a.id = t.account_id
      ${where}
      ORDER BY t.date DESC, t.created_at DESC
      LIMIT ? OFFSET ?
    `).all(...params, limit, offset);

    // Sums of the whole filtered set (not just the page), split by currency.
    const totals = db.prepare(`
      SELECT a.currency,
        COALESCE(SUM(CASE WHEN t.type='INCOME'  THEN t.amount ELSE 0 END), 0) AS income,
        COALESCE(SUM(CASE WHEN t.type='EXPENSE' THEN t.amount ELSE 0 END), 0) AS expenses
      FROM transactions t
      JOIN accounts a ON a.id = t.account_id
      ${where}
      GROUP BY a.currency
      ORDER BY a.currency
    `).all(...params);

    res.json({ data, total, totals, page, limit });
  });

  function normalizeCategory(category) {
    if (category === undefined || category === null || category === '') return null;
    const value = String(category).trim().toLowerCase();
    return value && value.length <= 50 ? value : undefined;
  }

  router.post('/', (req, res) => {
    const { account_id, type, amount, date, description, metadata, category } = req.body;

    if (!account_id || !type || !amount || !date) {
      return res.status(400).json({ error: 'account_id, type, amount, date son requeridos' });
    }
    if (!['INCOME', 'EXPENSE'].includes(type)) {
      return res.status(400).json({ error: 'type debe ser INCOME o EXPENSE' });
    }
    if (!(Number(amount) > 0)) {
      return res.status(400).json({ error: 'amount debe ser positivo' });
    }
    if (!isValidDate(date)) {
      return res.status(400).json({ error: 'date debe tener formato YYYY-MM-DD' });
    }

    const cat = normalizeCategory(category);
    if (cat === undefined) {
      return res.status(400).json({ error: 'category debe ser un texto de máximo 50 caracteres' });
    }

    const account = db.prepare(
      `SELECT id FROM accounts WHERE id = ? AND is_active = 1`
    ).get(Number(account_id));
    if (!account) return res.status(404).json({ error: 'Cuenta no encontrada' });

    const result = db.prepare(`
      INSERT INTO transactions (account_id, type, amount, date, description, category, metadata)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      Number(account_id), type, Number(amount), date,
      description ?? '',
      cat ?? 'otros',
      metadata ? JSON.stringify(metadata) : '{}'
    );

    const id = Number(result.lastInsertRowid);
    res.status(201).json(db.prepare(`SELECT * FROM transactions WHERE id = ?`).get(id));
  });

  router.patch('/:id', (req, res) => {
    const id = Number(req.params.id);
    const t = db.prepare(`SELECT * FROM transactions WHERE id = ?`).get(id);
    if (!t) return res.status(404).json({ error: 'Transacción no encontrada' });

    const { account_id, type, amount, date, description, metadata, category } = req.body;

    if (type && !['INCOME', 'EXPENSE'].includes(type)) {
      return res.status(400).json({ error: 'type debe ser INCOME o EXPENSE' });
    }
    const cat = normalizeCategory(category);
    if (cat === undefined) {
      return res.status(400).json({ error: 'category debe ser un texto de máximo 50 caracteres' });
    }
    if (amount !== undefined && !(Number(amount) > 0)) {
      return res.status(400).json({ error: 'amount debe ser positivo' });
    }
    if (date !== undefined && !isValidDate(date)) {
      return res.status(400).json({ error: 'date debe tener formato YYYY-MM-DD' });
    }
    if (account_id !== undefined) {
      const account = db.prepare(
        `SELECT id FROM accounts WHERE id = ? AND is_active = 1`
      ).get(Number(account_id));
      if (!account) return res.status(404).json({ error: 'Cuenta no encontrada' });
    }

    db.prepare(`
      UPDATE transactions SET account_id=?, type=?, amount=?, date=?, description=?, category=?, metadata=?
      WHERE id=?
    `).run(
      account_id !== undefined ? Number(account_id) : t.account_id,
      type ?? t.type,
      amount !== undefined ? Number(amount) : t.amount,
      date ?? t.date,
      description ?? t.description,
      cat ?? t.category,
      metadata ? JSON.stringify(metadata) : t.metadata,
      id
    );

    res.json(db.prepare(`SELECT * FROM transactions WHERE id = ?`).get(id));
  });

  router.delete('/:id', (req, res) => {
    const id = Number(req.params.id);
    const t = db.prepare(`SELECT id FROM transactions WHERE id = ?`).get(id);
    if (!t) return res.status(404).json({ error: 'Transacción no encontrada' });

    db.prepare(`DELETE FROM transactions WHERE id = ?`).run(id);
    res.json({ success: true });
  });

  return router;
}
