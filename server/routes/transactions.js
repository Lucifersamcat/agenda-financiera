import { Router } from 'express';
import { isValidDate } from './validate.js';

export function createTransactionsRouter(db) {
  const router = Router();

  router.get('/', (req, res) => {
    const { account_id, type, from, to } = req.query;

    const page  = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const limit = Math.min(200, Math.max(1, Number.parseInt(req.query.limit, 10) || 50));

    const conds = [];
    const params = [];

    if (account_id) { conds.push('t.account_id = ?'); params.push(Number(account_id)); }
    if (type)       { conds.push('t.type = ?');       params.push(type); }
    if (from)       { conds.push('t.date >= ?');       params.push(from); }
    if (to)         { conds.push('t.date <= ?');       params.push(to); }

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

    res.json({ data, total, page, limit });
  });

  router.post('/', (req, res) => {
    const { account_id, type, amount, date, description, metadata } = req.body;

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

    const account = db.prepare(
      `SELECT id FROM accounts WHERE id = ? AND is_active = 1`
    ).get(Number(account_id));
    if (!account) return res.status(404).json({ error: 'Cuenta no encontrada' });

    const result = db.prepare(`
      INSERT INTO transactions (account_id, type, amount, date, description, metadata)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      Number(account_id), type, Number(amount), date,
      description ?? '',
      metadata ? JSON.stringify(metadata) : '{}'
    );

    const id = Number(result.lastInsertRowid);
    res.status(201).json(db.prepare(`SELECT * FROM transactions WHERE id = ?`).get(id));
  });

  router.patch('/:id', (req, res) => {
    const id = Number(req.params.id);
    const t = db.prepare(`SELECT * FROM transactions WHERE id = ?`).get(id);
    if (!t) return res.status(404).json({ error: 'Transacción no encontrada' });

    const { account_id, type, amount, date, description, metadata } = req.body;

    if (type && !['INCOME', 'EXPENSE'].includes(type)) {
      return res.status(400).json({ error: 'type debe ser INCOME o EXPENSE' });
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
      UPDATE transactions SET account_id=?, type=?, amount=?, date=?, description=?, metadata=?
      WHERE id=?
    `).run(
      account_id !== undefined ? Number(account_id) : t.account_id,
      type ?? t.type,
      amount !== undefined ? Number(amount) : t.amount,
      date ?? t.date,
      description ?? t.description,
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
