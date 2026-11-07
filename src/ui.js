/* Interfaz de la aplicación. */
(function () {
  'use strict';
  var E = window.Engine, C = window.Charts, S = window.Schemes;
  var esc = C.esc, f = E.fmt;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  var PAGES = [
    { id: 'inicio', t: 'Inicio' }, { id: 'sifon', t: 'Sifón invertido' }, { id: 'bomba', t: 'Sistema de bombeo' },
    { id: 'normas', t: 'Límites normativos' }, { id: 'refs', t: 'Referencias' }, { id: 'pruebas', t: 'Plan de pruebas' }, { id: 'exportar', t: 'Exportar' }, { id: 'ayuda', t: 'Instructivo' }
  ];
  var TABS = [
    { id: 'resumen', t: 'Resultados' }, { id: 'esquema', t: 'Perfil' }, { id: 'detalles', t: 'Planta y detalles', tb: 'Tuberías y accesorios' }, { id: 'v3d', t: 'Modelo 3D' }, { id: 'graficas', t: 'Gráficas' },
    { id: 'cadena', t: 'Cadena de datos' }, { id: 'verif', t: 'Verificaciones' }, { id: 'memoria', t: 'Memoria paso a paso' }
  ];
  var ESTADO = { ok: ['Cumple', 'b-ok', '✓'], fail: ['No cumple', 'b-fail', '✕'], warn: ['Recomendación', 'b-warn', '!'], pend: ['Sin evaluar', 'b-pend', '…'], na: ['No aplica', 'b-na', '–'] };
  var CAMPO = { S1: 'modo', S2: 'modo', S3: 'modo', S4: 'Ld', S5: 'La', S6: 'Ld', S7: 'Zs', S8: 'modo', S9: 'modo', S10: 'rejilla', S11: 'Zci', S12: 'Zcs', S13: 'De', S14: 'modo', S15: 'modo', B1: 'nInst', B2: 'curva', B3: 'Dsu', B4: 'Dim', B5: 'Zeje', B6: 'Zeje', B7: 'curva', B8: 'curva', B9: 'Zboca', B10: 'Zboca', B11: 'Dsu', B12: 'Dsu', B13: 'Tc', B14: 'PN', B15: 'Tc', B16: 'LB', B17: 'LB', B18: 'Dla', B19: 'Dla', B20: 'LB', B21: 'vfd', B22: 'respaldo', B23: 'curva', S16: 'Zf', S17: 'Lc', S18: 'Ztce', B24: 'Qd', B25: 'Zimp', B26: 'accIm' };

  var state = {
    page: 'inicio', vals: { sifon: E.defaults('sifon'), bomba: E.defaults('bomba') }, res: {},
    tab: { sifon: 'resumen', bomba: 'resumen' }, caso: 2, esc: { sifon: 'normal', bomba: 'normal' }, viewers: {}, hosts: {},
    meta: { proyecto: '', integrantes: '', caso: '' }, filtro: 'todos', pruebas: null
  };
  function store(k, v) { try { localStorage.setItem('sibo.' + k, JSON.stringify(v)); } catch (e) { /* almacenamiento no disponible */ } }
  function load(k) { try { var s = localStorage.getItem('sibo.' + k); return s ? JSON.parse(s) : null; } catch (e) { return null; } }
  (function () {
    var v = load('vals'); if (v && v.sifon && v.bomba) { state.vals.sifon = Object.assign(E.defaults('sifon'), v.sifon); state.vals.bomba = Object.assign(E.defaults('bomba'), v.bomba); state.esc = { sifon: null, bomba: null }; }
    var m = load('meta'); if (m) state.meta = Object.assign(state.meta, m);
    var t = load('theme'); if (t) document.documentElement.setAttribute('data-theme', t);
  })();

  function toast(msg) { var t = $('#toast'); t.textContent = msg; t.classList.add('on'); clearTimeout(toast.h); toast.h = setTimeout(function () { t.classList.remove('on'); }, 3800); }
  function compute(mod) { state.res[mod] = E.calculate(mod, state.vals[mod]); return state.res[mod]; }
  function badge(est) { var e = ESTADO[est]; return '<span class="badge ' + e[1] + '">' + e[2] + ' ' + e[0] + '</span>'; }
  function globalStatus(res) {
    var s = E.summarize(res);
    if (s.datos || s.bloq) return { k: 'pend', icon: '…', t: 'Cálculo incompleto', d: s.bloq + ' paso(s) sin calcular por ' + (s.datos ? s.datos + ' dato(s) por corregir' : 'un error en la cadena') };
    if (s.fail) return { k: 'fail', icon: '✕', t: 'Diseño fuera de norma', d: s.fail + ' verificación(es) obligatoria(s) sin cumplir' };
    if (s.warn) return { k: 'warn', icon: '!', t: 'Cumple, con recomendaciones', d: s.warn + ' recomendación(es) por revisar' };
    return { k: 'ok', icon: '✓', t: 'Diseño conforme', d: 'Cumple todas las verificaciones evaluadas' };
  }

  /* ---------- Navegación ---------- */
  function renderNav() {
    $('#nav').innerHTML = PAGES.map(function (p) {
      var dot = '';
      if (p.id === 'sifon' || p.id === 'bomba') {
        var gs = globalStatus(state.res[p.id] || compute(p.id));
        var col = { ok: '--ok', warn: '--warn', fail: '--bad', pend: '--pend' }[gs.k];
        dot = '<span class="dot" style="background:var(' + col + ')" title="' + esc(gs.t) + '"></span>';
      }
      return '<button data-page="' + p.id + '"' + (state.page === p.id ? ' aria-current="page"' : '') + '>' + p.t + dot + '</button>';
    }).join('');
  }
  function go(page) {
    state.page = page;
    try { history.replaceState(null, '', '#' + page); } catch (e) { /* archivo local sin historial */ }
    Object.keys(state.viewers).forEach(function (k) { state.viewers[k].stop(); });
    renderNav(); renderPage();
    window.scrollTo(0, 0);
  }

  function renderPage() {
    var m = $('#main');
    if (state.page === 'sifon' || state.page === 'bomba') return renderModule(state.page);
    if (state.page === 'inicio') return renderInicio(m);
    if (state.page === 'normas') return renderNormas(m);
    if (state.page === 'refs') return renderRefs(m);
    if (state.page === 'pruebas') return renderPruebas(m);
    if (state.page === 'exportar') return renderExportar(m);
    return renderAyuda(m);
  }

  /* ---------- Inicio ---------- */
  function renderInicio(m) {
    var card = function (mod, name, desc) {
      var r = state.res[mod] || compute(mod), g = globalStatus(r), s = E.summarize(r);
      return '<div class="modcard"><div class="line"><h2>' + name + '</h2><span class="badge b-' + g.k + '">' + g.icon + ' ' + esc(g.t) + '</span></div>' +
        '<p class="mini">' + desc + '</p>' +
        '<div class="line mini"><span>' + s.ok + ' cumplen · ' + s.fail + ' incumplen · ' + s.warn + ' recomendaciones · ' + s.bloq + ' pasos sin calcular</span>' +
        '<button class="btn" data-page="' + mod + '">Abrir</button></div></div>';
    };
    var reqs = [
      ['R1 Funcional', 'Sifón y bombeo calculan en vivo, aun con datos nuevos.', 'sifon'],
      ['R2 Portátil', 'Un solo archivo HTML. Funciona sin instalar nada y sin internet.', 'ayuda'],
      ['R3 Esquemas', 'Perfil y modelo 3D que se redibujan con los valores calculados.', 'sifon'],
      ['R4 Visual', 'Entradas, resultados y advertencias separados; unidades en cada campo.', 'bomba'],
      ['R5 Referencias', 'Cada límite muestra su valor y su fuente, con artículo o página.', 'normas'],
      ['R6 Animación', 'Flujo a velocidad real, llenado de cámaras y punto de operación.', 'bomba'],
      ['R7 Advertencias', 'Indican parámetro, límite, fuente y el cambio que corrige.', 'sifon'],
      ['R8 Uso de IA', 'Lo entrega el grupo: bitácora, registro de errores y declaración.', 'ayuda'],
      ['R9 Memoria', 'Memoria en PDF, Excel o vista de impresión.', 'exportar']
    ];
    m.innerHTML = '<div class="hero"><div class="intro"><h1>Sifones invertidos y sistemas de bombeo</h1>' +
      '<p>Aplicación para diseñar y verificar sifones invertidos y estaciones de bombeo con la Resolución 0330 de 2017, el RAS y HEC-22.</p>' +
      '<ol class="steps"><li><span>Abra un módulo y escriba sus datos a la izquierda. Los resultados cambian mientras escribe.</span></li>' +
      '<li><span>Revise el estado arriba: si algo falta o incumple, la aplicación dice qué es, por qué y cómo corregirlo.</span></li>' +
      '<li><span>Mire el perfil, el modelo 3D, las gráficas y la memoria paso a paso.</span></li>' +
      '<li><span>Descargue la memoria en PDF o los datos en Excel.</span></li></ol></div><div>' +
      card('sifon', 'Sifón invertido', 'Diámetro y número de conductos para Qmin, Qmed y Qmax; velocidades, pérdidas, niveles, perfil y cotas.') +
      card('bomba', 'Sistema de bombeo', 'Curva del sistema, punto de operación, potencia, NPSH, velocidades, sumergencia y golpe de ariete.') +
      '</div></div><div class="sec-title"><h2>Requisitos de la guía AA-PF-01</h2></div><div class="req-grid">' +
      reqs.map(function (r) { return '<div class="req"><b>' + r[0] + '</b><span>' + r[1] + '</span> <button class="linkish" data-page="' + r[2] + '">Ver</button></div>'; }).join('') + '</div>';
  }

  /* ---------- Módulo ---------- */
  function renderModule(mod) {
    var m = $('#main');
    var titulo = mod === 'sifon' ? 'Sifón invertido' : 'Sistema de bombeo';
    var dob = E.DESCR.obst[state.vals.sifon.obst];
    var desc = mod === 'sifon' ? 'Conductos a presión que cruzan ' + (dob ? 'un obstáculo: ' + dob.t.toLowerCase() : 'un obstáculo') + '. Deje vacío un campo marcado «auto» y se completa con la norma.' : 'Estación que eleva el caudal desde un pozo húmedo hasta el tanque de descarga. Deje vacío un campo «auto» y se completa con la norma.';
    m.innerHTML = '<div class="page-head"><div><h1>' + titulo + '</h1><p>' + desc + '</p></div><div class="chips" id="escenarios"></div></div>' +
      '<div class="status" id="status"></div><div class="mod-grid"><aside class="panel inputs" id="inputs" aria-label="Datos de entrada"></aside>' +
      '<section class="panel" aria-label="Resultados"><div class="tabs" role="tablist" id="tabs"></div><div class="tabpane" id="pane"></div></section></div>';
    renderScenarios(mod);
    renderInputs(mod);
    refresh(mod, true);
  }
  function renderScenarios(mod) {
    $('#escenarios').innerHTML = '<span>Cargar caso:</span>' + E.ESCENARIOS[mod].map(function (e) {
      return '<button class="chip" data-esc="' + e.id + '" title="' + esc(e.desc) + '" aria-pressed="' + (state.esc[mod] === e.id) + '">' + esc(e.nombre) + '</button>';
    }).join('');
  }

  function renderInputs(mod) {
    var vals = state.vals[mod], groups = [], map = {};
    E.FIELDS[mod].forEach(function (fd) {
      if (fd.when && !fd.when(vals)) return;
      if (!map[fd.group]) { map[fd.group] = []; groups.push(fd.group); }
      map[fd.group].push(fd);
    });
    var open = {};
    $$('#inputs details').forEach(function (d) { open[d.dataset.g] = d.open; });
    var html = '<h2>Datos de entrada <button class="btn sec" id="btnReset" style="min-height:28px;padding:3px 9px;font-size:.78rem">Restablecer</button></h2>';
    groups.forEach(function (g, i) {
      var isOpen = open[g] !== undefined ? open[g] : true;
      html += '<details data-g="' + esc(g) + '"' + (isOpen ? ' open' : '') + '><summary>' + esc(g) + '</summary><div class="fields">' + map[g].map(function (fd) { return fieldHtml(fd, vals); }).join('') + '</div></details>';
    });
    $('#inputs').innerHTML = html;
  }
  function fieldHtml(fd, vals) {
    var id = 'f_' + fd.k, val = vals[fd.k];
    var ctrl;
    if (fd.type === 'sel') {
      ctrl = '<div class="ctrl"><select id="' + id + '" data-k="' + fd.k + '">' + fd.options.map(function (o) { return '<option value="' + o.v + '"' + (o.v === val ? ' selected' : '') + '>' + esc(o.t) + '</option>'; }).join('') + '</select></div>';
    } else if (fd.type === 'curve') {
      var rows = E.parseCurva(val);
      var filas = String(val).trim().split(/\n+/).map(function (l) { return l.split(/[;\t]|,\s+|\s+/); });
      ctrl = '<table class="curve-table" id="curveT"><thead><tr><th>Q (L/s)</th><th>H (m)</th><th>η (%)</th><th>NPSHr (m)</th><th></th></tr></thead><tbody>' +
        filas.map(function (r, i) {
          return '<tr>' + [0, 1, 2, 3].map(function (j) { return '<td><input inputmode="decimal" aria-label="Fila ' + (i + 1) + ' columna ' + (j + 1) + '" data-cv="' + i + ',' + j + '" value="' + esc(r[j] === undefined ? '' : r[j]) + '"></td>'; }).join('') +
            '<td><button class="icon-btn" title="Quitar fila" aria-label="Quitar fila ' + (i + 1) + '" data-delrow="' + i + '">×</button></td></tr>';
        }).join('') + '</tbody></table><button class="btn sec" id="addRow" style="min-height:28px;padding:2px 9px;font-size:.78rem;margin-top:5px">Agregar punto</button>';
      void rows;
    } else if (fd.type === 'acc') {
      var have = {};
      String(val || '').split(/[;\n]+/).forEach(function (p) { var m = p.trim().match(/^([a-z0-9_]+)\s*=\s*([^@]+?)\s*(?:@\s*(.+))?$/i); if (m) have[m[1]] = { n: m[2], K: m[3] }; });
      var lista = E.ACC.filter(function (a) { return a.en === 'ambos' || a.en === fd.en; });
      ctrl = '<table class="curve-table acc-table" data-acck="' + fd.k + '"><thead><tr><th>Accesorio</th><th>Cant.</th><th>K</th></tr></thead><tbody>' +
        lista.map(function (a) {
          var h = have[a.id] || {};
          return '<tr><td style="text-align:left;font-size:.78rem;padding-left:4px">' + esc(a.t) + '</td>' +
            '<td><input inputmode="numeric" aria-label="Cantidad de ' + esc(a.t) + '" data-acc="' + fd.k + '" data-aid="' + a.id + '" data-col="n" value="' + esc(h.n === undefined ? '0' : h.n) + '"></td>' +
            '<td><input inputmode="decimal" aria-label="K de ' + esc(a.t) + '" data-acc="' + fd.k + '" data-aid="' + a.id + '" data-col="K" value="' + esc(h.K === undefined ? String(a.K).replace('.', ',') : h.K) + '"></td></tr>';
        }).join('') + '</tbody></table>';
    } else if (fd.type === 'text') {
      ctrl = '<div class="ctrl"><input id="' + id + '" data-k="' + fd.k + '" value="' + esc(val === undefined ? '' : val) + '"><span class="unit">' + esc(fd.unit) + '</span></div>';
    } else {
      ctrl = '<div class="ctrl"><input id="' + id + '" data-k="' + fd.k + '" inputmode="decimal" value="' + esc(val === undefined || val === null ? '' : val) + '" autocomplete="off"><span class="unit">' + (esc(fd.unit) || '&nbsp;') + '</span></div>';
    }
    return '<div class="field" id="wrap_' + fd.k + '"><label for="' + id + '">' + esc(fd.label) + (fd.type === 'curve' ? ' <small>(' + esc(fd.unit) + ')</small>' : '') + (fd.auto ? ' <span class="autotag" title="Si lo deja vacío, se completa con la norma o un valor genérico">auto</span>' : '') + '</label>' + ctrl + '<div class="err" hidden></div><div class="autonote" hidden></div>' + (fd.hint ? '<div class="hint">' + esc(fd.hint) + '</div>' : '') + '</div>';
  }
  function accDesdeTabla(k) {
    var items = {};
    $$('input[data-acc="' + k + '"]').forEach(function (i) { (items[i.dataset.aid] = items[i.dataset.aid] || {})[i.dataset.col] = i.value.trim(); });
    return Object.keys(items).filter(function (id) { return items[id].n !== '' && items[id].n !== '0'; }).map(function (id) {
      var a = E.ACC.filter(function (x) { return x.id === id; })[0], K = items[id].K;
      var Kn = E.parseNum(K);
      return id + '=' + items[id].n + (K !== '' && !(Kn === a.K) ? '@' + K.replace(',', '.') : '');
    }).join('; ');
  }
  function updateFieldStates(mod, res) {
    E.FIELDS[mod].forEach(function (fd) {
      var w = $('#wrap_' + fd.k); if (!w) return;
      var err = $('.err', w), bad = res.val.invalid[fd.k], miss = res.val.missing[fd.k];
      w.classList.toggle('bad', !!bad); w.classList.toggle('miss', !!miss);
      err.hidden = !(bad || miss);
      err.textContent = bad ? 'Este valor ' + bad.why + '.' : (miss ? 'Falta este dato.' : '');
      var input = $('#f_' + fd.k); if (input) input.setAttribute('aria-invalid', bad || miss ? 'true' : 'false');
      var au = res.val.auto[fd.k], note = $('.autonote', w);
      w.classList.toggle('isauto', !!au);
      if (note) {
        note.hidden = !au;
        note.innerHTML = au ? '<b>Autocompletado: ' + esc(f(au.v, fd.unit === 'mm' ? 0 : (Math.abs(au.v) < 0.1 ? 4 : 2))) + ' ' + esc(fd.unit || '') + '</b> · ' + esc(au.how) + ' <button class="linkish" data-fix="' + fd.k + '">Escribir este valor</button>' : '';
      }
      if (input && input.tagName === 'INPUT') input.placeholder = au ? f(au.v, fd.unit === 'mm' ? 0 : (Math.abs(au.v) < 0.1 ? 4 : 2)) + ' (auto)' : '';
    });
  }
  function refresh(mod, full) {
    var res = compute(mod);
    renderStatus(mod, res);
    updateFieldStates(mod, res);
    renderTabs(mod, res);
    renderTab(mod, res);
    renderNav();
    store('vals', state.vals);
  }
  var debounce;
  function schedule(mod) { clearTimeout(debounce); debounce = setTimeout(function () { refresh(mod); }, 140); }

  function renderStatus(mod, res) {
    var s = E.summarize(res), g = globalStatus(res);
    $('#status').innerHTML = '<div class="lead"><span class="st-icon b-' + g.k + '">' + g.icon + '</span><div><b>' + esc(g.t) + '</b><small>' + esc(g.d) + '</small></div></div>' +
      [['ok', s.ok, 'Cumplen'], ['fail', s.fail, 'Incumplen norma'], ['warn', s.warn, 'Recomendaciones'], ['pend', s.bloq + s.datos, 'Datos y pasos pendientes']].map(function (x) {
        return '<div><span class="n s-' + x[0] + '">' + x[1] + '</span><label>' + x[2] + '</label></div>';
      }).join('');
  }
  function renderTabs(mod, res) {
    var s = E.summarize(res), act = state.tab[mod];
    $('#tabs').innerHTML = TABS.map(function (t) {
      var cnt = '';
      if (t.id === 'verif' && s.fail + s.warn) cnt = '<span class="count ' + (s.fail ? 'b-fail' : 'b-warn') + '">' + (s.fail + s.warn) + '</span>';
      if (t.id === 'cadena' && s.bloq) cnt = '<span class="count b-pend">' + s.bloq + '</span>';
      return '<button role="tab" data-tab="' + t.id + '" aria-selected="' + (act === t.id) + '">' + (mod === 'bomba' && t.tb ? t.tb : t.t) + cnt + '</button>';
    }).join('');
  }
  function renderTab(mod, res) {
    var p = $('#pane'), t = state.tab[mod];
    if (!p) return;
    if (t !== 'v3d') stop3d(mod);
    if (t === 'resumen') { p.innerHTML = resumenHtml(mod, res); return; }
    if (t === 'esquema') return renderEsquema(p, mod, res);
    if (t === 'detalles') return renderDetalles(p, mod, res);
    if (t === 'v3d') return render3d(p, mod, res);
    if (t === 'graficas') return renderGraficas(p, mod, res);
    if (t === 'cadena') { p.innerHTML = cadenaHtml(mod, res); return; }
    if (t === 'verif') { p.innerHTML = verifHtml(mod, res); return; }
    p.innerHTML = memoriaHtml(mod, res);
  }
  function blockedMsg(res, what) {
    var pend = res.order.filter(function (n) { return n.status !== 'ok'; });
    var reasons = [];
    pend.forEach(function (n) { n.why.forEach(function (w) { if (w.tipo !== 'cadena' && reasons.indexOf(w.text) < 0) reasons.push(w.text); }); });
    return '<div class="notice"><b>No se puede mostrar ' + what + ' todavía.</b><ul style="margin:6px 0 0;padding-left:18px">' + reasons.slice(0, 6).map(function (r) { return '<li>' + esc(r) + '</li>'; }).join('') + '</ul></div>';
  }

  /* ---------- Problemas: qué falta y por qué ---------- */
  function issuesHtml(mod, res) {
    var items = [];
    res.dataIssues.forEach(function (d) {
      items.push({
        cls: d.tipo, h: d.label + (d.tipo === 'falta' ? ': falta el dato' : ': valor inválido'),
        d: d.msg + (d.bloquea.length ? ' Por eso no se calcula: ' + d.bloquea.join(', ') + '.' : ''),
        fix: d.sug, src: d.fuente, k: d.k
      });
    });
    res.order.filter(function (n) { return n.status === 'error'; }).forEach(function (n) {
      items.push({ cls: 'error', h: n.title + ': no se pudo calcular', d: n.why[0].text, fix: n.sug, src: n.src, k: n.inputs[0] });
    });
    res.checks.filter(function (c) { return c.estado === 'fail'; }).concat(res.checks.filter(function (c) { return c.estado === 'warn'; })).forEach(function (c) {
      items.push({ cls: c.estado, h: c.ch.param, d: 'Valor: ' + c.value + '. Límite: ' + c.limit + '.', fix: c.sug, src: c.ch.fuente, est: c.estado, k: CAMPO[c.ch.id] });
    });
    if (!items.length) return '<div class="allgood">✓ No hay datos faltantes ni incumplimientos. Todas las verificaciones evaluadas cumplen.</div>';
    return '<div class="issues">' + items.map(function (i) {
      return '<div class="issue ' + i.cls + '"><div class="h">' + esc(i.h) + '</div><div>' + (i.est ? badge(i.est) : '<span class="badge ' + (i.cls === 'falta' ? 'b-warn' : 'b-fail') + '">' + (i.cls === 'falta' ? 'Falta' : 'Error') + '</span>') + '</div>' +
        '<div class="d">' + esc(i.d) + '</div>' + (i.fix ? '<div class="fix"><b>Cómo corregir:</b> ' + esc(i.fix) + (i.k ? ' <button class="linkish" data-goto="' + i.k + '">Ir al dato</button>' : '') + '</div>' : '') +
        '<div class="src">Fuente: ' + esc(i.src) + '</div></div>';
    }).join('') + '</div>';
  }
  function autosHtml(res) {
    if (!res.autos || !res.autos.length) return '';
    return '<div class="sec-title"><h2>Datos completados automáticamente</h2><small>' + res.autos.length + ' campo(s) vacío(s). Escriba el dato real para reemplazarlo.</small></div><div class="tw"><table class="t"><thead><tr><th>Dato</th><th class="r">Valor usado</th><th>Procedimiento</th><th>Fuente</th><th></th></tr></thead><tbody>' +
      res.autos.map(function (a) {
        return '<tr><td>' + esc(a.label) + '</td><td class="num r">' + esc(f(a.v, a.unit === 'mm' ? 0 : (Math.abs(a.v) < 0.1 ? 4 : 2))) + ' ' + esc(a.unit || '') + '</td><td style="min-width:260px">' + esc(a.how) + '</td><td style="font-size:.78rem;color:var(--ink-2);min-width:170px">' + esc(a.src) + '</td><td><button class="linkish" data-goto="' + a.k + '">Ir al dato</button></td></tr>';
      }).join('') + '</tbody></table></div>';
  }
  function altHtml(res) {
    var c = res.ctx, v = res.v;
    if (!c.alt) return '';
    var cur = c.altCur, ok = cur && cur.optima;
    var h = '<div class="sec-title"><h2>¿Hacen falta más bombas?</h2><small>Bombas iguales en serie (suman altura) o en paralelo (suman caudal)</small></div>';
    h += '<div class="' + (ok ? 'allgood' : 'notice') + '" style="margin-bottom:8px">' + (ok ? '✓ ' : '') + esc(c.altTxt) + '</div>';
    h += '<div class="tw"><table class="t"><thead><tr><th>Arreglo</th><th class="r">En operación</th><th class="r">Q (L/s)</th><th class="r">H (m)</th><th class="r">η (%)</th><th class="r">Q/Qd</th><th>Resultado</th><th></th></tr></thead><tbody>' +
      c.alt.slice(0, 8).map(function (o, i) {
        var est = !o.op ? 'fail' : (o.optima ? 'ok' : (o.apta ? 'warn' : 'fail'));
        return '<tr' + (o.actual ? ' style="background:var(--accent-soft)"' : '') + '><td>' + esc(E.arregloTxt(o.nP, o.nS)) + (o.actual ? ' <b>(actual)</b>' : '') + (i === 0 && !ok ? ' <b>(recomendado)</b>' : '') + '</td><td class="num r">' + o.total + '</td><td class="num r">' + (o.op ? f(o.op.Qt, 1) : '—') + '</td><td class="num r">' + (o.op ? f(o.op.H) : '—') + '</td><td class="num r">' + (o.op ? f(o.eta, 1) : '—') + '</td><td class="num r">' + (o.op ? f(o.op.Qt / v.Qd * 100, 0) + ' %' : '—') + '</td><td>' + badge(est).replace(/Cumple|No cumple|Recomendación/, est === 'ok' ? 'Óptimo' : (est === 'warn' ? 'Sirve' : 'No sirve')) + ' <small>' + esc(o.nota) + '</small></td><td>' + (o.actual || !o.op ? '' : '<button class="btn sec" style="min-height:26px;padding:2px 8px;font-size:.76rem" data-apply="' + o.nP + ',' + o.nS + '">Usar</button>') + '</td></tr>';
      }).join('') + '</tbody></table></div>';
    return h;
  }
  function kpi(l, val, u, sub) { return '<div class="kpi"><label>' + esc(l) + '</label><b>' + val + (u ? '<small>' + esc(u) + '</small>' : '') + '</b>' + (sub ? '<span>' + esc(sub) + '</span>' : '') + '</div>'; }

  function resumenHtml(mod, res) {
    var c = res.ctx, h = '';
    var head = '<div class="sec-title"><h2>Qué falta o qué corregir</h2><small>Parámetro, límite, fuente y corrección</small></div>' + issuesHtml(mod, res) + autosHtml(res);
    if (mod === 'sifon') {
      if (!c.casos || !c.casos[0].NAe) return head;
      var q = c.casos[2];
      h += '<div class="kpis">' + kpi('Conductos', c.bs.length, 'und', c.bs.map(function (b) { return 'Ø' + f(b.D, 0); }).join(' + ') + ' mm') +
        kpi('Velocidades a Qmax', q.barrels.map(function (b) { return f(b.V); }).join(' / '), 'm/s', 'Mínimo ' + f(c.lim.Vmin, 1) + ' m/s') +
        kpi('Pérdida total a Qmax', f(q.hL, 3), 'm', 'Disponible ' + f(q.disp, 3) + ' m') +
        kpi('Nivel cámara de entrada', f(q.NAe, 3), 'm', 'A Qmax') + kpi('Nivel cámara de salida', f(q.NAs, 3), 'm', 'A Qmax') +
        kpi('Longitud del conducto', f(c.g.L), 'm', 'θ ' + f(c.g.thB, 1) + '° y ' + f(c.g.thS, 1) + '°') + '</div>';
      h += head;
      h += '<div class="sec-title"><h2>Resultados por caudal</h2><small>Método ' + (res.v.metodo === 'RAS' ? 'RAS Título D' : 'HEC-22') + '</small></div><div class="tw"><table class="t"><thead><tr><th>Caudal</th><th>Conducto</th><th class="r">Q (L/s)</th><th class="r">V (m/s)</th><th class="r">he (m)</th><th class="r">hc (m)</th><th class="r">hf (m)</th><th class="r">hs (m)</th><th class="r">H (m)</th><th class="r">τ (Pa)</th></tr></thead><tbody>';
      c.casos.forEach(function (o) {
        o.barrels.forEach(function (b, j) {
          h += '<tr><td>' + (j === 0 ? '<b>' + o.key + '</b> ' + f(o.Q * 1000, 1) + ' L/s' : '') + '</td><td>' + (j + 1) + ' (Ø' + f(o.act[j].D, 0) + ')</td>' + [f(b.Q * 1000, 1), f(b.V), f(b.he, 3), f(b.hc, 3), f(b.hf, 3), f(b.hs, 3), f(b.hL, 3), f(b.tau)].map(function (x) { return '<td class="num r">' + x + '</td>'; }).join('') + '</tr>';
        });
      });
      h += '</tbody></table></div>';
      h += '<div class="sec-title"><h2>Niveles en cámaras y línea de energía</h2></div><div class="tw"><table class="t"><thead><tr><th>Caudal</th><th class="r">NA entrada (m)</th><th class="r">NA salida (m)</th><th class="r">E disponible (m)</th><th class="r">E requerida (m)</th><th class="r">Margen (m)</th><th class="r">H otro método (m)</th></tr></thead><tbody>' +
        c.casos.map(function (o) { return '<tr><td><b>' + o.key + '</b></td>' + [f(o.NAe, 3), f(o.NAs, 3), f(o.Ee_disp, 3), f(o.Ee_req, 3), f(o.margen, 3), f(o.hLalt, 3)].map(function (x) { return '<td class="num r">' + x + '</td>'; }).join('') + '</tr>'; }).join('') + '</tbody></table></div>';
      if (c.crestas && c.crestas.length) {
        h += '<div class="sec-title"><h2>Vertederos de regulación</h2><small>Res. 0330/2017 Art. 158 num. 5</small></div><div class="tw"><table class="t"><thead><tr><th>Conducto</th><th class="r">Cresta (m)</th><th class="r">Q que entra (L/s)</th><th class="r">Carga (m)</th><th class="r">Longitud (m)</th></tr></thead><tbody>' +
          c.crestas.map(function (x) { return '<tr><td>' + x.id + '</td><td class="num r">' + f(x.cresta, 3) + '</td><td class="num r">' + f(x.Q * 1000, 1) + '</td><td class="num r">' + f(x.h, 3) + '</td><td class="num r">' + (x.b ? f(x.b) : 'Sin carga') + '</td></tr>'; }).join('') + '</tbody></table></div>';
      }
      if (c.alternativas && c.alternativas.length > 1) {
        h += '<div class="sec-title"><h2>Alternativas evaluadas</h2><small>La primera es la escogida</small></div><div class="tw"><table class="t"><thead><tr><th>Combinación (mm)</th><th class="r">V menor (m/s)</th><th class="r">H máx (m)</th><th>Resultado</th></tr></thead><tbody>' +
          c.alternativas.map(function (a) { return '<tr><td class="num">' + a.ds.join(' + ') + '</td><td class="num r">' + f(a.vmin) + '</td><td class="num r">' + f(a.hmax, 3) + '</td><td>' + (a.viol === 0 ? badge('ok') : badge('fail')) + '</td></tr>'; }).join('') + '</tbody></table></div>';
      }
      return h;
    }
    var altB = altHtml(res);
    if (!c.op || !c.pot || !c.npsh || !c.ar || !c.pozo) return head + altB;
    h += '<div class="kpis">' + kpi('Punto de operación', f(c.op.Qt, 1), 'L/s', 'H = ' + f(c.op.H) + ' m · Qd = ' + f(res.v.Qd, 1) + ' L/s') +
      kpi('Potencia por bomba', f(c.pot.Pe), 'kW', 'Eléctrica ' + f(c.pot.Pm) + ' kW') +
      kpi('Eficiencia', f(c.pot.eta, 1), '%', 'Conjunto ' + f(c.pot.etaConj, 1) + ' %') +
      kpi('NPSH disponible', f(c.npsh.a), 'm', 'Requerido ' + f(c.npsh.r) + ' m') +
      kpi('Velocidades', f(c.vel.s) + ' / ' + f(c.vel.i), 'm/s', 'Succión / impulsión') +
      kpi('Sumergencia', f(c.sum.S), 'm', '2,5·Ds = ' + f(c.sum.req25) + ' m') +
      kpi('Golpe de ariete', f(c.ar.dH), 'm', (c.ar.rapido ? 'Joukowsky' : 'Michaud') + ' · a = ' + f(c.ar.a, 0) + ' m/s') +
      kpi('Volumen útil', f(c.pozo.Vol, 1), 'm³', 'Mínimo ' + f(c.pozo.Vreq, 1) + ' m³') + '</div>';
    h += head + altB;
    h += '<div class="sec-title"><h2>Altura dinámica total</h2><small>TDH = Hs + Hf + Hv + Hl (HEC-22 Ec. 12.1)</small></div><div class="tw"><table class="t"><thead><tr><th>Condición</th><th class="r">Q (L/s)</th><th class="r">Hs (m)</th><th class="r">Hf (m)</th><th class="r">Hv (m)</th><th class="r">Hl (m)</th><th class="r">TDH (m)</th></tr></thead><tbody>';
    var rowOf = function (name, Q, Hs) { var s = E.alturaSistema(Q / 1000, Hs, res.v, c); return '<tr><td>' + name + '</td>' + [f(Q, 1), f(s.Hs), f(s.Hf, 3), f(s.Hv, 3), f(s.Hl, 3), f(s.H)].map(function (x) { return '<td class="num r">' + x + '</td>'; }).join('') + '</tr>'; };
    h += rowOf('Caudal de diseño, nivel mínimo', res.v.Qd, c.HsMax) + rowOf('Operación, nivel mínimo', c.op.Qt, c.HsMax);
    if (c.opLow) h += rowOf('Operación, nivel máximo', c.opLow.Qt, c.HsMin);
    h += '</tbody></table></div>';
    h += '<div class="sec-title"><h2>Golpe de ariete y presiones</h2></div><div class="tw"><table class="t"><tbody>' + [
      ['Celeridad de la onda a', f(c.ar.a, 1) + ' m/s'], ['Tiempo crítico 2L/a', f(c.ar.Tcrit) + ' s'], ['Sobrepresión Joukowsky a·V/g', f(c.ar.jouk) + ' m'], ['Sobrepresión con cierre lento 2LV/gT', f(c.ar.mich) + ' m'], ['Presión máxima H + ΔH', f(c.ar.Hmax) + ' m.c.a.'], ['Presión mínima Hs − ΔH', f(c.ar.Hmin) + ' m.c.a.']
    ].map(function (r) { return '<tr><td>' + r[0] + '</td><td class="num r">' + r[1] + '</td></tr>'; }).join('') + '</tbody></table></div>';
    return h;
  }

  /* ---------- Perfil ---------- */
  function casoChips() {
    return '<div class="chips" role="group" aria-label="Caudal"><span>Caudal:</span>' + ['Qmin', 'Qmed', 'Qmax'].map(function (k, i) { return '<button class="chip" data-caso="' + i + '" aria-pressed="' + (state.caso === i) + '">' + k + '</button>'; }).join('') + '</div>';
  }
  function renderEsquema(p, mod, res) {
    var ok = mod === 'sifon' ? (res.ctx.perfil) : (res.ctx.op && res.ctx.ar && res.ctx.npsh && res.ctx.sum);
    if (!ok || !res.complete) { p.innerHTML = blockedMsg(res, 'el perfil'); return; }
    p.innerHTML = '<div class="scheme-bar"><div><h2>' + (mod === 'sifon' ? 'Perfil y cotas del sifón' : 'Esquema de la estación de bombeo') + '</h2><div class="scale-note">Se redibuja con los valores calculados. El flujo se mueve según la velocidad real.</div></div>' + (mod === 'sifon' ? casoChips() : '') + '</div><div class="scheme" id="schemeHost"></div>';
    var host = $('#schemeHost');
    if (mod === 'sifon') S.sifon(host, res, state.caso); else S.bomba(host, res);
  }

  /* ---------- Planta y detalles ---------- */
  function tablaSimple(head, rows, numCols) {
    numCols = numCols || [];
    return '<div class="tw"><table class="t"><thead><tr>' + head.map(function (x, i) { return '<th' + (numCols.indexOf(i) >= 0 ? ' class="r"' : '') + '>' + (String(x).charAt(0) === '<' ? x : esc(x)) + '</th>'; }).join('') + '</tr></thead><tbody>' +
      rows.map(function (r) { return '<tr>' + r.map(function (x, i) { return '<td' + (numCols.indexOf(i) >= 0 ? ' class="num r"' : '') + '>' + x + '</td>'; }).join('') + '</tr>'; }).join('') + '</tbody></table></div>';
  }
  var nf = function (x, d) { return typeof x === 'number' ? f(x, d === undefined ? 2 : d) : esc(x); };
  function renderDetalles(p, mod, res) {
    var c = res.ctx, v = res.v, h = '';
    if (mod === 'sifon') {
      var T = E.sifonTablas(res);
      if (!T || !res.complete) { p.innerHTML = blockedMsg(res, 'la planta y los detalles'); return; }
      h += '<div class="scheme-bar"><div><h2>Vista en planta</h2><div class="scale-note">Conductos en paralelo, cámaras con sus compartimientos y el obstáculo que se cruza.</div></div>' + casoChips() + '</div><div class="scheme" id="hPlanta"></div>';
      h += '<div class="sec-title"><h2>Tuberías del sifón</h2><small>Diámetros y parámetros de cada conducto</small></div><div class="scheme" id="hSeccion"></div>';
      h += tablaSimple(['Conducto', 'D interno (mm)', 'Material', 'Área (m²)', 'L real (m)', 'Q Qmin/Qmed/Qmax (L/s)', 'V Qmin/Qmed/Qmax (m/s)', 'Tope de caudal', 'Batea entrada / salida (m)', 'Clave punto bajo (m)', 'Función'],
        T.tubos.map(function (t) { return [String(t.id), f(t.D, 0), esc(t.mat), f(t.A, 4), f(t.L), t.Qs.map(function (q) { return f(q, 1); }).join(' / '), t.Vs.map(function (x) { return x ? f(x) : '—'; }).join(' / '), t.tope === null ? '—' : (isFinite(t.tope) ? f(t.tope * 1000, 1) + ' L/s' : 'El resto'), f(t.bE) + ' / ' + f(t.bS), f(t.clave), esc(t.fn)]; }), [1, 3, 4]);
      h += '<div class="sec-title"><h2>Cámara de entrada: separadores y vertederos</h2></div><div class="scheme" id="hCamara"></div>';
      h += '<div class="sec-title"><h2>Descripción de las estructuras</h2><small>Cambie los tipos en "Obstáculo" y "Cámaras y separadores"</small></div>' + tablaSimple(['Elemento', 'Tipo', 'Descripción'], T.desc.map(function (r) { return ['<b>' + esc(r[0]) + '</b>', esc(r[1]), esc(r[2])]; }));
      h += '<div class="sec-title"><h2>Cotas de fondo, de las cámaras y del obstáculo</h2><small>De aguas arriba a aguas abajo</small></div>' + tablaSimple(['Elemento', 'Cota (m)', 'Origen'], T.cotas.map(function (r) { return [esc(r[0]), f(r[1], 3), esc(r[2])]; }), [1]);
      h += '<div class="sec-title"><h2>Pendientes de las tuberías</h2><small>θ ≤ 22,5° (Art. 158.4) y subida ≤ 15 % (HEC-22)</small></div>' + tablaSimple(['Tramo', 'Long. horizontal (m)', 'Desnivel (m)', 'Pendiente (%)', 'Ángulo (°)', 'Long. real (m)'], T.pend.map(function (r) { return [esc(r[0]), nf(r[1]), nf(r[2]), nf(r[3]), nf(r[4], 1), nf(r[5])]; }), [1, 2, 3, 4, 5]);
      p.innerHTML = h;
      S.planta($('#hPlanta'), res, state.caso); S.seccion($('#hSeccion'), res, state.caso); S.camara($('#hCamara'), res, state.caso);
      return;
    }
    var B = E.bombaTablas(res);
    if (!B) { p.innerHTML = blockedMsg(res, 'las tuberías y accesorios'); return; }
    h += '<div class="scheme-bar"><div><h2>Accesorios de succión e impulsión</h2><div class="scale-note">En el orden del flujo, desde el pozo hasta el tanque de descarga. Cámbielos en la tabla de cada tubería.</div></div></div><div class="scheme" id="hAcc"></div>';
    h += tablaSimple(['Tubería', 'Accesorio', 'Cantidad', 'K', 'n·K', 'Pérdida (m)'], B.acc.map(function (r) { return ['<span style="color:var(' + (r[0] === 'Succión' ? '--s3' : '--s2') + ');font-weight:700">' + esc(r[0]) + '</span>', esc(r[1]), nf(r[2], 0), nf(r[3]), nf(r[4]), nf(r[5], 3)]; }), [2, 3, 4, 5]);
    h += '<div class="sec-title"><h2>Diferencias entre la tubería de succión y la de impulsión</h2><small>Con el punto de operación</small></div>' + tablaSimple(['Característica', '<span style="color:var(--s3)">Succión</span>', '<span style="color:var(--s2)">Impulsión</span>'], B.tub.map(function (r) { return ['<b>' + esc(r[0]) + '</b>', esc(r[1]), esc(r[2])]; }));
    h += '<div class="sec-title"><h2>Cotas de succión e impulsión</h2></div>' + tablaSimple(['Elemento', 'Cota (m)', 'Origen'], B.cotas.map(function (r) { return [esc(r[0]), f(r[1], 2), esc(r[2])]; }), [1]);
    h += '<div class="sec-title"><h2>Tanque de descarga y accesorios</h2></div>' + tablaSimple(['Elemento', 'Tipo', 'Descripción'], B.desc.map(function (r) { return ['<b>' + esc(r[0]) + '</b>', esc(r[1]), esc(r[2])]; }));
    p.innerHTML = h;
    S.lineaAcc($('#hAcc'), res);
  }

  /* ---------- 3D ---------- */
  function stop3d(mod) { if (state.viewers[mod]) state.viewers[mod].stop(); }
  function render3d(p, mod, res) {
    if (!res.complete) { p.innerHTML = blockedMsg(res, 'el modelo 3D'); return; }
    var keep = !!state.hosts[mod];
    if (!state.hosts[mod]) {
      var h = document.createElement('div'); h.className = 'view3d';
      state.hosts[mod] = h;
      state.viewers[mod] = new window.Scene3D.Viewer(h);
    }
    p.innerHTML = '<div class="scheme-bar"><div><h2>Modelo 3D ' + (mod === 'sifon' ? 'del sifón' : 'de la estación') + '</h2><div class="scale-note">Arrastre para girar · Rueda para acercar · Mayús + arrastre para desplazar</div></div>' + (mod === 'sifon' ? casoChips() : '') + '</div><div id="h3d"></div>' +
      '<div class="scale-note">Modelo paramétrico: horizontal comprimida y diámetros ampliados para que se aprecie el conjunto. Las medidas reales están en los rótulos.</div>';
    var host = state.hosts[mod];
    $('#h3d').appendChild(host);
    var v = state.viewers[mod];
    if (!v.ok) { host.innerHTML = '<div class="no3d">Este equipo no tiene WebGL activo, por eso no se puede mostrar el modelo 3D. El perfil, las gráficas y los cálculos funcionan normalmente.</div>'; return; }
    if (mod === 'sifon') v.buildSifon(res, state.caso, keep); else v.buildBomba(res, keep);
    if (!v.ok) { host.innerHTML = '<div class="no3d">No fue posible iniciar el modelo 3D en este equipo. El perfil, las gráficas y los cálculos funcionan normalmente.</div>'; return; }
    if (!$('.ctl3d', host)) {
      var d = document.createElement('div'); d.className = 'ctl3d';
      d.innerHTML = '<button class="btn sec" data-reset3d="' + mod + '">Vista inicial</button>';
      host.appendChild(d);
    }
    v.resize();
    v.start();
  }

  /* ---------- Gráficas ---------- */
  function drawCharts(mod, res, root, opts) {
    opts = opts || {};
    root.innerHTML = '';
    var add = function () { var d = document.createElement('div'); root.appendChild(d); return d; };
    var c = res.ctx, v = res.v;
    if (mod === 'sifon') {
      C.bars(add(), {
        title: 'Pérdidas de energía por caudal', sub: 'Conducto que gobierna en cada caudal, frente a la energía disponible', ylabel: 'Pérdida (m)', unit: 'm', stacked: true,
        cats: c.casos.map(function (o) { return o.key; }),
        series: [
          { name: 'Entrada', color: '--s1', vals: c.casos.map(function (o) { return o.barrels[o.gov].he; }) },
          { name: 'Fricción', color: '--s2', vals: c.casos.map(function (o) { return o.barrels[o.gov].hf; }) },
          { name: 'Codos', color: '--s3', vals: c.casos.map(function (o) { return o.barrels[o.gov].hc; }) },
          { name: 'Salida', color: '--s4', vals: c.casos.map(function (o) { return o.barrels[o.gov].hs; }) }
        ],
        refs: c.casos.map(function (o, i) { return { i: i, val: o.disp, label: 'Disponible ' + f(o.disp) }; })
      });
      var serieColor = ['--s1', '--s2', '--s3', '--s4'];
      C.bars(add(), {
        title: 'Velocidad en cada conducto', sub: 'Conductos en servicio por caudal frente a la velocidad mínima', ylabel: 'V (m/s)', unit: 'm/s',
        cats: c.casos.map(function (o) { return o.key; }),
        series: c.bs.map(function (b, i) { return { name: 'Conducto ' + b.id + ' Ø' + f(b.D, 0), color: serieColor[i], vals: c.casos.map(function (o) { return o.barrels[i] ? o.barrels[i].V : null; }) }; }),
        hlines: [{ y: c.lim.Vmin, color: '--bad', label: 'V mínima ' + f(c.lim.Vmin, 1) + ' m/s (Art. 158)' }]
      });
      var i = state.caso, pr = c.perfil.casos[i], est = c.perfil.est;
      C.xy(add(), {
        title: 'Líneas de energía y piezométrica, ' + pr.key, sub: 'A lo largo del sifón, sobre la batea del conducto', xlabel: 'Abscisa horizontal (m)', ylabel: 'Cota (m)', xunit: 'm', yunit: 'm', xdec: 1, ydec: 3,
        series: [
          { name: 'Línea de energía', color: '--s1', pts: est.map(function (e, j) { return [e.x, pr.egl[j]]; }) },
          { name: 'Línea piezométrica', color: '--s2', dash: true, pts: est.map(function (e, j) { return [e.x, pr.hgl[j]]; }) },
          { name: 'Batea del conducto', color: '--ink-3', pts: est.map(function (e) { return [e.x, e.z]; }) }
        ]
      });
      // Curva H(Q) con la puesta en servicio progresiva
      var pts = [], dis = [], Qs = [];
      var qM = c.Q[2] * 1.15;
      for (var k = 1; k <= 60; k++) Qs.push(qM * k / 60);
      Qs.forEach(function (q) {
        var eD = E.normalDepth(q, v.De / 1000, v.ne, v.Se / 100), sD = E.normalDepth(q, v.Ds / 1000, v.ns, v.Ss / 100);
        var base = { nu: c.w.nu, gamma: c.w.gamma, ks: v.ks, n: v.n, L: c.g.L, sumAlpha: c.g.sumAlpha, A3: E.areaC(v.Ds / 1000), Vd: sD.V };
        var r, extra = 0;
        if (c.topes) {
          r = E.asignar(c.bs, c.topes, q, base, v.metodo);
          if (r.length > 1) extra = v.hw;
        } else {
          var kk = q <= c.Q[0] ? 1 : (q <= c.Q[1] ? Math.min(c.casos[1].k, c.bs.length) : c.bs.length);
          r = E.repartir(c.bs.slice(0, kk), q, base, v.metodo);
        }
        pts.push([q * 1000, r[E.gobierna(r)].hL + extra]);
        dis.push([q * 1000, (v.Ze + eD.y + eD.V * eD.V / 19.62) - (v.Zs + sD.y + sD.V * sD.V / 19.62)]);
      });
      C.xy(add(), {
        title: 'Pérdida requerida y energía disponible', sub: 'Con la entrada progresiva de conductos. La disponible debe quedar por encima', xlabel: 'Caudal (L/s)', ylabel: 'Energía (m)', xunit: 'L/s', yunit: 'm', ydec: 3, ymin: 0,
        series: [{ name: 'Pérdida requerida', color: '--s2', pts: pts }, { name: 'Energía disponible', color: '--s1', dash: true, pts: dis }],
        marks: c.casos.map(function (o, j) { return { x: o.Q * 1000, y: o.hL + o.hw, label: o.key, color: '--s2', pulse: j === state.caso }; })
      });
      return;
    }
    var nSer0 = v.nSer || 1;
    if (c.alt && c.fit && c.sis) {
      var confs = [[1, 1], [2, 1], [1, 2]], bst = c.altBest, cols = ['--s1', '--s3', '--s5', '--s4'];
      if (bst && bst.op && !confs.some(function (q) { return q[0] === bst.nP && q[1] === bst.nS; })) confs.push([bst.nP, bst.nS]);
      if (!confs.some(function (q) { return q[0] === v.nAct && q[1] === nSer0; })) confs.push([v.nAct, nSer0]);
      var qR = Math.max.apply(null, confs.map(function (q) { return q[0]; })) * c.qMaxCurva * 1.05;
      var sys = [], ser = [], mk = [], yMx = 0;
      for (var a = 0; a <= 60; a++) { var qa = qR * a / 60; sys.push([qa, E.alturaSistema(qa / 1000, c.HsMax, v, c).H]); }
      confs.slice(0, 5).forEach(function (q, i) {
        var pts = [];
        for (var b = 0; b <= 60; b++) { var qq = q[0] * c.qMaxCurva * 1.05 * b / 60, qp = qq / q[0], h1 = c.fit.A * qp * qp + c.fit.B * qp + c.fit.C; if (h1 > 0) pts.push([qq, h1 * q[1]]); }
        pts.forEach(function (p) { yMx = Math.max(yMx, p[1]); });
        var o = c.alt.filter(function (x) { return x.nP === q[0] && x.nS === q[1]; })[0];
        ser.push({ name: E.arregloTxt(q[0], q[1]).replace(/^una sola bomba$/, '1 bomba'), color: cols[i % 4], dash: i > 3, pts: pts });
        if (o && o.op) mk.push({ x: o.op.Qt, y: o.op.H, label: q[0] + '×' + q[1], color: cols[i % 4], pulse: q[0] === v.nAct && q[1] === nSer0 });
      });
      ser.push({ name: 'Sistema, nivel mínimo', color: '--s2', pts: sys.filter(function (p) { return p[1] <= yMx * 1.1; }) });
      C.xy(add(), {
        title: 'Bombas en serie o en paralelo', sub: 'En paralelo la curva se estira en caudal; en serie, en altura. ' + c.altTxt, xlabel: 'Caudal total (L/s)', ylabel: 'Altura (m)', xunit: 'L/s', yunit: 'm', ymin: 0, xmin: 0, ymax: yMx * 1.1,
        series: ser, marks: mk, vlines: [{ x: v.Qd, color: '--ink-3', label: 'Qd = ' + f(v.Qd, 1) + ' L/s' }]
      });
    }
    if (!c.op || !c.pot || !c.npsh || !c.ar || !c.sum) return;
    var Qmax = c.qMaxCurva * v.nAct * 1.1, nPts = 50, sysMin = [], sysMax = [], pump = [], etaC = [], powC = [], npa = [], npr = [];
    for (var j = 0; j <= nPts; j++) {
      var Q = Qmax * j / nPts, Qp = Q / v.nAct;
      sysMin.push([Q, E.alturaSistema(Q / 1000, c.HsMax, v, c).H]);
      sysMax.push([Q, E.alturaSistema(Q / 1000, c.HsMin, v, c).H]);
      var H1 = c.fit.A * Qp * Qp + c.fit.B * Qp + c.fit.C, H = H1 * (v.nSer || 1);
      if (H1 > 0 && Qp <= c.qMaxCurva * 1.1) pump.push([Q, H]);
      var et = E.interpCol(c.curva, 'eta', Qp);
      if (Qp <= c.qMaxCurva) {
        etaC.push([Qp, et]);
        if (et > 0.5) powC.push([Qp, c.w.gamma * (Qp / 1000) * Math.max(H1, 0) / (et / 100) / 1000]);
        var s = E.alturaSistema(Q / 1000, c.HsMax, v, c).s;
        npa.push([Qp, c.npsh.patm + c.npsh.Hes - (s.hf + s.hm) - c.npsh.pv]);
        npr.push([Qp, E.interpCol(c.curva, 'npshr', Qp)]);
      }
    }
    var nS = v.nSer || 1, yTop = Math.max(c.fit.C * nS, c.op.H) * 1.3;
    C.xy(add(), {
      title: 'Curva de altura H-Q y punto de operación', sub: E.arregloTxt(v.nAct, nS) + ' sobre la curva del sistema. Qd = ' + f(v.Qd, 1) + ' L/s', xlabel: 'Caudal total (L/s)', ylabel: 'Altura (m)', xunit: 'L/s', yunit: 'm', ymin: 0, ymax: yTop, xmin: 0,
      series: [
        { name: 'Curva de la bomba' + (v.nAct * nS > 1 ? ' (arreglo)' : ''), color: '--s1', pts: pump },
        { name: 'Sistema, nivel mínimo', color: '--s2', pts: sysMin.filter(function (p) { return p[1] <= yTop; }) },
        { name: 'Sistema, nivel máximo', color: '--s2', dash: true, pts: sysMax.filter(function (p) { return p[1] <= yTop; }) },
        { name: 'Datos del catálogo', color: '--s3', pointsOnly: true, pts: c.curva.map(function (p) { return [p.Q * v.nAct, p.H * nS]; }) }
      ],
      marks: [{ x: c.op.Qt, y: c.op.H, label: 'Q = ' + f(c.op.Qt, 1) + ' L/s, H = ' + f(c.op.H) + ' m', color: '--ink', pulse: true }],
      hlines: [{ y: c.HsMax, color: '--ink-3', label: 'Hs = ' + f(c.HsMax) + ' m' }]
    });
    C.xy(add(), {
      title: 'Curva de eficiencia η-Q', sub: 'Interpolada en la curva suministrada, por bomba', xlabel: 'Caudal por bomba (L/s)', ylabel: 'η (%)', xunit: 'L/s', yunit: '%', ymin: 0, xmin: 0, ydec: 1,
      series: [{ name: 'Eficiencia', color: '--s1', pts: etaC }],
      marks: [{ x: c.op.Qp, y: c.pot.eta, label: 'η = ' + f(c.pot.eta, 1) + ' %', color: '--ink', pulse: true }]
    });
    C.xy(add(), {
      title: 'Potencia al eje por bomba', sub: 'P = γQH/η', xlabel: 'Caudal por bomba (L/s)', ylabel: 'Potencia (kW)', xunit: 'L/s', yunit: 'kW', ymin: 0, xmin: 0,
      series: [{ name: 'Potencia', color: '--s2', pts: powC }],
      marks: [{ x: c.op.Qp, y: c.pot.Pe, label: 'P = ' + f(c.pot.Pe) + ' kW', color: '--ink', pulse: true }]
    });
    C.xy(add(), {
      title: 'Curva de NPSH disponible y requerido', sub: 'El disponible debe superar al requerido en al menos 0,5 m (Art. 161)', xlabel: 'Caudal por bomba (L/s)', ylabel: 'NPSH (m)', xunit: 'L/s', yunit: 'm', ymin: 0, xmin: 0,
      series: [{ name: 'NPSH disponible', color: '--s1', pts: npa }, { name: 'NPSH requerido', color: '--s2', pts: npr }],
      marks: [{ x: c.op.Qp, y: c.npsh.a, label: 'NPSHd = ' + f(c.npsh.a) + ' m', color: '--s1', pulse: true }, { x: c.op.Qp, y: c.npsh.r, label: 'NPSHr = ' + f(c.npsh.r) + ' m', color: '--s2' }]
    });
    var alc = v.sistema === 'alcantarillado', vsMaxB = [[50, 0.75], [75, 1], [100, 1.3], [150, 1.45], [200, 1.6], [250, 1.6], [300, 1.7], [400, 1.8]].reduce(function (r, t) { return v.Dsu >= t[0] ? t[1] : r; }, 0.75);
    C.ranges(add(), {
      title: 'Velocidades y sumergencia frente a la norma', sub: alc ? 'Res. 0330/2017 Art. 161' : 'RAS Título B, capítulo 8',
      items: [
        { label: 'Velocidad en succión', value: c.vel.s, lo: alc ? 0.9 : 0.45, hi: alc ? 1.5 : vsMaxB, max: 2.5, unit: 'm/s' },
        { label: 'Velocidad en impulsión', value: c.vel.i, lo: alc ? 1.5 : 1.0, hi: alc ? 2.4 : 6, max: alc ? 3.5 : 7, unit: 'm/s' },
        { label: 'Sumergencia', value: c.sum.S, lo: alc ? c.sum.req25 : Math.max(c.sum.req2, 0.5), hi: null, max: Math.max(c.sum.S, c.sum.req25) * 1.5, unit: 'm' }
      ]
    });
    var steady = [[0, v.Znmin + c.op.H], [v.Lim, v.Zdis]];
    C.xy(add(), {
      title: 'Envolvente de golpe de ariete', sub: 'Aproximación lineal de la presión a lo largo de la impulsión', xlabel: 'Distancia desde la bomba (m)', ylabel: 'Cota piezométrica (m)', xunit: 'm', yunit: 'm', xmin: 0,
      series: [
        { name: 'Máxima (H + ΔH)', color: '--s2', pts: [[0, v.Znmin + c.ar.Hmax], [v.Lim, v.Zdis]] },
        { name: 'Régimen permanente', color: '--s1', pts: steady },
        { name: 'Mínima (Hs − ΔH)', color: '--s3', dash: true, pts: [[0, v.Znmin + c.ar.Hmin], [v.Lim, v.Zdis]] }
      ]
    });
  }
  function renderGraficas(p, mod, res) {
    var ok = mod === 'sifon' ? (res.ctx.perfil && res.complete) : (res.ctx.alt && res.ctx.fit && res.ctx.sis);
    if (!ok) { p.innerHTML = blockedMsg(res, 'las gráficas'); return; }
    var parcial = mod === 'bomba' && !res.complete;
    p.innerHTML = (mod === 'sifon' ? '<div class="scheme-bar"><span></span>' + casoChips() + '</div>' : '') + (parcial ? blockedMsg(res, 'todas las gráficas').replace('todavía.', 'todavía: abajo está la comparación de arreglos de bombas.') : '') + '<div class="charts" id="chartsHost"></div>';
    drawCharts(mod, res, $('#chartsHost'));
  }

  /* ---------- Cadena de datos ---------- */
  function cadenaHtml(mod, res) {
    var labelOf = res.labelOf, ic = { ok: ['✓', 'b-ok', 'Calculado'], blocked: ['…', 'b-pend', 'Bloqueado'], error: ['✕', 'b-fail', 'Error'] };
    var html = '<div class="sec-title"><h2>Cadena de cálculo</h2><small>Cada paso usa los datos y los pasos anteriores. Si uno falta, se bloquean los que dependen de él.</small></div>';
    html += '<div class="flowbar">' + res.order.map(function (n, i) { return (i ? '<i>→</i>' : '') + '<button data-jump="' + n.id + '"><span class="badge ' + ic[n.status][1] + '">' + ic[n.status][0] + '</span>' + esc(n.title) + '</button>'; }).join('') + '</div><div class="chain">';
    res.order.forEach(function (n) {
      var usaIn = n.inputs.filter(function (k) { return labelOf[k] && !(labelOf[k].when && !labelOf[k].when(res.vals)); });
      var usa = usaIn.map(function (k) {
        var bad = res.val.missing[k] || res.val.invalid[k];
        return '<button class="linkish" style="font-weight:500;' + (bad ? 'color:var(--bad)' : '') + '" data-goto="' + k + '">' + esc(labelOf[k].label) + '</button>';
      }).join(', ');
      var deps = n.deps.map(function (d) { return esc(res.nodes[d].title); }).join(', ');
      var body = '';
      if (n.status !== 'ok') {
        body = '<div class="why ' + (n.status === 'error' ? 'err' : '') + '"><b>' + (n.status === 'error' ? 'Por qué falló:' : 'Por qué no se calcula:') + '</b><ul>' + n.why.map(function (w) {
          return '<li>' + esc(w.text) + (w.k ? ' <button class="linkish" data-goto="' + w.k + '">Corregir</button>' : '') + '</li>';
        }).join('') + '</ul>' + (n.sug ? '<div style="margin-top:4px"><b>Cómo corregir:</b> ' + esc(n.sug) + '</div>' : '') + '</div>';
      }
      html += '<div class="cnode" id="node_' + n.id + '"><div class="rail"><span class="dotx ' + ic[n.status][1] + '">' + ic[n.status][0] + '</span></div><div class="body"><details' + (n.status !== 'ok' ? ' open' : '') + '><summary><b>' + esc(n.title) + '</b><span class="val">' + esc(n.value || ic[n.status][2]) + '</span></summary>' +
        '<div class="ref">Datos: ' + (usa || 'ninguno') + (deps ? ' · Viene de: ' + deps : '') + '</div>' + body +
        (n.lines.length ? '<div class="pre">' + n.lines.map(esc).join('\n') + '</div>' : '') +
        '<div class="ref">Fuente: ' + esc(n.src) + '</div></details></div></div>';
    });
    return html + '</div>';
  }

  /* ---------- Verificaciones ---------- */
  function verifHtml(mod, res) {
    return '<div class="sec-title"><h2>Verificaciones</h2><small>Límite y fuente de cada parámetro</small></div><div class="tw"><table class="t"><thead><tr><th>Id</th><th>Parámetro</th><th>Valor calculado</th><th>Límite</th><th>Estado</th><th>Fuente</th></tr></thead><tbody>' +
      res.checks.map(function (c) {
        return '<tr><td class="num">' + c.ch.id + '</td><td>' + esc(c.ch.param) + (c.sug ? '<div class="ref" style="color:var(--ink)"><b>Cómo corregir:</b> ' + esc(c.sug) + '</div>' : '') + '</td><td class="num" style="white-space:normal">' + esc(c.value) + '</td><td>' + esc(c.limit) + '</td><td>' + badge(c.estado) + '</td><td style="font-size:.78rem;color:var(--ink-2);min-width:190px">' + esc(c.ch.fuente) + '</td></tr>';
      }).join('') + '</tbody></table></div>';
  }

  /* ---------- Memoria ---------- */
  function memoriaHtml(mod, res) {
    return '<div class="sec-title"><h2>Memoria paso a paso</h2><button class="btn sec" data-print="1">Imprimir</button></div><p style="color:var(--ink-2);margin-bottom:10px">Cada línea muestra la fórmula con los valores reemplazados, para que pueda repetirla con calculadora.</p>' +
      res.order.map(function (n, i) {
        return '<div style="margin-bottom:12px"><h3>' + (i + 1) + '. ' + esc(n.title) + '</h3>' + (n.status === 'ok' ? '<div class="pre">' + n.lines.map(esc).join('\n') + '</div>' : '<div class="notice">' + n.why.map(function (w) { return esc(w.text); }).join('. ') + '</div>') + '<div class="ref">Fuente: ' + esc(n.src) + '</div></div>';
      }).join('');
  }

  /* ---------- Normas ---------- */
  function renderNormas(m) {
    var rows = E.CHECKS.filter(function (c) { return state.filtro === 'todos' || c.mod === state.filtro; });
    m.innerHTML = '<div class="page-head"><div><h1>Límites normativos</h1><p>Matriz de trazabilidad: valor límite, fuente, condición de la advertencia y sugerencia que muestra la aplicación.</p></div>' +
      '<div class="chips"><span>Módulo:</span>' + [['todos', 'Todos'], ['sifon', 'Sifón'], ['bomba', 'Bombeo']].map(function (o) { return '<button class="chip" data-filtro="' + o[0] + '" aria-pressed="' + (state.filtro === o[0]) + '">' + o[1] + '</button>'; }).join('') + '</div></div>' +
      '<div class="notice info"><b>Cómo se aplican las fuentes.</b> La Res. 0330/2017 es obligatoria e incumplirla se marca como "No cumple". El RAS y HEC-22 son guías técnicas y se marcan como "Recomendación". Cuando difieren se muestran ambas: por ejemplo, el diámetro mínimo sanitario es 170 mm en la Res. 0330 (Art. 158) y 200 mm en el RAS (D.7.8.2).</div>' +
      '<div class="tw"><table class="t"><thead><tr><th>Id</th><th>Módulo</th><th>Parámetro</th><th>Valor límite</th><th>Fuente</th><th>Condición de advertencia</th><th>Sugerencia</th><th>Nivel</th></tr></thead><tbody>' +
      rows.map(function (c) { return '<tr><td class="num">' + c.id + '</td><td>' + (c.mod === 'sifon' ? 'Sifón' : 'Bombeo') + '</td><td>' + esc(c.param) + '</td><td>' + esc(c.limite) + '</td><td style="min-width:220px">' + esc(c.fuente) + '</td><td>' + esc(c.cond) + '</td><td style="min-width:190px">' + esc(c.sug) + '</td><td>' + (c.nivel === 'norma' ? '<span class="badge b-fail">Obligatorio</span>' : '<span class="badge b-warn">Recomendación</span>') + '</td></tr>'; }).join('') +
      '</tbody></table></div>' +
      '<div class="sec-title"><h2>Requisitos cualitativos que debe resolver el diseñador</h2></div><div class="tw"><table class="t"><tbody>' + [
        ['Estructuras de conexión al inicio y al final del sifón', 'Res. 0330/2017 Art. 158 num. 6'],
        ['Sin cambios de diámetro a lo largo del sifón', 'RAS D.7.8.4, p. 188'],
        ['Anclajes en cámaras y codos de la zona presurizada', 'RAS Título D, p. 63'],
        ['El tramo bajo no drena por gravedad: prever vaciado y limpieza', 'HEC-22 §8.4.3, p. 134'],
        ['Cribado con dos rejillas en serie (100 y 50 mm) y pérdidas máximas de 0,15 y 0,70 m', 'Res. 0330/2017 Art. 160 num. 1 y 3'],
        ['Pozo de succión dividido en al menos dos partes iguales', 'Res. 0330/2017 Art. 160 num. 9'],
        ['Bombas activadas de forma automática y manual, y alternadas', 'Res. 0330/2017 Art. 161 num. 1 y 9'],
        ['No usar válvulas para estrangular el caudal', 'HEC-22 §12.2.4, p. 256'],
        ['No se admite válvula anticipadora o de cheque como control de golpe de ariete', 'RAS D.8.5.7, p. 219']
      ].map(function (r) { return '<tr><td>' + esc(r[0]) + '</td><td style="color:var(--ink-2);font-size:.82rem;white-space:nowrap">' + esc(r[1]) + '</td></tr>'; }).join('') + '</tbody></table></div>';
  }
  function renderRefs(m) {
    var extra = [
      ['Propiedades del agua', 'RAS Título B, Tabla B.6.28, p. 168, y Tabla B.6.35, p. 180.'],
      ['Rugosidad y módulo de elasticidad', 'RAS Título B, Tabla B.6.29, p. 169, y Tabla B.6.36, p. 181.'],
      ['n de Manning', 'HEC-22, Tabla 9.1, p. 140. Para hierro y acero se toma el valor de tubería metálica lisa de esa tabla; es editable.'],
      ['Pérdidas del sifón (RAS)', 'RAS Título D, Ec. D.7.39 a D.7.43, p. 186-187.'],
      ['Pérdidas del sifón (HEC-22)', 'HEC-22, Ec. 9.3 a 9.6, p. 144-145, y Ec. 9.15, p. 151.'],
      ['Curva del sistema', 'HEC-22, Ec. 12.1, p. 252; RAS Título B, Ec. B.8.1, p. 356.'],
      ['Curva de la bomba', 'RAS Título B, Ec. B.8.4, p. 357.'],
      ['Potencia y NPSH', 'RAS Título B, Ec. B.8.2, p. 356, y Ec. B.8.3, p. 357.'],
      ['Celeridad de la onda', 'RAS Título B, Ec. B.6.24, p. 181.']
    ];
    m.innerHTML = '<div class="page-head"><div><h1>Referencias</h1><p>Fuentes consultadas para cada ecuación y límite.</p></div></div><div class="panel" style="padding:16px 18px"><ol class="reflist">' +
      ['R0330', 'RASD', 'RASB', 'HEC22', 'GUIA'].map(function (k) { return '<li>' + esc(E.SOURCES[k].full) + '</li>'; }).join('') +
      '<li>López Cualla, R. A. Elementos de diseño para acueductos y alcantarillados. Escuela Colombiana de Ingeniería. Referencia base de la guía; no se atribuye a este texto ningún límite de la aplicación.</li></ol></div>' +
      '<div class="sec-title"><h2>Dónde está cada ecuación</h2></div><div class="tw"><table class="t"><tbody>' + extra.map(function (r) { return '<tr><td><b>' + esc(r[0]) + '</b></td><td>' + esc(r[1]) + '</td></tr>'; }).join('') + '</tbody></table></div>' +
      '<div class="sec-title"><h2>Relaciones físicas sin límite normativo</h2></div><div class="tw"><table class="t"><tbody>' + [
        ['Joukowsky, ΔH = a·V/g', 'Exigida por la guía AA-PF-01, Tabla 1. Principio físico clásico; confirme la página en su texto de hidráulica.'],
        ['Cierre lento, ΔH = 2LV/(gT)', 'Fórmula de Michaud. Principio físico clásico; confirme la página en su texto de hidráulica.'],
        ['Vertedero, Q = 1,84·L·h^1,5', 'Fórmula de Francis para dimensionar el vertedero. Confirme la página en su texto de hidráulica.'],
        ['Presión atmosférica según altitud', 'Atmósfera estándar internacional.'],
        ['Coeficiente C de Hazen-Williams, Poisson y E del concreto', 'Valores iniciales editables. Confirme con el fabricante.']
      ].map(function (r) { return '<tr><td><b>' + esc(r[0]) + '</b></td><td>' + esc(r[1]) + '</td></tr>'; }).join('') + '</tbody></table></div>';
  }

  /* ---------- Pruebas ---------- */
  function renderPruebas(m) {
    var rows = state.pruebas || E.correrPruebas();
    state.pruebas = rows;
    var pasa = rows.filter(function (r) { return r.paso; }).length;
    m.innerHTML = '<div class="page-head"><div><h1>Plan de pruebas</h1><p>Se ejecuta sobre el mismo motor de cálculo. Incluye datos normales, en el límite, fuera de norma, inválidos y con autocompletado: ' + rows.filter(function (r) { return r.mod === 'sifon'; }).length + ' casos del sifón y ' + rows.filter(function (r) { return r.mod === 'bomba'; }).length + ' del bombeo.</p></div><button class="btn" id="btnRun">Ejecutar de nuevo</button></div>' +
      '<div class="allgood" style="margin-bottom:12px;' + (pasa === rows.length ? '' : 'background:var(--bad-soft);color:var(--bad)') + '">' + pasa + ' de ' + rows.length + ' pruebas con el resultado esperado.</div>' +
      '<div class="tw"><table class="t"><thead><tr><th>Id</th><th>Tipo</th><th>Caso</th><th>Esperado</th><th>Obtenido</th><th>Advertencia mostrada</th><th>Resultado</th></tr></thead><tbody>' +
      rows.map(function (r) { return '<tr><td class="num">' + r.id + '</td><td>' + r.tipo + '</td><td>' + esc(r.desc) + '</td><td>' + esc(r.espera) + '</td><td>' + esc(r.obtenido) + '</td><td style="font-size:.8rem;min-width:220px">' + esc(r.advertencia) + '</td><td>' + (r.paso ? badge('ok').replace('Cumple', 'Pasa') : badge('fail').replace('No cumple', 'Falla')) + '</td></tr>'; }).join('') + '</tbody></table></div>';
  }

  /* ---------- Exportar ---------- */
  function renderExportar(m) {
    var meta = state.meta;
    m.innerHTML = '<div class="page-head"><div><h1>Exportar</h1><p>Descargue la memoria con datos, resultados, verificaciones y advertencias, o traiga datos desde Excel.</p></div></div>' +
      '<div class="panel" style="padding:14px 16px;margin-bottom:12px"><h2 style="margin-bottom:10px">Datos de la portada</h2><div class="fields" style="padding:0;grid-template-columns:repeat(auto-fit,minmax(min(240px,100%),1fr))">' +
      [['proyecto', 'Nombre del proyecto'], ['integrantes', 'Integrantes del grupo'], ['caso', 'Caso de verificación']].map(function (x) { return '<div class="field"><label for="m_' + x[0] + '">' + x[1] + '</label><div class="ctrl"><input id="m_' + x[0] + '" data-meta="' + x[0] + '" style="font-family:var(--sans)" value="' + esc(meta[x[0]] || '') + '"></div></div>'; }).join('') + '</div></div>' +
      '<div class="req-grid">' +
      '<div class="req"><b>Memoria en PDF</b><span>Datos, resultados, verificaciones, advertencias, esquemas, gráficas y cálculos paso a paso.</span><div style="margin-top:8px"><button class="btn" data-exp="pdf">Descargar PDF</button></div></div>' +
      '<div class="req"><b>Datos en Excel</b><span>Datos, resultados, verificaciones, curvas, matriz normativa y plan de pruebas, en hojas separadas.</span><div style="margin-top:8px"><button class="btn" data-exp="xlsx">Descargar Excel</button></div></div>' +
      '<div class="req"><b>Vista de impresión</b><span>Abre el diálogo del navegador para imprimir o guardar como PDF.</span><div style="margin-top:8px"><button class="btn sec" data-exp="print">Imprimir</button></div></div>' +
      '<div class="req"><b>Traer datos desde Excel</b><span>Use el Excel descargado de esta aplicación: cambie la columna Valor en las hojas Sifon_Datos y Bomba_Datos y cárguelo aquí.</span><div style="margin-top:8px"><button class="btn sec" data-exp="import">Cargar Excel</button></div></div></div>';
  }

  /* ---------- Instructivo ---------- */
  function renderAyuda(m) {
    m.innerHTML = '<div class="page-head"><div><h1>Instructivo de uso</h1><p>Esta misma guía está en el archivo Instructivo_de_uso.pdf, de una página.</p></div></div><div class="req-grid">' + [
      ['1. Abrir', 'Haga doble clic en Sifones_invertidos_y_sistemas_de_bombeo.html. Abre en Chrome, Edge o Firefox, sin instalar nada y sin internet.'],
      ['2. Escribir datos', 'Entre al módulo y llene los datos de la izquierda. Puede usar coma o punto decimal. Los campos marcados AUTO se pueden dejar vacíos: se completan con la norma y muestran el procedimiento.'],
      ['3. Leer el estado', 'La franja superior resume el diseño. En Resultados, la sección "Qué falta o qué corregir" explica cada problema y lleva al dato.'],
      ['4. Seguir la cadena', 'La pestaña Cadena de datos muestra qué paso quedó bloqueado, por cuál dato y qué depende de él.'],
      ['5. Ver el diseño', 'Perfil, Planta y detalles (o Tuberías y accesorios), Modelo 3D y Gráficas se redibujan con sus valores. Cambie entre Qmin, Qmed y Qmax para ver el servicio progresivo.'],
      ['6. Verificar a mano', 'La Memoria paso a paso trae la fórmula con los números reemplazados para comprobar con calculadora.'],
      ['7. Exportar', 'Use los botones PDF y Excel de la barra superior. En Exportar puede escribir la portada, imprimir o traer datos de un Excel.'],
      ['8. Probar casos', 'Los botones "Cargar caso" traen ejemplos que cumplen, en el límite, fuera de norma, con datos mínimos, con una bomba que no alcanza e inválidos.'],
      ['9. Bombas en serie o paralelo', 'Si la curva de la bomba no da el caudal o la altura, Resultados compara arreglos y el botón Usar aplica el recomendado.']
    ].map(function (r) { return '<div class="req"><b>' + r[0] + '</b><span>' + r[1] + '</span></div>'; }).join('') + '</div>' +
      '<div class="notice" style="margin-top:14px"><b>Lo que debe entregar el grupo además de esta aplicación (guía, numeral 8):</b> memoria manual del caso de verificación y comparación con la aplicación (máximo 1 % de diferencia), bitácora de IA con mínimo cinco errores registrados, declaración firmada, video de máximo 5 minutos y coevaluación.</div>';
  }

  /* ---------- Eventos ---------- */
  function currentMod() { return state.page === 'sifon' || state.page === 'bomba' ? state.page : null; }
  function gotoField(k) {
    var mod = currentMod(); if (!mod) return;
    var w = $('#wrap_' + k); if (!w) return;
    var det = w.closest('details'); if (det) det.open = true;
    w.scrollIntoView({ behavior: 'smooth', block: 'center' });
    var inp = $('input,select', w); if (inp) inp.focus({ preventScroll: true });
    var ctl = $('.ctrl', w) || w; ctl.classList.remove('flash'); void ctl.offsetWidth; ctl.classList.add('flash');
  }
  function curvaDesdeTabla() {
    var filas = {};
    $$('#curveT input').forEach(function (i) {
      var p = i.dataset.cv.split(',');
      (filas[p[0]] = filas[p[0]] || [])[p[1]] = i.value.trim();
    });
    return Object.keys(filas).map(function (k) { return [0, 1, 2, 3].map(function (j) { return filas[k][j] || ''; }).join(';'); }).join('\n');
  }
  function setMaterial(mod) {
    var vals = state.vals[mod], mt = E.MATERIALS[vals.mat];
    if (!mt) return;
    vals.ks = mt.ks;
    if (mod === 'sifon') vals.n = mt.n;
    else { vals.E = mt.E; vals.nu = mt.nu; vals.C = mt.C; }
  }
  document.addEventListener('click', function (e) {
    var t = e.target.closest('button,[data-page]'); if (!t) return;
    var d = t.dataset;
    if (d.page) return go(d.page);
    if (d.tab) { var m0 = currentMod(); state.tab[m0] = d.tab; renderTabs(m0, state.res[m0]); return renderTab(m0, state.res[m0]); }
    if (d.caso !== undefined) { state.caso = +d.caso; var m1 = currentMod(); return renderTab(m1, state.res[m1]); }
    if (d.esc) {
      var m2 = currentMod(), es = E.ESCENARIOS[m2].filter(function (x) { return x.id === d.esc; })[0];
      state.vals[m2] = Object.assign(E.defaults(m2), es.datos);
      state.esc[m2] = es.id;
      renderScenarios(m2); renderInputs(m2); return refresh(m2);
    }
    if (d.goto) return gotoField(d.goto);
    if (d.fix) {
      var mf = currentMod(), au = state.res[mf] && state.res[mf].val.auto[d.fix];
      if (!au) return;
      state.vals[mf][d.fix] = String(Math.round(au.v * 10000) / 10000).replace('.', ',');
      state.esc[mf] = null; renderScenarios(mf); renderInputs(mf); refresh(mf);
      return toast('Se escribió el valor autocompletado en "' + au.field.label + '".');
    }
    if (d.apply) {
      var ma = currentMod(), pr = d.apply.split(',').map(Number), va = state.vals[ma];
      va.nAct = pr[0]; va.nSer = pr[1];
      var nInst = E.parseNum(va.nInst);
      if (!(nInst >= pr[0] * pr[1] + 1)) va.nInst = pr[0] * pr[1] + 1;
      state.esc[ma] = null; renderScenarios(ma); renderInputs(ma); refresh(ma);
      return toast('Arreglo aplicado: ' + E.arregloTxt(pr[0], pr[1]) + ', ' + va.nInst + ' instaladas con la reserva.');
    }
    if (d.jump) { var n = $('#node_' + d.jump); if (n) { n.scrollIntoView({ behavior: 'smooth', block: 'center' }); $('details', n).open = true; } return; }
    if (d.filtro) { state.filtro = d.filtro; return renderPage(); }
    if (d.delrow !== undefined) {
      var m3 = currentMod(); var rows = curvaDesdeTabla().split('\n');
      if (rows.length <= 1) return;
      rows.splice(+d.delrow, 1);
      state.vals[m3].curva = rows.join('\n'); renderInputs(m3); return refresh(m3);
    }
    if (d.reset3d) { state.viewers[d.reset3d].resetView(); return; }
    if (d.print) return window.Report.print(api);
    if (d.exp === 'pdf') return runPdf();
    if (d.exp === 'xlsx') return window.Report.xlsx(api);
    if (d.exp === 'print') return window.Report.print(api);
    if (d.exp === 'import') return $('#fileXlsx').click();
    if (t.id === 'btnReset') { var m4 = currentMod(); state.vals[m4] = E.defaults(m4); state.esc[m4] = 'normal'; renderScenarios(m4); renderInputs(m4); return refresh(m4); }
    if (t.id === 'addRow') { var m5 = currentMod(); state.vals[m5].curva = curvaDesdeTabla() + '\n;;;'; renderInputs(m5); return refresh(m5); }
    if (t.id === 'btnPdf') return runPdf();
    if (t.id === 'btnXlsx') return window.Report.xlsx(api);
    if (t.id === 'btnRun') { state.pruebas = null; renderPage(); return toast('Pruebas ejecutadas de nuevo.'); }
    if (t.id === 'btnTheme') {
      var cur = document.documentElement.getAttribute('data-theme') || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
      var nx = cur === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', nx); store('theme', nx);
    }
  });
  function runPdf() {
    var b = $('#btnPdf'); b.disabled = true; b.textContent = 'Generando…';
    toast('Preparando la memoria en PDF…');
    setTimeout(function () {
      window.Report.pdf(api).then(function () { toast('PDF descargado.'); }).catch(function (e) { console.error(e); toast('No se pudo generar el PDF: ' + e.message); }).then(function () { b.disabled = false; b.textContent = 'PDF'; });
    }, 40);
  }
  document.addEventListener('input', function (e) {
    var t = e.target, mod = currentMod();
    if (t.dataset.meta) { state.meta[t.dataset.meta] = t.value; store('meta', state.meta); return; }
    if (!mod) return;
    if (t.dataset.acc) { state.vals[mod][t.dataset.acc] = accDesdeTabla(t.dataset.acc); if (state.esc[mod]) { state.esc[mod] = null; renderScenarios(mod); } return schedule(mod); }
    if (t.dataset.cv !== undefined) { state.vals[mod].curva = curvaDesdeTabla(); state.esc[mod] = null; renderScenarios(mod); return schedule(mod); }
    if (t.dataset.k && t.tagName !== 'SELECT') { state.vals[mod][t.dataset.k] = t.value; if (state.esc[mod]) { state.esc[mod] = null; renderScenarios(mod); } schedule(mod); }
  });
  document.addEventListener('change', function (e) {
    var t = e.target, mod = currentMod();
    if (t.id === 'fileXlsx') {
      if (t.files && t.files[0]) window.Report.importXlsx(t.files[0], api).then(function (msg) { toast(msg); renderNav(); renderPage(); }).catch(function (er) { toast(er.message); });
      t.value = '';
      return;
    }
    if (!mod || !t.dataset.k || t.tagName !== 'SELECT') return;
    state.vals[mod][t.dataset.k] = t.value;
    if (t.dataset.k === 'mat') setMaterial(mod);
    state.esc[mod] = null; renderScenarios(mod);
    renderInputs(mod); refresh(mod);
  });

  var api = {
    state: state, compute: compute, drawCharts: drawCharts, toast: toast,
    setVals: function (mod, v) { state.vals[mod] = Object.assign(E.defaults(mod), v); state.esc[mod] = null; compute(mod); store('vals', state.vals); },
    results: function () { return { sifon: compute('sifon'), bomba: compute('bomba') }; }
  };
  window.App = api;
  compute('sifon'); compute('bomba');
  var h = (location.hash || '').replace('#', '');
  if (PAGES.some(function (p) { return p.id === h; })) state.page = h;
  renderNav(); renderPage();
})();
