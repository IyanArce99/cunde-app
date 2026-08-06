#!/usr/bin/env node --experimental-strip-types
/**
 * ¿La semana generada es EXACTAMENTE la misma tras cambiar el redondeo?
 * No basta con que pasen los tests: el producto es determinista y un céntimo
 * distinto cambia qué plato entra.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as M from '../src/motor/seleccionar.ts';
import type { DatosMotor } from '../src/motor/tipos.ts';
const aqui = path.dirname(fileURLToPath(import.meta.url));
const datos: DatosMotor = JSON.parse(fs.readFileSync(path.join(aqui, '..', 'src', 'data', 'motor-datos.json'), 'utf8'));

const huella = (s: any) => JSON.stringify({
  platos: s.tandas.map((t: any) => t.receta.id),
  huecos: s.huecos.map((h: any) => [h.tipo, h.receta?.id ?? null]),
  carrito: s.carrito.totalCarrito, consumo: s.carrito.totalConsumo,
  perecedero: s.carrito.totalPerecedero,
  lineas: s.carrito.lineas.map((l: any) => [l.sku, l.unidades, l.precio]),
});

const casos: any[] = [];
for (const N of [1, 2, 4]) for (const variedad of ['poca','normal','mucha'])
  for (const proteina of ['basica','normal','alta']) for (const presupuesto of [40, 65, 110])
    for (const ex of [[], ['Gluten'], ['Vegano']])
      casos.push({ datos, N, numHuecos: 14, esfuerzo: 'libre', exclusiones: ex, presupuesto, variedad, proteina, semanaNumero: 1 });

const salida = path.join(aqui, '_huellas.json');
const huellas = casos.map((c) => huella(M.generarSemana(c)));
if (process.argv[2] === 'guardar') {
  fs.writeFileSync(salida, JSON.stringify(huellas));
  console.log(`guardadas ${huellas.length} huellas`);
} else {
  const antes = JSON.parse(fs.readFileSync(salida, 'utf8'));
  let distintas = 0;
  for (let i = 0; i < huellas.length; i++) if (antes[i] !== huellas[i]) distintas++;
  console.log(`${huellas.length} semanas comparadas · ${distintas} distintas`);
  console.log(distintas === 0 ? '  IDÉNTICAS: el cambio de redondeo no mueve ni un plato ni un céntimo.' : '  ¡OJO! el redondeo cambia resultados.');
}
