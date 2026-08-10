(function () {
    'use strict';

    const world = document.getElementById('world');
    if (!world || typeof window.mountScrollWorld !== 'function') return;

    const asset = (kind, chapter, extension) =>
        `assets/scroll-world/${kind}/${chapter}.${extension}`;

    const chapters = [
        {
            id: 'boot',
            label: 'Boot',
            accent: '#9eff6b',
            scroll: 1.8,
            linger: 0.28,
            eyebrow: 'Web3 + AI full-stack engineer',
            title: 'I build systems that have to work.',
            body: 'Five years shipping production infrastructure—from smart contracts and real-time indexers to autonomous trading and self-hosted AI.',
            tags: ['20+ contracts', '6 DEX venues', 'Jakarta · remote'],
        },
        {
            id: 'foundation',
            label: 'Foundation',
            accent: '#d9a441',
            scroll: 1.45,
            eyebrow: 'Research into reality',
            title: 'Curiosity became proof.',
            body: 'My blockchain health-record thesis became a working Ethereum DApp and an ACM-published paper. The lesson stuck: research matters when it ships.',
            tags: ['B.Eng Computer Science', 'ACM SIET ’21', 'UNITY winner'],
        },
        {
            id: 'building-blocks',
            label: 'Building blocks',
            accent: '#f1e9dc',
            scroll: 1.45,
            eyebrow: 'Production Web3',
            title: 'From contracts to products.',
            body: 'I built DAOs, NFT marketplaces, governance systems, and dual fiat-and-crypto payment flows—secure boundaries, tested modules, real users.',
            tags: ['Solidity', 'TypeScript', 'Payments'],
        },
        {
            id: 'going-deeper',
            label: 'Going deeper',
            accent: '#7189a5',
            scroll: 1.5,
            eyebrow: 'The invisible layer',
            title: 'Then I owned the infrastructure.',
            body: 'For COSMIZE, I worked across custom RPC nodes, wallet security, event indexers, resilient WebSockets, and Astar smart contracts—the machinery beneath the world.',
            tags: ['Astar', 'RPC + indexers', 'Real-time systems'],
        },
        {
            id: 'convergence',
            label: 'Convergence',
            accent: '#9eff6b',
            scroll: 1.75,
            linger: 0.22,
            eyebrow: 'Selected systems',
            title: 'Web3 meets self-hosted intelligence.',
            body: 'Today I build cross-DEX automation, Flur’s vision-to-space pipeline, and Chronologic: self-hosted Qwen and Gemma models orchestrated across engineering workflows.',
            tags: ['Flur', 'Chronologic AI', 'Qwen · Gemma · agents'],
            cta: {
                primary: { label: 'Explore Flur', href: 'https://flur.horizonanalyticslabs.com/' },
                secondary: { label: 'View GitHub', href: 'https://github.com/irfanmaulanaak' },
            },
        },
        {
            id: 'connect',
            label: 'Connect',
            accent: '#d9a441',
            scroll: 1.85,
            linger: 0.35,
            eyebrow: 'Open to opportunities',
            title: 'Build the next system with me.',
            body: 'I’m looking for ambitious engineering work at the intersection of reliability, automation, Web3, and applied AI. Based in South Jakarta and open to remote teams.',
            tags: ['Full-stack', 'Web3', 'Applied AI'],
            cta: {
                primary: { label: 'Email Irfan', href: 'mailto:irfanmaulanaaaaa.im@gmail.com' },
                secondary: { label: 'LinkedIn', href: 'https://www.linkedin.com/in/irfan-maulana-akbar-18a211155/' },
            },
        },
    ].map((chapter) => ({
        ...chapter,
        still: asset('posters/desktop', chapter.id, 'jpg'),
        stillMobile: asset('posters/mobile', chapter.id, 'jpg'),
        clip: asset('video/desktop', chapter.id, 'mp4'),
        clipMobile: asset('video/mobile', chapter.id, 'mp4'),
    }));

    window.mountScrollWorld(world, {
        brand: { name: 'Irfan Maulana Akbar', href: '#top' },
        cta: { label: 'Let’s talk', href: 'mailto:irfanmaulanaaaaa.im@gmail.com' },
        hint: 'scroll to enter',
        diveScroll: 1.5,
        crossfade: 0.08,
        atmosphere: false,
        sections: chapters,
        connectors: [],
        connectorsMobile: [],
    });
})();
