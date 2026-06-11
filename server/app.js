import express from 'express';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { join, dirname } from 'path';
import { createAccountsRouter } from './routes/accounts.js';
import { createTransactionsRouter } from './routes/transactions.js';
import { createNotesRouter } from './routes/notes.js';
import { createSummaryRouter } from './routes/summary.js';
import { createTransfersRouter } from './routes/transfers.js';
import { createSettingsRouter } from './routes/settings.js';
import { createDataRouter } from './routes/data.js';

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
  app.use('/api/transfers', createTransfersRouter(db));
  app.use('/api/settings', createSettingsRouter(db));
  app.use('/api/data', createDataRouter(db));

  app.use('/api', (_req, res) => res.status(404).json({ error: 'Ruta no encontrada' }));

  const distPath = join(__dirname, '../client/dist');
  app.use(express.static(distPath));
  app.get('*', (_req, res) => res.sendFile(join(distPath, 'index.html')));

  app.use((err, _req, res, _next) => {
    if (err.type === 'entity.parse.failed') {
      return res.status(400).json({ error: 'JSON inválido' });
    }
    console.error(err);
    res.status(500).json({ error: 'Error interno del servidor' });
  });

  return app;
}
