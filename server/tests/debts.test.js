import { describe, test, before } from 'node:test';
import assert from 'node:assert/strict';
import supertest from 'supertest';
import { createDb } from '../db.js';
import { createApp } from '../app.js';

function isoDaysAgo(days) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

function isoMonthsAgo(months) {
  const d = new Date();
  d.setMonth(d.getMonth() - months);
  return d.toISOString().slice(0, 10);
}

const TODAY = new Date().toISOString().slice(0, 10);

describe('Debts', () => {
  let req;

  before(() => {
    req = supertest(createApp(createDb(':memory:')));
  });

  test('GET /api/debts returns empty array initially', async () => {
    const res = await req.get('/api/debts');
    assert.equal(res.status, 200);
    assert.deepEqual(res.body, []);
  });

  test('POST creates a debt with defaults', async () => {
    const res = await req.post('/api/debts').send({
      name: 'Préstamo banco', principal: 1000, start_date: TODAY,
    });
    assert.equal(res.status, 201);
    assert.equal(res.body.currency, 'DOP');
    assert.equal(res.body.paid, 0);
    assert.equal(res.body.pending, 1000);
    assert.equal(res.body.target, 1000);
    assert.equal(res.body.status, 'ACTIVE');
  });

  test('POST validations return 400', async () => {
    const cases = [
      [{ principal: 100, start_date: TODAY }, 'name'],
      [{ name: 'X', principal: 0, start_date: TODAY }, 'principal cero'],
      [{ name: 'X', principal: 'abc', start_date: TODAY }, 'principal no numérico'],
      [{ name: 'X', principal: 100, start_date: 'mal' }, 'start_date inválida'],
      [{ name: 'X', principal: 100, start_date: TODAY, due_date: 'mal' }, 'due_date inválida'],
      [{ name: 'X', principal: 100, start_date: '2025-06-10', due_date: '2025-06-01' }, 'due < start'],
      [{ name: 'X', principal: 100, total_to_pay: 50, start_date: TODAY }, 'total < principal'],
      [{ name: 'X', principal: 100, start_date: TODAY, currency: 'PESOS' }, 'currency mala'],
      [{ name: 'X', principal: 100, start_date: TODAY, rate_period: 'WEEKLY' }, 'rate_period malo'],
      [{ name: 'X', principal: 100, start_date: TODAY, interest_rate: -5 }, 'tasa negativa'],
    ];
    for (const [body, label] of cases) {
      const res = await req.post('/api/debts').send(body);
      assert.equal(res.status, 400, `esperaba 400: ${label}`);
    }
  });

  test('pending uses total_to_pay when set', async () => {
    const res = await req.post('/api/debts').send({
      name: 'Con total', principal: 1000, total_to_pay: 1300, start_date: TODAY,
    });
    assert.equal(res.body.target, 1300);
    assert.equal(res.body.pending, 1300);
    assert.equal(res.body.accrued_interest, 300);
  });

  test('GET /api/debts/:id includes payments; 404 for unknown', async () => {
    const created = await req.post('/api/debts').send({
      name: 'Con abonos', principal: 500, start_date: TODAY,
    });
    const res = await req.get(`/api/debts/${created.body.id}`);
    assert.equal(res.status, 200);
    assert.deepEqual(res.body.payments, []);

    const missing = await req.get('/api/debts/99999');
    assert.equal(missing.status, 404);
  });

  test('POST payment lowers pending and returns updated debt', async () => {
    const created = await req.post('/api/debts').send({
      name: 'Abonable', principal: 1000, start_date: TODAY,
    });
    const res = await req.post(`/api/debts/${created.body.id}/payments`).send({
      amount: 400, date: TODAY, note: 'Primer abono',
    });
    assert.equal(res.status, 201);
    assert.equal(res.body.payment.amount, 400);
    assert.equal(res.body.debt.paid, 400);
    assert.equal(res.body.debt.pending, 600);
    assert.equal(res.body.debt.status, 'ACTIVE');
  });

  test('payment validations and 404s', async () => {
    const created = await req.post('/api/debts').send({
      name: 'Valida abonos', principal: 100, start_date: TODAY,
    });
    const id = created.body.id;

    assert.equal((await req.post(`/api/debts/${id}/payments`).send({ amount: 0, date: TODAY })).status, 400);
    assert.equal((await req.post(`/api/debts/${id}/payments`).send({ amount: 50, date: 'mal' })).status, 400);
    assert.equal((await req.post('/api/debts/99999/payments').send({ amount: 50, date: TODAY })).status, 404);
  });

  test('status lifecycle: paid, overpaid clamps, delete payment reverts', async () => {
    const created = await req.post('/api/debts').send({
      name: 'Ciclo', principal: 200, start_date: TODAY,
    });
    const id = created.body.id;

    const p1 = await req.post(`/api/debts/${id}/payments`).send({ amount: 150, date: TODAY });
    assert.equal(p1.body.debt.status, 'ACTIVE');

    const p2 = await req.post(`/api/debts/${id}/payments`).send({ amount: 100, date: TODAY });
    assert.equal(p2.body.debt.status, 'PAID');
    assert.equal(p2.body.debt.pending, 0); // sobrepago clampa a 0

    const del = await req.delete(`/api/debts/${id}/payments/${p2.body.payment.id}`);
    assert.equal(del.body.debt.status, 'ACTIVE');
    assert.equal(del.body.debt.pending, 50);
  });

  test('monthly interest accrues automatically', async () => {
    const created = await req.post('/api/debts').send({
      name: 'Callejero', principal: 1000, interest_rate: 10,
      rate_period: 'MONTHLY', start_date: isoMonthsAgo(3),
    });
    // 3 meses completos al 10% simple: 1000 * 1.3
    assert.equal(created.body.target, 1300);
    assert.equal(created.body.pending, 1300);
    assert.equal(created.body.accrued_interest, 300);
  });

  test('rate_period defaults to MONTHLY when rate set without period', async () => {
    const created = await req.post('/api/debts').send({
      name: 'Sin período', principal: 1000, interest_rate: 5, start_date: isoMonthsAgo(2),
    });
    assert.equal(created.body.target, 1100);
  });

  test('no full period elapsed means target = principal', async () => {
    const created = await req.post('/api/debts').send({
      name: 'Reciente', principal: 1000, interest_rate: 10,
      rate_period: 'MONTHLY', start_date: isoDaysAgo(10),
    });
    assert.equal(created.body.target, 1000);
  });

  test('explicit total_to_pay wins over interest_rate', async () => {
    const created = await req.post('/api/debts').send({
      name: 'Total manda', principal: 1000, total_to_pay: 1200,
      interest_rate: 10, rate_period: 'MONTHLY', start_date: isoMonthsAgo(6),
    });
    assert.equal(created.body.target, 1200);
  });

  test('settling freezes accrual at last payment date', async () => {
    const created = await req.post('/api/debts').send({
      name: 'Congelada', principal: 1000, interest_rate: 10,
      rate_period: 'MONTHLY', start_date: isoMonthsAgo(5),
    });
    const id = created.body.id;
    // El target a la fecha del abono (2 meses atrás = 3 meses transcurridos) era 1300.
    const payDate = isoMonthsAgo(2);
    const res = await req.post(`/api/debts/${id}/payments`).send({ amount: 1300, date: payDate });
    assert.equal(res.body.debt.status, 'PAID');
    assert.equal(res.body.debt.pending, 0);
    assert.equal(res.body.debt.target, 1300); // no siguió acumulando hasta 1500
  });

  test('PATCH updates fields and clears total_to_pay with null', async () => {
    const created = await req.post('/api/debts').send({
      name: 'Editable', principal: 500, total_to_pay: 600, start_date: TODAY,
    });
    const id = created.body.id;

    const renamed = await req.patch(`/api/debts/${id}`).send({ name: 'Renombrada' });
    assert.equal(renamed.body.name, 'Renombrada');
    assert.equal(renamed.body.target, 600);

    const cleared = await req.patch(`/api/debts/${id}`).send({ total_to_pay: null });
    assert.equal(cleared.body.target, 500);

    assert.equal((await req.patch('/api/debts/99999').send({ name: 'X' })).status, 404);
  });

  test('PATCH/DELETE payment 404 when it belongs to another debt', async () => {
    const a = await req.post('/api/debts').send({ name: 'A', principal: 100, start_date: TODAY });
    const b = await req.post('/api/debts').send({ name: 'B', principal: 100, start_date: TODAY });
    const pay = await req.post(`/api/debts/${a.body.id}/payments`).send({ amount: 10, date: TODAY });

    assert.equal((await req.patch(`/api/debts/${b.body.id}/payments/${pay.body.payment.id}`).send({ amount: 20 })).status, 404);
    assert.equal((await req.delete(`/api/debts/${b.body.id}/payments/${pay.body.payment.id}`)).status, 404);

    const edited = await req.patch(`/api/debts/${a.body.id}/payments/${pay.body.payment.id}`).send({ amount: 20 });
    assert.equal(edited.status, 200);
    assert.equal(edited.body.payment.amount, 20);
    assert.equal(edited.body.debt.paid, 20);
  });

  test('DELETE debt cascades payments', async () => {
    const created = await req.post('/api/debts').send({ name: 'Borrable', principal: 100, start_date: TODAY });
    const id = created.body.id;
    await req.post(`/api/debts/${id}/payments`).send({ amount: 10, date: TODAY });

    const res = await req.delete(`/api/debts/${id}`);
    assert.equal(res.status, 200);
    assert.equal((await req.get(`/api/debts/${id}`)).status, 404);
    assert.equal((await req.delete('/api/debts/99999')).status, 404);
  });
});

describe('Debt types catalog', () => {
  let req;

  before(() => {
    req = supertest(createApp(createDb(':memory:')));
  });

  test('GET returns seeded defaults in order', async () => {
    const res = await req.get('/api/debt-types');
    assert.equal(res.status, 200);
    assert.deepEqual(
      res.body.map(t => t.slug),
      ['banco', 'prestamo-callejero', 'credito-comercio', 'tarjeta-credito', 'personal', 'otro']
    );
  });

  test('POST and PATCH work', async () => {
    const created = await req.post('/api/debt-types').send({ name: 'Cooperativa' });
    assert.equal(created.status, 201);
    assert.equal(created.body.slug, 'cooperativa');

    const renamed = await req.patch(`/api/debt-types/${created.body.id}`).send({ name: 'Coop' });
    assert.equal(renamed.body.name, 'Coop');
  });

  test('DELETE reassigns debts and protects "otro"', async () => {
    const type = await req.post('/api/debt-types').send({ name: 'Temporal' });
    const debt = await req.post('/api/debts').send({
      name: 'Deuda temporal', principal: 100, start_date: TODAY, type: 'temporal',
    });

    const res = await req.delete(`/api/debt-types/${type.body.id}`).send({});
    assert.equal(res.status, 200);
    const after = await req.get(`/api/debts/${debt.body.id}`);
    assert.equal(after.body.type, 'otro');

    const otros = await req.get('/api/debt-types');
    const otro = otros.body.find(t => t.slug === 'otro');
    assert.equal((await req.delete(`/api/debt-types/${otro.id}`).send({})).status, 400);
  });
});

describe('Debts data round-trip', () => {
  let req;

  before(() => {
    req = supertest(createApp(createDb(':memory:')));
  });

  test('export includes debts keys; import restores; wipe clears', async () => {
    const debt = await req.post('/api/debts').send({
      name: 'Backup', principal: 800, start_date: TODAY,
    });
    await req.post(`/api/debts/${debt.body.id}/payments`).send({ amount: 100, date: TODAY });

    const exported = await req.get('/api/data/export');
    assert.equal(exported.body.debts.length, 1);
    assert.equal(exported.body.debt_payments.length, 1);
    assert.ok(exported.body.debt_types.length >= 6);

    await req.post('/api/data/wipe').send({ confirm: true });
    assert.deepEqual((await req.get('/api/debts')).body, []);

    const imported = await req.post('/api/data/import').send(exported.body);
    assert.equal(imported.status, 200);
    const debts = await req.get('/api/debts');
    assert.equal(debts.body.length, 1);
    assert.equal(debts.body[0].paid, 100);
    assert.equal(debts.body[0].pending, 700);
  });
});
