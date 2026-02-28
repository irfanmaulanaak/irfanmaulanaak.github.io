/**
 * GSAP Animations
 * Scroll-triggered animations and hero reveal effects
 */

(function () {
    'use strict';

    // Register GSAP plugins
    gsap.registerPlugin(ScrollTrigger);

    // ==========================================
    // Loading Screen
    // ==========================================

    function hideLoader() {
        const loader = document.getElementById('loader');
        if (loader) {
            // Minimum display time for effect
            setTimeout(() => {
                loader.classList.add('hidden');
                // Enable scrolling after loader hides
                document.body.style.overflow = '';
            }, 1500);
        }
    }

    // Disable scrolling while loading
    document.body.style.overflow = 'hidden';

    // Hide loader when page is fully loaded
    window.addEventListener('load', hideLoader);

    // ==========================================
    // Hero Section Animations
    // ==========================================

    function initHeroAnimations() {
        const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });

        tl.to('.hero-greeting', {
            opacity: 1,
            y: 0,
            duration: 0.8,
            delay: 0.5
        })
            .to('.name-part.first', {
                opacity: 1,
                y: 0,
                duration: 0.8
            }, '-=0.4')
            .to('.name-part.last', {
                opacity: 1,
                y: 0,
                duration: 0.8
            }, '-=0.5')
            .to('.hero-title', {
                opacity: 1,
                y: 0,
                duration: 0.8
            }, '-=0.4')
            .to('.hero-tagline', {
                opacity: 1,
                y: 0,
                duration: 0.8
            }, '-=0.4')
            .to('.hero-cta', {
                opacity: 1,
                y: 0,
                duration: 0.8
            }, '-=0.4')
            .to('.hero-social', {
                opacity: 1,
                y: 0,
                duration: 0.8
            }, '-=0.4');
    }

    // ==========================================
    // Section Title Animations
    // ==========================================

    function initSectionAnimations() {
        // Section titles with enhanced fade + scale effect
        gsap.utils.toArray('.section-title').forEach(title => {
            gsap.to(title, {
                scrollTrigger: {
                    trigger: title,
                    start: 'top 85%',
                    end: 'top 50%',
                    toggleActions: 'play none none reverse',
                    scrub: false
                },
                opacity: 1,
                y: 0,
                scale: 1,
                duration: 1,
                ease: 'power3.out'
            });

            // Animate title number and text separately for stagger effect
            const titleNumber = title.querySelector('.title-number');
            const titleText = title.querySelector('.title-text');

            if (titleNumber) {
                gsap.from(titleNumber, {
                    scrollTrigger: {
                        trigger: title,
                        start: 'top 85%',
                        toggleActions: 'play none none reverse'
                    },
                    opacity: 0,
                    x: -30,
                    duration: 0.6,
                    delay: 0.2,
                    ease: 'power2.out'
                });
            }

            if (titleText) {
                gsap.from(titleText, {
                    scrollTrigger: {
                        trigger: title,
                        start: 'top 85%',
                        toggleActions: 'play none none reverse'
                    },
                    opacity: 0,
                    y: 30,
                    scale: 0.95,
                    duration: 0.8,
                    delay: 0.3,
                    ease: 'power3.out'
                });
            }
        });

        // Glass cards with stagger
        gsap.utils.toArray('.glass-card').forEach((card, i) => {
            gsap.from(card, {
                scrollTrigger: {
                    trigger: card,
                    start: 'top 90%',
                    toggleActions: 'play none none reverse'
                },
                opacity: 0,
                y: 60,
                scale: 0.95,
                duration: 0.7,
                delay: i % 3 * 0.1,
                ease: 'power3.out'
            });
        });
    }

    // ==========================================
    // About Section Animations
    // ==========================================

    function initAboutAnimations() {
        // Image reveal
        gsap.from('.about-image', {
            scrollTrigger: {
                trigger: '.about-content',
                start: 'top 70%',
                toggleActions: 'play none none reverse'
            },
            opacity: 0,
            x: -50,
            duration: 0.8,
            ease: 'power3.out'
        });

        // Text paragraphs stagger
        gsap.from('.about-text p', {
            scrollTrigger: {
                trigger: '.about-text',
                start: 'top 70%',
                toggleActions: 'play none none reverse'
            },
            opacity: 0,
            y: 30,
            stagger: 0.2,
            duration: 0.6,
            ease: 'power3.out'
        });

        // Stats counter animation
        gsap.utils.toArray('.stat-number').forEach(stat => {
            const value = parseInt(stat.textContent);
            gsap.from(stat, {
                scrollTrigger: {
                    trigger: stat,
                    start: 'top 85%',
                    toggleActions: 'play none none reverse'
                },
                textContent: 0,
                duration: 2,
                ease: 'power1.out',
                snap: { textContent: 1 },
                onUpdate: function () {
                    stat.textContent = Math.round(this.targets()[0].textContent) + '+';
                }
            });
        });
    }

    // ==========================================
    // Experience Timeline Animations
    // ==========================================

    function initExperienceAnimations() {
        gsap.utils.toArray('.timeline-item').forEach((item, i) => {
            const direction = i % 2 === 0 ? -50 : 50;

            gsap.from(item, {
                scrollTrigger: {
                    trigger: item,
                    start: 'top 80%',
                    toggleActions: 'play none none reverse'
                },
                opacity: 0,
                x: direction,
                duration: 0.8,
                ease: 'power3.out'
            });

            // Marker animation
            gsap.from(item.querySelector('.timeline-marker'), {
                scrollTrigger: {
                    trigger: item,
                    start: 'top 80%',
                    toggleActions: 'play none none reverse'
                },
                scale: 0,
                duration: 0.4,
                delay: 0.3,
                ease: 'back.out(1.7)'
            });
        });
    }

    // ==========================================
    // Skills Animation
    // ==========================================

    function initSkillsAnimations() {
        gsap.utils.toArray('.skill-item').forEach((item, i) => {
            gsap.from(item, {
                scrollTrigger: {
                    trigger: item.closest('.skill-category'),
                    start: 'top 80%',
                    toggleActions: 'play none none reverse'
                },
                opacity: 0,
                scale: 0.8,
                duration: 0.3,
                delay: i * 0.05,
                ease: 'back.out(1.7)'
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
        });

        // Mobile menu toggle
        const navToggle = document.getElementById('nav-toggle');
        const navLinks = document.getElementById('nav-links');

        if (navToggle && navLinks) {
            navToggle.addEventListener('click', () => {
                navToggle.classList.toggle('active');
                navLinks.classList.toggle('active');
            });

            // Close menu when clicking a link
            navLinks.querySelectorAll('a').forEach(link => {
                link.addEventListener('click', () => {
                    navToggle.classList.remove('active');
                    navLinks.classList.remove('active');
                });
            });
        }
    }

    // ==========================================
    // Active Nav Link Highlighting
    // ==========================================

    function initActiveNavLinks() {
        const sections = document.querySelectorAll('section[id]');
        const navLinks = document.querySelectorAll('.nav-link');

        function highlightNavLink() {
            const scrollY = window.scrollY;

            sections.forEach(section => {
                const sectionHeight = section.offsetHeight;
                const sectionTop = section.offsetTop - 100;
                const sectionId = section.getAttribute('id');

                if (scrollY > sectionTop && scrollY <= sectionTop + sectionHeight) {
                    navLinks.forEach(link => {
                        link.classList.remove('active');
                        if (link.getAttribute('href') === `#${sectionId}`) {
                            link.classList.add('active');
                        }
                    });
                }
            });
        }

        window.addEventListener('scroll', highlightNavLink);
    }

    // ==========================================
    // Smooth Scroll
    // ==========================================

    function initSmoothScroll() {
        document.querySelectorAll('a[href^="#"]').forEach(anchor => {
            anchor.addEventListener('click', function (e) {
                e.preventDefault();
                const targetId = this.getAttribute('href');
                const targetElement = document.querySelector(targetId);

                if (targetElement) {
                    const offsetTop = targetElement.offsetTop - 80;

                    gsap.to(window, {
                        scrollTo: offsetTop,
                        duration: 1,
                        ease: 'power3.inOut'
                    });
                }
            });
        });
    }

    // ==========================================
    // Parallax Effects
    // ==========================================

    function initParallaxEffects() {
        // Subtle parallax on hero section
        gsap.to('.hero-content', {
            scrollTrigger: {
                trigger: '.hero',
                start: 'top top',
                end: 'bottom top',
                scrub: true
            },
            y: 100,
            opacity: 0.3
        });
    }

    // ==========================================
    // Contact Section Animation
    // ==========================================

    function initContactAnimations() {
        gsap.from('.contact-content', {
            scrollTrigger: {
                trigger: '.contact',
                start: 'top 70%',
                toggleActions: 'play none none reverse'
            },
            opacity: 0,
            y: 50,
            duration: 0.8,
            ease: 'power3.out'
        });

        gsap.from('.social-link', {
            scrollTrigger: {
                trigger: '.contact-social',
                start: 'top 85%',
                toggleActions: 'play none none reverse'
            },
            opacity: 0,
            y: 20,
            stagger: 0.1,
            duration: 0.5,
            ease: 'back.out(1.7)'
        });
    }

    // ==========================================
    // Horizontal Scroll (Pinned Sections)
    // ==========================================

    function initHorizontalScroll() {
        // Reset scroll position on page load to prevent starting at wrong section
        window.scrollTo(0, 0);

        // Setup pinned horizontal scroll for sections with horizontal content
        const horizontalSections = [
            { wrapper: '.experience', container: '.experience-timeline' },
            { wrapper: '.projects', container: '.projects-grid' }
        ];

        horizontalSections.forEach(({ wrapper, container }) => {
            const wrapperEl = document.querySelector(wrapper);
            const containerEl = document.querySelector(container);

            if (!wrapperEl || !containerEl) return;

            // Calculate horizontal scroll distance: total content width minus viewport width
            const getScrollAmount = () => {
                return containerEl.scrollWidth - window.innerWidth;
            };

            // Only set up if there's content to scroll
            if (getScrollAmount() <= 0) return;

            gsap.to(containerEl, {
                x: () => -getScrollAmount(),
                ease: 'none',
                scrollTrigger: {
                    trigger: wrapperEl,
                    start: 'top top',
                    end: () => `+=${getScrollAmount()}`,
                    scrub: 1,
                    pin: true,
                    anticipatePin: 1,
                    invalidateOnRefresh: true
                }
            });
        });
    }

    // ==========================================
    // Initialize All Animations
    // ==========================================

    function init() {
        initHeroAnimations();
        initNavbarEffect();
        initActiveNavLinks();
        initSectionAnimations();
        initAboutAnimations();
        initExperienceAnimations();
        initSkillsAnimations();
        initContactAnimations();
        initParallaxEffects();
        initHorizontalScroll();
    }

    // Wait for DOM to be ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
