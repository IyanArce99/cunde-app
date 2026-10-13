#!/usr/bin/env node --experimental-strip-types
/**
 * ¿Por qué la semana 2 con despensa cuesta MÁS que con la cocina vacía?
 *
 * Caso medido el 13 oct 2026: 2 personas, 14 comidas, 65 €, variedad normal,
 * proteína normal. Semana 2 con lo que sobró de la 1 → 63,16 €; la misma
 * semana con la cocina vacía → 55,10 €. Esto lo reproduce y separa las causas.
 * No modifica nada.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { existenciasTrasLaSemana } from '../src/motor/carrito.ts';
import { construir, generarSemana } from '../src/motor/seleccionar.ts';
import type { PeticionSemana } from '../src/motor/seleccionar.ts';
import type { DatosMotor } from '../src/motor/tipos.ts';

const aqui = path.dirname(fileURLToPath(import.meta.url));
const datos: DatosMotor = JSON.parse(fs.readFileSync(path.join(aqui, '..', 'src', 'data', 'motor-datos.json'), 'utf8'));
const e = (n: number) => `${n.toFixed(2)} €`;

/* `conHolgura`: la anomalía la producía la pasada de holgura, apagada en
   producción desde el 13 oct 2026. Se enciende aquí para que la sonda siga
   reproduciendo lo que midió. */
const base: PeticionSemana = { datos, N: 2, numHuecos: 14, variedad: 'normal', proteina: 'normal', esfuerzo: 'libre', exclusiones: [], presupuesto: 65, conHolgura: true };
const s1 = generarSemana({ ...base, semanaNumero: 1 });
const armario = existenciasTrasLaSemana(s1.carrito);
const memoria = [[...new Set(s1.tandas.map((t) => t.receta.id))]];
const valorArmario = Object.entries(armario).reduce((a, [sku, x]) => {
  const l = s1.carrito.lineas.find((l) => l.sku === sku)!;
  return a + x.cantidad * (l.carritoCoste / l.comprado);
}, 0);
console.log(`Semana 1: ${e(s1.carrito.totalCarrito)}. Queda en casa: ${Object.keys(armario).length} productos, valor ${e(valorArmario)}`);

const con = generarSemana({ ...base, semanaNumero: 2, existencias: armario, recetasRecientes: memoria });
const sin = generarSemana({ ...base, semanaNumero: 2, recetasRecientes: memoria });

function ficha(nombre: string, s: ReturnType<typeof generarSemana>) {
  const c = s.carrito;
  console.log(`\n=== ${nombre}`);
  console.log(`  carrito ${e(c.totalCarrito)} · del armario ${e(c.totalDelArmario)} · gasto efectivo ${e(c.totalCarrito + c.totalDelArmario)}`);
  console.log(`  consumo ${e(c.totalConsumo)} (comida nueva ${e(c.totalConsumo - c.totalDelArmario)}) · perecedero ${e(c.totalPerecedero)} · inventario ${e(c.totalInventario)}`);
  console.log(`  cuadra=${s.cuadra} · ${s.recetasDistintas.length} platos · ${s.tandas.length} tandas · proteína ${s.nutricion.proteinaPorPersonaDia} g · frescos ${s.nutricion.huecosConFresca}`);
  console.log('  ' + s.huecos.map((h) => `${h.dia.slice(0, 2)}${h.ranura[0]} ${h.tipo === 'cocinado' ? 'C' : 's'}:${h.receta?.id}`).join(' | '));
}
ficha('SEMANA 2 CON DESPENSA', con);
ficha('SEMANA 2 COCINA VACÍA', sin);

// Platos: comunes y distintos
const idsCon = new Set(con.tandas.map((t) => t.receta.id));
const idsSin = new Set(sin.tandas.map((t) => t.receta.id));
console.log('\nplatos solo CON despensa:', [...idsCon].filter((x) => !idsSin.has(x)).join(', '));
console.log('platos solo SIN despensa:', [...idsSin].filter((x) => !idsCon.has(x)).join(', '));
console.log('comunes:', [...idsCon].filter((x) => idsSin.has(x)).join(', '));

// Líneas: qué se compra en cada una
console.log('\nLÍNEAS CON DESPENSA (compras>0 ordenadas por coste):');
for (const l of [...con.carrito.lineas].filter((l) => !l.esDespensa && l.compras > 0).sort((a, b) => b.carritoCoste - a.carritoCoste)) {
  const casa = armario[l.sku]?.cantidad ?? 0;
  console.log(`  ${e(l.carritoCoste).padStart(8)} ${String(l.compras).padStart(2)}x ${l.nombre.slice(0, 44).padEnd(44)} nec ${l.necesario} ${l.unidad}${casa ? ` · en casa ${casa}` : ''}`);
}
console.log('LÍNEAS QUE SALEN DEL ARMARIO (compras=0):');
for (const l of con.carrito.lineas.filter((l) => !l.esDespensa && l.compras === 0)) console.log(`  ${l.nombre.slice(0, 44).padEnd(44)} nec ${l.necesario} ${l.unidad} · en casa ${armario[l.sku]?.cantidad}`);
console.log('\nLÍNEAS SIN DESPENSA:');
for (const l of [...sin.carrito.lineas].filter((l) => !l.esDespensa).sort((a, b) => b.carritoCoste - a.carritoCoste)) {
  console.log(`  ${e(l.carritoCoste).padStart(8)} ${String(l.compras).padStart(2)}x ${l.nombre.slice(0, 44).padEnd(44)} nec ${l.necesario} ${l.unidad}`);
}

// ¿Lo hace la pasada de holgura o el greedy base?
console.log('\n¿QUIÉN LO DECIDE?');
for (const [nombre, p] of [['con despensa', { ...base, semanaNumero: 2, existencias: armario, recetasRecientes: memoria }], ['cocina vacía', { ...base, semanaNumero: 2, recetasRecientes: memoria }]] as const) {
  const sinHolgura = generarSemana({ ...p, sinHolgura: true });
  const greedy = construir(p)!;
  console.log(`  ${nombre}: final ${e(generarSemana(p).carrito.totalCarrito)} · sin pasada de holgura ${e(sinHolgura.carrito.totalCarrito)} · greedy sin semillas ${e(greedy.carrito.totalCarrito)} (armario ${e(greedy.carrito.totalDelArmario)})`);
}

// ¿Y si el tope descontara lo que ya hay en casa?
console.log('\n¿Y SI EL PRESUPUESTO DESCONTARA EL ARMARIO?');
for (const tope of [65, 60, 55, 54, 52, 50]) {
  const s = generarSemana({ ...base, semanaNumero: 2, presupuesto: tope, existencias: armario, recetasRecientes: memoria });
  console.log(`  tope ${tope}: carrito ${e(s.carrito.totalCarrito)} · armario ${e(s.carrito.totalDelArmario)} · consumo ${e(s.carrito.totalConsumo)} · perec ${e(s.carrito.totalPerecedero)} · cuadra=${s.cuadra} · ${s.recetasDistintas.length} platos · prot ${s.nutricion.proteinaPorPersonaDia}`);
}
