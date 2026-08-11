/**
 * ═══ ¿AGUANTA EL RECETARIO CADA FILTRO? ═══
 *
 * Antes de añadir productos hay que saber DÓNDE está el agujero. Añadir a ojo
 * es cómo se acaba con quince recetas de pescado y ninguna sin lactosa.
 *
 * Por cada filtro —y por cada pareja, que es lo que la gente tiene de verdad
 * puesto— mide tres cosas distintas que se suelen confundir:
 *
 *   1. RECETARIO   cuántas recetas sobreviven al filtro.
 *   2. PROTEÍNA    de cuántas fuentes distintas, que es lo que decide si la
 *                  semana puede tener variedad o son catorce platos de lo mismo.
 *   3. SEMANA      si el motor cuadra de verdad una semana con ese filtro, a
 *                  varios presupuestos. Es lo único que el usuario nota.
 *
 * Las tres hacen falta: un filtro puede dejar 30 recetas y no cuadrar ninguna
 * semana porque todas usan el mismo ingrediente caro.
 *
 *   node --experimental-strip-types catalogo/_aud-cobertura.ts
 */
import datosJson from '../src/data/motor-datos.json' with { type: 'json' };
import { generarSemana, recetarioAdaptado, FILTROS } from '../src/motor/seleccionar.ts';
import type { DatosMotor } from '../src/motor/tipos.ts';

const datos = datosJson as unknown as DatosMotor;
const NOMBRES = Object.keys(FILTROS);
const TOTAL = datos.recetas.length;

/** De qué vive cada receta, en proteína. Para ver si queda variedad o no. */
function fuentesDeProteina(exclusiones: string[]): Map<string, number> {
  const cuenta = new Map<string, number>();
  for (const r of recetarioAdaptado(datos, exclusiones)) {
    for (const ing of r.ingredientes) {
      const meta = datos.ingredientes[ing.canonico];
      if (!meta || meta.es_despensa) continue;
      const g = (meta as { proteina_g_por_100?: number }).proteina_g_por_100 ?? 0;
      if (g < 8) continue; // no es una fuente de proteína, es un acompañamiento
      cuenta.set(ing.canonico, (cuenta.get(ing.canonico) ?? 0) + 1);
    }
  }
  return cuenta;
}

interface Fila {
  filtro: string;
  recetas: number;
  fuentes: number;
  cuadra: number;
  intentos: number;
  peorCaso: string;
}

function evaluar(exclusiones: string[], etiqueta: string): Fila {
  const recetas = recetarioAdaptado(datos, exclusiones).length;
  const fuentes = fuentesDeProteina(exclusiones).size;
  let cuadra = 0;
  let intentos = 0;
  let peorCaso = '';
  for (const N of [1, 2, 4]) {
    for (const numHuecos of [7, 14]) {
      for (const presupuesto of [45, 65, 90]) {
        intentos++;
        const s = generarSemana({
          datos, N, numHuecos, presupuesto, variedad: 'normal', proteina: 'normal',
          esfuerzo: 'libre', exclusiones, semanaNumero: 1,
        });
        if (s.cuadra) cuadra++;
        else if (!peorCaso) {
          peorCaso = `N=${N} h=${numHuecos} ${presupuesto}€: ${s.sinCobertura ? 'SIN COBERTURA' : 'no cuadra'}`;
        }
      }
    }
  }
  return { filtro: etiqueta, recetas, fuentes, cuadra, intentos, peorCaso };
}

const t0 = Date.now();
const filas: Fila[] = [evaluar([], 'ninguno')];
for (const f of NOMBRES) filas.push(evaluar([f], f));

/* Y las parejas que la gente tiene de verdad: un vegetariano que además no
   toma lactosa, un celíaco que tampoco come huevo. */
const PAREJAS: [string, string][] = [
  ['Vegetariano', 'Lactosa'], ['Vegetariano', 'Gluten'], ['Vegano', 'Gluten'],
  ['Pescado', 'Marisco'], ['Gluten', 'Lactosa'], ['Huevo', 'Lactosa'],
  ['Pescado', 'Cerdo'], ['Vegetariano', 'Frutos secos'], ['Pescado', 'Huevo'],
];
for (const [a, b] of PAREJAS) filas.push(evaluar([a, b], `${a} + ${b}`));

const linea = (f: Fila) => {
  const pct = f.cuadra / f.intentos;
  const sello = pct === 1 ? '   ' : pct >= 0.8 ? ' · ' : ' ! ';
  return `${sello}${f.filtro.padEnd(26)} ${String(f.recetas).padStart(3)}/${TOTAL} recetas   `
    + `${String(f.fuentes).padStart(2)} fuentes   cuadra ${f.cuadra}/${f.intentos}`
    + (f.peorCaso ? `   ${f.peorCaso}` : '');
};

console.log(`\nRecetario: ${TOTAL} recetas.\n`);
console.log('═══ UN FILTRO ═══');
for (const f of filas.slice(0, 1 + NOMBRES.length).sort((a, b) => a.recetas - b.recetas)) {
  console.log(linea(f));
}
console.log('\n═══ DOS FILTROS ═══');
for (const f of filas.slice(1 + NOMBRES.length).sort((a, b) => a.recetas - b.recetas)) {
  console.log(linea(f));
}

/* Y qué fuentes de proteína quedan en los casos más apretados: es la lista de
   la compra de lo que falta. */
console.log('\n═══ DE QUÉ VIVE CADA CASO APRETADO ═══');
for (const ex of [['Pescado'], ['Vegetariano'], ['Vegano'], ['Pescado', 'Cerdo'], ['Vegano', 'Gluten']]) {
  const fuentes = [...fuentesDeProteina(ex)].sort((a, b) => b[1] - a[1]);
  console.log(`\n  ${ex.join(' + ')}  (${fuentes.length} fuentes)`);
  console.log('    ' + fuentes.map(([id, n]) => `${datos.ingredientes[id]?.nombre ?? id} ×${n}`).join(', '));
}
console.log(`\n${((Date.now() - t0) / 1000).toFixed(0)} s`);
