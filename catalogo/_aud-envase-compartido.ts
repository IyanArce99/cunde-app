#!/usr/bin/env node --experimental-strip-types
/**
 * ═══ ENVASE COMPARTIDO · ANTES Y DESPUÉS ═══
 *
 * Compara el motor con la valoración de envases compartidos (producción) y
 * sin ella (`sinEnvaseCompartido`) en el caso controlado de Gran Canaria, con
 * despensa, y en Madrid. Escribe docs/motor-envase-compartido-2026-10-16.md.
 *
 * Caso: 35007 → 3120 · 2 personas · comidas y cenas · semana desde el lunes
 * 19 oct 2026 · sin filtros · proteína normal · sin postre · variedad alta.
 *
 *   node --experimental-strip-types catalogo/_aud-envase-compartido.ts
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { calcularCarrito, esCongelado, esConserva, existenciasTrasLaSemana } from '../src/motor/carrito.ts';
import type { Existencias } from '../src/motor/carrito.ts';
import { generarSemana, liberarHueco, variedadDeSemana } from '../src/motor/seleccionar.ts';
import type { PeticionSemana, SemanaGenerada } from '../src/motor/seleccionar.ts';
import { datosDeZona } from '../src/motor/zona.ts';
import type { CatalogoZona } from '../src/motor/zona.ts';
import { DIAS } from '../src/motor/tipos.ts';
import type { DatosMotor } from '../src/motor/tipos.ts';

const aqui = path.dirname(fileURLToPath(import.meta.url));
const leer = (f: string) => JSON.parse(fs.readFileSync(path.join(aqui, '..', f), 'utf8'));
const madrid = leer('src/data/motor-datos.json') as DatosMotor;
const gc = datosDeZona(madrid, leer('src/data/zonas/gran-canaria.json') as CatalogoZona, '3120');
const CARNE = new Set(['pollo', 'cerdo', 'vacuno', 'cordero']);

const pet = (datos: DatosMotor, tope: number, extra: Partial<PeticionSemana> = {}): PeticionSemana => ({
  datos, N: 2, numHuecos: 14, variedad: 'mucha', proteina: 'normal', esfuerzo: 'libre', exclusiones: [],
  presupuesto: tope, postre: false, semanaNumero: 1, recetasRecientes: [], existencias: {}, ordenDias: DIAS, ...extra,
});
const eur = (n: number) => `${n.toFixed(2).replace('.', ',')} €`;
const L: string[] = [];
const out = (s = '') => L.push(s);

function generar(p: PeticionSemana): { s: SemanaGenerada; ms: number } {
  generarSemana(p); // calentar
  const t0 = performance.now();
  const s = generarSemana(p);
  return { s, ms: Math.round(performance.now() - t0) };
}

/** Productos de vida corta que usan dos o más tandas, con los días de uso y si cumplen el plazo. */
function envases(s: SemanaGenerada, datos: DatosMotor) {
  const filas: { producto: string; recetas: string; dias: string; plazo: string; ok: boolean }[] = [];
  const porSku = new Map<string, { nombre: string; usos: { receta: string; dia: number }[]; sku: DatosMotor['skus'][string]; diasFresco: number }>();
  for (const t of s.tandas) {
    const h = s.huecos.find((x) => x.receta?.id === t.receta.id && x.tipo === 'cocinado');
    if (!h) continue;
    const dia = DIAS.indexOf(h.dia);
    for (const ing of t.receta.ingredientes) {
      const sku = datos.skus[ing.canonico];
      const meta = datos.ingredientes[ing.canonico];
      if (!sku || !meta || meta.es_despensa || esCongelado(sku) || meta.dias_conservacion > 7) continue;
      const x = porSku.get(sku.sku) ?? { nombre: sku.nombre, usos: [], sku, diasFresco: meta.dias_conservacion };
      if (!x.usos.some((u) => u.receta === t.receta.nombre)) x.usos.push({ receta: t.receta.nombre, dia });
      porSku.set(sku.sku, x);
    }
  }
  for (const x of porSku.values()) {
    if (x.usos.length < 2) continue;
    const dias = x.usos.map((u) => u.dia);
    const primero = Math.min(...dias);
    const limite = esConserva(x.sku) ? primero + x.diasFresco - 1 : x.diasFresco - 1;
    const ok = Math.max(...dias) <= limite;
    filas.push({
      producto: x.nombre,
      recetas: x.usos.map((u) => `${u.receta} (${DIAS[u.dia]})`).join(' + '),
      dias: dias.map((d) => DIAS[d]).join(', '),
      plazo: `${esConserva(x.sku) ? 'abierto' : 'fresco'}: hasta el ${DIAS[Math.min(6, limite)]}${limite > 6 ? ' (toda la semana)' : ''}`,
      ok,
    });
  }
  return filas;
}

function fila(etq: string, r: { s: SemanaGenerada; ms: number }, datos: DatosMotor) {
  const v = variedadDeSemana(r.s, datos);
  const c = r.s.carrito;
  const carne = r.s.tandas.filter((t) => CARNE.has(t.receta.proteina)).length;
  return `| ${etq} | ${eur(c.totalCarrito)} | ${eur(c.totalConsumo)} | ${eur(c.totalPerecedero)} | ${v.categorias} | ${v.maxPorCategoria} | ${carne} | ${r.s.nutricion.proteinaPorPersonaDia.toFixed(1).replace('.', ',')} | ${r.s.cuadra ? 'sí' : 'no'} | ${r.ms} |`;
}
const CAB = '| | caja | consumo | perecedero | categorías | máx. | tandas de carne | prot. g | cuadra | ms |\n|---|---:|---:|---:|---:|---:|---:|---:|---|---:|';

function menu(s: SemanaGenerada) {
  out('| día | comida | cena |');
  out('|---|---|---|');
  for (const d of DIAS) {
    const c = (ranura: string) => {
      const h = s.huecos.find((x) => x.dia === d && x.ranura === ranura);
      if (!h?.receta) return '—';
      const marca = CARNE.has(h.receta.proteina) ? '**' : '';
      return `${marca}${h.receta.nombre}${marca} · ${h.receta.proteina}${h.tipo === 'cocinado' ? '' : ` *(${h.tipo})*`}`;
    };
    out(`| ${d} | ${c('comida')} | ${c('cena')} |`);
  }
  out();
}

function tablaEnvases(s: SemanaGenerada, datos: DatosMotor) {
  const f = envases(s, datos);
  if (!f.length) { out('Ningún producto de vida corta compartido entre dos recetas.'); out(); return f; }
  out('| producto | recetas que lo gastan (día de cocina) | plazo | dentro |');
  out('|---|---|---|---|');
  for (const x of f) out(`| ${x.producto} | ${x.recetas} | ${x.plazo} | ${x.ok ? 'sí' : '**NO**'} |`);
  out();
  return f;
}

out('# Envase compartido · antes y después · 16 oct 2026');
out();
out('> Generado por `catalogo/_aud-envase-compartido.ts`. «Antes» = `sinEnvaseCompartido`.');
out('> Caso: 35007 → 3120 · 2 personas · comidas y cenas · semana desde el lunes 19 oct 2026 · sin filtros ·');
out('> proteína normal · sin postre · variedad alta. Los platos de carne van en **negrita**.');
out();

const fueraDePlazo: string[] = [];
out('## 1 · Gran Canaria');
out();
out(CAB);
const gcRes: Record<number, { antes: { s: SemanaGenerada; ms: number }; ahora: { s: SemanaGenerada; ms: number } }> = {};
for (const tope of [60, 80, 100]) {
  const antes = generar(pet(gc, tope, { sinEnvaseCompartido: true }));
  const ahora = generar(pet(gc, tope));
  gcRes[tope] = { antes, ahora };
  out(fila(`${tope} € antes`, antes, gc));
  out(fila(`${tope} € ahora`, ahora, gc));
}
out();
for (const tope of [60, 80, 100]) {
  const { antes, ahora } = gcRes[tope];
  out(`### ${tope} € · menú ahora`);
  out();
  menu(ahora.s);
  out(`Carne: ${ahora.s.tandas.filter((t) => CARNE.has(t.receta.proteina)).map((t) => t.receta.nombre).join(', ') || '—'} (antes: ${antes.s.tandas.filter((t) => CARNE.has(t.receta.proteina)).map((t) => t.receta.nombre).join(', ') || '—'}).`);
  out();
  out('Envases de vida corta que comparten dos recetas:');
  out();
  for (const x of tablaEnvases(ahora.s, gc)) if (!x.ok) fueraDePlazo.push(`GC ${tope} €: ${x.producto}`);
}

// Despensa
out('## 2 · Con despensa: semana 2 tras la semana 1 de 80 €');
out();
const despensa: Existencias = existenciasTrasLaSemana(gcRes[80].ahora.s.carrito, {});
const hist = [[...new Set(gcRes[80].ahora.s.tandas.map((t) => t.receta.id))]];
const d2 = (extra: Partial<PeticionSemana>) => pet(gc, 80, { semanaNumero: 2, recetasRecientes: hist, existencias: despensa, ...extra });
const d2antes = generar(d2({ sinEnvaseCompartido: true }));
const d2ahora = generar(d2({}));
out(CAB);
out(fila('semana 2 · antes', d2antes, gc));
out(fila('semana 2 · ahora', d2ahora, gc));
out();
menu(d2ahora.s);
for (const x of tablaEnvases(d2ahora.s, gc)) if (!x.ok) fueraDePlazo.push(`GC despensa: ${x.producto}`);

// Madrid
out('## 3 · Madrid (control)');
out();
out(CAB);
for (const tope of [60, 80, 100]) {
  const antes = generar(pet(madrid, tope, { sinEnvaseCompartido: true }));
  const ahora = generar(pet(madrid, tope));
  out(fila(`${tope} € antes`, antes, madrid));
  out(fila(`${tope} € ahora`, ahora, madrid));
  for (const x of envases(ahora.s, madrid)) if (!x.ok) fueraDePlazo.push(`Madrid ${tope} €: ${x.producto}`);
}
out();

// No cocino sobre una pareja
out('## 4 · «No cocino» sobre una receta que comparte envase');
out();
let probado = false;
for (const tope of [60, 80, 100]) {
  const p = pet(gc, tope);
  const s = gcRes[tope].ahora.s;
  for (const x of envases(s, gc).sort((a, b) => Number(/pechuga|lomo|picad/i.test(b.producto)) - Number(/pechuga|lomo|picad/i.test(a.producto)))) {
    const receta = x.recetas.split(' + ')[1]?.replace(/ \(.*\)$/, '');
    const i = s.huecos.findIndex((h) => h.receta?.nombre === receta && h.tipo === 'cocinado');
    if (i < 0) continue;
    const r = liberarHueco(p, s, i);
    const recalculado = calcularCarrito(r.tandas, gc, 2, {}, r.postres);
    out(`- ${tope} €, «${receta}» (${s.huecos[i].dia} ${s.huecos[i].ranura}) comparte «${x.producto}». Al liberarla: caja ${eur(s.carrito.totalCarrito)} → ${eur(r.carrito.totalCarrito)} (${r.carrito.totalCarrito <= s.carrito.totalCarrito + 0.005 ? 'no sube' : '**SUBE**'}); perecedero ${eur(s.carrito.totalPerecedero)} → ${eur(r.carrito.totalPerecedero)}; recalculado desde cero ${eur(recalculado.totalPerecedero)} (${Math.abs(recalculado.totalPerecedero - r.carrito.totalPerecedero) < 0.005 ? 'coincide' : '**NO coincide**'}).`);
    probado = true;
    break;
  }
}
if (!probado) out('- Ninguna semana del caso tenía una pareja que liberar.');
out();

out('## 5 · Plazos');
out();
const antesFuera: string[] = [];
for (const tope of [60, 80, 100]) for (const x of envases(gcRes[tope].antes.s, gc)) if (!x.ok) antesFuera.push(`GC ${tope} €: ${x.producto} (${x.recetas})`);
for (const x of envases(d2antes.s, gc)) if (!x.ok) antesFuera.push(`GC despensa: ${x.producto} (${x.recetas})`);
out(`**Antes**, el motor daba por aprovechados ${antesFuera.length} sobrantes fuera de plazo${antesFuera.length ? `: ${antesFuera.join('; ')}` : ''}. Su «consumo» contaba esa comida como comida y su perecedero no la cobraba.`);
out();
out(fueraDePlazo.length ? `**Fuera de plazo:** ${fueraDePlazo.join('; ')}.` : 'Todos los productos de vida corta que comparten dos recetas se gastan dentro de su plazo en las 10 semanas «ahora».');
out();

const salida = path.join(aqui, '..', 'docs', 'motor-envase-compartido-2026-10-16.md');
fs.writeFileSync(salida, `${L.join('\n')}\n`);
console.log(`Escrito ${salida}`);
