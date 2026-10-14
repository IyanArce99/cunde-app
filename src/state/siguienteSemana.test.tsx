/**
 * ═══ CUÁNDO SE PREPARA LA SEMANA SIGUIENTE ═══
 *
 * Cerrar la compra no es acabar la semana: se cierra en el súper, con siete
 * días de cocina por delante. Cuando la compra está cerrada Y han pasado los
 * siete días de la vigente, Semana ofrece «Preparar siguiente semana»; al
 * pulsarlo se hace la transición y la contabilidad —historial, despensa,
 * número de semana—, una sola vez. Nada cambia solo: ni al arrancar ni al
 * volver a primer plano.
 *
 * Existe por un bloqueo real: con el muro apagado y sin tienda configurada,
 * la única puerta a la semana siguiente (`SEGUIR_GRATIS`) no la cruzaba nadie,
 * y tras cerrar la compra la app enseñaba la misma semana para siempre.
 *
 * Todas las fechas van con reloj falso. Son días de calendario locales.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render } from '@testing-library/react';
import { AppStateProvider, reducer, estadoParaTests, tocaAbrirLaSiguiente, useAppState } from './AppStateContext';
import { despensaTrasLaSemana, generarParaApp } from '../data/motor';
import { totalLista } from '../lib/derive';
import type { AppState } from './types';

const INICIO = '2026-10-12'; // lunes
const dia = (a: number, m: number, d: number) => new Date(a, m - 1, d, 10, 0);

/** Una semana recién generada que empieza el lunes 12 de octubre. */
function semanaDelLunes(): AppState {
  window.localStorage.clear();
  const base = estadoParaTests();
  const perfil = { ...base.perfil, fechaInicioSemana: INICIO, codigoPostal: '28001' };
  const semana = generarParaApp(perfil, base.preferencias);
  return {
    ...base,
    perfil,
    onboardingCompletado: true,
    semana: { plan: semana.plan, dias: semana.dias, generadaEn: dia(2026, 10, 12).getTime(), fechaInicio: INICIO },
    lista: semana.lista,
  };
}

const huella = (e: AppState) => e.semana.plan.huecos.map((h) => `${h.tipo}:${h.recetaId}`).join(' ');
const abrir = (e: AppState) => reducer(e, { type: 'PREPARAR_SIGUIENTE_SEMANA' });
const cerrar = (e: AppState) => reducer(e, { type: 'GUARDAR_CIERRE', importeRealTicket: 52.3 });

beforeEach(() => {
  window.localStorage.clear();
  vi.useFakeTimers();
});
afterEach(() => { vi.useRealTimers(); });

describe('cerrar la compra no cambia la semana', () => {
  it('guarda el ticket y deja el menú, el historial, la despensa y el número como estaban', () => {
    vi.setSystemTime(dia(2026, 10, 12));
    const antes = semanaDelLunes();
    const e = cerrar(antes);
    expect(e.cierre.guardada).toBe(true);
    expect(e.cierre.importeRealTicket).toBe(52.3);
    expect(huella(e)).toBe(huella(antes));
    expect(e.semana.fechaInicio).toBe(INICIO);
    // Las mismas referencias: no se ha tocado nada de la contabilidad.
    expect(e.historial).toBe(antes.historial);
    expect(e.despensa).toBe(antes.despensa);
    expect(e.contadores.semanaNumero).toBe(antes.contadores.semanaNumero);
  });

  it('y mientras dura la semana, comprobar si toca abrir no hace nada', () => {
    vi.setSystemTime(dia(2026, 10, 12));
    const cerrada = cerrar(semanaDelLunes());
    // Del lunes 12 al domingo 18: los siete días de la semana vigente.
    for (let d = 12; d <= 18; d++) {
      vi.setSystemTime(dia(2026, 10, d));
      expect(tocaAbrirLaSiguiente(cerrada), `día ${d}`).toBe(false);
      // El MISMO objeto: ni render ni escritura en cada vuelta a primer plano.
      expect(abrir(cerrada), `día ${d}`).toBe(cerrada);
    }
  });

  it('retocar la semana vigente después de cerrar no descuenta sus propios sobrantes', () => {
    /* Es por lo que la contabilidad se movió del cierre a la apertura: con la
       despensa ya actualizada, cualquier retoque de la semana cerrada veía en
       casa lo que esa misma semana iba a dejar. */
    vi.setSystemTime(dia(2026, 10, 12));
    const antes = semanaDelLunes();
    const h = antes.semana.plan.huecos[4];
    const retoque = { type: 'RETOCAR_HUECO' as const, dia: h.dia, ranura: h.ranura, retoque: 'libre' as const };
    // El mismo retoque sobre la semana sin cerrar es la referencia.
    const sinCerrar = reducer(antes, retoque);

    vi.setSystemTime(dia(2026, 10, 14));
    const e = reducer(cerrar(antes), retoque);
    expect(e.lista.filter((it) => it.yaEnCasa)).toEqual([]);
    expect(huella(e)).toBe(huella(sinCerrar));
    expect(totalLista(e.lista)).toBe(totalLista(sinCerrar.lista));
  });
});

describe('al llegar el siguiente periodo', () => {
  it('abre la semana nueva y hace la contabilidad de la anterior', () => {
    vi.setSystemTime(dia(2026, 10, 12));
    const antes = semanaDelLunes();
    const cerrada = cerrar(antes);
    const comidas = [...new Set(antes.semana.plan.tandas.map((t) => t.recetaId))];
    const despensaEsperada = despensaTrasLaSemana(antes.perfil, antes.preferencias, antes.semana.plan, antes.despensa);

    vi.setSystemTime(dia(2026, 10, 19)); // el lunes siguiente
    expect(tocaAbrirLaSiguiente(cerrada)).toBe(true);
    const e = abrir(cerrada);

    expect(e.contadores.semanaNumero).toBe(antes.contadores.semanaNumero + 1);
    expect(e.cierre).toEqual({ importeRealTicket: null, guardada: false });
    expect(e.semana.fechaInicio).toBe('2026-10-19');
    expect(e.perfil.fechaInicioSemana).toBe('2026-10-19');
    expect(e.historial[0]).toEqual(comidas);
    expect(e.historial).toHaveLength(antes.historial.length + 1);
    // La despensa es la de UNA semana: lo que había más lo que sobró, una vez.
    expect(e.despensa).toEqual(despensaEsperada);
    expect(Object.keys(e.despensa).length).toBeGreaterThan(0);
    // Y es otra semana, no la misma con otra fecha.
    expect(huella(e)).not.toBe(huella(antes));
    expect(e.semana.plan.huecos).toHaveLength(antes.semana.plan.huecos.length);
  });

  it('conserva el perfil, las preferencias y lo que el usuario ha dicho de los platos', () => {
    vi.setSystemTime(dia(2026, 10, 12));
    const base = semanaDelLunes();
    const antes: AppState = {
      ...base,
      preferencias: { ...base.preferencias, variedadElegida: true, exclusiones: ['Gluten'] },
      preferenciasPlatos: { lentejas_chorizo: { platoId: 'lentejas_chorizo', valoracion: 'no_quiero', actualizadaEn: '2026-10-12T10:00:00.000Z' } },
    };
    vi.setSystemTime(dia(2026, 10, 19));
    const e = abrir(cerrar(antes));
    expect(e.preferencias).toEqual(antes.preferencias);
    expect(e.preferenciasPlatos).toEqual(antes.preferenciasPlatos);
    expect(e.perfil.presupuestoSemanal).toBe(antes.perfil.presupuestoSemanal);
    expect(e.perfil.comensales).toBe(antes.perfil.comensales);
    expect(e.perfil.codigoPostal).toBe('28001');
    expect(e.semana.plan.tandas.map((t) => t.recetaId)).not.toContain('lentejas_chorizo');
  });

  it('una sola vez: volver a comprobar, recargar o volver del segundo plano no la repite', () => {
    vi.setSystemTime(dia(2026, 10, 12));
    const cerrada = cerrar(semanaDelLunes());
    vi.setSystemTime(dia(2026, 10, 19));
    const abierta = abrir(cerrada);

    expect(tocaAbrirLaSiguiente(abierta)).toBe(false);
    expect(abrir(abierta)).toBe(abierta);

    // Recargar: el estado sale de localStorage y vuelve a pasar por el reducer.
    const recargada = JSON.parse(JSON.stringify(abierta)) as AppState;
    const tras = abrir(recargada);
    expect(tras).toBe(recargada);
    expect(tras.contadores.semanaNumero).toBe(abierta.contadores.semanaNumero);
    expect(tras.historial).toHaveLength(abierta.historial.length);
    expect(tras.despensa).toEqual(abierta.despensa);

    // Y días después, dentro de la semana nueva, tampoco.
    vi.setSystemTime(dia(2026, 10, 23));
    expect(abrir(recargada)).toBe(recargada);
  });

  it('si vuelve días después, la semana nueva empieza hoy y no en una que ya pasó', () => {
    vi.setSystemTime(dia(2026, 10, 12));
    const cerrada = cerrar(semanaDelLunes());
    vi.setSystemTime(dia(2026, 10, 27)); // quince días después
    const e = abrir(cerrada);
    expect(e.semana.fechaInicio).toBe('2026-10-27');
    expect(e.contadores.semanaNumero).toBe(cerrada.contadores.semanaNumero + 1);
  });

  it('un día tarde también empieza hoy: la semana nueva no nace con un día perdido', () => {
    /* La regla vieja admitía empezar AYER (pensada para abrir al cerrar la
       compra del domingo). Preparándola el martes 20, eso era una semana que
       empezaba el lunes 19 con el lunes ya pasado. */
    vi.setSystemTime(dia(2026, 10, 12));
    const cerrada = cerrar(semanaDelLunes());
    vi.setSystemTime(dia(2026, 10, 20));
    expect(abrir(cerrada).semana.fechaInicio).toBe('2026-10-20');
  });

  it('tras una ausencia larga, lo que caducó en la nevera ya no está en la despensa', () => {
    /* Restar siempre siete días dejaba en casa productos caducados que el motor
       daba por buenos y descontaba de la compra. Ahora envejecen lo que de
       verdad ha pasado: del 12 al 27 son quince días. */
    vi.setSystemTime(dia(2026, 10, 12));
    const antes = semanaDelLunes();
    const cerrada = cerrar(antes);
    const conSieteDias = despensaTrasLaSemana(antes.perfil, antes.preferencias, antes.semana.plan, antes.despensa, 7);
    const conQuince = despensaTrasLaSemana(antes.perfil, antes.preferencias, antes.semana.plan, antes.despensa, 15);

    vi.setSystemTime(dia(2026, 10, 27));
    const e = abrir(cerrada);
    expect(e.despensa).toEqual(conQuince);
    // Hay productos que aguantaban siete días y no quince: esos ya no están.
    expect(Object.keys(conQuince).length).toBeLessThan(Object.keys(conSieteDias).length);
    for (const [sku, x] of Object.entries(e.despensa)) {
      expect(x.diasRestantes, sku).toBeGreaterThan(0);
      expect(x.diasRestantes, sku).toBe(conSieteDias[sku].diasRestantes - 8);
    }
  });

  it('preparándola a tiempo, la despensa envejece una semana', () => {
    vi.setSystemTime(dia(2026, 10, 12));
    const antes = semanaDelLunes();
    vi.setSystemTime(dia(2026, 10, 19));
    const e = abrir(cerrar(antes));
    expect(e.despensa).toEqual(despensaTrasLaSemana(antes.perfil, antes.preferencias, antes.semana.plan, antes.despensa, 7));
  });

  it('sin la compra cerrada no se abre, por mucho que pasen los días', () => {
    /* Que pase el tiempo no da por hecha una compra que nadie ha confirmado:
       no se sabe qué hay en la cocina. El usuario sigue pudiendo cerrarla. */
    vi.setSystemTime(dia(2026, 10, 12));
    const sinCerrar = semanaDelLunes();
    vi.setSystemTime(dia(2026, 10, 30));
    expect(tocaAbrirLaSiguiente(sinCerrar)).toBe(false);
    expect(abrir(sinCerrar)).toBe(sinCerrar);
  });

  it('cerrar la compra con la semana ya pasada no cambia el menú: solo ofrece prepararla', () => {
    /* Quien compra tarde acaba de comprar ESTE menú. La semana nueva no llega
       hasta que la pida. */
    vi.setSystemTime(dia(2026, 10, 12));
    const antes = semanaDelLunes();
    vi.setSystemTime(dia(2026, 10, 21));
    const e = cerrar(antes);
    expect(huella(e)).toBe(huella(antes));
    expect(e.cierre.guardada).toBe(true);
    expect(tocaAbrirLaSiguiente(e)).toBe(true);
  });

  it('una semana anterior a las fechas usa el día en que se generó', () => {
    vi.setSystemTime(dia(2026, 10, 12));
    const base = semanaDelLunes();
    const sinFecha = cerrar({ ...base, semana: { ...base.semana, fechaInicio: null } });
    vi.setSystemTime(dia(2026, 10, 18));
    expect(tocaAbrirLaSiguiente(sinFecha)).toBe(false);
    vi.setSystemTime(dia(2026, 10, 19));
    expect(tocaAbrirLaSiguiente(sinFecha)).toBe(true);
  });

  it('antes de acabar el onboarding no hay nada que abrir', () => {
    vi.setSystemTime(dia(2026, 10, 30));
    const e = { ...cerrar(semanaDelLunes()), onboardingCompletado: false };
    expect(abrir(e)).toBe(e);
  });
});

describe('nada cambia solo', () => {
  /** Monta la app con un estado guardado y devuelve lo que ve la pantalla. */
  function montar(guardado: AppState) {
    window.localStorage.setItem('cunde:estado:v16', JSON.stringify(guardado));
    let visto: AppState | null = null;
    const Espia = () => { visto = useAppState().estado; return null; };
    const r = render(<AppStateProvider><Espia /></AppStateProvider>);
    return { r, ver: () => visto! };
  }

  it('al arrancar y al volver a primer plano con la semana ya vencida, el menú sigue', () => {
    vi.setSystemTime(dia(2026, 10, 12));
    const cerrada = cerrar(semanaDelLunes());
    vi.setSystemTime(dia(2026, 10, 24)); // doce días después, sin conexión ni prisa
    const { r, ver } = montar(cerrada);
    expect(huella(ver())).toBe(huella(cerrada));
    act(() => { document.dispatchEvent(new Event('visibilitychange')); });
    expect(huella(ver())).toBe(huella(cerrada));
    expect(ver().cierre.guardada).toBe(true);
    expect(tocaAbrirLaSiguiente(ver())).toBe(true);
    r.unmount();

    // Recargar: lo mismo.
    const otra = montar(JSON.parse(window.localStorage.getItem('cunde:estado:v16')!));
    expect(huella(otra.ver())).toBe(huella(cerrada));
    otra.r.unmount();
  });

  it('pulsar dos veces prepara una sola semana', () => {
    vi.setSystemTime(dia(2026, 10, 12));
    const cerrada = cerrar(semanaDelLunes());
    vi.setSystemTime(dia(2026, 10, 19));
    const una = abrir(cerrada);
    expect(abrir(una)).toBe(una);
    expect(una.historial).toHaveLength(cerrada.historial.length + 1);
  });
});

describe('deshacer el cierre', () => {
  it('devuelve la semana abierta sin haber movido nada', () => {
    vi.setSystemTime(dia(2026, 10, 12));
    const antes = semanaDelLunes();
    const e = reducer(cerrar(antes), { type: 'DESHACER_CIERRE' });
    expect(e.cierre.guardada).toBe(false);
    expect(e.historial).toEqual(antes.historial);
    expect(e.despensa).toEqual(antes.despensa);
    expect(e.contadores.semanaNumero).toBe(antes.contadores.semanaNumero);
    vi.setSystemTime(dia(2026, 10, 19));
    expect(abrir(e)).toBe(e);
  });
});

describe('con el muro delante, la puerta sigue siendo el muro', () => {
  it('pasar el muro abre la semana en el acto y hace la misma contabilidad', () => {
    vi.setSystemTime(dia(2026, 10, 12));
    const antes = semanaDelLunes();
    const cerrada = cerrar(antes);
    // El muro enseña la semana siguiente y la marca como vista al pasarlo.
    const e = reducer(cerrada, { type: 'SEGUIR_GRATIS', numeroSemana: antes.contadores.semanaNumero + 1 });
    expect(e.contadores.semanaNumero).toBe(antes.contadores.semanaNumero + 1);
    expect(e.contadores.semanaVistaGratis).toBe(e.contadores.semanaNumero);
    expect(e.cierre.guardada).toBe(false);
    expect(e.historial).toHaveLength(antes.historial.length + 1);
    expect(Object.keys(e.despensa).length).toBeGreaterThan(0);
    // Y la apertura por fecha ya no tiene nada que hacer: no se cuenta dos veces.
    vi.setSystemTime(dia(2026, 10, 19));
    expect(abrir(e)).toBe(e);
  });

  it('con el muro activo y sin Cunde+, la fecha sola no abre nada', async () => {
    vi.resetModules();
    vi.doMock('../lib/suscripcion', async () => ({
      ...(await vi.importActual<typeof import('../lib/suscripcion')>('../lib/suscripcion')),
      MURO_ACTIVO: true,
    }));
    const m = await import('./AppStateContext');
    vi.setSystemTime(dia(2026, 10, 12));
    const cerrada = m.reducer(semanaDelLunes(), { type: 'GUARDAR_CIERRE', importeRealTicket: 52.3 });
    vi.setSystemTime(dia(2026, 10, 19));
    expect(m.tocaAbrirLaSiguiente({ ...cerrada, suscripcion: null })).toBe(false);
    // Quien sí tiene Cunde+ no ve el muro, así que para él abre la fecha.
    expect(m.tocaAbrirLaSiguiente({ ...cerrada, suscripcion: 'mes' })).toBe(true);
    vi.doUnmock('../lib/suscripcion');
    vi.resetModules();
  });
});
