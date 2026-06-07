import { fileURLToPath } from 'url';
import { join, dirname } from 'path';
import { createDb } from './db.js';
import { createApp } from './app.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = join(__dirname, '../data/agenda.db');
const PORT = Number(process.env.PORT ?? 3737);

const db = createDb(DB_PATH);
const app = createApp(db);

app.listen(PORT, async () => {
  const url = `http://localhost:${PORT}`;
  console.log(`Agenda Financiera → ${url}`);
  const { default: open } = await import('open');
  open(url);
});
