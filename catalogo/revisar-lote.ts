#!/usr/bin/env node --experimental-strip-types
/**
 * Valida y pone precio a un lote de recetas nuevas.
 *
 * Las reglas NO viven aquí: viven en catalogo/reglas.ts, compartidas con
 * catalogo/coherencia.ts, que las aplica al recetario entero en el build.
 * Ese reparto es deliberado. Cuando las reglas estaban duplicadas aquí, se
 * cambió la de la sal y solo se aplicó a los lotes que se escribieron
 * después: 36 de 72 recetas se quedaron con la regla vieja durante semanas.
 *
 * Uso:  node --experimental-strip-types catalogo/revisar-lote.ts docs/recetas/lote-X.json
 *
 * Sale con código 1 si algo del esquema o de las reglas está mal. El precio
 * no hace fallar: lo reporta para que quien escribe decida si la descarta.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { consumoPorRacion, proteinaPorRacion } from '../src/motor/carrito.ts';
import { rindeEfectivo, tieneAcompanamiento } from '../src/motor/reparto.ts';
import { recetaPermitida } from '../src/motor/seleccionar.ts';
import { comprobarTodo, reglaEscaladoConsistente } from './reglas.ts';
import type { Contexto } from './reglas.ts';
import type { DatosMotor, Receta } from '../src/motor/tipos.ts';

const aqui = path.dirname(fileURLToPath(import.meta.url));
const datos: DatosMotor = JSON.parse(
  fs.readFileSync(path.join(aqui, '..', 'src', 'data', 'motor-datos.json'), 'utf8'),
);

const N = 2;
const FILTROS = ['Vegetariano', 'Vegano', 'Gluten', 'Lactosa', 'Frutos secos', 'Cerdo', 'Pescado', 'Marisco'];

function main() {
  const ruta = process.argv[2];
  if (!ruta) {
    console.error('Uso: node --experimental-strip-types catalogo/revisar-lote.ts <fichero.json>');
    process.exit(1);
  }

  const doc = JSON.parse(fs.readFileSync(path.resolve(ruta), 'utf8'));
  const recetas: Receta[] = doc.recetas ?? doc;

  // El lote se comprueba contra las MISMAS reglas que el recetario entero, y
  // la consistencia de escalado se mira contra el recetario ya publicado: si
  // el lote nuevo marca el vinagre distinto de como está en las 72, es un
  // fallo del lote, no del recetario.
  const contextosLote: Contexto[] = recetas.map((r) => ({
    datos, nombre: r.nombre, ingredientes: r.ingredientes, esEnsamblaje: false, receta: r,
  }));
  const contextosPublicados: Contexto[] = datos.recetas.map((r) => ({
    datos, nombre: r.nombre, ingredientes: r.ingredientes, esEnsamblaje: false, receta: r,
  }));

  const fallos = comprobarTodo(datos, contextosLote)
    // reglaEscaladoConsistente ya corre dentro de comprobarTodo sobre el lote
    // solo; aquí se repite contra lote + publicadas para cazar la divergencia.
    .filter((f) => f.regla !== 'escalado consistente')
    .concat(reglaEscaladoConsistente([...contextosPublicados, ...contextosLote]))
    // Las reglas de vocabulario (rendimiento, conservación) hablan del
    // catálogo entero, no del lote: al revisar un lote solo distraen.
    .filter((f) => !['rendimiento', 'conservacion'].includes(f.regla));

  const errores = fallos.filter((f) => f.nivel === 'error');
  const avisos = fallos.filter((f) => f.nivel === 'aviso');

  console.log(`\n${path.basename(ruta)} — ${recetas.length} recetas\n`);

  if (errores.length) {
    console.log('ERRORES (hay que corregirlos, no se puede entregar así):');
    for (const f of errores) console.log(`  ✗ [${f.regla}] ${f.receta}: ${f.detalle}`);
    console.log('');
  }
  if (avisos.length) {
    console.log('AVISOS:');
    for (const f of avisos) console.log(`  ! [${f.regla}] ${f.receta}: ${f.detalle}`);
    console.log('');
  }

  if (!errores.length) {
    console.log('  receta                         €/ración  g prot  min  rinde  acomp  filtros que sobrevive');
    console.log(`  ${'-'.repeat(112)}`);
    for (const r of recetas) {
      const precio = consumoPorRacion(r, datos, N);
      const prot = proteinaPorRacion(r, datos, N);
      const rinde = rindeEfectivo(r, 'principal', 14);
      const acomp = tieneAcompanamiento(r) ? `${rindeEfectivo(r, 'acompanamiento', 14)}` : '—';
      const pasa = FILTROS.filter((f) => recetaPermitida(r, [f], Infinity, datos.ingredientes));
      const marca = precio >= 1 && precio <= 1.6 ? '·' : '↑';
      console.log(
        `  ${marca} ${r.nombre.padEnd(28)} ${precio.toFixed(2).padStart(7)}  ${prot.toFixed(0).padStart(5)}`
        + `  ${String(r.minutos).padStart(3)}  ${String(rinde).padStart(5)}  ${acomp.padStart(5)}  ${pasa.join(' ') || '(ninguno)'}`,
      );
    }
    const bajo1 = recetas.filter((r) => consumoPorRacion(r, datos, N) < 1).length;
    const bajo120 = recetas.filter((r) => consumoPorRacion(r, datos, N) < 1.2).length;
    const rinde2 = recetas.filter((r) => rindeEfectivo(r, 'principal', 14) >= 2).length;
    const rapidas = recetas.filter((r) => r.minutos <= 20).length;
    console.log(
      `\n  Resumen: ${bajo1} por debajo de 1,00 € · ${bajo120} por debajo de 1,20 € · `
      + `${rinde2} con rinde 2 · ${rapidas} de ≤20 min`,
    );
    console.log('  (el €/ración NO incluye despensa: aceite, sal y especias van fuera del total, como en la app)\n');
  }

  process.exit(errores.length ? 1 : 0);
}

main();
