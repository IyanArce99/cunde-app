/**
 * ═══ VALORAR NO MUEVE LA SEMANA. REGENERAR SÍ. ═══
 *
 * Es la decisión de producto central de esta función y va contra lo que hace
 * todo el resto del reducer, así que tiene su propio archivo.
 *
 * El motivo: el usuario está mirando un plato de una semana que ya tiene
 * planificada, y puede que ya haya hecho la compra. Cambiarle el menú porque ha
 * dicho "no me lo vuelvas a poner" sería leerle "no me lo pongas" —que es otra
 * frase— y le dejaría en la nevera comida de un plato que la app acaba de
 * quitar del plan.
 */

import { describe, expect, it } from 'vitest';
import { reducer, estadoParaTests } from './AppStateContext';
import { datos, generarParaApp } from '../data/motor';
import type { AppState } from './types';

/** Un estado con una semana de verdad generada, como el de un usuario. */
function conSemana(): AppState {
  window.localStorage.clear();
  const base = estadoParaTests();
  const semana = generarParaApp(base.perfil, base.preferencias);
  return {
    ...base,
    onboardingCompletado: true,
    semana: { plan: semana.plan, dias: semana.dias, generadaEn: 1754000000000, fechaInicio: '2026-08-07' },
    lista: semana.lista,
  };
}

const platosDe = (e: AppState) => e.semana.plan.huecos.map((h) => h.recetaId);

describe('valorar un plato', () => {
  it('guarda la preferencia', () => {
    const antes = conSemana();
    const despues = reducer(antes, {
      type: 'VALORAR_PLATO', platoId: 'lentejas_chorizo', valoracion: 'no_quiero', tipo: 'receta',
    });
    expect(despues.preferenciasPlatos.lentejas_chorizo?.valoracion).toBe('no_quiero');
  });

  it('NO cambia la semana que el usuario tiene delante', () => {
    const antes = conSemana();
    // Se bloquea un plato que ESTÁ en la semana de ahora: es el caso peor.
    const enLaSemana = platosDe(antes).find(Boolean)!;
    const despues = reducer(antes, {
      type: 'VALORAR_PLATO', platoId: enLaSemana, valoracion: 'no_quiero', tipo: 'receta',
    });

    expect(platosDe(despues)).toEqual(platosDe(antes));
    expect(despues.semana.plan).toBe(antes.semana.plan);
    expect(despues.lista).toBe(antes.lista);
    // Y sigue ahí, con su nombre, aunque ya esté bloqueado para las siguientes.
    expect(platosDe(despues)).toContain(enLaSemana);
  });

  it('tampoco toca la lista de la compra ni los contadores', () => {
    const antes = conSemana();
    const despues = reducer(antes, {
      type: 'VALORAR_PLATO', platoId: 'x', valoracion: 'me_gusta', tipo: 'receta',
    });
    expect(despues.lista).toBe(antes.lista);
    expect(despues.contadores).toEqual(antes.contadores);
    expect(despues.despensa).toBe(antes.despensa);
  });

  it('tocar la opción que ya estaba puesta no cambia el estado', () => {
    const antes = reducer(conSemana(), {
      type: 'VALORAR_PLATO', platoId: 'r1', valoracion: 'me_gusta', tipo: 'receta',
    });
    expect(reducer(antes, {
      type: 'VALORAR_PLATO', platoId: 'r1', valoracion: 'me_gusta', tipo: 'receta',
    })).toBe(antes);
  });

  it('«está bien» quita una valoración anterior', () => {
    let e = conSemana();
    e = reducer(e, { type: 'VALORAR_PLATO', platoId: 'r1', valoracion: 'no_quiero', tipo: 'receta' });
    e = reducer(e, { type: 'VALORAR_PLATO', platoId: 'r1', valoracion: 'neutral', tipo: 'receta' });
    expect(e.preferenciasPlatos).toEqual({});
  });
});

describe('regenerar SÍ aplica lo valorado', () => {
  it('un plato bloqueado desaparece al cambiar cualquier preferencia', () => {
    let e = conSemana();
    const enLaSemana = platosDe(e).find(Boolean)!;
    e = reducer(e, {
      type: 'VALORAR_PLATO', platoId: enLaSemana, valoracion: 'no_quiero', tipo: 'receta',
    });
    expect(platosDe(e)).toContain(enLaSemana);

    /* Cualquier cosa que regenere. SET_PRESUPUESTO no vale: es del onboarding,
       donde todavía no hay semana que rehacer. */
    e = reducer(e, { type: 'SET_PREFERENCIAS', preferencias: { ...e.preferencias, postre: true } });
    expect(platosDe(e)).not.toContain(enLaSemana);
  });

  it('y ajustar variedad o proteína también lo aplica', () => {
    let e = conSemana();
    const enLaSemana = platosDe(e).find(Boolean)!;
    e = reducer(e, {
      type: 'VALORAR_PLATO', platoId: enLaSemana, valoracion: 'no_quiero', tipo: 'receta',
    });
    e = reducer(e, {
      type: 'SET_PREFERENCIAS',
      preferencias: { ...e.preferencias, proteina: 'alta', variedadElegida: true },
    });
    expect(platosDe(e)).not.toContain(enLaSemana);
  });

  it('devolver el plato lo vuelve a hacer elegible', () => {
    let e = conSemana();
    const original = platosDe(e).find(Boolean)!;
    e = reducer(e, { type: 'VALORAR_PLATO', platoId: original, valoracion: 'no_quiero', tipo: 'receta' });
    e = reducer(e, { type: 'SET_PREFERENCIAS', preferencias: { ...e.preferencias, postre: true } });
    expect(platosDe(e)).not.toContain(original);

    e = reducer(e, { type: 'VALORAR_PLATO', platoId: original, valoracion: 'neutral', tipo: 'receta' });
    e = reducer(e, { type: 'SET_PREFERENCIAS', preferencias: { ...e.preferencias, postre: false } });
    // Vuelve a estar permitido: la criba ya no lo ve.
    expect(e.preferenciasPlatos[original]).toBeUndefined();
  });
});

describe('con demasiados platos bloqueados', () => {
  /** Todo el recetario menos dos: el motor no puede llenar catorce huecos. */
  function bloquearCasiTodo(e: AppState): AppState {
    const preferenciasPlatos = { ...e.preferenciasPlatos };
    for (const r of datos.recetas.slice(0, -2)) {
      preferenciasPlatos[r.id] = {
        platoId: r.id, valoracion: 'no_quiero', actualizadaEn: '2026-08-07T10:00:00.000Z',
      };
    }
    return { ...e, preferenciasPlatos };
  }

  it('NO se borra la semana anterior: se deja lo que había y se guarda el diagnóstico', () => {
    const original = conSemana();
    const antes = platosDe(original);
    expect(antes.filter(Boolean).length).toBeGreaterThan(0);

    const e = reducer(bloquearCasiTodo(original), { type: 'SET_PREFERENCIAS', preferencias: { ...original.preferencias, postre: true } });

    // Lo que el usuario tiene delante sigue exactamente igual.
    expect(platosDe(e)).toEqual(antes);
    expect(e.lista).toBe(original.lista);
    // Y hay diagnóstico con el número de platos y su salida propia.
    expect(e.sinCobertura).toBeTruthy();
    expect(e.sinCobertura?.platosBloqueados).toBe(datos.recetas.length - 2);
    expect(e.sinCobertura?.salidas.some((s) => s.tipo === 'bloqueados')).toBe(true);
  });

  it('y NO se desbloquea nada por su cuenta para poder generar', () => {
    const e = reducer(bloquearCasiTodo(conSemana()), { type: 'SET_PREFERENCIAS', preferencias: { ...conSemana().preferencias, postre: true } });
    // La app no borra preferencias del usuario para salir del paso.
    expect(Object.keys(e.preferenciasPlatos)).toHaveLength(datos.recetas.length - 2);
  });

  it('devolver uno desbloquea el camino sin haber perdido nada', () => {
    let e = reducer(bloquearCasiTodo(conSemana()), { type: 'SET_PREFERENCIAS', preferencias: { ...conSemana().preferencias, postre: true } });
    expect(e.sinCobertura).toBeTruthy();

    for (const r of datos.recetas.slice(0, -2)) {
      e = reducer(e, { type: 'VALORAR_PLATO', platoId: r.id, valoracion: 'neutral', tipo: 'receta' });
    }
    e = reducer(e, { type: 'SET_PREFERENCIAS', preferencias: { ...e.preferencias, postre: false } });
    expect(e.sinCobertura).toBeNull();
    expect(platosDe(e).filter(Boolean).length).toBeGreaterThan(0);
  });
});
