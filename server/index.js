import { fileURLToPath } from 'url';
import { join, dirname } from 'path';
import { networkInterfaces } from 'os';
import { createInterface } from 'readline';
import { createDb } from './db.js';
import { createApp } from './app.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH   = join(__dirname, '../data/agenda.db');
const PORT      = Number(process.env.PORT ?? 3737);

const C = {
  reset:  '\x1b[0m',
  bold:   '\x1b[1m',
  green:  '\x1b[32m',
  cyan:   '\x1b[36m',
  yellow: '\x1b[33m',
  dim:    '\x1b[2m',
};

function getLocalIp() {
  const nets = networkInterfaces();
  return Object.values(nets).flat().find(n => n.family === 'IPv4' && !n.internal)?.address ?? null;
}

function printBanner(localIp) {
  const line = '═'.repeat(46);
  const sep  = '─'.repeat(46);
  console.log('');
  console.log(`${C.cyan}${C.bold}╔${line}╗${C.reset}`);
  console.log(`${C.cyan}${C.bold}║${C.reset}${C.bold}         💰  Agenda Financiera  v1.0.0        ${C.cyan}${C.bold}║${C.reset}`);
  console.log(`${C.cyan}${C.bold}╚${line}╝${C.reset}`);
  console.log('');
  console.log(`  ${C.green}✔${C.reset}  Servidor activo en puerto ${C.bold}${PORT}${C.reset}`);
  console.log('');
  console.log(`  ${C.dim}Local:${C.reset}      ${C.cyan}http://localhost:${PORT}${C.reset}`);
  if (localIp) {
    console.log(`  ${C.dim}Red local:${C.reset}  ${C.cyan}http://${localIp}:${PORT}${C.reset}  ${C.dim}← otros dispositivos en tu red${C.reset}`);
  }
  console.log('');
  console.log(`  ${C.dim}El navegador se abrirá automáticamente.${C.reset}`);
  console.log('');
  console.log(`  ${C.dim}${sep}${C.reset}`);
  console.log(`  ${C.yellow}Para cerrar: escribe ${C.bold}1${C.reset}${C.yellow} y presiona Enter${C.reset}`);
  console.log(`  ${C.yellow}o cierra esta ventana con la X${C.reset}`);
  console.log(`  ${C.dim}${sep}${C.reset}`);
  console.log('');
}

const db  = createDb(DB_PATH);
const app = createApp(db);

app.listen(PORT, '0.0.0.0', async () => {
  const localIp = getLocalIp();
  printBanner(localIp);

  const { default: open } = await import('open');
  open(`http://localhost:${PORT}`);

  const rl = createInterface({ input: process.stdin });
  rl.on('line', (line) => {
    if (line.trim() === '1') {
      console.log(`\n  ${C.dim}Cerrando Agenda Financiera...${C.reset}\n`);
      rl.close();
      process.exit(0);
    }
  });
});
