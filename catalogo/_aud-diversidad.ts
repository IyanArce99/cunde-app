#!/usr/bin/env node --experimental-strip-types
/**
 * ═══ ¿PUEDE EL MARGEN COMPRAR VARIEDAD SIN COMPRAR DE MÁS? ═══
 *
 * Compara el motor de producción con el experimento `diversidad`
 * (PeticionSemana.diversidad) en un caso controlado:
 *
 *   2 personas · comidas y cenas (14) · semana que empieza el lunes 19 oct 2026
 *   sin despensa · sin filtros · proteína normal · sin postre · variedad alta
 *
 * en tres catálogos, para separar motor y catálogo:
 *
 *   gc            Gran Canaria, almacén 3120 (35007), el de la app hoy
 *   gc-supuesta   Gran Canaria si aceptaras las 16 alternativas ya validadas
 *                 técnicamente (catalogo/capturas-crudas/zona-gran-canaria-
 *                 supuesta.json, de `construir-zona.ts cerrar … --suponer-aceptadas`).
 *                 NO es el catálogo de la app.
 *   madrid        Madrid (mad3), control
 *
 * y tres topes: 60, 80 y 100 €. No modifica el motor ni los datos.
 *
 *   node --experimental-strip-types catalogo/_aud-diversidad.ts barrido
 *   node --experimental-strip-types catalogo/_aud-diversidad.ts informe <bonus> <tolerancia>
 *
 * `informe` escribe docs/motor-diversidad-2026-10-15.md con tablas y menús.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { diversidadDe, familiaDeSabor, generarSemana, recetarioAdaptado } from '../src/motor/seleccionar.ts';
import type { PeticionSemana, SemanaGenerada } from '../src/motor/seleccionar.ts';
import { datosDeZona } from '../src/motor/zona.ts';
import type { CatalogoZona } from '../src/motor/zona.ts';
import { DIAS } from '../src/motor/tipos.ts';
import type { DatosMotor } from '../src/motor/tipos.ts';

const aqui = path.dirname(fileURLToPath(import.meta.url));
const leer = (f: string) => JSON.parse(fs.readFileSync(path.join(aqui, '..', f), 'utf8'));
const base = leer('src/data/motor-datos.json') as DatosMotor;
const SUPUESTA = 'catalogo/capturas-crudas/zona-gran-canaria-supuesta.json';

const CATALOGOS: { id: string; que: string; datos: DatosMotor }[] = [
  { id: 'gc', que: 'Gran Canaria 3120 (app hoy)', datos: datosDeZona(base, leer('src/data/zonas/gran-canaria.json') as CatalogoZona, '3120') },
  ...(fs.existsSync(path.join(aqui, '..', SUPUESTA))
    ? [{ id: 'gc-supuesta', que: 'Gran Canaria 3120 con las 16 alternativas aceptadas (supuesto)', datos: datosDeZona(base, leer(SUPUESTA) as CatalogoZona, '3120') }]
    : []),
  { id: 'madrid', que: 'Madrid mad3 (control)', datos: base },
];
const TOPES = [60, 80, 100];

const peticion = (datos: DatosMotor, tope: number, extra: Partial<PeticionSemana> = {}): PeticionSemana => ({
  datos, N: 2, numHuecos: 14, variedad: 'mucha', proteina: 'normal', esfuerzo: 'libre', exclusiones: [],
  presupuesto: tope, postre: false, semanaNumero: 1, recetasRecientes: [], existencias: {}, ordenDias: DIAS, ...extra,
});

const PROTEINA_DEFINE = 8;
const eur = (n: number) => `${n.toFixed(2).replace('.', ',')} €`;
const num = (n: number, d = 1) => n.toFixed(d).replace('.', ',');

interface Medida {
  caja: number; consumo: number; perecedero: number; inventario: number; noComido: number;
  platos: number; tandas: number; sobras: number; recocinados: number;
  familias: Record<string, number>; nFamilias: number; maxFamilia: number; fuentes: number; trio: number;
  porFuente: Record<string, number>;
  proteina: number; fresca: number; minutos: number; maxMinDia: number; ms: number; cuadra: boolean; filtros: boolean;
}

function medir(datos: DatosMotor, p: PeticionSemana): { m: Medida; s: SemanaGenerada } {
  const t0 = performance.now();
  const s = generarSemana(p);
  const ms = Math.round(performance.now() - t0);
  const c = s.carrito;
  const familias: Record<string, number> = {};
  for (const t of s.tandas) familias[t.receta.proteina] = (familias[t.receta.proteina] ?? 0) + 1;
  const cuentaFuentes = new Map<string, number>();
  for (const t of s.tandas) {
    const vistas = new Set<string>();
    for (const ing of t.receta.ingredientes) {
      const meta = datos.ingredientes[ing.canonico];
      if (!meta || meta.es_despensa || (meta.proteina_g_por_100 ?? 0) < PROTEINA_DEFINE) continue;
      vistas.add(familiaDeSabor(ing.canonico));
    }
    for (const v of vistas) cuentaFuentes.set(v, (cuentaFuentes.get(v) ?? 0) + 1);
  }
  const minPorDia = new Map<string, number>();
  for (const h of s.huecos) {
    if (!h.receta) continue;
    const m = h.tipo === 'cocinado' ? h.receta.minutos : (h.ensamblaje?.minutos ?? 0);
    minPorDia.set(h.dia, (minPorDia.get(h.dia) ?? 0) + m);
  }
  const permitidas = new Set(recetarioAdaptado(datos, p.exclusiones ?? [], Infinity).map((r) => r.id));
  return {
    s,
    m: {
      caja: c.totalCarrito, consumo: c.totalConsumo, perecedero: c.totalPerecedero, inventario: c.totalInventario,
      noComido: c.totalCarrito - c.totalConsumo,
      platos: new Set(s.tandas.map((t) => t.receta.id)).size, tandas: s.tandas.length,
      sobras: s.huecos.filter((h) => h.tipo !== 'cocinado' && h.tipo !== 'libre').length,
      recocinados: s.tandas.length - new Set(s.tandas.map((t) => t.receta.id)).size,
      familias, nFamilias: Object.keys(familias).length, maxFamilia: Math.max(...Object.values(familias)),
      fuentes: cuentaFuentes.size,
      porFuente: Object.fromEntries(cuentaFuentes),
      trio: [...cuentaFuentes.values()].sort((a, b) => b - a).slice(0, 3).reduce((a, b) => a + b, 0),
      proteina: s.nutricion.proteinaPorPersonaDia, fresca: s.nutricion.huecosConFresca,
      minutos: [...minPorDia.values()].reduce((a, b) => a + b, 0), maxMinDia: Math.max(...minPorDia.values()),
      ms, cuadra: s.cuadra,
      filtros: s.tandas.every((t) => permitidas.has(t.receta.id)) && s.huecos.length === 14 && c.totalCarrito <= (p.presupuesto ?? Infinity) + 0.005,
    },
  };
}

const fam = (f: Record<string, number>) => Object.entries(f).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(' · ');

// ---------------------------------------------------------------------------

const [orden, a1, a2] = process.argv.slice(2);

if (orden === 'barrido') {
  console.log('catálogo · tope · motor → caja · no comido · perecedero · platos · familias (máx) · fuentes · prot · ms');
  for (const cat of CATALOGOS) for (const tope of TOPES) {
    const prod = medir(cat.datos, peticion(cat.datos, tope)).m;
    console.log(`${cat.id} ${tope} prod        → ${eur(prod.caja)} · ${eur(prod.noComido)} · ${eur(prod.perecedero)} · ${prod.platos} · ${prod.nFamilias} (${prod.maxFamilia}) · ${prod.fuentes} · ${num(prod.proteina)} · ${prod.ms}`);
    for (const bonus of [0, 4, 8, 12]) for (const tol of [0, 2, 4, 8]) {
      const m = medir(cat.datos, peticion(cat.datos, tope, { diversidad: { bonusFamiliaNueva: bonus, toleranciaDesperdicio: tol } })).m;
      console.log(`${cat.id} ${tope} b${bonus} t${tol}`.padEnd(19) + `→ ${eur(m.caja)} · ${eur(m.noComido)} · ${eur(m.perecedero)} · ${m.platos} · ${m.nFamilias} (${m.maxFamilia}) · ${m.fuentes} · ${num(m.proteina)} · ${m.ms}${m.filtros ? '' : ' · ¡RESTRICCIÓN!'}`);
    }
  }
  process.exit(0);
}

if (orden !== 'informe') {
  console.error('Uso: _aud-diversidad.ts barrido | informe <bonus> <tolerancia>');
  process.exit(1);
}

const bonus = Number(a1 ?? 8);
const tol = Number(a2 ?? 4);
const lineas: string[] = [];
const out = (s = '') => lineas.push(s);

out('# Motor · aprovechar el margen en variedad · datos · 15 oct 2026');
out();
out('> Generado por `catalogo/_aud-diversidad.ts informe ' + `${bonus} ${tol}` + '`. El análisis está en');
out('> `docs/motor-diversidad-informe-2026-10-15.md`. Nada de esto es producción.');
out();
out('**Caso controlado.** 2 personas · comidas y cenas (14) · semana desde el lunes 19 oct 2026 ·');
out('sin despensa · sin filtros · proteína normal · sin postre · variedad alta · semana 1, sin historial.');
out();
out(`**Experimento.** \`diversidad: { bonusFamiliaNueva: ${bonus}, toleranciaDesperdicio: ${tol} }\`. Ver \`PeticionSemana.diversidad\`.`);
out();
out('**Columnas.** *No comido*: caja − consumo, lo que se compra y no se come esta semana (inventario + perecedero).');
out('*Perecedero*: la parte de eso que se da por perdida. *Familias*: tipos de plato distintos por `receta.proteina`;');
out('entre paréntesis, tandas del más repetido. *Fuentes*: familias de ingrediente con ≥ 8 g de proteína/100 g.');
out('*Trío*: tandas que cubren las tres fuentes más repetidas (menos es más repartido). *Sobras*: comidas sin cocinar.');
out();

const resultados: { cat: string; tope: number; motor: string; m: Medida; s: SemanaGenerada; datos: DatosMotor }[] = [];
for (const cat of CATALOGOS) for (const tope of TOPES) {
  for (const [motor, extra] of [['producción', {}], ['experimento', { diversidad: { bonusFamiliaNueva: bonus, toleranciaDesperdicio: tol } }]] as const) {
    const r = medir(cat.datos, peticion(cat.datos, tope, extra as Partial<PeticionSemana>));
    const r2 = medir(cat.datos, peticion(cat.datos, tope, extra as Partial<PeticionSemana>));
    const huella = (s: SemanaGenerada) => s.huecos.map((h) => `${h.tipo}:${h.receta?.id}`).join(' ');
    if (huella(r.s) !== huella(r2.s)) throw new Error(`no determinista: ${cat.id} ${tope} ${motor}`);
    resultados.push({ cat: cat.id, tope, motor, m: r.m, s: r.s, datos: cat.datos });
  }
}

for (const cat of CATALOGOS) {
  out(`## ${cat.que}`);
  out();
  out(`${recetarioAdaptado(cat.datos, [], Infinity).length} recetas elegibles.`);
  out();
  out('| tope | motor | caja | consumo | no comido | perecedero | platos | tandas | sobras | familias | fuentes | trío | prot. g | fresco | min | ms |');
  out('|---:|---|---:|---:|---:|---:|---:|---:|---:|---|---:|---:|---:|---:|---:|---:|');
  for (const r of resultados.filter((x) => x.cat === cat.id)) {
    const m = r.m;
    out(`| ${r.tope} | ${r.motor} | ${eur(m.caja)} | ${eur(m.consumo)} | ${eur(m.noComido)} | ${eur(m.perecedero)} | ${m.platos} | ${m.tandas} | ${m.sobras} | ${m.nFamilias} (${m.maxFamilia}) | ${m.fuentes} | ${m.trio} | ${num(m.proteina)} | ${m.fresca} | ${m.minutos} | ${m.ms} |`);
  }
  out();
  out('Reparto de tandas por tipo de plato:');
  out();
  for (const r of resultados.filter((x) => x.cat === cat.id)) out(`- ${r.tope} € · ${r.motor}: ${fam(r.m.familias)}`);
  out();
}

const malas = resultados.filter((r) => !r.m.filtros || !r.m.cuadra);
out(`**Restricciones.** ${malas.length ? `FALLAN: ${malas.map((r) => `${r.cat} ${r.tope} ${r.motor}`).join(', ')}` : `Las ${resultados.length} semanas cubren las 14 comidas, solo usan recetas permitidas, caben en su tope y cumplen el suelo de proteína. Cada una se ha generado dos veces con el mismo resultado.`}`);
out();
out('## Menús completos y compra por envases');
out();
for (const r of resultados) {
  out(`### ${CATALOGOS.find((c) => c.id === r.cat)!.que} · ${r.tope} € · ${r.motor}`);
  out();
  out(`Ingredientes principales (fuentes de proteína, tandas en que aparecen): ${fam(r.m.porFuente)}.`);
  out();
  out(`Caja ${eur(r.m.caja)} · se come ${eur(r.m.consumo)} · perecedero ${eur(r.m.perecedero)} · ${r.m.platos} platos · ${r.m.sobras} comidas de sobras · ${r.m.recocinados} recetas cocinadas otra vez.`);
  out();
  out('| día | comida | cena |');
  out('|---|---|---|');
  for (const d of DIAS) {
    const celda = (ranura: string) => {
      const h = r.s.huecos.find((x) => x.dia === d && x.ranura === ranura);
      if (!h?.receta) return '—';
      const marca = h.tipo === 'cocinado' ? '' : h.tipo === 'sobras' ? ' *(sobras)*' : ` *(${h.tipo})*`;
      return `${h.receta.nombre} · ${h.receta.proteina}${marca}`;
    };
    out(`| ${d} | ${celda('comida')} | ${celda('cena')} |`);
  }
  out();
  out('| producto | envases | se usa | sobra | caja | perecedero |');
  out('|---|---:|---:|---:|---:|---:|');
  for (const l of r.s.carrito.lineas.filter((x) => !x.esDespensa && x.compras > 0).sort((a, b) => b.carritoCoste - a.carritoCoste)) {
    const u = l.unidad === 'ud' ? 'ud' : l.unidad;
    out(`| ${l.nombre} | ${l.compras} × ${num(l.contenidoEnvase, 2)} ${u} | ${num(l.necesario, 2)} ${u} | ${num(l.sobranteCantidad, 2)} ${u} | ${eur(l.carritoCoste)} | ${l.perecederoCoste > 0.005 ? eur(l.perecederoCoste) : '—'} |`);
  }
  out();
}

const salida = path.join(aqui, '..', 'docs', 'motor-diversidad-2026-10-15.md');
fs.writeFileSync(salida, `${lineas.join('\n')}\n`);
console.log(`Escrito ${salida}`);
for (const r of resultados) {
  const m = r.m;
  console.log(`${r.cat.padEnd(12)} ${r.tope} ${r.motor.padEnd(12)} caja ${eur(m.caja)} · noComido ${eur(m.noComido)} · perec ${eur(m.perecedero)} · platos ${m.platos} · sobras ${m.sobras} · fam ${m.nFamilias}(${m.maxFamilia}) · fuentes ${m.fuentes} · trío ${m.trio} · prot ${num(m.proteina)} · ${fam(m.familias)}`);
}
void diversidadDe;
