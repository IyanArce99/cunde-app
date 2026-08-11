/**
 * ═══ ¿CUÁNTOS CATÁLOGOS DISTINTOS HAY EN ESPAÑA? ═══
 *
 * La pregunta que decide si el problema del catálogo regional está acotado o no.
 * Si cada ciudad tiene el suyo, mantenerlos es inviable. Si son una docena de
 * almacenes, es un trabajo con final.
 *
 * CLAUDE.md afirma que «son una docena, no 11.000», pero eso salió de probar
 * seis códigos postales. Aquí se prueban las capitales de provincia, que es el
 * barrido que de verdad contesta.
 *
 * Trato con el servidor, como en el resto de scripts:
 *   - 300-500 ms entre peticiones, nunca concurrentes.
 *   - User-Agent identificable con contacto.
 *   - 403/429: PARAR y reportar. Ni reintentos, ni rotación, ni disimulo.
 *
 *   node --experimental-strip-types catalogo/_aud-almacenes-espana.ts
 */
const BASE = 'https://tienda.mercadona.es/api';
const UA = 'CundeCatalogBot/0.1 (+contacto: iyiarce@gmail.com; recuento puntual de almacenes por provincia para una app de listas de la compra, uso interno)';

const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));
const pausa = () => esperar(300 + Math.random() * 200);

/** Una capital por provincia peninsular y las islas. */
const CAPITALES: [string, string][] = [
  ['28001', 'Madrid'], ['08001', 'Barcelona'], ['46001', 'Valencia'], ['41001', 'Sevilla'],
  ['50001', 'Zaragoza'], ['29001', 'Málaga'], ['30001', 'Murcia'], ['07001', 'Palma'],
  ['35001', 'Las Palmas'], ['48001', 'Bilbao'], ['03001', 'Alicante'], ['47001', 'Valladolid'],
  ['15001', 'A Coruña'], ['14001', 'Córdoba'], ['46940', 'Manises'], ['33001', 'Oviedo'],
  ['39001', 'Santander'], ['31001', 'Pamplona'], ['01001', 'Vitoria'], ['18001', 'Granada'],
  ['02001', 'Albacete'], ['06001', 'Badajoz'], ['11001', 'Cádiz'], ['12001', 'Castellón'],
  ['17001', 'Girona'], ['20001', 'San Sebastián'], ['23001', 'Jaén'], ['26001', 'Logroño'],
  ['36001', 'Vigo'], ['37001', 'Salamanca'], ['38001', 'Santa Cruz de Tenerife'], ['43001', 'Tarragona'],
  ['45001', 'Toledo'], ['04001', 'Almería'], ['10001', 'Cáceres'], ['24001', 'León'],
];

async function almacenDe(cp: string): Promise<string> {
  const res = await fetch(`${BASE}/postal-codes/actions/change-pc/`, {
    method: 'PUT',
    headers: { 'User-Agent': UA, 'Content-Type': 'application/json' },
    body: JSON.stringify({ new_postal_code: cp }),
  });
  if (res.status === 403 || res.status === 429) {
    throw new Error(`BLOQUEO: HTTP ${res.status} resolviendo ${cp}. Paro.`);
  }
  if (!res.ok) return `HTTP ${res.status}`;
  return res.headers.get('x-customer-wh') ?? '—';
}

const porAlmacen = new Map<string, string[]>();
console.log(`\nResolviendo ${CAPITALES.length} capitales a almacén. 300-500 ms entre peticiones.\n`);
for (const [cp, ciudad] of CAPITALES) {
  const wh = await almacenDe(cp);
  if (!porAlmacen.has(wh)) porAlmacen.set(wh, []);
  porAlmacen.get(wh)!.push(ciudad);
  process.stdout.write('.');
  await pausa();
}

console.log('\n\n═══ ALMACENES DISTINTOS ═══\n');
const orden = [...porAlmacen].sort((a, b) => b[1].length - a[1].length);
for (const [wh, ciudades] of orden) {
  console.log(`  ${wh.padEnd(8)} ${String(ciudades.length).padStart(2)} capitales   ${ciudades.join(', ')}`);
}
console.log(`\n${porAlmacen.size} almacenes para ${CAPITALES.length} capitales.`);
console.log(`Media de ${(CAPITALES.length / porAlmacen.size).toFixed(1)} capitales por almacén.`);
