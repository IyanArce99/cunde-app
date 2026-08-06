#!/usr/bin/env node --experimental-strip-types
/**
 * Pasada de coherencia sobre el recetario ENTERO.
 *
 * Corre en el build (lo llama catalogo/generar.ts) y sale con código 1 si
 * algo no cuadra. No admite lista de exclusiones ni "solo los lotes nuevos":
 * ese fue exactamente el fallo que lo hizo necesario — la regla de la sal
 * cambió y se aplicó solo hacia delante, y la mitad del recetario se quedó
 * atrás durante semanas sin que ninguna métrica lo notara, porque la sal no
 * mueve dinero.
 *
 * Las reglas viven en catalogo/reglas.ts, compartidas con revisar-lote.ts.
 * Cambiar una regla allí rompe el build para toda receta que no la cumpla,
 * sea de hoy o del piloto.
 *
 * Uso:  node --experimental-strip-types catalogo/coherencia.ts
 *       node --experimental-strip-types catalogo/coherencia.ts --avisos
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { comprobarTodo, contextosDe } from './reglas.ts';
import type { Fallo } from './reglas.ts';
import type { DatosMotor } from '../src/motor/tipos.ts';

const aqui = path.dirname(fileURLToPath(import.meta.url));

/**
 * Se puede llamar con los datos ya en memoria (desde el build, antes de
 * escribir nada) o suelto contra el fichero generado.
 */
export function revisarCoherencia(datos: DatosMotor): Fallo[] {
  return comprobarTodo(datos, contextosDe(datos));
}

export function informar(fallos: Fallo[], conAvisos: boolean): void {
  const errores = fallos.filter((f) => f.nivel === 'error');
  const avisos = fallos.filter((f) => f.nivel === 'aviso');

  const porRegla = new Map<string, Fallo[]>();
  for (const f of errores) {
    if (!porRegla.has(f.regla)) porRegla.set(f.regla, []);
    porRegla.get(f.regla)!.push(f);
  }

  if (errores.length) {
    console.error(`\nINCOHERENCIAS: ${errores.length} en ${new Set(errores.map((f) => f.receta)).size} recetas\n`);
    for (const [regla, lista] of [...porRegla].sort((a, b) => b[1].length - a[1].length)) {
      console.error(`  ${regla.toUpperCase()} — ${lista.length}`);
      for (const f of lista) console.error(`    ✗ ${f.receta}: ${f.detalle}`);
      console.error('');
    }
  }

  if (avisos.length && conAvisos) {
    console.log(`AVISOS (no rompen el build): ${avisos.length}\n`);
    for (const f of avisos) console.log(`    ! ${f.receta}: ${f.detalle}`);
    console.log('');
  }
}

function main() {
  const datos: DatosMotor = JSON.parse(
    fs.readFileSync(path.join(aqui, '..', 'src', 'data', 'motor-datos.json'), 'utf8'),
  );
  const contextos = contextosDe(datos);
  const fallos = revisarCoherencia(datos);
  const errores = fallos.filter((f) => f.nivel === 'error');

  console.log(
    `COHERENCIA · ${datos.recetas.length} recetas · `
    + `${contextos.length - datos.recetas.length} ensamblajes · `
    + `${Object.keys(datos.ingredientes).length} ingredientes canónicos`,
  );
  informar(fallos, true);

  if (!errores.length) {
    console.log(`Todo cuadra. ${fallos.length ? `${fallos.length} avisos, ninguno bloqueante.` : ''}`);
  }
  process.exit(errores.length ? 1 : 0);
}

if (import.meta.url === `file:///${process.argv[1].replace(/\\/g, '/')}`) main();
