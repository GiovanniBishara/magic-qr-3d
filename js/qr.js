// Turns text into a QR matrix using qrcode-generator (MIT).
import qrcode from '../vendor/qrcode-generator.mjs';

qrcode.stringToBytes = qrcode.stringToBytesFuncs['UTF-8'];

/**
 * @param {string} text
 * @param {'L'|'M'|'Q'|'H'} ecc error correction level (H = 30% recoverable)
 * @returns {{ n: number, isDark: (r: number, c: number) => boolean }}
 */
export function makeQrMatrix(text, ecc = 'H') {
  const qr = qrcode(0, ecc); // 0 = pick the smallest version that fits
  qr.addData(text && text.length ? text : ' ');
  qr.make();
  const n = qr.getModuleCount();
  const bits = new Uint8Array(n * n);
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) bits[r * n + c] = qr.isDark(r, c) ? 1 : 0;
  return { n, isDark: (r, c) => bits[r * n + c] === 1 };
}
