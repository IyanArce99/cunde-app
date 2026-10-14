#!/usr/bin/env node --experimental-strip-types
/**
 * Sonda para la compra de prueba en 35007 (almacén 3120, Las Palmas).
 *
 *   node --experimental-strip-types catalogo/_aud-prueba-35007.ts <auditoría-zona-3120.json> [--json salida]
 *
 * 1. Qué SKU PENDIENTES (sin correspondencia verificada) salen en los menús que
 *    la app genera en Gran Canaria, y con qué frecuencia: un barrido de
 *    comensales, variedad y semana.
 * 2. La semana de ejemplo —2 personas, comidas y cenas, 65 €, variedad normal—
 *    SOLO con productos comprobados. Lo de despensa (aceite, sal, especias) no
 *    se compra: se asume en casa y va aparte, como en la app.
 *    Si no sale semana, dice qué productos concretos lo impiden.
 *
 * No rellena nada con Madrid: parte del catálogo de la zona (src/data/zonas/).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { generarSemana, recetarioAdaptado } from '../src/motor/seleccionar.ts';
import { datosDeZona } from '../src/motor/zona.ts';
import type { CatalogoZona } from '../src/motor/zona.ts';
import type { DatosMotor, Sku } from '../src/motor/tipos.ts';

const aqui = path.dirname(fileURLToPath(import.meta.url));
const leer = (r: string) => JSON.parse(fs.readFileSync(r, 'utf8'));
const base: DatosMotor = leer(path.join(aqui, '..', 'src', 'data', 'motor-datos.json'));
const zona: CatalogoZona = leer(path.join(aqui, '..', 'src', 'data', 'zonas', 'gran-canaria.json'));
const auditoria = leer(process.argv[2]);
const iJson = process.argv.indexOf('--json');

const estadoDe = new Map<string, { estado: string; correspondencia: string; pendientes: string[] }>(
  auditoria.filas.map((f: any) => [f.canonico, f]),
);
const pendientes = new Set([...estadoDe].filter(([, f]) => f.estado !== 'comprobado').map(([c]) => c));
const esDespensa = (c: string) => base.ingredientes[c]?.es_despensa === true;

// ── 1 · pendientes que salen en los menús ────────────────────────────────────
// El catálogo de la zona CON la capa del almacén 3120, que es el de 35007.
const ALMACEN = '3120';
const gc = datosDeZona(base, zona, ALMACEN);
const DIAS = ['MIÉ', 'JUE', 'VIE', 'SÁB', 'DOM', 'LUN', 'MAR'];
const veces = new Map<string, number>();
let semanas = 0;
for (const N of [1, 2, 3, 4]) {
  for (const variedad of ['poca', 'normal', 'mucha'] as const) {
    for (const semanaNumero of [1, 2, 3]) {
      const s = generarSemana({
        datos: gc, N, numHuecos: 14, presupuesto: 30 + 20 * N, variedad, proteina: 'normal',
        esfuerzo: 'libre', exclusiones: [], semanaNumero, ordenDias: DIAS,
      });
      semanas++;
      for (const l of s.carrito.lineas) for (const c of l.canonicos) veces.set(c, (veces.get(c) ?? 0) + 1);
    }
  }
}
const enMenus = [...pendientes].filter((c) => veces.has(c))
  .sort((a, b) => (esDespensa(a) ? 1 : 0) - (esDespensa(b) ? 1 : 0) || veces.get(b)! - veces.get(a)!);
console.log(`\n1 · PENDIENTES QUE SALEN EN LOS MENÚS (${semanas} semanas generadas)`);
for (const c of enMenus) {
  const f = estadoDe.get(c)!;
  console.log(`  ${String(veces.get(c)).padStart(3)}/${semanas}  ${c.padEnd(24)} ${esDespensa(c) ? 'despensa ' : 'compra   '} ${f.correspondencia.padEnd(14)} ${f.pendientes.join(' · ')}`);
}
const fuera = [...pendientes].filter((c) => !veces.has(c));
console.log(`  pendientes que no salen en ninguna: ${fuera.join(', ') || '—'}`);

// ── 2 · la semana solo con lo comprobado ─────────────────────────────────────
const soloComprobado: CatalogoZona = {
  ...zona,
  porAlmacen: {},
  // Lo que ve 35007 (común + capa de 3120), quitando lo no comprobado que se compra.
  skus: Object.fromEntries(Object.entries(gc.skus).map(([c, s]) => [
    c, esDespensa(c) || !pendientes.has(c) ? s : null,
  ])) as Record<string, Sku | null>,
};
const estricto = datosDeZona(base, soloComprobado);
const N = 2;
const s = generarSemana({
  datos: estricto, N, numHuecos: 14, presupuesto: 65, variedad: 'normal', proteina: 'normal',
  esfuerzo: 'libre', exclusiones: [], semanaNumero: 1, ordenDias: DIAS,
});
const recetas = recetarioAdaptado(estricto, []).length;
console.log(`\n2 · SEMANA SOLO CON LO COMPROBADO · catálogo ${zona.version} · recetas ${recetas} de ${base.recetas.length}`);
const huecosConPlato = s.huecos.filter((h) => h.receta).length;
console.log(`  ${huecosConPlato}/14 comidas · total ${s.carrito.totalCarrito.toFixed(2)} € · ${s.cuadra ? 'cuadra' : 'NO cuadra'}`);
for (const h of s.huecos) console.log(`  ${h.dia} ${h.ranura.padEnd(6)} ${h.tipo.padEnd(10)} ${h.receta?.nombre ?? '—'}`);
const compra = s.carrito.lineas.filter((l) => !l.esDespensa && l.compras > 0);
const casa = s.carrito.lineas.filter((l) => l.esDespensa);
for (const l of compra) console.log(`    ${l.sku.padEnd(8)} ${l.nombre.slice(0, 50).padEnd(51)} ×${l.compras} ${l.carritoCoste.toFixed(2).padStart(6)} €`);
console.log(`  despensa, se asume en casa: ${casa.map((l) => l.nombre).join(', ')}`);

// Qué impide más recetas en el modo estricto.
const tumba = new Map<string, number>();
for (const f of estricto.recetasFuera) if (f.faltan.length === 1) tumba.set(f.faltan[0], (tumba.get(f.faltan[0]) ?? 0) + 1);
console.log(`  recetas que caen por UN solo producto: ${[...tumba].sort((a, b) => b[1] - a[1]).map(([c, n]) => `${c} ${n}`).join(' · ')}`);

if (iJson > -1) {
  fs.writeFileSync(process.argv[iJson + 1], `${JSON.stringify({
    zona: zona.zona, almacen: '3120', cp: '35007', catalogo: zona.version, semanasBarridas: semanas,
    pendientesEnMenus: enMenus.map((c) => ({ canonico: c, veces: veces.get(c), despensa: esDespensa(c), ...estadoDe.get(c) })),
    ejemplo: {
      N, presupuesto: 65, variedad: 'normal', recetasDisponibles: recetas, total: s.carrito.totalCarrito, cuadra: s.cuadra,
      menu: s.huecos.map((h) => ({ dia: h.dia, ranura: h.ranura, tipo: h.tipo, receta: h.receta?.nombre ?? null })),
      compra: compra.map((l) => ({ sku: l.sku, nombre: l.nombre, envases: l.compras, importe: l.carritoCoste })),
      despensa: casa.map((l) => ({ sku: l.sku, nombre: l.nombre })),
      caenPorUnProducto: Object.fromEntries(tumba),
    },
  }, null, 2)}\n`);
}
