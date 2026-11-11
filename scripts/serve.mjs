// Piccolo server statico senza dipendenze: `npm start`, poi apri l'indirizzo mostrato.
// Tiny dependency-free static server. Also prints the LAN address to open the page on a phone.
import { createServer } from 'node:http';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { extname, join, normalize, dirname } from 'node:path';
import { networkInterfaces } from 'node:os';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const port = Number(process.env.PORT) || 5050;
// `npm start -- --allow-save`: lets the page POST a file into docs/ (used once to make the README GIF).
const allowSave = process.argv.includes('--allow-save');
const types = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.gif': 'image/gif',
  '.json': 'application/json', '.ico': 'image/x-icon', '.webp': 'image/webp', '.md': 'text/plain; charset=utf-8',
};

createServer(async (req, res) => {
  if (allowSave && req.method === 'POST' && req.url.startsWith('/__save?')) {
    const name = new URL(req.url, 'http://x').searchParams.get('name') || '';
    if (!/^[\w-]+\.(gif|png|webm|mp4)$/.test(name)) { res.writeHead(400).end(); return; }
    const chunks = [];
    for await (const c of req) chunks.push(c);
    await mkdir(join(root, 'docs'), { recursive: true });
    await writeFile(join(root, 'docs', name), Buffer.concat(chunks));
    res.writeHead(200).end('saved docs/' + name);
    return;
  }
  let path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (path.endsWith('/')) path += 'index.html';
  const file = normalize(join(root, path));
  if (!file.startsWith(root) || file.includes('node_modules')) { res.writeHead(403).end(); return; }
  try {
    const data = await readFile(file);
    res.writeHead(200, { 'Content-Type': types[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(data);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain' }).end('404');
  }
}).listen(port, '0.0.0.0', () => {
  console.log(`\n  Magic QR 3D in esecuzione / running:\n  - questo computer:  http://localhost:${port}`);
  for (const list of Object.values(networkInterfaces())) {
    for (const a of list || []) {
      if (a.family === 'IPv4' && !a.internal) console.log(`  - dal telefono (stessa Wi-Fi): http://${a.address}:${port}`);
    }
  }
  console.log('\n  Ctrl+C per fermare.\n');
});
