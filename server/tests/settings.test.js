import { describe, test, before } from 'node:test';
import assert from 'node:assert/strict';
import supertest from 'supertest';
import { createDb } from '../db.js';
import { createApp } from '../app.js';

describe('Settings', () => {
  let req;

  before(() => {
    const db = createDb(':memory:');
    req = supertest(createApp(db));
  });

  test('GET /api/settings returns defaults', async () => {
    const res = await req.get('/api/settings');
    assert.equal(res.status, 200);
    assert.equal(res.body.default_currency, 'DOP');
    assert.equal(res.body.dashboard_period, 'month');
    assert.equal(res.body.page_size, 15);
  });

  test('PATCH /api/settings persists valid values', async () => {
    const res = await req.patch('/api/settings')
      .send({ default_currency: 'usd', dashboard_period: 'week', page_size: 25 });
    assert.equal(res.status, 200);
    assert.equal(res.body.default_currency, 'USD');
    assert.equal(res.body.dashboard_period, 'week');
    assert.equal(res.body.page_size, 25);

    const again = await req.get('/api/settings');
    assert.equal(again.body.default_currency, 'USD');
    assert.equal(again.body.page_size, 25);
  });

  test('PATCH /api/settings rejects unknown keys', async () => {
    const res = await req.patch('/api/settings').send({ tema: 'oscuro' });
    assert.equal(res.status, 400);
  });

  test('PATCH /api/settings rejects invalid values', async () => {
    assert.equal((await req.patch('/api/settings').send({ page_size: 9999 })).status, 400);
    assert.equal((await req.patch('/api/settings').send({ dashboard_period: 'siglo' })).status, 400);
    assert.equal((await req.patch('/api/settings').send({ default_currency: 'PESOS' })).status, 400);
  });
});

describe('Data export/import/wipe', () => {
  let req;

  before(async () => {
    const db = createDb(':memory:');
    req = supertest(createApp(db));
    const acc = await req.post('/api/accounts').send({ name: 'Caja', currency: 'DOP' });
    await req.post('/api/transactions').send({
      account_id: acc.body.id, type: 'INCOME', amount: 1000, date: '2026-06-01', category: 'salario',
    });
    await req.post('/api/notes').send({ title: 'Nota', content: 'Contenido' });
  });

  test('GET /api/data/export returns full snapshot', async () => {
    const res = await req.get('/api/data/export');
    assert.equal(res.status, 200);
    assert.equal(res.body.app, 'agenda-financiera');
    assert.equal(res.body.accounts.length, 1);
    assert.equal(res.body.transactions.length, 1);
    assert.equal(res.body.notes.length, 1);
  });

  test('POST /api/data/import restores an exported snapshot', async () => {
    const backup = (await req.get('/api/data/export')).body;

    // Wipe and verify it is empty, then restore.
    await req.post('/api/data/wipe').send({ confirm: true });
    assert.equal((await req.get('/api/accounts')).body.length, 0);

    const res = await req.post('/api/data/import').send(backup);
    assert.equal(res.status, 200);
    assert.equal(res.body.accounts, 1);

    const accounts = await req.get('/api/accounts');
    assert.equal(accounts.body.length, 1);
    assert.equal(accounts.body[0].name, 'Caja');
    assert.equal(accounts.body[0].balance, 1000);
  });

  test('POST /api/data/import rejects invalid payloads', async () => {
    const res = await req.post('/api/data/import').send({ accounts: 'no' });
    assert.equal(res.status, 400);
  });

  test('POST /api/data/wipe requires confirmation', async () => {
    const res = await req.post('/api/data/wipe').send({});
    assert.equal(res.status, 400);
    assert.equal((await req.get('/api/accounts')).body.length, 1);
  });
});
