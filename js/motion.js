(function () {
  if (!('IntersectionObserver' in window)) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  var root = document.documentElement;
  root.classList.add('motion');

  document.querySelectorAll('h1, h2, .chapter-title').forEach(function (heading) {
    var parts = heading.innerHTML.split(/<br\s*\/?>/i);
    heading.innerHTML = parts.map(function (part, i) {
      return '<span class="line"><span class="line-inner" style="--i:' + i + '">' + part + '</span></span>';
    }).join('');
    heading.classList.add('split');
  });

  requestAnimationFrame(function () {
    requestAnimationFrame(function () { root.classList.add('loaded'); });
  });

  var groups = [
    '.section-heading',
    '.chapter-copy',
    '.project',
    '.archive-project',
    '.job',
    '.about-grid > div',
    '.skills > div',
    '.contact .wrap > *'
  ];
  var targets = [];
  groups.forEach(function (selector) {
    var seen = new Map();
    document.querySelectorAll(selector).forEach(function (el) {
      if (el.closest('.hero')) return;
      var parent = el.parentElement;
      var index = seen.get(parent) || 0;
      seen.set(parent, index + 1);
      el.classList.add('reveal');
      el.style.setProperty('--d', Math.min(index, 5) * 90 + 'ms');
      targets.push(el);
    });
  });

  var observer = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('in');
      entry.target.querySelectorAll('[data-count]').forEach(countUp);
      observer.unobserve(entry.target);
    });
  }, { rootMargin: '0px 0px -10% 0px', threshold: 0.12 });
  targets.forEach(function (el) { observer.observe(el); });
  function revealPassed() {
    for (var i = 0; i < targets.length; i++) {
      var el = targets[i];
      if (!el.classList.contains('in') && el.getBoundingClientRect().top < window.innerHeight * 0.9) {
        el.classList.add('in');
        el.querySelectorAll('[data-count]').forEach(countUp);
        observer.unobserve(el);
      }
    }
  }
  window.addEventListener('scroll', revealPassed, { passive: true });

  function countUp(el) {
    var end = parseInt(el.getAttribute('data-count'), 10);
    var start = performance.now();
    var duration = 1200;
    function step(now) {
      var t = Math.min((now - start) / duration, 1);
      el.textContent = Math.round(end * (1 - Math.pow(1 - t, 3)));
      if (t < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  var videos = document.querySelectorAll('.loop video');
  var videoObserver = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      var v = entry.target;
      if (entry.isIntersecting) {
        if (v.preload === 'none') { v.preload = 'auto'; }
        var p = v.play(); if (p && p.catch) p.catch(function () {});
      } else {
        v.pause();
      }
    });
  }, { threshold: 0.25 });
  videos.forEach(function (v) { videoObserver.observe(v); });

  var bar = document.createElement('div');
  bar.className = 'scroll-progress';
  bar.setAttribute('aria-hidden', 'true');
  document.body.appendChild(bar);
  var ticking = false;
  function update() {
    var max = document.documentElement.scrollHeight - window.innerHeight;
    bar.style.transform = 'scaleX(' + (max > 0 ? window.scrollY / max : 0) + ')';
    ticking = false;
  }
  window.addEventListener('scroll', function () {
    if (!ticking) { ticking = true; requestAnimationFrame(update); }
  }, { passive: true });
  update();
})();
