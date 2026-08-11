/**
 * ═══ EL MAPA DE ALMACENES DE MERCADONA ═══
 *
 * CLAUDE.md dice que «son una docena, no 11.000». Un barrido de 36 capitales ya
 * devolvió 33 almacenes distintos, así que la docena era falsa. Esto contesta
 * la pregunta entera: cuántos hay entre TODAS las provincias, no solo en las
 * capitales.
 *
 * El código postal español es PPnnn, donde PP es la provincia (01-52). Se
 * prueban varios sufijos por provincia para pillar también las ciudades que no
 * son capital: si una provincia tiene dos almacenes, es ahí donde se ve.
 *
 * No es un censo: es una muestra. Un almacén que solo sirva a una comarca sin
 * ninguno de los códigos probados no saldrá. El número que da es un SUELO —hay
 * al menos estos—, y para decidir arquitectura eso basta.
 *
 * Trato con el servidor, igual que el resto:
 *   - 300-500 ms entre peticiones, nunca concurrentes.
 *   - User-Agent identificable con contacto.
 *   - 403/429: PARAR y reportar. Ni reintentos, ni rotación, ni disimulo.
 *
 *   node --experimental-strip-types catalogo/_aud-mapa-almacenes.ts
 */
import fs from 'node:fs';

const BASE = 'https://tienda.mercadona.es/api';
const UA = 'CundeCatalogBot/0.1 (+contacto: iyiarce@gmail.com; recuento de almacenes por provincia para decidir la arquitectura de catalogo de una app de listas de la compra, uso interno)';

const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));
const pausa = () => esperar(300 + Math.random() * 200);

const PROVINCIAS: Record<string, string> = {
  '01': 'Álava', '02': 'Albacete', '03': 'Alicante', '04': 'Almería', '05': 'Ávila',
  '06': 'Badajoz', '07': 'Baleares', '08': 'Barcelona', '09': 'Burgos', '10': 'Cáceres',
  '11': 'Cádiz', '12': 'Castellón', '13': 'Ciudad Real', '14': 'Córdoba', '15': 'A Coruña',
  '16': 'Cuenca', '17': 'Girona', '18': 'Granada', '19': 'Guadalajara', '20': 'Gipuzkoa',
  '21': 'Huelva', '22': 'Huesca', '23': 'Jaén', '24': 'León', '25': 'Lleida',
  '26': 'La Rioja', '27': 'Lugo', '28': 'Madrid', '29': 'Málaga', '30': 'Murcia',
  '31': 'Navarra', '32': 'Ourense', '33': 'Asturias', '34': 'Palencia', '35': 'Las Palmas',
  '36': 'Pontevedra', '37': 'Salamanca', '38': 'S.C. Tenerife', '39': 'Cantabria', '40': 'Segovia',
  '41': 'Sevilla', '42': 'Soria', '43': 'Tarragona', '44': 'Teruel', '45': 'Toledo',
  '46': 'Valencia', '47': 'Valladolid', '48': 'Bizkaia', '49': 'Zamora', '50': 'Zaragoza',
  '51': 'Ceuta', '52': 'Melilla',
};

/**
 * Dieciséis códigos por provincia, repartidos por todo el rango.
 *
 * Con seis salieron 106 almacenes y 34 provincias con más de uno, así que la
 * muestra corta se quedaba muy por debajo. Con dieciséis son 832 peticiones,
 * unos siete minutos al ritmo educado — mucho, pero es una pregunta que se
 * contesta UNA vez y decide la arquitectura del catálogo.
 *
 * Sigue siendo una muestra: el número que salga es un SUELO, no un censo.
 */
const SUFIJOS = [
  '001', '002', '004', '080', '100', '140', '190', '200',
  '250', '300', '350', '400', '440', '500', '550', '600',
];

async function almacenDe(cp: string): Promise<string | null> {
  const res = await fetch(`${BASE}/postal-codes/actions/change-pc/`, {
    method: 'PUT',
    headers: { 'User-Agent': UA, 'Content-Type': 'application/json' },
    body: JSON.stringify({ new_postal_code: cp }),
  });
  if (res.status === 403 || res.status === 429) {
    throw new Error(`BLOQUEO: HTTP ${res.status} resolviendo ${cp}. Paro y reporto.`);
  }
  if (!res.ok) return null; // el CP no existe o no lo sirven: no es un fallo
  return res.headers.get('x-customer-wh');
}

const porAlmacen = new Map<string, Set<string>>();
const porProvincia = new Map<string, Set<string>>();
let pedidos = 0;
let resueltos = 0;

const provincias = Object.keys(PROVINCIAS);
console.log(`\n${provincias.length} provincias × ${SUFIJOS.length} códigos = ${provincias.length * SUFIJOS.length} peticiones.`);
console.log('300-500 ms entre cada una. Paro en el primer 403/429.\n');

for (const pp of provincias) {
  for (const suf of SUFIJOS) {
    const cp = pp + suf;
    const wh = await almacenDe(cp);
    pedidos++;
    if (wh) {
      resueltos++;
      if (!porAlmacen.has(wh)) porAlmacen.set(wh, new Set());
      porAlmacen.get(wh)!.add(PROVINCIAS[pp]);
      if (!porProvincia.has(pp)) porProvincia.set(pp, new Set());
      porProvincia.get(pp)!.add(wh);
    }
    await pausa();
  }
  const n = porProvincia.get(pp)?.size ?? 0;
  process.stdout.write(n > 1 ? String(n) : (n === 1 ? '.' : '·'));
}

console.log('\n\n═══ RESULTADO ═══\n');
console.log(`  ${resueltos} de ${pedidos} códigos resueltos`);
console.log(`  ${porAlmacen.size} almacenes distintos`);
console.log(`  ${porProvincia.size} provincias con cobertura`);

const variasPorProvincia = [...porProvincia].filter(([, w]) => w.size > 1);
if (variasPorProvincia.length) {
  console.log(`\n  Provincias con MÁS DE UN almacén (${variasPorProvincia.length}):`);
  for (const [pp, whs] of variasPorProvincia) {
    console.log(`    ${PROVINCIAS[pp].padEnd(16)} ${whs.size}  (${[...whs].join(', ')})`);
  }
}

console.log('\n  Almacenes que sirven a más de una provincia:');
const compartidos = [...porAlmacen].filter(([, p]) => p.size > 1).sort((a, b) => b[1].size - a[1].size);
if (compartidos.length) {
  for (const [wh, provs] of compartidos) console.log(`    ${wh.padEnd(8)} ${[...provs].join(', ')}`);
} else {
  console.log('    ninguno');
}

const salida = 'catalogo/mapa-almacenes.json';
fs.writeFileSync(salida, `${JSON.stringify({
  medidoEn: new Date().toISOString().slice(0, 10),
  pedidos,
  resueltos,
  almacenes: Object.fromEntries([...porAlmacen].map(([wh, p]) => [wh, [...p]])),
}, null, 2)}\n`);
console.log(`\nEscrito ${salida}`);
