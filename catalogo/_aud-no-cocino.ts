#!/usr/bin/env node --experimental-strip-types
/**
 * «No cocino este día» encarece la compra: reproducción y traza.
 *
 * Caso visto el 13 oct 2026 al escribir src/state/siguienteSemana.test.ts:
 * 2 personas, 14 comidas, 65 €, semana que empieza en lunes, se libera el
 * hueco 4 y la compra pasa de 54,32 € a 69,44 €.
 *
 * Va directo al motor (lo mismo que hace `retocarParaApp`: primero
 * `repararHueco`, y si devuelve null, `rehacerDesde`) porque src/data/motor.ts
 * importa JSON y rutas sin extensión y no corre en node a pelo.
 *
 * Uso: node --experimental-strip-types catalogo/_aud-no-cocino.ts [hueco…]
 * No modifica nada.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { generarSemana, mejorVariedad, rehacerDesde, repararHueco } from '../src/motor/seleccionar.ts';
import type { PeticionSemana, SemanaGenerada } from '../src/motor/seleccionar.ts';
import type { DatosMotor } from '../src/motor/tipos.ts';

const aqui = path.dirname(fileURLToPath(import.meta.url));
const datos: DatosMotor = JSON.parse(fs.readFileSync(path.join(aqui, '..', 'src', 'data', 'motor-datos.json'), 'utf8'));
const e = (n: number) => n.toFixed(2);

const sinVariedad: Omit<PeticionSemana, 'variedad'> = {
  datos, N: 2, numHuecos: 14, presupuesto: 65, proteina: 'normal', esfuerzo: 'libre', exclusiones: [],
  postre: false, semanaNumero: 1, recetasRecientes: [], existencias: {},
  ordenDias: ['LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB', 'DOM'], platosBloqueados: [], platosFavoritos: [],
};
const variedad = (process.env.VARIEDAD as PeticionSemana['variedad']) ?? mejorVariedad(sinVariedad);
const peticion: PeticionSemana = { ...sinVariedad, variedad };
const semana = generarSemana(peticion);

const pinta = (titulo: string, s: SemanaGenerada) => {
  console.log(`\n${titulo} — caja ${e(s.carrito.totalCarrito)} € · cuadra ${s.cuadra} · ${s.tandas.length} tandas`);
  s.huecos.forEach((h, i) => console.log(
    `  ${String(i).padStart(2)} ${h.dia} ${h.ranura.padEnd(6)} ${h.tipo.padEnd(10)} ${h.receta?.id ?? '—'}`
    + (h.origen ? `  ← ${h.origen.dia} ${h.origen.ranura}` : ''),
  ));
};

console.log(`presupuesto ${peticion.presupuesto} € · variedad ${variedad}${process.env.VARIEDAD ? ' (forzada)' : ' (la elige la app)'}`);
pinta('ANTES', semana);

const huecos = process.argv.slice(2).map(Number);
for (const indice of huecos.length ? huecos : [4]) {
  const local = repararHueco(peticion, semana, indice, 'libre');
  const despues = local ?? rehacerDesde(peticion, semana, indice, 'libre');
  console.log(`\n══ liberar el hueco ${indice} · camino ${local ? 'repararHueco (local)' : 'rehacerDesde (global)'}`);
  pinta('DESPUÉS', despues);
  const cambiados = despues.huecos.filter((h, k) => h.receta?.id !== semana.huecos[k].receta?.id || h.tipo !== semana.huecos[k].tipo);
  console.log(`\n  huecos que cambian: ${cambiados.length} → ${cambiados.map((h) => `${h.dia} ${h.ranura} ${h.tipo}:${h.receta?.id ?? '—'}`).join(' | ')}`);
  const lineas = (s: SemanaGenerada) => new Map(s.carrito.lineas.filter((l) => !l.esDespensa).map((l) => [l.nombre, l]));
  const a = lineas(semana);
  const b = lineas(despues);
  console.log('  líneas de caja que cambian (antes → después):');
  for (const nombre of new Set([...a.keys(), ...b.keys()])) {
    const x = a.get(nombre); const y = b.get(nombre);
    if ((x?.carritoCoste ?? 0) === (y?.carritoCoste ?? 0)) continue;
    console.log(`    ${e(x?.carritoCoste ?? 0).padStart(6)} → ${e(y?.carritoCoste ?? 0).padStart(6)}  ${nombre}  (necesita ${x?.necesario ?? 0} → ${y?.necesario ?? 0})`);
  }
}
