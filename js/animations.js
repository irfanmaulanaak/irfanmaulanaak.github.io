/**
 * Scroll-Story Animations - Terminal Editorial
 * Hero entrance timeline + sticky context rails + beat reveals +
 * chain-spine progress + one scrub-driven diptych beat.
 * Degrades gracefully if CDNs fail.
 */

(function () {
    'use strict';

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const hasGsap = typeof gsap !== 'undefined' && typeof ScrollTrigger !== 'undefined';

    if (hasGsap) gsap.registerPlugin(ScrollTrigger);

    // ==========================================
    // Hero entrance - masked name rise + stagger
    // ==========================================

    function revealHeroInstantly() {
        document.getElementById('boot')?.classList.add('hero-revealed');
    }

    function initHeroEntrance() {
        const hero = document.getElementById('boot');
        if (!hero) return;
        const nameParts = hero.querySelectorAll('.name-part');
        const staggerEls = hero.querySelectorAll('.hero-stagger');

        if (prefersReducedMotion) {
            revealHeroInstantly();
            runPowCounters();
            return;
        }

        gsap.set(nameParts, { yPercent: 110, opacity: 1 });
        gsap.set(staggerEls, { y: 18, opacity: 0 });

        gsap.timeline({
            defaults: { ease: 'power3.out' },
            onComplete: () => {
                hero.classList.add('hero-revealed');
                gsap.set([nameParts, staggerEls], { clearProps: 'all' });
            }
        })
            .to(nameParts, { yPercent: 0, duration: 1.05, ease: 'power4.out', stagger: 0.14 }, 0.15)
            .to(staggerEls, { y: 0, opacity: 1, duration: 0.7, stagger: 0.07 }, 0.5)
            .call(runPowCounters, null, 0.75);
    }

    // ==========================================
    // Beat Reveals
    // ==========================================

    function revealAllBeats() {
        document.querySelectorAll('.beat').forEach((beat) => beat.classList.add('is-visible'));
    }

    function initBeatReveals() {
        const beats = document.querySelectorAll('.beat');
        beats.forEach((beat) => {
            // Diptych runs its own scrub timeline - show its container right away.
            if (beat.classList.contains('beat-diptych')) {
                beat.classList.add('is-visible');
                return;
            }
            ScrollTrigger.create({
                trigger: beat,
                start: 'top 88%',
                onEnter: () => beat.classList.add('is-visible'),
                onEnterBack: () => beat.classList.add('is-visible')
            });
        });
    }

    // ==========================================
    // Chapter rail headers - number/label/title cascade
    // ==========================================

    function initRailReveals() {
        document.querySelectorAll('.chapter-rail').forEach((rail) => {
            const items = rail.querySelectorAll('.rail-number, .rail-label, .rail-title, .rail-tagline');
            if (!items.length) return;
            gsap.from(items, {
                scrollTrigger: { trigger: rail, start: 'top 82%' },
                opacity: 0,
                y: 26,
                duration: 0.8,
                ease: 'power3.out',
                stagger: 0.09,
                clearProps: 'all'
            });
        });
    }

    // ==========================================
    // Chapter State Observer - right-rail dots + nav highlight
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
                onEnterBack: () => updateChapterState(chapterId)
            });
        });

        function updateChapterState(chapterId) {
            chapterDots.forEach((dot) => {
                dot.classList.toggle('active', dot.dataset.chapter === chapterId);
            });
            navLinks.forEach((link) => {
                const isActive = link.getAttribute('href').replace('#', '') === chapterId;
                link.classList.toggle('active', isActive);
                if (isActive) link.setAttribute('aria-current', 'true');
                else link.removeAttribute('aria-current');
            });
        }
    }

    // ==========================================
    // Chain spine - rail line fills with chapter progress
    // ==========================================

    function initRailLines() {
        const sections = document.querySelectorAll('.chapter-narrative');
        sections.forEach((section) => {
            const fill = section.querySelector('.rail-line span');
            if (!fill) return;
            if (prefersReducedMotion) {
                fill.style.transform = 'scaleY(1)';
                return;
            }
            ScrollTrigger.create({
                trigger: section,
                start: 'top 60%',
                end: 'bottom 60%',
                onUpdate: (self) => {
                    fill.style.transform = 'scaleY(' + self.progress.toFixed(4) + ')';
                }
            });
        });
    }

    // ==========================================
    // Scroll Progress Bar - compositor-only scaleX
    // ==========================================

    function initScrollProgress() {
        const progressBar = document.getElementById('scroll-progress');
        if (!progressBar) return;
        const update = () => {
            const scrollTop = window.scrollY;
            const docHeight = document.documentElement.scrollHeight - window.innerHeight;
            const progress = docHeight > 0 ? scrollTop / docHeight : 0;
            progressBar.style.transform = 'scaleX(' + progress.toFixed(5) + ')';
        };
        window.addEventListener('scroll', update, { passive: true });
        update();
    }

    // ==========================================
    // Chapter Dot Clicks
    // ==========================================

    function initChapterNav() {
        const dots = document.querySelectorAll('.chapter-dot');
        dots.forEach((dot) => {
            dot.addEventListener('click', () => {
                const target = document.getElementById(dot.dataset.chapter);
                if (!target) return;
                if (lenis) lenis.scrollTo(target, { offset: -80 });
                else target.scrollIntoView({ behavior: 'smooth' });
            });
        });
    }

    // ==========================================
    // Navbar Scroll Effect + Mobile Toggle
    // ==========================================

    function initNavbarEffect() {
        const navbar = document.getElementById('navbar');
        window.addEventListener('scroll', () => {
            if (window.scrollY > 40) navbar.classList.add('scrolled');
            else navbar.classList.remove('scrolled');
        }, { passive: true });

        const navToggle = document.getElementById('nav-toggle');
        const navLinks = document.getElementById('nav-links');
        if (navToggle && navLinks) {
            const links = Array.from(navLinks.querySelectorAll('a'));

            const setMenuOpen = (isOpen, restoreFocus = false) => {
                navToggle.classList.toggle('active', isOpen);
                navLinks.classList.toggle('active', isOpen);
                navToggle.setAttribute('aria-expanded', String(isOpen));
                navToggle.setAttribute('aria-label', isOpen ? 'Close navigation' : 'Open navigation');
                document.body.classList.toggle('nav-open', isOpen);

                if (isOpen) links[0]?.focus();
                else if (restoreFocus) navToggle.focus();
            };

            navToggle.addEventListener('click', () => {
                setMenuOpen(!navLinks.classList.contains('active'), true);
            });

            links.forEach((link) => {
                link.addEventListener('click', () => {
                    setMenuOpen(false, true);
                });
            });

            document.addEventListener('keydown', (event) => {
                if (!navLinks.classList.contains('active')) return;

                if (event.key === 'Escape') {
                    event.preventDefault();
                    setMenuOpen(false, true);
                    return;
                }

                if (event.key !== 'Tab' || !links.length) return;
                const lastLink = links[links.length - 1];
                if (event.shiftKey && document.activeElement === navToggle) {
                    event.preventDefault();
                    lastLink.focus();
                } else if (!event.shiftKey && document.activeElement === lastLink) {
                    event.preventDefault();
                    navToggle.focus();
                }
            });

            window.matchMedia('(max-width: 768px)').addEventListener('change', (event) => {
                if (!event.matches) setMenuOpen(false);
            });
        }
    }

    // ==========================================
    // Lenis Smooth Scroll (1.x API)
    // ==========================================

    let lenis;
    function initSmoothScroll() {
        if (typeof Lenis === 'undefined' || prefersReducedMotion) return;
        lenis = new Lenis({
            duration: 1.15,
            easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
            orientation: 'vertical',
            gestureOrientation: 'vertical',
            smoothWheel: true,
            touchMultiplier: 2
        });

        if (hasGsap) {
            lenis.on('scroll', () => ScrollTrigger.update());
            gsap.ticker.add((time) => lenis.raf(time * 1000));
            gsap.ticker.lagSmoothing(0);
        } else {
            const raf = (time) => { lenis.raf(time); requestAnimationFrame(raf); };
            requestAnimationFrame(raf);
        }

        // Skip link is excluded: it must perform a plain jump for keyboard users.
        document.querySelectorAll('a[href^="#"]:not(.skip-link)').forEach((anchor) => {
            anchor.addEventListener('click', function (e) {
                const targetElement = document.querySelector(this.getAttribute('href'));
                if (!targetElement) return;
                e.preventDefault();
                lenis.scrollTo(targetElement, { offset: -80 });
            });
        });
    }

    // ==========================================
    // Milestone / Embed / Publication / Metric reveals
    // ==========================================

    function initMilestoneAnimations() {
        document.querySelectorAll('.milestone').forEach((milestone) => {
            gsap.from(milestone, {
                scrollTrigger: { trigger: milestone, start: 'top 88%', toggleActions: 'play none none reverse' },
                opacity: 0,
                x: -12,
                duration: 0.55,
                ease: 'power3.out'
            });
        });
    }

    function initProjectEmbeds() {
        document.querySelectorAll('.project-embed').forEach((embed) => {
            gsap.from(embed, {
                scrollTrigger: { trigger: embed, start: 'top 92%', toggleActions: 'play none none reverse' },
                opacity: 0,
                y: 16,
                duration: 0.6,
                ease: 'power3.out'
            });
        });
    }

    function initPublicationCard() {
        const card = document.querySelector('.publication-card');
        if (!card) return;
        gsap.from(card, {
            scrollTrigger: { trigger: card, start: 'top 92%', toggleActions: 'play none none reverse' },
            opacity: 0,
            y: 24,
            duration: 0.7,
            ease: 'power3.out'
        });
    }

    function initMetricReveals() {
        document.querySelectorAll('.role-metrics').forEach((row) => {
            const metrics = row.querySelectorAll('.metric');
            if (!metrics.length) return;
            gsap.from(metrics, {
                scrollTrigger: { trigger: row, start: 'top 92%' },
                opacity: 0,
                y: 14,
                duration: 0.5,
                ease: 'power2.out',
                stagger: 0.08,
                clearProps: 'all'
            });
        });
    }

    // ==========================================
    // Connect chapter - closing cascade
    // ==========================================

    function initConnectReveal() {
        const connect = document.getElementById('connect');
        if (!connect) return;
        const items = connect.querySelectorAll(
            '.connect-eyebrow, .connect-title, .status-line, .connect-narrative p, .contact-item, .contact-social, .btn-signed'
        );
        if (!items.length) return;
        gsap.from(items, {
            scrollTrigger: { trigger: connect, start: 'top 72%' },
            opacity: 0,
            y: 22,
            duration: 0.75,
            ease: 'power3.out',
            stagger: 0.07,
            clearProps: 'all'
        });
    }

    // ==========================================
    // Convergence Diptych - scrub-driven merge
    // ==========================================

    function initDiptych() {
        const diptych = document.getElementById('diptych');
        if (!diptych) return;
        const left = diptych.querySelector('.diptych-col.left');
        const right = diptych.querySelector('.diptych-col.right');
        const merge = diptych.querySelector('.diptych-merge');
        if (!left || !right || !merge) return;

        if (prefersReducedMotion) {
            diptych.classList.add('is-merged');
            return;
        }

        const isWide = window.matchMedia('(min-width: 769px)').matches;

        if (isWide) {
            gsap.set(left, { x: -120, opacity: 0.3 });
            gsap.set(right, { x: 120, opacity: 0.3 });
        } else {
            gsap.set(left, { y: -24, opacity: 0.3 });
            gsap.set(right, { y: 24, opacity: 0.3 });
        }
        gsap.set(merge, { scale: 0.5, opacity: 0.25 });

        const tl = gsap.timeline({
            scrollTrigger: {
                trigger: diptych,
                start: 'top 78%',
                end: 'bottom 55%',
                scrub: 0.7,
                onUpdate: (self) => {
                    if (self.progress > 0.82) diptych.classList.add('is-merged');
                    else diptych.classList.remove('is-merged');
                }
            }
        });

        if (isWide) {
            tl.to(left, { x: 0, opacity: 1, ease: 'power2.out' }, 0)
              .to(right, { x: 0, opacity: 1, ease: 'power2.out' }, 0);
        } else {
            tl.to(left, { y: 0, opacity: 1, ease: 'power2.out' }, 0)
              .to(right, { y: 0, opacity: 1, ease: 'power2.out' }, 0);
        }
        tl.to(merge, { scale: 1, opacity: 1, ease: 'power2.out' }, 0);
    }

    // ==========================================
    // Hero PoW counters - fired by the entrance timeline
    // (or immediately when GSAP is unavailable)
    // ==========================================

    function runPowCounters() {
        document.querySelectorAll('.hero-pow-value').forEach((card) => {
            if (card.dataset.counted === '1') return;
            card.dataset.counted = '1';
            const target = parseInt(card.dataset.target, 10);
            const valueEl = card.querySelector('.value');
            if (!valueEl || isNaN(target)) return;
            if (prefersReducedMotion) {
                valueEl.textContent = target;
                return;
            }
            const duration = 1400;
            const startTs = performance.now();
            (function tick(now) {
                const elapsed = now - startTs;
                const progress = Math.min(elapsed / duration, 1);
                const eased = 1 - Math.pow(1 - progress, 3);
                valueEl.textContent = Math.floor(target * eased);
                if (progress < 1) requestAnimationFrame(tick);
                else valueEl.textContent = target;
            })(performance.now());
        });
    }

    // ==========================================
    // Footer Year
    // ==========================================

    function initFooterYear() {
        const yearEl = document.getElementById('footer-year');
        if (yearEl) yearEl.textContent = new Date().getFullYear();
    }

    // ==========================================
    // Init
    // ==========================================

    function init() {
        initFooterYear();
        initSmoothScroll();
        initNavbarEffect();
        initScrollProgress();
        initChapterNav();

        if (!hasGsap) {
            // CDN failed: show everything, skip scroll choreography.
            revealHeroInstantly();
            runPowCounters();
            revealAllBeats();
            document.querySelectorAll('.rail-line span').forEach((el) => {
                el.style.transform = 'scaleY(1)';
            });
            document.getElementById('diptych')?.classList.add('is-merged');
            return;
        }

        initHeroEntrance();
        initChapterObserver();
        initBeatReveals();
        initRailReveals();
        initRailLines();
        initMilestoneAnimations();
        initProjectEmbeds();
        initPublicationCard();
        initMetricReveals();
        initConnectReveal();
        initDiptych();

        // Refresh after fonts/images settle so ScrollTrigger positions are accurate.
        window.addEventListener('load', () => {
            ScrollTrigger.refresh();
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
