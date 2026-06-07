import { describe, test, before } from 'node:test';
import assert from 'node:assert/strict';
import supertest from 'supertest';
import { createDb } from '../db.js';
import { createApp } from '../app.js';

describe('Notes', () => {
  let req;

  before(() => {
    req = supertest(createApp(createDb(':memory:')));
  });

  test('GET /api/notes returns empty array initially', async () => {
    const res = await req.get('/api/notes');
    assert.equal(res.status, 200);
    assert.deepEqual(res.body, []);
  });

  test('POST /api/notes creates a note', async () => {
    const res = await req.post('/api/notes')
      .send({ title: 'Meta', content: 'Ahorrar 10000 este mes' });
    assert.equal(res.status, 201);
    assert.equal(res.body.title, 'Meta');
    assert.ok(res.body.created_at);
    assert.ok(res.body.updated_at);
  });

  test('PATCH /api/notes/:id updates content', async () => {
    const created = await req.post('/api/notes')
      .send({ title: 'Presupuesto', content: 'Borrador' });
    const id = created.body.id;
    const res = await req.patch(`/api/notes/${id}`).send({ content: 'Definitivo' });
    assert.equal(res.status, 200);
    assert.equal(res.body.content, 'Definitivo');
  });

  test('DELETE /api/notes/:id removes the note', async () => {
    const created = await req.post('/api/notes').send({ title: 'Borrar', content: '' });
    const id = created.body.id;
    await req.delete(`/api/notes/${id}`);
    const list = await req.get('/api/notes');
    assert.ok(!list.body.some(n => n.id === id));
  });

  test('PATCH /api/notes/:id unknown returns 404', async () => {
    const res = await req.patch('/api/notes/99999').send({ title: 'X' });
    assert.equal(res.status, 404);
  });
});
