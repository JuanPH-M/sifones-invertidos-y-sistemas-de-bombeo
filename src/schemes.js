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
    // Obstáculo según su tipo
    var ob = root.Engine.DESCR.obst[v.obst] || { t: 'Obstáculo', zobs: 'fondo', znivel: 'nivel' };
    var agua = (v.obst === 'rio' || v.obst === 'arroyo' || v.obst === 'canal') && v.Znivel > v.Zobs;
    if (agua) {
      var dz = (v.Znivel - v.Zobs) / (zTop - v.Zobs || 1);
      el('path', { d: 'M' + (x1 + 22 - 38 * dz) + ' ' + Z(v.Znivel) + 'L' + (x2 - 22 + 38 * dz) + ' ' + Z(v.Znivel) + 'L' + (x2 - 22) + ' ' + Z(v.Zobs) + 'L' + (x1 + 22) + ' ' + Z(v.Zobs) + 'Z', style: 'fill:var(--water-soft);stroke:var(--water);stroke-width:1' }, svg);
      flow(svg, 'M' + (x1 + 40) + ' ' + (Z(v.Znivel) + 6) + 'L' + (x2 - 40) + ' ' + (Z(v.Znivel) + 6), 0.5, 2, 'var(--water)');
    } else if (v.obst === 'via' || v.obst === 'ferrea') {
      el('rect', { x: x1 + 22, y: Z(v.Zobs) - 9, width: x2 - x1 - 44, height: 9, style: 'fill:' + (v.obst === 'via' ? '#5b6366' : '#8b7f6a') }, svg);
      if (v.obst === 'via') el('line', { x1: x1 + 30, x2: x2 - 30, y1: Z(v.Zobs) - 4.5, y2: Z(v.Zobs) - 4.5, style: 'stroke:#fff;stroke-width:2;stroke-dasharray:14 10' }, svg);
      else for (var rr = 0; rr < 2; rr++) el('rect', { x: (x1 + x2) / 2 - 60 + rr * 110, y: Z(v.Zobs) - 16, width: 10, height: 7, style: 'fill:var(--pipe)' }, svg);
    } else if (v.obst === 'tuberia') {
      var rp = Math.max(8, (Z(v.Zobs) - Z(Math.max(v.Znivel, v.Zobs + 0.3))) / 2);
      el('circle', { cx: (x1 + x2) / 2, cy: Z(v.Zobs) - rp, r: rp, style: 'fill:var(--surface-2);stroke:var(--pipe);stroke-width:2.5' }, svg);
    }
    text(svg, (x1 + x2) / 2, Z(Math.max(v.Znivel, v.Zobs)) - 14, ob.t + (v.Znivel > v.Zobs ? ' · ' + ob.znivel + ' ' + f(v.Znivel) + ' m' : ''), agua ? 'w' : '', 'middle');
    text(svg, (x1 + x2) / 2, Z(v.Zobs) + 18, ob.zobs.charAt(0).toUpperCase() + ob.zobs.slice(1) + ' ' + f(v.Zobs) + ' m · recubrimiento ' + f(v.Zobs - v.Zf - Math.max.apply(null, c.bs.map(function (b) { return b.D / 1000; }))) + ' m', 's', 'middle');

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
    drawChamber(cheE, o.NAe, 'Cámara de entrada · tapa ' + f(v.Ztce), 'start');
    drawChamber(cheS, o.NAs, 'Cámara de salida · tapa ' + f(v.Ztcs), 'end');
    if (c.cam) {
      c.cam.ent.comp.forEach(function (k) {
        if (k.cresta === null) return;
        var yc = Z(k.cresta);
        el('line', { x1: cheE.x + 6, x2: cheE.x + cheE.w - 6, y1: yc, y2: yc, style: 'stroke:#8a5a2b;stroke-width:3;stroke-dasharray:6 3' }, svg);
      });
    }
    // Pendientes de los tramos
    text(svg, (x0 + x1) / 2 + 14, (Z(v.Zci) + Z(v.Zf)) / 2 - 10, 'S = ' + f(c.g.pB, 1) + ' %', 'm');
    text(svg, (x2 + x3) / 2 - 14, (Z(v.Zcs) + Z(v.Zf)) / 2 - 10, 'S = ' + f(c.g.pS, 1) + ' %', 'm', 'end');
    text(svg, (x1 + x2) / 2, Z(v.Zf) - 14, 'S = 0 %', 'm', 'middle');

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
    el('path', { d: sucD, style: 'fill:none;stroke:var(--s3);stroke-width:15;stroke-linejoin:round' }, svg);
    el('path', { d: sucD, style: 'fill:none;stroke:var(--water);stroke-width:10;stroke-linejoin:round' }, svg);
    flow(svg, sucD, c.vel.s, 3);
    el('circle', { cx: bx, cy: sucY, r: 3, style: 'fill:var(--pipe)' }, svg);

    // Impulsión
    var xEnd = W - 190, zDisY = Z(v.Zdis);
    var xr = px + 230, yOut = zDisY + (v.descarga === 'libre' ? -12 : 16);
    var impD = 'M' + (px + 26) + ' ' + py + 'L' + xr + ' ' + py + 'L' + xr + ' ' + (zDisY + 44) + 'L' + (xEnd - 30) + ' ' + yOut + 'L' + (xEnd + 22) + ' ' + yOut;
    el('path', { d: impD, style: 'fill:none;stroke:var(--s2);stroke-width:13;stroke-linejoin:round' }, svg);
    el('path', { d: impD, style: 'fill:none;stroke:var(--water);stroke-width:8;stroke-linejoin:round' }, svg);
    flow(svg, impD, c.vel.i, 3);

    // Bomba activa y de reserva
    el('circle', { cx: px, cy: py, r: 28, style: 'fill:var(--accent);stroke:var(--pipe);stroke-width:3' }, svg);
    var imp = el('g', { class: 'spin', style: 'animation-duration:' + Math.max(0.3, 1.2 / Math.max(c.op.Qp / 60, 0.2)).toFixed(2) + 's' }, svg);
    for (var i = 0; i < 4; i++) el('path', { d: 'M' + px + ' ' + py + 'L' + px + ' ' + (py - 20), transform: 'rotate(' + (i * 90) + ' ' + px + ' ' + py + ')', style: 'stroke:#fff;stroke-width:4;stroke-linecap:round' }, imp);
    el('circle', { cx: px, cy: py, r: 28.01, style: 'fill:none' }, imp);
    var nOp = v.nAct * (v.nSer || 1);
    text(svg, px, py + 48, (v.nSer > 1 ? v.nAct + ' en paralelo × ' + v.nSer + ' en serie' : v.nAct + ' en operación') + ' · ' + Math.max(v.nInst - nOp, 0) + ' en reserva', '', 'middle');
    text(svg, px, py + 64, 'Eje a cota ' + f(v.Zeje) + ' m', 's', 'middle');
    // Accesorios sobre las tuberías
    if (c.acc && !c.acc.manual) {
      var tiene = function (lst, id) { return lst.some(function (a) { return a.id === id; }); };
      var su = c.acc.su.items, im = c.acc.im.items, hx = (bx + px - 26) / 2;
      var marca = function (id, x, y, col, lab, dy) { sym(svg, id, x, y, col); if (lab) text(svg, x, y + (dy || 26), lab, 's', 'middle'); };
      if (tiene(su, 'entrada_recta') || tiene(su, 'entrada_campana')) marca(tiene(su, 'entrada_campana') ? 'entrada_campana' : 'entrada_recta', bx, sucY + 10, 'var(--s3)', 'Entrada', 26);
      if (tiene(su, 'codo90') || tiene(su, 'codo45')) marca(tiene(su, 'codo90') ? 'codo90' : 'codo45', bx, py, 'var(--s3)', 'Codo', 30);
      if (tiene(su, 'v_comp') || tiene(su, 'v_mari')) marca(tiene(su, 'v_comp') ? 'v_comp' : 'v_mari', hx, py, 'var(--s3)', 'Válvula', 30);
      if (tiene(su, 'reduccion')) marca('reduccion', px - 46, py, 'var(--s3)', 'Reducción', -18);
      if (tiene(im, 'ampliacion')) marca('ampliacion', px + 48, py, 'var(--s2)', 'Ampliación', -18);
      if (tiene(im, 'v_cheq')) marca('v_cheq', px + 104, py, 'var(--s2)', 'Cheque', 30);
      if (tiene(im, 'v_comp') || tiene(im, 'v_mari')) marca(tiene(im, 'v_comp') ? 'v_comp' : 'v_mari', px + 160, py, 'var(--s2)', 'Compuerta', -22);
      if (tiene(im, 'tee_lat') || tiene(im, 'tee_dir')) marca('tee_lat', xr, py, 'var(--s2)', 'Tee', 30);
      if (tiene(im, 'codo90') || tiene(im, 'codo45')) marca(tiene(im, 'codo45') ? 'codo45' : 'codo90', xr, zDisY + 44, 'var(--s2)', 'Codos', -16);
      marca('salida', xEnd - 6, yOut, 'var(--s2)', '', 0);
    }
    // Leyenda de tuberías
    el('line', { x1: 24, y1: H - 18, x2: 52, y2: H - 18, style: 'stroke:var(--s3);stroke-width:8' }, svg); text(svg, 58, H - 13, 'Tubería de succión', 's');
    el('line', { x1: 210, y1: H - 18, x2: 238, y2: H - 18, style: 'stroke:var(--s2);stroke-width:8' }, svg); text(svg, 244, H - 13, 'Tubería de impulsión', 's');

    // Tanque o cámara de descarga
    var tx = xEnd, tw = 150;
    el('rect', { x: tx, y: zDisY - 18, width: tw, height: 70, style: 'fill:var(--surface);stroke:var(--concrete);stroke-width:5' }, svg);
    el('rect', { x: tx + 3, y: zDisY, width: tw - 6, height: 49, style: 'fill:var(--water-soft)' }, svg);
    el('line', { x1: tx + 3, x2: tx + tw - 3, y1: zDisY, y2: zDisY, style: 'stroke:var(--water);stroke-width:2' }, svg);
    text(svg, tx + tw / 2, zDisY - 44, root.Engine.DESCR.tanque[v.tanque] ? root.Engine.DESCR.tanque[v.tanque].t : 'Tanque de descarga', '', 'middle');
    text(svg, tx + tw / 2, zDisY - 26, 'Nivel ' + f(v.Zdis) + ' m', 'm', 'middle');
    text(svg, tx + tw / 2, zDisY + 70, 'Salida ' + f(v.Zimp) + ' · fondo ' + f(v.Zftq), 's', 'middle');
    text(svg, tx + tw / 2, zDisY + 87, v.descarga === 'libre' ? 'Descarga libre' : 'Descarga ahogada', 's', 'middle');

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
    var mx = (xr + xEnd) / 2, my = (zDisY + 44 + yOut) / 2;
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

  /* ---------- Símbolos de accesorios ---------- */
  function sym(svg, id, x, y, color) {
    var g = el('g', { transform: 'translate(' + x + ' ' + y + ')' }, svg);
    var st = 'fill:var(--surface);stroke:' + color + ';stroke-width:2.2';
    var stF = 'fill:' + color + ';stroke:' + color + ';stroke-width:1.5';
    if (id === 'v_comp') { el('path', { d: 'M-11 -8L11 8L11 -8L-11 8Z', style: st }, g); el('line', { x1: 0, y1: 0, x2: 0, y2: -15, style: 'stroke:' + color + ';stroke-width:2' }, g); el('line', { x1: -6, y1: -15, x2: 6, y2: -15, style: 'stroke:' + color + ';stroke-width:2.5' }, g); }
    else if (id === 'v_cheq') { el('path', { d: 'M-11 -8L11 8L11 -8L-11 8Z', style: st }, g); el('path', { d: 'M-11 -8L0 0L-11 8Z', style: stF }, g); }
    else if (id === 'v_mari') { el('circle', { r: 9, style: st }, g); el('line', { x1: -6, y1: 6, x2: 6, y2: -6, style: 'stroke:' + color + ';stroke-width:2.5' }, g); }
    else if (id === 'codo90') el('path', { d: 'M-10 -10L-10 6Q-10 10 -6 10L10 10', style: 'fill:none;stroke:' + color + ';stroke-width:5;stroke-linecap:round' }, g);
    else if (id === 'codo45') el('path', { d: 'M-11 8L-2 8L10 -6', style: 'fill:none;stroke:' + color + ';stroke-width:5;stroke-linecap:round;stroke-linejoin:round' }, g);
    else if (id === 'tee_dir' || id === 'tee_lat') { el('path', { d: 'M-12 4L12 4M0 4L0 -12', style: 'fill:none;stroke:' + color + ';stroke-width:5;stroke-linecap:round' }, g); if (id === 'tee_lat') el('path', { d: 'M-3 -6L0 -12L3 -6', style: 'fill:none;stroke:var(--ink);stroke-width:1.6' }, g); }
    else if (id === 'reduccion') el('path', { d: 'M-10 -9L10 -5L10 5L-10 9Z', style: st }, g);
    else if (id === 'ampliacion') el('path', { d: 'M-10 -5L10 -9L10 9L-10 5Z', style: st }, g);
    else if (id === 'entrada_recta') el('path', { d: 'M-4 -9L-4 9M-4 -6L10 -6M-4 6L10 6', style: 'fill:none;stroke:' + color + ';stroke-width:2.5' }, g);
    else if (id === 'entrada_campana') el('path', { d: 'M-8 -11Q-2 -6 10 -6M-8 11Q-2 6 10 6', style: 'fill:none;stroke:' + color + ';stroke-width:2.5' }, g);
    else if (id === 'union') el('path', { d: 'M-5 -9L-5 9M5 -9L5 9M-5 0L5 0', style: 'fill:none;stroke:' + color + ';stroke-width:3' }, g);
    else if (id === 'salida') el('path', { d: 'M-10 -6L4 -6M-10 6L4 6M4 -10L4 10', style: 'fill:none;stroke:' + color + ';stroke-width:2.5' }, g);
    else el('circle', { r: 7, style: st }, g);
    return g;
  }

  /* ---------- Planta del sifón ---------- */
  function planta(host, res, idx) {
    host.innerHTML = '';
    var c = res.ctx, v = res.v;
    if (!c.cam || !c.casos) return false;
    var E = root.Engine, o = c.casos[idx], N = c.bs.length;
    var W = 1160, H = 560;
    var svg = el('svg', { viewBox: '0 0 ' + W + ' ' + H, role: 'img', 'aria-label': 'Planta del sifón invertido' }, host);
    arrowDefs(svg);
    var cx0 = 120, cw = 150, cy = 120, ch = Math.min(320, Math.max(170, 70 * N + 40));
    var x3 = W - cx0 - cw, xA = cx0 + cw, xB = x3;
    var Lt = v.Ld + v.Lc + v.La;
    var X = function (s) { return xA + s / Lt * (xB - xA); };
    var mid = cy + ch / 2;
    // Obstáculo cruzando la traza
    var ox1 = X(v.Ld + 1), ox2 = X(v.Ld + v.Lc - 1);
    var tipo = v.obst;
    if (tipo === 'via' || tipo === 'ferrea') {
      el('rect', { x: ox1, y: 30, width: ox2 - ox1, height: H - 90, style: 'fill:' + (tipo === 'via' ? '#7d8487' : '#9b8f7a') + ';opacity:.55' }, svg);
      if (tipo === 'via') el('line', { x1: (ox1 + ox2) / 2, y1: 34, x2: (ox1 + ox2) / 2, y2: H - 64, style: 'stroke:#fff;stroke-width:3;stroke-dasharray:18 14' }, svg);
      else for (var t = 0; t < 2; t++) el('line', { x1: ox1 + (ox2 - ox1) * (0.38 + 0.24 * t), y1: 30, x2: ox1 + (ox2 - ox1) * (0.38 + 0.24 * t), y2: H - 60, style: 'stroke:var(--pipe);stroke-width:4' }, svg);
    } else if (tipo === 'tuberia') {
      el('rect', { x: (ox1 + ox2) / 2 - 9, y: 30, width: 18, height: H - 90, style: 'fill:var(--surface-2);stroke:var(--pipe);stroke-width:2' }, svg);
    } else if (tipo === 'depresion') {
      for (var k = 0; k < 4; k++) el('ellipse', { cx: (ox1 + ox2) / 2, cy: mid, rx: (ox2 - ox1) / 2 * (1 - k * 0.2), ry: (H / 2 - 40) * (1 - k * 0.2), style: 'fill:none;stroke:var(--soil-2);stroke-width:1.5;stroke-dasharray:6 4' }, svg);
    } else {
      var wv = 'M' + ox1 + ' 30';
      for (var yy = 30; yy <= H - 60; yy += 40) wv += 'Q' + (ox1 - 10) + ' ' + (yy + 20) + ' ' + ox1 + ' ' + (yy + 40);
      var wv2 = 'L' + ox2 + ' ' + (H - 60 + 10);
      for (var y2 = H - 50; y2 >= 30; y2 -= 40) wv2 += 'Q' + (ox2 + 10) + ' ' + (y2 - 20) + ' ' + ox2 + ' ' + (y2 - 40);
      el('path', { d: wv + wv2 + 'Z', style: 'fill:var(--water-soft);stroke:var(--water);stroke-width:1.5' }, svg);
      flow(svg, 'M' + ((ox1 + ox2) / 2) + ' 40L' + ((ox1 + ox2) / 2) + ' ' + (H - 70), 0.6, 3, 'var(--water)');
    }
    text(svg, (ox1 + ox2) / 2, 22, root.Engine.DESCR.obst[tipo].t + ' · ancho ' + f(v.Bobs, 1) + ' m', '', 'middle');
    // Colectores
    var bandE = Math.max(14, Math.min(40, v.De / 20)), bandS = Math.max(14, Math.min(40, v.Ds / 20));
    el('rect', { x: 0, y: mid - bandE / 2, width: cx0, height: bandE, style: 'fill:var(--water-soft);stroke:var(--pipe);stroke-width:2' }, svg);
    flow(svg, 'M0 ' + mid + 'L' + cx0 + ' ' + mid, c.ent[idx].V, 2.5, 'var(--water)');
    text(svg, 6, mid - bandE / 2 - 26, 'Llegada', 's'); text(svg, 6, mid - bandE / 2 - 9, 'Ø' + f(v.De, 0) + ' · ' + f(v.Se) + ' %', 'm');
    el('rect', { x: x3 + cw, y: mid - bandS / 2, width: W - x3 - cw, height: bandS, style: 'fill:var(--water-soft);stroke:var(--pipe);stroke-width:2' }, svg);
    flow(svg, 'M' + (x3 + cw) + ' ' + mid + 'L' + W + ' ' + mid, c.sal[idx].V, 2.5, 'var(--water)');
    text(svg, W - 6, mid - bandS / 2 - 26, 'Salida', 's', 'end'); text(svg, W - 6, mid - bandS / 2 - 9, 'Ø' + f(v.Ds, 0) + ' · ' + f(v.Ss) + ' %', 'm', 'end');
    // Cámaras con compartimientos
    var camara = function (x0, salida) {
      el('rect', { x: x0, y: cy, width: cw, height: ch, style: 'fill:var(--surface);stroke:var(--concrete);stroke-width:6' }, svg);
      var canal = 34, cxC = salida ? x0 + cw - canal : x0;
      var tieneTab = !salida || v.camS === 'tabiques';
      el('rect', { x: cxC + 3, y: cy + 3, width: canal - 3, height: ch - 6, style: 'fill:var(--water-soft);opacity:.8' }, svg);
      var hcomp = (ch - 8) / N;
      for (var i = 0; i < N; i++) {
        var y0 = cy + 4 + i * hcomp, act = i < o.k;
        var bx = salida ? x0 + 4 : x0 + canal + 4, bw = cw - canal - 8;
        el('rect', { class: 'tr', x: bx, y: y0 + 2, width: bw, height: hcomp - 4, style: 'fill:' + (act ? 'var(--water-soft)' : 'var(--surface-2)') }, svg);
        if (tieneTab && i > 0) el('line', { x1: bx - (salida ? 0 : 2), y1: y0, x2: bx + bw + (salida ? 2 : 0), y2: y0, style: 'stroke:var(--concrete);stroke-width:' + Math.max(4, Math.min(9, v.esep * 30)) }, svg);
        var wx = salida ? x0 + cw - canal : x0 + canal;
        if (tieneTab && (i > 0 || salida)) el('line', { x1: wx, y1: y0 + 6, x2: wx, y2: y0 + hcomp - 6, style: 'stroke:#8a5a2b;stroke-width:4' }, svg);
        text(svg, bx + bw / 2, y0 + hcomp / 2 + 5, String(i + 1), 'm', 'middle');
      }
      return hcomp;
    };
    var hcomp = camara(cx0, false);
    camara(x3, true);
    text(svg, cx0, cy - 30, 'Cámara de entrada', '');
    text(svg, cx0, cy - 12, f(c.cam.ent.B) + ' × ' + f(c.cam.ent.L) + ' m · ' + root.Engine.DESCR.camE[v.camE].t, 's');
    text(svg, x3 + cw, cy - 30, 'Cámara de salida', '', 'end');
    text(svg, x3 + cw, cy - 12, f(c.cam.sal.B) + ' × ' + f(c.cam.sal.L) + ' m · ' + root.Engine.DESCR.camS[v.camS].t, 's', 'end');
    // Conductos
    var maxD = Math.max.apply(null, c.bs.map(function (b) { return b.D; }));
    c.bs.forEach(function (b, i) {
      var yb = cy + 4 + i * hcomp + hcomp / 2, act = i < o.k, wpx = 5 + 9 * b.D / maxD;
      var d = 'M' + xA + ' ' + yb + 'L' + xB + ' ' + yb;
      el('path', { d: d, style: 'fill:none;stroke:var(--pipe);stroke-width:' + (wpx + 4) }, svg);
      el('path', { class: 'tr', d: d, style: 'fill:none;stroke:' + (act ? 'var(--water)' : 'var(--surface-2)') + ';stroke-width:' + wpx }, svg);
      if (act) flow(svg, d, o.barrels[i].V, Math.max(2, wpx * 0.35));
      var lx = X(v.Ld * 0.45);
      text(svg, lx, yb - wpx / 2 - 6, 'Conducto ' + b.id + ' · Ø' + f(b.D, 0) + ' mm', 's', 'middle');
      text(svg, X(v.Ld + v.Lc + v.La * 0.55), yb - wpx / 2 - 6, act ? f(o.barrels[i].Q * 1000, 1) + ' L/s · ' + f(o.barrels[i].V) + ' m/s' : 'sin servicio', act ? 'm' : 's', 'middle');
    });
    // Puntos de quiebre y cotas de longitud
    [[0, 'Entrada'], [v.Ld, 'Inicio tramo inferior'], [v.Ld + v.Lc, 'Fin tramo inferior'], [Lt, 'Salida']].forEach(function (p) {
      el('line', { x1: X(p[0]), y1: cy + ch + 8, x2: X(p[0]), y2: cy + ch + 34, style: 'stroke:var(--ink-3);stroke-width:1;stroke-dasharray:3 3' }, svg);
    });
    var yd = cy + ch + 30;
    dim(svg, X(0), yd, X(v.Ld), yd, 'Ld ' + f(v.Ld, 1) + ' m', 'middle', 0, 18);
    dim(svg, X(v.Ld), yd, X(v.Ld + v.Lc), yd, 'Lc ' + f(v.Lc, 1) + ' m', 'middle', 0, 18);
    dim(svg, X(v.Ld + v.Lc), yd, X(Lt), yd, 'La ' + f(v.La, 1) + ' m', 'middle', 0, 18);
    // Leyenda
    var ly = H - 22;
    el('line', { x1: 20, y1: ly, x2: 44, y2: ly, style: 'stroke:var(--concrete);stroke-width:7' }, svg); text(svg, 50, ly + 5, 'Separador (' + f(v.esep) + ' m)', 's');
    el('line', { x1: 230, y1: ly, x2: 254, y2: ly, style: 'stroke:#8a5a2b;stroke-width:4' }, svg); text(svg, 260, ly + 5, 'Vertedero', 's');
    el('rect', { x: 370, y: ly - 7, width: 24, height: 14, style: 'fill:var(--water-soft)' }, svg); text(svg, 400, ly + 5, 'Canal de reparto o de salida', 's');
    text(svg, W - 20, ly + 5, o.key + ' = ' + f(o.Q * 1000, 1) + ' L/s · ' + o.k + ' de ' + N + ' en servicio · planta sin escala en las cámaras', 's', 'end');
    void E;
    return true;
  }

  /* ---------- Sección transversal de los conductos en el punto bajo ---------- */
  function seccion(host, res, idx) {
    host.innerHTML = '';
    var c = res.ctx, v = res.v;
    if (!c.casos) return false;
    var o = c.casos[idx], N = c.bs.length, sepL = 0.30;
    var W = 1160, H = 400;
    var svg = el('svg', { viewBox: '0 0 ' + W + ' ' + H, role: 'img', 'aria-label': 'Sección de los conductos del sifón' }, host);
    arrowDefs(svg);
    var Ds = c.bs.map(function (b) { return b.D / 1000; }), Dmax = Math.max.apply(null, Ds);
    var ancho = Ds.reduce(function (s, d) { return s + d; }, 0) + (N + 1) * sepL;
    var zTop = v.Zobs + 0.6, zBot = v.Zf - 0.35;
    var s = Math.min(330 / ancho, 280 / (zTop - zBot));
    var x0 = 170, xe = x0 + ancho * s, Y = function (z) { return 80 + (zTop - z) * s; };
    el('rect', { x: x0, y: Y(v.Zobs), width: ancho * s, height: Y(zBot) - Y(v.Zobs), style: 'fill:var(--soil);stroke:var(--soil-2);stroke-width:1.5' }, svg);
    el('rect', { x: x0, y: Y(v.Zf + Dmax + 0.15), width: ancho * s, height: Y(zBot) - Y(v.Zf + Dmax + 0.15), style: 'fill:var(--surface-2);opacity:.7' }, svg);
    if (v.Znivel > v.Zobs) {
      el('rect', { x: x0, y: Y(zTop), width: ancho * s, height: Y(v.Zobs) - Y(zTop), style: 'fill:var(--water-soft)' }, svg);
      text(svg, (x0 + xe) / 2, Y(zTop) + 18, 'Agua hasta ' + f(v.Znivel) + ' m', 'w', 'middle');
    }
    el('line', { x1: x0 - 10, x2: xe + 10, y1: Y(v.Zobs), y2: Y(v.Zobs), style: 'stroke:var(--pipe);stroke-width:2.5' }, svg);
    text(svg, x0 - 16, Y(v.Zobs) + 5, 'Fondo ' + f(v.Zobs), 'm', 'end');
    text(svg, x0 - 16, Y(v.Zf + Dmax) + 5, 'Clave ' + f(v.Zf + Dmax), 'm', 'end');
    text(svg, x0 - 16, Y(v.Zf) + 5, 'Batea ' + f(v.Zf), 'm', 'end');
    el('line', { x1: x0, x2: xe, y1: Y(v.Zf + Dmax), y2: Y(v.Zf + Dmax), style: 'stroke:var(--ink-3);stroke-dasharray:4 4' }, svg);
    dim(svg, xe + 24, Y(v.Zobs), xe + 24, Y(v.Zf + Dmax), null);
    text(svg, xe + 34, (Y(v.Zobs) + Y(v.Zf + Dmax)) / 2, 'Recubrimiento ' + f(v.Zobs - v.Zf - Dmax) + ' m', 'm');
    text(svg, xe + 34, (Y(v.Zobs) + Y(v.Zf + Dmax)) / 2 + 18, 'Mínimo adoptado ' + f(v.recub) + ' m', 's');
    var xx = x0 + sepL * s, bx0 = xe + 200, paso = Math.min(210, (W - 6 - bx0) / Math.max(N, 1));
    c.bs.forEach(function (b, i) {
      var D = Ds[i], r = D / 2 * s, cxp = xx + r, cyp = Y(v.Zf + D / 2), act = i < o.k, bar = o.barrels[i];
      el('circle', { cx: cxp, cy: cyp, r: r, class: 'tr', style: 'fill:' + (act ? 'var(--water)' : 'var(--surface)') + ';stroke:var(--pipe);stroke-width:2.5' }, svg);
      text(svg, cxp, cyp + 5, String(b.id), 'm', 'middle');
      var bx = bx0 + i * paso, by = 110;
      el('path', { d: 'M' + cxp + ' ' + (cyp + r) + 'L' + cxp + ' ' + (Y(zBot) + 14 + i * 8) + 'L' + (bx - 6) + ' ' + (Y(zBot) + 14 + i * 8) + 'L' + (bx - 6) + ' ' + (by + 104), style: 'fill:none;stroke:var(--ink-3);stroke-width:1;stroke-dasharray:3 3' }, svg);
      el('rect', { x: bx - 6, y: by - 22, width: paso - 12, height: 126, rx: 6, style: 'fill:var(--surface);stroke:' + (act ? 'var(--water)' : 'var(--line-strong)') + ';stroke-width:1.5' }, svg);
      text(svg, bx + 4, by, 'Conducto ' + b.id, '');
      text(svg, bx + 4, by + 20, 'Ø ' + f(b.D, 0) + ' mm', 'm');
      text(svg, bx + 4, by + 38, 'A = ' + f(Math.PI * D * D / 4, 4) + ' m²', 's');
      text(svg, bx + 4, by + 56, act ? 'Q ' + f(bar.Q * 1000, 1) + ' L/s' : 'Sin servicio', act ? 'm' : 's');
      text(svg, bx + 4, by + 74, act ? 'V ' + f(bar.V) + ' m/s' : '', 'm');
      text(svg, bx + 4, by + 92, act ? 'H ' + f(bar.hL, 3) + ' m · τ ' + f(bar.tau) + ' Pa' : '', 's');
      xx += D * s + sepL * s;
    });
    text(svg, 20, 30, 'Sección bajo el ' + root.Engine.DESCR.obst[v.obst].t.toLowerCase() + ', a escala real · ' + o.key + ' = ' + f(o.Q * 1000, 1) + ' L/s', '');
    text(svg, 20, 50, 'Separación libre entre conductos 0,30 m (criterio de diseño) · material ' + (root.Engine.MATERIALS[v.mat] ? root.Engine.MATERIALS[v.mat].label : 'otro') + ' · relleno compactado hasta 0,15 m sobre la clave', 's');
    return true;
  }

  /* ---------- Corte de la cámara de entrada: separadores y vertederos ---------- */
  function camara(host, res, idx) {
    host.innerHTML = '';
    var c = res.ctx, v = res.v;
    if (!c.cam) return false;
    var o = c.casos[idx], cam = c.cam.ent, N = c.bs.length;
    var W = 1160, H = 520;
    var svg = el('svg', { viewBox: '0 0 ' + W + ' ' + H, role: 'img', 'aria-label': 'Corte de la cámara de entrada' }, host);
    arrowDefs(svg);
    var zTop = cam.tapa + 0.15, zBot = cam.fondo - 0.25;
    var totalB = cam.comp.reduce(function (s, k) { return s + k.b; }, 0) + (N - 1) * c.cam.e;
    var s = Math.min(420 / totalB, 400 / (zTop - zBot));
    var x0 = 300, Y = function (z) { return 50 + (zTop - z) * s; };
    var wall = 0.2 * s;
    el('rect', { x: x0 - wall, y: Y(cam.tapa), width: totalB * s + 2 * wall, height: Y(cam.fondo) - Y(cam.tapa) + wall, style: 'fill:var(--concrete)' }, svg);
    el('rect', { x: x0, y: Y(cam.tapa), width: totalB * s, height: Y(cam.fondo) - Y(cam.tapa), style: 'fill:var(--surface)' }, svg);
    var xx = x0, crestas = [];
    cam.comp.forEach(function (k, i) {
      var act = i < o.k, w = k.b * s;
      var nivel = act ? o.NAe : cam.fondo;
      if (act) el('rect', { class: 'tr', x: xx, y: Y(nivel), width: w, height: Y(cam.fondo) - Y(nivel), style: 'fill:var(--water-soft)' }, svg);
      var r = k.D / 2000 * s;
      el('circle', { cx: xx + w / 2, cy: Y(cam.fondo) - r, r: r, style: 'fill:' + (act ? 'var(--water)' : 'var(--surface-2)') + ';stroke:var(--pipe);stroke-width:2.5' }, svg);
      text(svg, xx + w / 2, Y(cam.fondo) - r + 5, String(k.id), 'm', 'middle');
      if (k.cresta !== null) {
        el('line', { x1: xx + 4, x2: xx + w - 4, y1: Y(k.cresta), y2: Y(k.cresta), style: 'stroke:#8a5a2b;stroke-width:4' }, svg);
        crestas.push({ x: xx + w - 4, y: Y(k.cresta), t: 'Cresta ' + k.id + ': ' + f(k.cresta, 3) + ' m' + (k.Lv ? ' · L ' + f(k.Lv) + ' m' : '') });
      }
      text(svg, xx + w / 2, Y(cam.fondo) + wall + 22, f(k.b), 's', 'middle');
      xx += w;
      if (i < N - 1) {
        el('rect', { x: xx, y: Y(cam.tapa - 0.05), width: c.cam.e * s, height: Y(cam.fondo) - Y(cam.tapa - 0.05), style: 'fill:var(--concrete);stroke:var(--pipe);stroke-width:1' }, svg);
        xx += c.cam.e * s;
      }
    });
    el('line', { x1: x0 - 60, x2: x0 + totalB * s + 60, y1: Y(o.NAe), y2: Y(o.NAe), style: 'stroke:var(--water);stroke-width:2;stroke-dasharray:8 5' }, svg);
    text(svg, x0 - 66, Y(o.NAe) + 5, 'NA ' + o.key + ' ' + f(o.NAe, 3), 'w m', 'end');
    text(svg, x0 - 66, Y(cam.tapa) + 5, 'Tapa ' + f(cam.tapa), 'm', 'end');
    text(svg, x0 - 66, Y(cam.fondo) + 5, 'Fondo ' + f(cam.fondo), 'm', 'end');
    text(svg, x0 - 66, Y(v.Ze) + 5, 'Llegada ' + f(v.Ze), 's', 'end');
    el('line', { x1: x0 - 50, x2: x0, y1: Y(v.Ze), y2: Y(v.Ze), style: 'stroke:var(--pipe);stroke-width:2' }, svg);
    text(svg, x0 - 66, Y(cam.fondo) + wall + 22, 'Ancho de compartimiento (m)', 's', 'end');
    var xc = x0 + totalB * s + wall + 14, yPrev = -1e9;
    crestas.sort(function (a, b) { return a.y - b.y; }).forEach(function (k) {
      var yl = Math.max(k.y + 4, yPrev + 18); yPrev = yl;
      el('path', { d: 'M' + k.x + ' ' + k.y + 'L' + (xc - 4) + ' ' + (yl - 4), style: 'fill:none;stroke:#8a5a2b;stroke-width:1' }, svg);
      text(svg, xc, yl, k.t, 'm');
    });
    var xr = x0 + totalB * s + 300;
    text(svg, xr, 80, 'Cámara de entrada', '');
    text(svg, xr, 100, root.Engine.DESCR.camE[v.camE].t, 's');
    text(svg, xr, 128, 'Interior ' + f(cam.B) + ' × ' + f(cam.L) + ' m', 'm');
    text(svg, xr, 148, 'Altura ' + f(cam.H) + ' m · borde libre ' + f(cam.bl) + ' m', 'm');
    text(svg, xr, 176, 'Separadores: ' + root.Engine.DESCR.sep[v.sep].t.toLowerCase(), 's');
    text(svg, xr, 194, 'Espesor ' + f(c.cam.e) + ' m', 's');
    text(svg, xr, 222, 'Corte transversal, mirando aguas abajo', 's');
    text(svg, xr, 240, 'Conductos llenos: en servicio con ' + o.key, 's');
    text(svg, xr, 258, 'Conducto 1 sin vertedero: toma Qmin por el fondo', 's');
    return true;
  }

  /* ---------- Línea de accesorios de succión e impulsión ---------- */
  function lineaAcc(host, res) {
    host.innerHTML = '';
    var c = res.ctx, v = res.v;
    if (!c.acc) return false;
    var W = 1160, H = 400;
    var svg = el('svg', { viewBox: '0 0 ' + W + ' ' + H, role: 'img', 'aria-label': 'Accesorios de succión e impulsión' }, host);
    var orden = { su: ['entrada_recta', 'entrada_campana', 'codo90', 'codo45', 'v_comp', 'v_mari', 'tee_dir', 'tee_lat', 'union', 'reduccion'], im: ['ampliacion', 'v_cheq', 'v_comp', 'v_mari', 'union', 'tee_lat', 'tee_dir', 'codo90', 'codo45'] };
    var fila = function (items, y, color, nombre, ini, fin, D) {
      var lst = orden[nombre === 'Succión' ? 'su' : 'im'].map(function (id) { return items.filter(function (a) { return a.id === id; })[0]; }).filter(Boolean);
      if (nombre === 'Impulsión') lst.push({ id: 'salida', t: 'Salida al tanque', n: 1, K: 1 });
      var xa = 170, xb = W - 150;
      el('line', { x1: xa - 40, x2: xb + 40, y1: y, y2: y, style: 'stroke:' + color + ';stroke-width:10;stroke-linecap:round;opacity:.35' }, svg);
      text(svg, 20, y - 8, nombre, '');
      text(svg, 20, y + 12, 'Ø' + f(D, 0) + ' mm', 'm');
      text(svg, xa - 40, y - 26, ini, 's', 'middle');
      text(svg, xb + 40, y - 26, fin, 's', 'end');
      var paso = (xb - xa) / Math.max(lst.length - 1, 1);
      lst.forEach(function (a, i) {
        var x = lst.length === 1 ? (xa + xb) / 2 : xa + i * paso;
        sym(svg, a.id, x, y, color);
        var dy = i % 2 ? 72 : 34;
        if (i % 2) el('line', { x1: x, x2: x, y1: y + 14, y2: y + dy - 14, style: 'stroke:var(--ink-3);stroke-width:1;stroke-dasharray:2 3' }, svg);
        text(svg, x, y + dy, a.t.replace(' (retención)', '').replace(' abierta', ''), 's', 'middle');
        text(svg, x, y + dy + 17, (a.n > 1 ? a.n + ' × ' : '') + 'K ' + f(a.K), 'm', 'middle');
      });
      if (!lst.length) text(svg, (xa + xb) / 2, y + 36, c.acc.manual ? 'ΣK escrito por el usuario' : 'Sin accesorios', 's', 'middle');
    };
    fila(c.acc.su.items, 70, 'var(--s3)', 'Succión', 'Pozo (boca a ' + f(v.Zboca) + ' m)', 'Bomba', v.Dsu);
    fila(c.acc.im.items, 250, 'var(--s2)', 'Impulsión', 'Bomba', 'Tanque (salida a ' + f(v.Zimp) + ' m)', v.Dim);
    text(svg, W - 20, H - 12, 'ΣK succión = ' + f(v.Ksu) + ' por bomba · ΣK impulsión = ' + f(v.Kim) + ' + salida 1,0', 'm', 'end');
    return true;
  }

  root.Schemes = { sifon: sifon, bomba: bomba, planta: planta, seccion: seccion, camara: camara, lineaAcc: lineaAcc, sym: sym };
})(typeof self !== 'undefined' ? self : this);
