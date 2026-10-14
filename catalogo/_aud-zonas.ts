#!/usr/bin/env node --experimental-strip-types
/**
 * Sonda: la misma semana —mismas entradas— en Madrid y en Gran Canaria.
 *
 *   node --experimental-strip-types catalogo/_aud-zonas.ts [N] [presupuesto] [--json salida.json]
 *
 * Gran Canaria sale dos veces: con el catálogo que usa la app (solo lo
 * verificado y revisado) y con el supuesto de que se aprueben las alternativas
 * propuestas (capturas-crudas/zona-gran-canaria-supuesta.json, si existe). El
 * segundo NO es lo que ve nadie: sirve para medir qué cambia al revisarlas.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { generarSemana, recetarioAdaptado } from '../src/motor/seleccionar.ts';
import { datosDeZona } from '../src/motor/zona.ts';
import type { DatosMotor } from '../src/motor/tipos.ts';

const aqui = path.dirname(fileURLToPath(import.meta.url));
const leer = (r: string) => JSON.parse(fs.readFileSync(r, 'utf8'));
const base: DatosMotor = leer(path.join(aqui, '..', 'src', 'data', 'motor-datos.json'));
const N = Number(process.argv[2] ?? 2);
const presupuesto = Number(process.argv[3] ?? 65);
const iJson = process.argv.indexOf('--json');

const LUNES = ['LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB', 'DOM'];
const escenarios: [string, DatosMotor & { recetasFuera?: { receta: string; faltan: string[] }[] }][] = [
  ['Madrid (mad3)', base],
  ['Gran Canaria · catálogo de la app', datosDeZona(base, leer(path.join(aqui, '..', 'src', 'data', 'zonas', 'gran-canaria.json')))],
];
const supuesta = path.join(aqui, 'capturas-crudas', 'zona-gran-canaria-supuesta.json');
if (fs.existsSync(supuesta)) escenarios.push(['Gran Canaria · SUPONIENDO revisadas las alternativas', datosDeZona(base, leer(supuesta))]);

const informe: unknown[] = [];
for (const [nombre, datos] of escenarios) {
  const s = generarSemana({
    datos, N, numHuecos: 14, presupuesto, variedad: 'normal', proteina: 'normal',
    esfuerzo: 'libre', exclusiones: [], semanaNumero: 1, ordenDias: LUNES,
  });
  const vivas = recetarioAdaptado(datos, []).length;
  const veganas = recetarioAdaptado(datos, ['Vegano']).length;
  const sinGluten = recetarioAdaptado(datos, ['Gluten']).length;
  console.log(`\n══ ${nombre} · ${datos.generadoEn} ══`);
  console.log(`recetas ${vivas} de ${base.recetas.length} · veganas ${veganas} · sin gluten ${sinGluten}${datos.recetasFuera ? ` · fuera ${datos.recetasFuera.length}` : ''}`);
  console.log(`TOTAL ${s.carrito.totalCarrito.toFixed(2)} € · ${s.cuadra ? 'cuadra' : 'NO cuadra'} · ${s.carrito.lineas.filter((l) => !l.esDespensa && l.compras > 0).length} productos`);
  for (const h of s.huecos) console.log(`  ${h.dia} ${h.ranura.padEnd(6)} ${h.tipo.padEnd(10)} ${h.receta?.nombre ?? '—'}`);
  const lineas = s.carrito.lineas.filter((l) => !l.esDespensa && l.compras > 0).sort((a, b) => b.carritoCoste - a.carritoCoste);
  for (const l of lineas) console.log(`    ${l.sku.padEnd(8)} ${l.nombre.slice(0, 48).padEnd(49)} ×${l.compras}  ${l.carritoCoste.toFixed(2).padStart(6)} €`);
  informe.push({
    escenario: nombre, catalogo: datos.generadoEn, recetas: vivas, total: s.carrito.totalCarrito, cuadra: s.cuadra,
    menu: s.huecos.map((h) => ({ dia: h.dia, ranura: h.ranura, tipo: h.tipo, receta: h.receta?.nombre ?? null })),
    compra: lineas.map((l) => ({ sku: l.sku, nombre: l.nombre, envases: l.compras, importe: l.carritoCoste })),
    ...(datos.recetasFuera ? { recetasFuera: datos.recetasFuera } : {}),
  });
}
if (iJson > -1) fs.writeFileSync(process.argv[iJson + 1], `${JSON.stringify({ N, presupuesto, informe }, null, 2)}\n`);
