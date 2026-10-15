#!/usr/bin/env node --experimental-strip-types
/**
 * ═══ ¿ENTRAN LAS RECETAS NUEVAS DE GRAN CANARIA EN LAS SEMANAS? ═══
 *
 * Caso controlado, motor de producción sin tocar: 35007 → 3120 · 2 personas ·
 * comidas y cenas · semana desde el lunes 19 oct 2026 · sin despensa · sin
 * filtros · proteína normal · sin postre · variedad alta · 60, 80 y 100 €.
 *
 * Compara el catálogo sin el lote (`docs/recetas/lote-gran-canaria.json`) y
 * con él, y de cada receta nueva dice si entra, si aparece en alguna semana
 * candidata y, si no, por qué la descarta el motor en la construcción. Solo
 * lee: la traza no cambia ninguna decisión.
 *
 *   node --experimental-strip-types catalogo/_aud-lote-gc.ts
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { generarSemana, variedadDeSemana } from '../src/motor/seleccionar.ts';
import type { EventoTraza, PeticionSemana, SemanaGenerada } from '../src/motor/seleccionar.ts';
import { datosDeZona } from '../src/motor/zona.ts';
import type { CatalogoZona } from '../src/motor/zona.ts';
import { DIAS } from '../src/motor/tipos.ts';
import type { DatosMotor } from '../src/motor/tipos.ts';

const aqui = path.dirname(fileURLToPath(import.meta.url));
const leer = (f: string) => JSON.parse(fs.readFileSync(path.join(aqui, '..', f), 'utf8'));
const base = leer('src/data/motor-datos.json') as DatosMotor;
const lote = leer('docs/recetas/lote-gran-canaria.json').recetas as { id: string; nombre: string }[];
const nuevas = new Set(lote.map((r) => r.id));
const gc = datosDeZona(base, leer('src/data/zonas/gran-canaria.json') as CatalogoZona, '3120');
const gcSin: DatosMotor = { ...gc, recetas: gc.recetas.filter((r) => !nuevas.has(r.id)) };

const pet = (datos: DatosMotor, tope: number, extra: Partial<PeticionSemana> = {}): PeticionSemana => ({
  datos, N: 2, numHuecos: 14, variedad: 'mucha', proteina: 'normal', esfuerzo: 'libre', exclusiones: [],
  presupuesto: tope, postre: false, semanaNumero: 1, recetasRecientes: [], existencias: {}, ordenDias: DIAS, ...extra,
});
const eur = (n: number) => `${n.toFixed(2).replace('.', ',')} €`;
const nombre = (id: string) => gc.recetas.find((r) => r.id === id)?.nombre ?? id;
const L: string[] = [];
const out = (s = '') => L.push(s);

function fila(etq: string, s: SemanaGenerada, datos: DatosMotor) {
  const v = variedadDeSemana(s, datos);
  const cat: Record<string, number> = {};
  for (const t of s.tandas) cat[t.receta.proteina] = (cat[t.receta.proteina] ?? 0) + 1;
  const c = s.carrito;
  const n = s.tandas.filter((t) => nuevas.has(t.receta.id)).length;
  return `| ${etq} | ${eur(c.totalCarrito)} | ${eur(c.totalConsumo)} | ${eur(c.totalPerecedero)} | ${eur(c.totalCarrito - c.totalConsumo + c.totalPerecedero)} | ${v.categorias} | ${v.maxPorCategoria} | ${v.fuentes} | ${s.nutricion.proteinaPorPersonaDia.toFixed(1).replace('.', ',')} | ${n} | ${Object.entries(cat).sort((a, b) => b[1] - a[1]).map(([k, x]) => `${k} ${x}`).join(' · ')} |`;
}

function menu(s: SemanaGenerada) {
  out('| día | comida | cena |');
  out('|---|---|---|');
  for (const d of DIAS) {
    const c = (ranura: string) => {
      const h = s.huecos.find((x) => x.dia === d && x.ranura === ranura);
      if (!h?.receta) return '—';
      return `${nuevas.has(h.receta.id) ? '**NUEVA** ' : ''}${h.receta.nombre} · ${h.receta.proteina}${h.tipo === 'cocinado' ? '' : ` *(${h.tipo})*`}`;
    };
    out(`| ${d} | ${c('comida')} | ${c('cena')} |`);
  }
  out();
}

out('# Lote de Gran Canaria · ¿entra en las semanas? · 15 oct 2026');
out();
out('> Generado por `catalogo/_aud-lote-gc.ts`. Motor de producción sin cambios. Caso: 35007 → 3120 ·');
out('> 2 personas · comidas y cenas · semana desde el lunes 19 oct 2026 · sin despensa · sin filtros ·');
out('> proteína normal · sin postre · variedad alta.');
out();
out(`Recetas disponibles en 3120: ${gcSin.recetas.length} sin el lote, ${gc.recetas.length} con él.`);
out();
out('| | caja | consumo | perecedero | desperdicio* | categorías | máx. por categoría | fuentes | prot. g | tandas nuevas | reparto |');
out('|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|');

const semanas: Record<number, SemanaGenerada> = {};
const enCandidatas = new Map<string, number[]>();
const descartes = new Map<string, Map<string, number>>();
const evaluadas = new Map<string, { veces: number; perdida: number[]; partes: Record<string, number[]> }>();
for (const tope of [60, 80, 100]) {
  const sin = generarSemana(pet(gcSin, tope));
  const ev: EventoTraza[] = [];
  const con = generarSemana(pet(gc, tope, { traza: (e) => ev.push(e) }));
  semanas[tope] = con;
  out(fila(`${tope} € · sin el lote`, sin, gcSin));
  out(fila(`${tope} € · con el lote`, con, gc));
  for (const e of ev) {
    if (e.tipo === 'descarte' && nuevas.has(e.receta) && !e.relajado) {
      const m = descartes.get(e.receta) ?? new Map<string, number>();
      m.set(e.motivo, (m.get(e.motivo) ?? 0) + 1);
      descartes.set(e.receta, m);
    }
  }
  // La puntuación de cada receta nueva frente a la elegida, hueco a hueco.
  const porHueco = new Map<string, Extract<EventoTraza, { tipo: 'candidato' }>[]>();
  let corrida = 0;
  for (const e of ev) {
    if (e.tipo === 'eleccion' && e.hueco === 0) corrida++;
    if (e.tipo === 'candidato' && !e.relajado) {
      const k = `${corrida}:${e.hueco}`;
      porHueco.set(k, [...(porHueco.get(k) ?? []), e]);
    }
  }
  for (const cands of porHueco.values()) {
    const ganadora = cands.reduce((a, b) => (b.puntuacion > a.puntuacion ? b : a));
    for (const c of cands.filter((x) => nuevas.has(x.receta) && x !== ganadora)) {
      const x = evaluadas.get(c.receta) ?? { veces: 0, perdida: [], partes: {} };
      x.veces++;
      x.perdida.push(ganadora.puntuacion - c.puntuacion);
      for (const [k, v] of Object.entries(c.partes)) (x.partes[k] ??= []).push(v - (ganadora.partes[k] ?? 0));
      evaluadas.set(c.receta, x);
    }
  }
  // ¿Aparece en alguna semana candidata (arranque) de la elección final?
  for (const e of ev) {
    if (e.tipo !== 'semana') continue;
    void e;
  }
}
out();
out('\\* caja − consumo + perecedero, el criterio del motor con proteína normal.');
out();

for (const tope of [60, 80, 100]) {
  out(`## ${tope} € · menú con el lote`);
  out();
  menu(semanas[tope]);
}

// Qué entra, por receta
out('## Receta a receta');
out();
out('*Entra* = en cuántos de los tres menús está. *Evaluada* = cuántas veces llegó a puntuarse en la');
out('construcción (todas las semillas, los tres topes) y por cuántos puntos perdía de mediana frente a la');
out('elegida en ese hueco. *Descartes* = reglas que la dejaron fuera antes de puntuarla.');
out();
out('*Dónde pierde*: los dos términos de la puntuación que más la separan de la elegida, en mediana');
out('(puntos por hueco; negativo = en contra). Ver la puntuación en `construir()`.');
out();
out('| receta | categoría | entra | evaluada | pierde por (mediana) | dónde pierde | descartes más frecuentes |');
out('|---|---|---:|---:|---:|---|---|');
for (const r of lote) {
  const veces = [60, 80, 100].filter((t) => semanas[t].tandas.some((x) => x.receta.id === r.id)).length;
  const ev = evaluadas.get(r.id);
  const med = ev?.perdida.length ? [...ev.perdida].sort((a, b) => a - b)[Math.floor(ev.perdida.length / 2)] : null;
  const des = [...(descartes.get(r.id) ?? new Map()).entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, n]) => `${k} ${n}`).join(' · ');
  const cat = gc.recetas.find((x) => x.id === r.id)?.proteina;
  const mediana = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];
  const donde = ev ? Object.entries(ev.partes).map(([k, xs]) => [k, mediana(xs)] as const).filter(([, v]) => v < -0.05).sort((a, b) => a[1] - b[1]).slice(0, 2).map(([k, v]) => `${k} ${v.toFixed(1).replace('.', ',')}`).join(' · ') : '';
  out(`| ${r.nombre} | ${cat} | ${veces} | ${ev?.veces ?? 0} | ${med === null ? '—' : med.toFixed(1).replace('.', ',')} | ${donde || '—'} | ${des || '—'} |`);
}
out();
void enCandidatas;
void nombre;

const salida = path.join(aqui, '..', 'docs', 'recetas-gran-canaria-semanas-2026-10-15.md');
fs.writeFileSync(salida, `${L.join('\n')}\n`);
console.log(`Escrito ${salida}`);
