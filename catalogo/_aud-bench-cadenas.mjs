import fs from 'node:fs';
const leer = (e) => JSON.parse(fs.readFileSync(`catalogo/bench-motor/${e}.json`, 'utf8')).medidas;
const A = leer('antes'), B = leer('b');
const ids = [...new Set(A.filter((m) => m.delArmario > 0).map((m) => m.id))];
const f = (n) => n.toFixed(2).padStart(7);
console.log('cadena (solo semanas con despensa)   caja A→B          consumo A→B       perec A→B        frescos  prot');
let ta = {c:0,k:0,p:0,fr:0}, tb = {c:0,k:0,p:0,fr:0};
for (const id of ids) {
  const sa = A.filter((m) => m.id === id && m.delArmario > 0), sb = B.filter((m) => m.id === id && m.delArmario > 0);
  const s = (xs, f) => xs.reduce((a, m) => a + f(m), 0);
  const a = {c:s(sa,m=>m.carrito),k:s(sa,m=>m.consumo),p:s(sa,m=>m.perecedero),fr:s(sa,m=>m.frescos),pr:s(sa,m=>m.proteina)/sa.length};
  const b = {c:s(sb,m=>m.carrito),k:s(sb,m=>m.consumo),p:s(sb,m=>m.perecedero),fr:s(sb,m=>m.frescos),pr:s(sb,m=>m.proteina)/sb.length};
  for (const k of ['c','k','p','fr']) { ta[k]+=a[k]; tb[k]+=b[k]; }
  console.log(`${id.padEnd(20)} ${sa.length} sem  ${f(a.c)}→${f(b.c)}  ${f(a.k)}→${f(b.k)}  ${f(a.p)}→${f(b.p)}   ${a.fr}→${b.fr}   ${a.pr.toFixed(1)}→${b.pr.toFixed(1)}`);
}
console.log(`${'TOTAL'.padEnd(20)} ${A.filter(m=>m.delArmario>0).length} sem  ${f(ta.c)}→${f(tb.c)}  ${f(ta.k)}→${f(tb.k)}  ${f(ta.p)}→${f(tb.p)}   ${ta.fr}→${tb.fr}`);
console.log(`\ncaja ${((tb.c/ta.c-1)*100).toFixed(1)}% · consumo ${((tb.k/ta.k-1)*100).toFixed(1)}% · perecedero ${((tb.p/ta.p-1)*100).toFixed(1)}% · consumo por euro ${(ta.k/ta.c).toFixed(3)}→${(tb.k/tb.c).toFixed(3)} · frescos por semana ${(ta.fr/15).toFixed(1)}→${(tb.fr/15).toFixed(1)}`);
const msA = A.map(m=>m.ms), msB = B.map(m=>m.ms);
console.log(`latencia media ${(msA.reduce((a,b)=>a+b)/msA.length).toFixed(0)}→${(msB.reduce((a,b)=>a+b)/msB.length).toFixed(0)} ms · máx ${Math.max(...msA)}→${Math.max(...msB)} ms · semanas con despensa: ${(A.filter(m=>m.delArmario>0).reduce((a,m)=>a+m.ms,0)/15).toFixed(0)}→${(B.filter(m=>m.delArmario>0).reduce((a,m)=>a+m.ms,0)/15).toFixed(0)} ms`);
