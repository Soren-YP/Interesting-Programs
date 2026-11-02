import { resolve } from 'node:path';
import { createAppServer } from './app.js';

const development = process.argv.includes('--dev');
const port = development ? 4174 : 4173;
const host = '127.0.0.1';
const server = createAppServer({
  distDirectory: resolve(process.cwd(), 'dist'),
  serveFiles: !development,
});

server.listen(port, host, () => {
  const mode = development ? 'API' : '应用';
  console.log(`Star ${mode}已启动：http://${host}:${port}`);
});

function shutdown() {
  server.close(() => process.exit(0));
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
