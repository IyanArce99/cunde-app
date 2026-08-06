#!/usr/bin/env node --experimental-strip-types
/** El retoque local, medido igual que _aud-local midió el global. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { generarSemana, rehacerDesde, repararHueco } from '../src/motor/seleccionar.ts';
import type { PeticionSemana, Variedad } from '../src/motor/seleccionar.ts';
import type { DatosMotor } from '../src/motor/tipos.ts';

const aqui = path.dirname(fileURLToPath(import.meta.url));
const datos: DatosMotor = JSON.parse(
  fs.readFileSync(path.join(aqui, '..', 'src', 'data', 'motor-datos.json'), 'utf8'),
);

const difieren = (a: ReturnType<typeof generarSemana>, b: ReturnType<typeof generarSemana>) =>
  a.huecos.filter((h, k) => h.receta?.id !== b.huecos[k]?.receta?.id || h.tipo !== b.huecos[k]?.tipo).length;

for (const variedad of ['poca', 'normal', 'mucha'] as Variedad[]) {
  const peticion: PeticionSemana = { datos, N: 2, numHuecos: 14, variedad, proteina: 'normal', presupuesto: 51 };
  const base = generarSemana(peticion);
  const stats = { cambiar: [] as number[], libre: [] as number[] };
  let noOps = 0;
  let globales = 0;
  let rompePresupuesto = 0;
  let t0 = Date.now();

  for (let i = 0; i < 14; i++) {
    for (const retoque of ['cambiar', 'libre'] as const) {
      const local = repararHueco(peticion, base, i, retoque);
      const res = local ?? rehacerDesde(peticion, base, i, retoque);
      if (!local) globales++;
      const n = difieren(base, res);
      stats[retoque].push(n);
      if (retoque === 'cambiar' && res.huecos[i]?.receta?.id === base.huecos[i]?.receta?.id) noOps++;
      if (base.cuadra && !res.cuadra) rompePresupuesto++;
    }
  }

  const resumen = (xs: number[]) => {
    const s = [...xs].sort((a, b) => a - b);
    return `mediana ${s[Math.floor(s.length / 2)]} · máx ${s[s.length - 1]} · >3: ${xs.filter((x) => x > 3).length}/14`;
  };
  console.log(`${variedad.padEnd(7)} base ${base.carrito.totalCarrito.toFixed(2)}€ ${base.cuadra ? 'cuadra' : 'NO'}`
    + ` · cambiar: ${resumen(stats.cambiar)} · libre: ${resumen(stats.libre)}`
    + ` · no-ops ${noOps} · caídas a global ${globales} · rompe cuadre ${rompePresupuesto}`
    + ` · ${((Date.now() - t0) / 28).toFixed(0)} ms/retoque`);
}
