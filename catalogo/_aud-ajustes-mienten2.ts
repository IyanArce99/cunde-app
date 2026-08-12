#!/usr/bin/env node --experimental-strip-types
/**
 * AUDITORÍA — LA HOJA DE AJUSTES CONTRA LA SEMANA REAL, CON DESPENSA
 *
 * El primer intento (`_aud-ajustes-mienten.ts`) comparaba con la despensa
 * vacía y salía clavado. No probaba nada: la despensa vacía es justo el caso en
 * que las dos rutas hacen lo mismo.
 *
 * El usuario ve el fallo cuando YA lleva semanas usando la app, o sea cuando
 * tiene despensa. Y eso es lo que la hoja no sabe: `lib/derive.ts:peticion()`
 * no pasa existencias, así que estima la compra como si no hubiera nada en
 * casa — más cara que la semana que la app acaba de montar.
 *
 * No modifica nada.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { generarSemana, costesPorVariedad } from '../src/motor/seleccionar.ts';
import type { DatosMotor } from '../src/motor/tipos.ts';

const aqui = path.dirname(fileURLToPath(import.meta.url));
const datos: DatosMotor = JSON.parse(
  fs.readFileSync(path.join(aqui, '..', 'src', 'data', 'motor-datos.json'), 'utf8'),
);

const BASE = {
  datos,
  N: 2,
  numHuecos: 14,
  esfuerzo: 'libre' as const,
  exclusiones: [] as string[],
  presupuesto: 65,
  proteina: 'normal' as const,
  postre: false,
  variedad: 'normal' as const,
};

/* Una despensa como la de alguien que lleva un par de semanas: aceite, arroz,
   pasta y unas legumbres a medias. Son de los ingredientes que más se repiten. */
const DESPENSA = {
  aceite_oliva: { cantidad: 500, semanas: 0 },
  arroz_largo: { cantidad: 400, semanas: 0 },
  macarron: { cantidad: 300, semanas: 0 },
  garbanzo_cocido: { cantidad: 400, semanas: 0 },
  cebolla: { cantidad: 600, semanas: 0 },
  tomate_frito: { cantidad: 200, semanas: 0 },
};

/* Y un historial de dos semanas, que es lo que penaliza repetir platos. */
const HISTORIAL = [
  ['jamoncitos_ajillo_champinones', 'sardinas_horno', 'lentejas_curry_espinacas'],
  ['merluza_salsa_verde', 'macarrones_pollo', 'garbanzos_espinacas'],
];

console.log('2 personas · 65 € · 14 comidas · normal\n');

const casos = [
  { nombre: 'recién instalada', semana: 1, despensa: {}, historial: [] as string[][] },
  { nombre: 'con despensa', semana: 1, despensa: DESPENSA, historial: [] as string[][] },
  { nombre: 'con historial', semana: 3, despensa: {}, historial: HISTORIAL },
  { nombre: 'con las dos cosas', semana: 3, despensa: DESPENSA, historial: HISTORIAL },
];

console.log('situación             hoja de ajustes   semana real    diferencia');
let peor = 0;
for (const c of casos) {
  /* La hoja: siempre lo mismo, porque no recibe ninguna de las dos cosas. */
  const hoja = costesPorVariedad(BASE).normal;
  /* La app: con todo lo que regenerar() sí pasa. */
  const real = generarSemana({
    ...BASE,
    semanaNumero: c.semana,
    historial: c.historial,
    existencias: c.despensa,
  } as never);

  const a = hoja.carrito;
  const b = real.sinCobertura ? NaN : real.carrito.totalCarrito;
  const dif = b - a;
  peor = Math.max(peor, Math.abs(dif));
  console.log(
    `  ${c.nombre.padEnd(20)} ${a.toFixed(2).padStart(7)} €`
    + `      ${b.toFixed(2).padStart(7)} €`
    + `    ${dif >= 0 ? '+' : ''}${dif.toFixed(2)} €`,
  );
}

console.log(`\nLa hoja enseña SIEMPRE la misma cifra: no sabe qué hay en casa`);
console.log(`ni qué se comió la semana pasada. Desfase máximo medido: ${peor.toFixed(2)} €.`);
console.log('\nEso es lo que produce el «sube X €» al abrir Ajustes sin tocar nada.');
