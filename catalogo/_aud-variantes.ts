#!/usr/bin/env node --experimental-strip-types
/**
 * ═══ VARIANTES DEL MOTOR CON DESPENSA, LADO A LADO ═══
 *
 * Compara, sobre el mismo banco de `_aud-bench-motor.ts`, el motor de
 * producción con varias variantes activadas por banderas de calibración de
 * `PeticionSemana` (ninguna cambia el camino de producción):
 *
 *   antes            cuota sin descontar el armario (como antes del 13 oct)
 *   B                producción
 *   B-sinHolgura     B sin la pasada de holgura
 *   B-calidad-X      B con la pasada que solo acepta por calidad explícita,
 *                    con X % del tope de gasto adicional
 *
 * Dos modalidades:
 *   · UNA SEMANA, misma despensa: semana 2 con la despensa que deja la semana
 *     1 de producción, idéntica para todas las variantes.
 *   · CADENA: cada variante arrastra sus propios sobrantes y su memoria.
 *
 * Escribe docs/motor-variantes-2026-10-13.md con tablas y menús, y un resumen
 * por consola. No modifica el motor.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { existenciasTrasLaSemana } from '../src/motor/carrito.ts';
import type { Existencias } from '../src/motor/carrito.ts';
import { familiaDeSabor, generarSemana, recetarioAdaptado } from '../src/motor/seleccionar.ts';

/** El mismo umbral que usa el motor para decidir de qué vive un plato. */
const PROTEINA_QUE_DEFINE_EL_PLATO_PUBLICO = 8;
import type { PeticionSemana, SemanaGenerada } from '../src/motor/seleccionar.ts';
import type { DatosMotor } from '../src/motor/tipos.ts';

const aqui = path.dirname(fileURLToPath(import.meta.url));
const datos: DatosMotor = JSON.parse(fs.readFileSync(path.join(aqui, '..', 'src', 'data', 'motor-datos.json'), 'utf8'));
const SALIDA = path.join(aqui, '..', 'docs', 'motor-variantes-2026-10-13.md');

type Pet = Omit<PeticionSemana, 'datos'>;
const base = (p: Partial<Pet>): Pet => ({
  N: 2, numHuecos: 14, variedad: 'normal', proteina: 'normal', esfuerzo: 'libre',
  exclusiones: [], presupuesto: 65, semanaNumero: 1, ...p,
});

/** Los escenarios con despensa del banco, y las tres cadenas que hay que mirar de cerca. */
const CADENAS: { id: string; que: string; peticion: Pet; semanas: number; foco?: boolean }[] = [
  { id: 'dos-65', que: '2 personas · 65 €', peticion: base({}), semanas: 4, foco: true },
  { id: 'uno-45', que: '1 persona · 45 €', peticion: base({ N: 1, presupuesto: 45 }), semanas: 4, foco: true },
  { id: 'cuatro-100', que: '4 personas · 100 €', peticion: base({ N: 4, presupuesto: 100 }), semanas: 3 },
  { id: 'dos-50', que: '2 personas · 50 €', peticion: base({ presupuesto: 50 }), semanas: 4 },
  { id: 'tres-80-postre', que: '3 personas · 80 € · postre', peticion: base({ N: 3, presupuesto: 80, postre: true }), semanas: 3, foco: true },
  { id: 'vegano-55', que: '2 personas · 55 € · vegano', peticion: base({ presupuesto: 55, exclusiones: ['Vegano'] }), semanas: 3 },
];

/**
 * Desde el 13 oct 2026 la pasada de holgura está apagada en producción
 * (`PASADA_DE_HOLGURA`), así que «B» es la producción y las variantes con
 * holgura la encienden con `conHolgura`. Los nombres antiguos se conservan
 * para poder comparar con los informes anteriores.
 */
const VARIANTES: { id: string; banderas: Partial<Pet> }[] = [
  { id: 'antes', banderas: { cuotaSinArmario: true, conHolgura: true } },
  { id: 'B-holgura', banderas: { conHolgura: true } },
  { id: 'B', banderas: {} },
  { id: 'B-calidad-5', banderas: { conHolgura: true, holguraPorCalidad: { topeExtra: 0.05, criterio: 'variedad-fuentes' } } },
  { id: 'B-calidad-10', banderas: { conHolgura: true, holguraPorCalidad: { topeExtra: 0.10, criterio: 'variedad-fuentes' } } },
  { id: 'B-calidad-20', banderas: { conHolgura: true, holguraPorCalidad: { topeExtra: 0.20, criterio: 'variedad-fuentes' } } },
  { id: 'B-calidad-10-fp', banderas: { conHolgura: true, holguraPorCalidad: { topeExtra: 0.10, criterio: 'fuentes-perecedero' } } },
  { id: 'B-calidad-10-tol', banderas: { conHolgura: true, holguraPorCalidad: { topeExtra: 0.10, criterio: 'variedad-fuentes', toleranciaPerecedero: 0.25 } } },
];

// --- Medidas -----------------------------------------------------------------

const precioDeSku = (sku: string) => Object.values(datos.skus).find((s) => s.sku === sku)?.precio_kg_l_ud ?? 0;
const valorDe = (e: Existencias) => Object.entries(e).reduce((a, [sku, x]) => a + x.cantidad * precioDeSku(sku), 0);

function trioDeFuentes(s: SemanaGenerada): number {
  const cuenta = new Map<string, number>();
  for (const t of s.tandas) {
    const vistas = new Set<string>();
    for (const ing of t.receta.ingredientes) {
      const meta = datos.ingredientes[ing.canonico];
      if (!meta || meta.es_despensa) continue;
      if ((meta.proteina_g_por_100 ?? 0) < PROTEINA_QUE_DEFINE_EL_PLATO_PUBLICO) continue;
      vistas.add(familiaDeSabor(ing.canonico));
    }
    for (const v of vistas) cuenta.set(v, (cuenta.get(v) ?? 0) + 1);
  }
  return [...cuenta.values()].sort((a, b) => b - a).slice(0, 3).reduce((a, b) => a + b, 0);
}

interface Medida {
  carrito: number; presupuesto: number; cuadra: boolean; conComida: number; huecos: number; raciones: number;
  distintas: number; repetidos: number; sobras: number; trio: number; fuentes: number;
  armarioUsado: number; despensaEntrante: number; perecedero: number; comidaNueva: number; consumo: number;
  inventarioSaliente: number; minutos: number; proteina: number; cumpleSuelo: boolean; frescos: number;
  animal: number; ms: number; restricciones: boolean; determinista: boolean; huella: string;
}

function medir(p: PeticionSemana, despensaEntrante: number, dosVeces: boolean): { m: Medida; s: SemanaGenerada } {
  const t0 = performance.now();
  const s = generarSemana(p);
  const ms = Math.round(performance.now() - t0);
  const huella = s.huecos.map((h) => `${h.tipo[0]}:${h.receta?.id ?? '-'}`).join(' ');
  let determinista = true;
  if (dosVeces) {
    const otra = generarSemana(p);
    determinista = otra.huecos.map((h) => `${h.tipo[0]}:${h.receta?.id ?? '-'}`).join(' ') === huella
      && otra.carrito.totalCarrito === s.carrito.totalCarrito;
  }
  const permitidas = new Set(recetarioAdaptado(datos, p.exclusiones ?? [], Infinity, p.platosBloqueados).map((r) => r.id));
  const restricciones = s.tandas.every((t) => permitidas.has(t.receta.id))
    && s.huecos.length === p.numHuecos
    && (!s.cuadra || (s.carrito.totalCarrito <= (p.presupuesto ?? Infinity) + 0.005 && s.nutricion.cumpleSuelo));
  const c = s.carrito;
  const fuentes = new Set<string>();
  for (const t of s.tandas) for (const ing of t.receta.ingredientes) {
    const meta = datos.ingredientes[ing.canonico];
    if (meta && !meta.es_despensa && (meta.proteina_g_por_100 ?? 0) >= PROTEINA_QUE_DEFINE_EL_PLATO_PUBLICO) fuentes.add(familiaDeSabor(ing.canonico));
  }
  const conComida = s.huecos.filter((h) => h.receta).length;
  let minutos = 0;
  for (const h of s.huecos) {
    if (!h.receta) continue;
    minutos += h.tipo === 'cocinado' ? h.receta.minutos : (h.ensamblaje?.minutos ?? 0);
  }
  return {
    s,
    m: {
      carrito: c.totalCarrito, presupuesto: p.presupuesto ?? Infinity, cuadra: s.cuadra, conComida, huecos: p.numHuecos,
      raciones: conComida * p.N, distintas: s.recetasDistintas.length, repetidos: s.tandas.length - s.recetasDistintas.length,
      sobras: s.huecos.filter((h) => h.receta && h.tipo !== 'cocinado').length, trio: trioDeFuentes(s), fuentes: fuentes.size,
      armarioUsado: c.totalDelArmario, despensaEntrante, perecedero: c.totalPerecedero,
      comidaNueva: Number((c.totalConsumo - c.totalDelArmario).toFixed(2)), consumo: c.totalConsumo,
      inventarioSaliente: Number(valorDe(existenciasTrasLaSemana(c, p.existencias)).toFixed(2)),
      minutos, proteina: s.nutricion.proteinaPorPersonaDia, cumpleSuelo: s.nutricion.cumpleSuelo,
      frescos: s.nutricion.huecosConFresca, animal: s.nutricion.huecosConAnimal, ms, restricciones, determinista, huella,
    },
  };
}

// --- Texto -------------------------------------------------------------------

const e = (n: number) => n.toFixed(2).replace('.', ',');
const md: string[] = [];
const linea = (s = '') => md.push(s);

function menu(s: SemanaGenerada): string[] {
  const filas: string[] = [];
  for (const h of s.huecos) {
    const que = h.tipo === 'cocinado' ? 'cocinas' : h.tipo === 'sobras' ? 'sobras' : h.tipo === 'ensamblaje' ? 'aprovechas' : 'libre';
    const nombre = h.ensamblaje ? h.ensamblaje.nombre : (h.receta?.nombre ?? '—');
    filas.push(`${h.dia} ${h.ranura.padEnd(6)} ${que.padEnd(10)} ${nombre}`);
  }
  return filas;
}

function lineas(s: SemanaGenerada): string[] {
  return [...s.carrito.lineas]
    .filter((l) => !l.esDespensa)
    .sort((a, b) => b.carritoCoste - a.carritoCoste)
    .map((l) => `${e(l.carritoCoste).padStart(7)} €  ${String(l.compras).padStart(2)}×  ${l.nombre}${l.compras === 0 ? '  (del armario)' : ''}`);
}

const cab = '| variante | caja | cuadra | comidas | platos | repite | sobras | trío | fuentes | armario | perec. | comida nueva | inventario sal. | min cocina | prot | fresco | animal | ms | restr. | determ. |';
const sep = '|---|---:|:-:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|:-:|:-:|';
const fila = (id: string, m: Medida) =>
  `| ${id} | ${e(m.carrito)} / ${m.presupuesto} | ${m.cuadra ? 'sí' : 'NO'} | ${m.conComida}/${m.huecos} | ${m.distintas} | ${m.repetidos} | ${m.sobras} | ${m.trio} | ${m.fuentes} | ${e(m.armarioUsado)} de ${e(m.despensaEntrante)} | ${e(m.perecedero)} | ${e(m.comidaNueva)} | ${e(m.inventarioSaliente)} | ${m.minutos} | ${m.proteina}${m.cumpleSuelo ? '' : '!'} | ${m.frescos} | ${m.animal} | ${m.ms} | ${m.restricciones ? 'ok' : 'FALLA'} | ${m.determinista ? 'sí' : 'NO'} |`;

// --- 1 · Una semana, misma despensa -------------------------------------------

linea('# Variantes del motor con despensa · 13 oct 2026');
linea();
linea('Generado por `catalogo/_aud-variantes.ts`. Leyenda de columnas:');
linea('`trío` = de cuántas de las tandas vive el trío de fuentes de proteína más repetido (menos es más repartido); `fuentes` = fuentes de proteína distintas; `armario` = euros que salen de casa sobre el valor de la despensa entrante; `inventario sal.` = valor a precio de catálogo de lo que queda tras la semana; `fresco` = huecos con carne, pescado o marisco NO en conserva (el congelado cuenta como fresco; legumbre, huevo y lácteo cuentan como «ninguna»); `animal` = huecos con cualquier proteína animal, conserva incluida.');
linea();
linea('## 1 · Una semana con exactamente la misma despensa');
linea();
linea('Semana 2 de cada hogar, con la despensa y la memoria que deja la semana 1 de producción. Mismo catálogo, mismas preferencias, misma despensa para todas las variantes.');
linea();

const resumenUna: Record<string, Medida[]> = {};
const focosUna: { id: string; variante: string; s: SemanaGenerada }[] = [];
for (const c of CADENAS) {
  const s1 = generarSemana({ datos, ...c.peticion, semanaNumero: 1 });
  const armario = existenciasTrasLaSemana(s1.carrito);
  const memoria = [[...new Set(s1.tandas.map((t) => t.receta.id))]];
  const entrante = valorDe(armario);
  linea(`### ${c.que} · semana 2 · despensa entrante ${e(entrante)} €`);
  linea();
  linea(cab); linea(sep);
  for (const v of VARIANTES) {
    const { m, s } = medir({ datos, ...c.peticion, ...v.banderas, semanaNumero: 2, existencias: armario, recetasRecientes: memoria }, entrante, true);
    (resumenUna[v.id] ??= []).push(m);
    linea(fila(v.id, m));
    if (c.foco) focosUna.push({ id: c.id, variante: v.id, s });
  }
  if (c.id === 'dos-65') {
    const b = medir({ datos, ...c.peticion, semanaNumero: 2, existencias: armario, recetasRecientes: memoria, sinHolgura: true, cuotaSinArmario: true }, entrante, false);
    linea(fila('antes-sinHolgura (base 40,87 €)', b.m));
    focosUna.push({ id: c.id, variante: 'antes-sinHolgura', s: b.s });
  }
  linea();
}

// --- 2 · Cadenas --------------------------------------------------------------

linea('## 2 · Cadenas: cada variante arrastra sus propios sobrantes');
linea();
linea('Semana 1 sin despensa; de la 2 en adelante, con lo que dejó la semana anterior de ESA variante y su memoria. «compra» es la suma de caja de todas las semanas; «inventario final» el valor de lo que queda en casa al acabar.');
linea();
const cabCadena = '| variante | compra acumulada | comida nueva acum. | perecedero acum. | inventario final | compra − inventario | min cocina | fresco (sem.) | trío medio | prot. media | cuadran | ms medio |';
const sepCadena = '|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|';
const resumenCadena: Record<string, { compra: number; comida: number; perec: number; inv: number; frescos: number; trio: number; prot: number; cuadran: number; semanas: number; ms: number }> = {};
const menusCadena: { id: string; variante: string; semana: number; s: SemanaGenerada; m: Medida }[] = [];
for (const c of CADENAS) {
  linea(`### ${c.que} · ${c.semanas} semanas`);
  linea();
  linea(cabCadena); linea(sepCadena);
  const porSemana: string[] = [];
  for (const v of VARIANTES) {
    let armario: Existencias = {};
    let historial: string[][] = [];
    const acum = { compra: 0, comida: 0, perec: 0, inv: 0, frescos: 0, trio: 0, prot: 0, cuadran: 0, semanas: 0, ms: 0, minutos: 0 };
    for (let n = 1; n <= c.semanas; n++) {
      const { m, s } = medir({ datos, ...c.peticion, ...v.banderas, semanaNumero: n, existencias: armario, recetasRecientes: historial }, valorDe(armario), false);
      acum.compra += m.carrito; acum.comida += m.comidaNueva; acum.perec += m.perecedero; acum.frescos += m.frescos;
      acum.trio += m.trio; acum.prot += m.proteina; acum.cuadran += m.cuadra ? 1 : 0; acum.semanas++; acum.ms += m.ms; acum.minutos += m.minutos;
      acum.inv = m.inventarioSaliente;
      porSemana.push(`| ${v.id} | ${n} | ${e(m.carrito)} | ${e(m.armarioUsado)} | ${e(m.comidaNueva)} | ${e(m.perecedero)} | ${e(m.inventarioSaliente)} | ${m.distintas} | ${m.trio} | ${m.frescos} | ${m.animal} | ${m.proteina} | ${m.minutos} |`);
      if (c.foco) menusCadena.push({ id: c.id, variante: v.id, semana: n, s, m });
      armario = existenciasTrasLaSemana(s.carrito, armario);
      historial = [[...new Set(s.tandas.map((t) => t.receta.id))], ...historial].slice(0, 3);
    }
    const r = resumenCadena[v.id] ??= { compra: 0, comida: 0, perec: 0, inv: 0, frescos: 0, trio: 0, prot: 0, cuadran: 0, semanas: 0, ms: 0 };
    r.compra += acum.compra; r.comida += acum.comida; r.perec += acum.perec; r.inv += acum.inv; r.frescos += acum.frescos; r.trio += acum.trio; r.prot += acum.prot; r.cuadran += acum.cuadran; r.semanas += acum.semanas; r.ms += acum.ms;
    linea(`| ${v.id} | ${e(acum.compra)} | ${e(acum.comida)} | ${e(acum.perec)} | ${e(acum.inv)} | ${e(acum.compra - acum.inv)} | ${acum.minutos} | ${(acum.frescos / acum.semanas).toFixed(1)} | ${(acum.trio / acum.semanas).toFixed(1)} | ${(acum.prot / acum.semanas).toFixed(1)} | ${acum.cuadran}/${acum.semanas} | ${Math.round(acum.ms / acum.semanas)} |`);
  }
  linea();
  linea('<details><summary>semana a semana</summary>');
  linea();
  linea('| variante | sem | caja | armario | comida nueva | perec. | inventario sal. | platos | trío | fresco | animal | prot | min |');
  linea('|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|');
  for (const l of porSemana) linea(l);
  linea();
  linea('</details>');
  linea();
}

linea('### Total de las seis cadenas');
linea();
linea(cabCadena.replace('| min cocina ', '')); linea(sepCadena.slice(0, -5));
for (const [id, r] of Object.entries(resumenCadena)) {
  linea(`| ${id} | ${e(r.compra)} | ${e(r.comida)} | ${e(r.perec)} | ${e(r.inv)} | ${e(r.compra - r.inv)} | ${(r.frescos / r.semanas).toFixed(1)} | ${(r.trio / r.semanas).toFixed(1)} | ${(r.prot / r.semanas).toFixed(1)} | ${r.cuadran}/${r.semanas} | ${Math.round(r.ms / r.semanas)} |`);
}
linea();

// --- 3 · Menús de los casos de foco -------------------------------------------

linea('## 3 · Menús completos de los casos que había que mirar');
linea();
linea('### 2 personas · 65 € · semana 2 con la misma despensa');
linea();
for (const f of focosUna.filter((x) => x.id === 'dos-65')) {
  const c = f.s.carrito;
  linea(`#### ${f.variante} — caja ${e(c.totalCarrito)} € · armario ${e(c.totalDelArmario)} € · perecedero ${e(c.totalPerecedero)} € · proteína ${f.s.nutricion.proteinaPorPersonaDia} g`);
  linea('```'); for (const l of menu(f.s)) linea(l); linea('```');
  linea('<details><summary>lista de la compra</summary>'); linea(); linea('```'); for (const l of lineas(f.s)) linea(l); linea('```'); linea('</details>'); linea();
}
for (const id of ['uno-45', 'tres-80-postre']) {
  const c = CADENAS.find((x) => x.id === id)!;
  linea(`### ${c.que} · cadena · antes frente a B`);
  linea();
  for (const variante of ['antes', 'B']) {
    for (const x of menusCadena.filter((y) => y.id === id && y.variante === variante)) {
      linea(`#### ${variante} · semana ${x.semana} — caja ${e(x.m.carrito)} € · armario ${e(x.m.armarioUsado)} € · perecedero ${e(x.m.perecedero)} € · fresco ${x.m.frescos} · animal ${x.m.animal} · proteína ${x.m.proteina} g · trío ${x.m.trio}`);
      linea('```'); for (const l of menu(x.s)) linea(l); linea('```'); linea();
    }
  }
}

fs.writeFileSync(SALIDA, `${md.join('\n')}\n`);
console.log(`Escrito ${SALIDA}`);
console.log('\nUNA SEMANA, MISMA DESPENSA · medias sobre los 6 hogares');
for (const [id, ms] of Object.entries(resumenUna)) {
  const n = ms.length; const s = (f: (m: Medida) => number) => ms.reduce((a, m) => a + f(m), 0) / n;
  console.log(`  ${id.padEnd(16)} caja ${s((m) => m.carrito).toFixed(2)} · armario ${s((m) => m.armarioUsado).toFixed(2)} · perec ${s((m) => m.perecedero).toFixed(2)} · nueva ${s((m) => m.comidaNueva).toFixed(2)} · inv.sal ${s((m) => m.inventarioSaliente).toFixed(2)} · platos ${s((m) => m.distintas).toFixed(1)} · trío ${s((m) => m.trio).toFixed(1)} · fresco ${s((m) => m.frescos).toFixed(1)} · prot ${s((m) => m.proteina).toFixed(1)} · min ${s((m) => m.minutos).toFixed(0)} · ms ${s((m) => m.ms).toFixed(0)} · determ ${ms.every((m) => m.determinista)} · restr ${ms.every((m) => m.restricciones)}`);
}
console.log('\nCADENAS · total de las seis');
for (const [id, r] of Object.entries(resumenCadena)) {
  console.log(`  ${id.padEnd(16)} compra ${r.compra.toFixed(2)} · comida nueva ${r.comida.toFixed(2)} · perec ${r.perec.toFixed(2)} · inventario final ${r.inv.toFixed(2)} · compra−inv ${(r.compra - r.inv).toFixed(2)} · fresco/sem ${(r.frescos / r.semanas).toFixed(2)} · trío ${(r.trio / r.semanas).toFixed(2)} · prot ${(r.prot / r.semanas).toFixed(1)} · cuadran ${r.cuadran}/${r.semanas} · ms ${Math.round(r.ms / r.semanas)}`);
}
