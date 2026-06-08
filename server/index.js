import { fileURLToPath } from 'url';
import { join, dirname } from 'path';
import { networkInterfaces } from 'os';
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
  red:    '\x1b[31m',
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
  console.log(`  ${C.green}${C.bold}Mantén esta ventana abierta mientras uses la app.${C.reset}`);
  console.log(`  ${C.dim}La app funciona solo mientras este servidor esté activo.${C.reset}`);
  console.log('');
  console.log(`  ${C.yellow}Para cerrar: escribe ${C.bold}1${C.reset}${C.yellow} y presiona Enter${C.reset}`);
  console.log(`  ${C.yellow}o cierra esta ventana con la X${C.reset}`);
  console.log(`  ${C.dim}${sep}${C.reset}`);
  console.log('');
}

const db  = createDb(DB_PATH);
const app = createApp(db);

const server = app.listen(PORT, '0.0.0.0', async () => {
  const localIp = getLocalIp();
  printBanner(localIp);

  const { default: open } = await import('open');
  open(`http://localhost:${PORT}`);

  process.stdin.resume();
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', (chunk) => {
    if (chunk.trim() === '1') {
      console.log(`\n  ${C.dim}Cerrando Agenda Financiera...${C.reset}\n`);
      process.exit(0);
    }
  });
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\n  ${C.red}Error:${C.reset} el puerto ${C.bold}${PORT}${C.reset} ya está en uso.`);
    console.error(`  Cerrá la otra instancia de Agenda Financiera primero.\n`);
  } else {
    console.error(`\n  ${C.red}Error al iniciar el servidor:${C.reset} ${err.message}\n`);
  }
  process.exit(1);
});
