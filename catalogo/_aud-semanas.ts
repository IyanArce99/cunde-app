#!/usr/bin/env node --experimental-strip-types
/** Cinco semanas consecutivas del MISMO perfil. ¿Se parecen entre sí? */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { consumoDeEnsamblaje, consumoPorRacion, proteinaDeEnsamblaje, proteinaPorRacion } from '../src/motor/carrito.ts';
import { generarSemana } from '../src/motor/seleccionar.ts';
import type { DatosMotor } from '../src/motor/tipos.ts';

const aqui = path.dirname(fileURLToPath(import.meta.url));
const datos: DatosMotor = JSON.parse(
  fs.readFileSync(path.join(aqui, '..', 'src', 'data', 'motor-datos.json'), 'utf8'),
);
const N = 2;
const ETIQ: Record<string, string> = {
  cocinado: 'COCINAS ', sobras: 'SOBRAS  ', ensamblaje: 'APROVECH', libre: 'LIBRE   ',
};

const siluetas: string[] = [];
const platosPorSemana: Set<string>[] = [];

for (let semana = 1; semana <= 5; semana++) {
  const s = generarSemana({
    datos, N, numHuecos: 14, variedad: 'normal', proteina: 'normal', presupuesto: 51, semanaNumero: semana,
  });
  console.log('='.repeat(76));
  console.log(`SEMANA ${semana} · 2 personas · 51 € · variedad normal · proteína normal`);
  console.log('='.repeat(76));

  let dia = '';
  const nombres = new Set<string>();
  for (const h of s.huecos) {
    if (h.dia !== dia && dia) console.log('');
    dia = h.dia;
    if (!h.receta) { console.log(`  ${h.dia} ${h.ranura.padEnd(6)} LIBRE`); continue; }
    const nombre = h.ensamblaje ? h.ensamblaje.nombre : h.receta.nombre;
    nombres.add(nombre);
    let precio = 0;
    let prot = proteinaPorRacion(h.receta, datos, N);
    if (h.tipo === 'cocinado') precio = consumoPorRacion(h.receta, datos, N);
    else if (h.ensamblaje) {
      precio = consumoDeEnsamblaje(h.ensamblaje, datos, N);
      prot += proteinaDeEnsamblaje(h.ensamblaje, datos, N);
    } else if (h.tipo === 'ensamblaje') precio = consumoPorRacion(h.receta, datos, N, 'acompanamiento');
    const min = h.tipo === 'cocinado' ? h.receta.minutos : (h.ensamblaje?.minutos ?? 0);
    console.log(
      `  ${h.dia} ${h.ranura.padEnd(6)} ${ETIQ[h.tipo]}  ${nombre.padEnd(38)}`
      + `${precio.toFixed(2).padStart(5)} €  ${prot.toFixed(0).padStart(3)} g  ${String(min).padStart(2)} min`
      + (h.origen ? `   [de la ${h.origen.ranura} del ${h.origen.dia}]` : ''),
    );
  }
  const c = s.carrito;
  console.log(
    `\n  TOTAL ${c.totalCarrito.toFixed(2)} € ${s.cuadra ? '(cabe)' : '(NO CUADRA)'}`
    + ` · ${s.nutricion.proteinaPorPersonaDia.toFixed(0)} g/persona/día`
    + ` · se estropea ${c.totalPerecedero.toFixed(2)} € (${((c.totalPerecedero / c.totalCarrito) * 100).toFixed(1)}%)`
    + ` · ${s.recetasDistintas.length} recetas\n`,
  );

  siluetas.push(s.huecos.map((h) => (h.tipo === 'cocinado' ? 'C' : h.tipo === 'libre' ? '-' : 's')).join(''));
  platosPorSemana.push(nombres);
}

console.log('='.repeat(76));
console.log('¿SE PARECEN?\n');
console.log('  silueta (C cocinas · s aprovechas)');
siluetas.forEach((s, k) => console.log(`  semana ${k + 1}  ${s.match(/../g)!.join(' ')}`));
console.log(`\n  siluetas distintas: ${new Set(siluetas).size} de 5`);

console.log('\n  solape de platos entre semanas consecutivas');
for (let k = 1; k < platosPorSemana.length; k++) {
  const a = platosPorSemana[k - 1];
  const b = platosPorSemana[k];
  const comunes = [...b].filter((x) => a.has(x));
  console.log(`  ${k} → ${k + 1}: ${comunes.length} de ${b.size} platos repetidos`);
}
