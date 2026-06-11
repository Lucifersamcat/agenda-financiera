import { describe, test, before } from 'node:test';
import assert from 'node:assert/strict';
import supertest from 'supertest';
import { createDb } from '../db.js';
import { createApp } from '../app.js';

describe('App', () => {
  let req;

  before(() => {
    const db = createDb(':memory:');
    req = supertest(createApp(db));
  });

  test('GET /api/health responds ok', async () => {
    const res = await req.get('/api/health');
    assert.equal(res.status, 200);
    assert.equal(res.body.status, 'ok');
  });

  test('unknown /api route returns JSON 404', async () => {
    const res = await req.get('/api/no-existe');
    assert.equal(res.status, 404);
    assert.ok(res.body.error);
  });

  test('malformed JSON body returns 400', async () => {
    const res = await req.post('/api/accounts')
      .set('Content-Type', 'application/json')
      .send('{esto no es json');
    assert.equal(res.status, 400);
    assert.ok(res.body.error);
  });
});
