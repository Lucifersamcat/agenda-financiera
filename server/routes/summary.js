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
    const transferCond = conds.length
      ? `AND ${conds.map(c => 'tf.' + c).join(' AND ')}`
      : '';

    const byAccount = db.prepare(`
      SELECT
        a.id, a.name, a.color, a.currency,
        COALESCE(SUM(CASE WHEN t.type='INCOME'  THEN t.amount ELSE 0 END), 0) AS income,
        COALESCE(SUM(CASE WHEN t.type='EXPENSE' THEN t.amount ELSE 0 END), 0) AS expenses,
        COALESCE(SUM(CASE WHEN t.type='INCOME'  THEN t.amount ELSE 0 END), 0) -
        COALESCE(SUM(CASE WHEN t.type='EXPENSE' THEN t.amount ELSE 0 END), 0)
        - COALESCE((SELECT SUM(amount_from) FROM transfers tf WHERE tf.from_account_id = a.id ${transferCond}), 0)
        + COALESCE((SELECT SUM(amount_to)   FROM transfers tf WHERE tf.to_account_id   = a.id ${transferCond}), 0) AS balance
      FROM accounts a
      LEFT JOIN transactions t ON t.account_id = a.id ${joinCond}
      WHERE a.is_active = 1
      GROUP BY a.id
    `).all(...params, ...params, ...params);

    res.json({
      total_income: totals.total_income,
      total_expenses: totals.total_expenses,
      balance: totals.total_income - totals.total_expenses,
      by_account: byAccount,
    });
  });

  router.get('/timeline', (req, res) => {
    const { groupBy = 'month', from, to } = req.query;
    const fmtMap = { day: '%Y-%m-%d', month: '%Y-%m', year: '%Y' };
    const sqlFmt = fmtMap[groupBy] ?? '%Y-%m';
    const conds = [];
    const params = [];
    if (from) { conds.push('date >= ?'); params.push(from); }
    if (to)   { conds.push('date <= ?'); params.push(to); }
    const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
    const rows = db.prepare(`
      SELECT
        strftime('${sqlFmt}', date) AS period,
        COALESCE(SUM(CASE WHEN type='INCOME'  THEN amount ELSE 0 END), 0) AS income,
        COALESCE(SUM(CASE WHEN type='EXPENSE' THEN amount ELSE 0 END), 0) AS expenses
      FROM transactions ${where}
      GROUP BY period
      ORDER BY period
    `).all(...params);
    res.json(rows);
  });

  // Expenses grouped by category. Split by currency so amounts in different
  // monedas are never added together.
  router.get('/distribution', (req, res) => {
    const { from, to } = req.query;
    const conds = [`t.type = 'EXPENSE'`, 'a.is_active = 1'];
    const params = [];
    if (from) { conds.push('t.date >= ?'); params.push(from); }
    if (to)   { conds.push('t.date <= ?'); params.push(to); }

    const rows = db.prepare(`
      SELECT t.category, c.name, c.color, a.currency, SUM(t.amount) AS expenses
      FROM transactions t
      JOIN accounts a ON a.id = t.account_id
      LEFT JOIN categories c ON c.slug = t.category
      WHERE ${conds.join(' AND ')}
      GROUP BY t.category, a.currency
      ORDER BY expenses DESC
    `).all(...params);

    res.json(rows);
  });

  return router;
}
