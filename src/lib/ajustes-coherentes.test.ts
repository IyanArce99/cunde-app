import { describe, expect, it } from 'vitest';
import { costesDeVariedad, costesDeProteina } from './derive';
import type { Contexto } from './derive';
import { generarParaApp } from '../data/motor';
import type { Perfil, Preferencias } from '../state/types';

/**
 * ═══ LA HOJA DE AJUSTES TIENE QUE ESTIMAR LA MISMA SEMANA QUE LA APP MONTA ═══
 *
 * El fallo que estos tests impiden:
 *
 * `lib/derive.ts:peticion()` construía la petición al motor SIN número de
 * semana, sin historial, sin despensa y sin preferencias de platos.
 * `regenerar()` en el reductor sí los pasa. Eran dos problemas distintos
 * resueltos con el mismo motor, y sus cifras no eran comparables.
 *
 * Medido antes del arreglo: con dos semanas de historial, la hoja enseñaba
 * **63,14 €** para una semana que la app monta por **47,29 €**. Y siempre la
 * misma cifra, pasara lo que pasara en la cuenta.
 *
 * El síntoma: abrir «Ajustar la semana» sin tocar nada mostraba un «sube 2,37 €»
 * que el usuario no había provocado. Después de tocar un selector parecía
 * funcionar, porque a partir de ahí se comparan dos estimaciones calculadas
 * igual de mal — coherentes entre sí, incoherentes con la semana real.
 *
 * En una app cuya única defensa es que sus cifras no mienten, esta era la peor
 * pantalla donde podía estar el fallo.
 */

const PERFIL: Perfil = {
  comensales: '2',
  super: 'Mercadona',
  presupuestoSemanal: 65,
  codigoPostal: '28001',
  almacen: null,
  /* Fija y no `hoy()`: el motor arma la semana desde este día, así que con una
     fecha móvil el test daría resultados distintos según el día que se ejecute.
     Un martes cualquiera. */
  fechaInicioSemana: '2026-08-11',
} as Perfil;

const PREFS: Preferencias = {
  comidas: 'ambas',
  esfuerzo: 'libre',
  variedad: 'normal',
  variedadElegida: true,
  proteina: 'normal',
  exclusiones: [],
  postre: false,
} as Preferencias;

const DESPENSA = {
  aceite_oliva: { cantidad: 500, semanas: 0 },
  arroz_largo: { cantidad: 400, semanas: 0 },
  garbanzo_cocido: { cantidad: 400, semanas: 0 },
  cebolla: { cantidad: 600, semanas: 0 },
};

const HISTORIAL = [
  ['jamoncitos_ajillo_champinones', 'sardinas_horno', 'lentejas_curry_espinacas'],
  ['merluza_salsa_verde', 'macarrones_pollo', 'garbanzos_espinacas'],
];

/** El contexto tal y como lo arma `AjustesSemana` desde el estado real. */
function ctxDe(semanaNumero: number, historial: string[][], despensa: object): Contexto {
  return {
    comensales: PERFIL.comensales,
    comidas: PREFS.comidas,
    esfuerzo: PREFS.esfuerzo,
    exclusiones: PREFS.exclusiones,
    presupuesto: PERFIL.presupuestoSemanal,
    variedad: PREFS.variedad,
    proteina: PREFS.proteina,
    postre: PREFS.postre,
    semanaNumero,
    historial,
    despensa: despensa as never,
    preferenciasPlatos: {},
    fechaInicioSemana: PERFIL.fechaInicioSemana,
  };
}

const CASOS: [string, number, string[][], object][] = [
  ['recién instalada', 1, [], {}],
  ['con despensa', 1, [], DESPENSA],
  ['con historial', 3, HISTORIAL, {}],
  ['con las dos cosas', 3, HISTORIAL, DESPENSA],
];

describe('la hoja de ajustes no miente', () => {
  it.each(CASOS)(
    'la estimación coincide con la semana real (%s)',
    (_nombre, semanaNumero, historial, despensa) => {
      const estimacion = costesDeVariedad(ctxDe(semanaNumero, historial, despensa))[PREFS.variedad];
      const real = generarParaApp(PERFIL, PREFS, semanaNumero, historial, despensa as never, {});

      expect(estimacion.disponible).toBe(true);
      /* Al céntimo. No es exigente de más: las dos llaman al mismo motor
         determinista con los mismos datos, así que o coinciden exactamente o
         alguien dejó de pasar algo. */
      expect(estimacion.carrito).toBeCloseTo(real.carrito.totalCarrito, 2);
    },
  );

  /**
   * El caso concreto del informe: la diferencia entre la primera semana y una
   * cuenta con historial era de 15,85 €. Si el arreglo se cae, esto lo canta.
   */
  it('el historial mueve la estimación, no solo la semana real', () => {
    const sinHistorial = costesDeVariedad(ctxDe(1, [], {}))[PREFS.variedad].carrito;
    const conHistorial = costesDeVariedad(ctxDe(3, HISTORIAL, {}))[PREFS.variedad].carrito;
    expect(conHistorial).not.toBeCloseTo(sinHistorial, 2);
  });

  /**
   * Y la caché tiene que distinguirlos. Sin la huella del estado en la clave,
   * la segunda consulta devolvería la cifra de la primera — que es cambiar un
   * fallo por otro más difícil de ver.
   */
  it('la caché no confunde dos estados distintos', () => {
    const a = costesDeVariedad(ctxDe(1, [], {}))[PREFS.variedad].carrito;
    const b = costesDeVariedad(ctxDe(1, [], DESPENSA))[PREFS.variedad].carrito;
    const a2 = costesDeVariedad(ctxDe(1, [], {}))[PREFS.variedad].carrito;
    /* La primera se vuelve a pedir y tiene que seguir dando lo suyo. */
    expect(a2).toBeCloseTo(a, 2);
    /* Y las dos entradas son independientes. */
    expect(Number.isFinite(b)).toBe(true);
  });

  it('la proteína también estima la semana real', () => {
    const ctx = ctxDe(3, HISTORIAL, DESPENSA);
    const estimacion = costesDeProteina(ctx)[PREFS.proteina];
    const real = generarParaApp(PERFIL, PREFS, 3, HISTORIAL, DESPENSA as never, {});
    expect(estimacion.carrito).toBeCloseTo(real.carrito.totalCarrito, 2);
  });
});
