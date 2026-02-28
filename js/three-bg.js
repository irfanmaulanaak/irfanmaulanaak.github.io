/**
 * Three.js Background Animation
 * Creates a dynamic 3D particle network effect
 */

(function () {
    'use strict';

    // Check if canvas exists
    const canvas = document.getElementById('bg-canvas');
    if (!canvas) return;

    // Scene setup
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.z = 30;

    // Renderer setup
    const renderer = new THREE.WebGLRenderer({
        canvas: canvas,
        antialias: true,
        alpha: true
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x0a0a0a, 1);

    // Particle system configuration
    const config = {
        particleCount: 200,
        particleSize: 0.15,
        connectionDistance: 8,
        mouseInfluence: 2,
        colors: {
            primary: 0x4a9eff,
            secondary: 0x8b5cf6
        }
    };

    // Create particles
    const particlesGeometry = new THREE.BufferGeometry();
    const positions = new Float32Array(config.particleCount * 3);
    const velocities = [];
    const colors = new Float32Array(config.particleCount * 3);

    const colorPrimary = new THREE.Color(config.colors.primary);
    const colorSecondary = new THREE.Color(config.colors.secondary);

    for (let i = 0; i < config.particleCount; i++) {
        // Random positions in 3D space
        positions[i * 3] = (Math.random() - 0.5) * 60;
        positions[i * 3 + 1] = (Math.random() - 0.5) * 60;
        positions[i * 3 + 2] = (Math.random() - 0.5) * 30;

        // Random velocities
        velocities.push({
            x: (Math.random() - 0.5) * 0.02,
            y: (Math.random() - 0.5) * 0.02,
            z: (Math.random() - 0.5) * 0.01
        });

        // Gradient colors
        const t = Math.random();
        const color = new THREE.Color().lerpColors(colorPrimary, colorSecondary, t);
        colors[i * 3] = color.r;
        colors[i * 3 + 1] = color.g;
        colors[i * 3 + 2] = color.b;
    }

    particlesGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    particlesGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    // Particle material
    const particlesMaterial = new THREE.PointsMaterial({
        size: config.particleSize,
        vertexColors: true,
        transparent: true,
        opacity: 0.8,
        blending: THREE.AdditiveBlending,
        sizeAttenuation: true
    });

    const particles = new THREE.Points(particlesGeometry, particlesMaterial);
    scene.add(particles);

    // Lines for connections
    const linesMaterial = new THREE.LineBasicMaterial({
        color: 0x4a9eff,
        transparent: true,
        opacity: 0.08,
        blending: THREE.AdditiveBlending
    });

    let linesGeometry = new THREE.BufferGeometry();
    let lines = new THREE.LineSegments(linesGeometry, linesMaterial);
    scene.add(lines);

    // Mouse tracking
    const mouse = { x: 0, y: 0 };
    let targetMouseX = 0;
    let targetMouseY = 0;

    document.addEventListener('mousemove', (event) => {
        targetMouseX = (event.clientX / window.innerWidth) * 2 - 1;
        targetMouseY = -(event.clientY / window.innerHeight) * 2 + 1;
    });

    // Window resize handler
    function onWindowResize() {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    }

    window.addEventListener('resize', onWindowResize);

    // Animation loop
    function animate() {
        requestAnimationFrame(animate);

        // Smooth mouse following
        mouse.x += (targetMouseX - mouse.x) * 0.05;
        mouse.y += (targetMouseY - mouse.y) * 0.05;

        // Update particle positions
        const positionsArray = particles.geometry.attributes.position.array;
        const linePositions = [];

        for (let i = 0; i < config.particleCount; i++) {
            const i3 = i * 3;

            // Apply velocity
            positionsArray[i3] += velocities[i].x;
            positionsArray[i3 + 1] += velocities[i].y;
            positionsArray[i3 + 2] += velocities[i].z;

            // Boundary wrapping
            if (positionsArray[i3] > 30) positionsArray[i3] = -30;
            if (positionsArray[i3] < -30) positionsArray[i3] = 30;
            if (positionsArray[i3 + 1] > 30) positionsArray[i3 + 1] = -30;
            if (positionsArray[i3 + 1] < -30) positionsArray[i3 + 1] = 30;
            if (positionsArray[i3 + 2] > 15) positionsArray[i3 + 2] = -15;
            if (positionsArray[i3 + 2] < -15) positionsArray[i3 + 2] = 15;

            // Mouse influence
            positionsArray[i3] += mouse.x * config.mouseInfluence * 0.01;
            positionsArray[i3 + 1] += mouse.y * config.mouseInfluence * 0.01;

            // Find connections (optimized: only check particles after this one)
            for (let j = i + 1; j < config.particleCount; j++) {
                const j3 = j * 3;
                const dx = positionsArray[i3] - positionsArray[j3];
                const dy = positionsArray[i3 + 1] - positionsArray[j3 + 1];
                const dz = positionsArray[i3 + 2] - positionsArray[j3 + 2];
                const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);

                if (distance < config.connectionDistance) {
                    linePositions.push(
                        positionsArray[i3], positionsArray[i3 + 1], positionsArray[i3 + 2],
                        positionsArray[j3], positionsArray[j3 + 1], positionsArray[j3 + 2]
                    );
                }
            }
        }

        particles.geometry.attributes.position.needsUpdate = true;

        // Update lines
        scene.remove(lines);
        linesGeometry.dispose();
        linesGeometry = new THREE.BufferGeometry();
        linesGeometry.setAttribute('position', new THREE.Float32BufferAttribute(linePositions, 3));
        lines = new THREE.LineSegments(linesGeometry, linesMaterial);
        scene.add(lines);

        // Rotate scene slightly
        scene.rotation.y += 0.0005;
        scene.rotation.x = mouse.y * 0.1;

        renderer.render(scene, camera);
    }

    // Start animation
    animate();

    // Reduce particle count on mobile for performance
    if (window.innerWidth < 768) {
        config.particleCount = 80;
        config.connectionDistance = 6;
    }

})();
