/**
 * ═══ LA MIGRACIÓN DEL ESTADO GUARDADO ═══
 *
 * Existe por un fallo que estaba en producción y que nadie había visto: hasta
 * v12, "migrar" era cambiar la constante de la clave, y `cargarEstadoInicial`
 * solo miraba la nueva. O sea que cada versión del estado BORRABA la despensa
 * acumulada, el historial de tres semanas y el contador de semana de todo el
 * mundo — justo lo que la app cobra.
 *
 * Estos tests son el candado. Si alguien sube la versión sin añadir la clave
 * vieja a CLAUDES_ANTERIORES, aquí se ve.
 *
 * Se importa el módulo con `vi.resetModules()` en cada caso porque el estado
 * inicial se lee UNA vez, al cargar el módulo: sin reiniciarlo, el segundo test
 * mediría lo que dejó el primero.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cambiosUsados } from '../lib/premium';
import type { AppState } from './types';

/** Un v12 con todo lo que un usuario de verdad tendría dentro. */
const V12 = {
  onboardingCompletado: true,
  perfil: { comensales: '4', super: 'Mercadona', presupuestoSemanal: 92, codigoPostal: '28001', almacen: null },
  preferencias: {
    comidas: 'comidas', esfuerzo: 'minimo', variedad: 'mucha', variedadElegida: true,
    proteina: 'alta', exclusiones: ['Gluten', 'Marisco'], postre: true,
  },
  semana: { plan: { tandas: [], huecos: [] }, dias: [], generadaEn: 1754000000000 },
  historial: [['lentejas'], ['garbanzos'], ['pasta']],
  despensa: { '12345': { unidades: 2, semanas: 1 } },
  lista: [],
  sinCobertura: null,
  salidaPresupuesto: null,
  cierre: { importeRealTicket: 58.4, guardada: false },
  suscripcion: 'año',
  huboSuscripcion: true,
  contadores: { semanaNumero: 7, ajustesEstaSemana: 3, semanaVistaGratis: 6, bajadoConRetoques: 12.5 },
  deshacerCierre: null,
};

async function cargarCon(clave: string, valor: unknown): Promise<AppState> {
  window.localStorage.clear();
  vi.resetModules();
  if (valor !== undefined) window.localStorage.setItem(clave, JSON.stringify(valor));
  const { estadoParaTests } = await import('./AppStateContext');
  return estadoParaTests();
}

beforeEach(() => window.localStorage.clear());

describe('migrar de una versión anterior', () => {
  it('un v12 conserva TODO lo que el usuario tenía', async () => {
    const e = await cargarCon('cunde:estado:v12', V12);
    // Lo que se perdía antes, uno por uno. Es la lista que importa.
    expect(e.despensa).toEqual(V12.despensa);
    expect(e.historial).toEqual(V12.historial);
    expect(e.contadores.semanaNumero).toBe(7);
    expect(e.contadores.bajadoConRetoques).toBe(12.5);
    expect(e.cierre.importeRealTicket).toBe(58.4);
    expect(e.suscripcion).toBe('año');
    expect(e.huboSuscripcion).toBe(true);
    expect(e.perfil.presupuestoSemanal).toBe(92);
    expect(e.preferencias.exclusiones).toEqual(['Gluten', 'Marisco']);
  });

  it('y estrena el campo nuevo vacío, no indefinido', async () => {
    const e = await cargarCon('cunde:estado:v12', V12);
    expect(e.preferenciasPlatos).toEqual({});
  });

  it('un v11 —sin `variedadElegida`— entra como NO elegida', async () => {
    // Quien viene de v11 nunca pudo elegir la variedad: la tenía de fábrica.
    // Marcarla como elegida le congelaría para siempre un 'normal' que no puso.
    const { variedadElegida, ...sinElegir } = V12.preferencias;
    const e = await cargarCon('cunde:estado:v11', { ...V12, preferencias: sinElegir });
    expect(e.preferencias.variedadElegida).toBe(false);
    expect(e.preferencias.variedad).toBe('mucha');
    expect(e.historial).toEqual(V12.historial);
  });

  it('gana la clave más nueva cuando hay varias', async () => {
    window.localStorage.clear();
    vi.resetModules();
    window.localStorage.setItem('cunde:estado:v11', JSON.stringify({ ...V12, contadores: { ...V12.contadores, semanaNumero: 1 } }));
    window.localStorage.setItem('cunde:estado:v12', JSON.stringify(V12));
    const { estadoParaTests } = await import('./AppStateContext');
    expect(estadoParaTests().contadores.semanaNumero).toBe(7);
  });

  it('la clave vieja NO se borra: si hay que volver atrás, sigue ahí', async () => {
    await cargarCon('cunde:estado:v12', V12);
    expect(window.localStorage.getItem('cunde:estado:v12')).toBeTruthy();
  });
});

/**
 * ═══ v16 · EL CONTADOR DE CAMBIOS DE CUNDE+ ═══
 *
 * La migración que importa aquí no es de datos: es de dinero. Quien ya tenía la
 * app instalada no puede aparecer con los cambios gastados ni, al revés, con
 * una suscripción que nunca compró.
 */
describe('migrar a v16 (Cunde+)', () => {
  /** v15 = todo lo de v12 más las fechas, y sin `cambiosDePlato`. */
  const V15 = { ...V12, perfil: { ...V12.perfil, fechaInicioSemana: '2026-08-03' } };

  it('quien viene de v15 entra con cero cambios usados', async () => {
    const e = await cargarCon('cunde:estado:v15', V15);
    expect(e.cambiosDePlato).toEqual({ semana: 0, usados: 0 });
    // Y no `undefined`: el reductor hace `estado.cambiosDePlato.semana` a pelo.
    expect(e.cambiosDePlato.semana).toBe(0);
  });

  it('la semana 0 de fábrica no choca con ninguna semana real', async () => {
    // Está en la semana 7 y el contador dice 0 → cero usados sin lógica extra.
    const e = await cargarCon('cunde:estado:v15', V15);
    expect(e.contadores.semanaNumero).toBe(7);
    expect(cambiosUsados(e, e.contadores.semanaNumero)).toBe(0);
  });

  it('un contador corrupto no rompe el cambio de plato', async () => {
    // `null` guardado por lo que sea: el reductor reventaría al leer `.semana`.
    for (const basura of [null, 'dos', { semana: 3 }, { semana: 1, usados: -4 }]) {
      const e = await cargarCon('cunde:estado:v16', { ...V15, cambiosDePlato: basura });
      expect(e.cambiosDePlato).toEqual({ semana: 0, usados: 0 });
    }
  });

  it('un contador bueno se conserva: cerrar la app no regala cambios', async () => {
    const e = await cargarCon('cunde:estado:v16', { ...V15, cambiosDePlato: { semana: 7, usados: 2 } });
    expect(cambiosUsados(e, 7)).toBe(2);
  });

  /**
   * `'año'` es un valor que ya no se vende —los planes son semana, mes y de por
   * vida— pero está guardado en la app de quien lo compró. Si `Suscripcion`
   * dejara de admitirlo, esa persona perdería lo que pagó.
   */
  it('un plan que ya no se vende sigue dando Cunde+', async () => {
    const e = await cargarCon('cunde:estado:v15', V15);
    expect(e.suscripcion).toBe('año');
    expect(e.suscripcion).not.toBeNull();
  });

  it('quien nunca pagó no aparece con suscripción', async () => {
    const e = await cargarCon('cunde:estado:v15', { ...V15, suscripcion: null, huboSuscripcion: false });
    expect(e.suscripcion).toBeNull();
  });
});

describe('estados rotos', () => {
  it('sin nada guardado, arranca de fábrica', async () => {
    const e = await cargarCon('nada', undefined);
    expect(e.onboardingCompletado).toBe(false);
    expect(e.preferenciasPlatos).toEqual({});
  });

  it('un JSON corrupto no deja la app sin arrancar', async () => {
    window.localStorage.clear();
    vi.resetModules();
    window.localStorage.setItem('cunde:estado:v13', '{esto no es json');
    const { estadoParaTests } = await import('./AppStateContext');
    expect(estadoParaTests().onboardingCompletado).toBe(false);
  });

  it('si la clave nueva está corrupta, se recupera de la anterior', async () => {
    window.localStorage.clear();
    vi.resetModules();
    window.localStorage.setItem('cunde:estado:v13', '{roto');
    window.localStorage.setItem('cunde:estado:v12', JSON.stringify(V12));
    const { estadoParaTests } = await import('./AppStateContext');
    // No se pierde la despensa por un fichero mal escrito.
    expect(estadoParaTests().despensa).toEqual(V12.despensa);
  });

  it('un mapa de preferencias con basura dentro se descarta ENTERO', async () => {
    // Medio bueno sería peor: fallaría en el motor, lejos de aquí.
    const e = await cargarCon('cunde:estado:v13', {
      ...V12,
      preferenciasPlatos: { r1: { platoId: 'r1', valoracion: 'me_encanta' } },
    });
    expect(e.preferenciasPlatos).toEqual({});
    // Y el resto del estado sobrevive: un campo malo no tira los demás.
    expect(e.despensa).toEqual(V12.despensa);
  });

  it('un mapa bueno se conserva tal cual', async () => {
    const preferenciasPlatos = {
      r1: { platoId: 'r1', valoracion: 'no_quiero', actualizadaEn: '2026-08-07T10:00:00.000Z' },
    };
    const e = await cargarCon('cunde:estado:v13', { ...V12, preferenciasPlatos });
    expect(e.preferenciasPlatos).toEqual(preferenciasPlatos);
  });

  it('campos con la forma equivocada se reparan sin tirar el estado', async () => {
    const e = await cargarCon('cunde:estado:v13', {
      ...V12, historial: 'esto era un array', despensa: null, lista: undefined,
    });
    expect(e.historial).toEqual([]);
    expect(e.despensa).toEqual({});
    expect(e.lista).toEqual([]);
    expect(e.contadores.semanaNumero).toBe(7);
  });
});
