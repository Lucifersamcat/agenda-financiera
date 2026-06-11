import { describe, test, before } from 'node:test';
import assert from 'node:assert/strict';
import supertest from 'supertest';
import { createDb } from '../db.js';
import { createApp } from '../app.js';

describe('Summary', () => {
  let req;

  before(async () => {
    const db = createDb(':memory:');
    req = supertest(createApp(db));

    const acc = await req.post('/api/accounts')
      .send({ name: 'Caja', type: 'efectivo', currency: 'DOP', color: '#10B981' });
    const id = acc.body.id;

    await req.post('/api/transactions').send({ account_id: id, type: 'INCOME',  amount: 10000, date: '2026-06-01', category: 'salario' });
    await req.post('/api/transactions').send({ account_id: id, type: 'EXPENSE', amount: 3000,  date: '2026-06-02', category: 'comida' });
    await req.post('/api/transactions').send({ account_id: id, type: 'EXPENSE', amount: 2000,  date: '2026-06-03', category: 'comida' });
  });

  test('GET /api/summary returns correct totals', async () => {
    const res = await req.get('/api/summary');
    assert.equal(res.status, 200);
    assert.equal(res.body.total_income, 10000);
    assert.equal(res.body.total_expenses, 5000);
    assert.equal(res.body.balance, 5000);
  });

  test('GET /api/summary by_account includes each account', async () => {
    const res = await req.get('/api/summary');
    assert.ok(Array.isArray(res.body.by_account));
    assert.equal(res.body.by_account.length, 1);
    assert.equal(res.body.by_account[0].balance, 5000);
  });

  test('GET /api/summary respects date filter', async () => {
    const res = await req.get('/api/summary?from=2026-06-02&to=2026-06-02');
    assert.equal(res.body.total_income, 0);
    assert.equal(res.body.total_expenses, 3000);
  });

  test('GET /api/summary/distribution groups expenses by category and currency', async () => {
    const res = await req.get('/api/summary/distribution');
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body));
    assert.equal(res.body.length, 1);
    assert.equal(res.body[0].category, 'comida');
    assert.equal(res.body[0].currency, 'DOP');
    assert.equal(res.body[0].expenses, 5000);
  });

  test('GET /api/summary/distribution respects date filter', async () => {
    const res = await req.get('/api/summary/distribution?from=2026-06-03');
    assert.equal(res.body.length, 1);
    assert.equal(res.body[0].expenses, 2000);
  });
});
