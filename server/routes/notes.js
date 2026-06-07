import { Router } from 'express';

export function createNotesRouter(db) {
  const router = Router();

  router.get('/', (_req, res) => {
    res.json(db.prepare(`SELECT * FROM notes ORDER BY updated_at DESC`).all());
  });

  router.post('/', (req, res) => {
    const { title, content } = req.body;
    const result = db.prepare(
      `INSERT INTO notes (title, content) VALUES (?, ?)`
    ).run(title ?? '', content ?? '');
    const id = Number(result.lastInsertRowid);
    res.status(201).json(db.prepare(`SELECT * FROM notes WHERE id = ?`).get(id));
  });

  router.patch('/:id', (req, res) => {
    const id = Number(req.params.id);
    const note = db.prepare(`SELECT * FROM notes WHERE id = ?`).get(id);
    if (!note) return res.status(404).json({ error: 'Nota no encontrada' });

    const { title, content } = req.body;
    db.prepare(
      `UPDATE notes SET title=?, content=?, updated_at=datetime('now') WHERE id=?`
    ).run(title ?? note.title, content ?? note.content, id);

    res.json(db.prepare(`SELECT * FROM notes WHERE id = ?`).get(id));
  });

  router.delete('/:id', (req, res) => {
    const id = Number(req.params.id);
    const note = db.prepare(`SELECT id FROM notes WHERE id = ?`).get(id);
    if (!note) return res.status(404).json({ error: 'Nota no encontrada' });

    db.prepare(`DELETE FROM notes WHERE id = ?`).run(id);
    res.json({ success: true });
  });

  return router;
}
