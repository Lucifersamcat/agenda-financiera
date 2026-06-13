import { Router } from 'express';
import { isValidDate } from './validate.js';

// Períodos calendario completos entre dos fechas YYYY-MM-DD.
function periodsElapsed(startDate, asOf, ratePeriod) {
  const [sy, sm, sd] = startDate.split('-').map(Number);
  const [ay, am, ad] = asOf.split('-').map(Number);
  let months = (ay - sy) * 12 + (am - sm);
  if (ad < sd) months -= 1;
  if (months < 0) return 0;
  return ratePeriod === 'ANNUAL' ? Math.floor(months / 12) : months;
}

// Total a pagar vigente a una fecha: el total explícito manda; si no hay,
// interés simple acumulado sobre el capital; si tampoco, el capital.
function targetAt(row, asOfDate) {
  if (row.total_to_pay != null) return row.total_to_pay;
  if (row.interest_rate != null && row.interest_rate > 0) {
    const n = periodsElapsed(row.start_date, asOfDate, row.rate_period ?? 'MONTHLY');
    return +(row.principal * (1 + (row.interest_rate / 100) * n)).toFixed(2);
  }
  return row.principal;
}

function decorate(row) {
  const today = new Date().toISOString().slice(0, 10);
  let target = targetAt(row, today);
  // Congelar al saldar: si los abonos cubrieron el target vigente al último
  // abono, la deuda queda pagada y no acumula intereses posteriores.
  if (row.last_payment_date && row.paid >= targetAt(row, row.last_payment_date)) {
    target = targetAt(row, row.last_payment_date);
  }
  const pending = Math.max(0, +(target - row.paid).toFixed(2));
  return {
    ...row,
    target,
    pending,
    status: pending === 0 ? 'PAID' : 'ACTIVE',
    accrued_interest: +(target - row.principal).toFixed(2),
  };
}

function normalizeCurrency(currency) {
  if (currency === undefined || currency === null) return null;
  const code = String(currency).trim().toUpperCase();
  return /^[A-Z]{3}$/.test(code) ? code : undefined;
}

// Número positivo, o null si el valor viene vacío, o undefined si es inválido.
function parseOptionalAmount(value) {
  if (value === undefined || value === null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

export function createDebtsRouter(db) {
  const router = Router();

  const baseSelect = `
    SELECT d.*,
      COALESCE((SELECT SUM(amount) FROM debt_payments p WHERE p.debt_id = d.id), 0) AS paid,
      (SELECT COUNT(*) FROM debt_payments p WHERE p.debt_id = d.id) AS payments_count,
      (SELECT MAX(date) FROM debt_payments p WHERE p.debt_id = d.id) AS last_payment_date
    FROM debts d
  `;

  const getDebt = (id) => {
    const row = db.prepare(`${baseSelect} WHERE d.id = ?`).get(id);
    return row ? decorate(row) : null;
  };

  // Valida los campos de una deuda. Devuelve {error} o {values}.
  function validateDebt(body, existing) {
    const name = body.name !== undefined ? String(body.name).trim() : existing?.name;
    if (!name) return { error: 'name es requerido' };

    let principal = existing?.principal;
    if (body.principal !== undefined || !existing) {
      principal = Number(body.principal);
      if (!Number.isFinite(principal) || principal <= 0) {
        return { error: 'principal debe ser un número mayor que 0' };
      }
    }

    let total_to_pay = existing?.total_to_pay ?? null;
    if (body.total_to_pay !== undefined || !existing) {
      total_to_pay = parseOptionalAmount(body.total_to_pay);
      if (total_to_pay === undefined) {
        return { error: 'total_to_pay debe ser un número mayor que 0' };
      }
    }
    if (total_to_pay != null && total_to_pay < principal) {
      return { error: 'total_to_pay no puede ser menor que el monto original' };
    }

    let interest_rate = existing?.interest_rate ?? null;
    if (body.interest_rate !== undefined || !existing) {
      if (body.interest_rate === undefined || body.interest_rate === null || body.interest_rate === '') {
        interest_rate = null;
      } else {
        interest_rate = Number(body.interest_rate);
        if (!Number.isFinite(interest_rate) || interest_rate < 0) {
          return { error: 'interest_rate debe ser un número mayor o igual a 0' };
        }
      }
    }

    let rate_period = existing?.rate_period ?? null;
    if (body.rate_period !== undefined || !existing) {
      rate_period = body.rate_period || null;
      if (rate_period !== null && !['MONTHLY', 'ANNUAL'].includes(rate_period)) {
        return { error: 'rate_period debe ser MONTHLY o ANNUAL' };
      }
    }

    const start_date = body.start_date !== undefined ? body.start_date : existing?.start_date;
    if (!isValidDate(start_date)) {
      return { error: 'start_date debe tener formato YYYY-MM-DD' };
    }

    let due_date = existing?.due_date ?? null;
    if (body.due_date !== undefined || !existing) {
      due_date = body.due_date || null;
      if (due_date !== null && !isValidDate(due_date)) {
        return { error: 'due_date debe tener formato YYYY-MM-DD' };
      }
    }
    if (due_date && due_date < start_date) {
      return { error: 'due_date no puede ser anterior a start_date' };
    }

    const code = normalizeCurrency(body.currency);
    if (code === undefined) {
      return { error: 'currency debe ser un código de 3 letras (ej. DOP, USD)' };
    }
    const currency = code ?? existing?.currency ?? 'DOP';

    const type = body.type !== undefined ? (body.type || null) : (existing?.type ?? null);
    const description = body.description !== undefined
      ? String(body.description)
      : (existing?.description ?? '');

    return {
      values: { name, type, currency, principal, total_to_pay, interest_rate, rate_period, start_date, due_date, description },
    };
  }

  router.get('/', (_req, res) => {
    const rows = db.prepare(`${baseSelect} ORDER BY d.created_at DESC`).all();
    res.json(rows.map(decorate));
  });

  router.get('/:id', (req, res) => {
    const debt = getDebt(Number(req.params.id));
    if (!debt) return res.status(404).json({ error: 'Deuda no encontrada' });

    const payments = db.prepare(
      `SELECT * FROM debt_payments WHERE debt_id = ? ORDER BY date DESC, id DESC`
    ).all(debt.id);
    res.json({ ...debt, payments });
  });

  router.post('/', (req, res) => {
    const { error, values } = validateDebt(req.body ?? {});
    if (error) return res.status(400).json({ error });

    const result = db.prepare(`
      INSERT INTO debts (name, type, currency, principal, total_to_pay, interest_rate, rate_period, start_date, due_date, description)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      values.name, values.type, values.currency, values.principal,
      values.total_to_pay, values.interest_rate, values.rate_period,
      values.start_date, values.due_date, values.description
    );
    res.status(201).json(getDebt(Number(result.lastInsertRowid)));
  });

  router.patch('/:id', (req, res) => {
    const id = Number(req.params.id);
    const existing = db.prepare(`SELECT * FROM debts WHERE id = ?`).get(id);
    if (!existing) return res.status(404).json({ error: 'Deuda no encontrada' });

    const { error, values } = validateDebt(req.body ?? {}, existing);
    if (error) return res.status(400).json({ error });

    db.prepare(`
      UPDATE debts SET name=?, type=?, currency=?, principal=?, total_to_pay=?, interest_rate=?, rate_period=?, start_date=?, due_date=?, description=?
      WHERE id=?
    `).run(
      values.name, values.type, values.currency, values.principal,
      values.total_to_pay, values.interest_rate, values.rate_period,
      values.start_date, values.due_date, values.description, id
    );
    res.json(getDebt(id));
  });

  router.delete('/:id', (req, res) => {
    const id = Number(req.params.id);
    const existing = db.prepare(`SELECT id FROM debts WHERE id = ?`).get(id);
    if (!existing) return res.status(404).json({ error: 'Deuda no encontrada' });

    db.prepare(`DELETE FROM debts WHERE id = ?`).run(id);
    res.json({ success: true });
  });

  /* ----- Abonos ----- */

  function validatePayment(body) {
    const amount = Number(body?.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      return { error: 'amount debe ser un número mayor que 0' };
    }
    if (!isValidDate(body?.date)) {
      return { error: 'date debe tener formato YYYY-MM-DD' };
    }
    return { values: { amount, date: body.date, note: String(body?.note ?? '') } };
  }

  router.post('/:id/payments', (req, res) => {
    const debtId = Number(req.params.id);
    if (!db.prepare(`SELECT id FROM debts WHERE id = ?`).get(debtId)) {
      return res.status(404).json({ error: 'Deuda no encontrada' });
    }

    const { error, values } = validatePayment(req.body);
    if (error) return res.status(400).json({ error });

    const result = db.prepare(
      `INSERT INTO debt_payments (debt_id, amount, date, note) VALUES (?, ?, ?, ?)`
    ).run(debtId, values.amount, values.date, values.note);

    const payment = db.prepare(`SELECT * FROM debt_payments WHERE id = ?`).get(Number(result.lastInsertRowid));
    res.status(201).json({ payment, debt: getDebt(debtId) });
  });

  router.patch('/:id/payments/:paymentId', (req, res) => {
    const debtId = Number(req.params.id);
    const paymentId = Number(req.params.paymentId);
    const existing = db.prepare(
      `SELECT * FROM debt_payments WHERE id = ? AND debt_id = ?`
    ).get(paymentId, debtId);
    if (!existing) return res.status(404).json({ error: 'Abono no encontrado' });

    const { error, values } = validatePayment({
      amount: req.body?.amount ?? existing.amount,
      date: req.body?.date ?? existing.date,
      note: req.body?.note ?? existing.note,
    });
    if (error) return res.status(400).json({ error });

    db.prepare(
      `UPDATE debt_payments SET amount = ?, date = ?, note = ? WHERE id = ?`
    ).run(values.amount, values.date, values.note, paymentId);

    const payment = db.prepare(`SELECT * FROM debt_payments WHERE id = ?`).get(paymentId);
    res.json({ payment, debt: getDebt(debtId) });
  });

  router.delete('/:id/payments/:paymentId', (req, res) => {
    const debtId = Number(req.params.id);
    const paymentId = Number(req.params.paymentId);
    const existing = db.prepare(
      `SELECT id FROM debt_payments WHERE id = ? AND debt_id = ?`
    ).get(paymentId, debtId);
    if (!existing) return res.status(404).json({ error: 'Abono no encontrado' });

    db.prepare(`DELETE FROM debt_payments WHERE id = ?`).run(paymentId);
    res.json({ success: true, debt: getDebt(debtId) });
  });

  return router;
}
