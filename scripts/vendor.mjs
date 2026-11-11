// Copia le librerie da node_modules a vendor/ (così il sito gira senza build, anche su GitHub Pages).
// Copies the libraries from node_modules into vendor/ (no build step needed, works on GitHub Pages).
import { readFileSync, writeFileSync, mkdirSync, copyFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const nm = (p) => join(root, 'node_modules', p);
const out = (p) => join(root, 'vendor', p);
mkdirSync(out('licenses'), { recursive: true });

copyFileSync(nm('three/build/three.module.min.js'), out('three.module.min.js'));
copyFileSync(nm('gifenc/dist/gifenc.esm.js'), out('gifenc.esm.js'));
// solo per test.html (verifica automatica che il QR si legga) / only used by test.html
copyFileSync(nm('jsqr/dist/jsQR.js'), out('jsQR.js'));
// qrcode-generator è UMD: aggiungiamo un export ES module in coda.
const qr = readFileSync(nm('qrcode-generator/qrcode.js'), 'utf8');
writeFileSync(out('qrcode-generator.mjs'), qr + '\nexport default qrcode;\n');

copyFileSync(nm('three/LICENSE'), out('licenses/three.LICENSE.txt'));
copyFileSync(nm('gifenc/LICENSE.md'), out('licenses/gifenc.LICENSE.md'));
writeFileSync(out('licenses/jsQR.LICENSE.txt'),
  'jsQR by Cosmo Wolfe - Apache License 2.0\nhttps://github.com/cozmo/jsQR\n');
writeFileSync(out('licenses/qrcode-generator.LICENSE.txt'),
  'qrcode-generator by Kazuhiko Arase - MIT License\nhttps://github.com/kazuhikoarase/qrcode-generator\n');
console.log('vendor/ aggiornato');
