/**
 * ═══ ¿Y SI LA PROTEÍNA NO DIRIGIERA LA BÚSQUEDA? ═══
 *
 * Medido en _aud-monotonia.ts: el 69% de las veces subir de nivel sale más
 * barato, y unificar el objetivo no lo arregla. La causa es que el suelo de
 * proteína entra en la puntuación hueco a hueco, así que cada nivel recorre un
 * valle distinto y sus tres cifras no son comparables aunque se pinten en fila.
 *
 * La idea que se prueba aquí: que la proteína deje de dirigir la búsqueda y
 * pase a FILTRAR un fondo común.
 *
 *   1. Se construye UN fondo de semanas candidatas, barriendo la presión de
 *      proteína a lo largo de las semillas. Hoy esas mismas candidatas se
 *      generan y se tiran: `construirMejor` se queda con una y descarta el
 *      resto — que es justo lo que los otros niveles necesitan.
 *   2. Cada nivel elige del MISMO fondo: descarta las que no llegan a su suelo
 *      ni caben en el tope, y ordena por su propio criterio.
 *   3. Cascada de mayor a menor suelo. Como los conjuntos están anidados —una
 *      semana de 60 g cumple también 55 y 40—, la elegida por un nivel alto
 *      SIEMPRE es válida para los de abajo. Con eso, ninguno puede quedar por
 *      encima del de arriba: la escalera es monótona por construcción, no por
 *      suerte del optimizador.
 *
 * ═══ RESULTADO · 7 AGO 2026 ═══
 *
 *   hoy     98/162  (60,5%)   peor 36,81 €
 *   fondo    0/162  ( 0,0%)   peor  0,00 €
 *
 * Y no lo consigue colapsando los tres niveles en la misma semana, que sería
 * hacer trampa: eso pasa en 2 de 162 casos (1,2%). El selector sigue diciendo
 * tres cosas distintas; lo que ya no hace es contradecirse.
 *
 * ═══ LO QUE ESTE PROTOTIPO NO PRUEBA ═══
 *
 * Come 3,81 € menos por semana que el motor actual, y eso NO es culpa de la
 * idea: este fondo usa 8 semillas fijas y le faltan las dos cosas que hacen
 * bueno al buscador de verdad — el escalado de semillas (8 → 24 → todas)
 * cuando no encuentra una semana que cuadre, y la pasada de aprovechar la
 * holgura, que es la que convierte el presupuesto sobrante en más comida en vez
 * de en un número más bajo. Sin ella el motor se planta en cuanto cabe.
 *
 * O sea: está probado que la ESTRUCTURA arregla la incoherencia. Falta montarla
 * sobre el buscador entero, no sobre este esqueleto.
 *
 * ═══ Y LA CONDICIÓN QUE NO SE PUEDE SALTAR ═══
 *
 * Si esto entra en `costesPorProteina` tiene que entrar TAMBIÉN en la
 * generación. Si el selector promete 69,78 € porque lo sacó del fondo y luego
 * `construirMejor` genera otra cosa, se recrea el fallo que ya se arregló una
 * vez: prometer una cifra y entregar otra. Las dos rutas leen del mismo fondo o
 * no se toca ninguna.
 *
 *   node --experimental-strip-types catalogo/_aud-fondo.ts
 */
import datosJson from '../src/data/motor-datos.json' with { type: 'json' };
import {
  construir, costesPorProteina, nutricionDe, recetarioAdaptado, GRAMOS_POR_NIVEL,
} from '../src/motor/seleccionar.ts';
import type { NivelProteina, PeticionSemana } from '../src/motor/seleccionar.ts';
import { consumoPorRacion } from '../src/motor/carrito.ts';
import type { DatosMotor } from '../src/motor/tipos.ts';

const datos = datosJson as unknown as DatosMotor;
const ORDEN: NivelProteina[] = ['basica', 'normal', 'alta'];
/** De mayor suelo a menor: la cascada va por aquí. */
const DESCENDENTE: NivelProteina[] = ['alta', 'normal', 'basica'];
const SEMILLAS = 8;

type Candidata = NonNullable<ReturnType<typeof construir>>;

/**
 * El fondo. Un solo recorrido de semillas por cada presión de proteína.
 *
 * Cuesta lo mismo que hoy —`costesPorProteina` ya llama tres veces al
 * constructor— pero en vez de tirar dos tercios del trabajo, lo comparte.
 */
function fondoDeSemanas(peticion: PeticionSemana): Candidata[] {
  const minutosMax = { minimo: 20, normal: 40, libre: Infinity }[peticion.esfuerzo ?? 'libre'];
  const ordenadas = recetarioAdaptado(datos, peticion.exclusiones ?? [], minutosMax, peticion.platosBloqueados)
    .map((r) => ({ r, coste: consumoPorRacion(r, datos, peticion.N) }))
    .sort((a, b) => a.coste - b.coste)
    .map((x) => x.r);

  const fondo: Candidata[] = [];
  for (const presion of ORDEN) {
    for (const receta of ordenadas.slice(0, SEMILLAS)) {
      const c = construir({ ...peticion, proteina: presion }, { forzarPrimera: receta.id });
      if (c) fondo.push(c);
    }
  }
  return fondo;
}

/** Los tres criterios, tal y como están hoy en OBJETIVO_POR_NIVEL. */
const CRITERIO: Record<NivelProteina, (c: number, p: number, consumo: number) => number> = {
  basica: (_c, p) => p,
  normal: (c, p, consumo) => (c - consumo) + p,
  alta: (c) => c,
};

/** Lexicográfico, igual que `mejorRango` en el motor. */
function mejor(a: number[], b: number[]): boolean {
  for (let k = 0; k < a.length; k++) if (a[k] !== b[k]) return a[k] < b[k];
  return false;
}

function elegir(
  fondo: Candidata[], peticion: PeticionSemana, nivel: NivelProteina, tope: number,
): Candidata | null {
  const suelo = GRAMOS_POR_NIVEL[nivel];
  const presupuesto = peticion.presupuesto ?? Infinity;
  let elegida: Candidata | null = null;
  let rangoElegida: number[] | null = null;
  for (const c of fondo) {
    const nut = nutricionDe(c.huecos, datos, peticion.N, suelo);
    const coste = c.carrito.totalCarrito;
    const r = [
      nut.cumpleSuelo ? 0 : 1,
      coste <= presupuesto ? 0 : 1,
      // LA CASCADA: no puede costar más que el nivel de encima.
      coste <= tope + 0.005 ? 0 : 1,
      CRITERIO[nivel](coste, c.carrito.totalPerecedero, c.carrito.totalConsumo),
    ];
    if (!elegida || mejor(r, rangoElegida!)) { elegida = c; rangoElegida = r; }
  }
  return elegida;
}

let casos = 0;
let rotasHoy = 0;
let rotasFondo = 0;
let peorHoy = 0;
let peorFondo = 0;
let carritoHoy = 0; let consumoHoy = 0; let perecederoHoy = 0; let medidasHoy = 0;
let carritoFondo = 0; let consumoFondo = 0; let perecederoFondo = 0; let medidasFondo = 0;
let colapsos = 0;

const t0 = Date.now();
for (const N of [1, 2, 4]) {
  for (const numHuecos of [7, 14]) {
    for (const presupuesto of [45, 65, 90]) {
      for (const semanaNumero of [1, 2, 3]) {
        for (const variedad of ['poca', 'normal', 'mucha'] as const) {
          const base: PeticionSemana = {
            datos, N, numHuecos, presupuesto, variedad, semanaNumero,
            esfuerzo: 'libre', exclusiones: [], proteina: 'normal',
          };
          casos++;

          // --- como está hoy ---
          const hoy = costesPorProteina(base);
          for (const n of ORDEN) {
            if (!Number.isFinite(hoy[n].carrito)) continue;
            carritoHoy += hoy[n].carrito; consumoHoy += hoy[n].consumo;
            perecederoHoy += hoy[n].perecedero; medidasHoy++;
          }
          for (let i = 0; i + 1 < ORDEN.length; i++) {
            const a = hoy[ORDEN[i]]; const b = hoy[ORDEN[i + 1]];
            if (!Number.isFinite(a.carrito) || !Number.isFinite(b.carrito)) continue;
            if (b.carrito < a.carrito - 0.005) {
              rotasHoy++; peorHoy = Math.max(peorHoy, a.carrito - b.carrito); break;
            }
          }

          // --- con fondo compartido y cascada ---
          const fondo = fondoDeSemanas(base);
          const elegidas: Partial<Record<NivelProteina, Candidata | null>> = {};
          let tope = Infinity;
          for (const n of DESCENDENTE) {
            const c = elegir(fondo, base, n, tope);
            elegidas[n] = c;
            if (c) tope = Math.min(tope, c.carrito.totalCarrito);
          }
          const costes = ORDEN.map((n) => elegidas[n]?.carrito.totalCarrito ?? Number.NaN);
          for (const n of ORDEN) {
            const c = elegidas[n];
            if (!c) continue;
            carritoFondo += c.carrito.totalCarrito; consumoFondo += c.carrito.totalConsumo;
            perecederoFondo += c.carrito.totalPerecedero; medidasFondo++;
          }
          for (let i = 0; i + 1 < costes.length; i++) {
            if (!Number.isFinite(costes[i]) || !Number.isFinite(costes[i + 1])) continue;
            if (costes[i + 1] < costes[i] - 0.005) {
              rotasFondo++; peorFondo = Math.max(peorFondo, costes[i] - costes[i + 1]); break;
            }
          }
          // ¿Se quedan los tres en la misma semana? Sería monótono y vacío.
          const vivos = costes.filter(Number.isFinite);
          if (vivos.length === 3 && Math.max(...vivos) - Math.min(...vivos) < 0.005) colapsos++;
        }
      }
    }
  }
}

const pct = (a: number) => `${(a / casos * 100).toFixed(1)}%`;
console.log('\n═══ HOY ═══');
console.log(`  subir de nivel y pagar menos: ${rotasHoy}/${casos} (${pct(rotasHoy)})  peor ${peorHoy.toFixed(2)} €`);
console.log(`  medias · carrito ${(carritoHoy / medidasHoy).toFixed(2)} €  come ${(consumoHoy / medidasHoy).toFixed(2)} €  tira ${(perecederoHoy / medidasHoy).toFixed(2)} €`);

console.log('\n═══ FONDO COMPARTIDO + CASCADA ═══');
console.log(`  subir de nivel y pagar menos: ${rotasFondo}/${casos} (${pct(rotasFondo)})  peor ${peorFondo.toFixed(2)} €`);
console.log(`  medias · carrito ${(carritoFondo / medidasFondo).toFixed(2)} €  come ${(consumoFondo / medidasFondo).toFixed(2)} €  tira ${(perecederoFondo / medidasFondo).toFixed(2)} €`);
console.log(`  los tres niveles dan la MISMA semana en ${colapsos}/${casos} (${pct(colapsos)})`);
console.log(`\n${((Date.now() - t0) / 1000).toFixed(0)} s`);
