#!/usr/bin/env node --experimental-strip-types
/** La silueta de la semana: qué huecos se cocinan y cuáles no. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { generarSemana } from '../src/motor/seleccionar.ts';
import type { NivelProteina, Variedad } from '../src/motor/seleccionar.ts';
import type { DatosMotor } from '../src/motor/tipos.ts';

const aqui = path.dirname(fileURLToPath(import.meta.url));
const datos: DatosMotor = JSON.parse(
  fs.readFileSync(path.join(aqui, '..', 'src', 'data', 'motor-datos.json'), 'utf8'),
);
const VARIEDADES: Variedad[] = ['poca', 'normal', 'mucha'];
const NIVELES: NivelProteina[] = ['basica', 'normal', 'alta'];
const CASOS = [
  { N: 2, presupuesto: 51 }, { N: 1, presupuesto: 30 }, { N: 4, presupuesto: 90 }, { N: 2, presupuesto: 70 },
];

// PRIMERO: que TODAS las combinaciones den semana para TODOS los números de
// semana. Se mide aquí porque el fallo que lo hizo necesario —"mucha" salía
// vacía en las semanas 2 y 3 de cada siete— pasó desapercibido justo porque
// todo lo demás se medía con semanaNumero = 1.
console.log('BARRIDO DE NÚMEROS DE SEMANA (¿alguna combinación se queda sin semana?)\n');
let vacias = 0;
let comprobadas = 0;
for (const caso of CASOS) {
  for (const variedad of VARIEDADES) {
    for (const proteina of NIVELES) {
      for (let n = 1; n <= 14; n++) {
        const s = generarSemana({
          datos, N: caso.N, numHuecos: 14, variedad, proteina, presupuesto: caso.presupuesto, semanaNumero: n,
        });
        comprobadas++;
        if (!s.huecos.length) {
          vacias++;
          console.log(`  VACÍA: ${variedad}·${proteina} N${caso.N} ${caso.presupuesto}€ semana ${n}`);
        }
      }
    }
  }
}
console.log(`  ${comprobadas} combinaciones × números de semana · ${vacias} vacías\n`);

console.log('SILUETA · C = se cocina · s = sobras · a = ensamblaje · - = libre');
console.log('         LUN   MAR   MIÉ   JUE   VIE   SÁB   DOM');
const cuenta = new Map<string, number>();
let diasTodoSobras = 0;
let total = 0;
const cargaPorDia = new Array(7).fill(0);

for (const caso of CASOS) {
  for (const variedad of VARIEDADES) {
    for (const proteina of NIVELES) {
      const s = generarSemana({ datos, N: caso.N, numHuecos: 14, variedad, proteina, presupuesto: caso.presupuesto, semanaNumero: 1 });
      const marca = (t: string) => (t === 'cocinado' ? 'C' : t === 'sobras' ? 's' : t === 'ensamblaje' ? 'a' : '-');
      const silueta = s.huecos.map((h) => marca(h.tipo));
      const porDia: string[] = [];
      for (let d = 0; d < 7; d++) {
        const par = silueta.slice(d * 2, d * 2 + 2).join('');
        porDia.push(par);
        if (!par.includes('C')) diasTodoSobras++;
        cargaPorDia[d] += (par.match(/C/g) ?? []).length;
      }
      total += 7;
      const clave = porDia.join(' ');
      cuenta.set(clave, (cuenta.get(clave) ?? 0) + 1);
      console.log(`${variedad.slice(0, 2)}·${proteina.slice(0, 2)} N${caso.N}  ${porDia.join('    ')}`);
    }
  }
}

console.log(`\nSILUETAS DISTINTAS: ${cuenta.size} de ${total / 7} semanas`);
for (const [k, v] of [...cuenta].sort((a, b) => b[1] - a[1])) console.log(`  ${v}×  ${k}`);
console.log(`\nDÍAS 100% SOBRAS: ${diasTodoSobras} de ${total} (${((diasTodoSobras / total) * 100).toFixed(0)}%)`);
console.log('\nCARGA DE COCINA POR DÍA (huecos cocinados, suma de las 36 semanas)');
console.log('  LUN  MAR  MIÉ  JUE  VIE  SÁB  DOM');
console.log('  ' + cargaPorDia.map((c) => String(c).padStart(3)).join('  '));
