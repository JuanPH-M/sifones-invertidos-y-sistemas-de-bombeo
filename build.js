// Une todo en un solo HTML autocontenido: node build.js
const fs = require('fs');
const path = require('path');
const r = (p) => fs.readFileSync(path.join(__dirname, p), 'utf8');
const safe = (s) => s.replace(/<\/script/gi, '<\\/script');

let three = r('vendor/three.min.js').replace(/^console\.warn\([^;]*\);\s*/, '');
const scripts = [
  ['three', three],
  ['jspdf', r('vendor/jspdf.umd.min.js')],
  ['autotable', r('vendor/jspdf.plugin.autotable.min.js')],
  ['xlsx', r('vendor/xlsx.mini.min.js')],
  ['fonts', r('vendor/fonts.js')],
  ['engine', r('src/engine.js')],
  ['charts', r('src/charts.js')],
  ['schemes', r('src/schemes.js')],
  ['scene3d', r('src/scene3d.js')],
  ['report', r('src/report.js')],
  ['ui', r('src/ui.js')]
];
const tags = scripts.map(([n, s]) => '<script data-m="' + n + '">' + safe(s) + '</script>').join('\n');
const html = r('src/template.html').split('/*__CSS__*/').join(r('src/app.css')).split('<!--__SCRIPTS__-->').join(tags);
const out = path.join(__dirname, 'Sifones_invertidos_y_sistemas_de_bombeo.html');
fs.writeFileSync(out, html);
console.log('Generado: ' + out + ' (' + (html.length / 1048576).toFixed(2) + ' MB)');
