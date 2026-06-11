import { Router } from 'express';

export function createAccountsRouter(db) {
  const router = Router();

  const withBalance = db.prepare(`
    SELECT a.*,
      COALESCE(SUM(CASE WHEN t.type='INCOME' THEN t.amount ELSE 0 END), 0) -
      COALESCE(SUM(CASE WHEN t.type='EXPENSE' THEN t.amount ELSE 0 END), 0)
      - COALESCE((SELECT SUM(amount_from) FROM transfers WHERE from_account_id = a.id), 0)
      + COALESCE((SELECT SUM(amount_to)   FROM transfers WHERE to_account_id   = a.id), 0) AS balance
    FROM accounts a
    LEFT JOIN transactions t ON t.account_id = a.id
    WHERE a.is_active = 1
    GROUP BY a.id
    ORDER BY a.created_at ASC
  `);

  router.get('/', (_req, res) => {
    res.json(withBalance.all());
  });

  function normalizeCurrency(currency) {
    if (currency === undefined || currency === null) return null;
    const code = String(currency).trim().toUpperCase();
    return /^[A-Z]{3}$/.test(code) ? code : undefined;
  }

  router.post('/', (req, res) => {
    const { name, type, currency, color } = req.body;
    if (!name || !String(name).trim()) {
      return res.status(400).json({ error: 'name es requerido' });
    }

    const code = normalizeCurrency(currency);
    if (code === undefined) {
      return res.status(400).json({ error: 'currency debe ser un código de 3 letras (ej. DOP, USD)' });
    }

    const result = db.prepare(
      `INSERT INTO accounts (name, type, currency, color) VALUES (?, ?, ?, ?)`
    ).run(String(name).trim(), type ?? null, code ?? 'DOP', color ?? '#3B82F6');

    const id = Number(result.lastInsertRowid);
    const account = db.prepare(`SELECT *, 0 AS balance FROM accounts WHERE id = ?`).get(id);
    res.status(201).json(account);
  });

  router.patch('/:id', (req, res) => {
    const id = Number(req.params.id);
    const existing = db.prepare(
      `SELECT * FROM accounts WHERE id = ? AND is_active = 1`
    ).get(id);
    if (!existing) return res.status(404).json({ error: 'Cuenta no encontrada' });

    const { name, type, currency, color } = req.body;
    const code = normalizeCurrency(currency);
    if (code === undefined) {
      return res.status(400).json({ error: 'currency debe ser un código de 3 letras (ej. DOP, USD)' });
    }

    db.prepare(
      `UPDATE accounts SET name=?, type=?, currency=?, color=? WHERE id=?`
    ).run(
      name ?? existing.name,
      type ?? existing.type,
      code ?? existing.currency,
      color ?? existing.color,
      id
    );
    res.json(db.prepare(`SELECT * FROM accounts WHERE id = ?`).get(id));
  });

  router.delete('/:id', (req, res) => {
    const id = Number(req.params.id);
    const existing = db.prepare(`SELECT id FROM accounts WHERE id = ?`).get(id);
    if (!existing) return res.status(404).json({ error: 'Cuenta no encontrada' });

    db.prepare(`UPDATE accounts SET is_active = 0 WHERE id = ?`).run(id);
    res.json({ success: true });
  });

  return router;
}
