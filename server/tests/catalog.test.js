import { describe, test, before } from 'node:test';
import assert from 'node:assert/strict';
import supertest from 'supertest';
import { createDb } from '../db.js';
import { createApp } from '../app.js';

describe('Account types catalog', () => {
  let req;

  before(() => {
    req = supertest(createApp(createDb(':memory:')));
  });

  test('GET /api/account-types returns seeded defaults', async () => {
    const res = await req.get('/api/account-types');
    assert.equal(res.status, 200);
    assert.deepEqual(res.body.map(t => t.slug), ['bank', 'cash', 'savings', 'other']);
  });

  test('POST creates a type with generated slug', async () => {
    const res = await req.post('/api/account-types').send({ name: 'Tarjeta de crédito' });
    assert.equal(res.status, 201);
    assert.equal(res.body.slug, 'tarjeta-de-credito');
  });

  test('PATCH renames a type', async () => {
    const created = await req.post('/api/account-types').send({ name: 'Préstamo' });
    const res = await req.patch(`/api/account-types/${created.body.id}`).send({ name: 'Préstamos' });
    assert.equal(res.body.name, 'Préstamos');
  });

  test('DELETE reassigns accounts to the target type', async () => {
    const type = await req.post('/api/account-types').send({ name: 'Temporal' });
    const acc = await req.post('/api/accounts').send({ name: 'Cuenta', type: 'temporal', currency: 'DOP' });
    const res = await req.delete(`/api/account-types/${type.body.id}`).send({});
    assert.equal(res.status, 200);
    const accounts = await req.get('/api/accounts');
    assert.equal(accounts.body.find(a => a.id === acc.body.id).type, 'other');
  });

  test('DELETE rejects removing "other"', async () => {
    const list = await req.get('/api/account-types');
    const other = list.body.find(t => t.slug === 'other');
    assert.equal((await req.delete(`/api/account-types/${other.id}`).send({})).status, 400);
  });
});

describe('Categories catalog', () => {
  let req;

  before(() => {
    req = supertest(createApp(createDb(':memory:')));
  });

  test('GET /api/categories returns seeded defaults with otros as BOTH', async () => {
    const res = await req.get('/api/categories');
    assert.equal(res.status, 200);
    assert.ok(res.body.length >= 21);
    const otros = res.body.find(c => c.slug === 'otros');
    assert.equal(otros.kind, 'BOTH');
  });

  test('POST creates a category and rejects bad colors', async () => {
    const ok = await req.post('/api/categories').send({ name: 'Gimnasio', kind: 'EXPENSE', color: '#123abc' });
    assert.equal(ok.status, 201);
    assert.equal(ok.body.slug, 'gimnasio');

    const bad = await req.post('/api/categories').send({ name: 'X', color: 'rojo' });
    assert.equal(bad.status, 400);
  });

  test('PATCH updates name and color', async () => {
    const created = await req.post('/api/categories').send({ name: 'Bares', kind: 'EXPENSE' });
    const res = await req.patch(`/api/categories/${created.body.id}`).send({ name: 'Salidas', color: '#ff0000' });
    assert.equal(res.body.name, 'Salidas');
    assert.equal(res.body.color, '#ff0000');
  });

  test('DELETE reassigns transactions to the target category', async () => {
    const acc = await req.post('/api/accounts').send({ name: 'Caja', currency: 'DOP' });
    const cat = await req.post('/api/categories').send({ name: 'Eliminable', kind: 'EXPENSE' });
    await req.post('/api/transactions').send({
      account_id: acc.body.id, type: 'EXPENSE', amount: 100, date: '2026-06-01', category: 'eliminable',
    });

    const res = await req.delete(`/api/categories/${cat.body.id}`).send({ reassign_to: 'comida' });
    assert.equal(res.status, 200);

    const txs = await req.get('/api/transactions');
    assert.equal(txs.body.data[0].category, 'comida');
  });

  test('DELETE rejects removing "otros"', async () => {
    const list = await req.get('/api/categories');
    const otros = list.body.find(c => c.slug === 'otros');
    assert.equal((await req.delete(`/api/categories/${otros.id}`).send({})).status, 400);
  });
});

describe('Custom fields catalog', () => {
  let req;

  before(() => {
    req = supertest(createApp(createDb(':memory:')));
  });

  test('GET /api/custom-fields includes the seeded payment method', async () => {
    const res = await req.get('/api/custom-fields');
    assert.equal(res.status, 200);
    const metodo = res.body.find(f => f.key === 'metodo_pago');
    assert.equal(metodo.type, 'select');
    assert.deepEqual(JSON.parse(metodo.options), ['Efectivo', 'Tarjeta', 'Transferencia', 'Otro']);
  });

  test('POST creates fields and validates select options', async () => {
    const ok = await req.post('/api/custom-fields').send({ name: 'Beneficiario', type: 'text', applies_to: 'EXPENSE' });
    assert.equal(ok.status, 201);
    assert.equal(ok.body.key, 'beneficiario');

    const bad = await req.post('/api/custom-fields').send({ name: 'Lista vacía', type: 'select', options: [] });
    assert.equal(bad.status, 400);
  });

  test('PATCH updates options of a select field', async () => {
    const list = await req.get('/api/custom-fields');
    const metodo = list.body.find(f => f.key === 'metodo_pago');
    const res = await req.patch(`/api/custom-fields/${metodo.id}`).send({ options: ['Efectivo', 'Tarjeta'] });
    assert.deepEqual(JSON.parse(res.body.options), ['Efectivo', 'Tarjeta']);
  });

  test('DELETE removes a field', async () => {
    const created = await req.post('/api/custom-fields').send({ name: 'Borrable', type: 'boolean' });
    assert.equal((await req.delete(`/api/custom-fields/${created.body.id}`)).status, 200);
    const list = await req.get('/api/custom-fields');
    assert.ok(!list.body.some(f => f.id === created.body.id));
  });
});
