import { Router } from 'express';

export const SETTING_DEFAULTS = {
  default_currency: 'DOP',
  dashboard_period: 'month',
  page_size: 15,
};

const VALIDATORS = {
  default_currency: (v) => {
    const code = String(v).trim().toUpperCase();
    return /^[A-Z]{3}$/.test(code) ? code : undefined;
  },
  dashboard_period: (v) => (['week', 'month', 'year'].includes(v) ? v : undefined),
  page_size: (v) => {
    const n = Number.parseInt(v, 10);
    return Number.isInteger(n) && n >= 5 && n <= 100 ? n : undefined;
  },
};

export function createSettingsRouter(db) {
  const router = Router();

  function readAll() {
    const stored = Object.fromEntries(
      db.prepare(`SELECT key, value FROM settings`).all().map(r => [r.key, r.value])
    );
    const merged = { ...SETTING_DEFAULTS };
    for (const key of Object.keys(SETTING_DEFAULTS)) {
      if (stored[key] === undefined) continue;
      const valid = VALIDATORS[key](stored[key]);
      if (valid !== undefined) merged[key] = valid;
    }
    return merged;
  }

  router.get('/', (_req, res) => {
    res.json(readAll());
  });

  router.patch('/', (req, res) => {
    const updates = {};
    for (const [key, value] of Object.entries(req.body ?? {})) {
      if (!(key in VALIDATORS)) {
        return res.status(400).json({ error: `Ajuste desconocido: ${key}` });
      }
      const valid = VALIDATORS[key](value);
      if (valid === undefined) {
        return res.status(400).json({ error: `Valor inválido para ${key}` });
      }
      updates[key] = valid;
    }

    const upsert = db.prepare(
      `INSERT INTO settings (key, value) VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`
    );
    for (const [key, value] of Object.entries(updates)) {
      upsert.run(key, String(value));
    }

    res.json(readAll());
  });

  return router;
}
