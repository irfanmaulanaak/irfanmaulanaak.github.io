/**
 * Scroll-Story Animations - Terminal Editorial
 * Sticky context rails + beat reveals + chain-spine progress + one
 * scrub-driven diptych beat. Degrades gracefully if CDNs fail.
 */

(function () {
    'use strict';

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const hasGsap = typeof gsap !== 'undefined' && typeof ScrollTrigger !== 'undefined';

    if (hasGsap) gsap.registerPlugin(ScrollTrigger);

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
    // Scroll Progress Bar
    // ==========================================

    function initScrollProgress() {
        const progressBar = document.getElementById('scroll-progress');
        if (!progressBar) return;
        const update = () => {
            const scrollTop = window.scrollY;
            const docHeight = document.documentElement.scrollHeight - window.innerHeight;
            const progress = docHeight > 0 ? (scrollTop / docHeight) * 100 : 0;
            progressBar.style.width = progress + '%';
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
            navToggle.addEventListener('click', () => {
                const isActive = navToggle.classList.toggle('active');
                navLinks.classList.toggle('active');
                navToggle.setAttribute('aria-expanded', String(isActive));
            });
            navLinks.querySelectorAll('a').forEach((link) => {
                link.addEventListener('click', () => {
                    navToggle.classList.remove('active');
                    navLinks.classList.remove('active');
                    navToggle.setAttribute('aria-expanded', 'false');
                });
            });
        }
    }

    // ==========================================
    // Lenis Smooth Scroll
    // ==========================================

    let lenis;
    function initSmoothScroll() {
        if (typeof Lenis === 'undefined') return;
        lenis = new Lenis({
            duration: 1.15,
            easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
            direction: 'vertical',
            gestureDirection: 'vertical',
            smooth: !prefersReducedMotion,
            mouseMultiplier: 1,
            smoothTouch: false,
            touchMultiplier: 2,
            infinite: false
        });

        if (hasGsap) {
            lenis.on('scroll', () => ScrollTrigger.update());
            gsap.ticker.add((time) => lenis.raf(time * 1000));
            gsap.ticker.lagSmoothing(0, 0);
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
    // Milestone / Embed / Publication reveals
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
    // Hero PoW counters
    // ==========================================

    function initPowCounters() {
        const cards = document.querySelectorAll('.hero-pow-value');
        if (!cards.length) return;

        const runCounter = (card) => {
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
        };

        if ('IntersectionObserver' in window) {
            const io = new IntersectionObserver((entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        runCounter(entry.target);
                        io.unobserve(entry.target);
                    }
                });
            }, { threshold: 0.25 });
            cards.forEach((c) => io.observe(c));
        } else {
            cards.forEach(runCounter);
        }
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
        initPowCounters();

        if (!hasGsap) {
            // CDN failed: show everything, skip scroll choreography.
            revealAllBeats();
            document.querySelectorAll('.rail-line span').forEach((el) => {
                el.style.transform = 'scaleY(1)';
            });
            document.getElementById('diptych')?.classList.add('is-merged');
            return;
        }

        initChapterObserver();
        initBeatReveals();
        initRailLines();
        initMilestoneAnimations();
        initProjectEmbeds();
        initPublicationCard();
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
