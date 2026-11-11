// UI wiring: reads the settings (also from the URL), builds the scene, handles exports.
import { MagicScene, SHAPES } from './scene.js';
import { THEMES } from './themes.js';
import { makeQrMatrix } from './qr.js';
import { exportPng, exportGif, exportVideo, videoSupported, download } from './export.js';
import { STRINGS, pickLang } from './i18n.js';

const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);
const pageUrl = location.origin + location.pathname;
const pick = (value, allowed, fallback) => (allowed.includes(value) ? value : fallback);

const state = {
  text: params.get('text') || pageUrl,
  shape: pick(params.get('shape'), Object.keys(SHAPES), 'casette'),
  layout: pick(params.get('layout'), ['citta', 'sparsa'], 'citta'),
  theme: pick(params.get('theme'), Object.keys(THEMES), 'allegro'),
  seed: Number(params.get('seed')) || 7,
  lang: pickLang(params.get('lang')),
};

const scene = new MagicScene($('scene'));
const t = (key) => STRINGS[state.lang][key] ?? key;

// ---------- UI building ----------
function segmented(container, name, options, current, onChange) {
  container.innerHTML = '';
  for (const value of options) {
    const label = document.createElement('label');
    label.innerHTML = `<input type="radio" name="${name}" value="${value}"><span data-i18n="${name}.${value}"></span>`;
    const input = label.querySelector('input');
    input.checked = value === current;
    input.addEventListener('change', () => onChange(value));
    container.appendChild(label);
  }
}
segmented($('shape'), 'shape', Object.keys(SHAPES), state.shape, (v) => { state.shape = v; rebuild(); });
segmented($('layout'), 'layout', ['citta', 'sparsa'], state.layout, (v) => { state.layout = v; rebuild(); });

const themeBox = $('theme');
for (const [key, th] of Object.entries(THEMES)) {
  const label = document.createElement('label');
  label.className = 'swatch';
  label.innerHTML = `<input type="radio" name="theme" value="${key}">
    <span class="chip" style="--a:${th.walls[0]};--b:${th.walls[1]};--c:${th.walls[2]};--roof:${th.roof};--g:${th.sky || th.ground}"></span>
    <span class="name" data-i18n="theme.${key}"></span>`;
  const input = label.querySelector('input');
  input.checked = key === state.theme;
  input.addEventListener('change', () => { state.theme = key; rebuild(); });
  themeBox.appendChild(label);
}

function applyLang() {
  document.documentElement.lang = state.lang;
  document.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = t(el.dataset.i18n); });
  $('text').placeholder = t('textPlaceholder');
  document.querySelectorAll('[data-lang]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.lang === state.lang)));
  updateHint(scene.aligned);
}
document.querySelectorAll('[data-lang]').forEach((b) =>
  b.addEventListener('click', () => { state.lang = b.dataset.lang; applyLang(); syncUrl(); }));

// ---------- scene ----------
function rebuild() {
  let matrix;
  try {
    matrix = makeQrMatrix(state.text, 'H');
  } catch {
    toast(t('tooLong'));
    return;
  }
  scene.build(matrix, state);
  document.querySelector('meta[name=theme-color]').content = THEMES[state.theme].bg;
  document.body.style.setProperty('--scene-bg', THEMES[state.theme].bg);
  document.body.style.setProperty('--scene-sky', THEMES[state.theme].sky || THEMES[state.theme].bg);
  syncUrl();
}

function syncUrl() {
  const p = new URLSearchParams();
  if (state.text !== pageUrl) p.set('text', state.text);
  if (state.shape !== 'casette') p.set('shape', state.shape);
  if (state.layout !== 'citta') p.set('layout', state.layout);
  if (state.theme !== 'allegro') p.set('theme', state.theme);
  if (state.seed !== 7) p.set('seed', String(state.seed));
  if (params.has('lang') || state.lang !== pickLang()) p.set('lang', state.lang);
  const qs = p.toString();
  history.replaceState(null, '', qs ? `?${qs}` : location.pathname);
}

let typing;
$('text').value = state.text;
$('text').addEventListener('input', (e) => {
  clearTimeout(typing);
  typing = setTimeout(() => { state.text = e.target.value.trim(); rebuild(); }, 400);
});
$('shuffle').addEventListener('click', () => { state.seed = 1 + Math.floor(Math.random() * 99999); rebuild(); });

// ---------- magic view ----------
function updateHint(aligned) {
  $('hint').textContent = aligned ? t('hintAligned') : t('hintIdle');
  $('hint').classList.toggle('on', aligned);
  $('magicBtn').querySelector('[data-i18n]').textContent = aligned ? t('leave') : t('magic');
  document.body.classList.toggle('aligned', aligned);
}
scene.addEventListener('aligned', (e) => updateHint(e.detail));
$('magicBtn').addEventListener('click', () => scene.toggle());
$('scene').addEventListener('keydown', (e) => {
  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); scene.toggle(); }
});

// ---------- mobile panel ----------
const panel = $('panel');
const setPanel = (open) => {
  panel.classList.toggle('open', open);
  $('openPanel').setAttribute('aria-expanded', String(open));
};
$('openPanel').addEventListener('click', () => setPanel(!panel.classList.contains('open')));
$('closePanel').addEventListener('click', () => setPanel(false));
$('scene').addEventListener('pointerdown', () => setPanel(false));

// ---------- exports ----------
let toastTimer;
function toast(msg, ms = 2200) {
  const el = $('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  if (ms) toastTimer = setTimeout(() => el.classList.remove('show'), ms);
}
async function runExport(fn) {
  const buttons = ['png', 'gif', 'video'].map($);
  buttons.forEach((b) => (b.disabled = true));
  toast(t('working'), 0);
  try {
    download(await fn((p) => toast(`${t('working')} ${Math.round(p * 100)}%`, 0)));
    toast('✓', 1200);
  } catch (err) {
    console.error(err);
    toast(String(err.message || err));
  } finally {
    buttons.forEach((b) => (b.disabled = false));
  }
}
$('png').addEventListener('click', () => runExport(() => exportPng(scene)));
$('gif').addEventListener('click', () => runExport((onProgress) => exportGif(scene, { onProgress })));
$('video').addEventListener('click', () => {
  if (!videoSupported()) return toast(t('noVideo'));
  runExport((onProgress) => exportVideo(scene, { onProgress }));
});
$('copy').addEventListener('click', async () => {
  try { await navigator.clipboard.writeText(location.href); toast(t('copied')); }
  catch { toast(location.href, 5000); }
});

applyLang();
rebuild();

// small hook for automated tests / the README GIF
window.magicQr = { scene, state, rebuild, exportPng, exportGif, exportVideo };
