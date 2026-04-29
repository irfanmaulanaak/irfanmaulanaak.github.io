/**
 * Scroll-Story Animations
 * Scrollytelling with terminal decode effects and chapter-aware triggers
 */

(function () {
    'use strict';

    // Register GSAP plugins
    gsap.registerPlugin(ScrollTrigger);

    // ==========================================
    // Global Chapter State (for Three.js)
    // ==========================================
    window.scrollStoryState = {
        currentChapter: 'boot',
        chapterProgress: 0
    };

    const chapters = ['boot', 'foundation', 'buildingBlocks', 'goingDeeper', 'convergence', 'connect'];

    // ==========================================
    // Loading Screen
    // ==========================================

    function hideLoader() {
        const loader = document.getElementById('loader');
        if (loader) {
            setTimeout(() => {
                loader.classList.add('hidden');
                document.body.style.overflow = '';
                // Trigger hero decode after loader
                setTimeout(decodeHeroElements, 300);
            }, 1500);
        }
    }

    document.body.style.overflow = 'hidden';
    window.addEventListener('load', hideLoader);

    // ==========================================
    // Text Decode Effect
    // ==========================================

    const decodeChars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';

    function decodeText(element, duration = 1200) {
        const originalText = element.dataset.original || element.textContent;
        element.dataset.original = originalText;
        const length = originalText.length;
        const startTime = performance.now();

        element.style.opacity = '1';

        function update(currentTime) {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const revealedCount = Math.floor(progress * length);

            let result = '';
            for (let i = 0; i < length; i++) {
                if (i < revealedCount) {
                    result += originalText[i];
                } else if (originalText[i] === ' ') {
                    result += ' ';
                } else {
                    result += decodeChars[Math.floor(Math.random() * decodeChars.length)];
                }
            }
            element.textContent = result;

            if (progress < 1) {
                requestAnimationFrame(update);
            } else {
                element.textContent = originalText;
                element.classList.add('decoded');
            }
        }

        requestAnimationFrame(update);
    }

    function decodeHeroElements() {
        const heroElements = document.querySelectorAll('#boot .decode-text');
        heroElements.forEach((el, i) => {
            setTimeout(() => decodeText(el, 1000), i * 200);
        });
    }

    // ==========================================
    // Story Panel Reveals
    // ==========================================

    function initStoryPanelReveals() {
        const panels = document.querySelectorAll('.story-panel');

        panels.forEach((panel) => {
            // Skip hero panel (handled separately)
            if (panel.closest('#boot')) return;

            gsap.to(panel, {
                scrollTrigger: {
                    trigger: panel,
                    start: 'top 85%',
                    end: 'top 50%',
                    toggleActions: 'play none none reverse',
                    onEnter: () => {
                        // Decode any text inside
                        const decodeElements = panel.querySelectorAll('.decode-text');
                        decodeElements.forEach((el, i) => {
                            setTimeout(() => decodeText(el, 800), i * 150);
                        });
                    }
                },
                opacity: 1,
                y: 0,
                duration: 0.8,
                ease: 'power3.out'
            });
        });
    }

    // ==========================================
    // Chapter State Observer
    // ==========================================

    function initChapterObserver() {
        const chapterSections = document.querySelectorAll('.chapter');
        const chapterDots = document.querySelectorAll('.chapter-dot');
        const navLinks = document.querySelectorAll('.nav-link');

        chapterSections.forEach((section) => {
            const chapterId = section.dataset.chapter;

            ScrollTrigger.create({
                trigger: section,
                start: 'top center',
                end: 'bottom center',
                onEnter: () => updateChapterState(chapterId),
                onEnterBack: () => updateChapterState(chapterId),
                onUpdate: (self) => {
                    window.scrollStoryState.chapterProgress = self.progress;
                }
            });
        });

        function updateChapterState(chapterId) {
            window.scrollStoryState.currentChapter = chapterId;

            // Update dots
            chapterDots.forEach((dot) => {
                dot.classList.toggle('active', dot.dataset.chapter === chapterId);
            });

            // Update nav links
            navLinks.forEach((link) => {
                const href = link.getAttribute('href').replace('#', '');
                const targetSection = document.querySelector(`[data-chapter="${href}"]`);
                link.classList.toggle('active', href === getSectionIdForChapter(chapterId));
            });
        }

        function getSectionIdForChapter(chapter) {
            const map = {
                'boot': 'boot',
                'foundation': 'foundation',
                'buildingBlocks': 'building-blocks',
                'goingDeeper': 'going-deeper',
                'convergence': 'convergence',
                'connect': 'connect'
            };
            return map[chapter] || 'boot';
        }
    }

    // ==========================================
    // Capability Bars
    // ==========================================

    function initCapabilityBars() {
        const bars = document.querySelectorAll('.capability-bar');

        bars.forEach((bar) => {
            const width = bar.dataset.width;
            if (width) {
                bar.style.setProperty('--bar-width', width + '%');
            }

            ScrollTrigger.create({
                trigger: bar,
                start: 'top 90%',
                onEnter: () => bar.classList.add('loaded'),
                onEnterBack: () => bar.classList.add('loaded')
            });
        });
    }

    // ==========================================
    // Scroll Progress Bar
    // ==========================================

    function initScrollProgress() {
        const progressBar = document.getElementById('scroll-progress');
        if (!progressBar) return;

        window.addEventListener('scroll', () => {
            const scrollTop = window.scrollY;
            const docHeight = document.documentElement.scrollHeight - window.innerHeight;
            const progress = (scrollTop / docHeight) * 100;
            progressBar.style.width = progress + '%';
        }, { passive: true });
    }

    // ==========================================
    // Chapter Dot Clicks
    // ==========================================

    function initChapterNav() {
        const dots = document.querySelectorAll('.chapter-dot');

        dots.forEach((dot) => {
            dot.addEventListener('click', () => {
                const chapter = dot.dataset.chapter;
                const sectionId = {
                    'boot': 'boot',
                    'foundation': 'foundation',
                    'buildingBlocks': 'building-blocks',
                    'goingDeeper': 'going-deeper',
                    'convergence': 'convergence',
                    'connect': 'connect'
                }[chapter];

                const target = document.getElementById(sectionId);
                if (target && lenis) {
                    lenis.scrollTo(target, { offset: -80 });
                } else if (target) {
                    target.scrollIntoView({ behavior: 'smooth' });
                }
            });
        });
    }

    // ==========================================
    // Navbar Scroll Effect
    // ==========================================

    function initNavbarEffect() {
        const navbar = document.getElementById('navbar');

        window.addEventListener('scroll', () => {
            if (window.scrollY > 50) {
                navbar.classList.add('scrolled');
            } else {
                navbar.classList.remove('scrolled');
            }
        }, { passive: true });

        // Mobile menu toggle
        const navToggle = document.getElementById('nav-toggle');
        const navLinks = document.getElementById('nav-links');

        if (navToggle && navLinks) {
            navToggle.addEventListener('click', () => {
                navToggle.classList.toggle('active');
                navLinks.classList.toggle('active');
            });

            navLinks.querySelectorAll('a').forEach((link) => {
                link.addEventListener('click', () => {
                    navToggle.classList.remove('active');
                    navLinks.classList.remove('active');
                });
            });
        }
    }

    // ==========================================
    // Smooth Scroll & Lenis
    // ==========================================

    let lenis;

    function initSmoothScroll() {
        if (typeof Lenis !== 'undefined') {
            lenis = new Lenis({
                duration: 1.2,
                easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
                direction: 'vertical',
                gestureDirection: 'vertical',
                smooth: true,
                mouseMultiplier: 1,
                smoothTouch: false,
                touchMultiplier: 2,
                infinite: false,
            });

            lenis.on('scroll', () => {
                ScrollTrigger.update();
            });

            gsap.ticker.add((time) => {
                lenis.raf(time * 1000);
            });

            gsap.ticker.lagSmoothing(0, 0);

            document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
                anchor.addEventListener('click', function (e) {
                    e.preventDefault();
                    const targetId = this.getAttribute('href');
                    const targetElement = document.querySelector(targetId);

                    if (targetElement) {
                        lenis.scrollTo(targetElement, { offset: -80 });
                    }
                });
            });
        }
    }

    // ==========================================
    // Milestone Markers Animation
    // ==========================================

    function initMilestoneAnimations() {
        const milestones = document.querySelectorAll('.milestone');

        milestones.forEach((milestone) => {
            gsap.from(milestone, {
                scrollTrigger: {
                    trigger: milestone,
                    start: 'top 85%',
                    toggleActions: 'play none none reverse'
                },
                opacity: 0,
                x: -20,
                duration: 0.6,
                ease: 'power3.out'
            });

            gsap.from(milestone.querySelector('.milestone-marker'), {
                scrollTrigger: {
                    trigger: milestone,
                    start: 'top 85%',
                    toggleActions: 'play none none reverse'
                },
                scale: 0,
                duration: 0.4,
                delay: 0.2,
                ease: 'back.out(1.7)'
            });
        });
    }

    // ==========================================
    // Project Embed Reveals
    // ==========================================

    function initProjectEmbeds() {
        const embeds = document.querySelectorAll('.project-embed');

        embeds.forEach((embed) => {
            gsap.from(embed, {
                scrollTrigger: {
                    trigger: embed,
                    start: 'top 90%',
                    toggleActions: 'play none none reverse'
                },
                opacity: 0,
                x: -30,
                duration: 0.7,
                ease: 'power3.out'
            });
        });
    }

    // ==========================================
    // Parallax on Hero Content
    // ==========================================

    function initParallaxEffects() {
        gsap.to('#boot .story-panel', {
            scrollTrigger: {
                trigger: '#boot',
                start: 'top top',
                end: 'bottom top',
                scrub: true
            },
            y: 80,
            opacity: 0.3,
            ease: 'none'
        });
    }

    // ==========================================
    // Publication Card Reveal
    // ==========================================

    function initPublicationCard() {
        const card = document.querySelector('.publication-card');
        if (!card) return;

        gsap.from(card, {
            scrollTrigger: {
                trigger: card,
                start: 'top 90%',
                toggleActions: 'play none none reverse'
            },
            opacity: 0,
            y: 40,
            duration: 0.8,
            ease: 'power3.out'
        });
    }

    // ==========================================
    // Initialize All
    // ==========================================

    function init() {
        initSmoothScroll();
        initNavbarEffect();
        initScrollProgress();
        initChapterNav();
        initChapterObserver();
        initStoryPanelReveals();
        initMilestoneAnimations();
        initProjectEmbeds();
        initCapabilityBars();
        initPublicationCard();
        initParallaxEffects();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
