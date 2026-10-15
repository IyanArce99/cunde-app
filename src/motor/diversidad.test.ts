/**
 * ═══ EXPERIMENTO `diversidad`: NUNCA PEOR QUE PRODUCCIÓN EN LO QUE MIDE ═══
 *
 * Ver PeticionSemana.diversidad. No es producción (la app no lo pasa), pero
 * lo que promete se comprueba: la semana elegida cabe en el tope, cumple el
 * suelo de proteína y los filtros, y no es MENOS variada que la de producción,
 * porque la de producción es siempre candidata.
 */
import { describe, expect, it } from 'vitest';
import datosJson from '../data/motor-datos.json';
import granCanaria from '../data/zonas/gran-canaria.json';
import { diversidadDe, generarSemana, recetarioAdaptado } from './seleccionar.ts';
import type { PeticionSemana } from './seleccionar.ts';
import { datosDeZona } from './zona.ts';
import type { CatalogoZona } from './zona.ts';
import { DIAS } from './tipos.ts';
import type { DatosMotor } from './tipos.ts';

const madrid = datosJson as unknown as DatosMotor;
const gc = datosDeZona(madrid, granCanaria as unknown as CatalogoZona, '3120');
const pet = (datos: DatosMotor, presupuesto: number, extra: Partial<PeticionSemana> = {}): PeticionSemana => ({
  datos, N: 2, numHuecos: 14, variedad: 'mucha', proteina: 'normal', esfuerzo: 'libre', exclusiones: [],
  presupuesto, semanaNumero: 1, recetasRecientes: [], existencias: {}, ordenDias: DIAS, ...extra,
});
const mayorOIgual = (a: number[], b: number[]) => {
  for (let k = 0; k < a.length; k++) if (a[k] !== b[k]) return a[k] > b[k];
  return true;
};

describe('experimento diversidad', () => {
  for (const [zona, datos] of [['madrid', madrid], ['gran-canaria', gc]] as const) {
    for (const tope of [60, 100]) {
      it(`${zona} · ${tope} €: cabe, cumple y no es menos variada que producción`, () => {
        const prod = generarSemana(pet(datos, tope));
        const exp = generarSemana(pet(datos, tope, { diversidad: { bonusFamiliaNueva: 8, toleranciaDesperdicio: 4 } }));
        expect(exp.cuadra).toBe(true);
        expect(exp.carrito.totalCarrito).toBeLessThanOrEqual(tope + 0.005);
        expect(exp.huecos).toHaveLength(14);
        const permitidas = new Set(recetarioAdaptado(datos, [], Infinity).map((r) => r.id));
        for (const t of exp.tandas) expect(permitidas.has(t.receta.id)).toBe(true);
        expect(mayorOIgual(diversidadDe(exp, datos), diversidadDe(prod, datos))).toBe(true);
      }, 30000);
    }
  }

  it('respeta los filtros: vegetariano no trae carne ni pescado', () => {
    const s = generarSemana(pet(madrid, 80, { exclusiones: ['Vegetariano'], diversidad: { bonusFamiliaNueva: 8, toleranciaDesperdicio: 4 } }));
    for (const t of s.tandas) expect(['pollo', 'cerdo', 'vacuno', 'cordero', 'pescado', 'marisco']).not.toContain(t.receta.proteina);
  }, 30000);
});
