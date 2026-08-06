#!/usr/bin/env node --experimental-strip-types
/** Ocho semanas seguidas del mismo perfil, con las dos memorias puestas. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { generarSemana, SEMANAS_DE_MEMORIA } from '../src/motor/seleccionar.ts';
import { existenciasTrasLaSemana } from '../src/motor/carrito.ts';
import type { Existencias } from '../src/motor/carrito.ts';
import type { DatosMotor } from '../src/motor/tipos.ts';

const aqui = path.dirname(fileURLToPath(import.meta.url));
const datos: DatosMotor = JSON.parse(fs.readFileSync(path.join(aqui, '..', 'src', 'data', 'motor-datos.json'), 'utf8'));
const eur = (n: number) => (Number.isFinite(n) ? n.toFixed(2) : '—');
const N = 2, PRESU = 65, SEMANAS = 8;

interface Fila {
  n: number; carrito: number; perecedero: number; proteina: number;
  distintas: number; solape: number; ahorro: number; enDespensa: number; huecos: string[];
}

function correr(conMemoriaRecetas: boolean, conDespensa: boolean) {
  let existencias: Existencias = {};
  const historial: string[][] = [];
  const filas: Fila[] = [];
  let previas: Set<string> = new Set();

  for (let n = 1; n <= SEMANAS; n++) {
    const s = generarSemana({
      datos, N, numHuecos: 14, variedad: 'normal', presupuesto: PRESU, proteina: 'normal',
      semanaNumero: n,
      recetasRecientes: conMemoriaRecetas ? historial.slice(0, SEMANAS_DE_MEMORIA) : [],
      existencias: conDespensa ? existencias : undefined,
    });
    if (!s.huecos.length) { console.log(`  semana ${n}: SIN COBERTURA`); break; }

    const ids = new Set(s.tandas.map((t) => t.receta.id));
    const solape = [...ids].filter((x) => previas.has(x)).length;
    // Lo que la despensa evita pagar esta semana.
    const ahorro = s.carrito.totalDelArmario ?? 0;
    filas.push({
      n, carrito: s.carrito.totalCarrito, perecedero: s.carrito.totalPerecedero,
      proteina: s.nutricion.proteinaPorPersonaDia, distintas: ids.size, solape, ahorro,
      enDespensa: Object.keys(existencias).length,
      huecos: s.huecos.map((h) => (h.receta ? `${h.dia.slice(0, 3)} ${h.ranura[0].toUpperCase()} ${h.tipo === 'sobras' ? '↻ ' : h.tipo === 'ensamblaje' ? '⊕ ' : '  '}${h.ensamblaje?.nombre ?? h.receta.nombre}` : `${h.dia.slice(0, 3)} libre`)),
    });
    previas = ids;
    historial.unshift([...ids]);
    if (conDespensa) existencias = existenciasTrasLaSemana(s.carrito, existencias);
  }
  return filas;
}

const linea = (f: Fila) =>
  `  ${f.n}  ${eur(f.carrito).padStart(6)} €  ${eur(f.perecedero).padStart(5)} €  ${f.proteina.toFixed(0).padStart(2)} g  `
  + `${String(f.distintas).padStart(2)} platos  solape ${f.solape}  ahorro ${eur(f.ahorro).padStart(5)} €  despensa ${String(f.enDespensa).padStart(2)}`;

console.log('=== SIN NINGUNA MEMORIA (función pura) ===');
console.log('  n  carrito  perec  prot  platos  solape  ahorro  despensa');
const sin = correr(false, false);
for (const f of sin) console.log(linea(f));

console.log('\n=== SOLO MEMORIA DE RECETAS ===');
const soloRec = correr(true, false);
for (const f of soloRec) console.log(linea(f));

console.log('\n=== LAS DOS MEMORIAS (lo que hay hoy en la app) ===');
const ambas = correr(true, true);
for (const f of ambas) console.log(linea(f));

const media = (a: number[]) => a.reduce((s, x) => s + x, 0) / a.length;
const solapes = (fs_: Fila[]) => fs_.slice(1).map((f) => f.solape);
console.log('\n=== 1 · SOLAPE ENTRE SEMANAS CONSECUTIVAS ===');
console.log(`  sin memoria:      ${solapes(sin).join(', ')}   media ${media(solapes(sin)).toFixed(1)}`);
console.log(`  solo recetas:     ${solapes(soloRec).join(', ')}   media ${media(solapes(soloRec)).toFixed(1)}`);
console.log(`  las dos:          ${solapes(ambas).join(', ')}   media ${media(solapes(ambas)).toFixed(1)}`);

console.log('\n=== 2 · CARRITO Y AHORRO ACUMULADO (las dos memorias) ===');
let acum = 0;
for (const f of ambas) { acum += f.ahorro; console.log(`  semana ${f.n}: carrito ${eur(f.carrito)} €  ahorro ${eur(f.ahorro)} €  acumulado ${eur(acum)} €`); }
console.log(`  carrito medio sin despensa: ${eur(media(soloRec.map((f) => f.carrito)))} €`);
console.log(`  carrito medio con despensa: ${eur(media(ambas.map((f) => f.carrito)))} €`);

console.log('\n=== 4 · LO QUE CUESTA LA PENALIZACIÓN DE RECETAS ===');
console.log(`  carrito medio sin memoria de recetas: ${eur(media(sin.map((f) => f.carrito)))} €`);
console.log(`  carrito medio con memoria de recetas: ${eur(media(soloRec.map((f) => f.carrito)))} €`);
console.log(`  diferencia: ${eur(media(soloRec.map((f) => f.carrito)) - media(sin.map((f) => f.carrito)))} € por semana`);
console.log(`  proteína media: ${media(sin.map((f) => f.proteina)).toFixed(1)} g → ${media(soloRec.map((f) => f.proteina)).toFixed(1)} g`);

console.log('\n=== 3 · LAS OCHO SEMANAS ENTERAS (con las dos memorias) ===');
for (const f of ambas) {
  console.log(`\n── SEMANA ${f.n} · ${eur(f.carrito)} € · ${f.proteina.toFixed(0)} g/día · tira ${eur(f.perecedero)} € · ahorra ${eur(f.ahorro)} €`);
  for (const h of f.huecos) console.log('   ' + h);
}

console.log('\n=== 5 · ¿QUÉ FILTRO SE ROMPE ANTES CON LA MEMORIA PUESTA? ===');
const FILTROS: { nombre: string; exclusiones: string[]; esfuerzo?: 'minimo' | 'normal' | 'libre' }[] = [
  { nombre: 'sin filtros', exclusiones: [] },
  { nombre: 'vegetariano', exclusiones: ['Vegetariano'] },
  { nombre: 'vegano', exclusiones: ['Vegano'] },
  { nombre: 'vegetariano + lo mínimo', exclusiones: ['Vegetariano'], esfuerzo: 'minimo' },
  { nombre: 'vegano + lo mínimo', exclusiones: ['Vegano'], esfuerzo: 'minimo' },
  { nombre: 'sin gluten + sin lactosa', exclusiones: ['Gluten', 'Lactosa'] },
  { nombre: 'sin pescado + sin cerdo', exclusiones: ['Pescado', 'Cerdo'] },
];
for (const f of FILTROS) {
  let existencias: Existencias = {};
  const historial: string[][] = [];
  const carritos: number[] = [];
  let rota = 0;
  for (let n = 1; n <= SEMANAS; n++) {
    const s = generarSemana({
      datos, N, numHuecos: 14, variedad: 'normal', presupuesto: PRESU, proteina: 'normal',
      semanaNumero: n, exclusiones: f.exclusiones, esfuerzo: f.esfuerzo,
      recetasRecientes: historial.slice(0, SEMANAS_DE_MEMORIA), existencias,
    });
    if (!s.huecos.length || !s.cuadra) { if (!rota) rota = n; }
    if (!s.huecos.length) break;
    carritos.push(s.carrito.totalCarrito);
    historial.unshift([...new Set(s.tandas.map((t) => t.receta.id))]);
    existencias = existenciasTrasLaSemana(s.carrito, existencias);
  }
  console.log(
    `  ${f.nombre.padEnd(26)} ${carritos.length}/8 semanas · `
    + `${carritos.length ? eur(carritos.reduce((a, b) => a + b, 0) / carritos.length) + ' € medio' : '—'}`
    + `${rota ? `  ← deja de cuadrar en la ${rota}` : '  todas cuadran'}`,
  );
}
