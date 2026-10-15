/**
 * ═══ VARIEDAD ALTA: LA ELECCIÓN FINAL ENTRE VARIEDAD Y DESPERDICIO ═══
 *
 * Ver `elegirVariedadFrenteADesperdicio` en seleccionar.ts. Comprueba:
 *   · repetir receta y repetir categoría se cuentan por separado;
 *   · la semana que el usuario ya tenía sigue siendo candidata al subir el
 *     tope, y si cabe y no desperdicia más, no se cambia por una menos variada;
 *   · en «normal» y «baja» la elección es la de siempre.
 */
import { describe, expect, it } from 'vitest';
import datosJson from '../data/motor-datos.json';
import granCanaria from '../data/zonas/gran-canaria.json';
import { compararVariedad, generarSemana, variedadDeSemana } from './seleccionar.ts';
import type { PeticionSemana } from './seleccionar.ts';
import { datosDeZona } from './zona.ts';
import type { CatalogoZona } from './zona.ts';
import { DIAS } from './tipos.ts';
import type { DatosMotor, Tanda } from './tipos.ts';

const madrid = datosJson as unknown as DatosMotor;
const gc = datosDeZona(madrid, granCanaria as unknown as CatalogoZona, '3120');
const pet = (datos: DatosMotor, presupuesto: number, extra: Partial<PeticionSemana> = {}): PeticionSemana => ({
  datos, N: 2, numHuecos: 14, variedad: 'mucha', proteina: 'normal', esfuerzo: 'libre', exclusiones: [],
  presupuesto, semanaNumero: 1, recetasRecientes: [], existencias: {}, ordenDias: DIAS, ...extra,
});

describe('cómo de variada es una semana', () => {
  it('cuatro platos distintos de legumbre repiten categoría, no receta', () => {
    const legumbres = madrid.recetas.filter((r) => r.proteina === 'legumbre').slice(0, 4);
    const tandas = legumbres.map((receta) => ({ receta, huecosPrincipal: 1, huecosAcompanamiento: 0 })) as Tanda[];
    const v = variedadDeSemana({ tandas, huecos: [] }, madrid);
    expect(v.recetasRecocinadas).toBe(0);
    expect(v.categorias).toBe(1);
    expect(v.maxPorCategoria).toBe(4);
  });

  it('volver a cocinar una receta pesa más que concentrar categorías', () => {
    const a = { recetasRecocinadas: 0, comidasDeSobras: 2, categorias: 5, maxPorCategoria: 4, fuentes: 10 };
    const b = { recetasRecocinadas: 1, comidasDeSobras: 2, categorias: 7, maxPorCategoria: 2, fuentes: 14 };
    expect(compararVariedad(a, b)).toBeGreaterThan(0);
  });
});

describe('subir el tope con la semana anterior como candidata', () => {
  it('Gran Canaria, de 80 a 100 €: no sale una semana menos variada que la que ya se tenía', () => {
    const de80 = generarSemana(pet(gc, 80));
    const a100 = generarSemana(pet(gc, 100, { semanaPrevia: { huecos: de80.huecos, tandas: de80.tandas } }));
    expect(a100.cuadra).toBe(true);
    expect(compararVariedad(variedadDeSemana(a100, gc), variedadDeSemana(de80, gc))).toBeGreaterThanOrEqual(0);
    expect(a100.carrito.totalCarrito).toBeLessThanOrEqual(100);
  }, 30000);

  it('una semana previa que ya no cumple los filtros no es candidata', () => {
    const de80 = generarSemana(pet(madrid, 80));
    const conCarne = de80.tandas.some((t) => ['pollo', 'cerdo', 'vacuno', 'cordero', 'pescado', 'marisco'].includes(t.receta.proteina));
    expect(conCarne).toBe(true);
    const veg = generarSemana(pet(madrid, 100, { exclusiones: ['Vegetariano'], semanaPrevia: { huecos: de80.huecos, tandas: de80.tandas } }));
    for (const t of veg.tandas) expect(['pollo', 'cerdo', 'vacuno', 'cordero', 'pescado', 'marisco']).not.toContain(t.receta.proteina);
  }, 30000);
});

describe('fuera de la variedad alta, la elección de siempre', () => {
  for (const variedad of ['normal', 'poca'] as const) {
    it(variedad, () => {
      const huella = (s: ReturnType<typeof generarSemana>) => s.huecos.map((h) => `${h.tipo}:${h.receta?.id}`).join(' ');
      expect(huella(generarSemana(pet(gc, 80, { variedad })))).toBe(huella(generarSemana(pet(gc, 80, { variedad, soloDesperdicio: true }))));
    }, 30000);
  }
});
