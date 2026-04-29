/**
 * Three.js Background — Chapter-Aware Network Aesthetic
 * Evolves based on scroll story chapter state.
 */

(function () {
    'use strict';

    const canvas = document.getElementById('bg-canvas');
    if (!canvas) return;

    // ==========================================
    // Device Tier Detection
    // ==========================================
    const isMobile = window.matchMedia('(pointer: coarse)').matches || window.innerWidth < 768;
    const isLowPower = navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4;

    // ==========================================
    // Chapter States
    // ==========================================
    const chapterStates = {
        boot: {
            particleCount: isMobile || isLowPower ? 40 : 80,
            connectionDistance: 5,
            maxConnections: 2,
            driftSpeed: 0.004,
            colorPrimary: 0x00e5ff,
            colorSecondary: 0x003d44,
            lineOpacity: 0.025,
            bloomStrength: 0.25
        },
        foundation: {
            particleCount: isMobile || isLowPower ? 60 : 120,
            connectionDistance: 6,
            maxConnections: 2,
            driftSpeed: 0.006,
            colorPrimary: 0x00e5ff,
            colorSecondary: 0x0088aa,
            lineOpacity: 0.035,
            bloomStrength: 0.3
        },
        buildingBlocks: {
            particleCount: isMobile || isLowPower ? 80 : 160,
            connectionDistance: 7,
            maxConnections: 3,
            driftSpeed: 0.008,
            colorPrimary: 0x44aacc,
            colorSecondary: 0x226688,
            lineOpacity: 0.045,
            bloomStrength: 0.35
        },
        goingDeeper: {
            particleCount: isMobile || isLowPower ? 100 : 200,
            connectionDistance: 8,
            maxConnections: 3,
            driftSpeed: 0.010,
            colorPrimary: 0x00aaaa,
            colorSecondary: 0x006666,
            lineOpacity: 0.055,
            bloomStrength: 0.4
        },
        convergence: {
            particleCount: isMobile || isLowPower ? 120 : 240,
            connectionDistance: 9,
            maxConnections: 3,
            driftSpeed: 0.012,
            colorPrimary: 0xffaa00,
            colorSecondary: 0xaa6600,
            lineOpacity: 0.065,
            bloomStrength: 0.45
        },
        connect: {
            particleCount: isMobile || isLowPower ? 100 : 180,
            connectionDistance: 10,
            maxConnections: 3,
            driftSpeed: 0.008,
            colorPrimary: 0x00e5ff,
            colorSecondary: 0x0088aa,
            lineOpacity: 0.045,
            bloomStrength: 0.35
        }
    };

    // ==========================================
    // Interpolation State
    // ==========================================
    const currentState = {
        particleCount: chapterStates.boot.particleCount,
        connectionDistance: chapterStates.boot.connectionDistance,
        maxConnections: chapterStates.boot.maxConnections,
        driftSpeed: chapterStates.boot.driftSpeed,
        colorPrimary: new THREE.Color(chapterStates.boot.colorPrimary),
        colorSecondary: new THREE.Color(chapterStates.boot.colorSecondary),
        lineOpacity: chapterStates.boot.lineOpacity,
        bloomStrength: chapterStates.boot.bloomStrength
    };

    const targetState = { ...chapterStates.boot };
    targetState.colorPrimary = new THREE.Color(targetState.colorPrimary);
    targetState.colorSecondary = new THREE.Color(targetState.colorSecondary);

    const lerpFactor = 0.02; // Smooth transition speed

    // ==========================================
    // Scene Setup
    // ==========================================
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.z = 35;

    const renderer = new THREE.WebGLRenderer({
        canvas: canvas,
        antialias: false,
        alpha: false,
        powerPreference: 'high-performance'
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, isMobile ? 1.5 : 2));
    renderer.setClearColor(0x0a0a0a, 1);

    // Post-processing
    const renderScene = new THREE.RenderPass(scene, camera);
    const bloomPass = new THREE.UnrealBloomPass(
        new THREE.Vector2(window.innerWidth, window.innerHeight),
        currentState.bloomStrength,
        0.5,
        0.3
    );

    const composer = new THREE.EffectComposer(renderer);
    composer.addPass(renderScene);
    composer.addPass(bloomPass);

    // ==========================================
    // Particle System (Dynamic Count)
    // ==========================================
    const maxParticles = isMobile || isLowPower ? 150 : 300;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(maxParticles * 3);
    const colors = new Float32Array(maxParticles * 3);
    const sizes = new Float32Array(maxParticles);

    const particles = [];

    for (let i = 0; i < maxParticles; i++) {
        const p = {
            x: (Math.random() - 0.5) * 70,
            y: (Math.random() - 0.5) * 70,
            z: (Math.random() - 0.5) * 30,
            vx: (Math.random() - 0.5) * 0.008,
            vy: (Math.random() - 0.5) * 0.008,
            vz: (Math.random() - 0.5) * 0.004,
            phase: Math.random() * Math.PI * 2,
            speed: 0.3 + Math.random() * 0.7,
            active: i < currentState.particleCount
        };
        particles.push(p);

        positions[i * 3] = p.x;
        positions[i * 3 + 1] = p.y;
        positions[i * 3 + 2] = p.z;

        const t = Math.random();
        const c = new THREE.Color().lerpColors(
            new THREE.Color(chapterStates.boot.colorSecondary),
            new THREE.Color(chapterStates.boot.colorPrimary),
            t
        );
        colors[i * 3] = c.r;
        colors[i * 3 + 1] = c.g;
        colors[i * 3 + 2] = c.b;

        sizes[i] = 1.5 + Math.random() * 2.5;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

    const particleMaterial = new THREE.ShaderMaterial({
        uniforms: {
            uPixelRatio: { value: renderer.getPixelRatio() }
        },
        vertexShader: `
            attribute float size;
            varying vec3 vColor;
            uniform float uPixelRatio;
            void main() {
                vColor = color;
                vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
                gl_PointSize = size * uPixelRatio * (180.0 / -mvPosition.z);
                gl_Position = projectionMatrix * mvPosition;
            }
        `,
        fragmentShader: `
            varying vec3 vColor;
            void main() {
                float dist = length(gl_PointCoord - vec2(0.5));
                if (dist > 0.5) discard;
                float alpha = 1.0 - smoothstep(0.3, 0.5, dist);
                gl_FragColor = vec4(vColor, alpha * 0.9);
            }
        `,
        transparent: true,
        vertexColors: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false
    });

    const pointCloud = new THREE.Points(geometry, particleMaterial);
    scene.add(pointCloud);

    // ==========================================
    // Connection Lines
    // ==========================================
    const maxLines = maxParticles * 3;
    const linePositions = new Float32Array(maxLines * 6);
    const lineGeometry = new THREE.BufferGeometry();
    lineGeometry.setAttribute('position', new THREE.BufferAttribute(linePositions, 3));
    lineGeometry.setDrawRange(0, 0);

    const lineMaterial = new THREE.LineBasicMaterial({
        color: chapterStates.boot.colorPrimary,
        transparent: true,
        opacity: chapterStates.boot.lineOpacity,
        blending: THREE.AdditiveBlending
    });

    const lineMesh = new THREE.LineSegments(lineGeometry, lineMaterial);
    scene.add(lineMesh);

    // ==========================================
    // Mouse Interaction
    // ==========================================
    const mouse = { x: 0, y: 0, active: false };
    const targetMouse = { x: 0, y: 0 };

    function onPointerMove(x, y) {
        targetMouse.x = (x / window.innerWidth) * 2 - 1;
        targetMouse.y = -(y / window.innerHeight) * 2 + 1;
        mouse.active = true;
    }

    document.addEventListener('mousemove', e => onPointerMove(e.clientX, e.clientY));
    document.addEventListener('touchmove', e => {
        if (e.touches.length > 0) onPointerMove(e.touches[0].clientX, e.touches[0].clientY);
    }, { passive: true });

    // ==========================================
    // Chapter State Update
    // ==========================================
    function updateTargetState() {
        const storyState = window.scrollStoryState || { currentChapter: 'boot', chapterProgress: 0 };
        const chapter = storyState.currentChapter || 'boot';
        const nextChapter = getNextChapter(chapter);
        const progress = storyState.chapterProgress || 0;

        const stateA = chapterStates[chapter] || chapterStates.boot;
        const stateB = chapterStates[nextChapter] || stateA;

        // Interpolate between current and next chapter based on scroll progress
        targetState.particleCount = lerp(stateA.particleCount, stateB.particleCount, progress);
        targetState.connectionDistance = lerp(stateA.connectionDistance, stateB.connectionDistance, progress);
        targetState.maxConnections = Math.round(lerp(stateA.maxConnections, stateB.maxConnections, progress));
        targetState.driftSpeed = lerp(stateA.driftSpeed, stateB.driftSpeed, progress);
        targetState.lineOpacity = lerp(stateA.lineOpacity, stateB.lineOpacity, progress);
        targetState.bloomStrength = lerp(stateA.bloomStrength, stateB.bloomStrength, progress);

        targetState.colorPrimary.setHex(stateA.colorPrimary);
        targetState.colorSecondary.setHex(stateA.colorSecondary);

        const tempColor = new THREE.Color();
        tempColor.setHex(stateB.colorPrimary);
        targetState.colorPrimary.lerp(tempColor, progress);

        tempColor.setHex(stateB.colorSecondary);
        targetState.colorSecondary.lerp(tempColor, progress);
    }

    function getNextChapter(current) {
        const order = ['boot', 'foundation', 'buildingBlocks', 'goingDeeper', 'convergence', 'connect'];
        const idx = order.indexOf(current);
        return order[Math.min(idx + 1, order.length - 1)];
    }

    function lerp(a, b, t) {
        return a + (b - a) * t;
    }

    // ==========================================
    // Animation Loop
    // ==========================================
    let time = 0;
    let isVisible = true;
    let rafId = null;

    document.addEventListener('visibilitychange', () => {
        isVisible = !document.hidden;
        if (isVisible && !rafId) animate();
    });

    function animate() {
        rafId = null;
        if (!isVisible) return;

        time += 0.01;

        // Update target state from scroll story
        updateTargetState();

        // Smoothly interpolate current state toward target
        currentState.particleCount = lerp(currentState.particleCount, targetState.particleCount, lerpFactor);
        currentState.connectionDistance = lerp(currentState.connectionDistance, targetState.connectionDistance, lerpFactor);
        currentState.maxConnections = Math.round(lerp(currentState.maxConnections, targetState.maxConnections, lerpFactor));
        currentState.driftSpeed = lerp(currentState.driftSpeed, targetState.driftSpeed, lerpFactor);
        currentState.lineOpacity = lerp(currentState.lineOpacity, targetState.lineOpacity, lerpFactor);
        currentState.bloomStrength = lerp(currentState.bloomStrength, targetState.bloomStrength, lerpFactor);
        currentState.colorPrimary.lerp(targetState.colorPrimary, lerpFactor);
        currentState.colorSecondary.lerp(targetState.colorSecondary, lerpFactor);

        // Update bloom
        bloomPass.strength = currentState.bloomStrength;

        // Update line material color and opacity
        lineMaterial.color.copy(currentState.colorPrimary);
        lineMaterial.opacity = currentState.lineOpacity;

        // Smooth mouse lerp
        mouse.x += (targetMouse.x - mouse.x) * 0.08;
        mouse.y += (targetMouse.y - mouse.y) * 0.08;

        const activeCount = Math.round(currentState.particleCount);
        const posArray = geometry.attributes.position.array;
        const colorArray = geometry.attributes.color.array;
        let lineIdx = 0;

        for (let i = 0; i < maxParticles; i++) {
            const p = particles[i];
            const i3 = i * 3;

            // Activate/deactivate particles based on count
            const shouldBeActive = i < activeCount;
            if (shouldBeActive && !p.active) {
                p.active = true;
                // Reset position when activating
                p.x = (Math.random() - 0.5) * 70;
                p.y = (Math.random() - 0.5) * 70;
                p.z = (Math.random() - 0.5) * 30;
            } else if (!shouldBeActive) {
                p.active = false;
                posArray[i3] = 9999;
                posArray[i3 + 1] = 9999;
                posArray[i3 + 2] = 9999;
                continue;
            }

            // Turbulent drift
            const drift = currentState.driftSpeed;
            p.x += p.vx + Math.sin(time * p.speed + p.phase) * 0.003;
            p.y += p.vy + Math.cos(time * p.speed + p.phase * 1.3) * 0.003;
            p.z += p.vz;

            // Wrap around boundaries
            if (p.x > 35) p.x = -35; if (p.x < -35) p.x = 35;
            if (p.y > 35) p.y = -35; if (p.y < -35) p.y = 35;
            if (p.z > 15) p.z = -15; if (p.z < -15) p.z = 15;

            // Mouse repulsion
            if (mouse.active) {
                const mdx = p.x - mouse.x * 25;
                const mdy = p.y - mouse.y * 25;
                const mdz = p.z;
                const mDist = Math.sqrt(mdx * mdx + mdy * mdy + mdz * mdz);
                if (mDist < 12 && mDist > 0.1) {
                    const force = (1 - mDist / 12) * 0.04;
                    p.x += (mdx / mDist) * force;
                    p.y += (mdy / mDist) * force;
                }
            }

            posArray[i3] = p.x;
            posArray[i3 + 1] = p.y;
            posArray[i3 + 2] = p.z;

            // Update particle color based on current state
            const t = (Math.sin(time * 0.5 + p.phase) + 1) * 0.5;
            const c = new THREE.Color().lerpColors(currentState.colorSecondary, currentState.colorPrimary, t);
            colorArray[i3] = c.r;
            colorArray[i3 + 1] = c.g;
            colorArray[i3 + 2] = c.b;

            // Connections
            let connections = 0;
            const connDist = currentState.connectionDistance;
            const maxConn = currentState.maxConnections;

            for (let j = i + 1; j < activeCount && connections < maxConn; j++) {
                const j3 = j * 3;
                const dx = p.x - posArray[j3];
                const dy = p.y - posArray[j3 + 1];
                const dz = p.z - posArray[j3 + 2];
                const distSq = dx * dx + dy * dy + dz * dz;

                if (distSq < connDist * connDist) {
                    const dist = Math.sqrt(distSq);
                    const alpha = 1 - dist / connDist;

                    linePositions[lineIdx++] = p.x;
                    linePositions[lineIdx++] = p.y;
                    linePositions[lineIdx++] = p.z;
                    linePositions[lineIdx++] = posArray[j3];
                    linePositions[lineIdx++] = posArray[j3 + 1];
                    linePositions[lineIdx++] = posArray[j3 + 2];

                    connections++;
                }
            }
        }

        geometry.attributes.position.needsUpdate = true;
        geometry.attributes.color.needsUpdate = true;

        lineGeometry.attributes.position.needsUpdate = true;
        lineGeometry.setDrawRange(0, lineIdx / 3);

        // Subtle scene rotation
        scene.rotation.y += 0.0003;
        scene.rotation.x = mouse.y * 0.05;
        scene.rotation.z = mouse.x * 0.02;

        composer.render();
        rafId = requestAnimationFrame(animate);
    }

    animate();

    // ==========================================
    // Resize Handler
    // ==========================================
    let resizeTimeout;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => {
            const w = window.innerWidth;
            const h = window.innerHeight;
            camera.aspect = w / h;
            camera.updateProjectionMatrix();
            renderer.setSize(w, h);
            composer.setSize(w, h);
            particleMaterial.uniforms.uPixelRatio.value = renderer.getPixelRatio();
        }, 100);
    });

})();
