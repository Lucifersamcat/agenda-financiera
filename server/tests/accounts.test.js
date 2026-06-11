import { describe, test, before } from 'node:test';
import assert from 'node:assert/strict';
import supertest from 'supertest';
import { createDb } from '../db.js';
import { createApp } from '../app.js';

describe('Accounts', () => {
  let req;

  before(() => {
    const db = createDb(':memory:');
    req = supertest(createApp(db));
  });

  test('GET /api/accounts returns empty array initially', async () => {
    const res = await req.get('/api/accounts');
    assert.equal(res.status, 200);
    assert.deepEqual(res.body, []);
  });

  test('POST /api/accounts creates account with balance 0', async () => {
    const res = await req.post('/api/accounts')
      .send({ name: 'Caja', type: 'efectivo', currency: 'DOP', color: '#10B981' });
    assert.equal(res.status, 201);
    assert.equal(res.body.name, 'Caja');
    assert.equal(res.body.is_active, 1);
    assert.equal(res.body.balance, 0);
  });

  test('POST /api/accounts returns 400 when name is missing', async () => {
    const res = await req.post('/api/accounts').send({ currency: 'DOP' });
    assert.equal(res.status, 400);
    assert.ok(res.body.error);
  });

  test('PATCH /api/accounts/:id updates name', async () => {
    const created = await req.post('/api/accounts')
      .send({ name: 'Banco', type: 'banco', currency: 'USD', color: '#3B82F6' });
    const id = created.body.id;

    const res = await req.patch(`/api/accounts/${id}`)
      .send({ name: 'Banco BHD' });
    assert.equal(res.status, 200);
    assert.equal(res.body.name, 'Banco BHD');
  });

  test('POST /api/accounts returns 400 for invalid currency code', async () => {
    const res = await req.post('/api/accounts')
      .send({ name: 'Rara', currency: 'PESOS' });
    assert.equal(res.status, 400);
    assert.ok(res.body.error);
  });

  test('POST /api/accounts normalizes currency to uppercase', async () => {
    const res = await req.post('/api/accounts')
      .send({ name: 'Dólares', currency: 'usd' });
    assert.equal(res.status, 201);
    assert.equal(res.body.currency, 'USD');
  });

  test('PATCH /api/accounts/:id returns 400 for invalid currency code', async () => {
    const created = await req.post('/api/accounts')
      .send({ name: 'Euro', currency: 'EUR' });
    const res = await req.patch(`/api/accounts/${created.body.id}`)
      .send({ currency: 'X' });
    assert.equal(res.status, 400);
  });

  test('DELETE /api/accounts/:id soft-deletes (removed from GET)', async () => {
    const created = await req.post('/api/accounts')
      .send({ name: 'Temporal', type: 'efectivo', currency: 'DOP', color: '#EF4444' });
    const id = created.body.id;

    await req.delete(`/api/accounts/${id}`);
    const list = await req.get('/api/accounts');
    assert.ok(!list.body.some(a => a.id === id));
  });
});
