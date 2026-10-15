#!/usr/bin/env node --experimental-strip-types
/**
 * ═══ VARIEDAD ALTA: LA ELECCIÓN FINAL, ANTES Y AHORA ═══
 *
 * Comprueba `elegirVariedadFrenteADesperdicio` (src/motor/seleccionar.ts) en
 * el caso controlado y escribe docs/motor-variedad-desperdicio-2026-10-15.md:
 *
 *   35007 → 3120 · 2 personas · comidas y cenas · semana desde el lunes 19 oct
 *   2026 · sin filtros · proteína normal · sin postre · variedad alta
 *
 * «antes» es `soloDesperdicio: true` (la de menor desperdicio, como hasta hoy);
 * «ahora» es producción. Para cada tope enseña las candidatas y por qué se
 * descartan, el camino de subir el tope con la semana anterior como candidata,
 * un caso con despensa y Madrid como control. No es un barrido.
 *
 *   node --experimental-strip-types catalogo/_aud-variedad-desperdicio.ts
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { existenciasTrasLaSemana } from '../src/motor/carrito.ts';
import type { Existencias } from '../src/motor/carrito.ts';
import { generarSemana, variedadDeSemana } from '../src/motor/seleccionar.ts';
import type { EventoTraza, PeticionSemana, SemanaGenerada } from '../src/motor/seleccionar.ts';
import { datosDeZona } from '../src/motor/zona.ts';
import type { CatalogoZona } from '../src/motor/zona.ts';
import { DIAS } from '../src/motor/tipos.ts';
import type { DatosMotor } from '../src/motor/tipos.ts';

const aqui = path.dirname(fileURLToPath(import.meta.url));
const leer = (f: string) => JSON.parse(fs.readFileSync(path.join(aqui, '..', f), 'utf8'));
const madrid = leer('src/data/motor-datos.json') as DatosMotor;
const gc = datosDeZona(madrid, leer('src/data/zonas/gran-canaria.json') as CatalogoZona, '3120');

const pet = (datos: DatosMotor, tope: number, extra: Partial<PeticionSemana> = {}): PeticionSemana => ({
  datos, N: 2, numHuecos: 14, variedad: 'mucha', proteina: 'normal', esfuerzo: 'libre', exclusiones: [],
  presupuesto: tope, postre: false, semanaNumero: 1, recetasRecientes: [], existencias: {}, ordenDias: DIAS, ...extra,
});
const eur = (n: number) => `${n.toFixed(2).replace('.', ',')} €`;
const firma = (d: number) => `${d >= 0 ? '+' : ''}${d.toFixed(2).replace('.', ',')} €`;
const L: string[] = [];
const out = (s = '') => L.push(s);

function resumen(s: SemanaGenerada, datos: DatosMotor) {
  const v = variedadDeSemana(s, datos);
  const cat: Record<string, number> = {};
  for (const t of s.tandas) cat[t.receta.proteina] = (cat[t.receta.proteina] ?? 0) + 1;
  const c = s.carrito;
  return {
    v, cat, caja: c.totalCarrito, consumo: c.totalConsumo, perecedero: c.totalPerecedero,
    desperdicio: c.totalCarrito - c.totalConsumo + c.totalPerecedero,
  };
}
const cats = (c: Record<string, number>) => Object.entries(c).sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k} ${n}`).join(' · ');
const fila = (etq: string, s: SemanaGenerada, datos: DatosMotor) => {
  const r = resumen(s, datos);
  return `| ${etq} | ${eur(r.caja)} | ${eur(r.consumo)} | ${eur(r.perecedero)} | ${eur(r.desperdicio)} | ${r.v.recetasRecocinadas} | ${r.v.comidasDeSobras} | ${r.v.categorias} | ${r.v.maxPorCategoria} | ${r.v.fuentes} | ${s.nutricion.proteinaPorPersonaDia.toFixed(1).replace('.', ',')} | ${cats(r.cat)} |`;
};
const CABECERA = '| | caja | consumo | perecedero | desperdicio* | recetas recocinadas | comidas de sobras | categorías | máx. por categoría | fuentes | prot. g | reparto |\n|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|';

function menu(s: SemanaGenerada) {
  out('| día | comida | cena |');
  out('|---|---|---|');
  for (const d of DIAS) {
    const c = (ranura: string) => {
      const h = s.huecos.find((x) => x.dia === d && x.ranura === ranura);
      if (!h?.receta) return '—';
      return `${h.receta.nombre} · ${h.receta.proteina}${h.tipo === 'cocinado' ? '' : ` *(${h.tipo})*`}`;
    };
    out(`| ${d} | ${c('comida')} | ${c('cena')} |`);
  }
  out();
}

function diferenciaDeCompra(a: SemanaGenerada, b: SemanaGenerada) {
  const mapa = (s: SemanaGenerada) => new Map(s.carrito.lineas.filter((l) => !l.esDespensa && l.compras > 0).map((l) => [l.sku, l]));
  const ma = mapa(a);
  const mb = mapa(b);
  const filas: string[] = [];
  for (const sku of new Set([...ma.keys(), ...mb.keys()])) {
    const x = ma.get(sku);
    const y = mb.get(sku);
    if (x && y && x.compras === y.compras) continue;
    const nombre = (y ?? x)!.nombre;
    filas.push(`| ${nombre} | ${x ? `${x.compras} × ${(x.contenidoEnvase).toString().replace('.', ',')} ${x.unidad}` : '—'} | ${y ? `${y.compras} × ${(y.contenidoEnvase).toString().replace('.', ',')} ${y.unidad}` : '—'} | ${firma((y?.carritoCoste ?? 0) - (x?.carritoCoste ?? 0))} | ${firma((y?.perecederoCoste ?? 0) - (x?.perecederoCoste ?? 0))} |`);
  }
  if (!filas.length) { out('Misma compra.'); out(); return; }
  out('| producto | antes | ahora | caja | perecedero |');
  out('|---|---|---|---:|---:|');
  for (const f of filas) out(f);
  out();
}

function candidatas(p: PeticionSemana) {
  const ev: Extract<EventoTraza, { tipo: 'semana' }>[] = [];
  generarSemana({ ...p, traza: (e) => { if (e.tipo === 'semana') ev.push(e); } });
  const orden = { elegida: 0, base: 1, admisible: 2, descartada: 3 } as const;
  out('| arranque | decisión | motivo | caja | consumo | perecedero | desperdicio* | categorías | máx. | sobras | fuentes |');
  out('|---|---|---|---:|---:|---:|---:|---:|---:|---:|---:|');
  for (const e of [...ev].sort((a, b) => orden[a.decision] - orden[b.decision])) {
    out(`| ${e.origen} | ${e.decision} | ${e.motivo} | ${eur(e.caja)} | ${eur(e.consumo)} | ${eur(e.perecedero)} | ${eur(e.desperdicio)} | ${e.variedad.categorias} | ${e.variedad.maxPorCategoria} | ${e.variedad.comidasDeSobras} | ${e.variedad.fuentes} |`);
  }
  out();
}

out('# Variedad alta · elección final entre variedad y desperdicio · 15 oct 2026');
out();
out('> Generado por `catalogo/_aud-variedad-desperdicio.ts`. «Antes» = `soloDesperdicio` (la de menor');
out('> desperdicio, como hasta hoy). «Ahora» = producción con `elegirVariedadFrenteADesperdicio`.');
out();
out('**Caso controlado.** 35007 → 3120 · 2 personas · comidas y cenas · semana desde el lunes 19 oct 2026 ·');
out('sin despensa · sin filtros · proteína normal · sin postre · variedad alta · catálogo de 55 recetas.');
out();
out('\\* *Desperdicio* = caja − consumo + perecedero: el criterio con el que el motor elegía hasta hoy');
out('(con proteína normal). Incluye inventario que se guarda; el *perecedero* es lo que se da por perdido.');
out();

// 1 · Gran Canaria a 60, 80 y 100
out('## 1 · Gran Canaria: antes y ahora');
out();
out(CABECERA);
const ahora: Record<number, SemanaGenerada> = {};
const antes: Record<number, SemanaGenerada> = {};
for (const tope of [60, 80, 100]) {
  antes[tope] = generarSemana(pet(gc, tope, { soloDesperdicio: true }));
  ahora[tope] = generarSemana(pet(gc, tope));
  out(fila(`${tope} € antes`, antes[tope], gc));
  out(fila(`${tope} € ahora`, ahora[tope], gc));
}
out();
for (const tope of [60, 80, 100]) {
  out(`### ${tope} €: candidatas y decisión`);
  out();
  candidatas(pet(gc, tope));
  out(`**Menú ahora (${tope} €):**`);
  out();
  menu(ahora[tope]);
  out(`**Compra, antes → ahora:** caja ${firma(ahora[tope].carrito.totalCarrito - antes[tope].carrito.totalCarrito)}, perecedero ${firma(ahora[tope].carrito.totalPerecedero - antes[tope].carrito.totalPerecedero)}, consumo ${firma(ahora[tope].carrito.totalConsumo - antes[tope].carrito.totalConsumo)}.`);
  out();
  diferenciaDeCompra(antes[tope], ahora[tope]);
}

// 2 · Subir el tope con la semana anterior como candidata
out('## 2 · Subir el tope: la semana del tope inferior sigue siendo candidata');
out();
out('Cómo lo vive el usuario: tiene la semana de un tope y sube el tope en Ajustes. La app pasa');
out('esa semana como `semanaPrevia`.');
out();
out(CABECERA);
for (const [de, a] of [[60, 80], [80, 100], [60, 100]] as const) {
  const previa = ahora[de];
  const sin = ahora[a];
  const con = generarSemana(pet(gc, a, { semanaPrevia: { huecos: previa.huecos, tandas: previa.tandas } }));
  out(fila(`${de} → ${a} €, semana de ${de} € en ${a} €`, previa, gc));
  out(fila(`${de} → ${a} €, generada de cero`, sin, gc));
  out(fila(`${de} → ${a} €, con la de ${de} € como candidata`, con, gc));
}
out();
out('Candidatas al subir de 80 a 100 € con la semana de 80 € dentro:');
out();
candidatas(pet(gc, 100, { semanaPrevia: { huecos: ahora[80].huecos, tandas: ahora[80].tandas } }));

// 3 · Con despensa
out('## 3 · Con despensa: semana 2 tras la semana 1 de 80 €');
out();
const despensa: Existencias = existenciasTrasLaSemana(ahora[80].carrito, {});
const ids = [...new Set(ahora[80].tandas.map((t) => t.receta.id))];
const p2 = (extra: Partial<PeticionSemana>) => pet(gc, 80, { semanaNumero: 2, recetasRecientes: [ids], existencias: despensa, ...extra });
const s2antes = generarSemana(p2({ soloDesperdicio: true }));
const s2ahora = generarSemana(p2({}));
out(`Despensa de partida: ${Object.keys(despensa).length} productos, lo que sobró de la semana 1.`);
out();
out(CABECERA);
out(fila('semana 2 · antes', s2antes, gc));
out(fila('semana 2 · ahora', s2ahora, gc));
out();
candidatas(p2({}));
out('**Menú ahora (semana 2):**');
out();
menu(s2ahora);
diferenciaDeCompra(s2antes, s2ahora);

// 4 · Madrid
out('## 4 · Madrid (control)');
out();
out(CABECERA);
const mad: Record<number, [SemanaGenerada, SemanaGenerada]> = {};
for (const tope of [60, 80, 100]) {
  mad[tope] = [generarSemana(pet(madrid, tope, { soloDesperdicio: true })), generarSemana(pet(madrid, tope))];
  out(fila(`${tope} € antes`, mad[tope][0], madrid));
  out(fila(`${tope} € ahora`, mad[tope][1], madrid));
}
out();
for (const tope of [60, 80, 100]) {
  out(`### Madrid ${tope} €: candidatas`);
  out();
  candidatas(pet(madrid, tope));
}

// 5 · Comprobaciones
const todas = [...Object.values(ahora), s2ahora, ...Object.values(mad).map((x) => x[1])];
const ok = todas.every((s) => s.cuadra && s.huecos.length === 14);
out('## 5 · Comprobaciones');
out();
out(`- Las ${todas.length} semanas «ahora» cuadran (caben y cumplen el suelo) y cubren 14 comidas: ${ok ? 'sí' : '**NO**'}.`);
out(`- Determinismo: cada semana «ahora» de Gran Canaria, generada dos veces, ${[60, 80, 100].every((t) => JSON.stringify(generarSemana(pet(gc, t)).huecos.map((h) => h.receta?.id)) === JSON.stringify(ahora[t].huecos.map((h) => h.receta?.id))) ? 'sale igual' : '**cambia**'}.`);
out();

const salida = path.join(aqui, '..', 'docs', 'motor-variedad-desperdicio-2026-10-15.md');
fs.writeFileSync(salida, `${L.join('\n')}\n`);
console.log(`Escrito ${salida}`);
