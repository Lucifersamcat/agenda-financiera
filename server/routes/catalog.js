import { Router } from 'express';

function slugify(name) {
  return String(name)
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}

function uniqueSlug(db, table, name) {
  const base = slugify(name) || 'item';
  let slug = base;
  let n = 2;
  const exists = db.prepare(`SELECT 1 FROM ${table} WHERE slug = ?`);
  while (exists.get(slug)) slug = `${base}-${n++}`;
  return slug;
}

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

export function createAccountTypesRouter(db) {
  const router = Router();

  router.get('/', (_req, res) => {
    res.json(db.prepare(`SELECT * FROM account_types ORDER BY position, id`).all());
  });

  router.post('/', (req, res) => {
    const name = String(req.body?.name ?? '').trim();
    if (!name) return res.status(400).json({ error: 'name es requerido' });

    const slug = uniqueSlug(db, 'account_types', name);
    const pos = db.prepare(`SELECT COALESCE(MAX(position), -1) + 1 AS p FROM account_types`).get().p;
    const result = db.prepare(
      `INSERT INTO account_types (slug, name, position) VALUES (?, ?, ?)`
    ).run(slug, name, pos);
    res.status(201).json(db.prepare(`SELECT * FROM account_types WHERE id = ?`).get(Number(result.lastInsertRowid)));
  });

  router.patch('/:id', (req, res) => {
    const id = Number(req.params.id);
    const existing = db.prepare(`SELECT * FROM account_types WHERE id = ?`).get(id);
    if (!existing) return res.status(404).json({ error: 'Tipo de cuenta no encontrado' });

    const name = req.body?.name !== undefined ? String(req.body.name).trim() : existing.name;
    if (!name) return res.status(400).json({ error: 'name no puede estar vacío' });

    db.prepare(`UPDATE account_types SET name = ? WHERE id = ?`).run(name, id);
    res.json(db.prepare(`SELECT * FROM account_types WHERE id = ?`).get(id));
  });

  router.delete('/:id', (req, res) => {
    const id = Number(req.params.id);
    const existing = db.prepare(`SELECT * FROM account_types WHERE id = ?`).get(id);
    if (!existing) return res.status(404).json({ error: 'Tipo de cuenta no encontrado' });
    if (existing.slug === 'other') {
      return res.status(400).json({ error: 'El tipo "Otro" no se puede eliminar' });
    }

    const reassign = req.body?.reassign_to ?? 'other';
    const target = db.prepare(`SELECT slug FROM account_types WHERE slug = ? AND id != ?`).get(String(reassign), id);
    if (!target) return res.status(400).json({ error: 'El tipo de destino no existe' });

    db.prepare(`UPDATE accounts SET type = ? WHERE type = ?`).run(target.slug, existing.slug);
    db.prepare(`DELETE FROM account_types WHERE id = ?`).run(id);
    res.json({ success: true });
  });

  return router;
}

export function createDebtTypesRouter(db) {
  const router = Router();

  router.get('/', (_req, res) => {
    res.json(db.prepare(`SELECT * FROM debt_types ORDER BY position, id`).all());
  });

  router.post('/', (req, res) => {
    const name = String(req.body?.name ?? '').trim();
    if (!name) return res.status(400).json({ error: 'name es requerido' });

    const slug = uniqueSlug(db, 'debt_types', name);
    const pos = db.prepare(`SELECT COALESCE(MAX(position), -1) + 1 AS p FROM debt_types`).get().p;
    const result = db.prepare(
      `INSERT INTO debt_types (slug, name, position) VALUES (?, ?, ?)`
    ).run(slug, name, pos);
    res.status(201).json(db.prepare(`SELECT * FROM debt_types WHERE id = ?`).get(Number(result.lastInsertRowid)));
  });

  router.patch('/:id', (req, res) => {
    const id = Number(req.params.id);
    const existing = db.prepare(`SELECT * FROM debt_types WHERE id = ?`).get(id);
    if (!existing) return res.status(404).json({ error: 'Tipo de deuda no encontrado' });

    const name = req.body?.name !== undefined ? String(req.body.name).trim() : existing.name;
    if (!name) return res.status(400).json({ error: 'name no puede estar vacío' });

    db.prepare(`UPDATE debt_types SET name = ? WHERE id = ?`).run(name, id);
    res.json(db.prepare(`SELECT * FROM debt_types WHERE id = ?`).get(id));
  });

  router.delete('/:id', (req, res) => {
    const id = Number(req.params.id);
    const existing = db.prepare(`SELECT * FROM debt_types WHERE id = ?`).get(id);
    if (!existing) return res.status(404).json({ error: 'Tipo de deuda no encontrado' });
    if (existing.slug === 'otro') {
      return res.status(400).json({ error: 'El tipo "Otro" no se puede eliminar' });
    }

    const reassign = req.body?.reassign_to ?? 'otro';
    const target = db.prepare(`SELECT slug FROM debt_types WHERE slug = ? AND id != ?`).get(String(reassign), id);
    if (!target) return res.status(400).json({ error: 'El tipo de destino no existe' });

    db.prepare(`UPDATE debts SET type = ? WHERE type = ?`).run(target.slug, existing.slug);
    db.prepare(`DELETE FROM debt_types WHERE id = ?`).run(id);
    res.json({ success: true });
  });

  return router;
}

export function createCategoriesRouter(db) {
  const router = Router();

  router.get('/', (_req, res) => {
    res.json(db.prepare(`SELECT * FROM categories ORDER BY position, id`).all());
  });

  router.post('/', (req, res) => {
    const name = String(req.body?.name ?? '').trim();
    const kind = req.body?.kind ?? 'EXPENSE';
    const color = req.body?.color ?? '#94a3b8';
    if (!name) return res.status(400).json({ error: 'name es requerido' });
    if (!['INCOME', 'EXPENSE', 'BOTH'].includes(kind)) {
      return res.status(400).json({ error: 'kind debe ser INCOME, EXPENSE o BOTH' });
    }
    if (!HEX_COLOR.test(color)) {
      return res.status(400).json({ error: 'color debe ser un hex válido (#RRGGBB)' });
    }

    const slug = uniqueSlug(db, 'categories', name);
    const pos = db.prepare(`SELECT COALESCE(MAX(position), -1) + 1 AS p FROM categories`).get().p;
    const result = db.prepare(
      `INSERT INTO categories (slug, name, color, kind, position) VALUES (?, ?, ?, ?, ?)`
    ).run(slug, name, color, kind, pos);
    res.status(201).json(db.prepare(`SELECT * FROM categories WHERE id = ?`).get(Number(result.lastInsertRowid)));
  });

  router.patch('/:id', (req, res) => {
    const id = Number(req.params.id);
    const existing = db.prepare(`SELECT * FROM categories WHERE id = ?`).get(id);
    if (!existing) return res.status(404).json({ error: 'Categoría no encontrada' });

    const name = req.body?.name !== undefined ? String(req.body.name).trim() : existing.name;
    const color = req.body?.color ?? existing.color;
    const kind = req.body?.kind ?? existing.kind;
    if (!name) return res.status(400).json({ error: 'name no puede estar vacío' });
    if (!['INCOME', 'EXPENSE', 'BOTH'].includes(kind)) {
      return res.status(400).json({ error: 'kind debe ser INCOME, EXPENSE o BOTH' });
    }
    if (!HEX_COLOR.test(color)) {
      return res.status(400).json({ error: 'color debe ser un hex válido (#RRGGBB)' });
    }
    if (existing.slug === 'otros' && kind !== existing.kind) {
      return res.status(400).json({ error: 'La categoría "Otros" debe seguir disponible para ambos tipos' });
    }

    db.prepare(`UPDATE categories SET name = ?, color = ?, kind = ? WHERE id = ?`).run(name, color, kind, id);
    res.json(db.prepare(`SELECT * FROM categories WHERE id = ?`).get(id));
  });

  router.delete('/:id', (req, res) => {
    const id = Number(req.params.id);
    const existing = db.prepare(`SELECT * FROM categories WHERE id = ?`).get(id);
    if (!existing) return res.status(404).json({ error: 'Categoría no encontrada' });
    if (existing.slug === 'otros') {
      return res.status(400).json({ error: 'La categoría "Otros" no se puede eliminar' });
    }

    const reassign = req.body?.reassign_to ?? 'otros';
    const target = db.prepare(`SELECT slug FROM categories WHERE slug = ? AND id != ?`).get(String(reassign), id);
    if (!target) return res.status(400).json({ error: 'La categoría de destino no existe' });

    db.prepare(`UPDATE transactions SET category = ? WHERE category = ?`).run(target.slug, existing.slug);
    db.prepare(`DELETE FROM categories WHERE id = ?`).run(id);
    res.json({ success: true });
  });

  return router;
}

export function createCustomFieldsRouter(db) {
  const router = Router();

  function parseOptions(raw, type) {
    if (type !== 'select') return [];
    if (!Array.isArray(raw)) return undefined;
    const opts = raw.map(o => String(o).trim()).filter(Boolean);
    return opts.length ? opts : undefined;
  }

  router.get('/', (_req, res) => {
    res.json(db.prepare(`SELECT * FROM custom_fields ORDER BY position, id`).all());
  });

  router.post('/', (req, res) => {
    const name = String(req.body?.name ?? '').trim();
    const type = req.body?.type ?? 'text';
    const applies_to = req.body?.applies_to ?? 'BOTH';
    if (!name) return res.status(400).json({ error: 'name es requerido' });
    if (!['text', 'number', 'select', 'date', 'boolean'].includes(type)) {
      return res.status(400).json({ error: 'type inválido' });
    }
    if (!['INCOME', 'EXPENSE', 'BOTH'].includes(applies_to)) {
      return res.status(400).json({ error: 'applies_to debe ser INCOME, EXPENSE o BOTH' });
    }
    const options = parseOptions(req.body?.options ?? [], type);
    if (options === undefined) {
      return res.status(400).json({ error: 'Un campo de tipo lista necesita al menos una opción' });
    }

    const key = uniqueKey(name);
    const pos = db.prepare(`SELECT COALESCE(MAX(position), -1) + 1 AS p FROM custom_fields`).get().p;
    const result = db.prepare(
      `INSERT INTO custom_fields (key, name, type, options, applies_to, position) VALUES (?, ?, ?, ?, ?, ?)`
    ).run(key, name, type, JSON.stringify(options), applies_to, pos);
    res.status(201).json(db.prepare(`SELECT * FROM custom_fields WHERE id = ?`).get(Number(result.lastInsertRowid)));
  });

  function uniqueKey(name) {
    const base = slugify(name).replace(/-/g, '_') || 'campo';
    let key = base;
    let n = 2;
    const exists = db.prepare(`SELECT 1 FROM custom_fields WHERE key = ?`);
    while (exists.get(key)) key = `${base}_${n++}`;
    return key;
  }

  router.patch('/:id', (req, res) => {
    const id = Number(req.params.id);
    const existing = db.prepare(`SELECT * FROM custom_fields WHERE id = ?`).get(id);
    if (!existing) return res.status(404).json({ error: 'Campo no encontrado' });

    const name = req.body?.name !== undefined ? String(req.body.name).trim() : existing.name;
    const applies_to = req.body?.applies_to ?? existing.applies_to;
    if (!name) return res.status(400).json({ error: 'name no puede estar vacío' });
    if (!['INCOME', 'EXPENSE', 'BOTH'].includes(applies_to)) {
      return res.status(400).json({ error: 'applies_to debe ser INCOME, EXPENSE o BOTH' });
    }

    let options = existing.options;
    if (req.body?.options !== undefined) {
      const parsed = parseOptions(req.body.options, existing.type);
      if (parsed === undefined) {
        return res.status(400).json({ error: 'Un campo de tipo lista necesita al menos una opción' });
      }
      options = JSON.stringify(parsed);
    }

    db.prepare(
      `UPDATE custom_fields SET name = ?, options = ?, applies_to = ? WHERE id = ?`
    ).run(name, options, applies_to, id);
    res.json(db.prepare(`SELECT * FROM custom_fields WHERE id = ?`).get(id));
  });

  router.delete('/:id', (req, res) => {
    const id = Number(req.params.id);
    const existing = db.prepare(`SELECT id FROM custom_fields WHERE id = ?`).get(id);
    if (!existing) return res.status(404).json({ error: 'Campo no encontrado' });

    // Los valores ya guardados quedan en metadata; solo se deja de mostrar el campo.
    db.prepare(`DELETE FROM custom_fields WHERE id = ?`).run(id);
    res.json({ success: true });
  });

  return router;
}
