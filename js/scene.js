// The 3D scene: a little neighbourhood whose rooftops line up into a QR code
// only when seen straight from above (the "magic view").
//
// Why it works: the camera is orthographic, so a building placed anywhere along the
// vertical line over a QR module projects exactly onto that module from the top.
// From any other angle the different heights (or floating altitudes) hide the pattern.
import * as THREE from 'three';
import { THEMES } from './themes.js';
import { Decor } from './decor.js';

const TAU = Math.PI * 2;
const QUIET = 4; // QR quiet zone, in modules
const MAGIC_PITCH = Math.PI / 2;
const MIN_PITCH = THREE.MathUtils.degToRad(8);

export const SHAPES = {
  // floor: footprint of each storey; fh: storey height; roof: geometry builder; floorsMul: storeys scale
  casette: { floor: 0.78, fh: 0.55, floorsMul: 1, windows: 'house', roof: () => gableRoof(1, 0.42) },
  grattacieli: { floor: 0.88, fh: 0.42, floorsMul: 2.2, windows: 'tower', roof: () => flatRoof(1, 0.12) },
  cubi: { floor: 0.92, fh: 0.97, floorsMul: 0.8, windows: null, roof: () => flatRoof(1, 0.07) },
};

// ---------- small helpers ----------
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const easeOutBack = (t) => { const c = 1.4; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };
const clamp01 = (t) => Math.min(1, Math.max(0, t));
const wrapAngle = (a) => Math.atan2(Math.sin(a), Math.cos(a));

/** Gable roof covering exactly a w×w square (so from above it is a perfect QR module). */
function gableRoof(w, h) {
  const s = w / 2;
  const A = [-s, 0, -s], B = [s, 0, -s], C = [s, 0, s], D = [-s, 0, s];
  const R1 = [-s, h, 0], R2 = [s, h, 0];
  const tris = [
    A, R1, R2, A, R2, B, // north slope
    D, C, R2, D, R2, R1, // south slope
    A, D, R1, // west gable
    B, R2, C, // east gable
    A, B, C, A, C, D, // underside
  ];
  const roof = new THREE.BufferGeometry();
  roof.setAttribute('position', new THREE.Float32BufferAttribute(tris.flat(), 3));
  roof.computeVertexNormals();
  // a little chimney, fully inside the footprint (from above it is still one square)
  const chimney = new THREE.BoxGeometry(0.13, 0.42, 0.13).translate(0.22, h * 0.55 + 0.1, -0.2).toNonIndexed();
  const g = new THREE.BufferGeometry();
  for (const name of ['position', 'normal']) {
    const a = roof.attributes[name].array, b = chimney.attributes[name].array;
    const merged = new Float32Array(a.length + b.length);
    merged.set(a); merged.set(b, a.length);
    g.setAttribute(name, new THREE.BufferAttribute(merged, 3));
  }
  return g;
}
function flatRoof(w, h) {
  return new THREE.BoxGeometry(w, h, w).translate(0, h / 2, 0);
}

/**
 * Window textures for the walls. Returns a colour map and a mask map:
 * where the mask is white the wall gets the per-building colour, elsewhere
 * (windows, flower boxes) the texture keeps its own colours.
 */
function windowTextures(kind) {
  const make = (mask) => {
    const c = document.createElement('canvas');
    c.width = 128; c.height = 64; // left half: upper floors, right half: ground floor
    const g = c.getContext('2d');
    const paint = (color) => { g.fillStyle = mask ? '#000000' : color; };
    const detail = (color) => { if (!mask) g.fillStyle = color; return !mask; };
    g.fillStyle = '#ffffff';
    g.fillRect(0, 0, 128, 64);
    const win = (x, y, w, h) => {
      paint('#ffffff'); g.fillRect(x - 1.5, y - 1.5, w + 3, h + 3); // white frame
      paint('#ffe3a3'); g.fillRect(x, y, w, h); // warm lit glass
      if (detail('#fff4d6')) g.fillRect(x + 1.5, y + 1.5, w / 2 - 2, h / 2 - 2); // glint
    };
    const door = (x, w, h, color) => {
      paint('#ffffff'); g.fillRect(x - 2, 64 - h - 2, w + 4, h + 2);
      paint(color); g.fillRect(x, 64 - h, w, h);
      if (detail('#f3d27a')) g.fillRect(x + w - 4, 64 - h / 2, 2, 2); // knob
    };
    if (kind === 'house') {
      for (const ox of [0, 64]) {
        win(ox + 13, 17, 11, 16);
        if (ox === 0) win(40, 17, 11, 16);
        paint('#7cc47f'); // flower boxes
        g.fillRect(ox + 10, 36, 17, 5);
        if (ox === 0) g.fillRect(37, 36, 17, 5);
        if (detail('#f08aa6')) for (const x of [12, 18, 23].concat(ox === 0 ? [39, 45, 50] : [])) g.fillRect(ox + x, 34, 3, 3);
      }
      door(64 + 38, 13, 26, '#8d6a9f');
    } else {
      for (let x = 0; x < 3; x++) for (let y = 0; y < 2; y++) win(8 + x * 19, 10 + y * 30, 10, 16);
      for (let x = 0; x < 3; x++) win(64 + 8 + x * 19, 10, 10, 16);
      paint('#bfe3f2'); g.fillRect(64 + 10, 38, 44, 26); // shop window
      if (detail('#f2a49a')) for (let x = 0; x < 6; x++) g.fillRect(64 + 10 + x * 8, 34, 4, 4); // awning
      if (detail('#ffffff')) for (let x = 0; x < 6; x++) g.fillRect(64 + 14 + x * 8, 34, 4, 4);
    }
    const t = new THREE.CanvasTexture(c);
    if (!mask) t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    return t;
  };
  return { map: make(false), mask: make(true) };
}

/** Lambert material whose map is tinted by the instance colour only where the mask is white. */
function tintedWallMaterial(tex) {
  if (!tex) return new THREE.MeshLambertMaterial();
  const mat = new THREE.MeshLambertMaterial({ map: tex.map });
  mat.userData.mask = tex.mask;
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.wallMask = { value: tex.mask };
    // aGround (per instance): 0 = upper floor (left half of the atlas), 1 = ground floor (right half)
    shader.vertexShader = 'attribute float aGround;' + '\n' + shader.vertexShader.replace('#include <uv_vertex>', `
      #include <uv_vertex>
      #ifdef USE_MAP
        vMapUv.x = vMapUv.x * 0.5 + aGround * 0.5;
      #endif
    `);
    shader.fragmentShader = 'uniform sampler2D wallMask;' + '\n' + shader.fragmentShader.replace('#include <color_fragment>', `
      #if defined( USE_COLOR ) || defined( USE_INSTANCING_COLOR )
        float wallTint = texture2D( wallMask, vMapUv ).r;
        diffuseColor.rgb = mix( diffuseColor.rgb, diffuseColor.rgb * vColor, wallTint );
      #endif
    `);
  };
  mat.customProgramCacheKey = () => 'tinted-wall';
  return mat;
}

/** Soft vertical sky gradient used as background (always light, so the QR stays readable). */
function skyTexture(top, bottom) {
  const c = document.createElement('canvas');
  c.width = 2; c.height = 256;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, top);
  grad.addColorStop(1, bottom);
  g.fillStyle = grad;
  g.fillRect(0, 0, 2, 256);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// ---------- the scene ----------
export class MagicScene extends EventTarget {
  constructor(canvas) {
    super();
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

    this.scene = new THREE.Scene();
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 2000);
    this.hemi = new THREE.HemisphereLight(0xfffaf2, 0xf3dcc4, 1.9);
    this.sun = new THREE.DirectionalLight(0xfff0d8, 1.25);
    this.sun.position.set(0.55, 1, 0.3);
    this.scene.add(this.hemi, this.sun);
    this.world = new THREE.Group();
    this.scene.add(this.world);
    this.decor = new Decor(this.world);

    // camera state (radians). pitch = 90° means looking straight down = magic view.
    this.yaw = 0.75;
    this.pitch = 0.55;
    this.vYaw = 0;
    this.vPitch = 0;
    this.anim = null; // { from, to, t0, dur }
    this.mode = 'free'; // 'free' | 'magic'
    this.lastInteraction = performance.now();
    this.autoRotate = true;
    this.paused = false; // true while exporting
    this.aligned = false;

    this.buildings = [];
    this.n = 21;
    this.introStart = 0;
    this.dirty = true;

    this._bindPointer();
    this._resize = this._resize.bind(this);
    new ResizeObserver(this._resize).observe(canvas.parentElement);
    this._resize();
    this._last = performance.now();
    this.renderer.setAnimationLoop((t) => this._tick(t));
  }

  // ----- building the neighbourhood -----
  /**
   * @param {{n:number,isDark:(r:number,c:number)=>boolean}} matrix
   * @param {{shape:string, layout:'citta'|'sparsa', theme:string, seed:number}} opts
   */
  build(matrix, opts) {
    this._clear();
    const shape = SHAPES[opts.shape] || SHAPES.casette;
    const theme = THEMES[opts.theme] || THEMES.milano;
    const rnd = mulberry32(opts.seed || 1);
    const n = matrix.n;
    this.n = n;
    this.layout = opts.layout;
    this.scene.background?.dispose?.();
    this.scene.background = skyTexture(theme.sky || theme.bg, theme.bg);

    const half = n / 2;
    const maxBoost = Math.max(3, Math.round(n / 4));
    const spread = n * 0.55;
    const buildings = [];
    let totalFloors = 0;
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        if (!matrix.isDark(r, c)) continue;
        const x = c - half + 0.5;
        const z = r - half + 0.5;
        let floors, baseY;
        if (opts.layout === 'sparsa') {
          floors = 1 + (rnd() < 0.25 ? 1 : 0);
          baseY = 0.6 + rnd() * spread;
        } else {
          const d = Math.hypot(x, z) / (half * Math.SQRT2);
          floors = 1 + Math.floor(rnd() * 2.6) + Math.round(Math.pow(1 - d, 1.6) * maxBoost * rnd());
          baseY = 0;
        }
        floors = Math.max(1, Math.round(floors * shape.floorsMul));
        buildings.push({
          x, z, baseY, floors,
          color: theme.walls[Math.floor(rnd() * theme.walls.length)],
          roof: (theme.roofs || [theme.roof])[Math.floor(rnd() * (theme.roofs || [theme.roof]).length)],
          bob: rnd() * TAU,
          delay: rnd() * 0.45 + (Math.hypot(x, z) / half) * 0.25,
          floorStart: totalFloors,
        });
        totalFloors += floors;
      }
    }
    this.buildings = buildings;
    this.shape = shape;

    // storeys (one InstancedMesh for all of them)
    const floorGeo = new THREE.BoxGeometry(shape.floor, shape.fh * (shape.windows ? 1 : 0.97), shape.floor);
    const floorMat = tintedWallMaterial(shape.windows ? windowTextures(shape.windows) : null);
    this.floors = new THREE.InstancedMesh(floorGeo, floorMat, Math.max(1, totalFloors));
    const col = new THREE.Color();
    const ground = new Float32Array(Math.max(1, totalFloors));
    for (const b of buildings) {
      col.set(b.color);
      for (let k = 0; k < b.floors; k++) this.floors.setColorAt(b.floorStart + k, col);
      if (opts.layout !== 'sparsa') ground[b.floorStart] = 1; // doors only for houses standing on the ground
    }
    floorGeo.setAttribute('aGround', new THREE.InstancedBufferAttribute(ground, 1));
    // roofs = the QR modules: always DARK (a theme may mix a few dark colours)
    const roofMat = new THREE.MeshLambertMaterial();
    this.roofs = new THREE.InstancedMesh(shape.roof(), roofMat, Math.max(1, buildings.length));
    buildings.forEach((b, i) => this.roofs.setColorAt(i, col.set(b.roof)));
    for (const m of [this.floors, this.roofs]) {
      m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      m.frustumCulled = false;
      this.world.add(m);
    }

    // ground slab = white background + quiet zone of the QR
    if (opts.layout !== 'sparsa') {
      const size = n + QUIET * 2;
      const side = new THREE.MeshLambertMaterial({ color: theme.groundSide });
      const top = new THREE.MeshBasicMaterial({ color: theme.ground }); // unlit: stays light for scanning
      this.ground = new THREE.Mesh(new THREE.BoxGeometry(size, 0.8, size), [side, side, top, side, side, side]);
      this.ground.position.y = -0.4;
      this.world.add(this.ground);
    }

    // height used to centre the orbit
    let maxY = 0;
    for (const b of buildings) maxY = Math.max(maxY, b.baseY + b.floors * shape.fh + 0.5);
    this.centerY = maxY / 2;
    this.decor.build(matrix, { layout: opts.layout, rnd, maxY });
    this.introStart = performance.now();
    this._writeMatrices(0);
    this._fitCamera();
    this.dirty = true;
  }

  _clear() {
    for (const obj of [this.floors, this.roofs, this.ground]) {
      if (!obj) continue;
      this.world.remove(obj);
      obj.geometry.dispose();
      for (const m of [].concat(obj.material)) { m.map?.dispose(); m.userData.mask?.dispose(); m.dispose(); }
      obj.dispose?.();
    }
    this.floors = this.roofs = this.ground = null;
  }

  /**
   * @param {number} t seconds since the build started (drives the "pop-in" animation)
   * @param {number} now performance.now(), for the hop and the floating bob
   */
  _writeMatrices(t, now = performance.now()) {
    const hopT = this.hopStart ? (now - this.hopStart) / 1000 : -1;
    const bobbing = this.layout === 'sparsa' && !this.paused;
    const m = new THREE.Matrix4();
    const p = new THREE.Vector3();
    const q = new THREE.Quaternion();
    const s = new THREE.Vector3();
    const fh = this.shape.fh;
    let done = true;
    for (let i = 0; i < this.buildings.length; i++) {
      const b = this.buildings[i];
      const k = clamp01((t - b.delay) / 0.55);
      if (k < 1) done = false;
      const e = k <= 0 ? 0 : easeOutBack(k);
      let drop = (1 - clamp01(k * 1.4)) * 6;
      // vertical moves never change the top view, so the QR stays readable while houses dance
      if (hopT >= 0) {
        const h = clamp01((hopT - Math.hypot(b.x, b.z) * 0.035) / 0.42);
        drop += Math.sin(h * Math.PI) * 0.9;
      }
      if (bobbing) drop += Math.sin(now / 900 + b.bob) * 0.25;
      const sc = Math.max(0.0001, e);
      s.set(sc, sc, sc);
      for (let f = 0; f < b.floors; f++) {
        p.set(b.x, b.baseY + drop + (f + 0.5) * fh * sc, b.z);
        m.compose(p, q, s);
        this.floors.setMatrixAt(b.floorStart + f, m);
      }
      p.set(b.x, b.baseY + drop + b.floors * fh * sc, b.z);
      m.compose(p, q, s);
      this.roofs.setMatrixAt(i, m);
    }
    this.floors.instanceMatrix.needsUpdate = true;
    this.roofs.instanceMatrix.needsUpdate = true;
    return done;
  }

  // ----- camera -----
  _resize() {
    const el = this.canvas.parentElement;
    const w = Math.max(1, el.clientWidth);
    const h = Math.max(1, el.clientHeight);
    this.renderer.setSize(w, h, true);
    this.viewW = w;
    this.viewH = h;
    this._fitCamera();
    this.dirty = true;
  }

  _fitCamera(w = this.viewW, h = this.viewH) {
    // the QR + quiet zone must fit the shorter side of the screen
    const half = (this.n + QUIET * 2) / 2 * 1.04;
    const aspect = w / h;
    const cam = this.camera;
    if (aspect >= 1) { cam.top = half; cam.bottom = -half; cam.right = half * aspect; cam.left = -half * aspect; }
    else { cam.right = half; cam.left = -half; cam.top = half / aspect; cam.bottom = -half / aspect; }
    // when tilted the square base shows its diagonal: on narrow screens zoom out more
    this.zoomTilted = aspect < 1.15 ? 0.72 : 0.86;
    cam.updateProjectionMatrix();
  }

  /** How close we are to the magic view: 0 = far, 1 = exactly there. */
  get magicness() {
    const dp = MAGIC_PITCH - this.pitch;
    return clamp01(1 - dp / (MAGIC_PITCH - MIN_PITCH));
  }

  _applyCamera() {
    const cam = this.camera;
    cam.quaternion.setFromEuler(new THREE.Euler(-this.pitch, this.yaw, 0, 'YXZ'));
    const back = new THREE.Vector3(0, 0, 1).applyQuaternion(cam.quaternion);
    cam.position.set(0, this.centerY || 0, 0).addScaledVector(back, 500);
    // zoom out a bit when tilted so tall buildings stay on screen; full size at the magic view
    const zoom = THREE.MathUtils.lerp(this.zoomTilted || 0.86, 1, Math.pow(this.magicness, 3));
    if (Math.abs(cam.zoom - zoom) > 1e-5) { cam.zoom = zoom; cam.updateProjectionMatrix(); }
    this.decorVisible = this.decor.update(this.magicness, performance.now());
  }

  /** Smoothly rotate to the magic view (QR upright). */
  goMagic(duration = 1.3) {
    const target = this.yaw - wrapAngle(this.yaw); // nearest multiple of 2π
    this._animateTo(target, MAGIC_PITCH, duration, 'magic');
    if (this.pitch < MAGIC_PITCH - 0.4) this.hopStart = performance.now() + duration * 450; // a happy hop near the end
  }

  /** Leave the magic view towards a nice 3/4 view. */
  release(duration = 1.1) {
    this._animateTo(this.yaw + 0.8, 0.55, duration, 'free');
  }

  toggle() {
    if (this.mode === 'magic' || (this.anim && this.anim.mode === 'magic')) this.release();
    else this.goMagic();
  }

  _animateTo(yaw, pitch, dur, mode) {
    this.vYaw = this.vPitch = 0;
    this.anim = { fromYaw: this.yaw, fromPitch: this.pitch, yaw, pitch, t0: performance.now(), dur: dur * 1000, mode };
    this.mode = 'free';
    this.lastInteraction = performance.now();
  }

  /** Set the camera directly (used by exporters). */
  setPose(yaw, pitch) {
    this.yaw = yaw;
    this.pitch = pitch;
    this._applyCamera();
  }

  // ----- input -----
  _bindPointer() {
    const el = this.canvas;
    let down = null;
    let lastX = 0, lastY = 0, lastT = 0;
    el.addEventListener('pointerdown', (e) => {
      if (down || this.paused) return;
      el.setPointerCapture(e.pointerId);
      down = { id: e.pointerId, x: e.clientX, y: e.clientY, t: performance.now(), moved: 0 };
      lastX = e.clientX; lastY = e.clientY; lastT = down.t;
      this.vYaw = this.vPitch = 0;
      this.lastInteraction = down.t;
    });
    el.addEventListener('pointermove', (e) => {
      if (!down || e.pointerId !== down.id) return;
      const dx = e.clientX - lastX, dy = e.clientY - lastY;
      const now = performance.now();
      down.moved += Math.abs(dx) + Math.abs(dy);
      if (down.moved > 6) {
        if (this.anim) this.anim = null;
        this.mode = 'free';
        const k = 3.4 / Math.min(this.viewW, this.viewH);
        this.yaw -= dx * k;
        this.pitch = THREE.MathUtils.clamp(this.pitch + dy * k, MIN_PITCH, MAGIC_PITCH);
        const dt = Math.max(1, now - lastT) / 1000;
        this.vYaw = (-dx * k) / dt;
        this.vPitch = (dy * k) / dt;
        this.dirty = true;
      }
      lastX = e.clientX; lastY = e.clientY; lastT = now;
      this.lastInteraction = now;
    });
    const up = (e) => {
      if (!down || e.pointerId !== down.id) return;
      const isTap = down.moved <= 6 && performance.now() - down.t < 400;
      if (isTap) this.toggle();
      else {
        if (performance.now() - lastT > 80) this.vYaw = this.vPitch = 0; // finger stopped before release
        // released close to the top: help the user and snap to the (upright) magic view
        if (this.pitch > MAGIC_PITCH - 0.3 && this.vPitch >= -0.2) this.goMagic(0.7);
      }
      down = null;
      this.lastInteraction = performance.now();
    };
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
  }

  // ----- loop -----
  _tick(now) {
    const dt = Math.min(0.05, (now - this._last) / 1000);
    this._last = now;
    if (this.paused) return;
    let changed = this.dirty;

    const hopping = this.hopStart && now > this.hopStart;
    if (this.hopStart && now - this.hopStart > 2200) this.hopStart = 0;
    if (this.buildings.length && (this.introStart || hopping || this.layout === 'sparsa')) {
      const done = this._writeMatrices(this.introStart ? (now - this.introStart) / 1000 : 1e3, now);
      if (done) this.introStart = 0;
      changed = true;
    }

    if (this.decorVisible) changed = true; // clouds and balloons keep drifting

    if (this.anim) {
      const a = this.anim;
      const k = clamp01((now - a.t0) / a.dur);
      const e = easeInOutCubic(k);
      this.yaw = a.fromYaw + (a.yaw - a.fromYaw) * e;
      this.pitch = a.fromPitch + (a.pitch - a.fromPitch) * e;
      if (k >= 1) { this.mode = a.mode; this.anim = null; this.lastInteraction = now; }
      changed = true;
    } else if (Math.abs(this.vYaw) > 1e-3 || Math.abs(this.vPitch) > 1e-3) {
      // inertia after a flick
      this.yaw += this.vYaw * dt;
      this.pitch = THREE.MathUtils.clamp(this.pitch + this.vPitch * dt, MIN_PITCH, MAGIC_PITCH);
      if (this.pitch >= MAGIC_PITCH - 1e-3 && this.vPitch > 0) this.goMagic(0.7);
      const damp = Math.exp(-4 * dt);
      this.vYaw *= damp;
      this.vPitch *= damp;
      changed = true;
    } else if (this.autoRotate && this.mode === 'free' && now - this.lastInteraction > 3500) {
      this.yaw += 0.18 * dt;
      changed = true;
    }

    const aligned = !this.anim && this.pitch > MAGIC_PITCH - 0.02 && Math.abs(wrapAngle(this.yaw)) < 0.06;
    if (aligned !== this.aligned) {
      this.aligned = aligned;
      if (aligned) this.mode = 'magic';
      this.dispatchEvent(new CustomEvent('aligned', { detail: aligned }));
    }

    if (changed) {
      this._applyCamera();
      this.renderer.render(this.scene, this.camera);
      this.dirty = false;
    }
  }

  /** Render one frame at a fixed square size (for exports). Caller must restore with endCapture(). */
  beginCapture(size) {
    this.paused = true;
    this.introStart = 0;
    this.hopStart = 0;
    this._writeMatrices(1e3);
    this._saved = { yaw: this.yaw, pitch: this.pitch, ratio: this.renderer.getPixelRatio() };
    this.renderer.setPixelRatio(1);
    this.renderer.setSize(size, size, false);
    this._fitCamera(size, size);
  }
  renderPose(yaw, pitch) {
    this.setPose(yaw, pitch);
    this.renderer.render(this.scene, this.camera);
    return this.canvas;
  }
  endCapture() {
    const s = this._saved;
    this.renderer.setPixelRatio(s.ratio);
    this.yaw = s.yaw;
    this.pitch = s.pitch;
    this.paused = false;
    this._last = performance.now();
    this._resize();
  }
}

/** Camera path used by the GIF/video exports: 3/4 view → magic view → hold → back. */
export function demoPose(t, loop = 4.2) {
  const A = { yaw: 0.85, pitch: 0.5 };
  const u = (t % loop) / loop;
  let k;
  if (u < 0.12) k = 0;
  else if (u < 0.45) k = easeInOutCubic((u - 0.12) / 0.33);
  else if (u < 0.75) k = 1;
  else k = 1 - easeInOutCubic((u - 0.75) / 0.25);
  // while tilted the scene also turns a little, so the "3D-ness" is obvious
  const spin = 0.35 * Math.sin(u * TAU);
  return { yaw: (A.yaw + spin) * (1 - k), pitch: A.pitch + (MAGIC_PITCH - A.pitch) * k };
}
