import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

const root = document.documentElement;
const MOBILE = Math.min(innerWidth, innerHeight) < 700 || innerWidth < 900;
const COLS = MOBILE ? 22 : 32, ROWS = MOBILE ? 20 : 24, N = COLS * ROWS;
const hex = (h) => new THREE.Color(h);
const P = {
  floor: hex('#1d1d1d'), quiet: hex('#181818'), clay: hex('#e6e3dc'), grey: hex('#6f6d69'), blue: hex('#7d97ff'),
  ripple: hex('#4a4a48'), path: hex('#2b2b2b'), oak: hex('#7d5f42'), walnut: hex('#5a3e2b'), linen: hex('#e2dccf'),
  sofa: hex('#7b7f73'), marble: hex('#ece9e3'), leaf: hex('#5f7d4f'), slate: hex('#3f4247'), steel: hex('#a3a5a8'),
  darksteel: hex('#4d4e52'), sandstone: hex('#c2a883'), plastic: hex('#efede8'),
};

const canvas = document.createElement('canvas');
canvas.className = 'world-canvas';
canvas.setAttribute('aria-hidden', 'true');
document.body.prepend(canvas);

const renderer = new THREE.WebGLRenderer({ canvas, antialias: !MOBILE, alpha: true, powerPreference: MOBILE ? 'low-power' : 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, MOBILE ? 1.25 : 1.5));
renderer.shadowMap.enabled = !MOBILE;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.AgXToneMapping;
renderer.toneMappingExposure = 1.2;

const scene = new THREE.Scene();
const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 200);
scene.add(new THREE.HemisphereLight('#ffffff', '#151515', 1.0));
const sun = new THREE.DirectionalLight('#ffffff', 2.8);
sun.position.set(-12, 24, 9);
sun.castShadow = !MOBILE;
sun.shadow.mapSize.set(MOBILE ? 1024 : 2048, MOBILE ? 1024 : 2048);
Object.assign(sun.shadow.camera, { left: -24, right: 24, top: 24, bottom: -24, near: 1, far: 80 });
sun.shadow.bias = -0.0005;
scene.add(sun);

function stoneTexture() {
  const size = 256, c = document.createElement('canvas'); c.width = c.height = size;
  const g = c.getContext('2d'), img = g.createImageData(size, size);
  let r = 3; const rnd = () => (r = (r * 16807) % 2147483647) / 2147483647;
  const blot = new Float32Array(size * size);
  for (let k = 0; k < 90; k++) {
    const bx = rnd() * size, by = rnd() * size, br = 8 + rnd() * 30, v = (rnd() - 0.5) * 0.25;
    for (let y = -br; y < br; y++) for (let x = -br; x < br; x++) {
      const d = Math.hypot(x, y) / br; if (d > 1) continue;
      const px = ((bx + x) % size + size) % size | 0, py = ((by + y) % size + size) % size | 0;
      blot[py * size + px] += v * (1 - d * d);
    }
  }
  for (let i = 0; i < size * size; i++) {
    const grain = (rnd() - 0.5) * 0.22, speck = rnd() < 0.015 ? -0.35 : 0;
    const v = Math.max(0, Math.min(255, 255 * (0.82 + blot[i] + grain + speck)));
    img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v; img.data[i * 4 + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}
const stone = stoneTexture();
const rough = stone.clone(); rough.colorSpace = THREE.NoColorSpace;
const geo = new RoundedBoxGeometry(0.9, 1, 0.9, 2, 0.08);
geo.translate(0, 0.5, 0);
const tiles = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ map: stone, roughnessMap: rough, roughness: 1.0 }), N);
tiles.castShadow = tiles.receiveShadow = !MOBILE;
tiles.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
scene.add(tiles);

const cx = (COLS - 1) / 2, cz = (ROWS - 1) / 2;
const I = (c, r) => r * COLS + c;
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const sm = (v) => { v = clamp01(v); return v * v * (3 - 2 * v); };
let seed = 11;
const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
function each(c0, c1, r0, r1, fn) {
  for (let c = Math.max(0, c0); c <= Math.min(COLS - 1, c1); c++)
    for (let r = Math.max(0, r0); r <= Math.min(ROWS - 1, r1); r++) fn(I(c, r), c, r);
}
const tmp = new THREE.Color();

const broken = Array.from({ length: N }, () => rand() < 0.09);
const phase = Float32Array.from({ length: N }, () => rand() * Math.PI * 2);
const glow = new Float32Array(N);

const F = { kind: new Uint8Array(N), order: new Float32Array(N), h: new Float32Array(N), col: new Array(N).fill(P.floor) };
{
  const x0 = Math.round(COLS * 0.14), x1 = Math.round(COLS * 0.86) - 1;
  const z0 = Math.round(ROWS * 0.1), z1 = Math.round(ROWS * 0.9) - 1;
  const X = (f) => x0 + Math.round(f * (x1 - x0)), Z = (f) => z0 + Math.round(f * (z1 - z0));
  each(x0, x1, z0, z1, (i) => { F.kind[i] = 1; });
  const wall = (a0, a1, b0, b1) => each(X(a0), X(a1), Z(b0), Z(b1), (i, c, r) => {
    F.kind[i] = 2; F.order[i] = (c - x0 + r - z0) / (x1 - x0 + z1 - z0);
  });
  const gap = (a0, a1, b0, b1) => each(X(a0), X(a1), Z(b0), Z(b1), (i) => { F.kind[i] = 1; });
  wall(0, 1, 0, 0); wall(0, 1, 1, 1); wall(0, 0, 0, 1); wall(1, 1, 0, 1);
  wall(0.62, 0.62, 0, 1); gap(0.62, 0.62, 0.42, 0.56);
  wall(0, 0.28, 0.68, 0.68); wall(0.28, 0.28, 0.68, 1); gap(0.28, 0.28, 0.8, 0.9);
  gap(0.12, 0.2, 0, 0);
  const furniture = [
    [0.06, 0.5, 0.16, 0.5, 0.07, P.blue],
    [0.06, 0.5, 0.05, 0.12, 0.45, P.sofa],
    [0.2, 0.36, 0.26, 0.38, 0.3, P.walnut],
    [0.44, 0.54, 0.2, 0.32, 0.42, P.sofa],
    [0.34, 0.58, 0.9, 0.96, 0.82, P.marble],
    [0.36, 0.54, 0.64, 0.78, 0.6, P.walnut],
    [0.7, 0.94, 0.56, 0.88, 0.45, P.linen],
    [0.7, 0.94, 0.92, 0.96, 0.9, P.walnut],
    [0.72, 0.94, 0.05, 0.14, 0.66, P.oak],
    [0.54, 0.58, 0.05, 0.1, 0.75, P.leaf],
    [0.04, 0.2, 0.74, 0.94, 0.45, P.marble],
  ];
  furniture.forEach(([a0, a1, b0, b1, h, col], k) => each(X(a0), X(a1), Z(b0), Z(b1), (i) => {
    if (F.kind[i] === 2) return;
    F.kind[i] = 3; F.h[i] = h; F.col[i] = col; F.order[i] = k / furniture.length;
  }));
}
function flur(i, t, time, out) {
  const plan = sm(t / 0.26), floorTone = sm((t - 0.3) / 0.25);
  switch (F.kind[i]) {
    case 0: out.h = 0.06; out.c.copy(P.floor); break;
    case 1: out.h = 0.08; out.c.copy(P.floor).lerp(P.oak, floorTone * 0.85); break;
    case 2: {
      const w = sm((t - 0.22 - F.order[i] * 0.14) / 0.22);
      out.h = 0.09 + w * 1.35;
      out.c.copy(P.floor).lerp(P.blue, plan).lerp(P.clay, sm(w * 1.6));
      break;
    }
    case 3: {
      const f = sm((t - 0.5 - F.order[i] * 0.34) / 0.1);
      out.h = 0.08 + f * (F.h[i] - 0.08);
      out.lift = f > 0 && f < 1 ? (1 - f) * 1.4 : 0;
      out.c.copy(P.floor).lerp(P.oak, floorTone * 0.85).lerp(F.col[i], f);
      break;
    }
  }
}

const H = { block: new Int16Array(N).fill(-1), bcol: new Float32Array(N), bad: [], minC: 0, maxC: 0 };
{
  let b = 0, first = true;
  for (let bc = Math.round(COLS * 0.08); bc + 1 <= Math.round(COLS * 0.92); bc += 3) {
    for (let br = Math.round(ROWS * 0.1); br + 1 <= Math.round(ROWS * 0.9); br += 3) {
      H.bad[b] = rand() < 0.22;
      each(bc, bc + 1, br, br + 1, (i) => { H.block[i] = b; H.bcol[i] = bc; });
      b++;
    }
    if (first) { H.minC = bc; first = false; }
    H.maxC = bc;
  }
}
function horizon(i, t, time, out, c) {
  const scanT = clamp01((t - 0.28) / 0.55);
  const scanX = H.minC - 2 + scanT * (H.maxC - H.minC + 6);
  const scanning = t > 0.27 && t < 0.84;
  const b = H.block[i];
  if (b < 0) {
    out.h = 0.06; out.c.copy(P.floor);
  } else {
    const colFrac = (H.bcol[i] - H.minC) / Math.max(1, H.maxC - H.minC);
    const a = sm((t - colFrac * 0.18) / 0.1);
    const passed = sm((scanX - H.bcol[i]) / 2);
    out.h = 0.06 + a * 0.66;
    out.c.copy(P.floor).lerp(P.grey, a);
    if (H.bad[b]) {
      out.c.lerp(P.blue, passed);
      out.lift = passed * (0.55 + Math.sin(time * 2 + b) * 0.05);
    } else {
      out.c.lerp(P.clay, passed * 0.9);
    }
  }
  if (scanning && Math.abs(c - scanX) < 0.7) { out.h += 0.14; out.c.lerp(P.blue, 0.7); }
}

const Bz = {
  kind: new Uint8Array(N), idx: new Int8Array(N).fill(-1), h: new Float32Array(N), col: new Array(N).fill(P.floor),
  pathId: new Int8Array(N).fill(-1), pathT: new Float32Array(N), towers: [], term: null, wallet: null,
};
{
  const wc0 = Math.round(COLS * 0.46) - 1, wr0 = Math.round(ROWS * 0.5) - 1;
  Bz.wallet = { c: wc0 + 1, r: wr0 + 1 };
  each(wc0, wc0 + 2, wr0, wr0 + 2, (i) => { Bz.kind[i] = 2; });
  const heights = [1.3, 1.9, 1.1, 1.6, 2.2, 1.4];
  const cols = [P.slate, P.marble, P.darksteel, P.sandstone, P.steel, P.walnut];
  for (let k = 0; k < 6; k++) {
    const a = Math.PI * (0.1 + 0.8 * (k / 5));
    const tc = Math.round(cx - Math.cos(a) * COLS * 0.38), tr = Math.round(ROWS * 0.52 + Math.sin(a) * ROWS * 0.36);
    each(tc - 1, tc, tr - 1, tr, (i) => { Bz.kind[i] = 1; Bz.idx[i] = k; Bz.h[i] = heights[k]; Bz.col[i] = cols[k]; });
    Bz.towers.push({ c: tc - 0.5, r: tr - 0.5, tile: I(tc, tr) });
  }
  const tc = Math.round(COLS * 0.72), tr = Math.round(ROWS * 0.18);
  each(tc, tc + 1, tr, tr, (i) => { Bz.kind[i] = 3; });
  Bz.term = { c: tc + 0.5, r: tr, tile: I(tc, tr) };
  const mark = (from, to, id) => {
    const vx = to.c - from.c, vz = to.r - from.r, L2 = vx * vx + vz * vz;
    for (let i = 0; i < N; i++) {
      if (Bz.kind[i]) continue;
      const c = i % COLS, r = (i / COLS) | 0;
      const tt = ((c - from.c) * vx + (r - from.r) * vz) / L2;
      if (tt < 0 || tt > 1) continue;
      if (Math.hypot(c - (from.c + vx * tt), r - (from.r + vz * tt)) < 0.55) { Bz.pathId[i] = id; Bz.pathT[i] = tt; }
    }
  };
  Bz.towers.forEach((tw, k) => mark(tw, Bz.wallet, k));
  mark(Bz.wallet, Bz.term, 6);
}
function bitzaro(i, t, time, out, c, r) {
  const k = Bz.kind[i];
  if (k === 1) {
    const rise = sm((t - Bz.idx[i] * 0.03) / 0.18);
    out.h = 0.06 + rise * (Bz.h[i] - 0.06);
    out.c.copy(P.floor).lerp(Bz.col[i], rise);
    return;
  }
  if (k === 2) {
    let arrived = 0;
    for (let p = 0; p < 6; p++) if (t > 0.58 + p * 0.045) arrived++;
    const rise = sm((t - 0.08) / 0.16);
    out.h = 0.06 + rise * (0.8 + arrived * 0.09);
    out.c.copy(P.floor).lerp(P.steel, rise);
    return;
  }
  if (k === 3) {
    const rise = sm((t - 0.12) / 0.16), paid = sm((t - 0.86) / 0.05);
    out.h = 0.06 + rise * 0.64;
    out.c.copy(P.floor).lerp(P.plastic, rise).lerp(P.blue, paid * 0.85);
    return;
  }
  out.h = 0.06; out.c.copy(P.floor);
  const id = Bz.pathId[i];
  if (id >= 0) {
    out.c.lerp(P.path, sm((t - 0.2) / 0.1));
    const start = id === 6 ? 0.68 : 0.3 + id * 0.045, len = id === 6 ? 0.17 : 0.28;
    const pt = (t - start) / len;
    let g = 0;
    if (pt > 0 && pt < 1.05) g = Math.exp(-((Bz.pathT[i] - pt) ** 2) / 0.006);
    if (t > 0.9) g = Math.max(g, 0.55 * Math.exp(-((Bz.pathT[i] - ((time * 0.35 + id * 0.17) % 1)) ** 2) / 0.006));
    out.h += g * 0.32; out.c.lerp(P.blue, clamp01(g * 1.2));
  }
  if (t > 0.86) {
    const d = Math.hypot(c - Bz.term.c, r - Bz.term.r);
    const grow = clamp01((t - 0.86) / 0.14);
    let ring = Math.exp(-((d - grow * 7) ** 2) / 0.8) * (1 - grow * 0.5);
    const loop = (time * 4) % 9;
    ring = Math.max(ring, 0.5 * Math.exp(-((d - loop) ** 2) / 0.8) * (1 - loop / 9) * sm((t - 0.92) / 0.05));
    out.h += ring * 0.28; out.c.lerp(P.blue, clamp01(ring * 0.7));
  }
}
const sceneFns = [flur, horizon, bitzaro];

const pointer = { x: 0, z: 0, seen: 0, vx: 0, vz: 0, speed: 0, t: 0 };
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), hit = new THREE.Vector3();
const ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
function project(e) {
  ndc.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  return ray.ray.intersectPlane(ground, hit);
}
const aim = (e) => {
  if (!project(e)) return;
  const now = performance.now(), gap = (now - pointer.t) / 1000;
  if (gap > 0.004 && gap < 0.25) {
    const k = 0.35;
    pointer.vx += ((hit.x - pointer.x) / gap - pointer.vx) * k;
    pointer.vz += ((hit.z - pointer.z) / gap - pointer.vz) * k;
  } else { pointer.vx = 0; pointer.vz = 0; }
  pointer.x = hit.x; pointer.z = hit.z; pointer.seen = now; pointer.t = now;
};
addEventListener('pointermove', aim, { passive: true });
const shocks = [];
let down = null;
addEventListener('pointerdown', (e) => { aim(e); down = { x: e.clientX, y: e.clientY, t: performance.now() }; }, { passive: true });
addEventListener('pointerup', (e) => {
  if (!down) return;
  const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y), held = performance.now() - down.t;
  down = null;
  if (moved > 12 || held > 500 || W[0] < 0.3) return;
  if (e.target.closest && e.target.closest('a, button, input, textarea, select, label')) return;
  if (!project(e)) return;
  if (Math.abs(hit.x) > COLS / 2 + 1 || Math.abs(hit.z) > ROWS / 2 + 1) return;
  shocks.push({ x: hit.x, z: hit.z, t0: performance.now() / 1000 });
  if (shocks.length > 4) shocks.shift();
}, { passive: true });

const right = new THREE.Vector3(), up = new THREE.Vector3();
const D2R = THREE.MathUtils.degToRad;
function placeCamera(az, el, half, shift, lift) {
  const aspect = innerWidth / innerHeight;
  Object.assign(camera, { left: -half * aspect, right: half * aspect, top: half, bottom: -half });
  const d = 60;
  camera.position.set(Math.sin(az) * Math.cos(el) * d, Math.sin(el) * d, Math.cos(az) * Math.cos(el) * d);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld();
  right.setFromMatrixColumn(camera.matrixWorld, 0);
  camera.position.addScaledVector(right, -shift * half * aspect);
  up.setFromMatrixColumn(camera.matrixWorld, 1);
  camera.position.addScaledVector(up, lift * half);
  camera.updateMatrixWorld();
  camera.updateProjectionMatrix();
}
const resize = () => renderer.setSize(innerWidth, innerHeight, false);
addEventListener('resize', resize); resize();

const hero = document.querySelector('#home');
const heroAnchor = document.querySelector('.hero .availability');
const chapters = (root.classList.contains('film-on') ? [] : [...document.querySelectorAll('.chapter')]).map((el) => ({
  el, steps: [...el.querySelectorAll('.steps li')], t: 0, target: 0,
}));
const sections = ['#home', '#story', '#work', '#flur', '#data-horizon', '#indexer', '#more-projects', '#experience', '#about', '#contact']
  .map((q) => document.querySelector(q)).filter(Boolean);
let lastY = scrollY, speed = 0, active = null, progress = 0;
const W = new Float32Array(5);
const Wt = new Float32Array(5);
const ripples = []; let lastRipple = 0; let scan = null;
function readScroll() {
  const vh = innerHeight, mid = vh * 0.5;
  const hr = hero.getBoundingClientRect();
  Wt[0] = 1 - sm(-hr.top / (hr.height * 0.7));
  let used = Wt[0];
  chapters.forEach((ch, k) => {
    const r = ch.el.getBoundingClientRect();
    ch.target = clamp01(((mid - r.top) / r.height) / (MOBILE ? 0.68 : 0.85));
    const w = sm((mid - r.top) / (0.3 * vh)) * sm((r.bottom - mid) / (0.3 * vh));
    Wt[k + 1] = w; used += w;
    ch.el.style.setProperty('--p', ch.target.toFixed(3));
  });
  Wt[4] = Math.max(0, 1 - used);
  const sum = Wt[0] + Wt[1] + Wt[2] + Wt[3] + Wt[4];
  for (let s = 0; s < 5; s++) Wt[s] /= sum;
}
function activeSection() {
  const mid = innerHeight * 0.5;
  for (const el of sections) { const r = el.getBoundingClientRect(); if (r.top <= mid && r.bottom > mid) return el; }
  return active;
}

const m4 = new THREE.Matrix4(), pos = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3();
const disp = new Float32Array(N), vel = new Float32Array(N), ext = new Float32Array(N), wake = new Float32Array(N);
const ang = new Float32Array(N), angVel = new Float32Array(N), angTarget = new Float32Array(N);
const flipBack = new Float32Array(N);
const revealed = new Uint8Array(N);
const brokenTotal = broken.reduce((n, b) => n + (b ? 1 : 0), 0);
let foundCount = 0, shownCount = -1;
const hint = document.querySelector('.world-hint .wh-count');
const UNDER = hex('#3b3b39');
const axis = new THREE.Vector3(), centre = new THREE.Vector3();
function startFlip(i, time, hold) {
  if (angTarget[i] !== 0 || Math.abs(ang[i]) > 0.05) return;
  angTarget[i] = Math.PI;
  flipBack[i] = time + hold;
  if (!revealed[i]) { revealed[i] = 1; foundCount++; }
}
function physics(dt, time, wPhys, px, pz, idle) {
  const spd = idle ? 0 : Math.hypot(pointer.vx, pointer.vz);
  pointer.vx *= Math.exp(-dt * 6); pointer.vz *= Math.exp(-dt * 6);
  const push = Math.min(spd, 45) / 45;
  const canFlip = W[0] > 0.6;
  for (let i = 0; i < N; i++) {
    const x = (i % COLS) - cx, z = ((i / COLS) | 0) - cz;
    const d2 = (x - px) ** 2 + (z - pz) ** 2;
    let f = 0;
    if (push > 0 && d2 < 9) {
      f += 80 * push * Math.exp(-d2 / 2.2);
      wake[i] = Math.max(wake[i], push * 0.7 * Math.exp(-d2 / 1.6));
    }
    if (canFlip && broken[i] && !idle && d2 < 1.6) startFlip(i, time, 5);
    for (const sh of shocks) {
      const age = time - sh.t0; if (age > 1.8) continue;
      const d = Math.hypot(x - sh.x, z - sh.z) - age * 15;
      if (d > -1.2 && d < 1.2) {
        f += 200 * Math.exp(-d * d / 0.5) * (1 - age / 1.8) * (age * 15 < 6.5 ? 1 : 0.35);
        if (broken[i] && Math.abs(d) < 0.6 && age * 15 < 6.5) startFlip(i, time, 6);
      }
    }
    ext[i] = f * wPhys;
    wake[i] *= Math.exp(-dt * 1.6);
    if (angTarget[i] !== 0 && time > flipBack[i] && Math.abs(ang[i] - angTarget[i]) < 0.05) angTarget[i] = 0;
  }
  for (let k = shocks.length - 1; k >= 0; k--) if (time - shocks[k].t0 > 1.8) shocks.splice(k, 1);
  const steps = Math.min(4, Math.ceil(dt / (1 / 120)));
  const h = dt / steps;
  for (let st = 0; st < steps; st++) {
    for (let i = 0; i < N; i++) {
      const c = i % COLS, r = (i / COLS) | 0;
      const nb = (c > 0 ? disp[i - 1] : disp[i]) + (c < COLS - 1 ? disp[i + 1] : disp[i]) + (r > 0 ? disp[i - COLS] : disp[i]) + (r < ROWS - 1 ? disp[i + COLS] : disp[i]);
      const a = -70 * disp[i] - 7.5 * vel[i] + 80 * (nb * 0.25 - disp[i]) + ext[i];
      vel[i] += a * h;
    }
    for (let i = 0; i < N; i++) {
      disp[i] = Math.max(-0.5, Math.min(2.4, disp[i] + vel[i] * h));
      const aa = 110 * (angTarget[i] - ang[i]) - 21 * angVel[i];
      angVel[i] += aa * h;
      ang[i] += angVel[i] * h;
    }
  }
  if (hint && foundCount !== shownCount) { shownCount = foundCount; hint.textContent = `${foundCount} of ${brokenTotal} broken tiles found`; }
}
const heights = new Float32Array(N).fill(0.12), lifts = new Float32Array(N);
const labelLayer = document.createElement('div');
labelLayer.className = 'world-labels';
labelLayer.setAttribute('aria-hidden', 'true');
canvas.after(labelLayer);
const chainNames = ['Bitcoin', 'Ethereum', 'Tron', 'Solana', 'TON', 'XRP'];
const labels = [
  ...Bz.towers.map((tw, k) => ({ text: chainNames[k], c: tw.c, r: tw.r, tile: tw.tile })),
  { text: 'Wallet', c: Bz.wallet.c, r: Bz.wallet.r, tile: I(Bz.wallet.c, Bz.wallet.r), strong: true },
  { text: 'Card terminal', c: Bz.term.c, r: Bz.term.r, tile: Bz.term.tile, strong: true },
].map((l) => {
  const el = document.createElement('span');
  el.className = l.strong ? 'world-label strong' : 'world-label';
  el.textContent = l.text;
  labelLayer.appendChild(el);
  return { ...l, el };
});
const projected = new THREE.Vector3();
const navbar = document.querySelector('.navbar');
let navBottom = 0;
const placed = [];
const drawOrder = [...labels].sort((a, b) => (b.strong ? 1 : 0) - (a.strong ? 1 : 0));
function placeLabels() {
  const w = W[3];
  navBottom = navbar ? navbar.getBoundingClientRect().bottom : 0;
  labelLayer.style.opacity = String(sm((w - 0.4) / 0.4));
  if (w < 0.05) return;
  placed.length = 0;
  for (const l of drawOrder) {
    const h = heights[l.tile];
    projected.set(l.c - cx, h + lifts[l.tile] + 0.35, l.r - cz).project(camera);
    const lw = l.el.offsetWidth, lh = l.el.offsetHeight;
    const x = Math.min(innerWidth - lw / 2 - 8, Math.max(lw / 2 + 8, (projected.x + 1) / 2 * innerWidth));
    const y = Math.max(navBottom + lh + 6, (1 - projected.y) / 2 * innerHeight);
    const box = { l: x - lw / 2 - 3, r: x + lw / 2 + 3, t: y - lh - 3, b: y + 3 };
    const clash = placed.some((p) => box.l < p.r && box.r > p.l && box.t < p.b && box.b > p.t);
    const show = h > 0.3 && !clash;
    if (show) placed.push(box);
    l.el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%, -100%)`;
    l.el.style.opacity = show ? '1' : '0';
  }
}

const col = new THREE.Color();
const out = { h: 0, lift: 0, c: new THREE.Color() };
let last = performance.now();
const born = last;
window.__world = { W, chapters, shocks, get found() { return foundCount; }, get flipping() { let n = 0; for (let i = 0; i < N; i++) if (Math.abs(ang[i]) > 0.1) n++; return n; } };

const fitRight = new THREE.Vector3(), fitUp = new THREE.Vector3(), fitDir = new THREE.Vector3(), corner = new THREE.Vector3();
const WORLD_UP = new THREE.Vector3(0, 1, 0);
function fitView(az, el, top, room) {
  fitDir.set(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el));
  fitRight.crossVectors(WORLD_UP, fitDir).normalize();
  fitUp.crossVectors(fitDir, fitRight);
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const x of [-COLS / 2, COLS / 2]) for (const z of [-ROWS / 2, ROWS / 2]) for (const y of [0, 2.3]) {
    corner.set(x, y, z);
    const sx = corner.dot(fitRight), sy = corner.dot(fitUp);
    minX = Math.min(minX, sx); maxX = Math.max(maxX, sx); minY = Math.min(minY, sy); maxY = Math.max(maxY, sy);
  }
  const aspect = innerWidth / innerHeight;
  const half = Math.max(((maxY - minY) * innerHeight) / (2 * room), ((maxX - minX) * innerHeight) / (2 * (innerWidth - 16)));
  const ppu = innerHeight / (2 * half);
  const lift = ((maxY + minY) / 2 - (innerHeight / 2 - (top + room / 2)) / ppu) / half;
  const shift = -((maxX + minX) / 2) / (half * aspect);
  return { half, lift, shift };
}

const filmStage = document.querySelector('.film-stage');
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  const time = now / 1000;
  const ease = 1 - Math.exp(-dt * 5);
  readScroll();
  const fr = root.classList.contains('film-on') && filmStage ? filmStage.getBoundingClientRect() : null;
  const covered = fr && fr.top <= 1 && fr.bottom >= innerHeight - 1;
  const away = MOBILE && Wt[0] < 0.01 && W[0] < 0.01;
  if (covered || away || document.hidden) {
    canvas.style.visibility = 'hidden';
    labelLayer.style.opacity = '0';
    requestAnimationFrame(frame);
    return;
  }
  canvas.style.visibility = '';
  for (let k = 0; k < 5; k++) W[k] += (Wt[k] - W[k]) * ease;
  for (const ch of chapters) {
    ch.t += (ch.target - ch.t) * (1 - Math.exp(-dt * 6));
    ch.steps.forEach((li, j) => li.classList.toggle('on', ch.target > 0.03 + j * 0.3));
  }
  const maxY = Math.max(1, document.documentElement.scrollHeight - innerHeight);
  progress += (scrollY / maxY - progress) * ease;
  speed += (Math.abs(scrollY - lastY) / Math.max(dt, 0.001) - speed) * (1 - Math.exp(-dt * 8));
  lastY = scrollY;

  const aspect = innerWidth / innerHeight;
  const baseHalf = MOBILE ? (COLS * 0.83) / Math.min(1, aspect) : 13;
  const ch = (k) => (chapters[k] ? chapters[k].t : 0);
  const views = [
    { az: 42, el: 48, half: baseHalf, shift: 0.62, lift: 0 },
    { az: 28 + ch(0) * 26, el: 54, half: baseHalf * 1.08, shift: 0.46, lift: 0 },
    { az: 62 - ch(1) * 24, el: 50, half: baseHalf * 1.08, shift: 0.46, lift: 0 },
    { az: 36 + ch(2) * 22, el: 52, half: baseHalf * 1.2, shift: 0.36, lift: 0 },
    { az: 42 + progress * 120, el: 48 - Math.sin(progress * Math.PI) * 16, half: baseHalf, shift: 1.2, lift: 0 },
  ];
  if (MOBILE) {
    const pxPerUnit = innerHeight / (2 * baseHalf);
    const below = heroAnchor ? heroAnchor.getBoundingClientRect().bottom : innerHeight * 0.6;
    views[0].lift = ((below + COLS * 0.53 * pxPerUnit + 12) - innerHeight / 2) / (innerHeight / 2);
    const top = (navbar ? navbar.getBoundingClientRect().bottom : 100) + 8;
    const room = Math.max(120, innerHeight * 0.54 - top - 10);
    for (let k = 1; k <= 3; k++) Object.assign(views[k], fitView(D2R(views[k].az), D2R(views[k].el), top, room));
    views[0].shift = 0; views[4].shift = 0;
  }
  let az = 0, el = 0, half = 0, shift = 0, lift = 0;
  for (let k = 0; k < 5; k++) {
    az += views[k].az * W[k]; el += views[k].el * W[k]; half += views[k].half * W[k];
    shift += views[k].shift * W[k]; lift += views[k].lift * W[k];
  }
  placeCamera(D2R(az) + Math.sin(time * 0.1) * 0.04, D2R(el), half, shift, lift);
  canvas.style.opacity = String(Math.min(1, (now - born) / 700) * (1 - W[4] * (MOBILE ? 0.55 : 0.6)));

  if (speed > 120 && now - lastRipple > 140 && W[4] > 0.3) {
    lastRipple = now;
    ripples.push({ x: Math.sin(progress * 9) * 7, z: Math.cos(progress * 6) * 7, t0: time, amp: Math.min(0.9, speed / 2500) });
    if (ripples.length > 8) ripples.shift();
  }
  const sec = activeSection();
  if (sec && sec !== active) { if (active && W[4] > 0.5) scan = { t0: time, dir: scan ? -scan.dir : 1 }; active = sec; }
  const scanPos = scan ? (time - scan.t0) * 22 - 18 : 99;
  if (scan && scanPos > 20) scan = null;

  const idle = now - pointer.seen > 2500;
  const px = idle ? Math.sin(time * 0.33) * 8 : pointer.x;
  const pz = idle ? Math.cos(time * 0.21) * 8 : pointer.z;
  const wPhys = Math.min(1, W[0] + W[4]);
  physics(dt, time, wPhys, px, pz, idle);

  for (let i = 0; i < N; i++) {
    const c = i % COLS, r = (i / COLS) | 0;
    const x = c - cx, z = r - cz;
    let h = 0, lf = 0;
    col.setRGB(0, 0, 0);
    const wave = Math.sin(time * 0.9 + x * 0.32 + z * 0.24 + phase[i] * 0.15);

    if (W[0] > 0.002) {
      const w = W[0];
      const bump = Math.exp(-((x - px) ** 2 + (z - pz) ** 2) / 6.5);
      if (broken[i]) glow[i] = Math.max(glow[i] - dt * 0.9, bump > 0.35 ? 1 : 0);
      h += w * (0.12 + bump * 1.5 + wave * 0.05);
      tmp.copy(P.floor).lerp(P.clay, Math.min(1, bump * 1.2) * 0.6);
      if (broken[i]) { tmp.lerp(P.blue, glow[i]); lf += w * glow[i] * 0.3; }
      col.r += tmp.r * w; col.g += tmp.g * w; col.b += tmp.b * w;
    }
    for (let k = 0; k < 3; k++) {
      const w = W[k + 1]; if (w < 0.002) continue;
      out.h = 0; out.lift = 0;
      sceneFns[k](i, ch(k), time, out, c, r);
      h += w * (out.h + wave * 0.015); lf += w * out.lift;
      col.r += out.c.r * w; col.g += out.c.g * w; col.b += out.c.b * w;
    }
    if (W[4] > 0.002) {
      const w = W[4];
      let rip = 0;
      for (const rp of ripples) {
        const age = time - rp.t0; if (age > 2.6) continue;
        const d = Math.hypot(x - rp.x, z - rp.z) - age * 9;
        rip += rp.amp * Math.exp(-d * d / 2.2) * (1 - age / 2.6);
      }
      let sweep = 0;
      if (scan) {
        const along = scan.dir > 0 ? x + z * 0.35 : -x + z * 0.35;
        sweep = Math.exp(-((along - scanPos) ** 2) / 1.4);
        if (broken[i] && sweep > 0.5) glow[i] = 1;
      }
      if (W[0] < 0.01 && broken[i]) glow[i] = Math.max(0, glow[i] - dt * 0.9);
      h += w * (0.14 + wave * 0.09 + rip * 0.9 + sweep * 0.35);
      tmp.copy(P.quiet).lerp(P.ripple, Math.min(1, rip * 1.5)).lerp(P.blue, sweep * 0.4);
      if (broken[i]) { tmp.lerp(P.blue, glow[i] * 0.65); lf += w * glow[i] * 0.3; }
      col.r += tmp.r * w; col.g += tmp.g * w; col.b += tmp.b * w;
    }

    const k = 1 - Math.exp(-dt * 9);
    heights[i] += (h - heights[i]) * k;
    lifts[i] += (lf - lifts[i]) * k;
    const hh = Math.max(0.03, heights[i] + (disp[i] + wake[i] * 0.35) * wPhys);
    const a = ang[i] * wPhys;
    if (wake[i] > 0.02) col.lerp(P.clay, Math.min(0.45, wake[i] * 0.5) * W[0]);
    if (Math.abs(a) > 0.002) {
      axis.set(0.7071, 0, -0.7071);
      q.setFromAxisAngle(axis, a);
      centre.set(0, hh / 2, 0).applyQuaternion(q);
      const under = Math.cos(a) < 0;
      if (under) {
        if (broken[i]) { glow[i] = 1; col.copy(P.blue); }
        else col.lerp(UNDER, 0.85);
      }
      pos.set(x - centre.x, lifts[i] + hh / 2 - centre.y + Math.abs(Math.sin(a)) * 0.55, z - centre.z);
    } else {
      q.identity();
      pos.set(x, lifts[i], z);
    }
    s.set(1, hh, 1);
    tiles.setMatrixAt(i, m4.compose(pos, q, s));
    tiles.setColorAt(i, col);
  }
  tiles.instanceMatrix.needsUpdate = true;
  tiles.instanceColor.needsUpdate = true;
  placeLabels();
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
root.classList.add('world-ready');
