import { Router } from 'express';
import { isValidDate } from './validate.js';

export function createTransfersRouter(db) {
  const router = Router();

  router.get('/', (_req, res) => {
    const data = db.prepare(`
      SELECT t.*,
        af.name AS from_name, af.color AS from_color, af.currency AS from_currency,
        at.name AS to_name,   at.color AS to_color,   at.currency AS to_currency
      FROM transfers t
      JOIN accounts af ON af.id = t.from_account_id
      JOIN accounts at ON at.id = t.to_account_id
      ORDER BY t.date DESC, t.created_at DESC
    `).all();
    res.json(data);
  });

  router.post('/', (req, res) => {
    const { from_account_id, to_account_id, amount_from, amount_to, date, description } = req.body;

    if (!from_account_id || !to_account_id || !amount_from || !date) {
      return res.status(400).json({ error: 'from_account_id, to_account_id, amount_from, date son requeridos' });
    }
    if (Number(from_account_id) === Number(to_account_id)) {
      return res.status(400).json({ error: 'La cuenta origen y destino deben ser distintas' });
    }
    if (!(Number(amount_from) > 0)) {
      return res.status(400).json({ error: 'amount_from debe ser positivo' });
    }
    if (!isValidDate(date)) {
      return res.status(400).json({ error: 'date debe tener formato YYYY-MM-DD' });
    }

    const from = db.prepare(`SELECT * FROM accounts WHERE id = ? AND is_active = 1`).get(Number(from_account_id));
    const to   = db.prepare(`SELECT * FROM accounts WHERE id = ? AND is_active = 1`).get(Number(to_account_id));
    if (!from) return res.status(404).json({ error: 'Cuenta origen no encontrada' });
    if (!to)   return res.status(404).json({ error: 'Cuenta destino no encontrada' });

    const sameCurrency = from.currency === to.currency;
    const finalAmountTo = sameCurrency ? Number(amount_from) : Number(amount_to);

    if (!sameCurrency && (!finalAmountTo || finalAmountTo <= 0)) {
      return res.status(400).json({ error: 'amount_to es requerido cuando las monedas difieren' });
    }

    const result = db.prepare(`
      INSERT INTO transfers (from_account_id, to_account_id, amount_from, amount_to, date, description)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      Number(from_account_id), Number(to_account_id),
      Number(amount_from), finalAmountTo, date, description ?? ''
    );

    const id = Number(result.lastInsertRowid);
    res.status(201).json(db.prepare(`SELECT * FROM transfers WHERE id = ?`).get(id));
  });

  router.patch('/:id', (req, res) => {
    const id = Number(req.params.id);
    const existing = db.prepare(`SELECT * FROM transfers WHERE id = ?`).get(id);
    if (!existing) return res.status(404).json({ error: 'Transferencia no encontrada' });

    const from_account_id = req.body.from_account_id !== undefined ? Number(req.body.from_account_id) : existing.from_account_id;
    const to_account_id   = req.body.to_account_id   !== undefined ? Number(req.body.to_account_id)   : existing.to_account_id;
    const amount_from     = req.body.amount_from     !== undefined ? Number(req.body.amount_from)     : existing.amount_from;
    const date            = req.body.date ?? existing.date;
    const description     = req.body.description ?? existing.description;

    if (from_account_id === to_account_id) {
      return res.status(400).json({ error: 'La cuenta origen y destino deben ser distintas' });
    }
    if (!(amount_from > 0)) {
      return res.status(400).json({ error: 'amount_from debe ser positivo' });
    }
    if (req.body.date !== undefined && !isValidDate(date)) {
      return res.status(400).json({ error: 'date debe tener formato YYYY-MM-DD' });
    }

    const from = db.prepare(`SELECT * FROM accounts WHERE id = ? AND is_active = 1`).get(from_account_id);
    const to   = db.prepare(`SELECT * FROM accounts WHERE id = ? AND is_active = 1`).get(to_account_id);
    if (!from) return res.status(404).json({ error: 'Cuenta origen no encontrada' });
    if (!to)   return res.status(404).json({ error: 'Cuenta destino no encontrada' });

    const sameCurrency = from.currency === to.currency;
    const amount_to = sameCurrency
      ? amount_from
      : (req.body.amount_to !== undefined ? Number(req.body.amount_to) : existing.amount_to);
    if (!sameCurrency && (!amount_to || amount_to <= 0)) {
      return res.status(400).json({ error: 'amount_to es requerido cuando las monedas difieren' });
    }

    db.prepare(`
      UPDATE transfers SET from_account_id=?, to_account_id=?, amount_from=?, amount_to=?, date=?, description=?
      WHERE id=?
    `).run(from_account_id, to_account_id, amount_from, amount_to, date, description, id);

    res.json(db.prepare(`SELECT * FROM transfers WHERE id = ?`).get(id));
  });

  router.delete('/:id', (req, res) => {
    const id = Number(req.params.id);
    const t = db.prepare(`SELECT id FROM transfers WHERE id = ?`).get(id);
    if (!t) return res.status(404).json({ error: 'Transferencia no encontrada' });

    db.prepare(`DELETE FROM transfers WHERE id = ?`).run(id);
    res.json({ success: true });
  });

  return router;
}
