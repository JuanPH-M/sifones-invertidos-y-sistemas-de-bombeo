/* Esquemas paramétricos en SVG: se redibujan con las dimensiones calculadas y rotulan entradas y salidas. */
(function (root) {
  'use strict';
  var el = function (n, a, p) { return root.Charts.el(n, a, p); };
  var f = function (x, d) { return root.Charts.fnum(x, d === undefined ? 2 : d); };
  function text(svg, x, y, s, cls, anchor) {
    var t = el('text', { x: x, y: y, class: 'lbl ' + (cls || ''), 'text-anchor': anchor || 'start' }, svg);
    t.textContent = s;
    return t;
  }
  function flow(svg, d, V, width, color) {
    // Una vuelta del patrón (44 unidades) tarda menos cuanto mayor es la velocidad real
    var dur = Math.max(0.25, 1.7 / Math.max(V, 0.05));
    return el('path', { d: d, class: 'flowline', style: 'stroke:' + (color || '#ffffff') + ';stroke-width:' + width + ';stroke-dasharray:6 16;opacity:.95;animation-duration:' + dur.toFixed(2) + 's' }, svg);
  }
  function arrowDefs(svg) {
    var defs = el('defs', {}, svg);
    var m = el('marker', { id: 'arr', viewBox: '0 0 10 10', refX: 9, refY: 5, markerWidth: 7, markerHeight: 7, orient: 'auto-start-reverse' }, defs);
    el('path', { d: 'M0 0L10 5L0 10z', style: 'fill:var(--ink-2)' }, m);
  }
  function dim(svg, x1, y1, x2, y2, label, anchor, dx, dy) {
    el('line', { x1: x1, y1: y1, x2: x2, y2: y2, 'marker-start': 'url(#arr)', 'marker-end': 'url(#arr)', style: 'stroke:var(--ink-2);stroke-width:1' }, svg);
    if (label) text(svg, (x1 + x2) / 2 + (dx || 0), (y1 + y2) / 2 + (dy || 0), label, 'm', anchor || 'middle');
  }

  /* ---------- Perfil del sifón ---------- */
  function sifon(host, res, idx) {
    host.innerHTML = '';
    var c = res.ctx, v = res.v;
    if (!c.casos || !c.perfil) return false;
    var o = c.casos[idx], prof = c.perfil.casos[idx];
    var W = 1160, H = 620;
    var svg = el('svg', { viewBox: '0 0 ' + W + ' ' + H, role: 'img', 'aria-label': 'Perfil del sifón invertido para ' + o.key }, host);
    arrowDefs(svg);

    var mx0 = 280, mx1 = W - 280, top = 104, bot = H - 118;
    var zs = [v.Zf - 1, v.Ze + res.ctx.ent[idx].y, o.Ee_req, o.Ee_disp, v.Znivel, v.Zobs, v.Zs];
    var zmax = Math.max.apply(null, zs) + 0.8, zmin = Math.min.apply(null, zs);
    var X = function (x) { return mx0 + x / (v.Ld + v.Lc + v.La) * (mx1 - mx0); };
    var Z = function (z) { return top + (zmax - z) / (zmax - zmin) * (bot - top); };
    var x1 = X(v.Ld), x2 = X(v.Ld + v.Lc), x0 = X(0), x3 = X(v.Ld + v.Lc + v.La);
    var tierra = v.Znivel + (v.Ze - v.Znivel > 0 ? Math.min(v.Ze + 1.2 - v.Znivel, 2.5) : 1);
    var zTop = Math.max(tierra, v.Ze + 1.0);

    // Terreno con el obstáculo cortado
    var soil = 'M0 ' + Z(zTop) + 'L' + (x1 - 16) + ' ' + Z(zTop) + 'L' + (x1 + 22) + ' ' + Z(v.Zobs) + 'L' + (x2 - 22) + ' ' + Z(v.Zobs) + 'L' + (x2 + 16) + ' ' + Z(zTop) + 'L' + W + ' ' + Z(zTop) + 'L' + W + ' ' + H + 'L0 ' + H + 'Z';
    el('path', { d: soil, style: 'fill:var(--soil);stroke:var(--soil-2);stroke-width:1.5' }, svg);
    // Agua u obstáculo
    if (v.Znivel > v.Zobs) {
      var dz = (v.Znivel - v.Zobs) / (zTop - v.Zobs || 1);
      el('path', { d: 'M' + (x1 + 22 - 38 * dz) + ' ' + Z(v.Znivel) + 'L' + (x2 - 22 + 38 * dz) + ' ' + Z(v.Znivel) + 'L' + (x2 - 22) + ' ' + Z(v.Zobs) + 'L' + (x1 + 22) + ' ' + Z(v.Zobs) + 'Z', style: 'fill:var(--water-soft);stroke:var(--water);stroke-width:1' }, svg);
      text(svg, (x1 + x2) / 2, Z(v.Znivel) + 16, 'Obstáculo: nivel ' + f(v.Znivel) + ' m', 'w', 'middle');
      text(svg, (x1 + x2) / 2, Z(v.Zobs) - 7, 'Fondo ' + f(v.Zobs) + ' m', 's', 'middle');
    }

    // Línea del conducto
    var pipeD = 'M' + x0 + ' ' + Z(v.Zci) + 'L' + x1 + ' ' + Z(v.Zf) + 'L' + x2 + ' ' + Z(v.Zf) + 'L' + x3 + ' ' + Z(v.Zcs);
    var Dvis = Math.max(10, Math.min(24, Math.max.apply(null, c.bs.map(function (b) { return b.D; })) / 1000 / (zmax - zmin) * (bot - top)));
    el('path', { d: pipeD, style: 'fill:none;stroke:var(--pipe);stroke-width:' + (Dvis + 5) + ';stroke-linejoin:round' }, svg);
    el('path', { d: pipeD, style: 'fill:none;stroke:var(--water);stroke-width:' + Dvis + ';stroke-linejoin:round' }, svg);
    flow(svg, pipeD, o.barrels[0].V, Math.max(3, Dvis * 0.32));

    // Colectores y cámaras
    var cw = 76;
    var ye = Z(v.Ze), ys = Z(v.Zs);
    var cheE = { x: x0 - cw, y: Z(zTop), w: cw, floor: Z(v.Zci) + 22 };
    var cheS = { x: x3, y: Z(zTop), w: cw, floor: Z(v.Zcs) + 22 };
    var drawChamber = function (ch, level, name, alin) {
      el('rect', { x: ch.x, y: ch.y, width: ch.w, height: ch.floor - ch.y, style: 'fill:var(--surface);stroke:var(--concrete);stroke-width:5' }, svg);
      var yl = Z(level);
      el('rect', { class: 'tr', x: ch.x + 3, y: yl, width: ch.w - 6, height: Math.max(ch.floor - yl - 3, 0), style: 'fill:var(--water-soft)' }, svg);
      el('line', { class: 'tr', x1: ch.x + 3, x2: ch.x + ch.w - 3, y1: yl, y2: yl, style: 'stroke:var(--water);stroke-width:2' }, svg);
      text(svg, alin === 'end' ? ch.x + ch.w : ch.x, ch.y - 8, name, '', alin);
    };
    // Colector de llegada
    var De = v.De / 1000 / (zmax - zmin) * (bot - top), Ds = v.Ds / 1000 / (zmax - zmin) * (bot - top);
    el('rect', { x: 0, y: ye - De, width: cheE.x, height: De, style: 'fill:var(--surface);stroke:var(--pipe);stroke-width:2' }, svg);
    var hEnt = c.ent[idx].y / 1000 * 1000 / (zmax - zmin) * (bot - top);
    el('rect', { class: 'tr', x: 1, y: ye - hEnt, width: cheE.x - 1, height: hEnt, style: 'fill:var(--water-soft)' }, svg);
    flow(svg, 'M0 ' + (ye - hEnt / 2) + 'L' + cheE.x + ' ' + (ye - hEnt / 2), c.ent[idx].V, 2.5, 'var(--water)');
    // Colector de salida
    el('rect', { x: cheS.x + cheS.w, y: ys - Ds, width: W - cheS.x - cheS.w, height: Ds, style: 'fill:var(--surface);stroke:var(--pipe);stroke-width:2' }, svg);
    var hSal = c.sal[idx].y / (zmax - zmin) * (bot - top);
    el('rect', { class: 'tr', x: cheS.x + cheS.w, y: ys - hSal, width: W - cheS.x - cheS.w, height: hSal, style: 'fill:var(--water-soft)' }, svg);
    flow(svg, 'M' + (cheS.x + cheS.w) + ' ' + (ys - hSal / 2) + 'L' + W + ' ' + (ys - hSal / 2), c.sal[idx].V, 2.5, 'var(--water)');
    drawChamber(cheE, o.NAe, 'Cámara de entrada', 'start');
    drawChamber(cheS, o.NAs, 'Cámara de salida', 'end');

    // Línea de energía y piezométrica
    var ptsX = [x0, x1, x2, x3];
    var pathOf = function (arr) { return arr.map(function (z, i) { return (i ? 'L' : 'M') + ptsX[i] + ' ' + Z(z); }).join(''); };
    el('path', { d: pathOf(prof.egl), style: 'fill:none;stroke:var(--s1);stroke-width:2.2;stroke-dasharray:9 5' }, svg);
    el('path', { d: pathOf(prof.hgl), style: 'fill:none;stroke:var(--s2);stroke-width:2;stroke-dasharray:3 4' }, svg);
    text(svg, x1 + 8, Z(prof.egl[1]) - 8, 'Línea de energía', 'e');
    text(svg, x2 - 8, Z(prof.hgl[2]) + 15, 'Línea piezométrica', 'h', 'end');

    // Cotas de los puntos de quiebre
    [[x0, v.Zci, 'start', 10, 30], [x1, v.Zf, 'middle', 0, 30], [x2, v.Zf, 'middle', 0, 30], [x3, v.Zcs, 'end', -10, 30]].forEach(function (p) {
      el('circle', { cx: p[0], cy: Z(p[1]), r: 4, style: 'fill:var(--surface);stroke:var(--pipe);stroke-width:2' }, svg);
      text(svg, p[0] + p[3], Z(p[1]) + p[4], 'Cota ' + f(p[1]), 'm', p[2]);
    });
    // Dimensiones
    var yd = H - 60;
    dim(svg, x0, yd, x1, yd, 'Ld = ' + f(v.Ld, 1) + ' m · θ = ' + f(c.g.thB, 1) + '°', 'middle', 0, -7);
    dim(svg, x1, yd, x2, yd, 'Lc = ' + f(v.Lc, 1) + ' m', 'middle', 0, -7);
    dim(svg, x2, yd, x3, yd, 'La = ' + f(v.La, 1) + ' m · θ = ' + f(c.g.thS, 1) + '°', 'middle', 0, -7);
    text(svg, (x0 + x3) / 2, H - 28, 'L real del conducto = ' + f(c.g.L) + ' m · Escala vertical exagerada frente a la horizontal', 's', 'middle');

    // Rótulos de niveles
    text(svg, 8, ye - De - 28, 'NA entrada = ' + f(o.NAe, 3) + ' m', 'w m');
    text(svg, 8, ye - De - 10, 'Batea llegada = ' + f(v.Ze) + ' m', 's');
    text(svg, W - 8, ys - Ds - 28, 'NA salida = ' + f(o.NAs, 3) + ' m', 'w m', 'end');
    text(svg, W - 8, ys - Ds - 10, 'Batea salida = ' + f(v.Zs) + ' m', 's', 'end');
    dim(svg, cheE.x + cw + 22, Z(o.Ee_req), cheE.x + cw + 22, Z(o.Es), null);
    text(svg, cheE.x + cw + 30, (Z(o.Ee_req) + Z(o.Es)) / 2 + 4, 'H = ' + f(o.hL, 3) + ' m', 'm');

    // Tarjeta de datos del caso y sección transversal
    var bx = 12, by = 10, bh = 74;
    el('rect', { x: bx, y: by, width: W - 24, height: bh, rx: 8, style: 'fill:var(--surface);stroke:var(--line-strong)' }, svg);
    text(svg, bx + 12, by + 30, o.key + ' = ' + f(o.Q * 1000, 1) + ' L/s', '');
    text(svg, bx + 12, by + 53, o.k + ' de ' + c.bs.length + ' en servicio', 's');
    var maxD = Math.max.apply(null, c.bs.map(function (b) { return b.D; }));
    var paso = (W - 24 - 190) / Math.max(c.bs.length, 1);
    c.bs.forEach(function (b, i) {
      var r = 11 + 15 * (b.D / maxD), cx = bx + 190 + i * paso + 26, cy = by + bh / 2;
      var act = i < o.k;
      el('circle', { cx: cx, cy: cy, r: r, class: 'tr', style: 'fill:' + (act ? 'var(--water)' : 'var(--surface-2)') + ';stroke:var(--pipe);stroke-width:2.5' }, svg);
      text(svg, cx + 33, cy - 7, 'Ø' + f(b.D, 0) + ' mm', '');
      text(svg, cx + 33, cy + 14, act ? f(o.barrels[i].Q * 1000, 1) + ' L/s · ' + f(o.barrels[i].V) + ' m/s' : 'Sin servicio', act ? 'm' : 's');
    });
    return true;
  }

  /* ---------- Perfil de la estación de bombeo ---------- */
  function bomba(host, res) {
    host.innerHTML = '';
    var c = res.ctx, v = res.v;
    if (!c.op || !c.ar || !c.npsh || !c.sum) return false;
    var W = 1160, H = 620;
    var svg = el('svg', { viewBox: '0 0 ' + W + ' ' + H, role: 'img', 'aria-label': 'Perfil de la estación de bombeo' }, host);
    arrowDefs(svg);
    var groundZ = v.Znmax + 0.8;
    var zlo = Math.min(v.Zfondo, v.Zeje, v.Zboca) - 0.6;
    var zhi = Math.max(v.Zdis, v.Znmin + c.op.H + c.ar.dH, groundZ + 1) + 2;
    var top = 92, bot = H - 40, yG = top + (bot - top) * 0.52;
    // Escala por tramos: el pozo ocupa casi la mitad del dibujo para que se lean sus niveles
    var Z = function (z) {
      if (z >= groundZ) return top + (zhi - z) / (zhi - groundZ) * (yG - top);
      return yG + (groundZ - z) / (groundZ - zlo) * (bot - yG);
    };
    // Terreno
    el('path', { d: 'M0 ' + Z(groundZ) + 'L' + W + ' ' + Z(groundZ - 0) + 'L' + W + ' ' + H + 'L0 ' + H + 'Z', style: 'fill:var(--soil);stroke:var(--soil-2);stroke-width:1.5' }, svg);
    // Pozo húmedo
    var wx = 80, ww = 280, wTop = Z(groundZ), wBot = Z(v.Zfondo);
    el('rect', { x: wx, y: wTop, width: ww, height: wBot - wTop, style: 'fill:var(--surface);stroke:var(--concrete);stroke-width:7' }, svg);
    var yMax = Z(v.Znmax), yMin = Z(v.Znmin);
    el('rect', { x: wx + 4, y: yMax, width: ww - 8, height: yMin - yMax, style: 'fill:var(--water-soft);opacity:.55' }, svg);
    el('rect', { x: wx + 4, y: yMin, width: ww - 8, height: wBot - yMin - 3, style: 'fill:var(--water-soft)' }, svg);
    el('line', { x1: wx + 4, x2: wx + ww - 4, y1: yMax, y2: yMax, style: 'stroke:var(--water);stroke-width:2;stroke-dasharray:8 4' }, svg);
    el('line', { x1: wx + 4, x2: wx + ww - 4, y1: yMin, y2: yMin, style: 'stroke:var(--water);stroke-width:2.5' }, svg);
    text(svg, wx - 6, yMax + 4, f(v.Znmax), 'm', 'end');
    text(svg, wx - 6, yMin + 4, f(v.Znmin), 'm', 'end');
    text(svg, wx + 12, yMax - 7, 'Nivel máximo', 'w');
    text(svg, wx + 12, yMin + 16, 'Nivel mínimo', 'w');
    text(svg, wx - 6, wBot, f(v.Zfondo), 'm', 'end');
    text(svg, wx, wTop - 8, 'Pozo ' + f(v.LB, 1) + ' × ' + f(v.BB, 1) + ' m · V útil ' + f(c.pozo ? c.pozo.Vol : 0, 1) + ' m³', '');

    // Bombas dibujadas en planta esquemática
    var px = wx + ww + 200, py = Z(v.Zeje);
    var sucY = Z(v.Zboca);
    var bx = wx + ww * 0.62;
    var sucD = 'M' + bx + ' ' + sucY + 'L' + bx + ' ' + py + 'L' + (px - 26) + ' ' + py;
    el('path', { d: sucD, style: 'fill:none;stroke:var(--pipe);stroke-width:15;stroke-linejoin:round' }, svg);
    el('path', { d: sucD, style: 'fill:none;stroke:var(--water);stroke-width:10;stroke-linejoin:round' }, svg);
    flow(svg, sucD, c.vel.s, 3);
    el('circle', { cx: bx, cy: sucY, r: 3, style: 'fill:var(--pipe)' }, svg);

    // Impulsión
    var xEnd = W - 190, zDisY = Z(v.Zdis);
    var impD = 'M' + (px + 26) + ' ' + py + 'L' + (px + 76) + ' ' + py + 'L' + (px + 76) + ' ' + (zDisY + 44) + 'L' + xEnd + ' ' + (zDisY + 18);
    el('path', { d: impD, style: 'fill:none;stroke:var(--pipe);stroke-width:13;stroke-linejoin:round' }, svg);
    el('path', { d: impD, style: 'fill:none;stroke:var(--water);stroke-width:8;stroke-linejoin:round' }, svg);
    flow(svg, impD, c.vel.i, 3);

    // Bomba activa y de reserva
    el('circle', { cx: px, cy: py, r: 28, style: 'fill:var(--accent);stroke:var(--pipe);stroke-width:3' }, svg);
    var imp = el('g', { class: 'spin', style: 'animation-duration:' + Math.max(0.3, 1.2 / Math.max(c.op.Qp / 60, 0.2)).toFixed(2) + 's' }, svg);
    for (var i = 0; i < 4; i++) el('path', { d: 'M' + px + ' ' + py + 'L' + px + ' ' + (py - 20), transform: 'rotate(' + (i * 90) + ' ' + px + ' ' + py + ')', style: 'stroke:#fff;stroke-width:4;stroke-linecap:round' }, imp);
    el('circle', { cx: px, cy: py, r: 28.01, style: 'fill:none' }, imp);
    text(svg, px, py + 48, v.nAct + ' en operación · ' + Math.max(v.nInst - v.nAct, 0) + ' en reserva', '', 'middle');
    text(svg, px, py + 64, 'Eje a cota ' + f(v.Zeje) + ' m', 's', 'middle');

    // Tanque o cámara de descarga
    var tx = xEnd, tw = 150;
    el('rect', { x: tx, y: zDisY - 18, width: tw, height: 70, style: 'fill:var(--surface);stroke:var(--concrete);stroke-width:5' }, svg);
    el('rect', { x: tx + 3, y: zDisY, width: tw - 6, height: 49, style: 'fill:var(--water-soft)' }, svg);
    el('line', { x1: tx + 3, x2: tx + tw - 3, y1: zDisY, y2: zDisY, style: 'stroke:var(--water);stroke-width:2' }, svg);
    text(svg, tx + tw / 2, zDisY - 26, 'Descarga ' + f(v.Zdis) + ' m', 'm', 'middle');

    // Línea de altura piezométrica (presión en la impulsión)
    var hgl0 = v.Znmin + c.op.H;
    el('path', { d: 'M' + (px + 26) + ' ' + Z(hgl0) + 'L' + xEnd + ' ' + zDisY, style: 'fill:none;stroke:var(--s2);stroke-width:2.2;stroke-dasharray:4 4' }, svg);
    text(svg, px + 40, Z(hgl0) + 40, 'Piezométrica: ' + f(hgl0) + ' m', 'h m');
    var hArt = Z(hgl0 + c.ar.dH);
    if (hArt > 90) {
      el('path', { d: 'M' + (px + 26) + ' ' + hArt + 'L' + xEnd + ' ' + Z(v.Zdis + c.ar.dH * 0.2), style: 'fill:none;stroke:var(--s5);stroke-width:1.8;stroke-dasharray:2 5' }, svg);
      text(svg, px + 92, hArt - 10, 'Máxima con ΔH = ' + f(c.ar.dH) + ' m', 'm');
    }

    // Cotas: altura estática y dinámica
    var xh = W - 18;
    dim(svg, xh, zDisY, xh, yMin, null);
    text(svg, xh - 8, (zDisY + yMin) / 2, 'Hs = ' + f(c.HsMax) + ' m', 'm', 'end');
    // Sumergencia
    var xs = bx - 34;
    dim(svg, xs, yMin, xs, sucY, null);
    text(svg, xs - 6, (yMin + sucY) / 2 + 5, 'S = ' + f(c.sum.S) + ' m', 'm', 'end');

    // Etiquetas de tubería
    text(svg, wx + ww + 16, py - 34, 'Succión Ø' + f(v.Dsu, 0) + ' mm', '');
    text(svg, wx + ww + 16, py - 15, 'Vs = ' + f(c.vel.s) + ' m/s', 'm');
    var mx = (px + 76 + xEnd) / 2, my = (zDisY + 44 + zDisY + 18) / 2;
    text(svg, mx, my + 26, 'Impulsión Ø' + f(v.Dim, 0) + ' mm · L = ' + f(v.Lim, 0) + ' m', '', 'middle');
    text(svg, mx, my + 43, 'Vi = ' + f(c.vel.i) + ' m/s', 'm', 'middle');

    text(svg, W - 26, H - 12, 'Escala vertical por tramos: el pozo está ampliado frente a la altura de bombeo', 's', 'end');
    // Tarjeta
    el('rect', { x: 12, y: 10, width: W - 24, height: 62, rx: 8, style: 'fill:var(--surface);stroke:var(--line-strong)' }, svg);
    var cards = [
      ['Punto de operación', f(c.op.Qt, 1) + ' L/s · ' + f(c.op.H) + ' m'],
      ['Potencia y eficiencia', (c.pot ? f(c.pot.Pe) + ' kW · η ' + f(c.pot.eta, 1) + ' %' : '—')],
      ['NPSH disponible / requerido', f(c.npsh.a) + ' / ' + f(c.npsh.r) + ' m'],
      ['Golpe de ariete', 'a ' + f(c.ar.a, 0) + ' m/s · ΔH ' + f(c.ar.dH) + ' m']
    ];
    cards.forEach(function (k, i) {
      var x = 28 + i * 282;
      text(svg, x, 34, k[0], 's');
      text(svg, x, 56, k[1], 'm');
    });
    return true;
  }

  /* ---------- Sifón simple para la tarjeta de inicio ---------- */
  root.Schemes = { sifon: sifon, bomba: bomba };
})(typeof self !== 'undefined' ? self : this);
