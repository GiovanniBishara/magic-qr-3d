// Decorations that make the 3D view lively: trees, clouds and hot-air balloons.
// They shrink away as the camera approaches the magic view, so they never
// cover the QR code (at the magic view they are completely hidden).
import * as THREE from 'three';

const QUIET = 4;
const TREE_GREENS = ['#7cc47f', '#5fae6e', '#9ad18b', '#6fbf9a'];
const BALLOON_COLORS = ['#f4a493', '#f6cf7e', '#9fd8c8', '#a9c9ec', '#f2b8cf', '#cbb8ea'];

const smooth = (t) => t * t * (3 - 2 * t);
const clamp01 = (t) => Math.min(1, Math.max(0, t));

function stripedBalloonGeometry() {
  // a slightly pear-shaped envelope with vertical stripes (vertex colours: white / tint)
  const g = new THREE.SphereGeometry(0.55, 12, 8);
  const pos = g.attributes.position;
  const colors = [];
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    if (y < 0) { pos.setX(i, pos.getX(i) * (1 + y * 0.9)); pos.setZ(i, pos.getZ(i) * (1 + y * 0.9)); }
    const a = Math.atan2(pos.getZ(i), pos.getX(i));
    const stripe = Math.floor(((a + Math.PI) / (Math.PI * 2)) * 12) % 2;
    colors.push(...(stripe ? [1, 1, 1] : [0.82, 0.82, 0.82]));
  }
  g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  g.computeVertexNormals();
  return g.toNonIndexed();
}

export class Decor {
  constructor(parent) {
    this.group = new THREE.Group();
    parent.add(this.group);
    this.items = []; // { mesh, list: [{ pos, scale, phase, drift? }] }
  }

  dispose() {
    for (const { mesh } of this.items) {
      this.group.remove(mesh);
      mesh.geometry.dispose();
      mesh.material.dispose();
      mesh.dispose();
    }
    this.items = [];
  }

  /**
   * @param {{n:number,isDark:(r:number,c:number)=>boolean}} matrix
   * @param {{layout:string, rnd:()=>number, maxY:number}} o
   */
  build(matrix, { layout, rnd, maxY }) {
    this.dispose();
    const n = matrix.n;
    const half = n / 2;
    this.startedAt = performance.now();

    // --- trees on the light cells and on the white border (city only) ---
    if (layout !== 'sparsa') {
      const trees = [];
      for (let r = -QUIET + 1; r < n + QUIET - 1; r++) {
        for (let c = -QUIET + 1; c < n + QUIET - 1; c++) {
          const inside = r >= 0 && c >= 0 && r < n && c < n;
          if (inside && matrix.isDark(r, c)) continue;
          if (rnd() > (inside ? 0.1 : 0.22)) continue;
          trees.push({
            x: c - half + 0.5 + (rnd() - 0.5) * 0.3,
            z: r - half + 0.5 + (rnd() - 0.5) * 0.3,
            h: 0.45 + rnd() * 0.45,
            color: TREE_GREENS[Math.floor(rnd() * TREE_GREENS.length)],
            delay: rnd() * 0.5,
          });
        }
      }
      const trunk = new THREE.CylinderGeometry(0.05, 0.07, 1, 6).translate(0, 0.5, 0);
      const crown = new THREE.IcosahedronGeometry(0.32, 0);
      const trunks = new THREE.InstancedMesh(trunk, new THREE.MeshLambertMaterial({ color: '#a77b58' }), Math.max(1, trees.length));
      const crowns = new THREE.InstancedMesh(crown, new THREE.MeshLambertMaterial({ flatShading: true }), Math.max(1, trees.length));
      const col = new THREE.Color();
      trees.forEach((t, i) => crowns.setColorAt(i, col.set(t.color)));
      this._add(trunks, trees.map((t) => ({ ...t, kind: 'trunk' })));
      this._add(crowns, trees.map((t) => ({ ...t, kind: 'crown' })));
    }

    // --- clouds drifting above the town ---
    const clouds = [];
    const cloudCount = 4 + Math.floor(rnd() * 3);
    const span = n + QUIET * 2;
    for (let i = 0; i < cloudCount; i++) {
      const cx = (rnd() - 0.5) * span;
      const cz = (rnd() - 0.5) * span;
      const cy = maxY + 1.5 + rnd() * 3;
      const size = 1.1 + rnd() * 0.9;
      const speed = 0.25 + rnd() * 0.35;
      const puffs = 3 + Math.floor(rnd() * 3);
      for (let p = 0; p < puffs; p++) {
        clouds.push({
          x: cx + (p - puffs / 2) * 0.75 * size, y: cy + rnd() * 0.3 * size, z: cz + (rnd() - 0.5) * 0.6 * size,
          s: size * (0.7 + rnd() * 0.5), speed, span, delay: 0.4 + rnd() * 0.4, kind: 'cloud',
        });
      }
    }
    const puff = new THREE.IcosahedronGeometry(0.6, 1);
    this._add(new THREE.InstancedMesh(puff, new THREE.MeshLambertMaterial({ color: '#ffffff', flatShading: true }), clouds.length), clouds);

    // --- hot-air balloons ---
    const balloons = [];
    const balloonCount = layout === 'sparsa' ? 4 : 2;
    for (let i = 0; i < balloonCount; i++) {
      const a = rnd() * Math.PI * 2;
      const rad = half * (0.6 + rnd() * 0.5);
      balloons.push({
        x: Math.cos(a) * rad, z: Math.sin(a) * rad,
        y: (layout === 'sparsa' ? maxY * 0.4 : maxY + 0.5) + rnd() * 2.5,
        color: BALLOON_COLORS[Math.floor(rnd() * BALLOON_COLORS.length)],
        phase: rnd() * Math.PI * 2, delay: 0.6 + rnd() * 0.4,
      });
    }
    const envelopes = new THREE.InstancedMesh(stripedBalloonGeometry(), new THREE.MeshLambertMaterial({ vertexColors: true }), balloonCount);
    const col = new THREE.Color();
    balloons.forEach((b, i) => envelopes.setColorAt(i, col.set(b.color)));
    const basket = new THREE.BoxGeometry(0.22, 0.18, 0.22);
    const baskets = new THREE.InstancedMesh(basket, new THREE.MeshLambertMaterial({ color: '#9b6b45' }), balloonCount);
    this._add(envelopes, balloons.map((b) => ({ ...b, kind: 'envelope' })));
    this._add(baskets, balloons.map((b) => ({ ...b, kind: 'basket' })));
  }

  _add(mesh, list) {
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.frustumCulled = false;
    this.group.add(mesh);
    this.items.push({ mesh, list });
  }

  /**
   * @param {number} magicness 0 = far from the magic view, 1 = magic view
   * @param {number} now performance.now()
   * @returns {boolean} true if something is visible (and animating)
   */
  update(magicness, now) {
    // fully gone well before the magic view (pitch ≈ 84°)
    const visible = smooth(clamp01((0.93 - magicness) / 0.3));
    this.group.visible = visible > 0.001;
    if (!this.group.visible) return false;
    const t = (now - (this.startedAt || now)) / 1000;
    const m = new THREE.Matrix4();
    const p = new THREE.Vector3();
    const q = new THREE.Quaternion();
    const s = new THREE.Vector3();
    for (const { mesh, list } of this.items) {
      list.forEach((d, i) => {
        const k = visible * smooth(clamp01((t - d.delay) / 0.6));
        switch (d.kind) {
          case 'trunk':
            p.set(d.x, 0, d.z); s.set(k, d.h * k, k); break;
          case 'crown':
            p.set(d.x, d.h * k + 0.15 * k, d.z); s.setScalar(k * (0.9 + d.h * 0.4)); break;
          case 'cloud': {
            const x = ((d.x + t * d.speed + d.span / 2) % d.span + d.span) % d.span - d.span / 2;
            p.set(x, d.y, d.z); s.set(d.s * k, d.s * 0.7 * k, d.s * k); break;
          }
          case 'envelope':
          case 'basket': {
            const bob = Math.sin(t * 0.8 + d.phase) * 0.35;
            const drift = Math.sin(t * 0.15 + d.phase) * 1.2;
            const y = d.y + bob + (d.kind === 'basket' ? -1.15 * k : 0);
            p.set(d.x + drift, y, d.z); s.setScalar(k * 1.5); break;
          }
        }
        m.compose(p, q, s.set(Math.max(s.x, 1e-4), Math.max(s.y, 1e-4), Math.max(s.z, 1e-4)));
        mesh.setMatrixAt(i, m);
      });
      mesh.instanceMatrix.needsUpdate = true;
    }
    return true;
  }
}
