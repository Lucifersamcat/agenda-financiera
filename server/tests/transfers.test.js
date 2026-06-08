import { describe, test, before } from 'node:test';
import assert from 'node:assert/strict';
import supertest from 'supertest';
import { createDb } from '../db.js';
import { createApp } from '../app.js';

describe('Transfers', () => {
  let req;
  let dop1, dop2, usd;

  before(async () => {
    const db = createDb(':memory:');
    req = supertest(createApp(db));

    dop1 = (await req.post('/api/accounts').send({ name: 'Caja', currency: 'DOP' })).body;
    dop2 = (await req.post('/api/accounts').send({ name: 'Banco', currency: 'DOP' })).body;
    usd  = (await req.post('/api/accounts').send({ name: 'Dólares', currency: 'USD' })).body;

    // Seed origen account with income so it has balance to move.
    await req.post('/api/transactions').send({
      account_id: dop1.id, type: 'INCOME', amount: 1000, date: '2026-01-01',
    });
  });

  test('GET /api/transfers returns empty array initially', async () => {
    const res = await req.get('/api/transfers');
    assert.equal(res.status, 200);
    assert.deepEqual(res.body, []);
  });

  test('POST same-currency auto-fills amount_to', async () => {
    const res = await req.post('/api/transfers').send({
      from_account_id: dop1.id, to_account_id: dop2.id,
      amount_from: 300, date: '2026-01-02',
    });
    assert.equal(res.status, 201);
    assert.equal(res.body.amount_from, 300);
    assert.equal(res.body.amount_to, 300);
  });

  test('updates balance of both accounts', async () => {
    const list = await req.get('/api/accounts');
    const a = list.body.find(x => x.id === dop1.id);
    const b = list.body.find(x => x.id === dop2.id);
    assert.equal(a.balance, 700); // 1000 income - 300 out
    assert.equal(b.balance, 300); // 300 in
  });

  test('POST cross-currency keeps distinct amount_to', async () => {
    const res = await req.post('/api/transfers').send({
      from_account_id: dop1.id, to_account_id: usd.id,
      amount_from: 590, amount_to: 10, date: '2026-01-03',
    });
    assert.equal(res.status, 201);
    assert.equal(res.body.amount_from, 590);
    assert.equal(res.body.amount_to, 10);

    const list = await req.get('/api/accounts');
    assert.equal(list.body.find(x => x.id === usd.id).balance, 10);
  });

  test('POST cross-currency without amount_to returns 400', async () => {
    const res = await req.post('/api/transfers').send({
      from_account_id: dop1.id, to_account_id: usd.id,
      amount_from: 100, date: '2026-01-04',
    });
    assert.equal(res.status, 400);
  });

  test('POST with same from/to returns 400', async () => {
    const res = await req.post('/api/transfers').send({
      from_account_id: dop1.id, to_account_id: dop1.id,
      amount_from: 50, date: '2026-01-05',
    });
    assert.equal(res.status, 400);
  });

  test('PATCH updates amount and re-adjusts balances', async () => {
    const created = await req.post('/api/transfers').send({
      from_account_id: dop1.id, to_account_id: dop2.id,
      amount_from: 100, date: '2026-02-01',
    });
    const before = (await req.get('/api/accounts')).body.find(x => x.id === dop2.id).balance;

    const res = await req.patch(`/api/transfers/${created.body.id}`).send({ amount_from: 250 });
    assert.equal(res.status, 200);
    assert.equal(res.body.amount_from, 250);
    assert.equal(res.body.amount_to, 250); // same currency stays in sync

    const after = (await req.get('/api/accounts')).body.find(x => x.id === dop2.id).balance;
    assert.equal(after, before + 150); // +250 instead of +100

    await req.delete(`/api/transfers/${created.body.id}`);
  });

  test('PATCH same/from to returns 400', async () => {
    const created = await req.post('/api/transfers').send({
      from_account_id: dop1.id, to_account_id: dop2.id,
      amount_from: 100, date: '2026-02-02',
    });
    const res = await req.patch(`/api/transfers/${created.body.id}`)
      .send({ to_account_id: dop1.id });
    assert.equal(res.status, 400);
    await req.delete(`/api/transfers/${created.body.id}`);
  });

  test('DELETE removes transfer and reverts balance', async () => {
    const created = await req.post('/api/transfers').send({
      from_account_id: dop2.id, to_account_id: dop1.id,
      amount_from: 100, date: '2026-01-06',
    });
    const before = (await req.get('/api/accounts')).body.find(x => x.id === dop1.id).balance;

    const res = await req.delete(`/api/transfers/${created.body.id}`);
    assert.equal(res.status, 200);

    const after = (await req.get('/api/accounts')).body.find(x => x.id === dop1.id).balance;
    assert.equal(after, before - 100);
  });
});
