// Exports: PNG of the magic view, animated GIF (gifenc, MIT) and a short video (MediaRecorder).
import { GIFEncoder, quantize, applyPalette } from '../vendor/gifenc.esm.js';
import { demoPose } from './scene.js';

const nextFrame = () => new Promise((r) => requestAnimationFrame(() => r()));

/** Saves a Blob as a file on the user's device. */
export function download({ blob, name }) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

// Each exporter returns { blob, name }; main.js passes it to download().

/** PNG of the scene from the magic view: a flat, printable, scannable QR. */
export async function exportPng(scene, size = 1600) {
  scene.beginCapture(size);
  try {
    const canvas = scene.renderPose(0, Math.PI / 2);
    // toBlob copies the bitmap immediately, right after render, so no preserveDrawingBuffer needed
    const blob = await new Promise((res) => canvas.toBlob(res, 'image/png'));
    return { blob, name: 'magic-qr.png' };
  } finally {
    scene.endCapture();
  }
}

/** Looping GIF: 3/4 view → magic view → hold → back. */
export async function exportGif(scene, { size = 480, fps = 20, loop = 4.2, onProgress } = {}) {
  const frames = Math.round(loop * fps);
  const gif = GIFEncoder();
  const ctx = Object.assign(document.createElement('canvas'), { width: size, height: size })
    .getContext('2d', { willReadFrequently: true });
  scene.beginCapture(size);
  try {
    for (let i = 0; i < frames; i++) {
      const { yaw, pitch } = demoPose(i / fps, loop);
      ctx.drawImage(scene.renderPose(yaw, pitch), 0, 0);
      const { data } = ctx.getImageData(0, 0, size, size);
      const palette = quantize(data, 256);
      gif.writeFrame(applyPalette(data, palette), size, size, { palette, delay: 1000 / fps });
      onProgress?.((i + 1) / frames);
      if (i % 3 === 0) await new Promise((r) => setTimeout(r)); // keep the page responsive
    }
  } finally {
    scene.endCapture();
  }
  gif.finish();
  return { blob: new Blob([gif.bytes()], { type: 'image/gif' }), name: 'magic-qr.gif' };
}

export function videoSupported() {
  return typeof MediaRecorder !== 'undefined' && !!HTMLCanvasElement.prototype.captureStream;
}

/** Short real-time video (MP4 where the browser can, otherwise WebM). */
export async function exportVideo(scene, { size = 720, loop = 4.2, loops = 2, onProgress } = {}) {
  const types = ['video/mp4;codecs=avc1', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm'];
  const mimeType = types.find((t) => MediaRecorder.isTypeSupported(t)) || '';
  scene.beginCapture(size);
  const stream = scene.canvas.captureStream(30);
  const rec = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 6_000_000 });
  const chunks = [];
  rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  const stopped = new Promise((r) => (rec.onstop = r));
  try {
    scene.renderPose(demoPose(0, loop).yaw, demoPose(0, loop).pitch);
    rec.start();
    const total = loop * loops * 1000;
    const t0 = performance.now();
    for (;;) {
      const t = performance.now() - t0;
      if (t >= total) break;
      const { yaw, pitch } = demoPose(t / 1000, loop);
      scene.renderPose(yaw, pitch);
      onProgress?.(t / total);
      await nextFrame();
    }
    rec.stop();
    await stopped;
  } finally {
    stream.getTracks().forEach((t) => t.stop());
    scene.endCapture();
  }
  const ext = (rec.mimeType || mimeType).includes('mp4') ? 'mp4' : 'webm';
  return { blob: new Blob(chunks, { type: rec.mimeType || mimeType }), name: `magic-qr.${ext}` };
}
