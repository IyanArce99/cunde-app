#!/usr/bin/env node --experimental-strip-types
/**
 * ═══ ¿POR QUÉ NO ENTRA EL PESCADO EN GRAN CANARIA CON 100 €? ═══
 *
 * Caso controlado: 35007 → almacén 3120, 2 personas, comidas y cenas, semana
 * que empieza el lunes 19 oct 2026, sin despensa, sin filtros, proteína
 * normal, sin postre, variedad alta. Solo lee: usa la traza de auditoría del
 * motor (`PeticionSemana.traza`), que no cambia ninguna decisión.
 *
 *   node --experimental-strip-types catalogo/_aud-pescado-gc.ts [tope=100] [zona=gran-canaria|madrid]
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { consumoPorRacion, proteinaAnimal, proteinaPorRacion } from '../src/motor/carrito.ts';
import { construir, generarSemana, nutricionDe, recetarioAdaptado, GRAMOS_POR_NIVEL } from '../src/motor/seleccionar.ts';
import type { EventoTraza, PeticionSemana } from '../src/motor/seleccionar.ts';
import { datosDeZona } from '../src/motor/zona.ts';
import type { CatalogoZona } from '../src/motor/zona.ts';
import { DIAS } from '../src/motor/tipos.ts';
import type { DatosMotor } from '../src/motor/tipos.ts';

const aqui = path.dirname(fileURLToPath(import.meta.url));
const leer = (f: string) => JSON.parse(fs.readFileSync(path.join(aqui, '..', f), 'utf8'));
const tope = Number(process.argv[2] ?? 100);
const zonaId = process.argv[3] ?? 'gran-canaria';
const base = leer('src/data/motor-datos.json') as DatosMotor;
const datos = zonaId === 'madrid' ? base : datosDeZona(base, leer('src/data/zonas/gran-canaria.json') as CatalogoZona, '3120');

const peticion: PeticionSemana = {
  datos, N: 2, numHuecos: 14, variedad: 'mucha', proteina: 'normal', esfuerzo: 'libre', exclusiones: [],
  presupuesto: tope, postre: false, semanaNumero: 1, recetasRecientes: [], existencias: {}, ordenDias: DIAS,
};
const eur = (n: number) => `${n.toFixed(2).replace('.', ',')} €`;
const nombre = (id: string) => datos.recetas.find((r) => r.id === id)?.nombre ?? id;
const recetas = recetarioAdaptado(datos, [], Infinity);
const deMar = recetas.filter((r) => r.proteina === 'pescado' || r.proteina === 'marisco');

console.log(`\n${zonaId} · tope ${tope} € · ${recetas.length} recetas elegibles · ${deMar.length} de pescado o marisco\n`);

// 1 · Las recetas de mar: coste por ración, proteína, envase del pescado.
const porCoste = [...recetas].map((r) => ({ r, c: consumoPorRacion(r, datos, 2) })).sort((a, b) => a.c - b.c);
console.log('Recetas de pescado y marisco (puesto en el orden de semillas, de 1 = más barata):');
for (const r of deMar) {
  const puesto = porCoste.findIndex((x) => x.r.id === r.id) + 1;
  const mar = r.ingredientes.filter((i) => ['pescado', 'marisco'].includes(datos.ingredientes[i.canonico]?.categoria ?? '') || /merluza|bacalao|sardina|caballa|atun|salmon|calamar|gamba|mejillon|pescad|dorada|lubina|boquer/.test(i.canonico));
  const envases = mar.map((i) => {
    const s = datos.skus[i.canonico];
    return s ? `${i.canonico}: ${s.nombre} ${s.formato ?? ''} ${eur(s.precio)} · conserva ${datos.ingredientes[i.canonico]?.dias_conservacion ?? '?'} d · usa ${(i.cantidad * 2).toFixed(0)} ${i.unidad} para 2` : `${i.canonico}: sin SKU`;
  });
  console.log(`  ${puesto}/${recetas.length} ${r.id} «${r.nombre}» · ${eur(consumoPorRacion(r, datos, 2))} ración · ${proteinaPorRacion(r, datos, 2).toFixed(0)} g prot · ${proteinaAnimal(r, datos)} · ${r.minutos} min`);
  for (const e of envases) console.log(`      ${e}`);
}

// 2 · Qué semilla gana, como en construirMejor (etapa de 8).
const suelo = GRAMOS_POR_NIVEL.normal;
const criterio = (c: { totalCarrito: number; totalPerecedero: number; totalConsumo: number }) => (c.totalCarrito - c.totalConsumo) + c.totalPerecedero;
const semillas = porCoste.slice(0, 8).map((x) => x.r);
const intentos = semillas.map((r) => {
  const c = construir(peticion, { forzarPrimera: r.id });
  if (!c) return null;
  const n = nutricionDe(c.huecos, datos, 2, suelo);
  return { semilla: r.id, c, cumple: n.cumpleSuelo, cabe: c.carrito.totalCarrito <= tope, crit: criterio(c.carrito) };
}).filter(Boolean) as { semilla: string; c: NonNullable<ReturnType<typeof construir>>; cumple: boolean; cabe: boolean; crit: number }[];
console.log('\nLas 8 semillas (arranques) y su resultado. Gana: cumple suelo, cabe, y menos desperdicio (caja − consumo + perecedero):');
for (const x of intentos) {
  const mar = x.c.tandas.filter((t) => t.receta.proteina === 'pescado' || t.receta.proteina === 'marisco').map((t) => t.receta.id);
  console.log(`  ${x.semilla.padEnd(28)} caja ${eur(x.c.carrito.totalCarrito)} · consumo ${eur(x.c.carrito.totalConsumo)} · perecedero ${eur(x.c.carrito.totalPerecedero)} · criterio ${x.crit.toFixed(2)} · suelo ${x.cumple ? 'sí' : 'no'} · mar: ${mar.join(', ') || '—'}`);
}
const real = generarSemana(peticion);
console.log(`\nProducción (generarSemana): caja ${eur(real.carrito.totalCarrito)} · ${real.recetasDistintas.length} platos · mar: ${real.tandas.filter((t) => ['pescado', 'marisco'].includes(t.receta.proteina)).length} tandas`);

// 3 · Contrafactual: forzar cada receta de mar como primera.
console.log('\nSi se fuerza cada receta de mar como primer plato:');
const ganadora = intentos.filter((x) => x.cumple && x.cabe).sort((a, b) => a.crit - b.crit)[0];
for (const r of deMar) {
  const c = construir(peticion, { forzarPrimera: r.id });
  if (!c) { console.log(`  ${r.id}: no se puede construir`); continue; }
  const n = nutricionDe(c.huecos, datos, 2, suelo);
  const lineaMar = c.carrito.lineas.filter((l) => r.ingredientes.some((i) => i.canonico === l.canonico) && ['pescado', 'marisco'].includes(datos.ingredientes[l.canonico]?.categoria ?? 'x'));
  console.log(`  ${r.id}: caja ${eur(c.carrito.totalCarrito)} (${ganadora ? `${c.carrito.totalCarrito - ganadora.c.carrito.totalCarrito >= 0 ? '+' : ''}${(c.carrito.totalCarrito - ganadora.c.carrito.totalCarrito).toFixed(2)}` : '?'}) · perecedero ${eur(c.carrito.totalPerecedero)} (${ganadora ? (c.carrito.totalPerecedero - ganadora.c.carrito.totalPerecedero).toFixed(2) : '?'}) · criterio ${criterio(c.carrito).toFixed(2)} vs ${ganadora?.crit.toFixed(2)} · suelo ${n.cumpleSuelo ? 'sí' : 'no'}`);
  void lineaMar;
}

// 4 · Dentro de la semilla ganadora: en cada hueco, el mejor de mar frente al elegido.
if (ganadora) {
  const eventos: EventoTraza[] = [];
  construir({ ...peticion, traza: (e) => eventos.push(e) }, { forzarPrimera: ganadora.semilla });
  const huecos = [...new Set(eventos.map((e) => e.hueco))].sort((a, b) => a - b);
  const idsMar = new Set(deMar.map((r) => r.id));
  const motivos = new Map<string, number>();
  console.log(`\nSemilla ganadora: ${ganadora.semilla}. Hueco a hueco, el elegido y el mejor plato de mar:`);
  for (const h of huecos) {
    const ev = eventos.filter((e) => e.hueco === h);
    const elegida = ev.find((e) => e.tipo === 'eleccion') as Extract<EventoTraza, { tipo: 'eleccion' }> | undefined;
    if (!elegida) continue;
    const cands = ev.filter((e) => e.tipo === 'candidato') as Extract<EventoTraza, { tipo: 'candidato' }>[];
    const ganador = cands.filter((c) => c.receta === elegida.receta && c.relajado === elegida.relajado).sort((a, b) => b.puntuacion - a.puntuacion)[0];
    const mar = cands.filter((c) => idsMar.has(c.receta) && c.relajado === elegida.relajado).sort((a, b) => b.puntuacion - a.puntuacion)[0];
    for (const d of ev) if (d.tipo === 'descarte' && idsMar.has(d.receta)) motivos.set(`${d.receta}: ${d.motivo}`, (motivos.get(`${d.receta}: ${d.motivo}`) ?? 0) + 1);
    if (!ganador) continue;
    let linea = `  hueco ${String(h).padStart(2)} · elige ${nombre(elegida.receta)} (${ganador.puntuacion.toFixed(1)}, ${eur(ganador.costeMarginal)}/hueco, cuota ${eur(ganador.permitido)})`;
    if (mar) {
      const dif = Object.entries(mar.partes).map(([k, v]) => [k, v - (ganador.partes[k] ?? 0)] as const).filter(([, v]) => Math.abs(v) > 0.05).sort((a, b) => a[1] - b[1]);
      linea += `\n            mejor de mar: ${nombre(mar.receta)} (${mar.puntuacion.toFixed(1)}, ${eur(mar.costeMarginal)}/hueco) · pierde por ${dif.filter(([, v]) => v < 0).map(([k, v]) => `${k} ${v.toFixed(1)}`).join(', ') || '—'} · gana en ${dif.filter(([, v]) => v > 0).map(([k, v]) => `${k} +${v.toFixed(1)}`).join(', ') || '—'}`;
    } else linea += '\n            ningún plato de mar llegó a evaluarse';
    console.log(linea);
  }
  console.log('\nDescartes de platos de mar en la semilla ganadora (motivo · veces):');
  for (const [k, v] of [...motivos].sort((a, b) => b[1] - a[1])) console.log(`  ${k} · ${v}`);
}
