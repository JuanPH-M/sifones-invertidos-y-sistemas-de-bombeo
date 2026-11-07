// Ejecuta el plan de pruebas y muestra el caso base: node tests/engine.test.js
const E = require('../src/engine.js');
const rows = E.correrPruebas();
let bad = 0;
rows.forEach(r => { if (!r.paso) bad++; console.log((r.paso ? 'PASA ' : 'FALLA') + ' ' + r.id + ' [' + r.tipo + '] ' + r.desc + ' -> ' + r.obtenido + (r.paso ? '' : ' :: ' + r.advertencia)); });

for (const mod of ['sifon', 'bomba']) {
  const r = E.calculate(mod, E.defaults(mod));
  console.log('\n=== ' + mod + ' base: ' + JSON.stringify(E.summarize(r)));
  r.order.forEach(n => { console.log('[' + n.status + '] ' + n.title + ': ' + n.value); });
  r.checks.filter(c => c.estado !== 'ok').forEach(c => console.log('  ' + c.estado + ' ' + c.ch.id + ' ' + c.value + ' | ' + c.limit + ' | ' + c.sug));
}
// Ningún resultado visible puede ser NaN con datos inválidos o escenarios extremos
for (const mod of ['sifon', 'bomba']) {
  E.ESCENARIOS[mod].forEach(s => {
    const r = E.calculate(mod, Object.assign(E.defaults(mod), s.datos));
    const txt = JSON.stringify(r.order.map(n => [n.value, n.lines])) + JSON.stringify(r.checks.map(c => [c.value, c.limit, c.sug]));
    if (/NaN|undefined|Infinity/.test(txt)) { bad++; console.log('NaN en escenario ' + mod + '/' + s.id + ': ' + txt.match(/.{60}(NaN|undefined|Infinity).{30}/)); }
    console.log('Escenario ' + mod + '/' + s.id + ': ' + JSON.stringify(E.summarize(r)));
  });
}
console.log(bad ? '\nFALLOS: ' + bad : '\nTODO PASA');
process.exit(bad ? 1 : 0);
