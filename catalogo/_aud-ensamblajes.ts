#!/usr/bin/env node --experimental-strip-types
/** Qué ahorra un ensamblaje frente a cocinar de nuevo, y frente a repetir. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { consumoDeEnsamblaje, consumoPorRacion, proteinaDeEnsamblaje, proteinaPorRacion } from '../src/motor/carrito.ts';
import { generarSemana } from '../src/motor/seleccionar.ts';
import type { NivelProteina, Variedad } from '../src/motor/seleccionar.ts';
import type { DatosMotor } from '../src/motor/tipos.ts';

const aqui = path.dirname(fileURLToPath(import.meta.url));
const datos: DatosMotor = JSON.parse(
  fs.readFileSync(path.join(aqui, '..', 'src', 'data', 'motor-datos.json'), 'utf8'),
);
const N = 2;
const recetaDe = (id: string) => datos.recetas.find((r) => r.id === id)!;

// El coste medio de un hueco COCINADO en las semanas reales: es contra lo
// que hay que comparar, porque la alternativa a aprovechar es cocinar otra
// cosa, no repetir la de ayer.
let sumaCocinados = 0;
let numCocinados = 0;
let usados = new Map<string, number>();
let huecosEnsamblaje = 0;
let huecosSobras = 0;
let huecosTotales = 0;
for (const variedad of ['poca', 'normal', 'mucha'] as Variedad[]) {
  for (const proteina of ['basica', 'normal', 'alta'] as NivelProteina[]) {
    for (let semana = 1; semana <= 4; semana++) {
      const s = generarSemana({ datos, N, numHuecos: 14, variedad, proteina, presupuesto: 51, semanaNumero: semana });
      for (const h of s.huecos) {
        if (!h.receta) continue;
        huecosTotales++;
        if (h.tipo === 'cocinado') { sumaCocinados += consumoPorRacion(h.receta, datos, N); numCocinados++; }
        if (h.tipo === 'sobras') huecosSobras++;
        if (h.ensamblaje) {
          huecosEnsamblaje++;
          usados.set(h.ensamblaje.id, (usados.get(h.ensamblaje.id) ?? 0) + 1);
        }
      }
    }
  }
}
const medioCocinado = sumaCocinados / numCocinados;

console.log('LOS 12 ENSAMBLAJES · N=2\n');
console.log('                                          añade   cocinar    plato    ahorro   +prot   usos');
console.log('ensamblaje                                 €/rac   origen    nuevo    vs nuevo    g     (36 sem)');
console.log('-'.repeat(104));

let sumaAhorro = 0;
for (const [origen, lista] of Object.entries(datos.ensamblajes ?? {})) {
  for (const e of lista) {
    const r = recetaDe(origen);
    const anade = consumoDeEnsamblaje(e, datos, N);
    const deNuevo = consumoPorRacion(r, datos, N);
    const ahorro = medioCocinado - anade;
    sumaAhorro += ahorro * (usados.get(e.id) ?? 0);
    console.log(
      `${e.nombre.padEnd(40)} ${anade.toFixed(2).padStart(6)} ${deNuevo.toFixed(2).padStart(8)}`
      + ` ${medioCocinado.toFixed(2).padStart(8)} ${ahorro.toFixed(2).padStart(9)}`
      + ` ${proteinaDeEnsamblaje(e, datos, N).toFixed(0).padStart(7)} ${String(usados.get(e.id) ?? 0).padStart(7)}`,
    );
  }
}

console.log('-'.repeat(104));
console.log(`\nHueco cocinado medio: ${medioCocinado.toFixed(2)} €/ración`);
console.log(`Sobre 36 semanas (${huecosTotales} huecos): ${huecosEnsamblaje} de ensamblaje · ${huecosSobras} de recalentar`);
console.log(`Ahorro acumulado frente a cocinar un plato nuevo en esos huecos: ${sumaAhorro.toFixed(2)} € (${(sumaAhorro / 36).toFixed(2)} €/semana)`);
console.log(`Y frente a recalentar lo mismo: 0 € de ahorro, pero ${(huecosEnsamblaje / 36).toFixed(1)} platos distintos más por semana.`);
