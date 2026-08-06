#!/usr/bin/env node --experimental-strip-types
/**
 * El orden por precio tiene que ser cierto POR CONSTRUCCIÓN: la pantalla
 * ordena, así que no puede desordenarse. Esto lo comprueba replicando
 * exactamente el criterio de SelectorVariedad, y de paso enseña las cifras que
 * verá el usuario.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { costesPorVariedad } from '../src/motor/seleccionar.ts';
import type { DatosMotor, Variedad } from '../src/motor/tipos.ts';

const aqui = path.dirname(fileURLToPath(import.meta.url));
const datos: DatosMotor = JSON.parse(fs.readFileSync(path.join(aqui, '..', 'src', 'data', 'motor-datos.json'), 'utf8'));
const ORDEN: Variedad[] = ['poca', 'normal', 'mucha'];
const eur = (n: number) => (Number.isFinite(n) ? n.toFixed(2) : '—').padStart(6);

let ordenadas = 0, total = 0;
console.log('caso            opción 1            opción 2            opción 3');
for (const N of [1, 2, 4]) {
  for (const presupuesto of [45, 55, 65, 80, 100]) {
    const c = costesPorVariedad({ datos, N, numHuecos: 14, exclusiones: [], presupuesto, proteina: 'normal', semanaNumero: 1 });
    // El MISMO criterio que el componente.
    const filas = ORDEN.map((v) => ({ v, c: c[v] })).sort((a, b) => {
      if (a.c.disponible !== b.c.disponible) return a.c.disponible ? -1 : 1;
      if (!Number.isFinite(a.c.carrito)) return 1;
      if (!Number.isFinite(b.c.carrito)) return -1;
      return a.c.carrito - b.c.carrito;
    });
    const precios = filas.filter((f) => f.c.disponible).map((f) => f.c.carrito);
    const ok = precios.every((p, i) => i === 0 || precios[i - 1] <= p);
    total++; if (ok) ordenadas++;
    console.log(
      `N=${N} ${String(presupuesto).padStart(3)} €  `
      + filas.map((f) => `${eur(f.c.carrito)} ${String(f.c.platos).padStart(2)}pl ${String(f.c.repeticiones).padStart(2)}rep`).join('  ')
      + `  ${ok ? 'ok' : 'DESORDENADA'}`,
    );
  }
}
console.log(`\nordenadas por precio: ${ordenadas}/${total}`);
