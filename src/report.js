/* Memoria en PDF, vista de impresión y libro de Excel. */
(function () {
  'use strict';
  var E = window.Engine, f = E.fmt;
  var EST = { ok: 'Cumple', fail: 'No cumple', warn: 'Recomendación', pend: 'Sin evaluar', na: 'No aplica' };
  var NOMBRE = { sifon: 'Sifón invertido', bomba: 'Sistema de bombeo' };

  function datosTabla(res) {
    var rows = [];
    E.FIELDS[res.mod].forEach(function (fd) {
      if (fd.when && !fd.when(res.vals)) return;
      var v = res.vals[fd.k];
      if (fd.type === 'sel') { var o = fd.options.filter(function (x) { return x.v === v; })[0]; v = o ? o.t : v; }
      if (fd.type === 'curve') v = String(v).trim().split(/\n+/).join(' | ');
      rows.push([fd.group, fd.label, v === undefined || v === null || v === '' ? '(falta)' : String(v), fd.unit || '']);
    });
    return rows;
  }
  function resultadosTabla(res) {
    var c = res.ctx, r = [];
    if (res.mod === 'sifon') {
      if (!c.casos || !c.casos[0].NAe) return r;
      r.push(['Conductos', c.bs.length + ': ' + c.bs.map(function (b) { return 'Ø' + f(b.D, 0); }).join(' + '), 'mm']);
      r.push(['Longitud real del conducto', f(c.g.L), 'm']);
      r.push(['Pendiente tramo que baja', f(c.g.thB, 1), '°']);
      r.push(['Pendiente tramo que sube', f(c.g.thS, 1) + ' (' + f(c.g.pS, 1) + ' %)', '°']);
      c.casos.forEach(function (o) {
        r.push([o.key + ': conductos en servicio', o.k + ' (Q = ' + f(o.Q * 1000, 1) + ' L/s)', 'und']);
        o.barrels.forEach(function (b, j) {
          r.push(['  Conducto ' + (j + 1) + ' Ø' + f(o.act[j].D, 0), 'Q ' + f(b.Q * 1000, 1) + ' L/s · V ' + f(b.V) + ' m/s · τ ' + f(b.tau) + ' Pa', '']);
          r.push(['  Pérdidas he, hc, hf, hs → H', f(b.he, 3) + ', ' + f(b.hc, 3) + ', ' + f(b.hf, 3) + ', ' + f(b.hs, 3) + ' → ' + f(b.hL, 3), 'm']);
        });
        r.push(['  Nivel cámara entrada / salida', f(o.NAe, 3) + ' / ' + f(o.NAs, 3), 'm']);
        r.push(['  Energía disponible / requerida / margen', f(o.Ee_disp, 3) + ' / ' + f(o.Ee_req, 3) + ' / ' + f(o.margen, 3), 'm']);
        r.push(['  H con el otro método', f(o.hLalt, 3), 'm']);
      });
      (c.crestas || []).forEach(function (x) { r.push(['Vertedero conducto ' + x.id + ': cresta / carga / longitud', f(x.cresta, 3) + ' / ' + f(x.h, 3) + ' / ' + (x.b ? f(x.b) : 'sin carga'), 'm']); });
      return r;
    }
    if (!c.op) return r;
    r.push(['Punto de operación: Q total', f(c.op.Qt, 2), 'L/s']);
    r.push(['Punto de operación: altura H', f(c.op.H, 2), 'm']);
    r.push(['Caudal por bomba', f(c.op.Qp, 2), 'L/s']);
    if (c.opLow) r.push(['Con nivel máximo: Q, H', f(c.opLow.Qt, 2) + ' L/s, ' + f(c.opLow.H, 2) + ' m', '']);
    if (c.pot) {
      r.push(['Eficiencia de la bomba', f(c.pot.eta, 1), '%']);
      r.push(['Eficiencia en conjunto', f(c.pot.etaConj, 1), '%']);
      r.push(['Potencia hidráulica / al eje / eléctrica', f(c.pot.Ph) + ' / ' + f(c.pot.Pe) + ' / ' + f(c.pot.Pm), 'kW']);
    }
    if (c.npsh) r.push(['NPSH disponible / requerido / margen', f(c.npsh.a) + ' / ' + f(c.npsh.r) + ' / ' + f(c.npsh.margen), 'm']);
    if (c.vel) r.push(['Velocidad succión / impulsión', f(c.vel.s) + ' / ' + f(c.vel.i), 'm/s']);
    if (c.sum) r.push(['Sumergencia / 2,5·Ds', f(c.sum.S) + ' / ' + f(c.sum.req25), 'm']);
    if (c.ar) {
      r.push(['Celeridad a', f(c.ar.a, 1), 'm/s']);
      r.push(['Tiempo crítico 2L/a', f(c.ar.Tcrit), 's']);
      r.push(['ΔH Joukowsky / ΔH aplicado', f(c.ar.jouk) + ' / ' + f(c.ar.dH), 'm']);
      r.push(['Presión máxima / mínima', f(c.ar.Hmax) + ' / ' + f(c.ar.Hmin), 'm.c.a.']);
    }
    if (c.pozo) {
      r.push(['Volumen útil / mínimo', f(c.pozo.Vol) + ' / ' + f(c.pozo.Vreq), 'm³']);
      r.push(['Retención en el pozo', f(c.pozo.tRet), 'min']);
      r.push(['Velocidad de llegada al pozo', f(c.pozo.Vent), 'm/s']);
      r.push(['Arranques por hora en el peor caso', f(c.pozo.arr, 1), '/h']);
    }
    return r;
  }
  function verifTabla(res) { return res.checks.map(function (c) { return [c.ch.id, c.ch.param, c.value, c.limit, EST[c.estado], c.ch.fuente]; }); }
  function advertTabla(res) {
    var r = [];
    res.dataIssues.forEach(function (d) { r.push([d.label, d.msg + (d.bloquea.length ? ' Bloquea: ' + d.bloquea.join(', ') + '.' : ''), d.fuente, d.sug]); });
    res.order.filter(function (n) { return n.status === 'error'; }).forEach(function (n) { r.push([n.title, n.why[0].text, n.src, n.sug]); });
    res.checks.filter(function (c) { return c.estado === 'fail' || c.estado === 'warn'; }).forEach(function (c) { r.push([c.ch.param + ' (' + EST[c.estado] + ')', c.value + ' · Límite: ' + c.limit, c.ch.fuente, c.sug]); });
    return r;
  }
  function matrizRows() { return E.CHECKS.map(function (c) { return [c.id, NOMBRE[c.mod], c.param, c.limite, c.fuente, c.cond, c.sug, c.nivel === 'norma' ? 'Obligatorio' : 'Recomendación']; }); }

  /* Convierte un SVG a imagen, con los estilos ya resueltos */
  var STY = ['fill', 'stroke', 'stroke-width', 'stroke-dasharray', 'stroke-linecap', 'stroke-linejoin', 'opacity', 'font-family', 'font-size', 'font-weight', 'paint-order'];
  function svgToPng(svg, W) {
    return new Promise(function (ok) {
      var vb = svg.viewBox.baseVal, ratio = vb.height / vb.width, w = W || 1200, h = Math.round(w * ratio);
      var cl = svg.cloneNode(true);
      var src = [svg].concat(Array.prototype.slice.call(svg.querySelectorAll('*')));
      var dst = [cl].concat(Array.prototype.slice.call(cl.querySelectorAll('*')));
      src.forEach(function (s, i) {
        var cs = getComputedStyle(s), st = '';
        STY.forEach(function (p) { st += p + ':' + cs.getPropertyValue(p) + ';'; });
        dst[i].setAttribute('style', st + 'animation:none');
      });
      cl.setAttribute('width', w); cl.setAttribute('height', h);
      cl.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
      var bg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      bg.setAttribute('x', vb.x); bg.setAttribute('y', vb.y); bg.setAttribute('width', vb.width); bg.setAttribute('height', vb.height); bg.setAttribute('style', 'fill:#ffffff');
      cl.insertBefore(bg, cl.firstChild);
      var url = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(new XMLSerializer().serializeToString(cl));
      var img = new Image();
      img.onload = function () {
        var cv = document.createElement('canvas'); cv.width = w; cv.height = h;
        cv.getContext('2d').drawImage(img, 0, 0, w, h);
        ok({ url: cv.toDataURL('image/png'), ratio: ratio });
      };
      img.onerror = function () { ok(null); };
      img.src = url;
    });
  }
  /* Imágenes de un módulo dibujadas fuera de pantalla en tema claro */
  function imagenes(mod, res, api) {
    var out = [];
    if (!res.complete) return Promise.resolve(out);
    var root = document.getElementById('offscreen');
    var html = document.documentElement, prev = html.getAttribute('data-theme');
    html.setAttribute('data-theme', 'light');
    var restore = function () { if (prev) html.setAttribute('data-theme', prev); else html.removeAttribute('data-theme'); root.innerHTML = ''; };
    var seq = Promise.resolve();
    var pasos = mod === 'sifon' ? [0, 1, 2] : [null];
    pasos.forEach(function (ix) {
      seq = seq.then(function () {
        var h = document.createElement('div'); root.innerHTML = ''; root.appendChild(h);
        if (mod === 'sifon') window.Schemes.sifon(h, res, ix); else window.Schemes.bomba(h, res);
        return svgToPng(h.querySelector('svg'), 1400).then(function (im) { if (im) out.push({ t: mod === 'sifon' ? 'Perfil del sifón con ' + ['Qmin', 'Qmed', 'Qmax'][ix] : 'Esquema de la estación de bombeo', url: im.url, ratio: im.ratio }); });
      });
    });
    seq = seq.then(function () {
      try {
        var u = window.Scene3D.snapshot(mod, res, 2, 1400, 800);
        if (u) out.push({ t: 'Modelo 3D', url: u, ratio: 800 / 1400, jpeg: true });
      } catch (e) { console.warn('Sin imagen 3D', e); }
      var h = document.createElement('div'); root.innerHTML = ''; root.appendChild(h);
      var keepCaso = api.state.caso; api.state.caso = 2;
      api.drawCharts(mod, res, h);
      api.state.caso = keepCaso;
      var divs = Array.prototype.slice.call(h.children), s2 = Promise.resolve();
      divs.forEach(function (d) {
        s2 = s2.then(function () {
          var title = d.querySelector('h4').textContent, leg = Array.prototype.slice.call(d.querySelectorAll('.legend span')).map(function (x) {
            var i = x.querySelector('i'), cs = getComputedStyle(i), dash = i.classList.contains('dashed');
            var m = (dash ? cs.color : cs.backgroundColor).match(/[\d.]+/g) || [0, 0, 0];
            return { t: x.textContent, rgb: [+m[0], +m[1], +m[2]], dash: dash };
          });
          return svgToPng(d.querySelector('svg'), 1000).then(function (im) { if (im) out.push({ t: title, leg: leg, url: im.url, ratio: im.ratio, chart: true }); });
        });
      });
      return s2;
    });
    return seq.then(function () { restore(); return out; }, function (e) { restore(); throw e; });
  }

  /* ---------- PDF ---------- */
  function pdf(api) {
    var results = api.results();
    var J = window.jspdf.jsPDF;
    var doc = new J({ unit: 'mm', format: 'a4' });
    doc.addFileToVFS('DV.ttf', window.PDF_FONTS.regular); doc.addFont('DV.ttf', 'DV', 'normal');
    doc.addFileToVFS('DVB.ttf', window.PDF_FONTS.bold); doc.addFont('DVB.ttf', 'DV', 'bold');
    doc.setFont('DV', 'normal');
    var W = 210, M = 14, y = 16;
    var INK = [20, 24, 26], ACC = [15, 94, 124], GR = [90, 96, 100];
    var next = function (need) { if (y + need > 282) { doc.addPage(); y = 16; } };
    var H1 = function (t) { next(16); doc.setFont('DV', 'bold'); doc.setFontSize(14); doc.setTextColor(ACC[0], ACC[1], ACC[2]); doc.text(t, M, y); y += 7; doc.setFont('DV', 'normal'); doc.setTextColor(INK[0], INK[1], INK[2]); };
    var H2 = function (t) { next(36); doc.setFont('DV', 'bold'); doc.setFontSize(10.5); doc.setTextColor(INK[0], INK[1], INK[2]); doc.text(t, M, y); y += 5; doc.setFont('DV', 'normal'); };
    var para = function (t, size, col) {
      doc.setFontSize(size || 9); var c = col || INK; doc.setTextColor(c[0], c[1], c[2]);
      doc.splitTextToSize(t, W - 2 * M).forEach(function (l) { next(5); doc.text(l, M, y); y += (size || 9) * 0.45; });
      y += 1.5; doc.setTextColor(INK[0], INK[1], INK[2]);
    };
    var table = function (head, body, opts) {
      if (!body.length) return;
      doc.autoTable(Object.assign({
        head: [head], body: body, startY: y, margin: { left: M, right: M, top: 14, bottom: 14 }, theme: 'grid',
        styles: { font: 'DV', fontSize: 7.5, cellPadding: 1.4, lineColor: [200, 204, 198], lineWidth: 0.1, textColor: INK, overflow: 'linebreak' },
        headStyles: { font: 'DV', fontStyle: 'bold', fillColor: [232, 238, 239], textColor: INK }
      }, opts || {}));
      y = doc.lastAutoTable.finalY + 6;
    };
    // Portada
    doc.setFillColor(16, 38, 47); doc.rect(0, 0, W, 34, 'F');
    doc.setTextColor(255, 255, 255); doc.setFont('DV', 'bold'); doc.setFontSize(17);
    doc.text('Sifones invertidos y sistemas de bombeo', M, 15);
    doc.setFont('DV', 'normal'); doc.setFontSize(9.5);
    doc.text('Memoria de cálculo · Fundación Universitaria Tecnológico Comfenalco · AA-PF-01, Grupo G2', M, 23);
    var hoy = new Date();
    doc.text('Generada: ' + hoy.toLocaleDateString('es-CO') + ' ' + hoy.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }), M, 29);
    doc.setTextColor(INK[0], INK[1], INK[2]);
    y = 42;
    var m = api.state.meta;
    if (m.proyecto) para('Proyecto: ' + m.proyecto, 10);
    if (m.integrantes) para('Integrantes: ' + m.integrantes, 10);
    if (m.caso) para('Caso: ' + m.caso, 10);
    H2('Resumen');
    var fila = function (mod) {
      var s = E.summarize(results[mod]);
      return [NOMBRE[mod], results[mod].complete ? 'Completo' : 'Incompleto', s.ok, s.fail, s.warn, s.bloq];
    };
    table(['Módulo', 'Cálculo', 'Cumplen', 'Incumplen', 'Recomendaciones', 'Pasos sin calcular'], [fila('sifon'), fila('bomba')]);

    var mods = ['sifon', 'bomba'], chain = Promise.resolve();
    mods.forEach(function (mod) {
      chain = chain.then(function () { return imagenes(mod, results[mod], api); }).then(function (imgs) {
        var res = results[mod];
        doc.addPage(); y = 16;
        H1(NOMBRE[mod]);
        H2('Datos de entrada');
        table(['Grupo', 'Parámetro', 'Valor', 'Unidad'], datosTabla(res));
        H2('Resultados');
        table(['Resultado', 'Valor', 'Unidad'], resultadosTabla(res));
        H2('Advertencias y sugerencias');
        var ad = advertTabla(res);
        if (ad.length) table(['Parámetro', 'Qué ocurre', 'Fuente', 'Cómo corregir'], ad, { columnStyles: { 0: { cellWidth: 38 }, 2: { cellWidth: 42 } } });
        else para('No hay datos faltantes ni incumplimientos.');
        H2('Verificaciones');
        table(['Id', 'Parámetro', 'Valor', 'Límite', 'Estado', 'Fuente'], verifTabla(res), {
          columnStyles: { 0: { cellWidth: 9 }, 1: { cellWidth: 32 }, 4: { cellWidth: 18 }, 5: { cellWidth: 46 } },
          didParseCell: function (d) {
            if (d.section === 'body' && d.column.index === 4) {
              var c = { Cumple: [11, 122, 67], 'No cumple': [179, 38, 30], 'Recomendación': [154, 99, 0] }[d.cell.raw];
              if (c) { d.cell.styles.textColor = c; d.cell.styles.fontStyle = 'bold'; }
            }
          }
        });
        if (imgs.length) {
          H2('Esquemas y gráficas');
          imgs.forEach(function (im) {
            var w = im.chart ? 150 : W - 2 * M, h = w * im.ratio;
            next(h + 14);
            doc.setFont('DV', 'bold'); doc.setFontSize(8.5); doc.text(im.t, M, y); doc.setFont('DV', 'normal'); y += 3;
            if (im.leg && im.leg.length) {
              y += 1;
              var lx = M;
              doc.setFontSize(7);
              im.leg.forEach(function (l) {
                var tw = doc.getTextWidth(l.t);
                if (lx + tw + 9 > W - M) { lx = M; y += 3.4; }
                doc.setDrawColor(l.rgb[0], l.rgb[1], l.rgb[2]); doc.setLineWidth(0.8);
                if (l.dash) doc.setLineDashPattern([1, 0.8], 0); else doc.setLineDashPattern([], 0);
                doc.line(lx, y - 0.9, lx + 5, y - 0.9);
                doc.setLineDashPattern([], 0);
                doc.setTextColor(GR[0], GR[1], GR[2]);
                doc.text(l.t, lx + 6, y);
                lx += tw + 11;
              });
              doc.setTextColor(INK[0], INK[1], INK[2]); doc.setLineWidth(0.1); y += 2;
            }
            doc.addImage(im.url, im.jpeg ? 'JPEG' : 'PNG', M, y, w, h, undefined, 'FAST');
            y += h + 5;
          });
        }
        doc.addPage(); y = 16;
        H2('Memoria paso a paso');
        res.order.forEach(function (n, i) {
          next(12);
          doc.setFont('DV', 'bold'); doc.setFontSize(8.5); doc.text((i + 1) + '. ' + n.title, M, y); doc.setFont('DV', 'normal'); y += 4;
          (n.status === 'ok' ? n.lines : n.why.map(function (w) { return w.text; })).forEach(function (l) { para(l, 7.5); });
          para('Fuente: ' + n.src, 6.8, GR);
        });
      });
    });
    return chain.then(function () {
      doc.addPage(); y = 16;
      H1('Matriz de trazabilidad normativa');
      table(['Id', 'Módulo', 'Parámetro', 'Límite', 'Fuente', 'Condición', 'Sugerencia', 'Nivel'], matrizRows(), { styles: { font: 'DV', fontSize: 6.3, cellPadding: 1, lineColor: [200, 204, 198], lineWidth: 0.1, textColor: INK }, columnStyles: { 0: { cellWidth: 8 }, 1: { cellWidth: 12 } } });
      H1('Referencias');
      ['R0330', 'RASD', 'RASB', 'HEC22', 'GUIA'].forEach(function (k, i) { para((i + 1) + '. ' + E.SOURCES[k].full, 8.5); });
      var n = doc.getNumberOfPages();
      for (var i = 1; i <= n; i++) {
        doc.setPage(i); doc.setFontSize(7); doc.setTextColor(GR[0], GR[1], GR[2]);
        doc.text('Sifones invertidos y sistemas de bombeo · AA-PF-01', M, 291);
        doc.text('Página ' + i + ' de ' + n, W - M, 291, { align: 'right' });
      }
      doc.save('Memoria_Sifones_y_Bombeo.pdf');
    });
  }

  /* ---------- Impresión ---------- */
  function tablaHtml(head, rows) {
    var e = window.Charts.esc;
    return '<table><thead><tr>' + head.map(function (h) { return '<th>' + e(h) + '</th>'; }).join('') + '</tr></thead><tbody>' + rows.map(function (r) { return '<tr>' + r.map(function (c) { return '<td>' + e(c) + '</td>'; }).join('') + '</tr>'; }).join('') + '</tbody></table>';
  }
  function print(api) {
    var results = api.results(), e = window.Charts.esc, host = document.getElementById('print');
    var seq = Promise.resolve(), html = '<h1>Sifones invertidos y sistemas de bombeo</h1><p>Memoria de cálculo · AA-PF-01, Grupo G2 · ' + new Date().toLocaleDateString('es-CO') + '</p>';
    var m = api.state.meta;
    if (m.proyecto) html += '<p>Proyecto: ' + e(m.proyecto) + '</p>';
    if (m.integrantes) html += '<p>Integrantes: ' + e(m.integrantes) + '</p>';
    api.toast('Preparando la vista de impresión…');
    ['sifon', 'bomba'].forEach(function (mod) {
      seq = seq.then(function () { return imagenes(mod, results[mod], api); }).then(function (imgs) {
        var res = results[mod];
        html += '<h2>' + NOMBRE[mod] + '</h2><h3>Datos de entrada</h3>' + tablaHtml(['Grupo', 'Parámetro', 'Valor', 'Unidad'], datosTabla(res));
        html += '<h3>Resultados</h3>' + tablaHtml(['Resultado', 'Valor', 'Unidad'], resultadosTabla(res));
        var ad = advertTabla(res);
        html += '<h3>Advertencias y sugerencias</h3>' + (ad.length ? tablaHtml(['Parámetro', 'Qué ocurre', 'Fuente', 'Cómo corregir'], ad) : '<p>No hay datos faltantes ni incumplimientos.</p>');
        html += '<h3>Verificaciones</h3>' + tablaHtml(['Id', 'Parámetro', 'Valor', 'Límite', 'Estado', 'Fuente'], verifTabla(res));
        imgs.forEach(function (im) { html += '<h3>' + e(im.t) + '</h3>' + (im.leg && im.leg.length ? '<p style="font-size:8pt;margin:0 0 3pt">' + im.leg.map(function (l) { return '<span style="color:rgb(' + l.rgb.join(',') + ')">' + (l.dash ? '- - -' : '———') + '</span> ' + e(l.t); }).join(' &nbsp; ') + '</p>' : '') + '<img src="' + im.url + '" alt="' + e(im.t) + '">'; });
        html += '<h3>Memoria paso a paso</h3>';
        res.order.forEach(function (n, i) { html += '<p><b>' + (i + 1) + '. ' + e(n.title) + '</b></p><pre>' + (n.status === 'ok' ? n.lines : n.why.map(function (w) { return w.text; })).map(e).join('\n') + '</pre><p><small>Fuente: ' + e(n.src) + '</small></p>'; });
      });
    });
    return seq.then(function () {
      html += '<h2>Referencias</h2><ol>' + ['R0330', 'RASD', 'RASB', 'HEC22', 'GUIA'].map(function (k) { return '<li>' + e(E.SOURCES[k].full) + '</li>'; }).join('') + '</ol>';
      host.innerHTML = html;
      setTimeout(function () { window.print(); }, 200);
    });
  }

  /* ---------- Excel ---------- */
  function hoja(wb, nombre, aoa, anchos) {
    var ws = XLSX.utils.aoa_to_sheet(aoa);
    ws['!cols'] = (anchos || []).map(function (w) { return { wch: w }; });
    XLSX.utils.book_append_sheet(wb, ws, nombre);
  }
  function datosHoja(res) {
    var a = [['Clave', 'Parámetro', 'Valor', 'Unidad', 'Grupo']];
    E.FIELDS[res.mod].forEach(function (fd) {
      var v = res.vals[fd.k];
      if (fd.type === 'num') { var x = E.parseNum(v); v = isNaN(x) ? (v === undefined ? '' : v) : x; }
      if (fd.type === 'curve') v = String(v).trim().split(/\n+/).join(' | ');
      a.push([fd.k, fd.label, v, fd.unit || '', fd.group]);
    });
    return a;
  }
  function memoriaHoja(res) {
    var a = [['Paso', 'Estado', 'Detalle', 'Fuente']];
    res.order.forEach(function (n, i) {
      var ls = n.status === 'ok' ? n.lines : n.why.map(function (w) { return w.text; });
      ls.forEach(function (l, j) { a.push([j === 0 ? (i + 1) + '. ' + n.title : '', j === 0 ? (n.status === 'ok' ? 'Calculado' : (n.status === 'error' ? 'Error' : 'Bloqueado')) : '', l.trim(), j === 0 ? n.src : '']); });
    });
    return a;
  }
  function xlsx(api) {
    var r = api.results(), wb = XLSX.utils.book_new();
    var fila = function (mod) { var s = E.summarize(r[mod]); return [NOMBRE[mod], r[mod].complete ? 'Completo' : 'Incompleto', s.ok, s.fail, s.warn, s.bloq]; };
    var m = api.state.meta;
    hoja(wb, 'Resumen', [
      ['Sifones invertidos y sistemas de bombeo'], ['Memoria de cálculo · AA-PF-01, Grupo G2'], ['Fecha', new Date().toLocaleString('es-CO')],
      ['Proyecto', m.proyecto || ''], ['Integrantes', m.integrantes || ''], ['Caso', m.caso || ''], [],
      ['Módulo', 'Cálculo', 'Cumplen', 'Incumplen', 'Recomendaciones', 'Pasos sin calcular'], fila('sifon'), fila('bomba')
    ], [34, 22, 10, 11, 17, 18]);

    hoja(wb, 'Sifon_Datos', datosHoja(r.sifon), [10, 44, 40, 9, 24]);
    var c = r.sifon.ctx, a = [['Caudal', 'Q total (L/s)', 'Conducto', 'D (mm)', 'Q conducto (L/s)', 'V (m/s)', 'f', 'Re', 'he (m)', 'hc (m)', 'hf (m)', 'hs (m)', 'H (m)', 'τ (Pa)']];
    if (c.casos) c.casos.forEach(function (o) { o.barrels.forEach(function (b, j) { a.push([o.key, o.Q * 1000, j + 1, o.act[j].D, b.Q * 1000, b.V, b.f, Math.round(b.Re), b.he, b.hc, b.hf, b.hs, b.hL, b.tau]); }); });
    hoja(wb, 'Sifon_Resultados', a, [8, 12, 9, 8, 15, 8, 8, 10, 8, 8, 8, 8, 8, 8]);
    a = [['Caudal', 'NA entrada (m)', 'NA salida (m)', 'E disponible (m)', 'E requerida (m)', 'Margen (m)', 'H otro método (m)', 'Conductos en servicio']];
    if (c.casos && c.casos[0].NAe) c.casos.forEach(function (o) { a.push([o.key, o.NAe, o.NAs, o.Ee_disp, o.Ee_req, o.margen, o.hLalt, o.k]); });
    hoja(wb, 'Sifon_Niveles', a, [8, 15, 14, 16, 16, 11, 17, 20]);
    a = [['Caudal', 'Abscisa (m)', 'Punto', 'Batea (m)', 'Línea de energía (m)', 'Piezométrica (m)']];
    if (c.perfil) c.perfil.casos.forEach(function (p) { c.perfil.est.forEach(function (e, j) { a.push([p.key, e.x, e.n, e.z, p.egl[j], p.hgl[j]]); }); });
    hoja(wb, 'Sifon_Perfil', a, [8, 11, 22, 10, 19, 16]);
    hoja(wb, 'Sifon_Verificaciones', [['Id', 'Parámetro', 'Valor', 'Límite', 'Estado', 'Fuente', 'Cómo corregir']].concat(r.sifon.checks.map(function (x) { return [x.ch.id, x.ch.param, x.value, x.limit, EST[x.estado], x.ch.fuente, x.sug]; })), [6, 34, 44, 34, 14, 60, 60]);
    hoja(wb, 'Sifon_Memoria', memoriaHoja(r.sifon), [34, 11, 100, 50]);

    hoja(wb, 'Bomba_Datos', datosHoja(r.bomba), [10, 44, 40, 11, 18]);
    var b = r.bomba.ctx;
    a = [['Q por bomba (L/s)', 'H catálogo (m)', 'η (%)', 'NPSHr (m)', 'H regresión (m)']];
    if (b.curva) b.curva.forEach(function (p) { a.push([p.Q, p.H, p.eta, p.npshr, b.fit.A * p.Q * p.Q + b.fit.B * p.Q + b.fit.C]); });
    a.push([]);
    if (b.fit) { a.push(['Regresión H = A·Q² + B·Q + C (Q en L/s por bomba)']); a.push(['A', b.fit.A]); a.push(['B', b.fit.B]); a.push(['C', b.fit.C]); a.push(['R²', b.fit.r2]); }
    hoja(wb, 'Bomba_Curva', a, [18, 14, 8, 11, 15]);
    a = [['Q total (L/s)', 'H sistema, nivel mínimo (m)', 'H sistema, nivel máximo (m)', 'H bomba(s) (m)']];
    if (b.op && b.curva) {
      var qm = b.qMaxCurva * r.bomba.v.nAct;
      for (var i = 0; i <= 30; i++) {
        var Q = qm * i / 30, Qp = Q / r.bomba.v.nAct;
        a.push([Q, E.alturaSistema(Q / 1000, b.HsMax, r.bomba.v, b).H, E.alturaSistema(Q / 1000, b.HsMin, r.bomba.v, b).H, b.fit.A * Qp * Qp + b.fit.B * Qp + b.fit.C]);
      }
    }
    hoja(wb, 'Bomba_Sistema', a, [14, 26, 26, 16]);
    a = [['Resultado', 'Valor', 'Unidad']];
    if (b.op) a.push(['Q operación total', b.op.Qt, 'L/s'], ['H operación', b.op.H, 'm'], ['Q por bomba', b.op.Qp, 'L/s']);
    if (b.pot) a.push(['Eficiencia bomba', b.pot.eta, '%'], ['Eficiencia conjunto', b.pot.etaConj, '%'], ['P hidráulica', b.pot.Ph, 'kW'], ['P al eje por bomba', b.pot.Pe, 'kW'], ['P eléctrica por bomba', b.pot.Pm, 'kW']);
    if (b.npsh) a.push(['NPSH disponible', b.npsh.a, 'm'], ['NPSH requerido', b.npsh.r, 'm'], ['Hes', b.npsh.Hes, 'm']);
    if (b.vel) a.push(['V succión', b.vel.s, 'm/s'], ['V impulsión', b.vel.i, 'm/s']);
    if (b.sum) a.push(['Sumergencia', b.sum.S, 'm'], ['2,5·Ds', b.sum.req25, 'm'], ['Separación al fondo', b.sum.fondo, 'm']);
    if (b.ar) a.push(['Celeridad a', b.ar.a, 'm/s'], ['Tiempo crítico', b.ar.Tcrit, 's'], ['ΔH Joukowsky', b.ar.jouk, 'm'], ['ΔH Michaud', b.ar.mich, 'm'], ['ΔH aplicado', b.ar.dH, 'm'], ['Presión máxima', b.ar.Hmax, 'm.c.a.'], ['Presión mínima', b.ar.Hmin, 'm.c.a.']);
    if (b.pozo) a.push(['Volumen útil', b.pozo.Vol, 'm³'], ['Volumen mínimo', b.pozo.Vreq, 'm³'], ['Retención', b.pozo.tRet, 'min'], ['V llegada', b.pozo.Vent, 'm/s'], ['Arranques por hora', b.pozo.arr, '/h']);
    hoja(wb, 'Bomba_Resultados', a, [26, 12, 9]);
    hoja(wb, 'Bomba_Verificaciones', [['Id', 'Parámetro', 'Valor', 'Límite', 'Estado', 'Fuente', 'Cómo corregir']].concat(r.bomba.checks.map(function (x) { return [x.ch.id, x.ch.param, x.value, x.limit, EST[x.estado], x.ch.fuente, x.sug]; })), [6, 34, 44, 34, 14, 60, 60]);
    hoja(wb, 'Bomba_Memoria', memoriaHoja(r.bomba), [34, 11, 100, 50]);

    hoja(wb, 'Matriz_Normativa', [['Id', 'Módulo', 'Parámetro verificado', 'Valor límite', 'Fuente', 'Condición de advertencia', 'Sugerencia', 'Nivel']].concat(matrizRows()), [6, 16, 34, 40, 60, 28, 50, 14]);
    hoja(wb, 'Plan_Pruebas', [['Id', 'Módulo', 'Tipo', 'Caso', 'Resultado esperado', 'Resultado obtenido', 'Advertencia mostrada', 'Resultado']].concat(E.correrPruebas().map(function (t) { return [t.id, NOMBRE[t.mod], t.tipo, t.desc, t.espera, t.obtenido, t.advertencia, t.paso ? 'Pasa' : 'Falla']; })), [8, 16, 14, 40, 40, 40, 70, 9]);
    hoja(wb, 'Referencias', ['R0330', 'RASD', 'RASB', 'HEC22', 'GUIA'].map(function (k) { return [E.SOURCES[k].full]; }), [130]);
    XLSX.writeFile(wb, 'Datos_Sifones_y_Bombeo.xlsx');
    api.toast('Excel descargado.');
  }
  function importXlsx(file, api) {
    return file.arrayBuffer().then(function (buf) {
      var wb;
      try { wb = XLSX.read(buf, { type: 'array' }); } catch (e) { throw new Error('No se pudo leer el archivo: no parece un Excel válido.'); }
      var cargados = 0, leer = function (sheet, mod) {
        var ws = wb.Sheets[sheet]; if (!ws) return;
        var rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: '' });
        var hdr = rows[0] || [], kk = hdr.indexOf('Clave'), kv = hdr.indexOf('Valor');
        if (kk < 0 || kv < 0) return;
        var nuevos = {};
        var campos = {}; E.FIELDS[mod].forEach(function (fd) { campos[fd.k] = fd; });
        rows.slice(1).forEach(function (r) {
          var k = r[kk]; if (!campos[k]) return;
          var v = r[kv];
          if (campos[k].type === 'curve') v = String(v).split(/\s*\|\s*/).join('\n');
          nuevos[k] = v === '' ? '' : (campos[k].type === 'num' ? v : String(v));
        });
        api.setVals(mod, Object.assign({}, api.state.vals[mod], nuevos));
        cargados++;
      };
      leer('Sifon_Datos', 'sifon'); leer('Bomba_Datos', 'bomba');
      if (!cargados) throw new Error('El archivo no tiene las hojas Sifon_Datos ni Bomba_Datos. Use el Excel descargado de esta aplicación.');
      return 'Datos cargados desde ' + file.name + '.';
    });
  }

  window.Report = { pdf: pdf, print: print, xlsx: xlsx, importXlsx: importXlsx, matrizRows: matrizRows };
})();
