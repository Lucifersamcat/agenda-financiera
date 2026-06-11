import { describe, test, before } from 'node:test';
import assert from 'node:assert/strict';
import supertest from 'supertest';
import { createDb } from '../db.js';
import { createApp } from '../app.js';

describe('Transactions', () => {
  let req;
  let accountId;

  before(async () => {
    const db = createDb(':memory:');
    req = supertest(createApp(db));
    const acc = await req.post('/api/accounts')
      .send({ name: 'Caja', type: 'efectivo', currency: 'DOP', color: '#10B981' });
    accountId = acc.body.id;
  });

  test('GET /api/transactions returns empty initially', async () => {
    const res = await req.get('/api/transactions');
    assert.equal(res.status, 200);
    assert.deepEqual(res.body.data, []);
    assert.equal(res.body.total, 0);
  });

  test('POST /api/transactions creates INCOME entry', async () => {
    const res = await req.post('/api/transactions').send({
      account_id: accountId, type: 'INCOME', amount: 5000, date: '2026-06-01', description: 'Salario',
    });
    assert.equal(res.status, 201);
    assert.equal(res.body.amount, 5000);
    assert.equal(res.body.type, 'INCOME');
  });

  test('POST /api/transactions returns 400 for negative amount', async () => {
    const res = await req.post('/api/transactions').send({
      account_id: accountId, type: 'EXPENSE', amount: -100, date: '2026-06-01',
    });
    assert.equal(res.status, 400);
  });

  test('POST /api/transactions returns 400 for invalid type', async () => {
    const res = await req.post('/api/transactions').send({
      account_id: accountId, type: 'TRANSFER', amount: 100, date: '2026-06-01',
    });
    assert.equal(res.status, 400);
  });

  test('GET /api/transactions filters by type', async () => {
    await req.post('/api/transactions').send({
      account_id: accountId, type: 'EXPENSE', amount: 200, date: '2026-06-02', description: 'Comida',
    });
    const res = await req.get('/api/transactions?type=EXPENSE');
    assert.ok(res.body.data.every(t => t.type === 'EXPENSE'));
  });

  test('POST /api/transactions returns 400 for malformed date', async () => {
    const res = await req.post('/api/transactions').send({
      account_id: accountId, type: 'EXPENSE', amount: 100, date: '01/06/2026',
    });
    assert.equal(res.status, 400);
  });

  test('GET /api/transactions includes account currency', async () => {
    const res = await req.get('/api/transactions');
    assert.ok(res.body.data.length > 0);
    assert.equal(res.body.data[0].account_currency, 'DOP');
  });

  test('GET /api/transactions tolerates garbage pagination params', async () => {
    const res = await req.get('/api/transactions?page=abc&limit=-5');
    assert.equal(res.status, 200);
    assert.equal(res.body.page, 1);
    assert.equal(res.body.limit, 1);
  });

  test('PATCH /api/transactions/:id returns 400 for non-positive amount', async () => {
    const created = await req.post('/api/transactions').send({
      account_id: accountId, type: 'INCOME', amount: 100, date: '2026-06-03',
    });
    const res = await req.patch(`/api/transactions/${created.body.id}`).send({ amount: 0 });
    assert.equal(res.status, 400);
  });

  test('PATCH /api/transactions/:id returns 404 for unknown account', async () => {
    const created = await req.post('/api/transactions').send({
      account_id: accountId, type: 'INCOME', amount: 100, date: '2026-06-03',
    });
    const res = await req.patch(`/api/transactions/${created.body.id}`).send({ account_id: 9999 });
    assert.equal(res.status, 404);
  });

  test('PATCH /api/transactions/:id updates description', async () => {
    const created = await req.post('/api/transactions').send({
      account_id: accountId, type: 'INCOME', amount: 100, date: '2026-06-03', description: 'Viejo',
    });
    const id = created.body.id;
    const res = await req.patch(`/api/transactions/${id}`).send({ description: 'Nuevo' });
    assert.equal(res.status, 200);
    assert.equal(res.body.description, 'Nuevo');
  });

  test('DELETE /api/transactions/:id removes the entry', async () => {
    const created = await req.post('/api/transactions').send({
      account_id: accountId, type: 'EXPENSE', amount: 50, date: '2026-06-04', description: 'Borrar',
    });
    const id = created.body.id;
    await req.delete(`/api/transactions/${id}`);
    const list = await req.get('/api/transactions');
    assert.ok(!list.body.data.some(t => t.id === id));
  });
});
