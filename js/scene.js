/**
 * Particle-network backdrop - Three.js
 *
 * A drifting node graph (blockchain network) whose palette converges from
 * terminal amber toward signal green as the reader reaches the Convergence
 * chapter - the blockchain & AI merge, visualized.
 *
 * Budget: two draw calls (Points + LineSegments), preallocated buffers,
 * zero per-frame allocation. Skipped entirely on reduced-motion, save-data,
 * or missing WebGL - the CSS grid backdrop remains as the fallback.
 */

import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.min.js';

(function () {
    'use strict';

    const canvas = document.getElementById('scene');
    if (!canvas) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if (navigator.connection && navigator.connection.saveData) return;

    const isMobile = window.matchMedia('(max-width: 768px)').matches;
    const finePointer = window.matchMedia('(pointer: fine)').matches;

    // ------------------------------------------
    // Tunables
    // ------------------------------------------
    const NODE_COUNT = isMobile ? 64 : 132;
    const NEIGHBORS = 2;                       // links per node (deduped)
    const SPREAD_Y = 300;
    const SPREAD_Z = 170;
    const DRIFT_AMP = 14;                      // sinusoidal drift radius
    const LINK_CUTOFF = isMobile ? 150 : 175;  // px (world units) where a link fades out
    const LINE_DIM = isMobile ? 0.28 : 0.34;   // global line brightness
    const MAX_DPR = isMobile ? 1.5 : 1.75;

    // Palette (linear-ish, additive over #0b0a09)
    const AMBER = new THREE.Color(0.85, 0.5, 0.24);
    const CREAM = new THREE.Color(0.93, 0.89, 0.8);
    const GREEN = new THREE.Color(0.3, 0.78, 0.54);

    // ------------------------------------------
    // Renderer / scene - bail silently if WebGL is unavailable
    // ------------------------------------------
    let renderer;
    try {
        renderer = new THREE.WebGLRenderer({
            canvas,
            alpha: true,
            antialias: true,
            powerPreference: 'low-power'
        });
    } catch (e) {
        return;
    }

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(60, 1, 1, 2000);
    camera.position.z = 430;

    const group = new THREE.Group();
    scene.add(group);

    const initAspect = Math.max(window.innerWidth / window.innerHeight, 0.6);
    const spreadX = 340 * Math.max(initAspect, 1);

    // ------------------------------------------
    // Nodes
    // ------------------------------------------
    const base = new Float32Array(NODE_COUNT * 3);     // rest positions
    const phase = new Float32Array(NODE_COUNT * 3);    // drift phases
    const speed = new Float32Array(NODE_COUNT);        // drift speeds
    const aiMix = new Float32Array(NODE_COUNT);        // 0 = chain node, 1 = ai node
    const spark = new Float32Array(NODE_COUNT);        // transient pulse envelope
    const baseBright = new Float32Array(NODE_COUNT);

    for (let i = 0; i < NODE_COUNT; i++) {
        base[i * 3] = (Math.random() * 2 - 1) * spreadX;
        base[i * 3 + 1] = (Math.random() * 2 - 1) * SPREAD_Y;
        base[i * 3 + 2] = (Math.random() * 2 - 1) * SPREAD_Z;
        phase[i * 3] = Math.random() * Math.PI * 2;
        phase[i * 3 + 1] = Math.random() * Math.PI * 2;
        phase[i * 3 + 2] = Math.random() * Math.PI * 2;
        speed[i] = 0.25 + Math.random() * 0.45;
        aiMix[i] = Math.random() < 0.45 ? 1 : 0;
        baseBright[i] = 0.45 + Math.random() * 0.55;
    }

    const positions = new Float32Array(NODE_COUNT * 3);
    const colors = new Float32Array(NODE_COUNT * 3);

    const pointsGeo = new THREE.BufferGeometry();
    pointsGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    pointsGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    // Soft round sprite so points read as glow dots, not squares
    const spriteCanvas = document.createElement('canvas');
    spriteCanvas.width = spriteCanvas.height = 64;
    const sctx = spriteCanvas.getContext('2d');
    const grad = sctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.4, 'rgba(255,255,255,0.5)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    sctx.fillStyle = grad;
    sctx.fillRect(0, 0, 64, 64);
    const sprite = new THREE.CanvasTexture(spriteCanvas);

    const points = new THREE.Points(pointsGeo, new THREE.PointsMaterial({
        size: isMobile ? 4.5 : 5.5,
        map: sprite,
        vertexColors: true,
        transparent: true,
        opacity: 0.85,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        sizeAttenuation: true
    }));
    group.add(points);

    // ------------------------------------------
    // Links - k-nearest pairs, precomputed once
    // ------------------------------------------
    const pairSet = new Set();
    const pairs = [];
    for (let i = 0; i < NODE_COUNT; i++) {
        const dists = [];
        for (let j = 0; j < NODE_COUNT; j++) {
            if (i === j) continue;
            const dx = base[i * 3] - base[j * 3];
            const dy = base[i * 3 + 1] - base[j * 3 + 1];
            const dz = base[i * 3 + 2] - base[j * 3 + 2];
            dists.push([dx * dx + dy * dy + dz * dz, j]);
        }
        dists.sort((a, b) => a[0] - b[0]);
        for (let k = 0; k < NEIGHBORS; k++) {
            const j = dists[k][1];
            const key = i < j ? i * NODE_COUNT + j : j * NODE_COUNT + i;
            if (!pairSet.has(key)) {
                pairSet.add(key);
                pairs.push(i, j);
            }
        }
    }
    const PAIR_COUNT = pairs.length / 2;

    const linePos = new Float32Array(PAIR_COUNT * 6);
    const lineCol = new Float32Array(PAIR_COUNT * 6);
    const linesGeo = new THREE.BufferGeometry();
    linesGeo.setAttribute('position', new THREE.BufferAttribute(linePos, 3));
    linesGeo.setAttribute('color', new THREE.BufferAttribute(lineCol, 3));

    const lines = new THREE.LineSegments(linesGeo, new THREE.LineBasicMaterial({
        vertexColors: true,
        transparent: true,
        opacity: 0.85,
        blending: THREE.AdditiveBlending,
        depthWrite: false
    }));
    group.add(lines);

    // ------------------------------------------
    // Scroll / pointer / convergence state
    // ------------------------------------------
    let scrollP = 0;          // page progress 0..1
    let converge = 0;         // smoothed convergence factor 0..1
    let convergeTarget = 0;
    let pointerX = 0, pointerY = 0;       // smoothed
    let pointerTX = 0, pointerTY = 0;     // targets

    const convergeEl = document.getElementById('convergence');

    function readScroll() {
        const doc = document.documentElement;
        const max = doc.scrollHeight - window.innerHeight;
        scrollP = max > 0 ? window.scrollY / max : 0;
        if (convergeEl) {
            const r = convergeEl.getBoundingClientRect();
            const vh = window.innerHeight;
            // 0 when the chapter is below the fold, 1 once its top clears 20% vh
            convergeTarget = Math.min(Math.max((vh * 0.85 - r.top) / (vh * 0.65), 0), 1);
        }
    }
    window.addEventListener('scroll', readScroll, { passive: true });
    readScroll();

    if (finePointer && !isMobile) {
        window.addEventListener('pointermove', (e) => {
            pointerTX = (e.clientX / window.innerWidth) * 2 - 1;
            pointerTY = (e.clientY / window.innerHeight) * 2 - 1;
        }, { passive: true });
    }

    // ------------------------------------------
    // Resize
    // ------------------------------------------
    function resize() {
        const w = window.innerWidth;
        const h = window.innerHeight;
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, MAX_DPR));
        renderer.setSize(w, h, false);
        const aspect = Math.max(w / h, 0.6);
        group.scale.x = Math.min(Math.max(aspect / initAspect, 0.7), 1.6);
    }
    let resizeTimer;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(resize, 120);
    });
    resize();

    // ------------------------------------------
    // Render loop
    // ------------------------------------------
    const clock = new THREE.Clock();
    let elapsed = 0;
    let sparkTimer = 0;
    let rafId = null;
    let live = false;

    const nodeColor = new THREE.Color();
    const mixColor = new THREE.Color();

    function frame() {
        rafId = requestAnimationFrame(frame);
        const dt = Math.min(clock.getDelta(), 0.05);
        elapsed += dt;

        // Smoothing
        converge += (convergeTarget - converge) * Math.min(dt * 2.4, 1);
        pointerX += (pointerTX - pointerX) * Math.min(dt * 3, 1);
        pointerY += (pointerTY - pointerY) * Math.min(dt * 3, 1);

        // Occasional node spark - a confirmation pulse travelling the graph
        sparkTimer -= dt;
        if (sparkTimer <= 0) {
            spark[(Math.random() * NODE_COUNT) | 0] = 1;
            sparkTimer = 0.5 + Math.random() * 0.9;
        }

        // Node positions + colors
        for (let i = 0; i < NODE_COUNT; i++) {
            const t = elapsed * speed[i];
            positions[i * 3] = base[i * 3] + Math.sin(t + phase[i * 3]) * DRIFT_AMP;
            positions[i * 3 + 1] = base[i * 3 + 1] + Math.cos(t * 0.9 + phase[i * 3 + 1]) * DRIFT_AMP;
            positions[i * 3 + 2] = base[i * 3 + 2] + Math.sin(t * 0.7 + phase[i * 3 + 2]) * DRIFT_AMP;

            spark[i] *= Math.pow(0.12, dt); // ~decays in a second

            nodeColor.copy(AMBER).lerp(CREAM, aiMix[i] * 0.35);          // resting tint
            nodeColor.lerp(GREEN, aiMix[i] * converge);                  // convergence shift
            const b = baseBright[i] * (0.75 + 0.25 * Math.sin(elapsed * 0.8 + phase[i * 3])) + spark[i] * 0.9;
            colors[i * 3] = nodeColor.r * b;
            colors[i * 3 + 1] = nodeColor.g * b;
            colors[i * 3 + 2] = nodeColor.b * b;
        }
        pointsGeo.attributes.position.needsUpdate = true;
        pointsGeo.attributes.color.needsUpdate = true;

        // Links: position from current nodes, brightness from proximity
        for (let p = 0; p < PAIR_COUNT; p++) {
            const i = pairs[p * 2];
            const j = pairs[p * 2 + 1];
            const ix = positions[i * 3], iy = positions[i * 3 + 1], iz = positions[i * 3 + 2];
            const jx = positions[j * 3], jy = positions[j * 3 + 1], jz = positions[j * 3 + 2];

            linePos[p * 6] = ix; linePos[p * 6 + 1] = iy; linePos[p * 6 + 2] = iz;
            linePos[p * 6 + 3] = jx; linePos[p * 6 + 4] = jy; linePos[p * 6 + 5] = jz;

            const dx = ix - jx, dy = iy - jy, dz = iz - jz;
            const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
            let s = 1 - d / LINK_CUTOFF;
            s = s < 0 ? 0 : s;
            s = s * LINE_DIM * (0.7 + (spark[i] + spark[j]) * 1.4);

            const m = (aiMix[i] + aiMix[j]) * 0.5 * converge;
            mixColor.copy(AMBER).lerp(GREEN, m);
            const r = mixColor.r * s, g = mixColor.g * s, bl = mixColor.b * s;
            lineCol[p * 6] = r; lineCol[p * 6 + 1] = g; lineCol[p * 6 + 2] = bl;
            lineCol[p * 6 + 3] = r; lineCol[p * 6 + 4] = g; lineCol[p * 6 + 5] = bl;
        }
        linesGeo.attributes.position.needsUpdate = true;
        linesGeo.attributes.color.needsUpdate = true;

        // Camera / group choreography: slow ambient spin + scroll drift + pointer parallax
        group.rotation.y = elapsed * 0.02 + scrollP * 0.85 + pointerX * 0.05;
        group.rotation.x = -0.08 + scrollP * 0.22 + pointerY * 0.04;
        camera.position.y = -scrollP * 80;
        camera.lookAt(0, camera.position.y * 0.6, 0);

        renderer.render(scene, camera);

        if (!live) {
            live = true;
            canvas.classList.add('is-live');
        }
    }

    function start() {
        if (rafId === null) {
            clock.getDelta(); // flush accumulated time so dt stays sane
            rafId = requestAnimationFrame(frame);
        }
    }
    function stop() {
        if (rafId !== null) {
            cancelAnimationFrame(rafId);
            rafId = null;
        }
    }

    document.addEventListener('visibilitychange', () => {
        if (document.hidden) stop();
        else start();
    });

    canvas.addEventListener('webglcontextlost', (e) => {
        e.preventDefault();
        stop();
        canvas.classList.remove('is-live');
        live = false;
    });
    canvas.addEventListener('webglcontextrestored', () => start());

    // Lazy start: never compete with first paint
    if (document.readyState === 'complete') {
        start();
    } else {
        window.addEventListener('load', () => {
            if ('requestIdleCallback' in window) {
                requestIdleCallback(start, { timeout: 600 });
            } else {
                setTimeout(start, 200);
            }
        });
    }
})();
