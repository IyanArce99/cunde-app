/** Recorre los departamentos de carne y pescado ENTEROS y busca por palabra. */
const BASE = 'https://tienda.mercadona.es/api';
const UA = 'CundeCatalogBot/0.1 (+contacto: iyiarce@gmail.com; comprobacion de surtido equivalente, uso interno)';
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
const pausa = () => esperar(300 + Math.random() * 200);
const pedir = async (u) => {
  const r = await fetch(u, { headers: { 'User-Agent': UA } });
  if (r.status === 403 || r.status === 429) { console.error('PARO: HTTP ' + r.status); process.exit(2); }
  return r.ok ? r.json() : null;
};
const PALABRAS = ['cordero', 'dorada', 'lubina', 'merluza', 'sardina'];
const DEPS = ['Carne', 'Marisco y pescado'];

for (const [wh, zona] of [['mad3','Madrid'],['svq1','Sevilla'],['4804','A Coruña']]) {
  const arbol = await pedir(`${BASE}/categories/?lang=es&wh=${wh}`); await pausa();
  const familias = [];
  for (const dep of arbol.results) {
    if (!DEPS.includes(dep.name)) continue;
    for (const f of dep.categories ?? []) familias.push({ id: f.id, nombre: f.name, dep: dep.name });
  }
  const encontrados = {};
  for (const p of PALABRAS) encontrados[p] = [];
  for (const f of familias) {
    const d = await pedir(`${BASE}/categories/${f.id}/?lang=es&wh=${wh}`); await pausa();
    for (const sub of d?.categories ?? []) {
      for (const prod of sub.products ?? []) {
        const n = (prod.display_name || '').toLowerCase();
        for (const p of PALABRAS) {
          if (n.includes(p)) encontrados[p].push(`${prod.id} · ${Number(prod.price_instructions?.unit_price ?? 0).toFixed(2)} € · ${prod.display_name}`);
        }
      }
    }
  }
  console.log(`\n########## ${wh} · ${zona}   (${familias.length} familias recorridas)`);
  for (const p of PALABRAS) {
    console.log(`  ${p.padEnd(9)} ${encontrados[p].length} productos`);
    for (const x of encontrados[p].slice(0, 3)) console.log(`      ${x}`);
  }
}
