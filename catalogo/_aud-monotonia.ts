/**
 * ¿CUÁNTAS VECES SUBIR UN NIVEL DE PROTEÍNA SALE MÁS BARATO?
 *
 * Reportado mirando la app: «Normal · 60 g · 81,37 €» junto a «Alta · 65 g ·
 * 69,78 €». Más proteína, doce euros menos. Antes de tocar el motor hay que
 * saber si es un caso raro o el comportamiento normal, así que esto barre lo
 * que un usuario puede tener puesto y mide EXACTAMENTE lo que pinta el selector
 * de Ajustes: `costesPorProteina`.
 *
 * Y compara tres motores, porque la hipótesis era que la incoherencia no estaba
 * en el optimizador sino en que cada nivel minimiza una cosa distinta:
 *
 *   actual        básica→perecedero · normal→desperdicio · alta→precio
 *   desperdicio   los tres, peso y desempate, por (carrito − consumo) + perecedero
 *   precio        los tres, peso y desempate, por el carrito
 *
 * ═══ LA HIPÓTESIS ERA FALSA · MEDIDO EL 7 AGO 2026 ═══
 *
 *   actual        112/162   69,1%   peor 41,47 €
 *   desperdicio   116/162   71,6%   peor 46,11 €
 *   precio        113/162   69,8%   peor 15,77 €
 *
 * Unificar el objetivo NO arregla nada: deja el problema igual o peor. Así que
 * la incoherencia no viene de que cada nivel optimice lo suyo — viene del
 * optimizador. Es un greedy con arranques múltiples, y el suelo de proteína no
 * es un filtro que se aplique al final: entra en la puntuación hueco a hueco,
 * así que cambiarlo manda la búsqueda a otro valle entero. El resultado no es
 * monótono en la restricción y no hay ajuste de pesos que lo haga monótono.
 *
 * Lo único que sí lo garantiza es una REPARACIÓN posterior, y sale gratis: los
 * conjuntos factibles están anidados —una semana de 60 g cumple también 55 y
 * 40—, así que la semana encontrada para un nivel alto SIEMPRE es válida para
 * los de abajo. Calculando los tres y dejando que cada nivel adopte la de
 * arriba si le conviene por SU criterio, la escalera queda monótona por
 * construcción y sin una sola pasada extra del motor.
 *
 * `precio` sí baja el peor caso de 41 € a 16 €, pero a cambio se come 1,36 €
 * menos y tira 2,13 € más por semana: es peor producto. No es el camino.
 *
 *   node --experimental-strip-types catalogo/_aud-monotonia.ts
 */
import datosJson from '../src/data/motor-datos.json' with { type: 'json' };
import { costesPorProteina } from '../src/motor/seleccionar.ts';
import type { CosteOpcion, NivelProteina, PeticionSemana } from '../src/motor/seleccionar.ts';
import type { DatosMotor } from '../src/motor/tipos.ts';

const datos = datosJson as unknown as DatosMotor;
const ORDEN: NivelProteina[] = ['basica', 'normal', 'alta'];
const MOTORES = [
  { nombre: 'actual', criterioUnico: undefined },
  { nombre: 'desperdicio', criterioUnico: 'desperdicio' as const },
  { nombre: 'precio', criterioUnico: 'precio' as const },
];

interface Resultado {
  casos: number; rotas: number; peor: number;
  carritoMedio: number; consumoMedio: number; perecederoMedio: number; proteinaMedia: number;
  ejemplos: string[];
}

function evaluar(criterioUnico: PeticionSemana['criterioUnico']): Resultado {
  const r: Resultado = {
    casos: 0, rotas: 0, peor: 0, carritoMedio: 0, consumoMedio: 0, perecederoMedio: 0, proteinaMedia: 0, ejemplos: [],
  };
  let medidas = 0;
  for (const N of [1, 2, 4]) {
    for (const numHuecos of [7, 14]) {
      for (const presupuesto of [45, 65, 90]) {
        for (const semanaNumero of [1, 2, 3]) {
          for (const variedad of ['poca', 'normal', 'mucha'] as const) {
            const c = costesPorProteina({
              datos, N, numHuecos, presupuesto, variedad, semanaNumero,
              esfuerzo: 'libre', exclusiones: [], proteina: 'normal', criterioUnico,
            });
            r.casos++;
            for (const nivel of ORDEN) {
              const o: CosteOpcion = c[nivel];
              if (!Number.isFinite(o.carrito)) continue;
              medidas++;
              r.carritoMedio += o.carrito;
              r.consumoMedio += o.consumo;
              r.perecederoMedio += o.perecedero;
              r.proteinaMedia += o.proteina;
            }
            for (let i = 0; i + 1 < ORDEN.length; i++) {
              const a: CosteOpcion = c[ORDEN[i]];
              const b: CosteOpcion = c[ORDEN[i + 1]];
              if (!Number.isFinite(a.carrito) || !Number.isFinite(b.carrito)) continue;
              if (b.carrito < a.carrito - 0.005) {
                r.rotas++;
                const delta = a.carrito - b.carrito;
                if (delta > r.peor) r.peor = delta;
                if (r.ejemplos.length < 5) {
                  r.ejemplos.push(
                    `N=${N} h=${numHuecos} tope=${presupuesto} ${variedad} sem=${semanaNumero}:  `
                    + `${ORDEN[i].padEnd(6)} ${a.proteina.toFixed(0)}g ${a.carrito.toFixed(2)}€ -> `
                    + `${ORDEN[i + 1].padEnd(6)} ${b.proteina.toFixed(0)}g ${b.carrito.toFixed(2)}€  (−${delta.toFixed(2)} €)`,
                  );
                }
                break;
              }
            }
          }
        }
      }
    }
  }
  for (const k of ['carritoMedio', 'consumoMedio', 'perecederoMedio', 'proteinaMedia'] as const) {
    r[k] /= medidas;
  }
  return r;
}

const t0 = Date.now();
for (const m of MOTORES) {
  const r = evaluar(m.criterioUnico);
  const pct = (r.rotas / r.casos * 100).toFixed(1);
  console.log(`\n═══ ${m.nombre.toUpperCase()} ═══`);
  console.log(`  subir de nivel y pagar menos: ${r.rotas}/${r.casos}  (${pct}%)   peor: ${r.peor.toFixed(2)} €`);
  console.log(`  medias · carrito ${r.carritoMedio.toFixed(2)} €  come ${r.consumoMedio.toFixed(2)} €  `
    + `tira ${r.perecederoMedio.toFixed(2)} €  proteína ${r.proteinaMedia.toFixed(1)} g`);
  // Lo que el proyecto llama desperdicio: lo que pasa por caja menos lo que se come.
  console.log(`  desperdicio medio: ${(r.carritoMedio - r.consumoMedio).toFixed(2)} €`);
  for (const e of r.ejemplos) console.log('    ' + e);
}
console.log(`\n${((Date.now() - t0) / 1000).toFixed(0)} s`);
