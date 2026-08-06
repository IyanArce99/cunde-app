#!/usr/bin/env node --experimental-strip-types
/**
 * POR QUÉ NO HAY ESCALERA.
 *
 * Hipótesis a comprobar, no a suponer:
 *
 *  A) En VARIEDAD hay dos fuerzas opuestas del mismo tamaño:
 *       · menos recetas distintas = menos ingredientes distintos = menos
 *         envases mínimos pagados enteros -> abarata.
 *       · menos recetas distintas = conjunto factible más pequeño -> el óptimo
 *         solo puede ser igual o PEOR -> encarece.
 *     Si es esto, "poca" comprará menos SKUs y aun así podrá costar más.
 *
 *  B) En PROTEÍNA no hay bug: cada nivel optimiza OTRA COSA
 *     (OBJETIVO_POR_NIVEL: básica minimiza perecedero, alta minimiza carrito).
 *     Si es esto, "básica" nunca estará dominada en (proteína, perecedero,
 *     carrito) a la vez — solo en (proteína, carrito), que son dos de tres.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { costesPorProteina, costesPorVariedad, generarSemana } from '../src/motor/seleccionar.ts';
import type { DatosMotor, Variedad, NivelProteina } from '../src/motor/tipos.ts';

const aqui = path.dirname(fileURLToPath(import.meta.url));
const datos: DatosMotor = JSON.parse(fs.readFileSync(path.join(aqui, '..', 'src', 'data', 'motor-datos.json'), 'utf8'));
const eur = (n: number) => (Number.isFinite(n) ? n.toFixed(2) : '—');

const CASOS: { N: number; presupuesto: number }[] = [];
for (const N of [1, 2, 4]) for (const presupuesto of [45, 55, 65, 80, 100]) CASOS.push({ N, presupuesto });

console.log('=== A · VARIEDAD: ¿menos recetas compra menos SKUs y aun así cuesta más? ===');
console.log('                   recetas   SKUs   carrito   ¿ordenado?');
let invierte = 0, menosSkusMasCaro = 0;
for (const { N, presupuesto } of CASOS) {
  const fila: string[] = [];
  const carritos: number[] = [];
  const skus: number[] = [];
  for (const v of ['poca', 'normal', 'mucha'] as Variedad[]) {
    const s = generarSemana({ datos, N, numHuecos: 14, variedad: v, presupuesto, proteina: 'normal', semanaNumero: 1 });
    const nSkus = s.carrito?.lineas?.length ?? 0;
    carritos.push(s.carrito?.totalCarrito ?? NaN);
    skus.push(nSkus);
    fila.push(`${String(s.recetasDistintas.length).padStart(2)}/${String(nSkus).padStart(2)}/${eur(s.carrito?.totalCarrito ?? NaN).padStart(6)}`);
  }
  const ordenado = carritos[0] <= carritos[1] && carritos[1] <= carritos[2];
  if (!ordenado) invierte++;
  // La prueba de la hipótesis A: poca compra MENOS skus y sin embargo cuesta MÁS.
  const contradice = skus[0] < skus[2] && carritos[0] > carritos[2];
  if (contradice) menosSkusMasCaro++;
  console.log(`N=${N} ${String(presupuesto).padStart(3)} €  ${fila.join('  ')}  ${ordenado ? 'sí' : 'NO'}${contradice ? '  ← menos SKUs y más caro' : ''}`);
}
console.log(`\n  desordenados: ${invierte}/${CASOS.length}`);
console.log(`  "poca" compra menos SKUs y aun así cuesta más: ${menosSkusMasCaro}/${CASOS.length}`);

console.log('\n=== B · PROTEÍNA: ¿está "básica" dominada de verdad, o solo en dos ejes? ===');
console.log('cada nivel: proteína g · perecedero € · carrito €');
let dom2 = 0, dom3 = 0;
for (const { N, presupuesto } of CASOS) {
  const p = costesPorProteina({ datos, N, numHuecos: 14, variedad: 'normal', proteina: 'normal', exclusiones: [], presupuesto, semanaNumero: 1 });
  const ns: NivelProteina[] = ['basica', 'normal', 'alta'];
  const c = ns.map((k) => p[k]);
  // Dominado en 2 ejes: más proteína y más barato.
  // Dominado en 3: además tira igual o menos. Eso sí sería un nivel muerto.
  const marcas: string[] = [];
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) {
    if (i === j) continue;
    const mejor2 = c[j].proteina >= c[i].proteina && c[j].carrito <= c[i].carrito
      && (c[j].proteina > c[i].proteina || c[j].carrito < c[i].carrito);
    if (!mejor2) continue;
    const mejor3 = c[j].perecedero <= c[i].perecedero;
    marcas.push(`${ns[i]}←${ns[j]}${mejor3 ? ' [3 EJES]' : ''}`);
    if (mejor3) dom3++; else dom2++;
  }
  console.log(
    `N=${N} ${String(presupuesto).padStart(3)} €  ` +
    c.map((x) => `${x.proteina.toFixed(0)}g/${eur(x.perecedero)}/${eur(x.carrito)}`).join('  ') +
    (marcas.length ? '   ' + [...new Set(marcas)].join(', ') : '   —'),
  );
}
console.log(`\n  dominados solo en (proteína, precio): ${dom2}`);
console.log(`  dominados TAMBIÉN en desperdicio —niveles muertos—: ${dom3}`);

console.log('\n=== C · ¿Y si los tres niveles usaran el MISMO criterio? ===');
console.log('Se pide variedad con proteína fija en "alta" (criterio = carrito) en los tres.');
let ordenadoIgual = 0;
for (const { N, presupuesto } of CASOS) {
  const v = costesPorVariedad({ datos, N, numHuecos: 14, exclusiones: [], presupuesto, proteina: 'alta', semanaNumero: 1 });
  const c = (['poca', 'normal', 'mucha'] as Variedad[]).map((k) => v[k].carrito);
  const ok = c[0] <= c[1] && c[1] <= c[2];
  if (ok) ordenadoIgual++;
  console.log(`N=${N} ${String(presupuesto).padStart(3)} €  ${c.map((x) => eur(x).padStart(6)).join('  ')}  ${ok ? 'sí' : 'NO'}`);
}
console.log(`\n  ordenados con criterio único: ${ordenadoIgual}/${CASOS.length}`);
