import express from 'express';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { join, dirname } from 'path';
import { createAccountsRouter } from './routes/accounts.js';
import { createTransactionsRouter } from './routes/transactions.js';
import { createNotesRouter } from './routes/notes.js';
import { createSummaryRouter } from './routes/summary.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

export function createApp(db) {
  const app = express();

  app.use(cors());
  app.use(express.json());

  app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));
  app.use('/api/accounts', createAccountsRouter(db));
  app.use('/api/transactions', createTransactionsRouter(db));
  app.use('/api/notes', createNotesRouter(db));
  app.use('/api/summary', createSummaryRouter(db));

  const distPath = join(__dirname, '../client/dist');
  app.use(express.static(distPath));
  app.get('*', (_req, res) => res.sendFile(join(distPath, 'index.html')));

  return app;
}
