import { Router } from 'express';
import { networkInterfaces } from 'os';

function getLocalIp() {
  const nets = networkInterfaces();
  return Object.values(nets).flat().find(n => n.family === 'IPv4' && !n.internal)?.address ?? null;
}

export function createServerInfoRouter() {
  const router = Router();

  router.get('/', (req, res) => {
    const port = req.socket.localPort ?? Number(process.env.PORT ?? 3737);
    const ip = getLocalIp();
    res.json({
      port,
      ip,
      local: `http://localhost:${port}`,
      network: ip ? `http://${ip}:${port}` : null,
    });
  });

  return router;
}
