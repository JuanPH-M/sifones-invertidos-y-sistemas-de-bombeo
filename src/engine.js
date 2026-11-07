/* Motor de cálculo: Sifones invertidos y sistemas de bombeo.
   Sin dependencias del navegador: se ejecuta igual en la página y en las pruebas de Node. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Engine = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var G = 9.81;
  var EF_GPA = 2.2; // módulo de compresibilidad del agua (RAS B.6.5.8.5)

  /* ---------- Fuentes verificadas ---------- */
  var SOURCES = {
    R0330: {
      tag: 'Res. 0330/2017',
      full: 'Ministerio de Vivienda, Ciudad y Territorio (2017). Resolución 0330 de 2017, Reglamento Técnico del Sector de Agua Potable y Saneamiento Básico (RAS), con las modificaciones de la Resolución 799 de 2021. Texto consultado en la Comisión de Regulación de Agua Potable (normas.cra.gov.co).'
    },
    RASD: {
      tag: 'RAS Título D (2016)',
      full: 'Ministerio de Vivienda, Ciudad y Territorio (2016). RAS, Título D: Sistemas de recolección y evacuación de aguas residuales domésticas y aguas lluvias. Guía técnica.'
    },
    RASB: {
      tag: 'RAS Título B',
      full: 'Ministerio de Vivienda, Ciudad y Territorio. RAS, Título B: Sistemas de acueducto. Guía técnica.'
    },
    HEC22: {
      tag: 'HEC-22 (2024)',
      full: 'Federal Highway Administration (2024). Urban Drainage Design Manual, Hydraulic Engineering Circular No. 22, 4th ed. Publication FHWA-HIF-24-006.'
    },
    GUIA: {
      tag: 'Guía AA-PF-01',
      full: 'Fundación Universitaria Tecnológico Comfenalco (2026). AA-PF-01: Proyecto final, aplicación portátil para el diseño de estructuras hidráulicas. Tabla 1, módulos del grupo G2.'
    },
    FIS: {
      tag: 'Validez física',
      full: 'Condición física del modelo o criterio de diseño adoptado por el grupo. No corresponde a un límite normativo y así se indica en cada caso.'
    }
  };

  /* ---------- Materiales ---------- */
  var MATERIALS = {
    pvc: { label: 'PVC / PVCO', ks: 0.0015, E: 2.75, nu: 0.40, n: 0.010, C: 150, d: 'Tubería a presión de PVC o PVC orientado, con unión mecánica y empaque de caucho. Es liviana, lisa y no se corroe con el agua residual. Se instala sobre cama de arena con relleno compactado.' },
    pe: { label: 'Polietileno (largo plazo)', ks: 0.007, E: 0.2, nu: 0.45, n: 0.012, C: 150, d: 'Polietileno de alta densidad unido por termofusión, sin juntas mecánicas. Es flexible: sirve para cruzar ríos por arrastre o por perforación dirigida.' },
    hd: { label: 'Hierro dúctil', ks: 0.25, E: 165.5, nu: 0.28, n: 0.012, C: 130, d: 'Hierro dúctil con junta automática o mecánica. Resiste cargas grandes: sirve en cruces bajo vías. Necesita revestimiento interno contra la corrosión.' },
    hdm: { label: 'Hierro dúctil con mortero', ks: 0.10, E: 165.5, nu: 0.28, n: 0.012, C: 140, d: 'Hierro dúctil con revestimiento interno de mortero de cemento: menos rugoso y protegido del agua residual. Resiste cargas de tráfico.' },
    acero: { label: 'Acero comercial', ks: 0.45, E: 206.8, nu: 0.30, n: 0.012, C: 130, d: 'Acero soldado. Se usa en cruces aéreos, en camisas de hincado y con presiones altas. Requiere recubrimiento y protección catódica.' },
    grp: { label: 'GRP (fibra de vidrio)', ks: 0.029, E: 8.96, nu: 0.30, n: 0.010, C: 150, d: 'Plástico reforzado con fibra de vidrio. Liviano y resistente a la corrosión; conveniente en diámetros grandes.' },
    ccp: { label: 'CCP (concreto con cilindro)', ks: 0.12, E: 24.0, nu: 0.20, n: 0.011, C: 130, d: 'Concreto con cilindro de acero. Para diámetros grandes y presiones medias; muy rígido y pesado.' }
  };
  function matOptions() {
    var o = Object.keys(MATERIALS).map(function (k) { return { v: k, t: MATERIALS[k].label }; });
    o.push({ v: 'otro', t: 'Otro (se usan los valores escritos)' });
    return o;
  }

  /* ---------- Descripciones de estructuras ---------- */
  var DESCR = {
    obst: {
      rio: { t: 'Río', rec: 1.5, zobs: 'lecho del río', znivel: 'nivel de aguas máximas', d: 'Cauce permanente. El sifón pasa bajo el lecho y se protege contra la socavación con recubrimiento, dado de concreto o enrocado. Se ancla para que no flote cuando está vacío.' },
      arroyo: { t: 'Arroyo o quebrada', rec: 1.0, zobs: 'fondo del cauce', znivel: 'nivel de creciente', d: 'Cauce de caudal variable, seco en verano y con crecientes rápidas. El conducto va bajo el fondo con dado de concreto y el cauce se protege en la zona del cruce.' },
      canal: { t: 'Canal de drenaje', rec: 1.0, zobs: 'fondo del canal', znivel: 'nivel de agua del canal', d: 'Canal revestido o en tierra. El conducto pasa bajo la losa de fondo sin debilitarla y se deja una junta para que el canal no cargue sobre el tubo.' },
      via: { t: 'Vía vehicular', rec: 1.2, zobs: 'rasante de la vía', znivel: 'rasante de la vía', d: 'Cruce bajo una calle o carretera. El conducto recibe la carga del tráfico: se protege con camisa (tubo de mayor diámetro) o dado de concreto y se construye a cielo abierto o por hincado.' },
      ferrea: { t: 'Vía férrea', rec: 1.5, zobs: 'base del balasto', znivel: 'nivel del riel', d: 'Cruce bajo una línea férrea. Se hace por hincado con camisa de acero, sin interrumpir el tráfico, con el recubrimiento que fije el operador férreo.' },
      tuberia: { t: 'Otra tubería o red', rec: 0.3, zobs: 'batea de la red existente', znivel: 'clave de la red existente', d: 'Cruce bajo otra red (acueducto, gas, colector). Se deja una separación libre entre las dos tuberías y se protege la red existente durante la excavación.' },
      depresion: { t: 'Depresión del terreno', rec: 0.6, zobs: 'fondo de la depresión', znivel: 'terreno en la depresión', d: 'Vaguada o zona baja que el colector no puede salvar por gravedad. El sifón sigue el terreno con el recubrimiento mínimo de una tubería enterrada.' }
    },
    camE: {
      lateral: { t: 'Vertederos laterales con tabiques', d: 'El colector llega a un canal central. Cada conducto tiene su compartimiento separado por tabiques. El conducto 1 toma el caudal mínimo desde el fondo; cuando el nivel sube, el agua vierte sobre la cresta del compartimiento siguiente y entra el conducto 2, y así hasta Qmax (Res. 0330 Art. 158 num. 5). La rejilla va antes de los vertederos.' },
      frontal: { t: 'Vertederos frontales escalonados', d: 'Los compartimientos quedan uno detrás de otro en la dirección del flujo y las crestas suben de uno al siguiente. Ocupa menos ancho y más largo que la cámara de vertederos laterales.' },
      compuertas: { t: 'Compuertas o tablones', d: 'Los conductos se ponen en servicio abriendo compuertas, y la altura de la cresta se fija con tablones (stop-logs). Es flexible, pero exige operación y vigilancia.' }
    },
    camS: {
      tabiques: { t: 'Con tabiques y vertederos', d: 'Cada conducto descarga en su propio compartimiento y vierte al canal de salida. Los tabiques evitan que el agua se devuelva y deje sedimento en los conductos que no están en servicio.' },
      simple: { t: 'Cámara de unión simple', d: 'Todos los conductos descargan al mismo recinto y de allí al colector de salida. Es más económica, pero el agua puede entrar a los conductos sin servicio y sedimentar en ellos.' }
    },
    sep: {
      concreto: { t: 'Tabiques de concreto reforzado', e: 0.20, d: 'Muros fundidos con la cámara, de 0,15 a 0,25 m de espesor. Separan el compartimiento de cada conducto y llevan la cresta del vertedero.' },
      removible: { t: 'Placas o tablones removibles', e: 0.10, d: 'Placas en ranuras metálicas. Permiten cambiar la altura de la cresta y aislar un conducto para limpieza.' }
    },
    tanque: {
      quiebre: { t: 'Cámara de quiebre', d: 'Recibe la impulsión, disipa la energía y entrega a un colector por gravedad. Lleva tapa de inspección y ventilación.' },
      tanque: { t: 'Tanque de almacenamiento', d: 'Tanque que regula el caudal entre el bombeo y la red. Lleva rebose, desagüe y ventilación.' },
      canal: { t: 'Llegada a planta de tratamiento', d: 'Canal o cámara de entrada de la planta de tratamiento. La salida se ubica para no generar turbulencia en el cribado.' }
    },
    descarga: {
      ahogada: { t: 'Descarga ahogada', d: 'La salida queda bajo el nivel del agua: no entra aire y no salpica. La altura estática se mide hasta el nivel de agua.' },
      libre: { t: 'Descarga libre', d: 'La salida queda sobre el nivel del agua. La altura estática se mide hasta el eje de la salida, no hasta el nivel de agua.' }
    }
  };
  function optsDe(m) { return Object.keys(m).map(function (k) { return { v: k, t: m[k].t }; }); }

  /* ---------- Accesorios y coeficientes K ---------- */
  var ACC = [
    { id: 'entrada_recta', t: 'Entrada de borde recto', K: 0.5, en: 'su' },
    { id: 'entrada_campana', t: 'Entrada abocinada (campana)', K: 0.1, en: 'su' },
    { id: 'codo90', t: 'Codo de 90°', K: 0.9, en: 'ambos' },
    { id: 'codo45', t: 'Codo de 45°', K: 0.4, en: 'ambos' },
    { id: 'tee_dir', t: 'Tee, paso directo', K: 0.6, en: 'ambos' },
    { id: 'tee_lat', t: 'Tee, salida lateral', K: 1.8, en: 'ambos' },
    { id: 'v_comp', t: 'Válvula de compuerta abierta', K: 0.2, en: 'ambos' },
    { id: 'v_mari', t: 'Válvula de mariposa abierta', K: 0.3, en: 'ambos' },
    { id: 'v_cheq', t: 'Válvula de cheque (retención)', K: 2.5, en: 'im' },
    { id: 'reduccion', t: 'Reducción excéntrica', K: 0.5, en: 'su' },
    { id: 'ampliacion', t: 'Ampliación concéntrica', K: 0.3, en: 'im' },
    { id: 'union', t: 'Unión de desmontaje', K: 0.1, en: 'ambos' }
  ];
  var ACC_BY = {};
  ACC.forEach(function (a) { ACC_BY[a.id] = a; });
  function parseAcc(txt) {
    var out = [], errs = [];
    String(txt || '').split(/[;\n]+/).map(function (s) { return s.trim(); }).filter(Boolean).forEach(function (p) {
      var m = p.match(/^([a-z0-9_]+)\s*=\s*([^@]+?)\s*(?:@\s*(.+))?$/i);
      if (!m || !ACC_BY[m[1]]) { errs.push('Accesorio no reconocido: "' + p + '".'); return; }
      var n = parseNum(m[2]), K = m[3] === undefined ? ACC_BY[m[1]].K : parseNum(m[3]);
      if (isNaN(n) || n < 0 || Math.floor(n) !== n) { errs.push(ACC_BY[m[1]].t + ': la cantidad debe ser un entero mayor o igual a 0.'); return; }
      if (isNaN(K) || K < 0) { errs.push(ACC_BY[m[1]].t + ': K debe ser un número mayor o igual a 0.'); return; }
      if (n > 0) out.push({ id: m[1], t: ACC_BY[m[1]].t, n: n, K: K, nK: n * K });
    });
    return { items: out, errs: errs, sum: out.reduce(function (s, a) { return s + a.nK; }, 0) };
  }

  /* ---------- Autocompletado ---------- */
  var r05 = function (x) { return Math.round(x * 20) / 20; };
  var dn05 = function (x) { return Math.floor(x * 20 + 1e-9) / 20; };
  var up05 = function (x) { return Math.ceil(x * 20 - 1e-9) / 20; };
  var up10mm = function (m) { return Math.ceil(m * 100 - 1e-9) * 10; };
  var upStep = function (x, s) { return Math.round(Math.ceil(x / s - 1e-9) * s * 1000) / 1000; };
  var has = function (v, ks) { return ks.every(function (k) { return v[k] !== undefined && v[k] !== null && !(typeof v[k] === 'number' && isNaN(v[k])); }); };
  var auto = function (val, how, src) { return { v: val, how: how, src: src || 'Valor genérico adoptado por el grupo; reemplácelo si tiene el dato real.' }; };
  function vminDe(v) { return v.tipo === 'pluvial' ? 1.2 : 1.0; }
  function dEstimado(Q, Vmin) { return Math.sqrt(4 * Q / (Math.PI * Vmin)); }
  /* Cota de batea de los conductos en las cámaras para que trabajen ahogados con todos los caudales */
  function bateaAhogada(v) {
    if (!has(v, ['Zs', 'Ds', 'Ss', 'ns', 'Qmin', 'Qmed', 'Qmax', 'tipo'])) return null;
    var vm = vminDe(v), ys = normalDepth(v.Qmin / 1000, v.Ds / 1000, v.ns, v.Ss / 100).y;
    var Ds = [v.Qmin, Math.max(v.Qmed - v.Qmin, 1e-6), Math.max(v.Qmax - v.Qmed, 1e-6)].map(function (q) { return dEstimado(q / 1000, vm); });
    var Dm = Math.max.apply(null, Ds);
    var z = dn05(v.Zs + ys - Dm);
    return { z: z, ys: ys, Dm: Dm };
  }

  /* ---------- Campos de entrada ---------- */
  var num = function (k, label, unit, group, def, opt) {
    return Object.assign({ k: k, label: label, unit: unit, group: group, def: def, type: 'num' }, opt || {});
  };
  var sel = function (k, label, group, def, options, opt) {
    return Object.assign({ k: k, label: label, unit: '', group: group, def: def, type: 'sel', options: options }, opt || {});
  };
  var autoMat = function (prop, src) {
    return function (v) {
      var m = MATERIALS[v.mat];
      if (!m) return null;
      return auto(m[prop], 'Valor del material escogido (' + m.label + ').', src);
    };
  };
  var ACC_SU_DEF = 'entrada_recta=1; codo90=2; v_comp=1; reduccion=1';
  var ACC_IM_DEF = 'ampliacion=1; v_cheq=1; v_comp=1; tee_lat=1; tee_dir=1; codo90=2; codo45=2';

  var FIELDS = {
    sifon: [
      sel('tipo', 'Tipo de alcantarillado', 'Sistema', 'sanitario', [{ v: 'sanitario', t: 'Sanitario (aguas residuales)' }, { v: 'pluvial', t: 'Pluvial o combinado' }], { hint: 'Define V mínima, D mínimo y esfuerzo cortante (Art. 158).' }),
      sel('metodo', 'Método de pérdidas', 'Sistema', 'RAS', [{ v: 'RAS', t: 'RAS Título D, Darcy-Colebrook (D.7.40 a D.7.43)' }, { v: 'HEC', t: 'HEC-22, Manning (Ec. 9.4, 9.5, 9.6, 9.15)' }], { hint: 'El otro método se calcula también para comparar.' }),
      num('T', 'Temperatura del agua', '°C', 'Sistema', 20, { min: 0, max: 50, hint: 'Densidad y viscosidad: RAS Tabla B.6.28.', auto: function () { return auto(20, 'Temperatura usual del agua residual en clima cálido.'); } }),
      num('Qmin', 'Caudal mínimo', 'L/s', 'Caudales de diseño', 40, { gt: 0 }),
      num('Qmed', 'Caudal medio', 'L/s', 'Caudales de diseño', 120, { gt: 0 }),
      num('Qmax', 'Caudal máximo', 'L/s', 'Caudales de diseño', 260, { gt: 0 }),
      sel('obst', 'Tipo de obstáculo que se cruza', 'Obstáculo', 'arroyo', optsDe(DESCR.obst), { hint: 'Cambia el dibujo, la descripción y el recubrimiento sugerido.' }),
      num('Zobs', 'Cota del fondo del obstáculo', 'm', 'Obstáculo', 96.0, { hint: 'Lecho del río o arroyo, rasante de la vía o batea de la red que se cruza.' }),
      num('Znivel', 'Cota del nivel de agua o superficie del obstáculo', 'm', 'Obstáculo', 98.0, { hint: 'Nivel de creciente del cauce; en vías, la rasante.', auto: function (v) { return has(v, ['Zobs']) ? auto(v.Zobs, 'Sin lámina de agua: se toma igual al fondo del obstáculo (' + fmt(v.Zobs) + ' m).') : null; } }),
      num('Bobs', 'Ancho del obstáculo', 'm', 'Obstáculo', 36, { gt: 0, hint: 'Ancho que debe cubrir el tramo inferior del sifón.', auto: function (v) { return has(v, ['Lc']) ? auto(Math.max(v.Lc - 2, 0.5), 'Ancho = Lc − 2·1,0 m de margen = ' + fmt(v.Lc) + ' − 2 = ' + fmt(Math.max(v.Lc - 2, 0.5)) + ' m.', 'Criterio de diseño: 1,0 m de margen a cada lado del obstáculo.') : null; } }),
      num('recub', 'Recubrimiento sobre la clave bajo el obstáculo', 'm', 'Obstáculo', '', { ge: 0, max: 10, hint: 'Vacío: se toma el valor sugerido para el tipo de obstáculo.', auto: function (v) { var o = DESCR.obst[v.obst]; return o ? auto(o.rec, 'Valor sugerido para "' + o.t + '": ' + fmt(o.rec) + ' m sobre la clave.', 'Criterio de diseño del grupo. Confirme con la autoridad del cauce, de la vía o de la red (RAS D.2.7.4 para distancias a otras redes).') : null; } }),
      sel('modo', 'Dimensionamiento de conductos', 'Conductos del sifón', 'auto', [{ v: 'auto', t: 'Automático (N y D calculados)' }, { v: 'manual', t: 'Manual (yo fijo N y D)' }]),
      num('lista', 'Diámetros internos disponibles', 'mm', 'Conductos del sifón', '200, 250, 300, 350, 400, 450, 500, 600, 700, 800, 900, 1000, 1200', { type: 'text', hint: 'Lista de referencia: reemplácela por los diámetros internos reales del fabricante.', when: function (v) { return v.modo === 'auto'; } }),
      num('N', 'Número de conductos', 'und', 'Conductos del sifón', 3, { min: 1, max: 4, integer: true, when: function (v) { return v.modo === 'manual'; } }),
      num('D1', 'Diámetro interno conducto 1', 'mm', 'Conductos del sifón', 200, { gt: 0, max: 3000, when: function (v) { return v.modo === 'manual'; } }),
      num('D2', 'Diámetro interno conducto 2', 'mm', 'Conductos del sifón', 300, { gt: 0, max: 3000, when: function (v) { return v.modo === 'manual' && +v.N >= 2; } }),
      num('D3', 'Diámetro interno conducto 3', 'mm', 'Conductos del sifón', 400, { gt: 0, max: 3000, when: function (v) { return v.modo === 'manual' && +v.N >= 3; } }),
      num('D4', 'Diámetro interno conducto 4', 'mm', 'Conductos del sifón', 400, { gt: 0, max: 3000, when: function (v) { return v.modo === 'manual' && +v.N >= 4; } }),
      sel('reparto', 'Reparto de caudal entre conductos', 'Conductos del sifón', 'vert', [{ v: 'vert', t: 'Regulado por vertederos, por incrementos (Art. 158.5)' }, { v: 'libre', t: 'Paralelo libre, igual pérdida en todos' }], { hint: 'Regulado: Q1 = Qmin, Q2 = Qmed − Qmin, Q3 = Qmax − Qmed.' }),
      num('hw', 'Carga de diseño sobre vertederos', 'm', 'Conductos del sifón', 0.10, { gt: 0, max: 2, hint: 'Criterio de diseño: eleva el nivel de la cámara cuando entra otro conducto.', when: function (v) { return v.reparto === 'vert'; }, auto: function () { return auto(0.10, 'Carga usual de 0,10 m sobre la cresta.', 'Criterio de diseño del grupo.'); } }),
      sel('mat', 'Material de los conductos', 'Conductos del sifón', 'pvc', matOptions(), { hint: 'Carga ks (RAS Tabla B.6.29) y n (HEC-22 Tabla 9.1).' }),
      num('ks', 'Rugosidad absoluta ks', 'mm', 'Conductos del sifón', 0.0015, { ge: 0, max: 10, auto: autoMat('ks', 'RAS Título B, Tabla B.6.29, p. 169.') }),
      num('n', 'n de Manning del conducto', '-', 'Conductos del sifón', 0.010, { gt: 0, max: 0.05, auto: autoMat('n', 'HEC-22, Tabla 9.1, p. 140.') }),
      sel('rejilla', '¿Hay rejilla antes del sifón?', 'Conductos del sifón', 'si', [{ v: 'si', t: 'Sí' }, { v: 'no', t: 'No' }], { hint: 'Exigida si D ≤ 760 mm (Art. 158.7).' }),
      sel('camE', 'Tipo de cámara de entrada', 'Cámaras y separadores', 'lateral', optsDe(DESCR.camE)),
      sel('camS', 'Tipo de cámara de salida', 'Cámaras y separadores', 'tabiques', optsDe(DESCR.camS)),
      sel('sep', 'Separadores entre conductos', 'Cámaras y separadores', 'concreto', optsDe(DESCR.sep)),
      num('esep', 'Espesor de los separadores', 'm', 'Cámaras y separadores', '', { gt: 0, max: 1, auto: function (v) { var s = DESCR.sep[v.sep]; return s ? auto(s.e, 'Espesor usual para "' + s.t + '".', 'Criterio de diseño del grupo.') : null; } }),
      num('Ztce', 'Cota de la tapa de la cámara de entrada', 'm', 'Cámaras y separadores', '', { hint: 'Vacío: clave del colector de llegada + 1,20 m.', auto: function (v) { if (!has(v, ['Ze', 'De'])) return null; var z = up05(v.Ze + v.De / 1000 + 1.2); return auto(z, 'Tapa = batea llegada + De + 1,20 m = ' + fmt(v.Ze) + ' + ' + fmt(v.De / 1000, 3) + ' + 1,20 = ' + fmt(z) + ' m.', 'Criterio de diseño: 1,20 m de recubrimiento sobre la clave, valor usual bajo vías vehiculares. Confirme con la norma local.'); } }),
      num('Ztcs', 'Cota de la tapa de la cámara de salida', 'm', 'Cámaras y separadores', '', { hint: 'Vacío: clave del colector de salida + 1,20 m.', auto: function (v) { if (!has(v, ['Zs', 'Ds'])) return null; var z = up05(v.Zs + v.Ds / 1000 + 1.2); return auto(z, 'Tapa = batea salida + Ds + 1,20 m = ' + fmt(v.Zs) + ' + ' + fmt(v.Ds / 1000, 3) + ' + 1,20 = ' + fmt(z) + ' m.', 'Criterio de diseño: 1,20 m de recubrimiento sobre la clave, valor usual bajo vías vehiculares. Confirme con la norma local.'); } }),
      num('Ze', 'Cota batea colector de llegada', 'm', 'Colector de llegada', 100.2, {}),
      num('De', 'Diámetro interno de llegada', 'mm', 'Colector de llegada', 600, { gt: 0, max: 5000 }),
      num('Se', 'Pendiente de llegada', '%', 'Colector de llegada', 0.3, { gt: 0, max: 30 }),
      num('ne', 'n de Manning de llegada', '-', 'Colector de llegada', 0.013, { gt: 0, max: 0.05, auto: function () { return auto(0.013, 'Tubería de concreto: HEC-22 da 0,011 a 0,013; se toma el valor alto, del lado seguro.', 'HEC-22, Tabla 9.1, p. 140.'); } }),
      num('Zs', 'Cota batea colector de salida', 'm', 'Colector de salida', 98.6, {}),
      num('Ds', 'Diámetro interno de salida', 'mm', 'Colector de salida', 600, { gt: 0, max: 5000, auto: function (v) { return has(v, ['De']) ? auto(v.De, 'Igual al colector de llegada (' + fmt(v.De, 0) + ' mm).', 'Criterio de diseño: el colector continúa con el mismo diámetro.') : null; } }),
      num('Ss', 'Pendiente de salida', '%', 'Colector de salida', 0.3, { gt: 0, max: 30, auto: function (v) { return has(v, ['Se']) ? auto(v.Se, 'Igual a la pendiente de llegada (' + fmt(v.Se) + ' %).', 'Criterio de diseño: el colector continúa con la misma pendiente.') : null; } }),
      num('ns', 'n de Manning de salida', '-', 'Colector de salida', 0.013, { gt: 0, max: 0.05, auto: function () { return auto(0.013, 'Tubería de concreto: HEC-22 da 0,011 a 0,013; se toma el valor alto.', 'HEC-22, Tabla 9.1, p. 140.'); } }),
      num('Zci', 'Cota batea conductos en cámara de entrada', 'm', 'Trazado del sifón', 98.6, { hint: 'Debe quedar por debajo del nivel de agua para que trabaje a presión.', auto: function (v) { var b = bateaAhogada(v); return b ? auto(b.z, 'Para que el conducto mayor entre ahogado: Zs + y(Qmin) − D estimado = ' + fmt(v.Zs) + ' + ' + fmt(b.ys, 3) + ' − ' + fmt(b.Dm, 3) + ' → ' + fmt(b.z) + ' m. D estimado = √(4Q/πVmin) del mayor incremento de caudal.', 'RAS D.7.8.3, p. 186 (conducto a presión) y Res. 0330 Art. 158 num. 3.') : null; } }),
      num('Zcs', 'Cota batea conductos en cámara de salida', 'm', 'Trazado del sifón', 98.3, { auto: function (v) { var b = bateaAhogada(v); return b ? auto(b.z, 'Para que el conducto mayor descargue lleno: Zs + y(Qmin) − D estimado = ' + fmt(v.Zs) + ' + ' + fmt(b.ys, 3) + ' − ' + fmt(b.Dm, 3) + ' → ' + fmt(b.z) + ' m.', 'RAS D.7.8.3, p. 186 (conducto a presión).') : null; } }),
      num('Zf', 'Cota batea del tramo inferior', 'm', 'Trazado del sifón', 94.5, { auto: function (v) {
        if (!has(v, ['Zobs', 'recub'])) return null;
        var D = v.modo === 'manual' ? Math.max.apply(null, [v.D1, v.D2, v.D3, v.D4].slice(0, v.N || 1).filter(function (x) { return x > 0; }).concat([0])) / 1000 : (has(v, ['De']) ? v.De / 1000 : null);
        if (!D) return null;
        var z = dn05(v.Zobs - v.recub - D);
        return auto(z, 'Zf = fondo del obstáculo − recubrimiento − D = ' + fmt(v.Zobs) + ' − ' + fmt(v.recub) + ' − ' + fmt(D, 3) + ' = ' + fmt(z) + ' m' + (v.modo === 'manual' ? '' : ' (D = diámetro del colector, del lado seguro)') + '.', 'Paso bajo el obstáculo (verificación S16).');
      } }),
      num('Ld', 'Longitud horizontal del tramo que baja', 'm', 'Trazado del sifón', 20, { gt: 0, auto: function (v) { if (!has(v, ['Zci', 'Zf']) || v.Zci <= v.Zf) return null; var L = upStep((v.Zci - v.Zf) / Math.tan(22.5 * Math.PI / 180), 0.5); return auto(L, 'Mínimo para θ ≤ 22,5°: (Zci − Zf)/tan 22,5° = ' + fmt(v.Zci - v.Zf) + '/0,414 → ' + fmt(L, 1) + ' m.', 'Res. 0330/2017 Art. 158 num. 4.'); } }),
      num('Lc', 'Longitud del tramo inferior', 'm', 'Trazado del sifón', 40, { ge: 0, auto: function (v) { return has(v, ['Bobs']) ? auto(upStep(v.Bobs + 2, 0.5), 'Ancho del obstáculo + 1,0 m a cada lado = ' + fmt(v.Bobs, 1) + ' + 2 = ' + fmt(upStep(v.Bobs + 2, 0.5), 1) + ' m.', 'Criterio de diseño: el tramo inferior cubre todo el obstáculo.') : null; } }),
      num('La', 'Longitud horizontal del tramo que sube', 'm', 'Trazado del sifón', 30, { gt: 0, auto: function (v) { if (!has(v, ['Zcs', 'Zf']) || v.Zcs <= v.Zf) return null; var L = upStep((v.Zcs - v.Zf) / 0.15, 0.5); return auto(L, 'Mínimo para pendiente ≤ 15 % (y por tanto θ ≤ 22,5°): (Zcs − Zf)/0,15 = ' + fmt(v.Zcs - v.Zf) + '/0,15 → ' + fmt(L, 1) + ' m.', 'HEC-22 §8.4.3, p. 134; Res. 0330/2017 Art. 158 num. 4.'); } })
    ],
    bomba: [
      sel('sistema', 'Sistema', 'Sistema', 'alcantarillado', [{ v: 'alcantarillado', t: 'Alcantarillado (Res. 0330 Art. 160 y 161)' }, { v: 'acueducto', t: 'Acueducto (RAS Título B cap. 8)' }]),
      sel('agua', 'Agua a bombear', 'Sistema', 'residual', [{ v: 'residual', t: 'Residual' }, { v: 'lluvia', t: 'Lluvia' }], { hint: 'Fija el tiempo máximo de retención (Art. 160.8).', when: function (v) { return v.sistema === 'alcantarillado'; } }),
      num('Qd', 'Caudal de diseño de la estación', 'L/s', 'Sistema', 105, { gt: 0, hint: 'El punto de operación debe quedar cerca de este caudal.' }),
      num('T', 'Temperatura del agua', '°C', 'Sistema', 20, { min: 0, max: 50, hint: 'Pv: RAS Tabla B.6.35. Densidad y viscosidad: Tabla B.6.28.', auto: function () { return auto(20, 'Temperatura usual del agua en clima cálido.'); } }),
      num('alt', 'Altitud del sitio', 'm s.n.m.', 'Sistema', 10, { min: -100, max: 5000, hint: 'Cartagena ≈ 2 a 15 m s.n.m. La presión atmosférica sale de la atmósfera estándar.', auto: function () { return auto(0, 'Nivel del mar: da la presión atmosférica mayor; en sitios altos el NPSH disponible baja.'); } }),
      num('Znmin', 'Cota del nivel mínimo de agua en la succión', 'm', 'Cotas de succión (pozo)', 10.0, { hint: 'Nivel de apagado de las bombas.' }),
      num('Znmax', 'Cota del nivel máximo de agua en la succión', 'm', 'Cotas de succión (pozo)', 11.2, { hint: 'Nivel de arranque de las bombas.' }),
      num('Zboca', 'Cota de succión (boca de la tubería)', 'm', 'Cotas de succión (pozo)', 8.9, { auto: function (v) { if (!has(v, ['Znmin', 'Dsu'])) return null; var alc = v.sistema !== 'acueducto', S = alc ? 2.5 * v.Dsu / 1000 : Math.max(2.05 * v.Dsu / 1000, 0.5), z = dn05(v.Znmin - S); return auto(z, 'Sumergencia mínima ' + (alc ? '2,5·Ds' : 'mayor que 2·Ds y 0,50 m') + ' = ' + fmt(S, 3) + ' m: Zboca = ' + fmt(v.Znmin) + ' − ' + fmt(S, 3) + ' → ' + fmt(z) + ' m.', alc ? 'Res. 0330/2017 Art. 161 num. 7.' : 'RAS B.8.4.7.2, p. 352.'); } }),
      num('Zfondo', 'Cota del fondo del pozo', 'm', 'Cotas de succión (pozo)', 8.6, { auto: function (v) { if (!has(v, ['Zboca', 'Dsu'])) return null; var s = up05(Math.max(0.5 * v.Dsu / 1000, 0.25)), z = r05(v.Zboca - s); return auto(z, 'Separación al fondo = máx(0,5·Ds; 0,25 m) = ' + fmt(s) + ' m: Zfondo = ' + fmt(v.Zboca) + ' − ' + fmt(s) + ' = ' + fmt(z) + ' m.', 'RAS D.8.4.7.3, p. 206.'); } }),
      num('Zeje', 'Cota del eje de la bomba', 'm', 'Cotas de succión (pozo)', 9.0, { hint: 'Plano de referencia del NPSH.', auto: function (v) { if (v.tipoB === 'sumergible') return has(v, ['Zboca']) ? auto(r05(v.Zboca + 0.1), 'Bomba sumergible: eje 0,10 m sobre la boca de succión.', 'Criterio de diseño del grupo; se verifica con el NPSH (B5).') : null; return has(v, ['Znmin']) ? auto(r05(v.Znmin - 0.5), 'Bomba horizontal con succión positiva: eje 0,50 m bajo el nivel mínimo.', 'Criterio de diseño del grupo; se verifica con el NPSH (B5).') : null; } }),
      num('Zdis', 'Cota del nivel de agua en la impulsión (descarga)', 'm', 'Cotas de impulsión y descarga', 28.0, {}),
      sel('descarga', 'Forma de la descarga', 'Cotas de impulsión y descarga', 'ahogada', optsDe(DESCR.descarga), { hint: 'Fija hasta dónde se mide la altura estática.' }),
      num('Zimp', 'Cota de impulsión (eje de la salida al tanque)', 'm', 'Cotas de impulsión y descarga', '', { auto: function (v) { if (!has(v, ['Zdis', 'Dim'])) return null; var d = 0.3 + v.Dim / 2000, z = v.descarga === 'libre' ? up05(v.Zdis + d) : dn05(v.Zdis - d); return auto(z, (v.descarga === 'libre' ? 'Salida libre: nivel + 0,30 m + Di/2' : 'Salida ahogada: nivel − 0,30 m − Di/2') + ' → ' + fmt(z) + ' m.', 'Criterio de diseño del grupo.'); } }),
      sel('tanque', 'Tipo de tanque de descarga', 'Cotas de impulsión y descarga', 'quiebre', optsDe(DESCR.tanque)),
      num('Ltq', 'Largo interior del tanque de descarga', 'm', 'Cotas de impulsión y descarga', '', { gt: 0, auto: function (v) { if (!has(v, ['Dim'])) return null; var L = Math.max(1.5, upStep(6 * v.Dim / 1000, 0.1)); return auto(L, 'máx(1,5 m; 6·Di) = ' + fmt(L) + ' m, para disipar el chorro.', 'Criterio de diseño del grupo.'); } }),
      num('Btq', 'Ancho interior del tanque de descarga', 'm', 'Cotas de impulsión y descarga', '', { gt: 0, auto: function (v) { if (!has(v, ['Dim'])) return null; var B = Math.max(1.0, upStep(4 * v.Dim / 1000, 0.1)); return auto(B, 'máx(1,0 m; 4·Di) = ' + fmt(B) + ' m.', 'Criterio de diseño del grupo.'); } }),
      num('Zftq', 'Cota del fondo del tanque de descarga', 'm', 'Cotas de impulsión y descarga', '', { auto: function (v) { if (!has(v, ['Zdis', 'Zimp', 'Dim'])) return null; var z = dn05(Math.min(v.Zimp - v.Dim / 2000 - 0.3, v.Zdis - 0.6)); return auto(z, 'El menor entre (salida − Di/2 − 0,30 m) y (nivel − 0,60 m) → ' + fmt(z) + ' m.', 'Criterio de diseño del grupo.'); } }),
      sel('mat', 'Material de las tuberías', 'Material', 'pvc', matOptions(), { hint: 'Carga ks (Tabla B.6.29) y E (Tabla B.6.36).' }),
      sel('fric', 'Ecuación de fricción', 'Material', 'darcy', [{ v: 'darcy', t: 'Darcy-Weisbach con Colebrook-White' }, { v: 'hazen', t: 'Hazen-Williams' }], { hint: 'Ambas admitidas por RAS B.8.5.2.' }),
      num('ks', 'Rugosidad absoluta ks', 'mm', 'Material', 0.0015, { ge: 0, max: 10, when: function (v) { return v.fric === 'darcy'; }, auto: autoMat('ks', 'RAS Título B, Tabla B.6.29, p. 169.') }),
      num('C', 'Coeficiente C de Hazen-Williams', '-', 'Material', 150, { gt: 0, max: 200, when: function (v) { return v.fric === 'hazen'; }, auto: autoMat('C', 'Valor usual del material; confirme con el fabricante.') }),
      sel('kmodo', 'Pérdidas menores', 'Material', 'acc', [{ v: 'acc', t: 'Calcular ΣK con los accesorios' }, { v: 'manual', t: 'Escribir ΣK directamente' }]),
      num('Dsu', 'Diámetro interno de succión', 'mm', 'Tubería de succión (una por bomba)', 350, { gt: 0, max: 3000, auto: function (v) { if (!has(v, ['Qd', 'nAct', 'Dim'])) return null; var Vo = v.sistema === 'acueducto' ? 1.0 : 1.2, d1 = up10mm(dEstimado(v.Qd / 1000 / v.nAct, Vo)), d = Math.max(d1, v.Dim + 50); return auto(d, 'Para V = ' + fmt(Vo, 1) + ' m/s con Qd/n = ' + fmt(v.Qd / v.nAct, 1) + ' L/s: √(4Q/πV) → ' + d1 + ' mm; y Ds ≥ Di + 50 = ' + fmt(v.Dim + 50, 0) + ' mm → ' + d + ' mm.', 'Res. 0330/2017 Art. 161 num. 2; RAS D.8.4.8.1, p. 207.'); } }),
      num('Lsu', 'Longitud de succión', 'm', 'Tubería de succión (una por bomba)', 8, { gt: 0 }),
      num('accSu', 'Accesorios de la succión', '', 'Tubería de succión (una por bomba)', ACC_SU_DEF, { type: 'acc', en: 'su', when: function (v) { return v.kmodo !== 'manual'; } }),
      num('Ksu', 'ΣK de succión', '-', 'Tubería de succión (una por bomba)', 3.0, { ge: 0, hint: 'Por bomba: entrada, codos, válvula, reducción.', when: function (v) { return v.kmodo === 'manual'; } }),
      num('Dim', 'Diámetro interno de impulsión', 'mm', 'Tubería de impulsión (común)', 250, { gt: 0, max: 3000, auto: function (v) { if (!has(v, ['Qd'])) return null; var d = up10mm(dEstimado(v.Qd / 1000, 2.0)); return auto(d, 'Para V = 2,0 m/s, centro del rango 1,5 a 2,4 m/s: √(4·' + fmt(v.Qd / 1000, 4) + '/(π·2,0)) → ' + d + ' mm.', 'Res. 0330/2017 Art. 161 num. 3.'); } }),
      num('Lim', 'Longitud de impulsión', 'm', 'Tubería de impulsión (común)', 450, { gt: 0 }),
      num('accIm', 'Accesorios de la impulsión', '', 'Tubería de impulsión (común)', ACC_IM_DEF, { type: 'acc', en: 'im', when: function (v) { return v.kmodo !== 'manual'; } }),
      num('Kim', 'ΣK de impulsión', '-', 'Tubería de impulsión (común)', 8.0, { ge: 0, hint: 'Sin contar la salida: Hv se suma aparte (HEC-22 Ec. 12.1).', when: function (v) { return v.kmodo === 'manual'; } }),
      num('nInst', 'Bombas instaladas', 'und', 'Bombas', 2, { min: 1, max: 12, integer: true }),
      num('nAct', 'Bombas en paralelo en operación', 'und', 'Bombas', 1, { min: 1, max: 8, integer: true }),
      num('nSer', 'Bombas en serie por línea', 'und', 'Bombas', 1, { min: 1, max: 4, integer: true, hint: 'En serie se suman las alturas; en paralelo, los caudales.' }),
      num('etaM', 'Eficiencia del motor', '%', 'Bombas', 93, { gt: 0, max: 100, auto: function () { return auto(93, 'Motor de eficiencia alta (IE3) de potencia media.', 'Valor genérico: use el dato de placa del motor.'); } }),
      sel('tipoB', 'Tipo de bomba', 'Bombas', 'sumergible', [{ v: 'sumergible', t: 'Sumergible' }, { v: 'horizontal', t: 'Horizontal o vertical' }], { hint: 'Fija los arranques por hora (RAS D.8.4.7.1).' }),
      sel('vfd', '¿Motor con variador (≥ 40 Hz)?', 'Bombas', 'si', [{ v: 'si', t: 'Sí' }, { v: 'no', t: 'No' }], { when: function (v) { return v.sistema === 'alcantarillado'; } }),
      sel('respaldo', '¿Respaldo energético ≥ 12 h?', 'Bombas', 'si', [{ v: 'si', t: 'Sí' }, { v: 'no', t: 'No' }], { when: function (v) { return v.sistema === 'alcantarillado'; } }),
      num('curva', 'Curva suministrada Q, H, η, NPSHr', 'L/s, m, %, m', 'Bombas', '0, 36, 0, 2.0\n30, 35, 45, 2.3\n60, 33, 65, 2.8\n90, 29.5, 76, 3.5\n120, 25, 78, 4.6\n150, 19, 70, 6.2', { type: 'curve', hint: 'Una fila por punto, mínimo 3. Es la curva de catálogo de UNA bomba.' }),
      num('E', 'Módulo de elasticidad de la tubería', 'GPa', 'Golpe de ariete', 2.75, { gt: 0, max: 400, auto: autoMat('E', 'RAS Título B, Tabla B.6.36, p. 181.') }),
      num('nu', 'Relación de Poisson', '-', 'Golpe de ariete', 0.40, { ge: 0, lt: 0.5, auto: autoMat('nu', 'Valor usual del material.') }),
      num('esp', 'Espesor de pared', 'mm', 'Golpe de ariete', 12, { gt: 0, max: 200 }),
      num('Tc', 'Tiempo de cierre o maniobra', 's', 'Golpe de ariete', 30, { gt: 0, hint: 'Rápido si T ≤ 2L/a: se aplica Joukowsky.' }),
      num('PN', 'Presión admisible de la tubería', 'm.c.a.', 'Golpe de ariete', 100, { gt: 0 }),
      num('LB', 'Largo del pozo húmedo', 'm', 'Pozo húmedo', 8, { gt: 0, auto: function (v) { var p = pozoAuto(v); return p ? auto(p.L, p.how + ' Largo = A/B = ' + fmt(p.A) + '/' + fmt(p.B, 1) + ' → ' + fmt(p.L, 1) + ' m.', 'Res. 0330/2017 Art. 160 num. 7.') : null; } }),
      num('BB', 'Ancho del pozo húmedo', 'm', 'Pozo húmedo', 4, { gt: 0, auto: function (v) { var p = pozoAuto(v); return p ? auto(p.B, p.how + ' Ancho = √(A/2) → ' + fmt(p.B, 1) + ' m (pozo de largo doble del ancho).', 'Res. 0330/2017 Art. 160 num. 7.') : null; } }),
      num('Dla', 'Diámetro de la tubería de llegada al pozo', 'mm', 'Pozo húmedo', 450, { gt: 0, max: 5000, auto: function (v) { if (!has(v, ['Qd'])) return null; var Vo = v.sistema === 'acueducto' ? 0.6 : 0.65, d = Math.round(dEstimado(v.Qd / 1000, Vo) * 100) * 10; return auto(d, 'Para V = ' + fmt(Vo) + ' m/s: √(4Q/πV) → ' + d + ' mm.', v.sistema === 'acueducto' ? 'RAS B.8.4.7.4, p. 353.' : 'Res. 0330/2017 Art. 160 num. 6; RAS D.8.4.7.4, p. 207.'); } })
    ]
  };
  function pozoAuto(v) {
    if (!has(v, ['Qd', 'Znmin', 'Znmax']) || !(v.Znmax > v.Znmin)) return null;
    var h = v.Znmax - v.Znmin, Vr = 2.5 * (v.Qd * 1.25 / 1000 * 60), A = Vr / h;
    var B = upStep(Math.sqrt(A / 2), 0.1), L = upStep(A / B, 0.1);
    return { A: A, B: B, L: L, how: 'Volumen = 2,5·(1,25·Qd en m³/min) = ' + fmt(Vr) + ' m³; área = V/(Nmáx − Nmín) = ' + fmt(Vr) + '/' + fmt(h) + ' = ' + fmt(A) + ' m² (el 1,25 cubre que el bombeo supere a Qd).' };
  }

  function defaults(mod) {
    var o = {};
    FIELDS[mod].forEach(function (f) { o[f.k] = f.def; });
    return o;
  }

  /* ---------- Utilidades numéricas ---------- */
  function fmt(x, d) {
    if (x === null || x === undefined || !isFinite(x)) return '—';
    return Number(x).toFixed(d === undefined ? 2 : d).replace('.', ',');
  }
  function parseNum(s) {
    if (typeof s === 'number') return s;
    if (s === null || s === undefined) return NaN;
    var t = String(s).trim();
    if (t === '') return NaN;
    t = t.replace(/\s/g, '');
    if (t.indexOf(',') >= 0 && t.indexOf('.') < 0) t = t.replace(',', '.');
    if (!/^[-+]?(\d+\.?\d*|\.\d+)([eE][-+]?\d+)?$/.test(t)) return NaN;
    return parseFloat(t);
  }
  function interpTable(tab, x) {
    if (x <= tab[0][0]) return tab[0].slice(1);
    for (var i = 1; i < tab.length; i++) {
      if (x <= tab[i][0]) {
        var t = (x - tab[i - 1][0]) / (tab[i][0] - tab[i - 1][0]);
        return tab[i].slice(1).map(function (v, j) { return tab[i - 1][j + 1] + t * (v - tab[i - 1][j + 1]); });
      }
    }
    return tab[tab.length - 1].slice(1);
  }
  var TAB_AGUA = [[0, 999.9, 1.792], [5, 1000.0, 1.519], [10, 999.7, 1.308], [15, 999.1, 1.140], [20, 998.2, 1.005], [30, 995.7, 0.801], [40, 992.2, 0.656], [50, 988.1, 0.549]];
  var TAB_PV = [[0, 0.61], [5, 0.87], [10, 1.23], [15, 1.70], [20, 2.34], [25, 3.17], [30, 4.24], [40, 7.38], [50, 12.33]];
  function agua(T) {
    var r = interpTable(TAB_AGUA, T);
    var pv = interpTable(TAB_PV, T)[0];
    return { rho: r[0], mu: r[1] * 1e-3, nu: r[1] * 1e-3 / r[0], pv: pv * 1000, gamma: r[0] * G };
  }
  function areaC(Dm) { return Math.PI * Dm * Dm / 4; }
  function colebrook(Re, D, ks) {
    if (Re <= 0) return 0.02;
    if (Re < 2000) return 64 / Re;
    var fTurb = function (R) {
      var f = 0.25 / Math.pow(Math.log10(ks / (3.7 * D) + 5.74 / Math.pow(R, 0.9)), 2);
      for (var i = 0; i < 60; i++) {
        var nf = 1 / Math.pow(-2 * Math.log10(ks / (3.7 * D) + 2.51 / (R * Math.sqrt(f))), 2);
        if (Math.abs(nf - f) < 1e-10) { f = nf; break; }
        f = nf;
      }
      return f;
    };
    if (Re >= 4000) return fTurb(Re);
    var t = (Re - 2000) / 2000;
    return (1 - t) * (64 / 2000) + t * fTurb(4000);
  }
  function normalDepth(Q, Dm, n, S) {
    var A = function (y) { var th = 2 * Math.acos(1 - 2 * y / Dm); return Dm * Dm / 8 * (th - Math.sin(th)); };
    var P = function (y) { return Dm * Math.acos(1 - 2 * y / Dm); };
    var Qy = function (y) { var a = A(y); return (1 / n) * a * Math.pow(a / P(y), 2 / 3) * Math.sqrt(S); };
    var ymax = 0.938 * Dm;
    var Qfull = (1 / n) * areaC(Dm) * Math.pow(Dm / 4, 2 / 3) * Math.sqrt(S);
    if (Q >= Qy(ymax)) return { y: Dm, V: Q / areaC(Dm), lleno: true, Qfull: Qfull, rel: Q / Qfull };
    var lo = 1e-6 * Dm, hi = ymax;
    for (var i = 0; i < 80; i++) { var m = (lo + hi) / 2; if (Qy(m) < Q) lo = m; else hi = m; }
    var y = (lo + hi) / 2;
    return { y: y, V: Q / A(y), lleno: false, Qfull: Qfull, rel: Q / Qfull };
  }
  function comercialInicial(lista) {
    return String(lista).split(/[;,\s]+/).map(parseNum).filter(function (x) { return x > 0; }).sort(function (a, b) { return a - b; });
  }

  /* ---------- Validación de entradas ---------- */
  function validate(mod, vals) {
    var out = { values: {}, missing: {}, invalid: {}, auto: {} };
    FIELDS[mod].forEach(function (f) {
      if (f.when && !f.when(vals)) { out.values[f.k] = null; return; }
      var raw = vals[f.k];
      if (f.type === 'sel' || f.type === 'text' || f.type === 'curve' || f.type === 'acc') {
        if (raw === undefined || raw === null || String(raw).trim() === '') out.missing[f.k] = f;
        else out.values[f.k] = raw;
        return;
      }
      if (raw === undefined || raw === null || String(raw).trim() === '') { out.missing[f.k] = f; return; }
      var x = parseNum(raw);
      var why = null;
      if (isNaN(x)) why = 'no es un número (se recibió "' + String(raw).slice(0, 20) + '")';
      else if (f.gt !== undefined && !(x > f.gt)) why = 'debe ser mayor que ' + f.gt;
      else if (f.ge !== undefined && !(x >= f.ge)) why = 'no puede ser menor que ' + f.ge;
      else if (f.lt !== undefined && !(x < f.lt)) why = 'debe ser menor que ' + f.lt;
      else if (f.min !== undefined && x < f.min) why = 'debe ser al menos ' + f.min;
      else if (f.max !== undefined && x > f.max) why = 'no puede superar ' + f.max;
      else if (f.integer && Math.floor(x) !== x) why = 'debe ser un número entero';
      if (why) out.invalid[f.k] = { field: f, why: why };
      else out.values[f.k] = x;
    });
    /* Datos vacíos que se pueden completar con la norma o con un valor genérico.
       Se repite hasta que no se complete nada más, porque unos dependen de otros. */
    for (var pass = 0; pass < 6; pass++) {
      var avance = false;
      FIELDS[mod].forEach(function (f) {
        if (!f.auto || !out.missing[f.k]) return;
        var a = f.auto(out.values, vals);
        if (!a || a.v === undefined || a.v === null || !isFinite(a.v)) return;
        delete out.missing[f.k];
        out.values[f.k] = a.v;
        out.auto[f.k] = { field: f, v: a.v, how: a.how, src: a.src };
        avance = true;
      });
      if (!avance) break;
    }
    return out;
  }
  function usable(v, k) { return v.values[k] !== undefined && !v.missing[k] && !v.invalid[k]; }

  /* ---------- Hidráulica del sifón ---------- */
  function perdidasConducto(b, V, c, metodo) {
    var D = b.D / 1000, g2 = V * V / (2 * G), A2 = areaC(D);
    var Re = V * D / c.nu, f = colebrook(Re, D, c.ks / 1000), r = { Re: Re, f: f };
    if (metodo === 'RAS') {
      r.he = 1.1 * g2;
      r.hc = 0.1316 * (c.sumAlpha / 90) * g2;
      r.hf = f * (c.L / D) * g2;
      r.hs = Math.max(0, (c.A3 / A2) - 1) * g2;
    } else {
      r.he = 0.2 * g2;
      r.hc = 0.0033 * c.sumAlpha * g2;
      var Sf = Math.pow((V * A2) * c.n / (0.312 * Math.pow(D, 8 / 3)), 2);
      r.hf = Sf * c.L;
      r.hs = Math.max(0, g2 - (c.Vd || 0) * (c.Vd || 0) / (2 * G));
    }
    r.hL = r.he + r.hc + r.hf + r.hs;
    r.Sf = r.hf / c.L;
    r.tau = c.gamma * (D / 4) * r.Sf;
    r.V = V;
    r.Q = V * A2;
    return r;
  }
  function repartir(activos, Q, c, metodo) {
    if (activos.length === 1) return [perdidasConducto(activos[0], Q / areaC(activos[0].D / 1000), c, metodo)];
    var At = activos.reduce(function (t, b) { return t + areaC(b.D / 1000); }, 0);
    var Vs = activos.map(function () { return Q / At; }), h = 0;
    for (var i = 0; i < 40; i++) {
      var Ks = activos.map(function (b, j) { return perdidasConducto(b, Vs[j], c, metodo).hL / (Vs[j] * Vs[j] / (2 * G)); });
      var s = activos.reduce(function (t, b, j) { return t + areaC(b.D / 1000) * Math.sqrt(2 * G / Ks[j]); }, 0);
      h = Math.pow(Q / s, 2);
      Vs = Ks.map(function (k) { return Math.sqrt(2 * G * h / k); });
    }
    return activos.map(function (b, j) { return perdidasConducto(b, Vs[j], c, metodo); });
  }
  /* Tope de caudal de cada conducto con entrada regulada por vertederos (incrementos). */
  function topes(bb, Q, base, metodo, disp) {
    var N = bb.length;
    if (N === 1) return [Infinity];
    if (N === 2) {
      var h = perdidasConducto(bb[0], Q[1] / areaC(bb[0].D / 1000), base(1), metodo).hL;
      return [h < disp(1) ? Q[1] : Q[0], Infinity];
    }
    if (N === 3) return [Q[0], Q[1] - Q[0], Infinity];
    return [Q[0], Q[1] - Q[0], (Q[2] - Q[1]) / 2, Infinity];
  }
  function asignar(bb, tp, q, base, metodo) {
    var rem = q, out = [];
    bb.forEach(function (b, i) {
      var x = Math.min(tp[i], rem);
      if (x > 1e-9) { out.push(perdidasConducto(b, x / areaC(b.D / 1000), base, metodo)); rem -= x; }
    });
    return out;
  }
  function gobierna(res) {
    var g = 0;
    res.forEach(function (r, i) { if (r.hL > res[g].hL) g = i; });
    return g;
  }
  function dispEnergia(v, c, i) {
    return (v.Ze + c.ent[i].y + c.ent[i].V * c.ent[i].V / (2 * G)) - (v.Zs + c.sal[i].y + c.sal[i].V * c.sal[i].V / (2 * G));
  }
  function dMaxParaV(Qm3, V) { return Math.sqrt(4 * Qm3 / (Math.PI * V)) * 1000; }

  function limitesSifon(tipo) {
    return tipo === 'pluvial'
      ? { Vmin: 1.2, Dmin: 280, DminRas: 300, tau: 2.0, artTau: 'Art. 149' , artVmax: 'Art. 150' }
      : { Vmin: 1.0, Dmin: 170, DminRas: 200, tau: 1.0, artTau: 'Art. 141', artVmax: 'Art. 142' };
  }

  function etapaActivos(N, caso, hL1Med, disponible) {
    if (caso === 0) return 1;
    if (caso === 2) return N;
    if (N === 2 && hL1Med !== undefined) return hL1Med <= disponible ? 1 : 2;
    return Math.min(2, N);
  }

  /* ---------- Cadena de cálculo: sifón ---------- */
  var STEPS_SIFON = [
    {
      id: 'agua', title: 'Propiedades del agua', inputs: ['T'], deps: [], src: 'RAS Título B, Tabla B.6.28, p. 168',
      run: function (v, c) {
        c.w = agua(v.T);
        return {
          value: 'ν = ' + (c.w.nu * 1e6).toFixed(3).replace('.', ',') + '×10⁻⁶ m²/s',
          lines: ['Interpolación a T = ' + fmt(v.T, 1) + ' °C: ρ = ' + fmt(c.w.rho, 1) + ' kg/m³, μ = ' + fmt(c.w.mu * 1000, 3) + '×10⁻³ Pa·s', 'ν = μ/ρ = ' + (c.w.nu * 1e6).toFixed(3).replace('.', ',') + '×10⁻⁶ m²/s;  γ = ρ·g = ' + fmt(c.w.gamma, 0) + ' N/m³']
        };
      }
    },
    {
      id: 'lim', title: 'Límites según el tipo de red', inputs: ['tipo'], deps: [], src: 'Res. 0330/2017 Art. 158 num. 2 y 3',
      run: function (v, c) {
        c.lim = limitesSifon(v.tipo);
        return { value: 'V ≥ ' + fmt(c.lim.Vmin, 1) + ' m/s, D ≥ ' + c.lim.Dmin + ' mm', lines: ['Red ' + v.tipo + ': V mínima = ' + fmt(c.lim.Vmin, 1) + ' m/s; D interno real mínimo = ' + c.lim.Dmin + ' mm; τ mínimo = ' + fmt(c.lim.tau, 1) + ' Pa (' + c.lim.artTau + ')'] };
      }
    },
    {
      id: 'obstaculo', title: 'Obstáculo que se cruza', inputs: ['obst', 'Zobs', 'Znivel', 'Bobs', 'recub'], deps: [], src: 'Res. 0330/2017 Art. 158; recubrimiento por criterio de diseño (RAS D.2.7.4 para otras redes)',
      run: function (v, c) {
        var o = DESCR.obst[v.obst];
        c.obs = { tipo: v.obst, t: o.t, d: o.d, recub: v.recub, zmax: v.Zobs - v.recub };
        return {
          value: o.t + ', ancho ' + fmt(v.Bobs, 1) + ' m',
          lines: [o.t + ': ' + o.d, 'Fondo (' + o.zobs + ') = ' + fmt(v.Zobs) + ' m; superficie (' + o.znivel + ') = ' + fmt(v.Znivel) + ' m; ancho = ' + fmt(v.Bobs, 1) + ' m',
            'Cota máxima de la clave del tramo inferior = ' + fmt(v.Zobs) + ' − ' + fmt(v.recub) + ' = ' + fmt(c.obs.zmax) + ' m']
        };
      }
    },
    {
      id: 'geom', title: 'Geometría del trazado', inputs: ['Zci', 'Zcs', 'Zf', 'Ld', 'Lc', 'La'], deps: [], src: 'Geometría; ángulos para D.7.41 (RAS D.7.8.3)',
      run: function (v, c) {
        var dzB = v.Zci - v.Zf, dzS = v.Zcs - v.Zf;
        if (dzB <= 0 || dzS <= 0) throw calcError('La cota del tramo inferior (' + fmt(v.Zf) + ' m) debe estar por debajo de las bateas en las cámaras (' + fmt(v.Zci) + ' y ' + fmt(v.Zcs) + ' m).', 'Baje la cota del tramo inferior o suba las bateas de los conductos en las cámaras.');
        var Lb = Math.hypot(v.Ld, dzB), Ls = Math.hypot(v.La, dzS);
        c.g = {
          dzB: dzB, dzS: dzS, Lb: Lb, Ls: Ls, L: Lb + v.Lc + Ls,
          thB: Math.atan(dzB / v.Ld) * 180 / Math.PI, thS: Math.atan(dzS / v.La) * 180 / Math.PI,
          pS: dzS / v.La * 100, pB: dzB / v.Ld * 100
        };
        c.g.sumAlpha = 2 * c.g.thB + 2 * c.g.thS;
        return {
          value: 'L = ' + fmt(c.g.L) + ' m',
          lines: [
            'Tramo que baja: √(' + fmt(v.Ld) + '² + ' + fmt(dzB) + '²) = ' + fmt(Lb) + ' m;  θ = atan(' + fmt(dzB) + '/' + fmt(v.Ld) + ') = ' + fmt(c.g.thB, 1) + '°',
            'Tramo que sube: √(' + fmt(v.La) + '² + ' + fmt(dzS) + '²) = ' + fmt(Ls) + ' m;  θ = ' + fmt(c.g.thS, 1) + '° (' + fmt(c.g.pS, 1) + ' %)',
            'L total = ' + fmt(Lb) + ' + ' + fmt(v.Lc) + ' + ' + fmt(Ls) + ' = ' + fmt(c.g.L) + ' m',
            'Σα (4 cambios de dirección) = 2·' + fmt(c.g.thB, 1) + ' + 2·' + fmt(c.g.thS, 1) + ' = ' + fmt(c.g.sumAlpha, 1) + '°'
          ]
        };
      }
    },
    {
      id: 'caudales', title: 'Caudales de diseño', inputs: ['Qmin', 'Qmed', 'Qmax'], deps: [], src: 'Guía AA-PF-01 Tabla 1; RAS D.7.8.3',
      run: function (v, c) {
        if (!(v.Qmin <= v.Qmed && v.Qmed <= v.Qmax)) throw calcError('Los caudales deben cumplir Qmin ≤ Qmed ≤ Qmax (se recibió ' + v.Qmin + ', ' + v.Qmed + ', ' + v.Qmax + ' L/s).', 'Ordene los caudales de menor a mayor.');
        c.Q = [v.Qmin / 1000, v.Qmed / 1000, v.Qmax / 1000];
        return { value: fmt(v.Qmin, 0) + ' / ' + fmt(v.Qmed, 0) + ' / ' + fmt(v.Qmax, 0) + ' L/s', lines: ['Incrementos: ' + fmt(v.Qmin, 1) + '; ' + fmt(v.Qmed - v.Qmin, 1) + '; ' + fmt(v.Qmax - v.Qmed, 1) + ' L/s'] };
      }
    },
    {
      id: 'colectores', title: 'Flujo en colectores de llegada y salida', inputs: ['Ze', 'De', 'Se', 'ne', 'Zs', 'Ds', 'Ss', 'ns'], deps: ['caudales'], src: 'HEC-22 Ec. 9.1 y 9.2, p. 138 (Manning)',
      run: function (v, c) {
        c.ent = c.Q.map(function (q) { return normalDepth(q, v.De / 1000, v.ne, v.Se / 100); });
        c.sal = c.Q.map(function (q) { return normalDepth(q, v.Ds / 1000, v.ns, v.Ss / 100); });
        var n = ['Qmin', 'Qmed', 'Qmax'];
        return {
          value: 'y salida a Qmax = ' + fmt(c.sal[2].y) + ' m',
          lines: n.map(function (k, i) { return k + ': llegada y = ' + fmt(c.ent[i].y, 3) + ' m, V = ' + fmt(c.ent[i].V) + ' m/s;  salida y = ' + fmt(c.sal[i].y, 3) + ' m, V = ' + fmt(c.sal[i].V) + ' m/s' + (c.sal[i].lleno ? ' (salida a tubo lleno)' : ''); })
        };
      }
    },
    {
      id: 'conductos', title: 'Número y diámetro de conductos', inputs: ['modo', 'reparto', 'hw', 'lista', 'N', 'D1', 'D2', 'D3', 'D4', 'metodo', 'ks', 'n', 'Ds'], deps: ['agua', 'lim', 'caudales', 'geom', 'colectores'], src: 'Res. 0330/2017 Art. 158 num. 1 a 3, 5 y 8; RAS D.7.8.1 a D.7.8.3, p. 186',
      run: function (v, c) {
        var bs = [], lines = [];
        if (v.modo === 'manual') {
          for (var i = 1; i <= v.N; i++) bs.push({ id: i, D: v['D' + i] });
          lines.push('Diámetros fijados por el usuario: ' + bs.map(function (b) { return 'D' + b.id + ' = ' + fmt(b.D, 0) + ' mm'; }).join(', '));
          c.bs = bs;
          return { value: bs.length + ' conducto(s): ' + bs.map(function (b) { return 'Ø' + fmt(b.D, 0); }).join(' + ') + ' mm', lines: lines };
        }
        var lista = comercialInicial(v.lista).filter(function (d) { return d >= c.lim.Dmin; });
        if (!lista.length) throw calcError('Ningún diámetro de la lista alcanza el mínimo de ' + c.lim.Dmin + ' mm.', 'Agregue diámetros iguales o mayores a ' + c.lim.Dmin + ' mm a la lista.');
        var dmax1 = dMaxParaV(c.Q[0], c.lim.Vmin);
        var dmaxT = dMaxParaV(c.Q[2], c.lim.Vmin);
        lines.push('Regla para Qmin: D1 ≤ √(4Q/πV) = √(4·' + fmt(c.Q[0], 4) + '/(π·' + fmt(c.lim.Vmin, 1) + ')) = ' + fmt(dmax1, 0) + ' mm');
        lines.push('Regla para Qmax: el área total no debe superar Qmax/V, equivalente a un conducto de ' + fmt(dmaxT, 0) + ' mm');
        var base = function (i) { return { nu: c.w.nu, gamma: c.w.gamma, ks: v.ks, n: v.n, L: c.g.L, sumAlpha: c.g.sumAlpha, A3: areaC(v.Ds / 1000), Vd: c.sal[i].V }; };
        var disp = function (i) { return dispEnergia(v, c, i); };
        var evaluar = function (ds) {
          var bb = ds.map(function (d, i) { return { id: i + 1, D: d }; });
          var viol = 0, hmax = 0, vmin = Infinity;
          var tp = v.reparto === 'vert' ? topes(bb, c.Q, base, v.metodo, disp) : null;
          for (var i = 0; i < 3; i++) {
            var r;
            if (tp) r = asignar(bb, tp, c.Q[i], base(i), v.metodo);
            else {
              var h1 = bb.length === 2 ? repartir([bb[0]], c.Q[i], base(i), v.metodo)[0].hL : undefined;
              r = repartir(bb.slice(0, etapaActivos(bb.length, i, h1, disp(i))), c.Q[i], base(i), v.metodo);
            }
            r.forEach(function (x) { if (x.V < c.lim.Vmin) viol += 1 + (c.lim.Vmin - x.V); vmin = Math.min(vmin, x.V); });
            var hq = r[gobierna(r)].hL + (tp && r.length > 1 ? v.hw : 0);
            if (hq >= disp(i)) viol += 1 + (hq - disp(i));
            hmax = Math.max(hmax, hq);
          }
          return { ds: ds, viol: viol, hmax: hmax, vmin: vmin };
        };
        var cands1 = lista.filter(function (d) { return d <= dmax1; }).slice(-3);
        if (!cands1.length) cands1 = [lista[0]];
        var areaMax = areaC(dmaxT / 1000) * 1.6;
        var prob = [], total = 0;
        cands1.forEach(function (d1) {
          lista.forEach(function (d2) {
            if (d2 < d1) return;
            if (areaC(d1 / 1000) + areaC(d2 / 1000) <= areaMax) { prob.push(evaluar([d1, d2])); total++; }
            lista.forEach(function (d3) {
              if (d3 < d2) return;
              if (areaC(d1 / 1000) + areaC(d2 / 1000) + areaC(d3 / 1000) <= areaMax) { prob.push(evaluar([d1, d2, d3])); total++; }
            });
          });
        });
        if (!prob.length) prob.push(evaluar([lista[0], lista[0]]));
        prob.sort(function (a, b) {
          if (Math.abs(a.viol - b.viol) > 1e-9) return a.viol - b.viol;
          if (a.ds.length !== b.ds.length) return a.ds.length - b.ds.length;
          return a.hmax - b.hmax;
        });
        var best = prob[0];
        c.alternativas = prob.slice(0, 6);
        bs = best.ds.map(function (d, i) { return { id: i + 1, D: d }; });
        lines.push('Se evaluaron ' + Math.max(total, 1) + ' combinaciones con los tres caudales' + (v.reparto === 'vert' ? ', con entrada regulada por vertederos.' : ', repartiendo con igual pérdida entre conductos.'));
        lines.push(best.viol === 0
          ? 'Escogida: ' + best.ds.map(function (d) { return 'Ø' + d; }).join(' + ') + ' mm. Es la de menos conductos que cumple V mínima y energía; V menor = ' + fmt(best.vmin) + ' m/s, H máx = ' + fmt(best.hmax, 3) + ' m.'
          : 'Ninguna combinación cumple todo. La menos desfavorable es ' + best.ds.map(function (d) { return 'Ø' + d; }).join(' + ') + ' mm; revise las advertencias.');
        c.bs = bs;
        return { value: bs.length + ' conductos: ' + bs.map(function (b) { return 'Ø' + fmt(b.D, 0); }).join(' + ') + ' mm', lines: lines };
      }
    },
    {
      id: 'hid', title: 'Velocidades y pérdidas por caudal', inputs: ['metodo', 'ks', 'n', 'Ds'], deps: ['agua', 'geom', 'conductos', 'colectores'], src: 'RAS D.7.39 a D.7.43, p. 186-187; HEC-22 Ec. 9.3 a 9.6, p. 144-145',
      run: function (v, c) {
        var base = function (i) { return { nu: c.w.nu, gamma: c.w.gamma, ks: v.ks, n: v.n, L: c.g.L, sumAlpha: c.g.sumAlpha, A3: areaC(v.Ds / 1000), Vd: c.sal[i].V }; };
        var nombres = ['Qmin', 'Qmed', 'Qmax'];
        var dispo = function (i) { return dispEnergia(v, c, i); };
        var N = c.bs.length;
        var lines = [];
        var vert = v.reparto === 'vert';
        var tp = vert ? topes(c.bs, c.Q, base, v.metodo, dispo) : null;
        var tpAlt = vert ? topes(c.bs, c.Q, base, v.metodo === 'RAS' ? 'HEC' : 'RAS', dispo) : null;
        c.topes = tp;
        if (vert) lines.push('Tope de cada conducto: ' + tp.map(function (t, i) { return 'Q' + (i + 1) + ' = ' + (isFinite(t) ? fmt(t * 1000, 1) + ' L/s' : 'el resto'); }).join('; '));
        c.casos = c.Q.map(function (q, i) {
          var res, alt, k;
          if (vert) {
            res = asignar(c.bs, tp, q, base(i), v.metodo);
            alt = asignar(c.bs, tpAlt, q, base(i), v.metodo === 'RAS' ? 'HEC' : 'RAS');
            k = res.length;
          } else {
            k = etapaActivos(N, i, N === 2 ? repartir([c.bs[0]], q, base(i), v.metodo)[0].hL : undefined, dispo(i));
            res = repartir(c.bs.slice(0, k), q, base(i), v.metodo);
            alt = repartir(c.bs.slice(0, k), q, base(i), v.metodo === 'RAS' ? 'HEC' : 'RAS');
          }
          var act = c.bs.slice(0, k), g = gobierna(res);
          lines.push(nombres[i] + ' = ' + fmt(q * 1000, 1) + ' L/s, ' + k + ' conducto(s) en servicio:');
          res.forEach(function (r, j) {
            var D = act[j].D / 1000;
            lines.push('  Conducto ' + (j + 1) + ' (Ø' + fmt(act[j].D, 0) + '): Q = ' + fmt(r.Q * 1000, 1) + ' L/s; A = πD²/4 = ' + fmt(areaC(D), 4) + ' m²; V = Q/A = ' + fmt(r.V) + ' m/s; V²/2g = ' + fmt(r.V * r.V / (2 * G), 4) + ' m');
            lines.push('    Re = VD/ν = ' + Math.round(r.Re).toLocaleString('es-CO') + '; f = ' + fmt(r.f, 4));
            lines.push('    he = ' + fmt(r.he, 3) + '; hc = ' + fmt(r.hc, 3) + '; hf = ' + fmt(r.hf, 3) + '; hs = ' + fmt(r.hs, 3) + ' → H = ' + fmt(r.hL, 3) + ' m; τ = ' + fmt(r.tau) + ' Pa');
          });
          lines.push('  Gobierna el conducto ' + (g + 1) + ': H = ' + fmt(res[g].hL, 3) + ' m');
          return { key: nombres[i], Q: q, k: k, barrels: res, act: act, gov: g, hL: res[g].hL, hLalt: alt[gobierna(alt)].hL, disp: dispo(i) };
        });
        var w = c.casos[2];
        return { value: 'H(Qmax) = ' + fmt(w.hL, 3) + ' m; V = ' + w.barrels.map(function (b) { return fmt(b.V); }).join(' / ') + ' m/s', lines: lines };
      }
    },
    {
      id: 'niveles', title: 'Niveles en cámaras y línea de energía', inputs: ['Ze', 'Zs', 'Zci', 'Zcs'], deps: ['hid'], src: 'Res. 0330/2017 Art. 158 num. 8; HEC-22 Ec. 9.12, p. 151',
      run: function (v, c) {
        var lines = [];
        c.casos.forEach(function (o, i) {
          var Ve = c.ent[i], Vs = c.sal[i];
          o.NAs = v.Zs + Vs.y;
          o.Es = o.NAs + Vs.V * Vs.V / (2 * G);
          o.Ee_disp = v.Ze + Ve.y + Ve.V * Ve.V / (2 * G);
          o.hw = (v.reparto === 'vert' && o.k > 1) ? v.hw : 0;
          o.Ee_req = o.Es + o.hL + o.hw;
          o.NAe = Math.max(o.Ee_req - Ve.V * Ve.V / (2 * G), v.Zci);
          o.NAe_libre = v.Ze + Ve.y;
          o.margen = o.Ee_disp - o.Ee_req;
          lines.push(o.key + ': Es = ' + fmt(v.Zs) + ' + ' + fmt(Vs.y, 3) + ' + ' + fmt(Vs.V * Vs.V / (2 * G), 3) + ' = ' + fmt(o.Es, 3) + ' m; Ee requerida = Es + H' + (o.hw ? ' + hv' : '') + ' = ' + fmt(o.Ee_req, 3) + ' m; Ee disponible = ' + fmt(o.Ee_disp, 3) + ' m; margen = ' + fmt(o.margen, 3) + ' m');
        });
        c.crestas = [];
        for (var i = 1; i < c.bs.length; i++) {
          var ant = c.casos[Math.min(i - 1, 2)], sig = c.casos[Math.min(i, 2)];
          var cr = ant.NAe;
          var h = sig.NAe - cr, qk = sig.barrels[i] ? sig.barrels[i].Q : (0);
          if (qk <= 0) continue;
          var b = h > 0.01 ? qk / (1.84 * Math.pow(h, 1.5)) : null;
          c.crestas.push({ id: i + 1, cresta: cr, h: h, b: b, Q: qk });
          lines.push('Vertedero conducto ' + (i + 1) + ': cresta a ' + fmt(cr, 3) + ' m (nivel con ' + ant.key + ')' + (b ? '; carga ' + fmt(h, 3) + ' m; longitud L = Q/(1,84·h^1,5) = ' + fmt(b) + ' m' : '; sin carga disponible con estos caudales'));
        }
        return { value: 'Margen a Qmax = ' + fmt(c.casos[2].margen, 3) + ' m', lines: lines };
      }
    },
    {
      id: 'camaras', title: 'Cámaras, separadores y vertederos', inputs: ['camE', 'camS', 'sep', 'esep', 'Ztce', 'Ztcs', 'De', 'Ds'], deps: ['niveles'], src: 'Res. 0330/2017 Art. 158 num. 5 y 6; dimensiones por criterio de diseño del grupo',
      run: function (v, c) {
        var N = c.bs.length, e = v.esep, lines = [];
        var lv = {}; (c.crestas || []).forEach(function (x) { lv[x.id] = x; });
        var comp = c.bs.map(function (b, i) {
          var x = lv[b.id];
          return { id: b.id, D: b.D, b: Math.max(b.D / 1000 + 0.30, 0.60), cresta: i === 0 ? null : (x ? x.cresta : null), Lv: x && x.b ? x.b : null, h: x ? x.h : null };
        });
        var sumB = comp.reduce(function (s, k) { return s + k.b; }, 0) + (N - 1) * e;
        var maxLv = Math.max.apply(null, comp.map(function (k) { return k.Lv || 0; }).concat([0]));
        var maxD = Math.max.apply(null, c.bs.map(function (b) { return b.D / 1000; }));
        var ent;
        if (v.camE === 'frontal') ent = { B: Math.max(1.2, maxD + 0.6, maxLv), L: Math.max(1.5, sumB) };
        else ent = { B: Math.max(1.2, sumB), L: Math.max(1.5, v.De / 1000 + 0.9, maxLv + 0.5) };
        ent.fondo = v.Zci; ent.tapa = v.Ztce; ent.H = v.Ztce - v.Zci; ent.NA = c.casos[2].NAe; ent.bl = v.Ztce - c.casos[2].NAe; ent.comp = comp;
        var sal = v.camS === 'simple'
          ? { B: Math.max(1.2, c.bs.reduce(function (s, b) { return s + b.D / 1000; }, 0) + (N - 1) * 0.30 + 0.60), L: Math.max(1.5, v.Ds / 1000 + 0.9) }
          : { B: Math.max(1.2, sumB), L: Math.max(1.5, v.Ds / 1000 + 0.9) };
        sal.fondo = v.Zcs; sal.tapa = v.Ztcs; sal.H = v.Ztcs - v.Zcs; sal.NA = c.casos[2].NAs; sal.bl = v.Ztcs - c.casos[2].NAs;
        c.cam = { ent: ent, sal: sal, e: e };
        lines.push('Cámara de entrada (' + DESCR.camE[v.camE].t + '): ' + N + ' compartimiento(s) separados por ' + DESCR.sep[v.sep].t.toLowerCase() + ' de ' + fmt(e) + ' m.');
        comp.forEach(function (k, i) {
          lines.push('  Compartimiento ' + k.id + ' (Ø' + fmt(k.D, 0) + '): ancho = máx(D + 0,30; 0,60) = ' + fmt(k.b) + ' m; ' + (i === 0 ? 'sin vertedero, toma Qmin por el fondo' : (k.cresta !== null ? 'vertedero con cresta a ' + fmt(k.cresta, 3) + ' m' + (k.Lv ? ', longitud ' + fmt(k.Lv) + ' m' : '') : 'sin carga disponible para el vertedero')));
        });
        lines.push('  Interior: ' + fmt(ent.B) + ' m de ancho × ' + fmt(ent.L) + ' m de largo; fondo ' + fmt(ent.fondo) + ' m, tapa ' + fmt(ent.tapa) + ' m, altura ' + fmt(ent.H) + ' m; borde libre a Qmax = ' + fmt(ent.bl) + ' m');
        lines.push('Cámara de salida (' + DESCR.camS[v.camS].t + '): ' + fmt(sal.B) + ' × ' + fmt(sal.L) + ' m; fondo ' + fmt(sal.fondo) + ' m, tapa ' + fmt(sal.tapa) + ' m, altura ' + fmt(sal.H) + ' m; borde libre = ' + fmt(sal.bl) + ' m');
        lines.push('Criterios: holgura de 0,15 m a cada lado del conducto y 0,60 m mínimo para limpieza; largo ≥ 1,50 m y ≥ longitud del vertedero + 0,50 m.');
        return { value: fmt(ent.B) + ' × ' + fmt(ent.L) + ' m (entrada)', lines: lines };
      }
    },
    {
      id: 'perfil', title: 'Perfil y cotas', inputs: ['Ld', 'Lc', 'La'], deps: ['niveles'], src: 'Guía AA-PF-01 Tabla 1 (perfil y cotas)',
      run: function (v, c) {
        var x0 = 0, x1 = v.Ld, x2 = x1 + v.Lc, x3 = x2 + v.La;
        c.perfil = {
          est: [
            { x: x0, z: v.Zci, n: 'Entrada' },
            { x: x1, z: v.Zf, n: 'Inicio tramo inferior' },
            { x: x2, z: v.Zf, n: 'Fin tramo inferior' },
            { x: x3, z: v.Zcs, n: 'Salida' }
          ],
          casos: c.casos.map(function (o) {
            var b = o.barrels[o.gov], g2 = b.V * b.V / (2 * G);
            var e0 = o.Ee_req - b.he;
            var cada = function (s) { return e0 - b.hc * (s / c.g.L) - b.hf * (s / c.g.L); };
            var e1 = cada(c.g.Lb), e2 = cada(c.g.Lb + v.Lc), e3 = cada(c.g.L);
            return {
              key: o.key,
              egl: [e0, e1, e2, e3], hgl: [e0 - g2, e1 - g2, e2 - g2, e3 - g2],
              pMax: e1 - g2 - v.Zf, g2: g2
            };
          })
        };
        return { value: 'Presión máx. = ' + fmt(c.perfil.casos[2].pMax) + ' m.c.a.', lines: c.perfil.casos.map(function (p) { return p.key + ': EGL ' + p.egl.map(function (x) { return fmt(x, 3); }).join(' → ') + ' m; presión en el punto bajo = ' + fmt(p.pMax) + ' m.c.a.'; }) };
      }
    }
  ];

  /* ---------- Cadena de cálculo: bombeo ---------- */
  function parseCurva(txt) {
    var rows = String(txt).trim().split(/\n+/).map(function (l) { return l.trim(); }).filter(Boolean);
    var pts = [], errs = [];
    rows.forEach(function (l, i) {
      var p = l.split(/[;\t]|,\s+|\s+/).map(parseNum);
      if (p.length !== 4 || p.some(isNaN)) { errs.push('Fila ' + (i + 1) + ': se esperan 4 números (Q, H, η, NPSHr), se recibió "' + l + '".'); return; }
      if (p[0] < 0 || p[1] < 0 || p[2] < 0 || p[2] > 100 || p[3] < 0) { errs.push('Fila ' + (i + 1) + ': hay valores negativos o η mayor a 100 %.'); return; }
      pts.push({ Q: p[0], H: p[1], eta: p[2], npshr: p[3] });
    });
    pts.sort(function (a, b) { return a.Q - b.Q; });
    return { pts: pts, errs: errs };
  }
  function solve3(M, b) {
    var a = M.map(function (r, i) { return r.concat(b[i]); });
    for (var i = 0; i < 3; i++) {
      var p = i;
      for (var r = i + 1; r < 3; r++) if (Math.abs(a[r][i]) > Math.abs(a[p][i])) p = r;
      var t = a[i]; a[i] = a[p]; a[p] = t;
      if (Math.abs(a[i][i]) < 1e-14) return null;
      for (var r2 = i + 1; r2 < 3; r2++) {
        var f = a[r2][i] / a[i][i];
        for (var c = i; c < 4; c++) a[r2][c] -= f * a[i][c];
      }
    }
    var x = [0, 0, 0];
    for (var j = 2; j >= 0; j--) {
      var s = a[j][3];
      for (var k = j + 1; k < 3; k++) s -= a[j][k] * x[k];
      x[j] = s / a[j][j];
    }
    return x;
  }
  function ajusteCuadratico(pts) {
    var S = [0, 0, 0, 0, 0], Y = [0, 0, 0];
    pts.forEach(function (p) {
      var q = 1;
      for (var i = 0; i < 5; i++) { S[i] += q; if (i < 3) Y[i] += p.H * q; q *= p.Q; }
    });
    var x = solve3([[S[4], S[3], S[2]], [S[3], S[2], S[1]], [S[2], S[1], S[0]]], [Y[2], Y[1], Y[0]]);
    if (!x) return null;
    var m = pts.reduce(function (s, p) { return s + p.H; }, 0) / pts.length, sst = 0, sse = 0;
    pts.forEach(function (p) {
      var h = x[0] * p.Q * p.Q + x[1] * p.Q + x[2];
      sst += (p.H - m) * (p.H - m); sse += (p.H - h) * (p.H - h);
    });
    return { A: x[0], B: x[1], C: x[2], r2: sst > 0 ? 1 - sse / sst : 1 };
  }
  function interpCol(pts, col, Q) {
    if (Q <= pts[0].Q) return pts[0][col];
    for (var i = 1; i < pts.length; i++) {
      if (Q <= pts[i].Q) {
        var t = (Q - pts[i - 1].Q) / (pts[i].Q - pts[i - 1].Q || 1);
        return pts[i - 1][col] + t * (pts[i][col] - pts[i - 1][col]);
      }
    }
    return pts[pts.length - 1][col];
  }
  function perdidaTubo(Q, Dm, L, K, v, nu) {
    var A = areaC(Dm), V = Q / A, g2 = V * V / (2 * G), hf, f = null, Re = V * Dm / nu;
    if (Q <= 0) return { V: 0, g2: 0, hf: 0, hm: 0, f: null, Re: 0 };
    if (v.fric === 'hazen') hf = 10.67 * L * Math.pow(Q, 1.852) / (Math.pow(v.C, 1.852) * Math.pow(Dm, 4.87));
    else { f = colebrook(Re, Dm, v.ks / 1000); hf = f * (L / Dm) * g2; }
    return { V: V, g2: g2, hf: hf, hm: K * g2, f: f, Re: Re };
  }
  function alturaSistema(Qt, Hs, v, c, nP) {
    var s = perdidaTubo(Qt / (nP || v.nAct), v.Dsu / 1000, v.Lsu, v.Ksu, v, c.w.nu);
    var i = perdidaTubo(Qt, v.Dim / 1000, v.Lim, v.Kim, v, c.w.nu);
    return { H: Hs + s.hf + s.hm + i.hf + i.hm + i.g2, Hs: Hs, s: s, i: i, Hf: s.hf + i.hf, Hl: s.hm + i.hm, Hv: i.g2 };
  }
  /* Punto de operación con nP bombas en paralelo y nS en serie por línea; r = velocidad relativa (variador). */
  function puntoOperacion(Hs, v, c, nP, nS, r) {
    nP = nP || v.nAct; nS = nS || v.nSer || 1; r = r || 1;
    var A = c.fit.A, B = c.fit.B, C = c.fit.C;
    var Hp = function (Qp) { return nS * (A * Qp * Qp + B * r * Qp + C * r * r); };
    var Qt = function (Qpu) { return alturaSistema(Qpu * nP / 1000, Hs, v, c, nP).H; };
    if (Hp(0) <= Hs) return null;
    var maxQ = c.curva[c.curva.length - 1].Q * 3 || 1, N = 800, prev = 0, ant = Hp(0) - Qt(0);
    for (var i = 1; i <= N; i++) {
      var q = maxQ * i / N, d = Hp(q) - Qt(q);
      if (d <= 0 && ant > 0) {
        var lo = prev, hi = q;
        for (var j = 0; j < 60; j++) { var m = (lo + hi) / 2; if (Hp(m) - Qt(m) > 0) lo = m; else hi = m; }
        var qp = (lo + hi) / 2;
        return { Qp: qp, Qt: qp * nP, H: Hp(qp), Hb: Hp(qp) / nS, nP: nP, nS: nS };
      }
      prev = q; ant = d;
    }
    return null;
  }
  /* Velocidad relativa del variador para que el punto de operación caiga en Qd (leyes de afinidad). */
  function velocidadParaQd(v, c, nP, nS) {
    var Qp = v.Qd / nP, Hreq = alturaSistema(v.Qd / 1000, c.HsMax, v, c, nP).H / nS;
    var a = c.fit.C, b = c.fit.B * Qp, cc = c.fit.A * Qp * Qp - Hreq;
    var disc = b * b - 4 * a * cc;
    if (a <= 0 || disc < 0) return null;
    var r = (-b + Math.sqrt(disc)) / (2 * a);
    return r > 0 ? { r: r, Hz: 60 * r, Hreq: Hreq } : null;
  }
  function arregloTxt(nP, nS) {
    if (nS === 1) return nP === 1 ? 'una sola bomba' : nP + ' bombas en paralelo';
    if (nP === 1) return nS + ' bombas en serie';
    return nP + ' líneas en paralelo, cada una con ' + nS + ' bombas en serie';
  }
  function alternativasBombas(v, c) {
    var out = [];
    for (var nS = 1; nS <= 3; nS++) {
      for (var nP = 1; nP <= 4; nP++) {
        if (nP * nS > 6) continue;
        var op = puntoOperacion(c.HsMax, v, c, nP, nS), o = { nP: nP, nS: nS, total: nP * nS, op: op, actual: nP === v.nAct && nS === (v.nSer || 1) };
        if (op) {
          o.eta = interpCol(c.curva, 'eta', op.Qp);
          o.desv = (op.Qt - v.Qd) / v.Qd;
          o.dentro = op.Qp <= c.qMaxCurva;
          o.etaOk = o.eta >= 0.9 * c.etaMax;
          o.apta = op.Qt >= v.Qd && o.dentro;
          o.optima = o.apta && o.desv <= 0.10 && o.etaOk;
          o.vfd = o.apta && o.desv > 0.10 ? velocidadParaQd(v, c, nP, nS) : null;
          if (o.vfd && (o.vfd.Hz < 40 || o.vfd.r > 1)) o.vfd = null;
          o.nota = !o.dentro ? 'Fuera de la curva' : (op.Qt < v.Qd ? 'No alcanza Qd' : (o.optima ? 'Cerca de Qd y buena eficiencia' : (o.desv > 0.10 ? (o.vfd ? 'Se ajusta con variador a ' + fmt(o.vfd.Hz, 1) + ' Hz' : 'Supera Qd en ' + fmt(o.desv * 100, 0) + ' %') : 'Eficiencia baja')));
        } else o.nota = 'Las curvas no se cruzan';
        out.push(o);
      }
    }
    var score = function (o) {
      if (!o.op) return 1e6 + o.total;
      var s = 0;
      if (!o.apta) s += 1e4 + Math.max(0, -o.desv) * 1e3;
      if (!o.optima) s += (o.vfd ? 50 : 200) + Math.abs(o.desv) * 100 + (o.etaOk ? 0 : 100);
      return s + o.total * 10 + o.nS;
    };
    out.sort(function (a, b) { return score(a) - score(b); });
    return out;
  }

  var STEPS_BOMBA = [
    {
      id: 'agua', title: 'Propiedades del agua y presión atmosférica', inputs: ['T', 'alt'], deps: [], src: 'RAS Título B, Tablas B.6.28 p. 168 y B.6.35 p. 180',
      run: function (v, c) {
        c.w = agua(v.T);
        c.patm = 101325 * Math.pow(1 - 2.25577e-5 * v.alt, 5.25588);
        return { value: 'Patm/γ = ' + fmt(c.patm / c.w.gamma) + ' m', lines: ['ρ = ' + fmt(c.w.rho, 1) + ' kg/m³; ν = ' + (c.w.nu * 1e6).toFixed(3).replace('.', ',') + '×10⁻⁶ m²/s; Pv = ' + fmt(c.w.pv / 1000) + ' kPa', 'Patm = 101325·(1 − 2,25577×10⁻⁵·' + fmt(v.alt, 0) + ')^5,25588 = ' + fmt(c.patm / 1000) + ' kPa (atmósfera estándar) → Patm/γ = ' + fmt(c.patm / c.w.gamma) + ' m'] };
      }
    },
    {
      id: 'estatica', title: 'Altura estática', inputs: ['Znmin', 'Znmax', 'Zdis', 'descarga', 'Zimp'], deps: [], src: 'RAS B.8.5.2, Ec. B.8.1, p. 356; HEC-22 §12.1.3.1, p. 252',
      run: function (v, c) {
        if (v.Znmax < v.Znmin) throw calcError('El nivel máximo del pozo (' + fmt(v.Znmax) + ' m) está por debajo del mínimo (' + fmt(v.Znmin) + ' m).', 'Corrija los niveles: el máximo debe ser mayor o igual al mínimo.');
        var libre = v.descarga === 'libre' && v.Zimp > v.Zdis;
        c.Zsup = libre ? v.Zimp : v.Zdis;
        c.HsMax = c.Zsup - v.Znmin; c.HsMin = c.Zsup - v.Znmax;
        if (c.HsMax <= 0) throw calcError('El nivel de descarga no está por encima del pozo: Hs = ' + fmt(c.HsMax) + ' m. Ese sistema no necesita bombeo.', 'Revise las cotas o considere solución por gravedad (HEC-22 cap. 12, p. 249).');
        return { value: 'Hs = ' + fmt(c.HsMin) + ' a ' + fmt(c.HsMax) + ' m', lines: [(libre ? 'Descarga libre: se mide hasta el eje de la salida, cota ' + fmt(v.Zimp) + ' m' : 'Descarga ahogada: se mide hasta el nivel de agua, cota ' + fmt(v.Zdis) + ' m'), 'Hs máx = ' + fmt(c.Zsup) + ' − ' + fmt(v.Znmin) + ' = ' + fmt(c.HsMax) + ' m (nivel mínimo en succión, condición más desfavorable)', 'Hs mín = ' + fmt(c.Zsup) + ' − ' + fmt(v.Znmax) + ' = ' + fmt(c.HsMin) + ' m'] };
      }
    },
    {
      id: 'curva', title: 'Curva de la bomba', inputs: ['curva'], deps: [], src: 'RAS B.8.5.3.3, Ec. B.8.4, p. 357; HEC-22 §12.1.3.2, p. 252',
      run: function (v, c) {
        var r = parseCurva(v.curva);
        if (r.errs.length) throw calcError(r.errs[0], 'Escriba una fila por punto: Q, H, η, NPSHr. Ejemplo: 90, 29.5, 76, 3.5');
        if (r.pts.length < 3) throw calcError('La curva tiene ' + r.pts.length + ' punto(s); la regresión H = AQ² + BQ + C necesita al menos 3.', 'Agregue más puntos del catálogo del fabricante.');
        var qs = r.pts.map(function (p) { return p.Q; });
        if (new Set(qs).size !== qs.length) throw calcError('Hay caudales repetidos en la curva de la bomba.', 'Deje un solo punto por caudal.');
        c.curva = r.pts;
        c.fit = ajusteCuadratico(r.pts);
        if (!c.fit) throw calcError('No fue posible ajustar la curva.', 'Revise que los caudales de la curva sean distintos entre sí.');
        c.etaMax = Math.max.apply(null, r.pts.map(function (p) { return p.eta; }));
        c.qMaxCurva = qs[qs.length - 1];
        return { value: 'R² = ' + fmt(c.fit.r2, 4), lines: ['H = ' + c.fit.A.toExponential(4).replace('.', ',') + '·Q² + ' + c.fit.B.toExponential(4).replace('.', ',') + '·Q + ' + fmt(c.fit.C, 3) + '  (Q en L/s por bomba)', 'Regresión por mínimos cuadrados con ' + r.pts.length + ' puntos; R² = ' + fmt(c.fit.r2, 4) + '; η máx de catálogo = ' + fmt(c.etaMax, 1) + ' %'] };
      }
    },
    {
      id: 'accesorios', title: 'Accesorios y pérdidas menores', inputs: ['kmodo', 'accSu', 'accIm', 'Ksu', 'Kim'], deps: [], src: 'HEC-22 Ec. 12.1, p. 252 (Hl = ΣK·V²/2g); coeficientes K usuales, editables',
      run: function (v, c) {
        if (v.kmodo === 'manual') {
          c.acc = { su: { items: [], sum: v.Ksu }, im: { items: [], sum: v.Kim }, manual: true };
          return { value: 'ΣK succión = ' + fmt(v.Ksu) + '; impulsión = ' + fmt(v.Kim), lines: ['Valores escritos por el usuario: ΣK succión = ' + fmt(v.Ksu) + ' (por bomba); ΣK impulsión = ' + fmt(v.Kim) + '. La salida al tanque se suma aparte como Hv = V²/2g.'] };
        }
        var su = parseAcc(v.accSu), im = parseAcc(v.accIm);
        var errs = su.errs.concat(im.errs);
        if (errs.length) throw calcError(errs[0], 'Revise la tabla de accesorios: cantidades enteras y K positivos.');
        v.Ksu = su.sum; v.Kim = im.sum;
        c.acc = { su: su, im: im };
        var ls = ['Succión (una por bomba):'];
        su.items.forEach(function (a) { ls.push('  ' + a.n + ' × ' + a.t + ' (K = ' + fmt(a.K) + ') = ' + fmt(a.nK)); });
        ls.push('  ΣK succión = ' + fmt(su.sum));
        ls.push('Impulsión (común):');
        im.items.forEach(function (a) { ls.push('  ' + a.n + ' × ' + a.t + ' (K = ' + fmt(a.K) + ') = ' + fmt(a.nK)); });
        ls.push('  ΣK impulsión = ' + fmt(im.sum) + '; la salida al tanque (K = 1,0) se suma como Hv = V²/2g');
        return { value: 'ΣK succión = ' + fmt(su.sum) + '; impulsión = ' + fmt(im.sum), lines: ls };
      }
    },
    {
      id: 'sistema', title: 'Curva del sistema', inputs: ['Dsu', 'Lsu', 'Dim', 'Lim', 'fric', 'ks', 'C', 'nAct', 'Qd'], deps: ['agua', 'estatica', 'accesorios'], src: 'HEC-22 Ec. 12.1, p. 252; RAS Ec. B.8.1, p. 356 y B.6.9 a B.6.13',
      run: function (v, c) {
        c.sis = alturaSistema(v.Qd / 1000, c.HsMax, v, c);
        return { value: 'TDH(' + fmt(v.Qd, 0) + ' L/s) = ' + fmt(c.sis.H) + ' m', lines: ['Con Q = ' + fmt(v.Qd, 1) + ' L/s y Hs máx: Vs = ' + fmt(c.sis.s.V) + ' m/s, Vi = ' + fmt(c.sis.i.V) + ' m/s', 'TDH = Hs + Hf + Hv + Hl = ' + fmt(c.HsMax) + ' + ' + fmt(c.sis.Hf, 3) + ' + ' + fmt(c.sis.Hv, 3) + ' + ' + fmt(c.sis.Hl, 3) + ' = ' + fmt(c.sis.H) + ' m'] };
      }
    },
    {
      id: 'operacion', title: 'Punto de operación', inputs: ['nAct', 'nSer'], deps: ['curva', 'sistema'], src: 'HEC-22 §12.1.3, Fig. 12.1, p. 252-253; Guía AA-PF-01 Tabla 1',
      run: function (v, c) {
        c.op = puntoOperacion(c.HsMax, v, c);
        var conf = v.nAct + ' en paralelo' + (v.nSer > 1 ? ' × ' + v.nSer + ' en serie' : '');
        if (!c.op) throw calcError('Con ' + conf + ' la bomba no vence al sistema: su altura a caudal cero (' + fmt(c.fit.C * v.nSer) + ' m) no alcanza ' + fmt(c.HsMax) + ' m de altura estática, o las curvas no se cruzan.', 'Vea "¿Hacen falta más bombas?" en Resultados: allí se comparan arreglos en serie y en paralelo y se puede aplicar el recomendado.');
        c.opLow = puntoOperacion(c.HsMin, v, c);
        c.opSis = alturaSistema(c.op.Qt / 1000, c.HsMax, v, c);
        var ls = ['Bomba equivalente: H(Q) = ' + v.nSer + '·H₁(Q/' + v.nAct + ')  (' + conf + '; en paralelo se suman caudales, en serie alturas)',
          'Intersección con H_sistema(Q), nivel mínimo: Q = ' + fmt(c.op.Qt, 2) + ' L/s, H = ' + fmt(c.op.H, 2) + ' m (' + fmt(c.op.Qp, 2) + ' L/s y ' + fmt(c.op.Hb, 2) + ' m por bomba)',
          'Con nivel máximo: Q = ' + (c.opLow ? fmt(c.opLow.Qt, 2) + ' L/s, H = ' + fmt(c.opLow.H, 2) + ' m' : 'sin cruce'),
          'Frente al caudal de diseño: ' + fmt(c.op.Qt, 1) + ' / ' + fmt(v.Qd, 1) + ' L/s = ' + fmt(c.op.Qt / v.Qd * 100, 0) + ' %'];
        return { value: 'Q = ' + fmt(c.op.Qt, 1) + ' L/s; H = ' + fmt(c.op.H) + ' m', lines: ls };
      }
    },
    {
      id: 'arreglo', title: 'Bombas en serie o en paralelo', inputs: ['nAct', 'nSer', 'Qd'], deps: ['curva', 'sistema'], src: 'HEC-22 §12.1.3 y §12.1.4, p. 252-253; leyes de afinidad para el variador (Res. 0330/2017 Art. 161 num. 5)',
      run: function (v, c) {
        var alt = alternativasBombas(v, c), best = alt[0], cur = alt.filter(function (o) { return o.actual; })[0];
        c.alt = alt; c.altBest = best; c.altCur = cur;
        var ls = [];
        ls.push('Una bomba a caudal cero da ' + fmt(c.fit.C) + ' m; altura estática = ' + fmt(c.HsMax) + ' m; altura del sistema a Qd = ' + fmt(c.sis.H) + ' m');
        if (c.fit.C <= c.HsMax) ls.push('Una bomba no vence la altura estática: hay que ponerlas en SERIE para sumar altura.');
        else if (!cur || !cur.op || cur.op.Qt < v.Qd) ls.push('La bomba vence la altura pero no entrega Qd: en PARALELO se suma caudal; en serie se suma altura cuando el sistema a Qd pide más de lo que da una bomba.');
        ls.push('Se compararon ' + alt.length + ' arreglos de bombas iguales (hasta 4 en paralelo y 3 en serie, máximo 6 en operación):');
        alt.slice(0, 6).forEach(function (o) {
          ls.push((o === best ? '→ ' : '  ') + o.nP + ' en paralelo × ' + o.nS + ' en serie: ' + (o.op ? 'Q = ' + fmt(o.op.Qt, 1) + ' L/s, H = ' + fmt(o.op.H) + ' m, η = ' + fmt(o.eta, 1) + ' %' : 'sin cruce') + ' · ' + o.nota);
        });
        var txt;
        if (cur && cur.optima) txt = 'La configuración actual (' + cur.nP + ' en paralelo × ' + cur.nS + ' en serie) sirve: no hace falta añadir bombas.';
        else if (best && best.apta) txt = 'Se recomienda ' + arregloTxt(best.nP, best.nS) + ': ' + best.total + ' en operación más la de reserva.' + (best.vfd ? ' Con variador a ' + fmt(best.vfd.Hz, 1) + ' Hz el caudal baja a Qd.' : '');
        else txt = 'Ningún arreglo de hasta 6 bombas iguales entrega Qd con esta curva: cambie de bomba o reduzca las pérdidas.';
        c.altTxt = txt;
        ls.push(txt);
        return { value: cur && cur.optima ? 'La actual sirve' : (best && best.apta ? best.nP + ' en paralelo × ' + best.nS + ' en serie' : 'Cambiar de bomba'), lines: ls };
      }
    },
    {
      id: 'potencia', title: 'Potencia y eficiencia', inputs: ['etaM'], deps: ['operacion'], src: 'RAS B.8.5.3.1, Ec. B.8.2, p. 356; Res. 0330/2017 Art. 161 num. 6',
      run: function (v, c) {
        var eta = interpCol(c.curva, 'eta', c.op.Qp);
        if (eta <= 0) throw calcError('La eficiencia interpolada en el punto de operación es 0 %.', 'Revise la columna η de la curva de la bomba.');
        var Q = c.op.Qp / 1000;
        var Ph = c.w.gamma * Q * c.op.Hb;
        var Pe = Ph / (eta / 100), Pm = Pe / (v.etaM / 100);
        c.pot = { eta: eta, Ph: Ph / 1000, Pe: Pe / 1000, Pm: Pm / 1000, etaConj: eta * v.etaM / 100, E24: Pm / 1000 * v.nAct * v.nSer * 24 };
        return { value: 'P = ' + fmt(c.pot.Pe) + ' kW por bomba; η = ' + fmt(eta, 1) + ' %', lines: ['η(' + fmt(c.op.Qp, 1) + ' L/s) = ' + fmt(eta, 1) + ' % (interpolación lineal en la curva)', 'P hidráulica por bomba = γ·Q·H = ' + fmt(c.w.gamma, 0) + '·' + fmt(Q, 4) + '·' + fmt(c.op.Hb) + ' = ' + fmt(c.pot.Ph) + ' kW', 'P al eje = Ph/η = ' + fmt(c.pot.Pe) + ' kW;  P eléctrica = Pe/ηm = ' + fmt(c.pot.Pm) + ' kW', 'η conjunto = ' + fmt(eta, 1) + ' % × ' + fmt(v.etaM, 1) + ' % = ' + fmt(c.pot.etaConj, 1) + ' %'] };
      }
    },
    {
      id: 'npsh', title: 'NPSH disponible y requerido', inputs: ['Zeje', 'Znmin'], deps: ['operacion'], src: 'RAS B.8.5.3.2, Ec. B.8.3, p. 357; RAS D.8.5.3.2, Ec. D.8.4, p. 213',
      run: function (v, c) {
        var Hes = v.Znmin - v.Zeje, s = c.opSis.s;
        var a = c.patm / c.w.gamma + Hes - (s.hf + s.hm) - c.w.pv / c.w.gamma;
        var r = interpCol(c.curva, 'npshr', c.op.Qp);
        c.npsh = { Hes: Hes, a: a, r: r, hs: s.hf + s.hm, margen: a - r, patm: c.patm / c.w.gamma, pv: c.w.pv / c.w.gamma };
        return { value: 'NPSHd = ' + fmt(a) + ' m; NPSHr = ' + fmt(r) + ' m', lines: ['Hes = ' + fmt(v.Znmin) + ' − ' + fmt(v.Zeje) + ' = ' + fmt(Hes) + ' m (positiva si el agua está sobre el eje)', 'NPSHd = Patm/γ + Hes − hs − Pv/γ = ' + fmt(c.npsh.patm) + ' + ' + fmt(Hes) + ' − ' + fmt(c.npsh.hs, 3) + ' − ' + fmt(c.npsh.pv, 3) + ' = ' + fmt(a) + ' m', 'NPSHr(' + fmt(c.op.Qp, 1) + ' L/s) = ' + fmt(r) + ' m; margen = ' + fmt(a - r) + ' m'] };
      }
    },
    {
      id: 'velocidades', title: 'Velocidades en succión e impulsión', inputs: ['Dsu', 'Dim'], deps: ['operacion'], src: 'Res. 0330/2017 Art. 161 num. 2 y 3; RAS B.8.4.8.2 y B.8.4.8.3, p. 353-354',
      run: function (v, c) {
        c.vel = { s: c.opSis.s.V, i: c.opSis.i.V };
        return { value: 'Vs = ' + fmt(c.vel.s) + '; Vi = ' + fmt(c.vel.i) + ' m/s', lines: ['Vs = (Q/n)/A = ' + fmt(c.op.Qp / 1000, 4) + '/' + fmt(areaC(v.Dsu / 1000), 4) + ' = ' + fmt(c.vel.s) + ' m/s', 'Vi = Q/A = ' + fmt(c.op.Qt / 1000, 4) + '/' + fmt(areaC(v.Dim / 1000), 4) + ' = ' + fmt(c.vel.i) + ' m/s'] };
      }
    },
    {
      id: 'sumergencia', title: 'Sumergencia', inputs: ['Znmin', 'Zboca', 'Zfondo', 'Dsu'], deps: [], src: 'Res. 0330/2017 Art. 161 num. 7; RAS B.8.4.7.2, p. 352',
      run: function (v, c) {
        var S = v.Znmin - v.Zboca;
        c.sum = { S: S, req25: 2.5 * v.Dsu / 1000, req2: 2 * v.Dsu / 1000, fondo: v.Zboca - v.Zfondo };
        return { value: 'S = ' + fmt(S) + ' m', lines: ['S = ' + fmt(v.Znmin) + ' − ' + fmt(v.Zboca) + ' = ' + fmt(S) + ' m', '2,5·Ds = 2,5·' + fmt(v.Dsu / 1000, 3) + ' = ' + fmt(c.sum.req25) + ' m;  2·Ds = ' + fmt(c.sum.req2) + ' m', 'Separación al fondo = ' + fmt(c.sum.fondo) + ' m'] };
      }
    },
    {
      id: 'ariete', title: 'Golpe de ariete', inputs: ['E', 'nu', 'esp', 'Tc', 'PN', 'Lim', 'Dim'], deps: ['operacion', 'agua'], src: 'RAS B.6.5.8.5, Ec. B.6.24, p. 181; RAS D.8.5.7, p. 219; Guía AA-PF-01 Tabla 1 (Joukowsky)',
      run: function (v, c) {
        var D = v.Dim / 1000, ep = v.esp / 1000;
        var a = Math.sqrt(EF_GPA * 1e9 / c.w.rho) / Math.sqrt(1 + (EF_GPA * D * (1 - v.nu * v.nu)) / (v.E * ep));
        var V = c.vel ? c.vel.i : c.opSis.i.V;
        var Tcrit = 2 * v.Lim / a, jouk = a * V / G, mich = 2 * v.Lim * V / (G * v.Tc);
        var rapido = v.Tc <= Tcrit, dH = rapido ? jouk : mich;
        var Hmax = c.op.H + dH, Hmin = c.HsMax - dH;
        c.ar = { a: a, V: V, Tcrit: Tcrit, jouk: jouk, mich: mich, rapido: rapido, dH: dH, Hmax: Hmax, Hmin: Hmin, ratio: dH / c.op.H };
        return {
          value: 'a = ' + fmt(a, 0) + ' m/s; ΔH = ' + fmt(dH) + ' m',
          lines: [
            'a = √(Eagua/ρ) / √(1 + Eagua·D·(1−μ²)/(Ep·e)) = ' + fmt(Math.sqrt(EF_GPA * 1e9 / c.w.rho), 0) + ' / √(1 + ' + fmt(EF_GPA) + '·' + fmt(D, 3) + '·' + fmt(1 - v.nu * v.nu, 3) + '/(' + fmt(v.E) + '·' + fmt(ep, 4) + ')) = ' + fmt(a, 1) + ' m/s',
            'Tiempo crítico = 2L/a = 2·' + fmt(v.Lim, 0) + '/' + fmt(a, 1) + ' = ' + fmt(Tcrit) + ' s',
            'Joukowsky (cierre rápido): ΔH = a·V/g = ' + fmt(a, 1) + '·' + fmt(V) + '/9,81 = ' + fmt(jouk) + ' m',
            'Cierre lento (Michaud): ΔH = 2LV/(gT) = ' + fmt(mich) + ' m',
            'T = ' + fmt(v.Tc, 1) + ' s ' + (rapido ? '≤' : '>') + ' ' + fmt(Tcrit) + ' s → se aplica ' + (rapido ? 'Joukowsky' : 'Michaud') + ': ΔH = ' + fmt(dH) + ' m',
            'Presión máx. en la bomba = H + ΔH = ' + fmt(Hmax) + ' m.c.a.;  mínima = Hs − ΔH = ' + fmt(Hmin) + ' m.c.a.'
          ]
        };
      }
    },
    {
      id: 'pozo', title: 'Pozo húmedo', inputs: ['LB', 'BB', 'Znmin', 'Znmax', 'Dla', 'Qd', 'tipoB'], deps: ['operacion'], src: 'Res. 0330/2017 Art. 160 num. 6 a 8; RAS D.8.4.7.1, p. 206',
      run: function (v, c) {
        var Vol = v.LB * v.BB * (v.Znmax - v.Znmin);
        var Qbmin = c.op.Qt / 1000 * 60;
        var Vreq = 2.5 * Qbmin;
        var tRet = Vol / (v.Qd / 1000) / 60;
        var Vent = (v.Qd / 1000) / areaC(v.Dla / 1000);
        var unaBomba = c.op.Qp / 1000;
        var ciclo = 4 * Vol / unaBomba / 60;
        c.pozo = { Vol: Vol, Vreq: Vreq, tRet: tRet, Vent: Vent, ciclo: ciclo, arr: 60 / ciclo };
        return { value: 'V útil = ' + fmt(Vol) + ' m³ (mín. ' + fmt(Vreq) + ' m³)', lines: ['V útil = ' + fmt(v.LB) + '·' + fmt(v.BB) + '·(' + fmt(v.Znmax) + ' − ' + fmt(v.Znmin) + ') = ' + fmt(Vol) + ' m³', 'V mínimo = 2,5·Q(m³/min) = 2,5·' + fmt(Qbmin) + ' = ' + fmt(Vreq) + ' m³', 'Retención = V/Qd = ' + fmt(tRet) + ' min;  V llegada = ' + fmt(Vent) + ' m/s', 'Ciclo mínimo (entrada = Qb/2) = 4V/Qb = ' + fmt(ciclo) + ' min → ' + fmt(c.pozo.arr, 1) + ' arranques/h'] };
      }
    },
    {
      id: 'tanque', title: 'Tanque de descarga', inputs: ['tanque', 'descarga', 'Zdis', 'Zimp', 'Ltq', 'Btq', 'Zftq', 'Dim'], deps: ['estatica'], src: 'HEC-22 Ec. 12.1, p. 252 (pérdida de salida Hv); dimensiones por criterio de diseño del grupo',
      run: function (v, c) {
        var t = DESCR.tanque[v.tanque], d = DESCR.descarga[v.descarga];
        var lam = v.Zdis - v.Zftq, sobre = v.Zimp - v.Dim / 2000 - v.Zftq;
        c.tq = { t: t.t, d: t.d, dd: d.d, lam: lam, sobre: sobre, Vol: v.Ltq * v.Btq * lam, clave: v.Zimp + v.Dim / 2000, batea: v.Zimp - v.Dim / 2000 };
        return {
          value: t.t + ', ' + fmt(v.Ltq, 1) + ' × ' + fmt(v.Btq, 1) + ' m',
          lines: [t.t + ': ' + t.d, d.t + ': ' + d.d,
            'Salida de la impulsión: eje ' + fmt(v.Zimp) + ' m (batea ' + fmt(c.tq.batea) + ', clave ' + fmt(c.tq.clave) + ' m); nivel de agua ' + fmt(v.Zdis) + ' m; fondo ' + fmt(v.Zftq) + ' m',
            'Lámina de agua = ' + fmt(v.Zdis) + ' − ' + fmt(v.Zftq) + ' = ' + fmt(lam) + ' m; volumen = ' + fmt(v.Ltq, 1) + '·' + fmt(v.Btq, 1) + '·' + fmt(lam) + ' = ' + fmt(c.tq.Vol) + ' m³']
        };
      }
    }
  ];

  /* Tabla de velocidad máxima en succión */
  var TAB_VS_B = [[50, 0.75], [75, 1.0], [100, 1.3], [150, 1.45], [200, 1.6], [250, 1.6], [300, 1.7], [400, 1.8]];
  var TAB_VS_D = [[50, 0.75], [75, 1.0], [100, 1.3], [150, 1.45], [200, 1.6], [250, 1.6], [300, 1.7], [301, 1.8]];
  function vsMaxTabla(tab, D) {
    var r = tab[0][1];
    tab.forEach(function (t) { if (D >= t[0]) r = t[1]; });
    return r;
  }
  function etaMinArt161(P) { return P <= 5 ? 50 : (P <= 100 ? 65 : 70); }
  function sugD(Q, Vobj) { return fmt(Math.sqrt(4 * Q / (Math.PI * Vobj)) * 1000, 0); }

  /* ---------- Verificaciones (matriz de trazabilidad) ---------- */
  var CHECKS = [
    /* --- Sifón --- */
    { id: 'S1', mod: 'sifon', param: 'Número de conductos en paralelo', limite: 'N ≥ 2', fuente: 'Res. 0330/2017 Art. 158 num. 1. También RAS D.7.8.1, p. 186; HEC-22 §8.4.3, p. 134', cond: 'N < 2', sug: 'Use al menos dos conductos para poder aislar uno en mantenimiento.', nivel: 'norma', deps: ['conductos'],
      ev: function (v, c) { return [{ value: c.bs.length + ' conducto(s)', ok: c.bs.length >= 2, sug: 'Agregue un segundo conducto en paralelo; así se puede aislar uno para limpieza sin suspender el servicio.' }]; } },
    { id: 'S2', mod: 'sifon', param: 'Diámetro interno real mínimo', limite: '≥ 170 mm sanitario; ≥ 280 mm pluvial o combinado', fuente: 'Res. 0330/2017 Art. 158 num. 2', cond: 'D < D mínimo', sug: 'Aumente el diámetro al mínimo de la norma.', nivel: 'norma', deps: ['conductos', 'lim'],
      ev: function (v, c) { return c.bs.map(function (b) { return { value: 'Conducto ' + b.id + ': ' + fmt(b.D, 0) + ' mm', limit: '≥ ' + c.lim.Dmin + ' mm', ok: b.D >= c.lim.Dmin, sug: 'Suba el conducto ' + b.id + ' a un diámetro interno de al menos ' + c.lim.Dmin + ' mm.' }; }); } },
    { id: 'S3', mod: 'sifon', param: 'Velocidad mínima de flujo', limite: '≥ 1,0 m/s sanitario; ≥ 1,2 m/s pluvial o combinado', fuente: 'Res. 0330/2017 Art. 158 num. 3. También RAS D.7.8.2, p. 186', cond: 'V < V mínima en algún conducto en servicio', sug: 'Reduzca el diámetro de ese conducto o póngalo en servicio con un caudal mayor.', nivel: 'norma', deps: ['hid', 'lim'],
      ev: function (v, c) {
        var out = [];
        c.casos.forEach(function (o) {
          o.barrels.forEach(function (r, j) {
            var Dm = dMaxParaV(r.Q, c.lim.Vmin);
            out.push({ value: o.key + ', conducto ' + (j + 1) + ': ' + fmt(r.V) + ' m/s', limit: '≥ ' + fmt(c.lim.Vmin, 1) + ' m/s', ok: r.V >= c.lim.Vmin, sug: 'Con ' + fmt(r.Q * 1000, 1) + ' L/s, el conducto ' + (j + 1) + ' debe tener D ≤ ' + fmt(Dm, 0) + ' mm para llegar a ' + fmt(c.lim.Vmin, 1) + ' m/s (hoy ' + fmt(o.act[j].D, 0) + ' mm). Si el mínimo normativo lo impide, prevea lavado periódico o regule la entrada.' });
          });
        });
        return out;
      } },
    { id: 'S4', mod: 'sifon', param: 'Pendiente del trazado', limite: 'θ ≤ 22,5°', fuente: 'Res. 0330/2017 Art. 158 num. 4. También RAS D.7.8.4, p. 188', cond: 'θ > 22,5° en algún tramo', sug: 'Alargue la proyección horizontal del tramo.', nivel: 'norma', deps: ['geom'],
      ev: function (v, c) {
        return [
          { value: 'Tramo que baja: ' + fmt(c.g.thB, 1) + '°', ok: c.g.thB <= 22.5, sug: 'Alargue el tramo que baja a por lo menos ' + fmt(c.g.dzB / Math.tan(22.5 * Math.PI / 180), 1) + ' m de proyección horizontal.' },
          { value: 'Tramo que sube: ' + fmt(c.g.thS, 1) + '°', ok: c.g.thS <= 22.5, sug: 'Alargue el tramo que sube a por lo menos ' + fmt(c.g.dzS / Math.tan(22.5 * Math.PI / 180), 1) + ' m de proyección horizontal.' }
        ];
      } },
    { id: 'S5', mod: 'sifon', param: 'Pendiente del tramo que sube', limite: '≤ 15 %', fuente: 'HEC-22 §8.4.3, p. 134 (o el valor de la jurisdicción)', cond: 'Pendiente > 15 %', sug: 'Alargue el tramo de subida para facilitar el lavado de sedimentos.', nivel: 'rec', deps: ['geom'],
      ev: function (v, c) { return [{ value: fmt(c.g.pS, 1) + ' %', ok: c.g.pS <= 15, sug: 'Con ' + fmt(c.g.dzS) + ' m de subida, use al menos ' + fmt(c.g.dzS / 0.15, 1) + ' m de proyección horizontal.' }]; } },
    { id: 'S6', mod: 'sifon', param: 'Ángulo de los cambios de dirección', limite: '≤ 45°', fuente: 'RAS D.7.8.4, p. 188', cond: 'Ángulo > 45°', sug: 'Use curvas suaves o reparta el cambio en dos codos.', nivel: 'rec', deps: ['geom'],
      ev: function (v, c) { var m = Math.max(c.g.thB, c.g.thS); return [{ value: fmt(m, 1) + '°', ok: m <= 45, sug: 'Reparta el cambio de ' + fmt(m, 1) + '° en varios codos de no más de 45°.' }]; } },
    { id: 'S7', mod: 'sifon', param: 'Línea de energía entrada vs. salida', limite: 'E entrada > E salida + pérdidas', fuente: 'Res. 0330/2017 Art. 158 num. 8', cond: 'Margen de energía ≤ 0', sug: 'Aumente el desnivel entre colectores o reduzca las pérdidas.', nivel: 'norma', deps: ['niveles'],
      ev: function (v, c) {
        return c.casos.map(function (o) {
          return { value: o.key + ': disponible ' + fmt(o.Ee_disp, 3) + ' m, requerida ' + fmt(o.Ee_req, 3) + ' m (margen ' + fmt(o.margen, 3) + ' m)', ok: o.margen > 0, sug: 'Faltan ' + fmt(-o.margen, 3) + ' m de energía: baje la cota de salida o suba la de llegada esa cantidad, o reparta ' + fmt(o.Q * 1000, 0) + ' L/s en más conductos. Sin eso, el agua se represa aguas arriba.' };
        });
      } },
    { id: 'S8', mod: 'sifon', param: 'Esfuerzo cortante de autolimpieza', limite: '≥ 1,0 Pa sanitario; ≥ 2,0 Pa pluvial o combinado', fuente: 'Res. 0330/2017 Art. 141 y 149, aplicados según RAS D.7.8.2, p. 186 (la V mínima debe superar la de autolimpieza)', cond: 'τ < τ mínimo', sug: 'Aumente la velocidad reduciendo el diámetro.', nivel: 'rec', deps: ['hid', 'lim'],
      ev: function (v, c) {
        var out = [];
        c.casos.forEach(function (o) {
          o.barrels.forEach(function (r, j) {
            out.push({ value: o.key + ', conducto ' + (j + 1) + ': ' + fmt(r.tau) + ' Pa', limit: '≥ ' + fmt(c.lim.tau, 1) + ' Pa (' + c.lim.artTau + ')', ok: r.tau >= c.lim.tau, sug: 'Suba la velocidad del conducto ' + (j + 1) + ' reduciendo su diámetro, o programe lavados: con ' + fmt(r.V) + ' m/s no alcanza a arrastrar sedimento.' });
          });
        });
        return out;
      } },
    { id: 'S9', mod: 'sifon', param: 'Velocidad máxima de referencia', limite: '≤ 5,0 m/s', fuente: 'Res. 0330/2017 Art. 142 y 150. Son límites de colector por gravedad: aquí se usan solo como referencia en conducto a presión', cond: 'V > 5 m/s', sug: 'Aumente el diámetro o reparta en más conductos.', nivel: 'rec', deps: ['hid'],
      ev: function (v, c) {
        var m = 0;
        c.casos.forEach(function (o) { o.barrels.forEach(function (r) { m = Math.max(m, r.V); }); });
        return [{ value: fmt(m) + ' m/s', ok: m <= 5, sug: 'Aumente el diámetro o reparta el caudal: ' + fmt(m) + ' m/s desgasta la tubería por abrasión.' }];
      } },
    { id: 'S10', mod: 'sifon', param: 'Rejilla antes del sifón', limite: 'Obligatoria si D ≤ 760 mm', fuente: 'Res. 0330/2017 Art. 158 num. 7. También RAS D.7.8.4, p. 188', cond: 'D ≤ 760 mm sin rejilla', sug: 'Instale rejilla o mecanismo de retención antes del sifón.', nivel: 'norma', deps: ['conductos'], inputs: ['rejilla'],
      ev: function (v, c) {
        var m = Math.min.apply(null, c.bs.map(function (b) { return b.D; }));
        return [{ value: 'D menor = ' + fmt(m, 0) + ' mm; rejilla: ' + (v.rejilla === 'si' ? 'sí' : 'no'), ok: m > 760 || v.rejilla === 'si', sug: 'Instale una rejilla o un mecanismo para retener sólidos antes del sifón.' }];
      } },
    { id: 'S11', mod: 'sifon', param: 'Entrada a presión en cámara de entrada', limite: 'Nivel de agua ≥ clave del conducto en servicio', fuente: 'RAS D.7.8.3, p. 186: el sifón se calcula como conducto presurizado', cond: 'Nivel por debajo de la clave', sug: 'Baje la batea de los conductos en la cámara de entrada.', nivel: 'rec', deps: ['niveles'], inputs: ['Zci'],
      ev: function (v, c) {
        return c.casos.map(function (o) {
          var clave = v.Zci + Math.max.apply(null, o.act.map(function (b) { return b.D / 1000; }));
          return { value: o.key + ': nivel ' + fmt(o.NAe, 3) + ' m, clave ' + fmt(clave, 3) + ' m', ok: o.NAe >= clave, sug: 'Baje la batea de entrada al menos ' + fmt(clave - o.NAe, 2) + ' m (a ' + fmt(v.Zci - (clave - o.NAe), 2) + ' m) para que el conducto entre ahogado y no aspire aire.' };
        });
      } },
    { id: 'S12', mod: 'sifon', param: 'Descarga a presión en cámara de salida', limite: 'Nivel de agua ≥ clave del conducto en servicio', fuente: 'RAS D.7.8.3, p. 186: el sifón se calcula como conducto presurizado', cond: 'Nivel por debajo de la clave', sug: 'Baje la batea de los conductos en la cámara de salida.', nivel: 'rec', deps: ['niveles'], inputs: ['Zcs'],
      ev: function (v, c) {
        return c.casos.map(function (o) {
          var clave = v.Zcs + Math.max.apply(null, o.act.map(function (b) { return b.D / 1000; }));
          return { value: o.key + ': nivel ' + fmt(o.NAs, 3) + ' m, clave ' + fmt(clave, 3) + ' m', ok: o.NAs >= clave, sug: 'Baje la batea de salida al menos ' + fmt(clave - o.NAs, 2) + ' m (a ' + fmt(v.Zcs - (clave - o.NAs), 2) + ' m) para que el conducto trabaje lleno.' };
        });
      } },
    { id: 'S13', mod: 'sifon', param: 'Colector de llegada y salida a superficie libre', limite: 'Q ≤ capacidad del colector', fuente: 'HEC-22 Ec. 9.2, p. 138', cond: 'Colector a tubo lleno', sug: 'Aumente el diámetro o la pendiente del colector.', nivel: 'rec', deps: ['colectores'],
      ev: function (v, c) {
        return [
          { value: 'Llegada: Q/Qlleno = ' + fmt(c.ent[2].rel * 100, 0) + ' %', ok: !c.ent[2].lleno, sug: 'El colector de llegada no conduce ' + fmt(c.Q[2] * 1000, 0) + ' L/s a superficie libre (capacidad ' + fmt(c.ent[2].Qfull * 1000, 0) + ' L/s): aumente su diámetro o pendiente.' },
          { value: 'Salida: Q/Qlleno = ' + fmt(c.sal[2].rel * 100, 0) + ' %', ok: !c.sal[2].lleno, sug: 'El colector de salida no conduce ' + fmt(c.Q[2] * 1000, 0) + ' L/s a superficie libre (capacidad ' + fmt(c.sal[2].Qfull * 1000, 0) + ' L/s): aumente su diámetro o pendiente.' }
        ];
      } },
    { id: 'S14', mod: 'sifon', param: 'Velocidad de autolimpieza en conducto a presión', limite: '≥ 3 ft/s (0,91 m/s)', fuente: 'HEC-22 §9.2.3, p. 159', cond: 'V < 0,91 m/s', sug: 'Aumente la velocidad reduciendo el diámetro.', nivel: 'rec', deps: ['hid'],
      ev: function (v, c) {
        var m = Infinity;
        c.casos.forEach(function (o) { o.barrels.forEach(function (r) { m = Math.min(m, r.V); }); });
        return [{ value: 'V menor = ' + fmt(m) + ' m/s', ok: m >= 0.91, sug: 'Reduzca el diámetro de los conductos con flujo más lento para alcanzar 0,91 m/s.' }];
      } },
    { id: 'S15', mod: 'sifon', param: 'Diámetro mínimo en guía técnica', limite: '≥ 200 mm sanitario; ≥ 300 mm pluvial o combinado', fuente: 'RAS D.7.8.2, p. 186. La Res. 0330 (posterior y obligatoria) fija 170 y 280 mm', cond: 'D < mínimo de la guía', sug: 'La Res. 0330 lo permite, pero la guía técnica recomienda un diámetro mayor.', nivel: 'rec', deps: ['conductos', 'lim'],
      ev: function (v, c) { return c.bs.map(function (b) { return { value: 'Conducto ' + b.id + ': ' + fmt(b.D, 0) + ' mm', limit: '≥ ' + c.lim.DminRas + ' mm', ok: b.D >= c.lim.DminRas, sug: 'Considere subir a ' + c.lim.DminRas + ' mm: la Res. 0330 admite ' + c.lim.Dmin + ' mm, pero la guía RAS pide más por riesgo de taponamiento.' }; }); } },

    { id: 'S16', mod: 'sifon', param: 'Paso bajo el obstáculo', limite: 'Clave del tramo inferior + recubrimiento ≤ fondo del obstáculo', fuente: 'Condición física del trazado; recubrimiento por criterio de diseño según el tipo de obstáculo. Distancias a otras redes: RAS D.2.7.4', cond: 'Recubrimiento menor al adoptado', sug: 'Baje la cota del tramo inferior.', nivel: 'rec', deps: ['conductos', 'geom', 'obstaculo'], inputs: ['Zobs', 'Zf'],
      ev: function (v, c) {
        var m = Math.max.apply(null, c.bs.map(function (b) { return b.D / 1000; })), cl = v.Zf + m, rc = v.Zobs - cl;
        return [{ value: 'Clave ' + fmt(cl) + ' m; fondo ' + fmt(v.Zobs) + ' m; recubrimiento ' + fmt(rc) + ' m', limit: '≥ ' + fmt(v.recub) + ' m (' + c.obs.t + ')', ok: rc >= v.recub - 1e-9, sug: 'Baje el tramo inferior ' + fmt(v.recub - rc) + ' m (a cota ' + fmt(v.Zobs - v.recub - m) + ' m) para dejar ' + fmt(v.recub) + ' m de recubrimiento bajo el ' + c.obs.t.toLowerCase() + '.' }];
      } },
    { id: 'S17', mod: 'sifon', param: 'Longitud del tramo inferior frente al obstáculo', limite: 'Lc ≥ ancho del obstáculo', fuente: 'Condición física del trazado (criterio de diseño)', cond: 'Lc menor que el ancho', sug: 'Alargue el tramo inferior.', nivel: 'rec', deps: ['obstaculo'], inputs: ['Lc'],
      ev: function (v) { return [{ value: 'Lc = ' + fmt(v.Lc, 1) + ' m; ancho = ' + fmt(v.Bobs, 1) + ' m', ok: v.Lc >= v.Bobs, sug: 'Alargue el tramo inferior a por lo menos ' + fmt(v.Bobs + 2, 1) + ' m (ancho + 1 m a cada lado) para que los tramos inclinados no queden dentro del obstáculo.' }]; } },
    { id: 'S18', mod: 'sifon', param: 'Borde libre en las cámaras', limite: 'Tapa − nivel a Qmax ≥ 0,30 m', fuente: 'Criterio de diseño del grupo. Res. 0330/2017 Art. 158 num. 6 exige estructuras de conexión al inicio y al final', cond: 'Borde libre menor a 0,30 m', sug: 'Suba la tapa o revise los niveles.', nivel: 'rec', deps: ['camaras'],
      ev: function (v, c) {
        return [['entrada', c.cam.ent, 'Ztce'], ['salida', c.cam.sal, 'Ztcs']].map(function (x) {
          return { value: 'Cámara de ' + x[0] + ': ' + fmt(x[1].bl) + ' m', ok: x[1].bl >= 0.3, sug: 'Suba la tapa de la cámara de ' + x[0] + ' a por lo menos ' + fmt(x[1].NA + 0.3) + ' m: con Qmax el agua llega a ' + fmt(x[1].NA, 3) + ' m.' };
        });
      } },

    /* --- Bombeo --- */
    { id: 'B1', mod: 'bomba', param: 'Número mínimo de bombas', limite: '≥ 2 instaladas, con al menos una en reserva', fuente: 'Res. 0330/2017 Art. 78 y Art. 161 num. 1. También HEC-22 §12.1.4, p. 253', cond: 'Menos de 2 bombas o sin reserva', sug: 'Instale una bomba adicional de las mismas características.', nivel: 'norma', deps: [], inputs: ['nInst', 'nAct'],
      ev: function (v) {
        var op = v.nAct * (v.nSer || 1);
        return [{ value: v.nInst + ' instalada(s), ' + op + ' en operación', ok: v.nInst >= 2 && v.nInst - op >= 1, sug: op > v.nInst ? 'Hay más bombas en operación (' + op + ') que instaladas: instale ' + (op + 1 - v.nInst) + ' más, contando la de reserva.' : 'Instale ' + (Math.max(2, op + 1) - v.nInst) + ' bomba(s) más: siempre debe quedar una de reserva con las mismas características.' }];
      } },
    { id: 'B2', mod: 'bomba', param: 'Capacidad frente al caudal de diseño', limite: 'Q operación ≥ Q diseño', fuente: 'Res. 0330/2017 Art. 78 y Art. 161 num. 1', cond: 'Q operación < Q diseño', sug: 'Use una bomba mayor o reduzca las pérdidas.', nivel: 'norma', deps: ['operacion'], inputs: ['Qd'],
      ev: function (v, c) { return [{ value: fmt(c.op.Qt, 1) + ' L/s frente a ' + fmt(v.Qd, 1) + ' L/s', ok: c.op.Qt >= v.Qd, sug: 'Faltan ' + fmt(v.Qd - c.op.Qt, 1) + ' L/s: elija una bomba con más altura a ' + fmt(v.Qd / v.nAct, 0) + ' L/s (necesita ' + fmt(c.sis.H) + ' m) o aumente el diámetro de impulsión.' }]; } },
    { id: 'B3', mod: 'bomba', param: 'Velocidad en la succión', limite: 'Alcantarillado: 0,9 a 1,5 m/s. Acueducto: ≥ 0,45 m/s y V máx. según D', fuente: 'Res. 0330/2017 Art. 161 num. 2; RAS B.8.4.8.2 y Tabla B.8.2, p. 353-354', cond: 'V fuera del rango', sug: 'Cambie el diámetro de succión.', nivel: 'norma', deps: ['velocidades'], inputs: ['Dsu', 'sistema'],
      ev: function (v, c) {
        var Q = c.op.Qp / 1000, V = c.vel.s;
        if (v.sistema === 'alcantarillado') return [{ value: fmt(V) + ' m/s', limit: '0,9 a 1,5 m/s (Art. 161.2)', ok: V >= 0.9 && V <= 1.5, sug: 'Use un diámetro de succión entre ' + sugD(Q, 1.5) + ' y ' + sugD(Q, 0.9) + ' mm para quedar dentro del rango (hoy ' + fmt(v.Dsu, 0) + ' mm).' }];
        var vm = vsMaxTabla(TAB_VS_B, v.Dsu);
        return [{ value: fmt(V) + ' m/s', limit: '0,45 a ' + fmt(vm) + ' m/s (Tabla B.8.2)', ok: V >= 0.45 && V <= vm, sug: 'Use un diámetro de succión entre ' + sugD(Q, vm) + ' y ' + sugD(Q, 0.45) + ' mm (hoy ' + fmt(v.Dsu, 0) + ' mm).' }];
      } },
    { id: 'B4', mod: 'bomba', param: 'Velocidad en la impulsión', limite: 'Alcantarillado: 1,5 a 2,4 m/s. Acueducto: 1,0 a menos de 6 m/s', fuente: 'Res. 0330/2017 Art. 161 num. 3; RAS B.8.4.8.3, p. 354', cond: 'V fuera del rango', sug: 'Cambie el diámetro de impulsión.', nivel: 'norma', deps: ['velocidades'], inputs: ['Dim', 'sistema'],
      ev: function (v, c) {
        var Q = c.op.Qt / 1000, V = c.vel.i;
        if (v.sistema === 'alcantarillado') return [{ value: fmt(V) + ' m/s', limit: '1,5 a 2,4 m/s (Art. 161.3)', ok: V >= 1.5 && V <= 2.4, sug: 'Use un diámetro de impulsión entre ' + sugD(Q, 2.4) + ' y ' + sugD(Q, 1.5) + ' mm (hoy ' + fmt(v.Dim, 0) + ' mm).' }];
        return [{ value: fmt(V) + ' m/s', limit: '1,0 a < 6 m/s (B.8.4.8.3)', ok: V >= 1.0 && V < 6, sug: 'Use un diámetro de impulsión entre ' + sugD(Q, 6) + ' y ' + sugD(Q, 1) + ' mm (hoy ' + fmt(v.Dim, 0) + ' mm).' }];
      } },
    { id: 'B5', mod: 'bomba', param: 'NPSH disponible frente a requerido', limite: 'NPSHd ≥ NPSHr + 0,5 m', fuente: 'Res. 0330/2017 Art. 161 num. 4', cond: 'NPSHd < NPSHr + 0,5 m', sug: 'Baje la bomba, reduzca las pérdidas en succión o suba el nivel mínimo.', nivel: 'norma', deps: ['npsh'],
      ev: function (v, c) {
        var f = c.npsh.r + 0.5 - c.npsh.a;
        return [{ value: 'NPSHd ' + fmt(c.npsh.a) + ' m; NPSHr ' + fmt(c.npsh.r) + ' m; margen ' + fmt(c.npsh.margen) + ' m', ok: c.npsh.a >= c.npsh.r + 0.5, sug: 'Baje el eje de la bomba ' + fmt(f) + ' m (a cota ' + fmt(v.Zeje - f) + ' m) o suba el nivel mínimo del pozo esa altura. Hay riesgo de cavitación.' }];
      } },
    { id: 'B6', mod: 'bomba', param: 'Margen de NPSH en guía técnica', limite: 'NPSHr ≤ 80 % de NPSHd, y diferencia ≥ 0,5 m', fuente: 'RAS D.8.5.3.2, p. 213; RAS B.8.5.3.2, p. 357', cond: 'NPSHr > 0,8·NPSHd', sug: 'Aumente el NPSH disponible.', nivel: 'rec', deps: ['npsh'],
      ev: function (v, c) {
        var req = c.npsh.r / 0.8;
        return [{ value: 'NPSHr/NPSHd = ' + fmt(c.npsh.a > 0 ? c.npsh.r / c.npsh.a * 100 : Infinity, 0) + ' %', ok: c.npsh.a > 0 && c.npsh.r <= 0.8 * c.npsh.a && c.npsh.margen >= 0.5, sug: 'Lleve el NPSH disponible a por lo menos ' + fmt(Math.max(req, c.npsh.r + 0.5)) + ' m bajando la bomba o reduciendo pérdidas en succión.' }];
      } },
    { id: 'B7', mod: 'bomba', param: 'Eficiencia en conjunto bomba y motor', limite: '≥ 50 % (P ≤ 5 kW); ≥ 65 % (5 < P ≤ 100 kW); ≥ 70 % (P > 100 kW)', fuente: 'Res. 0330/2017 Art. 161 num. 6', cond: 'η conjunto < mínimo', sug: 'Escoja una bomba cuyo mejor punto quede cerca del punto de operación.', nivel: 'norma', sistema: 'alcantarillado', deps: ['potencia'], inputs: ['sistema'],
      ev: function (v, c) {
        if (v.sistema !== 'alcantarillado') return null;
        var m = etaMinArt161(c.pot.Pm);
        return [{ value: fmt(c.pot.etaConj, 1) + ' % a ' + fmt(c.pot.Pm) + ' kW', limit: '≥ ' + m + ' %', ok: c.pot.etaConj >= m, sug: 'Suba la eficiencia conjunta a ' + m + ' %: escoja una bomba con su mejor punto cerca de ' + fmt(c.op.Qp, 0) + ' L/s o un motor más eficiente.' }];
      } },
    { id: 'B8', mod: 'bomba', param: 'Operación cerca de la máxima eficiencia', limite: 'Criterio adoptado: η ≥ 90 % de η máx.', fuente: 'Exigencia cualitativa de Res. 0330/2017 Art. 161 num. 8; RAS B.8.5.1, p. 355; HEC-22 p. 252. El 90 % es criterio de diseño del grupo, no un límite normativo', cond: 'η < 0,9·η máx', sug: 'Escoja otra bomba.', nivel: 'rec', deps: ['potencia'],
      ev: function (v, c) { return [{ value: fmt(c.pot.eta, 1) + ' % frente a η máx ' + fmt(c.etaMax, 1) + ' %', ok: c.pot.eta >= 0.9 * c.etaMax, sug: 'La bomba opera lejos de su mejor punto: escoja otra o ajuste el sistema para acercarse al caudal de ' + fmt(c.etaMax, 1) + ' %.' }]; } },
    { id: 'B9', mod: 'bomba', param: 'Sumergencia', limite: 'Alcantarillado: S ≥ 2,5·Ds. Acueducto: S > 2·Ds y ≥ 0,50 m', fuente: 'Res. 0330/2017 Art. 161 num. 7; RAS B.8.4.7.2, p. 352', cond: 'S menor que el mínimo', sug: 'Baje la boca de succión o suba el nivel mínimo.', nivel: 'norma', deps: ['sumergencia'], inputs: ['sistema'],
      ev: function (v, c) {
        var S = c.sum.S;
        if (v.sistema === 'alcantarillado') return [{ value: 'S = ' + fmt(S) + ' m', limit: '≥ ' + fmt(c.sum.req25) + ' m (2,5·Ds)', ok: S >= c.sum.req25 - 1e-9, sug: 'Baje la boca de succión ' + fmt(c.sum.req25 - S) + ' m (a cota ' + fmt(v.Zboca - (c.sum.req25 - S)) + ' m) o suba el nivel mínimo a ' + fmt(v.Zboca + c.sum.req25) + ' m. Evita vórtices y entrada de aire.' }];
        var r = Math.max(c.sum.req2, 0.5);
        return [{ value: 'S = ' + fmt(S) + ' m', limit: '> ' + fmt(r) + ' m', ok: S > c.sum.req2 && S >= 0.5, sug: 'Baje la boca de succión ' + fmt(r - S) + ' m o suba el nivel mínimo. Evita vórtices y entrada de aire.' }];
      } },
    { id: 'B10', mod: 'bomba', param: 'Separación de la succión al fondo', limite: '0,5 a 1,5 veces Ds, y ≥ 0,25 m', fuente: 'RAS D.8.4.7.3, p. 206; RAS B.8.4.7.3, p. 353', cond: 'Separación fuera de rango', sug: 'Ajuste la cota de la boca de succión.', nivel: 'rec', deps: ['sumergencia'],
      ev: function (v, c) {
        var d = v.Dsu / 1000, f = c.sum.fondo, lo = Math.max(0.5 * d, 0.25), hi = 1.5 * d;
        return [{ value: fmt(f) + ' m', limit: fmt(lo) + ' a ' + fmt(hi) + ' m', ok: f >= lo && f <= hi, sug: 'Ubique la boca de succión entre las cotas ' + fmt(v.Zfondo + lo) + ' y ' + fmt(v.Zfondo + hi) + ' m.' }];
      } },
    { id: 'B11', mod: 'bomba', param: 'Diámetro de succión frente a impulsión', limite: 'Ds ≥ Di + 50 mm', fuente: 'RAS D.8.4.8.1, p. 207; RAS B.8.4.8.1, p. 353', cond: 'Ds < Di + 50 mm', sug: 'Aumente el diámetro de succión.', nivel: 'rec', deps: [], inputs: ['Dsu', 'Dim'],
      ev: function (v) { return [{ value: 'Ds ' + fmt(v.Dsu, 0) + ' mm, Di ' + fmt(v.Dim, 0) + ' mm', ok: v.Dsu >= v.Dim + 50, sug: 'Lleve la succión a por lo menos ' + fmt(v.Dim + 50, 0) + ' mm.' }]; } },
    { id: 'B12', mod: 'bomba', param: 'Diámetro mínimo de succión', limite: '≥ 100 mm', fuente: 'RAS D.8.4.8.1, p. 207', cond: 'Ds < 100 mm', sug: 'Aumente el diámetro de succión.', nivel: 'rec', sistema: 'alcantarillado', deps: [], inputs: ['Dsu', 'sistema'],
      ev: function (v) { if (v.sistema !== 'alcantarillado') return null; return [{ value: fmt(v.Dsu, 0) + ' mm', ok: v.Dsu >= 100, sug: 'Use una succión de 100 mm o más.' }]; } },
    { id: 'B13', mod: 'bomba', param: 'Sobrepresión por golpe de ariete', limite: 'ΔH ≤ 30 % de la altura dinámica total', fuente: 'RAS D.8.5.7, p. 219', cond: 'ΔH > 0,30·H', sug: 'Alargue la maniobra o instale un dispositivo de control.', nivel: 'rec', deps: ['ariete'],
      ev: function (v, c) {
        var Treq = 2 * v.Lim * c.ar.V / (G * 0.3 * c.op.H);
        return [{ value: 'ΔH = ' + fmt(c.ar.dH) + ' m (' + fmt(c.ar.ratio * 100, 0) + ' % de H)', limit: '≤ ' + fmt(0.3 * c.op.H) + ' m', ok: c.ar.ratio <= 0.3, sug: 'Lleve el cierre a T ≥ ' + fmt(Treq, 0) + ' s o instale tanque hidroneumático, almenara o volante de inercia. RAS D.8.5.7 no admite cheque como control.' }];
      } },
    { id: 'B14', mod: 'bomba', param: 'Resistencia de la tubería al transitorio', limite: '1,3·(H + ΔH) ≤ presión admisible', fuente: 'Res. 0330/2017 Art. 56 (factor 1,3 para sistemas por bombeo)', cond: '1,3·(H + ΔH) > PN', sug: 'Use una tubería de mayor presión o reduzca el golpe de ariete.', nivel: 'norma', deps: ['ariete'], inputs: ['PN'],
      ev: function (v, c) {
        var r = 1.3 * c.ar.Hmax;
        return [{ value: '1,3·' + fmt(c.ar.Hmax) + ' = ' + fmt(r) + ' m.c.a.', limit: '≤ ' + fmt(v.PN, 0) + ' m.c.a.', ok: r <= v.PN, sug: 'Use tubería con presión admisible de al menos ' + fmt(r, 0) + ' m.c.a. o controle el transitorio para bajar ΔH.' }];
      } },
    { id: 'B15', mod: 'bomba', param: 'Subpresión por golpe de ariete', limite: 'Presión mínima > −(Patm − Pv)/γ; en lo posible, sin presión negativa', fuente: 'RAS B.6.5.8.4, p. 180; RAS D.8.5.7, p. 219', cond: 'Presión mínima bajo el límite', sug: 'Instale ventosas de doble efecto o tanque de compensación.', nivel: 'rec', deps: ['ariete', 'npsh'],
      ev: function (v, c) {
        var l = -(c.npsh.patm - c.npsh.pv);
        return [{ value: 'Mínima = ' + fmt(c.ar.Hmin) + ' m.c.a.', limit: '> ' + fmt(l) + ' m.c.a.; ideal ≥ 0', ok: c.ar.Hmin >= 0, sug: c.ar.Hmin < l ? 'Se alcanza presión de vapor: habrá separación de columna. Instale tanque de compensación o válvula de admisión de aire.' : 'Hay presión negativa: controle la parada con ventosas de doble efecto o alargue la maniobra.' }];
      } },
    { id: 'B16', mod: 'bomba', param: 'Volumen útil del pozo húmedo', limite: 'V ≥ 2,5 × Q bombeo (m³/min)', fuente: 'Res. 0330/2017 Art. 160 num. 7', cond: 'V < V mínimo', sug: 'Aumente el área del pozo o la franja de niveles.', nivel: 'norma', sistema: 'alcantarillado', deps: ['pozo'], inputs: ['sistema'],
      ev: function (v, c) {
        if (v.sistema !== 'alcantarillado') return null;
        var hf = v.Znmax - v.Znmin;
        return [{ value: fmt(c.pozo.Vol) + ' m³', limit: '≥ ' + fmt(c.pozo.Vreq) + ' m³', ok: c.pozo.Vol >= c.pozo.Vreq, sug: 'Con ' + fmt(hf) + ' m entre niveles, el área debe ser al menos ' + fmt(c.pozo.Vreq / (hf || 1)) + ' m² (hoy ' + fmt(v.LB * v.BB) + ' m²), o aumente la franja de niveles.' }];
      } },
    { id: 'B17', mod: 'bomba', param: 'Tiempo de retención en el pozo', limite: '≤ 20 min agua residual; ≤ 30 min agua lluvia', fuente: 'Res. 0330/2017 Art. 160 num. 8', cond: 'Retención mayor al límite', sug: 'Reduzca el volumen útil.', nivel: 'norma', sistema: 'alcantarillado', deps: ['pozo'], inputs: ['sistema', 'agua'],
      ev: function (v, c) {
        if (v.sistema !== 'alcantarillado') return null;
        var m = v.agua === 'lluvia' ? 30 : 20;
        return [{ value: fmt(c.pozo.tRet) + ' min', limit: '≤ ' + m + ' min', ok: c.pozo.tRet <= m, sug: 'Reduzca el volumen útil a máximo ' + fmt(m * 60 * v.Qd / 1000) + ' m³ para evitar olores y lodos.' }];
      } },
    { id: 'B18', mod: 'bomba', param: 'Velocidad de llegada al pozo', limite: 'Mínimo 0,60 m/s (Art. 160.6) y máximo 0,70 m/s (RAS)', fuente: 'Res. 0330/2017 Art. 160 num. 6; RAS D.8.4.7.4, p. 207', cond: 'V fuera de 0,60 a 0,70 m/s', sug: 'Ajuste el diámetro de llegada.', nivel: 'norma', sistema: 'alcantarillado', deps: ['pozo'], inputs: ['sistema'],
      ev: function (v, c) {
        if (v.sistema !== 'alcantarillado') return null;
        var Q = v.Qd / 1000;
        return [{ value: fmt(c.pozo.Vent) + ' m/s', limit: '0,60 a 0,70 m/s', ok: c.pozo.Vent >= 0.6 && c.pozo.Vent <= 0.7, sug: 'Use un diámetro de llegada entre ' + sugD(Q, 0.7) + ' y ' + sugD(Q, 0.6) + ' mm (hoy ' + fmt(v.Dla, 0) + ' mm).' }];
      } },
    { id: 'B19', mod: 'bomba', param: 'Velocidad de entrada al pozo de succión', limite: '≤ 0,7 m/s', fuente: 'RAS B.8.4.7.4, p. 353', cond: 'V > 0,7 m/s', sug: 'Aumente el diámetro de llegada.', nivel: 'rec', sistema: 'acueducto', deps: ['pozo'], inputs: ['sistema'],
      ev: function (v, c) {
        if (v.sistema !== 'acueducto') return null;
        return [{ value: fmt(c.pozo.Vent) + ' m/s', ok: c.pozo.Vent <= 0.7, sug: 'Use un diámetro de llegada de al menos ' + sugD(v.Qd / 1000, 0.7) + ' mm.' }];
      } },
    { id: 'B20', mod: 'bomba', param: 'Arranques por hora y ciclo de bombeo', limite: '3 a 5 arranques/h (horizontal o vertical); 10 (sumergible); ciclo ≥ 5 min', fuente: 'RAS D.8.4.7.1 num. 9, p. 206', cond: 'Arranques mayores al máximo', sug: 'Aumente el volumen útil del pozo.', nivel: 'rec', deps: ['pozo'], inputs: ['tipoB'],
      ev: function (v, c) {
        var m = v.tipoB === 'sumergible' ? 10 : 5;
        var req = Math.max(c.op.Qp / 1000 * 60 * (60 / m) / 60 / 4, c.op.Qp / 1000 * 60 * 5 / 4);
        return [{ value: fmt(c.pozo.arr, 1) + ' arranques/h; ciclo ' + fmt(c.pozo.ciclo) + ' min', limit: '≤ ' + m + ' arranques/h', ok: c.pozo.arr <= m && c.pozo.ciclo >= 5, sug: 'Lleve el volumen útil a por lo menos ' + fmt(req) + ' m³ para no dañar el motor.' }];
      } },
    { id: 'B21', mod: 'bomba', param: 'Variador de frecuencia', limite: 'Obligatorio; frecuencia ≥ 40 Hz', fuente: 'Res. 0330/2017 Art. 161 num. 5', cond: 'Sin variador', sug: 'Incluya variadores de frecuencia.', nivel: 'norma', sistema: 'alcantarillado', deps: [], inputs: ['sistema', 'vfd'],
      ev: function (v) { if (v.sistema !== 'alcantarillado') return null; return [{ value: v.vfd === 'si' ? 'Sí' : 'No', ok: v.vfd === 'si', sug: 'Incluya un variador de frecuencia que trabaje a 40 Hz o más.' }]; } },
    { id: 'B22', mod: 'bomba', param: 'Respaldo energético', limite: '≥ 12 horas de operación continua', fuente: 'Res. 0330/2017 Art. 161 num. 10', cond: 'Sin respaldo', sug: 'Incluya planta eléctrica o doble alimentación.', nivel: 'norma', sistema: 'alcantarillado', deps: [], inputs: ['sistema', 'respaldo'],
      ev: function (v) { if (v.sistema !== 'alcantarillado') return null; return [{ value: v.respaldo === 'si' ? 'Sí' : 'No', ok: v.respaldo === 'si', sug: 'Incluya respaldo (planta eléctrica o doble alimentación) para 12 h continuas.' }]; } },
    { id: 'B23', mod: 'bomba', param: 'Punto de operación dentro de la curva', limite: 'Q por bomba dentro del rango de la curva suministrada', fuente: 'Validez física del ajuste. RAS B.8.5.3.3, p. 357', cond: 'Extrapolación de la curva', sug: 'Pida al fabricante datos en ese rango.', nivel: 'rec', deps: ['operacion'],
      ev: function (v, c) { return [{ value: fmt(c.op.Qp, 1) + ' L/s por bomba (curva hasta ' + fmt(c.qMaxCurva, 0) + ' L/s)', ok: c.op.Qp <= c.qMaxCurva, sug: 'El resultado es una extrapolación: pida al fabricante puntos hasta ' + fmt(c.op.Qp * 1.2, 0) + ' L/s.' }]; } },
    { id: 'B24', mod: 'bomba', param: 'Caudal de operación cercano al de diseño', limite: 'Q operación entre Qd y Qd + 10 %', fuente: 'Criterio del proyecto: el caudal de diseño debe quedar cerca del punto de funcionamiento. Res. 0330/2017 Art. 161 num. 8 pide operar cerca de la máxima eficiencia', cond: 'Q operación > 1,10·Qd o < Qd', sug: 'Ajuste con variador, cambie de bomba o de arreglo.', nivel: 'rec', deps: ['operacion', 'arreglo'], inputs: ['Qd'],
      ev: function (v, c) {
        var d = (c.op.Qt - v.Qd) / v.Qd, vf = velocidadParaQd(v, c, v.nAct, v.nSer);
        var sug = d < 0 ? 'Falta caudal: ' + c.altTxt : (vf && vf.Hz >= 40 ? 'Con el variador a ' + fmt(vf.Hz, 1) + ' Hz (' + fmt(vf.r * 100, 0) + ' % de la velocidad) el punto cae en Qd = ' + fmt(v.Qd, 1) + ' L/s con H = ' + fmt(vf.Hreq * v.nSer) + ' m. ' : 'Ni con el variador a 40 Hz se llega a Qd: ') + (vf && vf.Hz >= 40 ? '' : c.altTxt);
        return [{ value: fmt(c.op.Qt, 1) + ' L/s frente a ' + fmt(v.Qd, 1) + ' L/s (' + (d >= 0 ? '+' : '') + fmt(d * 100, 0) + ' %)', ok: d >= 0 && d <= 0.10, sug: sug }];
      } },
    { id: 'B25', mod: 'bomba', param: 'Posición de la salida en el tanque de descarga', limite: 'Ahogada: clave ≤ nivel − 0,10 m. Libre: batea ≥ nivel + 0,10 m', fuente: 'Validez física del cálculo de Hs (RAS B.8.5.2, Ec. B.8.1, p. 356)', cond: 'La salida no corresponde al tipo de descarga escogido', sug: 'Ajuste la cota de impulsión.', nivel: 'rec', deps: ['tanque'], inputs: ['Zimp', 'descarga'],
      ev: function (v, c) {
        if (v.descarga === 'libre') return [{ value: 'Batea de la salida ' + fmt(c.tq.batea) + ' m; nivel ' + fmt(v.Zdis) + ' m', ok: c.tq.batea >= v.Zdis + 0.1, sug: 'Suba la salida a cota de eje ≥ ' + fmt(v.Zdis + 0.1 + v.Dim / 2000) + ' m o cambie a descarga ahogada.' }];
        return [{ value: 'Clave de la salida ' + fmt(c.tq.clave) + ' m; nivel ' + fmt(v.Zdis) + ' m', ok: c.tq.clave <= v.Zdis - 0.1 && c.tq.batea >= v.Zftq + 0.1, sug: c.tq.batea < v.Zftq + 0.1 ? 'La salida queda bajo el fondo del tanque: baje el fondo a ' + fmt(c.tq.batea - 0.3) + ' m.' : 'Baje la salida a cota de eje ≤ ' + fmt(v.Zdis - 0.1 - v.Dim / 2000) + ' m para que quede ahogada.' }];
      } },
    { id: 'B26', mod: 'bomba', param: 'Válvulas en la impulsión de cada bomba', limite: 'Cheque y válvula de cierre en la impulsión', fuente: 'Práctica de diseño: la cheque evita el flujo inverso al parar la bomba y la válvula de cierre permite aislarla. Criterio del grupo', cond: 'Falta la cheque o la válvula de cierre', sug: 'Agregue los accesorios que faltan.', nivel: 'rec', deps: ['accesorios'], inputs: ['kmodo'],
      ev: function (v, c) {
        if (c.acc.manual) return null;
        var ids = c.acc.im.items.map(function (a) { return a.id; });
        var ch = ids.indexOf('v_cheq') >= 0, ci = ids.indexOf('v_comp') >= 0 || ids.indexOf('v_mari') >= 0;
        return [{ value: 'Cheque: ' + (ch ? 'sí' : 'no') + '; cierre: ' + (ci ? 'sí' : 'no'), ok: ch && ci, sug: 'Agregue ' + [!ch ? 'una válvula de cheque' : '', !ci ? 'una válvula de compuerta o mariposa' : ''].filter(Boolean).join(' y ') + ' en la impulsión de cada bomba.' }];
      } }
  ];

  function calcError(msg, sug) { var e = new Error(msg); e.calc = true; e.sug = sug; return e; }

  /* ---------- Ejecución de la cadena ---------- */
  function calculate(mod, raw) {
    var vals = Object.assign({}, raw);
    var val = validate(mod, vals);
    var v = val.values;
    var steps = mod === 'sifon' ? STEPS_SIFON : STEPS_BOMBA;
    var ctx = {}, nodes = {}, order = [];
    var labelOf = {};
    FIELDS[mod].forEach(function (f) { labelOf[f.k] = f; });

    steps.forEach(function (s) {
      var node = { id: s.id, title: s.title, src: s.src, inputs: s.inputs, deps: s.deps, status: 'ok', value: '', lines: [], why: [], sug: '' };
      order.push(node); nodes[s.id] = node;
      var reasons = [];
      s.inputs.forEach(function (k) {
        var f = labelOf[k];
        if (!f || (f.when && !f.when(vals))) return;
        if (val.missing[k]) reasons.push({ tipo: 'falta', k: k, text: 'Falta "' + f.label + '" (' + f.unit + ')' });
        else if (val.invalid[k]) reasons.push({ tipo: 'invalido', k: k, text: '"' + f.label + '" ' + val.invalid[k].why });
      });
      s.deps.forEach(function (d) {
        if (nodes[d] && nodes[d].status !== 'ok') reasons.push({ tipo: 'cadena', dep: d, text: 'Depende de "' + nodes[d].title + '", que no se pudo calcular' });
      });
      if (reasons.length) { node.status = 'blocked'; node.why = reasons; return; }
      try {
        var r = s.run(v, ctx);
        node.value = r.value; node.lines = r.lines;
      } catch (e) {
        if (!e.calc) throw e;
        node.status = 'error'; node.why = [{ tipo: 'calculo', text: e.message }]; node.sug = e.sug || '';
      }
    });

    /* Verificaciones */
    var checks = [];
    CHECKS.filter(function (ch) { return ch.mod === mod; }).forEach(function (ch) {
      var faltan = [];
      (ch.inputs || []).forEach(function (k) {
        var f = labelOf[k];
        if (!f || (f.when && !f.when(vals))) return;
        if (val.missing[k] || val.invalid[k]) faltan.push(f.label);
      });
      (ch.deps || []).forEach(function (d) { if (nodes[d] && nodes[d].status !== 'ok') faltan.push(nodes[d].title); });
      if (ch.sistema && vals.sistema && ch.sistema !== vals.sistema) {
        checks.push({ ch: ch, estado: 'na', value: 'No aplica a sistema de ' + vals.sistema, limit: ch.limite, sug: '' });
        return;
      }
      if (faltan.length) {
        checks.push({ ch: ch, estado: 'pend', value: 'Sin evaluar: falta ' + faltan.join(', '), limit: ch.limite, sug: '' });
        return;
      }
      var r = ch.ev(v, ctx);
      if (!r) { checks.push({ ch: ch, estado: 'na', value: 'No aplica', limit: ch.limite, sug: '' }); return; }
      r.forEach(function (x) {
        checks.push({ ch: ch, estado: x.ok ? 'ok' : (ch.nivel === 'norma' ? 'fail' : 'warn'), value: x.value, limit: x.limit || ch.limite, sug: x.ok ? '' : x.sug });
      });
    });

    /* Problemas de datos (R7: datos inválidos y faltantes) */
    var dataIssues = [];
    Object.keys(val.missing).forEach(function (k) {
      var f = val.missing[k];
      var bloquea = order.filter(function (n) { return n.status === 'blocked' && n.inputs.indexOf(k) >= 0; }).map(function (n) { return n.title; });
      dataIssues.push({ k: k, tipo: 'falta', label: f.label, unit: f.unit, msg: 'Falta el dato.', sug: 'Escriba el valor en ' + (f.unit || 'la unidad indicada') + '.', fuente: 'Validez física', bloquea: bloquea });
    });
    Object.keys(val.invalid).forEach(function (k) {
      var i = val.invalid[k];
      var bloquea = order.filter(function (n) { return n.status === 'blocked' && n.inputs.indexOf(k) >= 0; }).map(function (n) { return n.title; });
      dataIssues.push({ k: k, tipo: 'invalido', label: i.field.label, unit: i.field.unit, msg: 'El valor ' + i.why + '.', sug: 'Corrija el valor' + (i.field.gt !== undefined ? ': debe ser mayor que ' + i.field.gt : '') + (i.field.unit ? ' (' + i.field.unit + ')' : '') + '.', fuente: 'Validez física', bloquea: bloquea });
    });

    var complete = order.every(function (n) { return n.status === 'ok'; });
    var autos = Object.keys(val.auto).map(function (k) { var a = val.auto[k]; return { k: k, label: a.field.label, unit: a.field.unit, v: a.v, how: a.how, src: a.src }; });
    return { mod: mod, vals: vals, v: v, val: val, ctx: ctx, nodes: nodes, order: order, checks: checks, dataIssues: dataIssues, complete: complete, labelOf: labelOf, autos: autos };
  }

  /* ---------- Tablas descriptivas (pantalla, PDF y Excel) ---------- */
  function sifonTablas(res) {
    var c = res.ctx, v = res.v;
    if (!c.cam || !c.casos || !c.g) return null;
    var Dmax = Math.max.apply(null, c.bs.map(function (b) { return b.D / 1000; }));
    var cotas = [
      ['Tapa de la cámara de entrada', v.Ztce, res.val.auto.Ztce ? 'Autocompletada' : 'Dato'],
      ['Nivel de agua en cámara de entrada, Qmax', c.casos[2].NAe, 'Calculado'],
      ['Nivel de agua en cámara de entrada, Qmed', c.casos[1].NAe, 'Calculado'],
      ['Nivel de agua en cámara de entrada, Qmin', c.casos[0].NAe, 'Calculado']
    ];
    c.cam.ent.comp.forEach(function (k) { if (k.cresta !== null) cotas.push(['Cresta del vertedero del conducto ' + k.id, k.cresta, 'Calculado (entra con ' + (k.id === 2 ? 'Qmed' : 'Qmax') + ')']); });
    cotas.push(['Batea del colector de llegada', v.Ze, 'Dato']);
    cotas.push(['Clave de los conductos en la cámara de entrada', v.Zci + Dmax, 'Batea + D mayor']);
    cotas.push(['Fondo de la cámara de entrada (batea de los conductos)', v.Zci, res.val.auto.Zci ? 'Autocompletada' : 'Dato']);
    cotas.push(['Superficie del obstáculo (' + DESCR.obst[v.obst].znivel + ')', v.Znivel, 'Dato']);
    cotas.push(['Fondo del obstáculo (' + DESCR.obst[v.obst].zobs + ')', v.Zobs, 'Dato']);
    cotas.push(['Clave del tramo inferior', v.Zf + Dmax, 'Recubrimiento ' + fmt(v.Zobs - v.Zf - Dmax) + ' m']);
    cotas.push(['Batea del tramo inferior (punto más bajo)', v.Zf, res.val.auto.Zf ? 'Autocompletada' : 'Dato']);
    cotas.push(['Fondo de la cámara de salida (batea de los conductos)', v.Zcs, res.val.auto.Zcs ? 'Autocompletada' : 'Dato']);
    cotas.push(['Nivel de agua en cámara de salida, Qmax', c.casos[2].NAs, 'Calculado']);
    cotas.push(['Batea del colector de salida', v.Zs, 'Dato']);
    cotas.push(['Tapa de la cámara de salida', v.Ztcs, res.val.auto.Ztcs ? 'Autocompletada' : 'Dato']);
    var pend = [
      ['Colector de llegada', '—', '—', v.Se, '—', '—'],
      ['Tramo que baja', v.Ld, c.g.dzB, c.g.pB, c.g.thB, c.g.Lb],
      ['Tramo inferior', v.Lc, 0, 0, 0, v.Lc],
      ['Tramo que sube', v.La, c.g.dzS, c.g.pS, c.g.thS, c.g.Ls],
      ['Colector de salida', '—', '—', v.Ss, '—', '—']
    ];
    var funcion = ['Siempre en servicio: lleva Qmin', 'Entra cuando el caudal pasa de Qmin', 'Entra cuando el caudal pasa de Qmed', 'Entra con caudales altos'];
    var mat = MATERIALS[v.mat];
    var tubos = c.bs.map(function (b, i) {
      var D = b.D / 1000;
      var Qs = c.casos.map(function (o) { return o.barrels[i] ? o.barrels[i].Q * 1000 : 0; });
      var Vs = c.casos.map(function (o) { return o.barrels[i] ? o.barrels[i].V : 0; });
      return { id: b.id, D: b.D, mat: mat ? mat.label : 'Otro', A: areaC(D), L: c.g.L, Qs: Qs, Vs: Vs, tope: c.topes ? c.topes[i] : null, bE: v.Zci, bS: v.Zcs, clave: v.Zf + D, fn: v.reparto === 'vert' ? funcion[i] : 'Paralelo libre: reparto por igual pérdida' };
    });
    var vertTxt = (c.crestas && c.crestas.length) ? 'Vertederos de cresta delgada en los tabiques, Q = 1,84·L·h^1,5 (Francis). ' + c.crestas.map(function (x) { return 'Conducto ' + x.id + ': cresta ' + fmt(x.cresta, 3) + ' m' + (x.b ? ', L = ' + fmt(x.b) + ' m, h = ' + fmt(x.h, 3) + ' m' : ''); }).join('; ') + '.' : 'Sin vertederos: ' + (c.bs.length < 2 ? 'hay un solo conducto.' : 'el reparto es libre en paralelo.');
    var desc = [
      ['Obstáculo', DESCR.obst[v.obst].t, DESCR.obst[v.obst].d + ' Recubrimiento adoptado sobre la clave: ' + fmt(v.recub) + ' m.'],
      ['Cámara de entrada', DESCR.camE[v.camE].t, DESCR.camE[v.camE].d + ' Interior ' + fmt(c.cam.ent.B) + ' × ' + fmt(c.cam.ent.L) + ' m y ' + fmt(c.cam.ent.H) + ' m de alto. Recibe el colector de llegada Ø' + fmt(v.De, 0) + ' mm a cota ' + fmt(v.Ze) + ' m, con pendiente ' + fmt(v.Se) + ' % y n = ' + fmt(v.ne, 3) + '; de su fondo salen ' + c.bs.length + ' conducto(s): ' + c.bs.map(function (b) { return 'Ø' + fmt(b.D, 0); }).join(', ') + ' mm.'],
      ['Separadores', DESCR.sep[v.sep].t, DESCR.sep[v.sep].d + ' Espesor ' + fmt(v.esep) + ' m; ' + Math.max(c.bs.length - 1, 0) + ' separador(es) en cada cámara.'],
      ['Vertederos', v.reparto === 'vert' ? 'Regulación por incrementos' : 'No se usan', vertTxt],
      ['Cámara de salida', DESCR.camS[v.camS].t, DESCR.camS[v.camS].d + ' Interior ' + fmt(c.cam.sal.B) + ' × ' + fmt(c.cam.sal.L) + ' m; entrega al colector Ø' + fmt(v.Ds, 0) + ' mm a cota ' + fmt(v.Zs) + ' m.'],
      ['Tubería del sifón', mat ? mat.label : 'Otro material', (mat ? mat.d + ' ' : '') + 'ks = ' + fmt(v.ks, 4) + ' mm, n = ' + fmt(v.n, 3) + '. Sin cambios de diámetro a lo largo de cada conducto (RAS D.7.8.4).'],
      ['Rejilla', v.rejilla === 'si' ? 'Sí' : 'No', v.rejilla === 'si' ? 'Retiene sólidos antes de los vertederos; obligatoria si D ≤ 760 mm (Art. 158 num. 7).' : 'Sin rejilla: revise la verificación S10.']
    ];
    return { cotas: cotas, pend: pend, tubos: tubos, desc: desc };
  }
  function bombaTablas(res) {
    var c = res.ctx, v = res.v;
    if (!c.acc || !c.sis) return null;
    var base = c.opSis || c.sis, Qt = c.op ? c.op.Qt : v.Qd;
    var g2s = base.s.g2, g2i = base.i.g2;
    var acc = [];
    c.acc.su.items.forEach(function (a) { acc.push(['Succión', a.t, a.n, a.K, a.nK, a.nK * g2s]); });
    if (c.acc.manual) acc.push(['Succión', 'ΣK escrito por el usuario', '—', '—', v.Ksu, v.Ksu * g2s]);
    c.acc.im.items.forEach(function (a) { acc.push(['Impulsión', a.t, a.n, a.K, a.nK, a.nK * g2i]); });
    if (c.acc.manual) acc.push(['Impulsión', 'ΣK escrito por el usuario', '—', '—', v.Kim, v.Kim * g2i]);
    acc.push(['Impulsión', 'Salida al tanque (se cuenta como Hv)', 1, 1, 1, g2i]);
    var alc = v.sistema !== 'acueducto';
    var tub = [
      ['Función', 'Lleva el agua del pozo a la bomba. Trabaja con presión baja: se cuida la cavitación (NPSH) y la entrada de aire.', 'Lleva el agua de la bomba al tanque de descarga. Trabaja con presión alta: se cuida el golpe de ariete.'],
      ['Cantidad', v.nAct * (v.nSer || 1) + ' (una por bomba)', '1 (común a las bombas)'],
      ['Diámetro interno', fmt(v.Dsu, 0) + ' mm', fmt(v.Dim, 0) + ' mm'],
      ['Longitud', fmt(v.Lsu, 1) + ' m', fmt(v.Lim, 1) + ' m'],
      ['Material', MATERIALS[v.mat] ? MATERIALS[v.mat].label : 'Otro', MATERIALS[v.mat] ? MATERIALS[v.mat].label : 'Otro'],
      ['Caudal', fmt(Qt / v.nAct, 1) + ' L/s por bomba', fmt(Qt, 1) + ' L/s'],
      ['Velocidad', fmt(base.s.V) + ' m/s', fmt(base.i.V) + ' m/s'],
      ['Rango de velocidad', alc ? '0,9 a 1,5 m/s (Art. 161.2)' : '0,45 m/s a la máxima de la Tabla B.8.2', alc ? '1,5 a 2,4 m/s (Art. 161.3)' : '1,0 a menos de 6 m/s (B.8.4.8.3)'],
      ['ΣK de accesorios', fmt(v.Ksu), fmt(v.Kim) + ' + salida 1,0'],
      ['Pérdida por fricción', fmt(base.s.hf, 3) + ' m', fmt(base.i.hf, 3) + ' m'],
      ['Pérdida en accesorios', fmt(base.s.hm, 3) + ' m', fmt(base.i.hm + g2i, 3) + ' m'],
      ['Cota de inicio → fin', fmt(v.Zboca) + ' (boca) → ' + fmt(v.Zeje) + ' m (eje)', fmt(v.Zeje) + ' (eje) → ' + fmt(v.Zimp) + ' m (salida)'],
      ['Color en el esquema', 'Verde azulado', 'Naranja']
    ];
    var cotas = [
      ['Nivel de agua en la impulsión (descarga)', v.Zdis],
      ['Cota de impulsión (eje de la salida)', v.Zimp],
      ['Fondo del tanque de descarga', v.Zftq],
      ['Nivel máximo de agua en la succión', v.Znmax],
      ['Nivel mínimo de agua en la succión', v.Znmin],
      ['Eje de la bomba', v.Zeje],
      ['Cota de succión (boca)', v.Zboca],
      ['Fondo del pozo', v.Zfondo]
    ].map(function (r) { var k = { 'Nivel de agua en la impulsión (descarga)': 'Zdis', 'Cota de impulsión (eje de la salida)': 'Zimp', 'Fondo del tanque de descarga': 'Zftq', 'Nivel máximo de agua en la succión': 'Znmax', 'Nivel mínimo de agua en la succión': 'Znmin', 'Eje de la bomba': 'Zeje', 'Cota de succión (boca)': 'Zboca', 'Fondo del pozo': 'Zfondo' }[r[0]]; return [r[0], r[1], res.val.auto[k] ? 'Autocompletada' : 'Dato']; });
    var desc = [];
    if (c.tq) {
      desc.push(['Tanque de descarga', c.tq.t, c.tq.d + ' Interior ' + fmt(v.Ltq, 1) + ' × ' + fmt(v.Btq, 1) + ' m, lámina ' + fmt(c.tq.lam) + ' m, volumen ' + fmt(c.tq.Vol) + ' m³.']);
      desc.push(['Salida de la impulsión', DESCR.descarga[v.descarga].t, c.tq.dd]);
    }
    desc.push(['Accesorios', c.acc.manual ? 'ΣK escrito' : (c.acc.su.items.length + c.acc.im.items.length) + ' tipos', c.acc.manual ? 'Se usan los ΣK escritos.' : 'Succión: ' + c.acc.su.items.map(function (a) { return a.n + ' ' + a.t.toLowerCase(); }).join(', ') + '. Impulsión: ' + c.acc.im.items.map(function (a) { return a.n + ' ' + a.t.toLowerCase(); }).join(', ') + '.']);
    return { acc: acc, tub: tub, cotas: cotas, desc: desc };
  }

  function summarize(res) {
    var c = { ok: 0, fail: 0, warn: 0, pend: 0, na: 0 };
    res.checks.forEach(function (x) { c[x.estado]++; });
    c.datos = res.dataIssues.length;
    c.bloq = res.order.filter(function (n) { return n.status !== 'ok'; }).length;
    return c;
  }

  /* ---------- Escenarios precargados ---------- */
  var SIF_MIN = { T: '', Znivel: '', recub: '', hw: '', ks: '', n: '', esep: '', Ztce: '', Ztcs: '', ne: '', Ds: '', Ss: '', ns: '', Zci: '', Zcs: '', Zf: '', Ld: '', Lc: '', La: '' };
  var BOM_MIN = { T: '', alt: '', Zboca: '', Zfondo: '', Zeje: '', Zimp: '', Ltq: '', Btq: '', Zftq: '', ks: '', C: '', Dsu: '', Dim: '', etaM: '', E: '', nu: '', LB: '', BB: '', Dla: '' };
  var ESCENARIOS = {
    sifon: [
      { id: 'normal', nombre: 'Caso base que cumple', desc: 'Red sanitaria con tres conductos automáticos.', datos: {} },
      { id: 'limite', nombre: 'En el límite', desc: 'Conductos con velocidad justa de 1,0 m/s a Qmin.', datos: { modo: 'manual', N: 2, D1: 225.6, D2: 400 } },
      { id: 'fuera', nombre: 'Fuera de norma', desc: 'Un solo conducto de gran diámetro y mucha pendiente.', datos: { modo: 'manual', N: 1, D1: 800, La: 6, Ld: 6 } },
      { id: 'minimos', nombre: 'Solo datos mínimos', desc: 'Caudales, colectores y obstáculo; lo demás se autocompleta con la norma y muestra el procedimiento.', datos: SIF_MIN },
      { id: 'invalido', nombre: 'Datos inválidos', desc: 'Negativo, texto y dato faltante.', datos: { Qmin: -5, Qmed: 'abc', Qmax: '' } }
    ],
    bomba: [
      { id: 'normal', nombre: 'Caso base que cumple', desc: 'Alcantarillado con 1 bomba activa y 1 de reserva.', datos: {} },
      { id: 'limite', nombre: 'En el límite', desc: 'Impulsión cerca del máximo de 2,4 m/s.', datos: { Dim: 240 } },
      { id: 'fuera', nombre: 'Fuera de norma', desc: 'Impulsión pequeña, cierre brusco y bomba mal ubicada.', datos: { Dim: 150, Dsu: 150, nInst: 1, Zeje: 16, Tc: 2, Zboca: 9.9, PN: 60 } },
      { id: 'minimos', nombre: 'Solo datos mínimos', desc: 'Caudal, niveles, longitudes y curva; lo demás se autocompleta con la norma.', datos: BOM_MIN },
      { id: 'serie', nombre: 'Curva que no alcanza', desc: 'La bomba no vence la altura: la aplicación propone bombas en serie o en paralelo.', datos: { Zdis: 48, Qd: 120, Dim: 280, Dsu: 330 } },
      { id: 'invalido', nombre: 'Datos inválidos', desc: 'Negativo, texto y dato faltante.', datos: { Qd: -10, Dim: 'abc', Lim: '' } }
    ]
  };

  /* ---------- Plan de pruebas ejecutable ---------- */
  var PRUEBAS = [
    { id: 'SF-01', mod: 'sifon', tipo: 'Normal', desc: 'Caso base sanitario, diseño automático', datos: {}, espera: 'Calcula todo sin fallas ni incumplimientos de norma', ok: function (r) { return r.complete && summarize(r).fail === 0; } },
    { id: 'SF-02', mod: 'sifon', tipo: 'Normal', desc: 'Red pluvial: límites de 1,2 m/s y 280 mm', datos: { tipo: 'pluvial', Qmin: 100, Qmed: 300, Qmax: 650, De: 900, Ds: 900, Ze: 100.6 }, espera: 'Usa V mín. 1,2 m/s y D mín. 280 mm', ok: function (r) { return r.complete && r.ctx.lim.Vmin === 1.2 && r.ctx.lim.Dmin === 280; } },
    { id: 'SF-03', mod: 'sifon', tipo: 'Límite', desc: 'Conducto de 226 mm con 40 L/s: V ≈ 1,00 m/s', datos: { modo: 'manual', N: 2, D1: 225.6, D2: 400 }, espera: 'V(Qmin) = 1,00 m/s aceptada por S3', ok: function (r) { var V = r.ctx.casos[0].barrels[0].V; return Math.abs(V - 1) < 0.01 && r.checks.filter(function (c) { return c.ch.id === 'S3' && /Qmin/.test(c.value); })[0].estado === 'ok'; } },
    { id: 'SF-04', mod: 'sifon', tipo: 'Fuera de norma', desc: 'Un conducto de 800 mm (V baja, N < 2)', datos: { modo: 'manual', N: 1, D1: 800 }, espera: 'Incumple S1 y S3 con sugerencia', ok: function (r) { return hasFail(r, 'S1') && hasFail(r, 'S3'); } },
    { id: 'SF-05', mod: 'sifon', tipo: 'Fuera de norma', desc: 'Tramos muy cortos: pendiente mayor de 22,5°', datos: { Ld: 4, La: 4 }, espera: 'Incumple S4 con longitud sugerida', ok: function (r) { return hasFail(r, 'S4'); } },
    { id: 'SF-06', mod: 'sifon', tipo: 'Fuera de norma', desc: 'Sin desnivel de energía disponible', datos: { Zs: 100.1, Zcs: 99.9, Zci: 100.0 }, espera: 'Incumple S7 e indica los metros faltantes', ok: function (r) { return hasFail(r, 'S7'); } },
    { id: 'SF-07', mod: 'sifon', tipo: 'Inválido', desc: 'Caudal negativo', datos: { Qmin: -5 }, espera: 'Advierte el dato y bloquea la cadena sin fallar', ok: function (r) { return r.val.invalid.Qmin && r.nodes.conductos.status === 'blocked'; } },
    { id: 'SF-08', mod: 'sifon', tipo: 'Inválido', desc: 'Caudal cero', datos: { Qmax: 0 }, espera: 'Rechaza el cero', ok: function (r) { return r.val.invalid.Qmax; } },
    { id: 'SF-09', mod: 'sifon', tipo: 'Inválido', desc: 'Texto en un campo numérico', datos: { Ld: 'abc' }, espera: 'Rechaza el texto y bloquea geometría', ok: function (r) { return r.val.invalid.Ld && r.nodes.geom.status === 'blocked'; } },
    { id: 'SF-10', mod: 'sifon', tipo: 'Inválido', desc: 'Caudales desordenados', datos: { Qmin: 300, Qmed: 120, Qmax: 260 }, espera: 'Error en caudales con sugerencia', ok: function (r) { return r.nodes.caudales.status === 'error' && r.nodes.caudales.sug; } },
    { id: 'BO-01', mod: 'bomba', tipo: 'Normal', desc: 'Caso base en alcantarillado', datos: {}, espera: 'Calcula todo sin fallas ni incumplimientos de norma', ok: function (r) { return r.complete && summarize(r).fail === 0; } },
    { id: 'BO-02', mod: 'bomba', tipo: 'Normal', desc: 'Acueducto: límites del Título B', datos: { sistema: 'acueducto' }, espera: 'Aplica V succión de Tabla B.8.2 y omite Art. 160', ok: function (r) { return r.complete && r.checks.filter(function (c) { return c.ch.id === 'B16'; })[0].estado === 'na'; } },
    { id: 'BO-03', mod: 'bomba', tipo: 'Límite', desc: 'Sumergencia justa de 2,5·Ds', datos: { Zboca: 9.125 }, espera: 'S = 0,875 m aceptada por B9', ok: function (r) { return r.checks.filter(function (c) { return c.ch.id === 'B9'; })[0].estado === 'ok'; } },
    { id: 'BO-04', mod: 'bomba', tipo: 'Fuera de norma', desc: 'Una sola bomba instalada', datos: { nInst: 1 }, espera: 'Incumple B1', ok: function (r) { return hasFail(r, 'B1'); } },
    { id: 'BO-05', mod: 'bomba', tipo: 'Fuera de norma', desc: 'Bomba muy por encima del agua', datos: { Zeje: 16 }, espera: 'Incumple B5 e indica cuánto bajar', ok: function (r) { return hasFail(r, 'B5'); } },
    { id: 'BO-06', mod: 'bomba', tipo: 'Fuera de norma', desc: 'Cierre brusco de 2 s', datos: { Tc: 2, PN: 60 }, espera: 'Joukowsky aplicado; incumple B14', ok: function (r) { return r.ctx.ar.rapido && hasFail(r, 'B14'); } },
    { id: 'BO-07', mod: 'bomba', tipo: 'Fuera de norma', desc: 'Bomba no vence la altura estática', datos: { Zdis: 60 }, espera: 'Error de operación con sugerencia', ok: function (r) { return r.nodes.operacion.status === 'error' && r.nodes.operacion.sug; } },
    { id: 'BO-08', mod: 'bomba', tipo: 'Inválido', desc: 'Caudal negativo', datos: { Qd: -10 }, espera: 'Rechaza y bloquea la curva del sistema', ok: function (r) { return r.val.invalid.Qd && r.nodes.sistema.status === 'blocked'; } },
    { id: 'BO-09', mod: 'bomba', tipo: 'Inválido', desc: 'Diámetro cero', datos: { Dim: 0 }, espera: 'Rechaza el cero', ok: function (r) { return r.val.invalid.Dim; } },
    { id: 'BO-10', mod: 'bomba', tipo: 'Inválido', desc: 'Texto en la curva de la bomba', datos: { curva: 'hola, 1\n2, 3' }, espera: 'Error en la curva e indica la fila', ok: function (r) { return r.nodes.curva.status === 'error'; } },
    { id: 'SF-11', mod: 'sifon', tipo: 'Autocompletado', desc: 'Solo datos mínimos: cotas, longitudes y n se completan', datos: SIF_MIN, espera: 'Calcula todo, sin incumplir norma, y lista cada valor completado', ok: function (r) { return r.complete && summarize(r).fail === 0 && r.autos.length >= 15; } },
    { id: 'SF-12', mod: 'sifon', tipo: 'Normal', desc: 'Cruce bajo una vía con recubrimiento sugerido', datos: { obst: 'via', Znivel: 96.0, recub: '' }, espera: 'Usa 1,20 m de recubrimiento y lo verifica en S16', ok: function (r) { return r.v.recub === 1.2 && r.checks.some(function (c) { return c.ch.id === 'S16' && c.estado !== 'pend'; }); } },
    { id: 'BO-11', mod: 'bomba', tipo: 'Autocompletado', desc: 'Solo datos mínimos: diámetros, cotas y pozo se completan', datos: BOM_MIN, espera: 'Calcula todo sin incumplir norma y lista lo completado', ok: function (r) { return r.complete && summarize(r).fail === 0 && r.autos.length >= 12; } },
    { id: 'BO-12', mod: 'bomba', tipo: 'Fuera de norma', desc: 'La bomba no vence 38 m de altura estática', datos: { Zdis: 48, Qd: 120, Dim: 280, Dsu: 330 }, espera: 'Propone bombas en serie', ok: function (r) { return r.nodes.arreglo.status === 'ok' && r.ctx.altBest.apta && r.ctx.altBest.nS >= 2; } },
    { id: 'BO-13', mod: 'bomba', tipo: 'Fuera de norma', desc: 'Caudal de diseño mayor al de una bomba', datos: { Qd: 200, Dim: 360, Dsu: 410 }, espera: 'Propone bombas en paralelo', ok: function (r) { return r.ctx.altBest && r.ctx.altBest.apta && r.ctx.altBest.nP >= 2; } },
    { id: 'BO-14', mod: 'bomba', tipo: 'Normal', desc: 'ΣK sale de la tabla de accesorios', datos: {}, espera: 'ΣK succión 3,0 e impulsión 8,0', ok: function (r) { return Math.abs(r.v.Ksu - 3) < 1e-9 && Math.abs(r.v.Kim - 8) < 1e-9; } }
  ];
  function hasFail(r, id) { return r.checks.some(function (c) { return c.ch.id === id && c.estado === 'fail'; }); }
  function correrPruebas() {
    return PRUEBAS.map(function (p) {
      var r, paso = false, err = null;
      try {
        r = calculate(p.mod, Object.assign(defaults(p.mod), p.datos));
        paso = !!p.ok(r);
      } catch (e) { err = e.message; }
      var s = r ? summarize(r) : null;
      var adv = [];
      if (r) {
        r.dataIssues.forEach(function (d) { adv.push(d.label + ': ' + d.msg); });
        r.order.filter(function (n) { return n.status === 'error'; }).forEach(function (n) { adv.push(n.why[0].text); });
        r.checks.filter(function (c) { return c.estado === 'fail'; }).slice(0, 3).forEach(function (c) { adv.push(c.ch.id + ' ' + c.ch.param + ': ' + c.value); });
      }
      return {
        id: p.id, mod: p.mod, tipo: p.tipo, desc: p.desc, espera: p.espera, paso: paso,
        obtenido: err ? 'Excepción: ' + err : (s ? s.ok + ' cumplen, ' + s.fail + ' incumplen, ' + s.warn + ' recomendaciones, ' + s.bloq + ' pasos sin calcular' : ''),
        advertencia: adv.join(' | ') || 'Ninguna'
      };
    });
  }

  return {
    G: G, SOURCES: SOURCES, MATERIALS: MATERIALS, FIELDS: FIELDS, CHECKS: CHECKS, ESCENARIOS: ESCENARIOS, PRUEBAS: PRUEBAS,
    defaults: defaults, calculate: calculate, summarize: summarize, correrPruebas: correrPruebas,
    fmt: fmt, parseNum: parseNum, parseCurva: parseCurva, usable: usable,
    asignar: asignar, gobierna: gobierna, topes: topes, alturaSistema: alturaSistema, interpCol: interpCol, perdidasConducto: perdidasConducto, repartir: repartir,
    agua: agua, colebrook: colebrook, normalDepth: normalDepth, areaC: areaC, puntoOperacion: puntoOperacion,
    limitesSifon: limitesSifon, arregloTxt: arregloTxt, DESCR: DESCR, ACC: ACC, parseAcc: parseAcc, sifonTablas: sifonTablas, bombaTablas: bombaTablas, velocidadParaQd: velocidadParaQd
  };
});
