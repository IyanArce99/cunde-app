#!/usr/bin/env node --experimental-strip-types
/**
 * ¿Puede el motor cuadrar por calorías además de por dinero?
 *
 * No hay kcal en el catálogo: Mercadona no las publica y Open Food Facts solo
 * cubre 9 de nuestros 93 EAN. Así que aquí se prueba con una tabla de
 * composición por INGREDIENTE CANÓNICO —que es el nivel al que trabajan las
 * tablas de verdad (BEDCA, CIQUAL)— y se mide qué pasa.
 *
 * Los valores son kcal por 100 g de alimento tal como entra en la receta:
 * el arroz y la legumbre seca en seco, la cocida en cocida, la carne en crudo.
 * Es una primera pasada para decidir si merece la pena, NO datos definitivos:
 * antes de servirlos hay que verificarlos uno a uno contra BEDCA.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { consumoDeEnsamblaje, consumoPorRacion, escalar } from '../src/motor/carrito.ts';
import { generarSemana } from '../src/motor/seleccionar.ts';
import type { DatosMotor, IngredienteReceta, Hueco } from '../src/motor/tipos.ts';

const aqui = path.dirname(fileURLToPath(import.meta.url));
const datos: DatosMotor = JSON.parse(
  fs.readFileSync(path.join(aqui, '..', 'src', 'data', 'motor-datos.json'), 'utf8'),
);

/**
 * El aceite va en kcal/100 ml, no /100 g. El motor cuenta el ml como gramo
 * —da igual con caldos, que no aportan nada— pero el aceite pesa 0,92 y es lo
 * más calórico del recetario: con 884 se inflaría un 8% justo donde más duele.
 */
const KCAL: Record<string, number> = {
  aceite_oliva: 810, aceituna_verde: 145, acelga: 19, agua: 0, ajo: 149,
  alcachofa: 47, almendra: 579, alubia_blanca_cocida: 100, alubia_blanca_seca: 333,
  alubia_pinta_cocida: 105, alubia_roja_cocida: 108, apio: 16, arroz_integral: 362,
  arroz_largo: 360, arroz_redondo: 358, atun_lata: 128, bacalao_congelado: 82,
  bacon: 390, bebida_arroz: 47, bebida_soja: 40, berenjena: 25, brocoli: 34,
  caballa_lata: 190, cacahuete: 567, calabacin: 17, calabaza: 26,
  calamar_congelado: 92, caldo_pollo: 6, caldo_verduras: 4, carne_picada_cerdo: 245,
  carne_picada_mixta: 250, carne_picada_vacuno: 215, cebolla: 40, champinon: 22,
  chorizo: 455, chuleta_cordero: 280, coliflor: 25, colorante_alimentario: 300,
  comino: 375, contramuslo_pollo: 175, costilla_cerdo: 290, curcuma: 354,
  curry: 325, dorada: 96, entrecot_vacuno: 250, espagueti: 358, esparrago_verde: 20,
  espinaca: 23, fideo: 358, filete_vacuno: 190, gamba_congelada: 85,
  garbanzo_cocido: 140, garbanzo_seco: 364, guisante: 81, harina_maiz: 361,
  huevo: 143, hummus: 237, jamoncito_pollo: 175, judia_verde: 31, laurel: 313,
  leche_semi: 46, lechuga: 15, lenteja_cocida: 116, lenteja_pardina: 352,
  limon: 29, lomo_cerdo: 150, lomo_merluza: 75, lubina: 97, macarron: 358,
  maiz_dulce: 86, mejillon_congelado: 86, mejillon_lata: 150, mostaza: 66,
  muslo_pollo: 185, nata_cocinar: 195, oregano: 265, pan: 265, panceta: 400,
  patata: 77, pechuga_pollo: 110, pepino: 15, perejil: 36, pimenton_dulce: 282,
  pimienta_negra: 251, pimiento_rojo: 31, pimiento_verde: 20, pollo_troceado: 190,
  puerro: 61, queso_fresco: 130, queso_rallado: 380, quinoa: 368, repollo: 25,
  romero: 331, sal: 0, salchicha_fresca: 290, sardina_fresca: 208, seta: 22,
  soja_texturizada: 340, solomillo_cerdo: 143, taco_vacuno: 180, tofu: 145,
  tomate: 18, tomate_frito: 82, tomate_triturado: 30, tomillo: 276,
  vinagre: 20, vinagre_manzana: 22, yogur_natural: 61, zanahoria: 41,
};

const faltan = Object.keys(datos.ingredientes).filter((id) => KCAL[id] === undefined);
if (faltan.length) { console.error('sin kcal:', faltan.join(', ')); process.exit(1); }

/** Calcado de proteinaDeIngredientes: mismo camino, otra columna. */
function kcalDeIngredientes(ingredientes: IngredienteReceta[], N: number): number {
  let total = 0;
  for (const ing of ingredientes) {
    const meta = datos.ingredientes[ing.canonico];
    const cantidad = escalar(ing.cantidad, ing.escalado, N);
    const gramos = ing.unidad === 'ud' ? cantidad * (meta.gramos_por_unidad ?? 0) : cantidad;
    const comestible = gramos * (meta.rendimiento_comestible ?? 1);
    total += (comestible * KCAL[ing.canonico]) / 100;
  }
  return total / N;
}

const N = 2;
const recetas = Object.values(datos.recetas);
const filas = recetas.map((r) => ({
  id: r.id, nombre: r.nombre,
  kcal: kcalDeIngredientes(r.ingredientes, N),
  eur: consumoPorRacion(r, datos, N),
})).sort((a, b) => a.kcal - b.kcal);

const pct = (a: number[], p: number) => a[Math.min(a.length - 1, Math.floor(a.length * p))];
const ks = filas.map((f) => f.kcal);
const es = filas.map((f) => f.eur);

console.log('=== 1. QUÉ DA EL RECETARIO, POR RACIÓN ===');
console.log(`recetas: ${filas.length}`);
for (const p of [0, 0.1, 0.25, 0.5, 0.75, 0.9]) {
  console.log(`  p${String(Math.round(p * 100)).padStart(2)}  ${pct(ks, p).toFixed(0).padStart(4)} kcal   ${pct(es, p).toFixed(2).padStart(5)} €`);
}
console.log(`  max  ${ks[ks.length - 1].toFixed(0).padStart(4)} kcal`);
console.log('\n  más flojas:');
for (const f of filas.slice(0, 5)) console.log(`    ${f.kcal.toFixed(0).padStart(4)} kcal · ${f.eur.toFixed(2)} € · ${f.nombre}`);
console.log('  más densas:');
for (const f of filas.slice(-5).reverse()) console.log(`    ${f.kcal.toFixed(0).padStart(4)} kcal · ${f.eur.toFixed(2)} € · ${f.nombre}`);

// ¿Las calorías baratas existen? Correlación kcal <-> € y kcal por euro.
const media = (a: number[]) => a.reduce((s, x) => s + x, 0) / a.length;
const mk = media(ks), me = media(es);
const cov = filas.reduce((s, f) => s + (f.kcal - mk) * (f.eur - me), 0);
const sk = Math.sqrt(filas.reduce((s, f) => s + (f.kcal - mk) ** 2, 0));
const se = Math.sqrt(filas.reduce((s, f) => s + (f.eur - me) ** 2, 0));
console.log(`\n  correlación kcal ↔ € por ración: r = ${(cov / (sk * se)).toFixed(2)}`);
const porEuro = [...filas].sort((a, b) => b.kcal / b.eur - a.kcal / a.eur);
console.log('  más kcal por euro:');
for (const f of porEuro.slice(0, 4)) console.log(`    ${(f.kcal / f.eur).toFixed(0).padStart(4)} kcal/€ · ${f.nombre}`);
console.log('  menos kcal por euro:');
for (const f of porEuro.slice(-4).reverse()) console.log(`    ${(f.kcal / f.eur).toFixed(0).padStart(4)} kcal/€ · ${f.nombre}`);

// --- 2. Qué kcal trae la semana que el motor genera HOY, sin pedírselas.
function kcalDeHueco(h: Hueco): number {
  if (!h.receta) return 0;
  if (h.tipo === 'ensamblaje' && h.ensamblaje) {
    return kcalDeIngredientes(h.receta.ingredientes, N) + kcalDeIngredientes(h.ensamblaje.ingredientes, N);
  }
  return kcalDeIngredientes(h.receta.ingredientes, N);
}

console.log('\n=== 2. LA SEMANA QUE SALE HOY (2 personas, 14 huecos) ===');
console.log('presu   total    kcal/día   por hueco   platos');
for (const presupuesto of [45, 55, 65, 80, 100]) {
  const s = generarSemana({ datos, N, numHuecos: 14, variedad: 'normal', presupuesto, semanaNumero: 1 });
  if (!s.huecos.length) { console.log(`${presupuesto} € · sin cobertura`); continue; }
  const kcal = s.huecos.reduce((t, h) => t + kcalDeHueco(h), 0);
  const porHueco = s.huecos.filter((h) => h.receta).map(kcalDeHueco).sort((a, b) => a - b);
  console.log(
    `${String(presupuesto).padStart(4)} € ${s.carrito.totalCarrito.toFixed(2).padStart(7)} € ` +
    `${(kcal / 7).toFixed(0).padStart(8)}   ${porHueco[0].toFixed(0)}-${porHueco[porHueco.length - 1].toFixed(0)}`.padEnd(14) +
    `   ${s.recetasDistintas.length}`,
  );
}

// --- 3. ¿Se llega a un objetivo? Cuánto cuesta cada nivel de kcal.
console.log('\n=== 3. ¿CUÁNTO CUESTA LLEGAR? ===');
console.log('El usuario pide 2.000 kcal/día. La app solo pone comida y cena:');
console.log('con el reparto español (desayuno 20% · comida 40% · merienda 10% · cena 30%)');
console.log('a la app le tocan el 70% -> 1.400 kcal/día en 2 huecos = 700 por hueco.\n');
const objetivo = 1400;
console.log('presu   kcal/día   ¿llega a 1.400?');
for (const presupuesto of [45, 55, 65, 80, 100, 130]) {
  const s = generarSemana({ datos, N, numHuecos: 14, variedad: 'normal', presupuesto, semanaNumero: 1 });
  if (!s.huecos.length) continue;
  const k = s.huecos.reduce((t, h) => t + kcalDeHueco(h), 0) / 7;
  console.log(`${String(presupuesto).padStart(4)} € ${k.toFixed(0).padStart(9)}   ${k >= objetivo ? 'sí' : `no, faltan ${(objetivo - k).toFixed(0)}`}`);
}

// Cuántas recetas hay por encima de 700 kcal: el techo real del recetario.
const densas = filas.filter((f) => f.kcal >= 700).length;
const medias = filas.filter((f) => f.kcal >= 500 && f.kcal < 700).length;
console.log(`\nrecetas ≥ 700 kcal/ración: ${densas} de ${filas.length}`);
console.log(`recetas 500-699 kcal:      ${medias} de ${filas.length}`);
console.log(`recetas < 500 kcal:        ${filas.length - densas - medias} de ${filas.length}`);

// --- 4. Si las calorías no las compra el dinero, ¿qué las compra?
console.log('\n=== 4. LO QUE CUESTA CERRAR EL HUECO ===');
const FECULAS = ['arroz_largo', 'arroz_redondo', 'arroz_integral', 'espagueti', 'macarron',
  'fideo', 'patata', 'pan', 'garbanzo_seco', 'lenteja_pardina', 'alubia_blanca_seca', 'quinoa'];
console.log('kcal por euro de las féculas, en crudo:');
for (const id of FECULAS) {
  const meta = datos.ingredientes[id];
  const sku = Object.values(datos.skus).find((s) => (datos.mapeo?.[id] ?? []).includes(s.sku))
    ?? Object.values(datos.skus).find((s) => s.nombre.toLowerCase().includes(meta.nombre.toLowerCase().split(' ')[0]));
  const eurKg = sku?.precio_kg_l_ud ?? null;
  if (!eurKg) { console.log(`  ${id.padEnd(22)} sin precio directo`); continue; }
  console.log(`  ${id.padEnd(22)} ${KCAL[id].toString().padStart(3)} kcal/100g · ${eurKg.toFixed(2)} €/kg · ${Math.round(KCAL[id] * 10 / eurKg)} kcal/€`);
}

const s65 = generarSemana({ datos, N, numHuecos: 14, variedad: 'normal', presupuesto: 65, semanaNumero: 1 });
const hoy = s65.huecos.reduce((t, h) => t + kcalDeHueco(h), 0) / 7;
const faltanKcal = (1400 - hoy) * 7 * N;
const arroz = Object.values(datos.skus).find((s) => s.nombre.toLowerCase().includes('arroz'));
if (arroz) {
  const gramos = faltanKcal / (KCAL.arroz_largo / 100);
  console.log(`\nla semana de 65 € va a ${hoy.toFixed(0)} kcal/día. Para 1.400 faltan`);
  console.log(`${faltanKcal.toFixed(0)} kcal en la semana entera para ${N} personas.`);
  console.log(`En arroz: ${(gramos / 1000).toFixed(2)} kg a ${arroz.precio_kg_l_ud.toFixed(2)} €/kg = ${(gramos / 1000 * arroz.precio_kg_l_ud).toFixed(2)} €`);
  console.log(`Total de la semana: ${s65.carrito.totalCarrito.toFixed(2)} € -> ${(s65.carrito.totalCarrito + gramos / 1000 * arroz.precio_kg_l_ud).toFixed(2)} €`);
}

// ¿Cuánta receta lleva acompañamiento, que es la palanca natural?
let conAcomp = 0;
for (const r of recetas) if (r.ingredientes.some((i) => i.parte === 'acompanamiento')) conAcomp++;
console.log(`\nrecetas con parte de acompañamiento: ${conAcomp} de ${recetas.length}`);
