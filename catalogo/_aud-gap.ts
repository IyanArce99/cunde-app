#!/usr/bin/env node --experimental-strip-types
/**
 * ¿Cuánto se deja el greedy sobre la mesa?
 *
 * A) 8 semillas frente a TODAS las semillas (el mismo greedy, más arranques).
 * B) ¿Existe una semana "mucha variedad" ≤51 € con ≥55 g? Búsqueda con
 *    retroceso sobre el mismo árbol de decisión del greedy, con las
 *    restricciones ESTRICTAS (sin pasada relajada): si aparece una, es
 *    válida de pleno derecho y el límite era del greedy.
 * C) Óptimo real en un caso reducido, para medir el gap en €.
 *
 * Las podas son válidas porque el carrito es monótono al añadir tandas
 * (solo se compra más, nunca menos) y la proteína alcanzable por hueco
 * está acotada por el mejor plato del recetario.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { calcularCarrito, consumoPorRacion, proteinaAnimal, proteinaPorRacion } from '../src/motor/carrito.ts';
import { esFinDeSemanaBueno, planificarTanda, posicionesDeSemana, rindeEfectivo } from '../src/motor/reparto.ts';
import {
  construir, generarSemana, nutricionDe, recetarioAdaptado,
  GRAMOS_POR_NIVEL, RECETAS_POR_VARIEDAD, TANDAS_POR_RECETA_POR_VARIEDAD, FRACCION_SOBRAS_POR_VARIEDAD,
} from '../src/motor/seleccionar.ts';
import type { NivelProteina, PeticionSemana, Variedad } from '../src/motor/seleccionar.ts';
import type { DatosMotor, Hueco, Receta, Tanda } from '../src/motor/tipos.ts';

const aqui = path.dirname(fileURLToPath(import.meta.url));
const datos: DatosMotor = JSON.parse(
  fs.readFileSync(path.join(aqui, '..', 'src', 'data', 'motor-datos.json'), 'utf8'),
);
const N = 2;
const VARIEDADES: Variedad[] = ['poca', 'normal', 'mucha'];
const NIVELES: NivelProteina[] = ['basica', 'normal', 'alta'];

const criterioDe = (nivel: NivelProteina) => (c: number, p: number) =>
  (nivel === 'basica' ? p : nivel === 'alta' ? c : c + p);

// --- A · 8 semillas frente a todas ------------------------------------------

console.log('A · ¿CUÁNTO DEJAN LAS 8 SEMILLAS? (todas las recetas como arranque)\n');
console.log('celda    greedy-8 (c€/prot/perec)   greedy-62               mejora');
let mejoras = 0;
for (const proteina of NIVELES) {
  for (const variedad of VARIEDADES) {
    const peticion: PeticionSemana = { datos, N, numHuecos: 14, variedad, proteina, presupuesto: 51 };
    const base = generarSemana(peticion);
    const suelo = GRAMOS_POR_NIVEL[proteina];
    const criterio = criterioDe(proteina);

    let mejor: NonNullable<ReturnType<typeof construir>> | null = null;
    let rangoMejor: number[] = [];
    for (const r of recetarioAdaptado(datos)) {
      const c = construir(peticion, { forzarPrimera: r.id });
      if (!c) continue;
      const nut = nutricionDe(c.huecos, datos, N, suelo);
      const rango = [
        nut.cumpleSuelo ? 0 : 1,
        c.carrito.totalCarrito <= 51 ? 0 : 1,
        criterio(c.carrito.totalCarrito, c.carrito.totalPerecedero),
      ];
      const gana = !mejor || rango.some((v, k) => v !== rangoMejor[k] && v < rangoMejor[k]
        && rango.slice(0, k).every((x, j) => x === rangoMejor[j]));
    if (gana) { mejor = c; rangoMejor = rango; }
    }

    const b = base.carrito;
    const m = mejor!.carrito;
    const critB = criterio(b.totalCarrito, b.totalPerecedero);
    const critM = criterio(m.totalCarrito, m.totalPerecedero);
    const delta = critB - critM;
    if (delta > 0.005) mejoras++;
    console.log(
      `${variedad.slice(0, 2)}·${proteina.slice(0, 2)}    `
      + `${b.totalCarrito.toFixed(2)}€/${base.nutricion.proteinaPorPersonaDia.toFixed(0)}g/${b.totalPerecedero.toFixed(2)}€`
      + `     ${m.totalCarrito.toFixed(2)}€/${nutricionDe(mejor!.huecos, datos, N, suelo).proteinaPorPersonaDia.toFixed(0)}g/${m.totalPerecedero.toFixed(2)}€`
      + `     ${delta > 0.005 ? `-${delta.toFixed(2)}€ de criterio` : '='}`,
    );
  }
}
console.log(`\n  Celdas donde 62 semillas mejoran a 8: ${mejoras}/9`);

// --- Búsqueda con retroceso --------------------------------------------------

interface Resultado {
  nodos: number;
  agotado: boolean;
  mejor: { tandas: Tanda[]; carrito: number; perecedero: number; prot: number } | null;
}

function buscarExhaustivo(
  recetas: Receta[],
  numHuecos: number,
  variedad: Variedad,
  nivel: NivelProteina,
  presupuesto: number,
  topeNodos: number,
  objetivo: 'factible-barata' | 'optimo-criterio',
): Resultado {
  const topeRecetas = RECETAS_POR_VARIEDAD[variedad];
  const topeTandas = TANDAS_POR_RECETA_POR_VARIEDAD[variedad];
  const topeSobras = Math.floor(numHuecos * FRACCION_SOBRAS_POR_VARIEDAD[variedad]);
  const suelo = GRAMOS_POR_NIVEL[nivel];
  const objetivoProteina = suelo * 7 * N;
  const criterio = criterioDe(nivel);
  const posiciones = posicionesDeSemana(numHuecos);
  const proteinaDe = (r: Receta) => proteinaPorRacion(r, datos, N) * N;
  const techoHueco = Math.max(...recetas.map(proteinaDe));
  const basesDe = (r: Receta) =>
    new Set(r.ingredientes.map((i) => datos.ingredientes[i.canonico].base).filter(Boolean) as string[]);

  const res: Resultado = { nodos: 0, agotado: true, mejor: null };
  let cotaCriterio = Infinity;

  const dfs = (
    ocupados: (Hueco | null)[], tandas: Tanda[], usos: Map<string, number>,
    usosBase: Map<string, number>, sobras: number, prot: number, frescos: number, coste: number,
  ): void => {
    if (res.nodos >= topeNodos) { res.agotado = false; return; }
    res.nodos++;

    const i = ocupados.findIndex((h) => !h);
    if (i < 0) {
      if (prot < objetivoProteina - 0.7) return; // mismo redondeo que cumpleSuelo
      const carrito = calcularCarrito(tandas, datos, N);
      const c = criterio(carrito.totalCarrito, carrito.totalPerecedero);
      if (objetivo === 'factible-barata') {
        if (carrito.totalCarrito <= presupuesto
          && (!res.mejor || carrito.totalCarrito < res.mejor.carrito)) {
          res.mejor = { tandas: [...tandas], carrito: carrito.totalCarrito, perecedero: carrito.totalPerecedero, prot };
        }
      } else if (carrito.totalCarrito <= presupuesto && c < cotaCriterio) {
        cotaCriterio = c;
        res.mejor = { tandas: [...tandas], carrito: carrito.totalCarrito, perecedero: carrito.totalPerecedero, prot };
      }
      return;
    }

    const restantes = ocupados.filter((h) => !h).length;
    const finde = esFinDeSemanaBueno(posiciones[i].dia, posiciones[i].ranura);
    const obligadoFresco = restantes <= 2 - frescos;

    const candidatos: { plan: NonNullable<ReturnType<typeof planificarTanda>>; receta: Receta; coste: number; prot: number }[] = [];
    for (const receta of recetas) {
      const u = usos.get(receta.id) ?? 0;
      if (u >= topeTandas) continue;
      if (!usos.has(receta.id) && usos.size >= topeRecetas) continue;
      const animal = proteinaAnimal(receta, datos);
      if (obligadoFresco && animal !== 'fresca') continue;
      if ([...basesDe(receta)].some((b) => (usosBase.get(b) ?? 0) >= 2)) continue;
      if (finde && animal === 'ninguna' && frescos < 2) continue;
      const plan = planificarTanda(receta, numHuecos, posiciones, ocupados, i, sobras < topeSobras);
      if (!plan) continue;
      const cubre = plan.huecos.length;
      const faltaTras = objetivoProteina - prot - proteinaDe(receta) * cubre;
      if (faltaTras > (restantes - cubre) * techoHueco + 1e-9) continue;
      const carritoPrueba = calcularCarrito([...tandas, plan.tanda], datos, N);
      if (carritoPrueba.totalCarrito > presupuesto + 1e-9) continue; // poda: monótono
      if (objetivo === 'optimo-criterio'
        && criterio(carritoPrueba.totalCarrito, carritoPrueba.totalPerecedero) >= cotaCriterio) continue;
      candidatos.push({ plan, receta, coste: carritoPrueba.totalCarrito, prot: proteinaDe(receta) * cubre });
    }

    candidatos.sort((a, b) => a.coste - b.coste || b.prot - a.prot || a.receta.id.localeCompare(b.receta.id));

    for (const c of candidatos) {
      const oc = [...ocupados];
      for (const h of c.plan.huecos) {
        oc[posiciones.findIndex((p) => p.dia === h.dia && p.ranura === h.ranura)] = h;
      }
      const nuevosUsos = new Map(usos);
      nuevosUsos.set(c.receta.id, (nuevosUsos.get(c.receta.id) ?? 0) + 1);
      const nuevasBases = new Map(usosBase);
      for (const b of basesDe(c.receta)) nuevasBases.set(b, (nuevasBases.get(b) ?? 0) + 1);
      const esFresca = proteinaAnimal(c.receta, datos) === 'fresca';
      dfs(
        oc, [...tandas, c.plan.tanda], nuevosUsos, nuevasBases,
        sobras + (c.plan.huecos.length > 1 ? 1 : 0),
        prot + c.prot, frescos + (esFresca ? c.plan.huecos.length : 0), c.coste,
      );
      if (res.nodos >= topeNodos) { res.agotado = false; return; }
    }
  };

  dfs(new Array(posiciones.length).fill(null), [], new Map(), new Map(), 0, 0, 0, 0);
  return res;
}

// --- B · ¿Existe mucha/normal ≤ 51 €? ---------------------------------------

console.log('\n\nB · ¿EXISTE "MUCHA VARIEDAD" ≤ 51 € CON ≥ 55 g? (backtracking, reglas estrictas)\n');
let t0 = Date.now();
const b = buscarExhaustivo(recetarioAdaptado(datos), 14, 'mucha', 'normal', 51, 400_000, 'factible-barata');
console.log(`  nodos ${b.nodos} · árbol ${b.agotado ? 'AGOTADO (respuesta exacta)' : 'cortado por tope'} · ${((Date.now() - t0) / 1000).toFixed(1)} s`);
if (b.mejor) {
  console.log(`  ENCONTRADA: ${b.mejor.carrito.toFixed(2)} € · ${(b.mejor.prot / 14).toFixed(0)} g/persona/día · perecedero ${b.mejor.perecedero.toFixed(2)} €`);
  console.log(`  recetas: ${b.mejor.tandas.map((t) => t.receta.nombre).join(' · ')}`);
  console.log('  → el greedy se la deja: el límite ERA del algoritmo, no del recetario.');
} else {
  console.log(`  ${b.agotado
    ? 'NINGUNA: probado imposible con este recetario y estas reglas → escasez real, no miopía del greedy.'
    : 'no encontrada dentro del tope de nodos (inconclusivo).'}`);
}

// --- C · Óptimo real en caso reducido ---------------------------------------

console.log('\n\nC · GAP CONTRA EL ÓPTIMO EN UN CASO REDUCIDO');
console.log('    (25 recetas = slice(0,25), 14 huecos, poca/normal, 40 €)\n');
const recetasC = datos.recetas.slice(0, 25);
const datosC = { ...datos, recetas: recetasC };
const greedyC = generarSemana({ datos: datosC, N, numHuecos: 14, variedad: 'poca', proteina: 'normal', presupuesto: 40 });
t0 = Date.now();
const c = buscarExhaustivo(recetarioAdaptado(datosC), 14, 'poca', 'normal', 40, 300_000, 'optimo-criterio');
const critC = criterioDe('normal');
console.log(`  nodos ${c.nodos} · árbol ${c.agotado ? 'AGOTADO (óptimo exacto del árbol)' : 'cortado por tope (cota inferior)'} · ${((Date.now() - t0) / 1000).toFixed(1)} s`);
console.log(`  greedy : ${greedyC.carrito.totalCarrito.toFixed(2)} € carrito · ${greedyC.carrito.totalPerecedero.toFixed(2)} € perec · criterio ${critC(greedyC.carrito.totalCarrito, greedyC.carrito.totalPerecedero).toFixed(2)} · ${greedyC.nutricion.proteinaPorPersonaDia.toFixed(0)} g · cuadra ${greedyC.cuadra ? 'sí' : 'NO'}`);
if (c.mejor) {
  console.log(`  óptimo : ${c.mejor.carrito.toFixed(2)} € carrito · ${c.mejor.perecedero.toFixed(2)} € perec · criterio ${critC(c.mejor.carrito, c.mejor.perecedero).toFixed(2)} · ${(c.mejor.prot / 14).toFixed(0)} g`);
  const gap = critC(greedyC.carrito.totalCarrito, greedyC.carrito.totalPerecedero) - critC(c.mejor.carrito, c.mejor.perecedero);
  console.log(`  GAP: ${gap.toFixed(2)} € de criterio (${((gap / critC(c.mejor.carrito, c.mejor.perecedero)) * 100).toFixed(1)}%)`);
} else {
  console.log('  sin solución factible en el árbol explorado');
}
