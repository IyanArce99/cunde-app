#!/usr/bin/env node --experimental-strip-types
/**
 * ¿Cuántas recetas quedan vivas con cada filtro, y a partir de cuántas deja de
 * montarse la semana? Es el número que va a salir bajo la pregunta, así que
 * más vale saber dónde está el borde antes de enseñarlo.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { recetarioAdaptado, generarSemana } from '../src/motor/seleccionar.ts';
import { ALERGIAS, DIETAS } from '../src/lib/restricciones.ts';
import type { DatosMotor } from '../src/motor/tipos.ts';

const aqui = path.dirname(fileURLToPath(import.meta.url));
const datos: DatosMotor = JSON.parse(fs.readFileSync(path.join(aqui, '..', 'src', 'data', 'motor-datos.json'), 'utf8'));

const casos: { nombre: string; ex: string[] }[] = [{ nombre: 'sin filtros', ex: [] }];
for (const a of [...ALERGIAS, ...DIETAS]) casos.push({ nombre: a, ex: [a] });
// Las combinaciones que de verdad se dan juntas.
for (const par of [['Gluten', 'Lactosa'], ['Vegetariano', 'Gluten'], ['Vegano', 'Gluten'],
  ['Pescado', 'Marisco'], ['Vegano', 'Frutos secos'], ['Vegano', 'Soja'],
  ['Vegetariano', 'Huevo'], ['Vegano', 'Gluten', 'Frutos secos']]) {
  casos.push({ nombre: par.join(' + '), ex: par });
}

console.log('filtro                          vivas   ¿monta la semana? (2 pers, 65 €)');
const problemas: string[] = [];
for (const c of casos) {
  const vivas = recetarioAdaptado(datos, c.ex).length;
  const s = generarSemana({ datos, N: 2, numHuecos: 14, variedad: 'normal', presupuesto: 65, proteina: 'normal', exclusiones: c.ex, semanaNumero: 1 });
  const monta = s.huecos.length > 0 && !s.sinCobertura;
  const libres = s.huecos.filter((h) => h.tipo === 'libre').length;
  if (!monta || libres > 0) problemas.push(`${c.nombre}: ${vivas} vivas -> ${monta ? `${libres} huecos sin llenar` : 'NO MONTA'}`);
  console.log(
    `${c.nombre.padEnd(30)} ${String(vivas).padStart(4)}    ${monta ? (libres ? `deja ${libres} huecos vacíos` : 'sí') : 'NO'}`,
  );
}
console.log('\n=== DONDE SE ROMPE ===');
if (!problemas.length) console.log('  ninguna combinación de las probadas');
for (const p of problemas) console.log('  · ' + p);
