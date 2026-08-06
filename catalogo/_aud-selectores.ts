#!/usr/bin/env node --experimental-strip-types
/**
 * Los dos selectores prometen una escalera. ¿La hay?
 *   variedad: "más variedad cuesta más"
 *   proteína: "más proteína, más desperdicio"
 * Si el nivel de arriba es más barato Y da más, el de abajo no lo elige nadie.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { costesPorProteina, costesPorVariedad } from '../src/motor/seleccionar.ts';
import type { DatosMotor } from '../src/motor/tipos.ts';

const aqui = path.dirname(fileURLToPath(import.meta.url));
const datos: DatosMotor = JSON.parse(fs.readFileSync(path.join(aqui, '..', 'src', 'data', 'motor-datos.json'), 'utf8'));

const eur = (n: number) => (Number.isFinite(n) ? n.toFixed(2).padStart(6) : '     —');

for (const N of [1, 2, 4]) {
  for (const presupuesto of [45, 55, 65, 80, 100]) {
    const base = { datos, N, numHuecos: 14, exclusiones: [] as string[], presupuesto, semanaNumero: 1 };
    const v = costesPorVariedad({ ...base, proteina: 'normal' });
    const p = costesPorProteina({ ...base, variedad: 'normal', proteina: 'normal' });
    const orden = (['poca', 'normal', 'mucha'] as const).map((k) => v[k].carrito);
    const subeVariedad = orden[0] <= orden[1] && orden[1] <= orden[2];
    const prot = (['basica', 'normal', 'alta'] as const).map((k) => p[k]);
    // Dominado: un nivel al que otro le gana en las DOS columnas que se enseñan.
    const dominado: string[] = [];
    const nombres = ['basica', 'normal', 'alta'];
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        if (i === j) continue;
        if (prot[j].proteina >= prot[i].proteina && prot[j].carrito <= prot[i].carrito
          && (prot[j].proteina > prot[i].proteina || prot[j].carrito < prot[i].carrito)) {
          dominado.push(`${nombres[i]} ← ${nombres[j]}`);
        }
      }
    }
    console.log(
      `N=${N} ${String(presupuesto).padStart(3)} €  variedad ${orden.map(eur).join(' ')}  ${subeVariedad ? 'sube' : 'NO SUBE'}`
      + `   proteína ${prot.map((c) => `${c.proteina.toFixed(0)}g/${eur(c.carrito)}`).join(' ')}`
      + `   ${dominado.length ? 'DOMINADO: ' + [...new Set(dominado)].join(', ') : ''}`,
    );
  }
}
