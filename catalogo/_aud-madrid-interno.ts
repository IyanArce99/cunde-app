/**
 * ═══ ¿VALE EL CATÁLOGO DE `mad3` PARA TODO MADRID? ═══
 *
 * El plan de beta era «Madrid y ya está», apoyado en que el catálogo cargado es
 * el de Madrid. Pero el mapa de almacenes destapó que Madrid tiene TRES:
 * `mad1`, `mad2` y `mad3`. Si entre ellos cambian las referencias, la beta
 * tiene el mismo problema que tendría en Oviedo, solo que más pequeño.
 *
 * Se comprueban los 34 de peso variable —el mostrador fresco, que es donde
 * cambia la referencia— contra los tres. 68 peticiones.
 *
 *   node --experimental-strip-types catalogo/_aud-madrid-interno.ts
 */
import datosJson from '../src/data/motor-datos.json' with { type: 'json' };
import type { DatosMotor } from '../src/motor/tipos.ts';

const BASE = 'https://tienda.mercadona.es/api';
const UA = 'CundeCatalogBot/0.1 (+contacto: iyiarce@gmail.com; comprobacion de 34 referencias entre los tres almacenes de Madrid para una app de listas de la compra, uso interno)';

const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));
const pausa = () => esperar(300 + Math.random() * 200);

const datos = datosJson as unknown as DatosMotor;
/* Solo los frescos: los envasados ya se sabe que llevan referencia nacional
   —huevos y garbanzos coinciden al céntimo entre Madrid y Oviedo—. */
const FRESCOS = Object.values(datos.skus).filter((s) => s.peso_variable);

async function pedir(sku: string, wh: string) {
  const res = await fetch(`${BASE}/products/${sku}/?lang=es&wh=${wh}`, { headers: { 'User-Agent': UA } });
  if (res.status === 403 || res.status === 429) throw new Error(`BLOQUEO: HTTP ${res.status}. Paro.`);
  if (res.status === 404) return { falta: true as const };
  if (!res.ok) return { error: `HTTP ${res.status}` };
  const j = await res.json();
  return { precio: Number(j.price_instructions?.unit_price) };
}

console.log(`\n${FRESCOS.length} referencias de peso variable contra mad1 y mad2 (mad3 es el cargado).\n`);

const faltan: Record<string, string[]> = { mad1: [], mad2: [] };
const cambian: string[] = [];

for (const s of FRESCOS) {
  const linea: string[] = [];
  for (const wh of ['mad1', 'mad2'] as const) {
    const r = await pedir(s.sku, wh);
    await pausa();
    if ('falta' in r) { faltan[wh].push(s.nombre); linea.push(`${wh}: NO`); continue; }
    if ('error' in r) { linea.push(`${wh}: ${r.error}`); continue; }
    const delta = r.precio - s.precio;
    if (Math.abs(delta) > 0.005) {
      linea.push(`${wh}: ${r.precio.toFixed(2)} (${delta > 0 ? '+' : ''}${delta.toFixed(2)})`);
    }
  }
  if (linea.length) {
    cambian.push(s.nombre);
    console.log(`  ${s.precio.toFixed(2).padStart(6)} €  ${s.nombre.slice(0, 40).padEnd(40)} ${linea.join('  ')}`);
  }
}

console.log('\n═══ RESULTADO ═══');
console.log(`  referencias que faltan en mad1: ${faltan.mad1.length}`);
console.log(`  referencias que faltan en mad2: ${faltan.mad2.length}`);
console.log(`  referencias con precio distinto o ausente: ${cambian.length} de ${FRESCOS.length}`);
if (!cambian.length) {
  console.log('\n  Los tres almacenes de Madrid llevan lo mismo al mismo precio.');
  console.log('  La beta en Madrid con el catálogo de mad3 es correcta.');
}
