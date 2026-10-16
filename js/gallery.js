(function () {
  var galleries = [].slice.call(document.querySelectorAll('.gallery'));
  if (!galleries.length) return;
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var DURATION = 4800;
  var HOLD_AFTER_TOUCH = 9000;
  var states = galleries.map(setup);
  var last = performance.now();

  function setup(g) {
    var track = g.querySelector('.g-track');
    var slides = [].slice.call(track.querySelectorAll('.g-slide'));
    var dotsWrap = g.querySelector('.g-dots');
    var count = g.querySelector('.g-count');
    var dots = slides.map(function (slide, i) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'g-dot';
      b.setAttribute('aria-label', 'Show screenshot ' + (i + 1) + ': ' + slide.querySelector('figcaption').textContent);
      b.innerHTML = '<span></span>';
      b.addEventListener('click', function () { go(i, true); });
      dotsWrap.appendChild(b);
      return b;
    });
    var st = { g: g, track: track, slides: slides, dots: dots, count: count, index: 0, elapsed: 0, hover: false, hold: 0, visible: false, go: go };

    function update() {
      slides.forEach(function (s, i) { s.classList.toggle('is-active', i === st.index); });
      dots.forEach(function (d, i) {
        d.toggleAttribute('aria-current', i === st.index);
        d.firstChild.style.transform = 'scaleX(' + (i < st.index ? 1 : 0) + ')';
      });
      count.textContent = (st.index + 1) + ' / ' + slides.length;
    }
    function go(i, byUser) {
      st.index = (i + slides.length) % slides.length;
      st.elapsed = 0;
      track.scrollTo({ left: slides[st.index].offsetLeft, behavior: reduce ? 'auto' : 'smooth' });
      if (byUser) st.hold = performance.now() + HOLD_AFTER_TOUCH;
      update();
    }
    g.querySelector('.g-prev').addEventListener('click', function () { go(st.index - 1, true); });
    g.querySelector('.g-next').addEventListener('click', function () { go(st.index + 1, true); });
    track.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowRight') { e.preventDefault(); go(st.index + 1, true); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); go(st.index - 1, true); }
    });
    var settle;
    track.addEventListener('scroll', function () {
      clearTimeout(settle);
      settle = setTimeout(function () {
        var i = Math.round(track.scrollLeft / track.clientWidth);
        if (i !== st.index) { st.index = Math.max(0, Math.min(slides.length - 1, i)); st.elapsed = 0; update(); }
      }, 90);
    }, { passive: true });
    ['pointerdown', 'touchstart', 'wheel'].forEach(function (ev) {
      track.addEventListener(ev, function () { st.hold = performance.now() + HOLD_AFTER_TOUCH; }, { passive: true });
    });
    g.addEventListener('mouseenter', function () { st.hover = true; });
    g.addEventListener('mouseleave', function () { st.hover = false; });
    g.addEventListener('focusin', function () { st.hover = true; });
    g.addEventListener('focusout', function () { st.hover = false; });
    update();
    return st;
  }

  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        var st = states[galleries.indexOf(e.target)];
        st.visible = e.isIntersecting;
        if (st.visible) e.target.querySelectorAll('img[loading="lazy"]').forEach(function (img) { img.loading = 'eager'; });
      });
    }, { threshold: 0.35 });
    galleries.forEach(function (g) { io.observe(g); });
  }

  if (reduce) return;

  function frame(now) {
    var dt = Math.min(100, now - last);
    last = now;
    states.forEach(function (st) {
      if (!st.visible) return;
      var paused = st.hover || now < st.hold || document.hidden;
      if (!paused) st.elapsed += dt;
      var p = Math.min(1, st.elapsed / DURATION);
      st.dots[st.index].firstChild.style.transform = 'scaleX(' + p.toFixed(3) + ')';
      if (p >= 1) st.go(st.index + 1, false);
    });
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  window.__gallery = states;
})();
