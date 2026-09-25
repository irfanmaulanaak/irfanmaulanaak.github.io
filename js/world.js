// Live 3D tile field. In the hero, tiles rise under the cursor and hidden
// "broken" tiles light blue. Further down the page it settles into a slow, dim wave.
// Only runs when the head script added the .world class (wide screen, motion allowed, WebGL).
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

const root = document.documentElement;

const COLS = 26, ROWS = 26, N = COLS * ROWS;
const FLOOR = new THREE.Color('#1d1d1d');
const QUIET = new THREE.Color('#181818');
const CLAY = new THREE.Color('#e6e3dc');
const BLUE = new THREE.Color('#7d97ff');

const canvas = document.createElement('canvas');
canvas.className = 'world-canvas';
canvas.setAttribute('aria-hidden', 'true');
document.body.prepend(canvas);

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
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
sun.shadow.mapSize.set(2048, 2048);
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
window.addEventListener('pointermove', (e) => {
  ndc.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  if (ray.ray.intersectPlane(ground, hit)) { pointer.x = hit.x; pointer.z = hit.z; pointer.seen = performance.now(); }
}, { passive: true });

// ---------- camera: iso view, field sits in the right half of the screen ----------
const EL = THREE.MathUtils.degToRad(48), AZ = THREE.MathUtils.degToRad(42);
const right = new THREE.Vector3();
function placeCamera(t, shift) {
  const aspect = innerWidth / innerHeight, half = 13;
  Object.assign(camera, { left: -half * aspect, right: half * aspect, top: half, bottom: -half });
  const az = AZ + Math.sin(t * 0.1) * 0.05, d = 60;
  camera.position.set(Math.sin(az) * Math.cos(EL) * d, Math.sin(EL) * d, Math.cos(az) * Math.cos(EL) * d);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld();
  right.setFromMatrixColumn(camera.matrixWorld, 0);
  camera.position.addScaledVector(right, -shift * half * aspect);
  camera.updateMatrixWorld();
  camera.updateProjectionMatrix();
}
const resize = () => renderer.setSize(innerWidth, innerHeight, false);
addEventListener('resize', resize); resize();

// ---------- hero weight from scroll ----------
const hero = document.querySelector('#home');
let calm = 0;   // 0 = hero, 1 = quiet
function heroTarget() {
  const r = hero.getBoundingClientRect();
  return Math.min(1, Math.max(0, -r.top / (r.height * 0.8)));
}

// ---------- frame loop ----------
const m4 = new THREE.Matrix4(), pos = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3();
const col = new THREE.Color();
let last = performance.now();
const born = last;
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  const t = now / 1000;
  calm += (heroTarget() - calm) * (1 - Math.exp(-dt * 4));
  placeCamera(t, 0.62);
  canvas.style.opacity = String(Math.min(1, (now - born) / 1400) * (1 - calm * 0.6));

  // when the cursor is idle or elsewhere, a slow scanner drifts across the field
  const idle = now - pointer.seen > 2500;
  const px = idle ? Math.sin(t * 0.33) * 8 : pointer.x;
  const pz = idle ? Math.cos(t * 0.21) * 8 : pointer.z;

  for (let i = 0; i < N; i++) {
    const x = (i % COLS) - cx, z = ((i / COLS) | 0) - cz;
    const d2 = (x - px) ** 2 + (z - pz) ** 2;
    const bump = Math.exp(-d2 / 6.5) * (1 - calm);
    const wave = Math.sin(t * 0.9 + x * 0.32 + z * 0.24 + phase[i] * 0.15);
    const target = 0.12 + bump * 1.5 + wave * (0.05 + calm * 0.04) + calm * 0.02;
    heights[i] += (target - heights[i]) * (1 - Math.exp(-dt * 7));
    if (broken[i]) glow[i] = Math.max(glow[i] - dt * 0.6, bump > 0.35 ? 1 : 0);

    col.copy(FLOOR).lerp(QUIET, calm).lerp(CLAY, Math.min(1, bump * 1.2) * 0.6);
    if (broken[i]) col.lerp(BLUE, glow[i] * (1 - calm));
    pos.set(x, broken[i] ? glow[i] * 0.3 * (1 - calm) : 0, z);
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
