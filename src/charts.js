/* Gráficas SVG sin dependencias, con tooltip y crosshair. */
(function (root) {
  'use strict';
  var NS = 'http://www.w3.org/2000/svg';
  function el(n, a, parent) {
    var e = document.createElementNS(NS, n);
    for (var k in a) { if (a[k] !== undefined && a[k] !== null) e.setAttribute(k, a[k]); }
    if (parent) parent.appendChild(e);
    return e;
  }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function fnum(x, d) { return Number(x).toFixed(d === undefined ? 2 : d).replace('.', ','); }
  function nice(lo, hi, n) {
    if (!(hi > lo)) { hi = lo + 1; }
    var step = (hi - lo) / (n || 5), m = Math.pow(10, Math.floor(Math.log10(step))), r = step / m;
    var s = (r < 1.5 ? 1 : r < 3 ? 2 : r < 7 ? 5 : 10) * m;
    var a = Math.floor(lo / s) * s, b = Math.ceil(hi / s) * s, t = [];
    for (var v = a; v <= b + s * 0.001; v += s) t.push(Math.abs(v) < s * 1e-6 ? 0 : v);
    return { lo: a, hi: b, ticks: t, dec: s >= 1 ? 0 : (s >= 0.1 ? 1 : (s >= 0.01 ? 2 : 3)) };
  }
  function frame(host, cfg) {
    host.innerHTML = '';
    host.classList.add('chart');
    var h = document.createElement('h4'); h.textContent = cfg.title; host.appendChild(h);
    if (cfg.sub) { var s = document.createElement('div'); s.className = 'sub'; s.textContent = cfg.sub; host.appendChild(s); }
    if (cfg.legend && cfg.legend.length > 1) {
      var l = document.createElement('div'); l.className = 'legend';
      l.innerHTML = cfg.legend.map(function (x) { return '<span><i class="' + (x.dash ? 'dashed' : (x.round ? 'round' : '')) + '" style="' + (x.dash ? 'color:' : 'background:') + 'var(' + x.color + ')"></i>' + esc(x.name) + '</span>'; }).join('');
      host.appendChild(l);
    }
    var tip = document.createElement('div'); tip.className = 'tip'; host.appendChild(tip);
    var svg = el('svg', { viewBox: '0 0 ' + cfg.W + ' ' + cfg.H, role: 'img', 'aria-label': cfg.title }, host);
    return { svg: svg, tip: tip };
  }
  function showTip(host, tip, evt, html) {
    tip.innerHTML = html; tip.style.display = 'block';
    var r = host.getBoundingClientRect();
    var x = evt.clientX - r.left + 12, y = evt.clientY - r.top + 12;
    if (x + tip.offsetWidth > r.width - 4) x = evt.clientX - r.left - tip.offsetWidth - 12;
    if (x < 2) x = 2;
    tip.style.left = x + 'px'; tip.style.top = y + 'px';
  }
  function hideTip(tip) { tip.style.display = 'none'; }

  /* Líneas xy con varias series, en un solo eje Y. */
  function xy(host, cfg) {
    var W = cfg.W || 560, H = cfg.H || 300, m = { l: 52, r: 16, t: 10, b: 42 };
    var f = frame(host, { title: cfg.title, sub: cfg.sub, W: W, H: H, legend: cfg.series.filter(function (s) { return !s.noLegend; }).map(function (s) { return { name: s.name, color: s.color, dash: s.dash, round: s.pointsOnly }; }) });
    var xs = [], ys = [];
    cfg.series.forEach(function (s) { s.pts.forEach(function (p) { xs.push(p[0]); ys.push(p[1]); }); });
    (cfg.marks || []).forEach(function (p) { xs.push(p.x); ys.push(p.y); });
    (cfg.hlines || []).forEach(function (p) { ys.push(p.y); });
    if (!xs.length) { host.appendChild(document.createTextNode('Sin datos')); return; }
    var X = nice(cfg.xmin !== undefined ? cfg.xmin : Math.min.apply(null, xs), cfg.xmax !== undefined ? cfg.xmax : Math.max.apply(null, xs), 6);
    var Y = nice(cfg.ymin !== undefined ? cfg.ymin : Math.min.apply(null, ys), cfg.ymax !== undefined ? cfg.ymax : Math.max.apply(null, ys), 5);
    var px = function (x) { return m.l + (x - X.lo) / (X.hi - X.lo) * (W - m.l - m.r); };
    var py = function (y) { return H - m.b - (y - Y.lo) / (Y.hi - Y.lo) * (H - m.t - m.b); };
    Y.ticks.forEach(function (t) {
      el('line', { x1: m.l, x2: W - m.r, y1: py(t), y2: py(t), class: t === Y.lo ? 'base' : 'gl' }, f.svg);
      var a = el('text', { x: m.l - 7, y: py(t) + 4, 'text-anchor': 'end', class: 'ax' }, f.svg); a.textContent = fnum(t, Y.dec);
    });
    X.ticks.forEach(function (t) {
      var a = el('text', { x: px(t), y: H - m.b + 15, 'text-anchor': 'middle', class: 'ax' }, f.svg); a.textContent = fnum(t, X.dec);
    });
    el('text', { x: (m.l + W - m.r) / 2, y: H - 6, 'text-anchor': 'middle', class: 'ax-t' }, f.svg).textContent = cfg.xlabel;
    el('text', { x: 13, y: (m.t + H - m.b) / 2, 'text-anchor': 'middle', class: 'ax-t', transform: 'rotate(-90 13 ' + ((m.t + H - m.b) / 2) + ')' }, f.svg).textContent = cfg.ylabel;
    (cfg.hlines || []).forEach(function (l) {
      el('line', { x1: m.l, x2: W - m.r, y1: py(l.y), y2: py(l.y), style: 'stroke:var(' + l.color + ');stroke-width:1.5;stroke-dasharray:6 4' }, f.svg);
      var t = el('text', { x: W - m.r - 3, y: py(l.y) - 5, 'text-anchor': 'end', class: 'lbl s' }, f.svg); t.textContent = l.label;
    });
    (cfg.vlines || []).forEach(function (l) {
      el('line', { x1: px(l.x), x2: px(l.x), y1: m.t, y2: H - m.b, style: 'stroke:var(' + l.color + ');stroke-width:1.5;stroke-dasharray:6 4' }, f.svg);
      var t = el('text', { x: px(l.x) + 4, y: m.t + 12, 'text-anchor': 'start', class: 'lbl s' }, f.svg); t.textContent = l.label;
    });
    cfg.series.forEach(function (s) {
      if (s.pointsOnly) {
        s.pts.forEach(function (p) { el('circle', { cx: px(p[0]), cy: py(p[1]), r: 4.5, style: 'fill:var(' + s.color + ');stroke:var(--surface);stroke-width:2' }, f.svg); });
        return;
      }
      var d = s.pts.filter(function (p) { return p[1] >= Y.lo && p[1] <= Y.hi; }).map(function (p, i) { return (i ? 'L' : 'M') + px(p[0]).toFixed(1) + ' ' + py(p[1]).toFixed(1); }).join('');
      el('path', { d: d, style: 'fill:none;stroke:var(' + s.color + ');stroke-width:2;stroke-linejoin:round;stroke-linecap:round;' + (s.dash ? 'stroke-dasharray:7 5' : '') }, f.svg);
    });
    (cfg.marks || []).forEach(function (mk) {
      if (mk.pulse) el('circle', { cx: px(mk.x), cy: py(mk.y), r: 12, class: 'pulse', style: 'fill:var(' + (mk.color || '--ink') + ')' }, f.svg);
      el('circle', { cx: px(mk.x), cy: py(mk.y), r: 5.5, style: 'fill:var(' + (mk.color || '--ink') + ');stroke:var(--surface);stroke-width:2' }, f.svg);
      if (mk.label) {
        var right = px(mk.x) < W - 170;
        var tx = el('text', { x: px(mk.x) + (right ? 10 : -10), y: py(mk.y) - 10, 'text-anchor': right ? 'start' : 'end', class: 'lbl m' }, f.svg);
        tx.textContent = mk.label;
      }
    });
    var cross = el('line', { y1: m.t, y2: H - m.b, class: 'base', style: 'display:none;stroke-dasharray:3 3' }, f.svg);
    var hit = el('rect', { x: m.l, y: m.t, width: W - m.l - m.r, height: H - m.t - m.b, fill: 'transparent' }, f.svg);
    var interp = function (pts, x) {
      if (pts.length < 2 || x < pts[0][0] || x > pts[pts.length - 1][0]) return null;
      for (var i = 1; i < pts.length; i++) if (x <= pts[i][0]) {
        var t = (x - pts[i - 1][0]) / ((pts[i][0] - pts[i - 1][0]) || 1);
        return pts[i - 1][1] + t * (pts[i][1] - pts[i - 1][1]);
      }
      return null;
    };
    hit.addEventListener('pointermove', function (e) {
      var r = f.svg.getBoundingClientRect(), sx = (e.clientX - r.left) / r.width * W;
      var x = X.lo + (sx - m.l) / (W - m.l - m.r) * (X.hi - X.lo);
      cross.setAttribute('x1', sx); cross.setAttribute('x2', sx); cross.style.display = '';
      var rows = cfg.series.filter(function (s) { return !s.pointsOnly; }).map(function (s) {
        var y = interp(s.pts, x);
        return y === null ? '' : esc(s.name) + ': ' + fnum(y, cfg.ydec === undefined ? 2 : cfg.ydec) + (cfg.yunit ? ' ' + cfg.yunit : '');
      }).filter(Boolean);
      showTip(host, f.tip, e, '<b>' + fnum(x, cfg.xdec === undefined ? 1 : cfg.xdec) + ' ' + esc(cfg.xunit || '') + '</b><br>' + rows.join('<br>'));
    });
    hit.addEventListener('pointerleave', function () { cross.style.display = 'none'; hideTip(f.tip); });
  }

  /* Barras (agrupadas o apiladas) con barras delgadas y referencias. */
  function bars(host, cfg) {
    var W = cfg.W || 560, H = cfg.H || 300, m = { l: 52, r: 16, t: 14, b: 40 };
    var stacked = cfg.stacked;
    var f = frame(host, { title: cfg.title, sub: cfg.sub, W: W, H: H, legend: cfg.series.map(function (s) { return { name: s.name, color: s.color, round: true }; }) });
    var ymax = 0;
    cfg.cats.forEach(function (_, i) {
      if (stacked) ymax = Math.max(ymax, cfg.series.reduce(function (t, s) { return t + (s.vals[i] || 0); }, 0));
      else cfg.series.forEach(function (s) { ymax = Math.max(ymax, s.vals[i] || 0); });
    });
    (cfg.refs || []).forEach(function (r) { ymax = Math.max(ymax, r.val); });
    (cfg.hlines || []).forEach(function (r) { ymax = Math.max(ymax, r.y); });
    var Y = nice(0, ymax * 1.05, 5);
    var py = function (y) { return H - m.b - (y - Y.lo) / (Y.hi - Y.lo) * (H - m.t - m.b); };
    Y.ticks.forEach(function (t) {
      el('line', { x1: m.l, x2: W - m.r, y1: py(t), y2: py(t), class: t === 0 ? 'base' : 'gl' }, f.svg);
      el('text', { x: m.l - 7, y: py(t) + 4, 'text-anchor': 'end', class: 'ax' }, f.svg).textContent = fnum(t, Y.dec);
    });
    el('text', { x: 13, y: (m.t + H - m.b) / 2, 'text-anchor': 'middle', class: 'ax-t', transform: 'rotate(-90 13 ' + ((m.t + H - m.b) / 2) + ')' }, f.svg).textContent = cfg.ylabel;
    var band = (W - m.l - m.r) / cfg.cats.length;
    cfg.cats.forEach(function (c, i) {
      var cx = m.l + band * (i + 0.5);
      el('text', { x: cx, y: H - m.b + 16, 'text-anchor': 'middle', class: 'ax-t' }, f.svg).textContent = c;
      var addHit = function (x, y, w, h, html) {
        var r = el('rect', { x: x - 3, y: Math.min(y, H - m.b - 8), width: w + 6, height: Math.max(h, 8), fill: 'transparent' }, f.svg);
        r.addEventListener('pointermove', function (e) { showTip(host, f.tip, e, html); });
        r.addEventListener('pointerleave', function () { hideTip(f.tip); });
      };
      if (stacked) {
        var acc = 0, bw = Math.min(46, band * 0.5);
        cfg.series.forEach(function (s, si) {
          var v = s.vals[i] || 0; if (v <= 0) return;
          var y1 = py(acc + v), y0 = py(acc);
          el('rect', { x: cx - bw / 2, y: y1, width: bw, height: Math.max(y0 - y1 - 2, 0.5), rx: si === cfg.series.length - 1 ? 3 : 0, style: 'fill:var(' + s.color + ')' }, f.svg);
          addHit(cx - bw / 2, y1, bw, y0 - y1, '<b>' + esc(c) + '</b><br>' + esc(s.name) + ': ' + fnum(v, 3) + ' ' + esc(cfg.unit || ''));
          acc += v;
        });
        if (cfg.showTotal !== false) {
          el('text', { x: cx, y: py(acc) - 6, 'text-anchor': 'middle', class: 'lbl m' }, f.svg).textContent = fnum(acc, 3);
        }
      } else {
        var vis = cfg.series.filter(function (s) { return s.vals[i] !== null && s.vals[i] !== undefined; });
        var bw2 = Math.min(30, band * 0.7 / Math.max(vis.length, 1));
        vis.forEach(function (s, si) {
          var v = s.vals[i];
          var x = cx - (vis.length * bw2) / 2 + si * bw2 + 1;
          el('rect', { x: x, y: py(v), width: bw2 - 2, height: Math.max(py(0) - py(v), 0.5), rx: 3, style: 'fill:var(' + s.color + ')' }, f.svg);
          addHit(x, py(v), bw2 - 2, py(0) - py(v), '<b>' + esc(c) + '</b><br>' + esc(s.name) + ': ' + fnum(v, 2) + ' ' + esc(cfg.unit || ''));
          el('text', { x: x + (bw2 - 2) / 2, y: py(v) - 5, 'text-anchor': 'middle', class: 'lbl m', style: 'font-size:10.5px' }, f.svg).textContent = fnum(v, 2);
        });
      }
      (cfg.refs || []).filter(function (r) { return r.i === i; }).forEach(function (r) {
        var bw3 = Math.min(band * 0.8, 96);
        el('line', { x1: cx - bw3 / 2, x2: cx + bw3 / 2, y1: py(r.val), y2: py(r.val), style: 'stroke:var(--ink);stroke-width:2;stroke-dasharray:5 3' }, f.svg);
        el('text', { x: cx + bw3 / 2, y: py(r.val) - 5, 'text-anchor': 'end', class: 'lbl s' }, f.svg).textContent = r.label;
      });
    });
    (cfg.hlines || []).forEach(function (l) {
      el('line', { x1: m.l, x2: W - m.r, y1: py(l.y), y2: py(l.y), style: 'stroke:var(' + l.color + ');stroke-width:1.5;stroke-dasharray:6 4' }, f.svg);
      el('text', { x: W - m.r - 3, y: py(l.y) - 5, 'text-anchor': 'end', class: 'lbl s' }, f.svg).textContent = l.label;
    });
  }

  /* Rangos normativos: valor frente a un intervalo permitido. */
  function ranges(host, cfg) {
    var W = cfg.W || 560, rowH = 58, H = cfg.items.length * rowH + 8;
    var f = frame(host, { title: cfg.title, sub: cfg.sub, W: W, H: H });
    cfg.items.forEach(function (it, i) {
      var y = i * rowH + 28, l = 16, r = W - 16;
      var top = Math.max(it.max, it.value * 1.1, it.hi || 0);
      var px = function (x) { return l + Math.min(x, top) / top * (r - l); };
      el('text', { x: l, y: y - 11, class: 'lbl' }, f.svg).textContent = it.label;
      var ok = it.value >= it.lo && it.value <= (it.hi === null ? Infinity : it.hi);
      el('text', { x: r, y: y - 11, 'text-anchor': 'end', class: 'lbl m', style: 'fill:var(' + (ok ? '--ok' : '--bad') + ')' }, f.svg).textContent = fnum(it.value, 2) + ' ' + it.unit + (ok ? ' · cumple' : ' · no cumple');
      el('rect', { x: l, y: y, width: r - l, height: 10, rx: 5, style: 'fill:var(--surface-2)' }, f.svg);
      var hi = it.hi === null ? top : it.hi;
      el('rect', { x: px(it.lo), y: y, width: Math.max(px(hi) - px(it.lo), 2), height: 10, rx: 3, style: 'fill:var(--ok-soft);stroke:var(--ok);stroke-width:1' }, f.svg);
      el('text', { x: px(it.lo), y: y + 23, 'text-anchor': 'middle', class: 'ax' }, f.svg).textContent = fnum(it.lo, 2);
      if (it.hi !== null) el('text', { x: px(hi), y: y + 23, 'text-anchor': 'middle', class: 'ax' }, f.svg).textContent = fnum(hi, 2);
      el('circle', { cx: px(it.value), cy: y + 5, r: 7, style: 'fill:var(' + (ok ? '--ok' : '--bad') + ');stroke:var(--surface);stroke-width:2' }, f.svg);
    });
  }

  root.Charts = { xy: xy, bars: bars, ranges: ranges, el: el, esc: esc, fnum: fnum };
})(typeof self !== 'undefined' ? self : this);
