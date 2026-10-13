#!/usr/bin/env node --experimental-strip-types
/**
 * ¿Cuánto tarda el motor en montar una semana?
 *
 * Sonda del 13 oct 2026, para la revisión de «¿está para publicar?». Mide en
 * ESTE ordenador; un Android de gama media va entre 3 y 6 veces más lento en
 * JavaScript de un solo hilo, así que el número de aquí hay que multiplicarlo.
 *
 * Uso: node --experimental-strip-types catalogo/_aud-latencia.ts
 * No modifica nada.
 */
import fs from 'node:fs';
import { generarSemana } from '../src/motor/seleccionar.ts';
import type { DatosMotor } from '../src/motor/tipos.ts';

const datos = JSON.parse(fs.readFileSync(new URL('../src/data/motor-datos.json', import.meta.url), 'utf8')) as DatosMotor;

const CASOS = [
  { que: 'arranque: 2 personas, 65 €, comidas y cenas', N: 2, presupuesto: 65, numHuecos: 14, variedad: 'normal', exclusiones: [] },
  { que: '1 persona, 40 €, solo comidas', N: 1, presupuesto: 40, numHuecos: 7, variedad: 'normal', exclusiones: [] },
  { que: '4 personas, 110 €, mucha variedad', N: 4, presupuesto: 110, numHuecos: 14, variedad: 'mucha', exclusiones: [] },
  { que: '2 personas, 65 €, vegano sin gluten', N: 2, presupuesto: 65, numHuecos: 14, variedad: 'normal', exclusiones: ['Vegano', 'Gluten'] },
];

for (const c of CASOS) {
  const tiempos: number[] = [];
  let total = 0;
  let platos = 0;
  for (const semanaNumero of [1, 2, 3]) {
    const t0 = performance.now();
    const s = generarSemana({ datos, proteina: 'normal', esfuerzo: 'libre', semanaNumero, ...c } as any);
    tiempos.push(performance.now() - t0);
    total = s.carrito.totalCarrito;
    platos = s.huecos.filter((h: any) => h.receta).length;
  }
  const media = tiempos.reduce((a, b) => a + b, 0) / tiempos.length;
  console.log(`${(media / 1000).toFixed(2)} s de media (máx ${(Math.max(...tiempos) / 1000).toFixed(2)})  ${c.que}  → ${platos} platos, ${total.toFixed(2)} €`);
}
