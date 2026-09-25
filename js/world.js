// Live 3D tile field. In the hero, tiles rise under the cursor and hidden
// "broken" tiles light blue. Further down the page it settles into a slow, dim wave.
// Only runs when the head script added the .world class (wide screen, motion allowed, WebGL).
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

const root = document.documentElement;

const MOBILE = Math.min(innerWidth, innerHeight) < 700 || innerWidth < 900;
const COLS = MOBILE ? 18 : 26, ROWS = COLS, N = COLS * ROWS;
const FLOOR = new THREE.Color('#1d1d1d');
const QUIET = new THREE.Color('#181818');
const CLAY = new THREE.Color('#e6e3dc');
const BLUE = new THREE.Color('#7d97ff');

const canvas = document.createElement('canvas');
canvas.className = 'world-canvas';
canvas.setAttribute('aria-hidden', 'true');
document.body.prepend(canvas);

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, MOBILE ? 1.25 : 1.5));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.AgXToneMapping;
renderer.toneMappingExposure = 1.2;

const scene = new THREE.Scene();
const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 200);

scene.add(new THREE.HemisphereLight('#ffffff', '#151515', 1.0));
const sun = new THREE.DirectionalLight('#ffffff', 2.8);
sun.position.set(-12, 24, 9);
sun.castShadow = true;
sun.shadow.mapSize.set(MOBILE ? 1024 : 2048, MOBILE ? 1024 : 2048);
Object.assign(sun.shadow.camera, { left: -20, right: 20, top: 20, bottom: -20, near: 1, far: 70 });
sun.shadow.bias = -0.0005;
scene.add(sun);

const geo = new RoundedBoxGeometry(0.9, 1, 0.9, 2, 0.08);
geo.translate(0, 0.5, 0);
// Stone surface drawn once in a small canvas: speckles for colour, the same pattern for bumps.
function stoneTexture() {
  const size = 256, c = document.createElement('canvas'); c.width = c.height = size;
  const g = c.getContext('2d'), img = g.createImageData(size, size);
  let r = 3; const rnd = () => (r = (r * 16807) % 2147483647) / 2147483647;
  const blot = new Float32Array(size * size);
  for (let k = 0; k < 90; k++) {           // soft blotches
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
const bumpTex = stone.clone(); bumpTex.colorSpace = THREE.NoColorSpace;
const tileMat = new THREE.MeshStandardMaterial({ map: stone, roughnessMap: bumpTex, roughness: 1.0 });
const tiles = new THREE.InstancedMesh(geo, tileMat, N);
tiles.castShadow = tiles.receiveShadow = true;
tiles.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
scene.add(tiles);

const cx = (COLS - 1) / 2, cz = (ROWS - 1) / 2;
let seed = 11;
const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const broken = Array.from({ length: N }, () => rand() < 0.09);
const phase = Float32Array.from({ length: N }, () => rand() * Math.PI * 2);
const heights = new Float32Array(N).fill(0.12);
const glow = new Float32Array(N);   // broken tiles stay lit for a moment after the cursor leaves

// ---------- pointer (projected onto the ground) ----------
const pointer = { x: 0, z: 0, seen: 0 };
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), hit = new THREE.Vector3();
const ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const aim = (e) => {
  ndc.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  if (ray.ray.intersectPlane(ground, hit)) { pointer.x = hit.x; pointer.z = hit.z; pointer.seen = performance.now(); }
};
window.addEventListener('pointermove', aim, { passive: true });
window.addEventListener('pointerdown', aim, { passive: true });

// ---------- camera: iso view that turns and tilts as the page scrolls ----------
const right = new THREE.Vector3();
const D2R = THREE.MathUtils.degToRad;
const up = new THREE.Vector3();
function placeCamera(t, progress, shift, lift) {
  const aspect = innerWidth / innerHeight;
  // portrait screens: fit the field to the width instead of the height
  const half = aspect < 1 ? 15 / aspect : 13;
  Object.assign(camera, { left: -half * aspect, right: half * aspect, top: half, bottom: -half });
  const az = D2R(42) + progress * D2R(120) + Math.sin(t * 0.1) * 0.05;
  const el = D2R(48) - Math.sin(progress * Math.PI) * D2R(16);
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

// ---------- scroll state ----------
const hero = document.querySelector('#home');
const anchor = document.querySelector('.hero .availability');
const sections = ['#home', '#work', '#flur', '#data-horizon', '#indexer', '#more-projects', '#experience', '#about', '#contact']
  .map((q) => document.querySelector(q)).filter(Boolean);
let calm = 0, progress = 0, lastY = scrollY, speed = 0, active = null;
function heroTarget() {
  const r = hero.getBoundingClientRect();
  return Math.min(1, Math.max(0, -r.top / (r.height * 0.8)));
}
function activeSection() {
  const mid = innerHeight * 0.5;
  for (const el of sections) { const r = el.getBoundingClientRect(); if (r.top <= mid && r.bottom > mid) return el; }
  return active;
}

// ripples from scrolling, and a scan line each time a new section arrives
const ripples = [];      // { x, z, t0, amp }
let lastRipple = 0;
let scan = null;         // { t0, dir }

// ---------- frame loop ----------
const m4 = new THREE.Matrix4(), pos = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3();
const col = new THREE.Color();
const RIPPLE = new THREE.Color('#4a4a48');
let last = performance.now();
const born = last;
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  const t = now / 1000;
  const ease = 1 - Math.exp(-dt * 4);
  calm += (heroTarget() - calm) * ease;
  const maxY = Math.max(1, document.documentElement.scrollHeight - innerHeight);
  progress += (scrollY / maxY - progress) * ease;
  speed += (Math.abs(scrollY - lastY) / Math.max(dt, 0.001) - speed) * (1 - Math.exp(-dt * 8));
  lastY = scrollY;
  if (MOBILE) {
    // pin the field just below the hero text, whatever the screen height
    const pxPerUnit = innerHeight / (2 * (innerWidth < innerHeight ? 15 / (innerWidth / innerHeight) : 13));
    const fieldHalf = COLS * 0.53 * pxPerUnit;
    const below = anchor ? anchor.getBoundingClientRect().bottom : innerHeight * 0.6;
    const lift = ((below + fieldHalf + 12) - innerHeight / 2) / (innerHeight / 2);
    placeCamera(t, progress, 0, lift * (1 - calm));
  }
  else placeCamera(t, progress, 0.62 + calm * 0.16, 0);
  canvas.style.opacity = String(Math.min(1, (now - born) / 1400) * (1 - calm * (MOBILE ? 0.55 : 0.42)));

  // scrolling drops ripples on a path that drifts with the page
  if (speed > 120 && now - lastRipple > 140) {
    lastRipple = now;
    ripples.push({ x: Math.sin(progress * 9) * 7, z: Math.cos(progress * 6) * 7, t0: t, amp: Math.min(0.9, speed / 2500) });
    if (ripples.length > 8) ripples.shift();
  }
  const sec = activeSection();
  if (sec && sec !== active) { if (active) scan = { t0: t, dir: scan ? -scan.dir : 1 }; active = sec; }
  const scanPos = scan ? (t - scan.t0) * 22 - 18 : 99;     // sweeps from -18 to +18 in about 1.6 s
  if (scan && scanPos > 20) scan = null;

  // when the cursor is idle or elsewhere, a slow scanner drifts across the field
  const idle = now - pointer.seen > 2500;
  const px = idle ? Math.sin(t * 0.33) * 8 : pointer.x;
  const pz = idle ? Math.cos(t * 0.21) * 8 : pointer.z;

  for (let i = 0; i < N; i++) {
    const x = (i % COLS) - cx, z = ((i / COLS) | 0) - cz;
    const d2 = (x - px) ** 2 + (z - pz) ** 2;
    const bump = Math.exp(-d2 / 6.5) * (1 - calm);
    const wave = Math.sin(t * 0.9 + x * 0.32 + z * 0.24 + phase[i] * 0.15);

    let rip = 0;
    for (const r of ripples) {
      const age = t - r.t0; if (age > 2.6) continue;
      const d = Math.hypot(x - r.x, z - r.z) - age * 9;
      rip += r.amp * Math.exp(-d * d / 2.2) * (1 - age / 2.6);
    }
    let sweep = 0;
    if (scan) {
      const along = scan.dir > 0 ? x + z * 0.35 : -x + z * 0.35;
      sweep = Math.exp(-((along - scanPos) ** 2) / 1.4);
      if (broken[i] && sweep > 0.5) glow[i] = 1;
    }

    const target = 0.12 + bump * 1.5 + wave * (0.05 + calm * 0.04) + calm * 0.02 + rip * 0.9 + sweep * 0.35;
    heights[i] += (target - heights[i]) * (1 - Math.exp(-dt * 7));
    if (broken[i]) glow[i] = Math.max(glow[i] - dt * 0.9, bump > 0.35 ? 1 : 0);

    col.copy(FLOOR).lerp(QUIET, calm).lerp(CLAY, Math.min(1, bump * 1.2) * 0.6).lerp(RIPPLE, Math.min(1, rip * 1.5));
    col.lerp(BLUE, sweep * 0.4);
    if (broken[i]) col.lerp(BLUE, glow[i] * (1 - calm * 0.35));
    pos.set(x, broken[i] ? glow[i] * 0.3 : 0, z);
    s.set(1, Math.max(0.03, heights[i]), 1);
    tiles.setMatrixAt(i, m4.compose(pos, q, s));
    tiles.setColorAt(i, col);
  }
  tiles.instanceMatrix.needsUpdate = true;
  tiles.instanceColor.needsUpdate = true;
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
root.classList.add('world-ready');
