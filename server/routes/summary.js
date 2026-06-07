import { Router } from 'express';

export function createSummaryRouter(db) {
  const router = Router();

  router.get('/', (req, res) => {
    const { from, to } = req.query;
    const conds = [];
    const params = [];
    if (from) { conds.push('date >= ?'); params.push(from); }
    if (to)   { conds.push('date <= ?'); params.push(to); }
    const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';

    const totals = db.prepare(`
      SELECT
        COALESCE(SUM(CASE WHEN type='INCOME'  THEN amount ELSE 0 END), 0) AS total_income,
        COALESCE(SUM(CASE WHEN type='EXPENSE' THEN amount ELSE 0 END), 0) AS total_expenses
      FROM transactions ${where}
    `).get(...params);

    const joinCond = conds.length
      ? `AND ${conds.map(c => 't.' + c).join(' AND ')}`
      : '';

    const byAccount = db.prepare(`
      SELECT
        a.id, a.name, a.color, a.currency,
        COALESCE(SUM(CASE WHEN t.type='INCOME'  THEN t.amount ELSE 0 END), 0) AS income,
        COALESCE(SUM(CASE WHEN t.type='EXPENSE' THEN t.amount ELSE 0 END), 0) AS expenses,
        COALESCE(SUM(CASE WHEN t.type='INCOME'  THEN t.amount ELSE 0 END), 0) -
        COALESCE(SUM(CASE WHEN t.type='EXPENSE' THEN t.amount ELSE 0 END), 0) AS balance
      FROM accounts a
      LEFT JOIN transactions t ON t.account_id = a.id ${joinCond}
      WHERE a.is_active = 1
      GROUP BY a.id
    `).all(...params);

    res.json({
      total_income: totals.total_income,
      total_expenses: totals.total_expenses,
      balance: totals.total_income - totals.total_expenses,
      by_account: byAccount,
    });
  });

  router.get('/distribution', (req, res) => {
    const { from, to } = req.query;
    const conds = [];
    const params = [];
    if (from) { conds.push('t.date >= ?'); params.push(from); }
    if (to)   { conds.push('t.date <= ?'); params.push(to); }
    const joinCond = conds.length ? `AND ${conds.join(' AND ')}` : '';

    const rows = db.prepare(`
      SELECT a.name, a.color,
        COALESCE(SUM(CASE WHEN t.type='EXPENSE' THEN t.amount ELSE 0 END), 0) AS expenses
      FROM accounts a
      LEFT JOIN transactions t ON t.account_id = a.id ${joinCond}
      WHERE a.is_active = 1
      GROUP BY a.id
      HAVING expenses > 0
    `).all(...params);

    res.json(rows);
  });

  return router;
}
