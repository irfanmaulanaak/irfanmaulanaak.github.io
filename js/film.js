(function () {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  var film = document.querySelector('.film');
  if (!film || !('IntersectionObserver' in window)) return;
  var net = navigator.connection;
  if (net && (net.saveData || /2g/.test(net.effectiveType || ''))) return;

  var root = document.documentElement;
  var stage = film.querySelector('.film-stage');
  var canvas = film.querySelector('.film-canvas');
  var ctx = canvas.getContext('2d');
  var calloutLayer = film.querySelector('.film-callouts');
  var bar = film.querySelector('.film-timeline');
  var total = parseInt(film.getAttribute('data-frames'), 10);
  var small = window.innerWidth < 760;
  var dir = 'assets/film/' + (small ? 'm' : 'd') + '/';
  var frames = new Array(total + 1);
  var STEP = small ? 2 : 1;
  var existing = [];
  for (var e = 1; e <= total; e++) if ((e - 1) % STEP === 0 || e === total) existing.push(e);
  function base(f) {
    if (f >= total) return total;
    return Math.min(total, 1 + Math.floor((f - 1) / STEP) * STEP);
  }
  function nextOf(a) { return a >= total ? total : Math.min(total, a + STEP); }
  var chapters = [].map.call(film.querySelectorAll('.film-chapter'), function (el) {
    return {
      el: el,
      from: +el.getAttribute('data-from'),
      to: +el.getAttribute('data-to'),
      lines: [].slice.call(el.querySelectorAll('.fc-line')),
      steps: [].slice.call(el.querySelectorAll('.fc-steps li'))
    };
  });
  var ticks = [].slice.call(bar.querySelectorAll('.ft-fill'));
  var callouts = [];
  var current = 1, target = 1, started = false;

  root.classList.add('film-on');

  function pad(n) { return ('000' + n).slice(-4); }
  function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
  function smooth(v) { v = clamp01(v); return v * v * (3 - 2 * v); }

  var canBitmap = 'createImageBitmap' in window;
  var decoded = [];
  var KEEP = small ? 14 : 18;

  function load(i) {
    if (existing.indexOf(i) < 0) return Promise.resolve();
    if (frames[i]) return frames[i].done;
    var src = dir + 'f' + pad(i) + '.webp';
    var fr = { src: location.origin + location.pathname.replace(/[^/]*$/, '') + src, ready: false, blob: null, bmp: null, busy: false };
    frames[i] = fr;
    function attempt(n) {
      return fetch(src + (n ? '?retry=' + n : '')).then(function (r) {
        if (!r.ok) throw new Error(r.status);
        return r.blob();
      }).then(function (b) {
        fr.blob = b;
        fr.ready = true;
        if (Math.abs(i - current) < 8) { decode(i); kick(); }
      }).catch(function () {
        if (n < 3) return new Promise(function (res) { setTimeout(res, 1500 * (n + 1)); }).then(function () { return attempt(n + 1); });
      });
    }
    fr.done = attempt(0);
    return fr.done;
  }

  function decode(i) {
    var fr = frames[i];
    if (!fr || !fr.blob || fr.bmp || fr.busy) return;
    fr.busy = true;
    var job = canBitmap ? createImageBitmap(fr.blob) : new Promise(function (res, rej) {
      var img = new Image();
      img.onload = function () { res(img); };
      img.onerror = rej;
      img.src = URL.createObjectURL(fr.blob);
    });
    job.then(function (bmp) {
      fr.bmp = bmp;
      fr.busy = false;
      decoded.push(i);
      while (decoded.length > KEEP) {
        var far = 0, farDist = -1;
        for (var k = 0; k < decoded.length; k++) {
          var d = Math.abs(decoded[k] - current);
          if (d > farDist) { farDist = d; far = k; }
        }
        var j = decoded.splice(far, 1)[0];
        var old = frames[j].bmp;
        frames[j].bmp = null;
        if (old && old.close) old.close();
        else if (old && old.src) URL.revokeObjectURL(old.src);
      }
      if (Math.abs(i - current) < 3) kick();
    }).catch(function () { fr.busy = false; });
  }

  function decodeAround(f, dirSign) {
    var c = base(Math.round(f));
    for (var d = 0; d <= 6; d++) {
      var ahead = c + d * STEP * (dirSign || 1), behind = c - d * STEP * (dirSign || 1);
      if (ahead >= 1 && ahead <= total) decode(ahead);
      if (d <= 2 && behind >= 1 && behind <= total) decode(behind);
    }
  }

  function loadPass(step) {
    var queue = [];
    for (var k = 0; k < existing.length; k += step) if (!frames[existing[k]]) queue.push(existing[k]);
    var k = 0;
    return new Promise(function (done) {
      var inflight = 0;
      function next() {
        while (inflight < 6 && k < queue.length) {
          inflight++;
          load(queue[k++]).then(function () { inflight--; next(); });
        }
        if (inflight === 0 && k >= queue.length) done();
      }
      next();
    });
  }
  function startLoading() {
    if (started) return;
    started = true;
    load(1);
    loadPass(8).then(function () { return loadPass(4); }).then(function () { return loadPass(2); }).then(function () { return loadPass(1); });
  }

  function nearest(i) {
    for (var d = 0; d < total; d++) {
      var a = frames[i - d], b = frames[i + d];
      if (a && a.bmp) return a.bmp;
      if (b && b.bmp) return b.bmp;
    }
    return null;
  }

  var view = { x: 0, y: 0, w: 0, h: 0 };
  function size() {
    var r = stage.getBoundingClientRect();
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(r.width * dpr);
    canvas.height = Math.round(r.height * dpr);
    var ratio = 1280 / 800;
    if (small) {
      var nav = document.querySelector('.navbar');
      var top = nav ? nav.offsetHeight : 100;
      var chapH = 0;
      chapters.forEach(function (ch) { chapH = Math.max(chapH, ch.el.offsetHeight); });
      var areaH = Math.max(180, r.height - 70 - chapH - 14 - top);
      var sc = Math.max(r.width / 1280, areaH / 800);
      view.w = 1280 * sc; view.h = 800 * sc;
      view.x = Math.min(0, Math.max(r.width - view.w, r.width / 2 - 0.56 * view.w));
      view.y = top + (areaH - view.h) / 2;
      stage.style.setProperty('--fade', Math.round(top + areaH) + 'px');
    } else {
      var s = Math.max(r.width / 1280, r.height / 800);
      view.w = 1280 * s; view.h = 800 * s; view.x = (r.width - view.w) / 2; view.y = (r.height - view.h) / 2;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    draw();
  }

  function draw() {
    var f = Math.max(1, Math.min(total, current));
    var a = base(f), b = nextOf(a), t = b > a ? (f - a) / (b - a) : 0;
    var A = frames[a] && frames[a].bmp ? frames[a].bmp : nearest(a), B = frames[b] && frames[b].bmp ? frames[b].bmp : null;
    ctx.fillStyle = '#111111';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    if (!A) return;
    ctx.globalAlpha = 1;
    ctx.drawImage(A, view.x, view.y, view.w, view.h);
    if (B && t > 0.02 && B !== A) {
      ctx.globalAlpha = t;
      ctx.drawImage(B, view.x, view.y, view.w, view.h);
      ctx.globalAlpha = 1;
    }
  }

  function buildCallouts(data) {
    data.tracks.forEach(function (tr) {
      var el = document.createElement('div');
      var tag = /^bz-/.test(tr.id) && tr.id !== 'bz-wallet' && tr.id !== 'bz-terminal';
      el.className = 'co' + (tag ? ' co-tag' : '');
      el.innerHTML = '<span class="co-dot"></span><span class="co-line"></span><span class="co-label"><span>' + tr.label + '</span></span>';
      calloutLayer.appendChild(el);
      callouts.push({ el: el, tr: tr, line: el.querySelector('.co-line'), label: el.querySelector('.co-label') });
    });
  }

  var navbar = document.querySelector('.navbar');
  function placeCallouts(f) {
    var shown = [];
    var stageW = stage.clientWidth;
    var navEnd = navbar ? navbar.getBoundingClientRect().bottom - stage.getBoundingClientRect().top : 0;
    callouts.forEach(function (c) {
      var tr = c.tr;
      var into = smooth((f - tr.from) / 8);
      var out = tr.to >= total ? 0 : smooth((f - (tr.to - 6)) / 6);
      var v = into * (1 - out);
      if (f < tr.from - 1 || f > tr.to + 1 || v <= 0.001) { c.el.style.opacity = '0'; return; }
      var idx = Math.max(0, Math.min(tr.pts.length - 1, Math.round(f - tr.from)));
      var p = tr.pts[idx];
      var x = view.x + p[0] * view.w, y = view.y + p[1] * view.h;
      var lw = c.label.offsetWidth, lh = c.label.offsetHeight;
      var flip = x + lw + 12 > stageW;
      c.el.classList.toggle('co-flip', flip);
      var reach = c.label.offsetTop;
      var box = { l: flip ? x - lw - 4 : x - 4, r: flip ? x + 4 : x + lw + 4, t: y + reach - 4, b: y + 8 };
      var clash = shown.some(function (s) { return box.l < s.r && box.r > s.l && box.t < s.b && box.b > s.t; });
      if (clash || box.t < navEnd + 4 || x < 0 || x > stageW) { c.el.style.opacity = '0'; return; }
      shown.push(box);
      c.el.style.opacity = (1 - out).toFixed(3);
      c.el.style.transform = 'translate(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px)';
      c.el.style.setProperty('--d', smooth(into * 1.6).toFixed(3));
      c.el.style.setProperty('--r', smooth(into * 1.8 - 0.6).toFixed(3));
    });
  }

  function placeTitles(f) {
    chapters.forEach(function (ch, k) {
      var q = (f - ch.from) / (ch.to - ch.from);
      var active = q > -0.05 && q < 1.05;
      ch.el.classList.toggle('on', active);
      ch.lines.forEach(function (line, i) {
        var lead = i * 0.025;
        var into = smooth((q - lead) / 0.12);
        var out = k === chapters.length - 1 ? 0 : smooth((q - 0.92 + lead) / 0.08);
        line.style.transform = 'translateY(' + ((1 - into) * 105 - out * 40).toFixed(1) + '%)';
        line.style.opacity = (1 - out).toFixed(3);
      });
      ch.steps.forEach(function (li, j) {
        var at = 0.18 + j * 0.24;
        var into = smooth((q - at) / 0.08);
        var out = k === chapters.length - 1 ? 0 : smooth((q - 0.9) / 0.08);
        li.style.setProperty('--s', (into * (1 - out)).toFixed(3));
      });
      if (ticks[k]) ticks[k].style.transform = 'scaleX(' + clamp01((f - ch.from) / Math.max(1, ch.to - ch.from - 1)).toFixed(3) + ')';
    });
  }

  function readTarget() {
    var r = film.getBoundingClientRect();
    var span = r.height - window.innerHeight;
    var p = span > 0 ? clamp01(-r.top / span) : 0;
    target = 1 + p * (total - 1);
    if (r.top < window.innerHeight * (small ? 1.4 : 2.5) && document.readyState === 'complete') startLoading();
  }

  var running = false;
  function tick() {
    readTarget();
    var diff = target - current;
    decodeAround(current + diff * 0.5, diff >= 0 ? 1 : -1);
    current += Math.abs(diff) < 0.02 ? diff : diff * 0.22;
    draw();
    placeTitles(current);
    placeCallouts(current);
    if (Math.abs(target - current) > 0.01) requestAnimationFrame(tick);
    else running = false;
  }
  function kick() { if (!running) { running = true; requestAnimationFrame(tick); } }

  window.addEventListener('scroll', kick, { passive: true });
  window.addEventListener('resize', function () { size(); kick(); });
  window.addEventListener('load', function () { readTarget(); size(); kick(); });
  fetch('assets/film/tracks.json').then(function (r) { return r.json(); }).then(function (data) {
    buildCallouts(data);
    kick();
  }).catch(function () {});
  size();
  readTarget();
  current = target;
  kick();
  window.__film = { get frame() { return current; }, frames: frames };
})();
