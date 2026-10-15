/**
 * ═══ CAMBIAR DE ZONA Y RECIBIR PRECIOS NUEVOS SIN QUE LA COMPRA MIENTA ═══
 *
 * Dos garantías que viven en la carga del estado (cargarEstadoInicial):
 *
 *   1. Un plan montado con el catálogo de otra zona no se reutiliza. Quien pasa
 *      de un código de Madrid a uno de Gran Canaria no puede abrir la app y
 *      encontrarse la lista de Madrid con productos que allí no existen.
 *   2. Unos precios nuevos no cambian una compra en silencio: con la compra
 *      empezada esperan, y sin empezar se aplican y se dice cuánto cambia.
 *
 * El catálogo y el estado se leen una vez al cargar los módulos, así que cada
 * caso guarda lo suyo en localStorage y vuelve a importar.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import granCanaria from '../data/zonas/gran-canaria.json';
import type { AppState } from './types';

const CLAVE = 'cunde:estado:v16';

async function modulos() {
  vi.resetModules();
  const ctx = await import('./AppStateContext');
  const motor = await import('../data/motor');
  return { ...ctx, ...motor };
}

/** Un estado con su semana, montado con el catálogo que esté cargado. */
async function conSemana(codigoPostal: string, extra: Partial<AppState> = {}): Promise<AppState> {
  window.localStorage.clear();
  window.localStorage.setItem(CLAVE, JSON.stringify({ perfil: { codigoPostal } }));
  const { estadoParaTests, generarParaApp, zonaCargada, versionDePrecios } = await modulos();
  const base = estadoParaTests();
  const perfil = { ...base.perfil, codigoPostal, fechaInicioSemana: '2026-10-12' };
  const s = generarParaApp(perfil, base.preferencias);
  return {
    ...base,
    perfil,
    onboardingCompletado: true,
    semana: { plan: s.plan, dias: s.dias, generadaEn: Date.now(), fechaInicio: '2026-10-12' },
    lista: s.lista,
    zonaDelPlan: zonaCargada().zona,
    preciosDeLaLista: versionDePrecios(),
    ...extra,
  };
}

async function arrancarCon(estado: AppState, precios?: { clave: string; valor: unknown }) {
  window.localStorage.clear();
  window.localStorage.setItem(CLAVE, JSON.stringify(estado));
  if (precios) window.localStorage.setItem(precios.clave, JSON.stringify(precios.valor));
  const m = await modulos();
  return { ...m, estado: m.estadoParaTests() };
}

const huella = (e: AppState) => e.semana.plan.huecos.map((h) => `${h.tipo}:${h.recetaId}`).join(' ');

beforeEach(() => window.localStorage.clear());

describe('un plan de otra zona no se reutiliza', () => {
  it('de Madrid a Gran Canaria: la semana se rehace con lo que hay allí', async () => {
    const deMadrid = await conSemana('28001');
    expect(deMadrid.zonaDelPlan).toBe('madrid');
    // El usuario pone su código de Las Palmas; el plan guardado es de Madrid.
    const { estado, zonaCargada } = await arrancarCon({ ...deMadrid, perfil: { ...deMadrid.perfil, codigoPostal: '35001' } });
    expect(zonaCargada().zona).toBe('gran-canaria');
    expect(estado.zonaDelPlan).toBe('gran-canaria');
    expect(estado.preciosDeLaLista).toBe(granCanaria.version);
    // Lo común de la isla más la capa del almacén de 35001 (4701).
    const capa = (granCanaria as { porAlmacen?: Record<string, Record<string, { sku: string }>> }).porAlmacen?.['4701'] ?? {};
    const deLaZona = new Set([...Object.values(granCanaria.skus), ...Object.values(capa)].filter(Boolean).map((s) => s!.sku));
    expect(estado.lista.length).toBeGreaterThan(0);
    for (const it of estado.lista) expect(deLaZona.has(it.id), it.nombre).toBe(true);
    // Lo del usuario que no depende de la zona se queda.
    expect(estado.perfil.presupuestoSemanal).toBe(deMadrid.perfil.presupuestoSemanal);
  });

  it('un estado de antes, sin zona apuntada, es de Madrid: en Madrid no se toca', async () => {
    const deMadrid = await conSemana('28001', { zonaDelPlan: null });
    const { estado } = await arrancarCon(deMadrid);
    expect(huella(estado)).toBe(huella(deMadrid));
    expect(estado.zonaDelPlan).toBe('madrid');
  });

  it('en la misma zona, el plan es el mismo al volver a abrir', async () => {
    const deGC = await conSemana('35014');
    expect(deGC.zonaDelPlan).toBe('gran-canaria');
    const { estado } = await arrancarCon(deGC);
    expect(huella(estado)).toBe(huella(deGC));
    expect(estado.lista).toEqual(deGC.lista);
  });
});

describe('precios nuevos sobre una compra ya planeada', () => {
  /** Una instantánea de Madrid que sube un 10 % el producto más caro de la lista. */
  async function subida(estado: AppState) {
    const { datos } = await modulos();
    const masCaro = [...estado.lista].sort((a, b) => b.precio - a.precio)[0];
    const [canonico, sku] = Object.entries(datos.skus).find(([, s]) => s.sku === masCaro.id)!;
    return {
      masCaro,
      precios: {
        clave: 'cunde:precios:v1',
        valor: {
          version: '2099-01-01', almacen: 'mad3',
          skus: { [canonico]: { ...sku, precio: Number((sku.precio * 1.1).toFixed(2)) } },
        },
      },
    };
  }

  it('con la compra empezada, la lista no se toca y los nuevos esperan', async () => {
    const e = await conSemana('28001');
    const { precios } = await subida(e);
    const empezada = { ...e, lista: e.lista.map((it, i) => (i === 0 ? { ...it, enElCarro: true } : it)) };
    const { estado } = await arrancarCon(empezada, precios);
    expect(estado.lista).toEqual(empezada.lista);
    expect(estado.preciosDeLaLista).toBe(e.preciosDeLaLista);
    expect(estado.preciosEnEspera).toBe('2099-01-01');
    expect(estado.avisoPrecios).toBeNull();
  });

  it('sin empezar, se aplican y queda dicho cuánto cambia la lista', async () => {
    const e = await conSemana('28001');
    const { precios, masCaro } = await subida(e);
    const { estado } = await arrancarCon(e, precios);
    const nuevo = estado.lista.find((it) => it.id === masCaro.id)!;
    expect(nuevo.precio).toBeGreaterThan(masCaro.precio);
    expect(estado.preciosDeLaLista).toBe('2099-01-01');
    expect(estado.preciosEnEspera).toBeNull();
    expect(estado.avisoPrecios).not.toBeNull();
    expect(estado.avisoPrecios!.despues).toBeGreaterThan(estado.avisoPrecios!.antes);
    expect(estado.avisoPrecios!.hasta).toBe('2099-01-01');
  });

  it('unos precios de Madrid no se aplican a una lista de Gran Canaria', async () => {
    const e = await conSemana('35014');
    const precios = {
      clave: 'cunde:precios:v1',
      valor: { version: '2099-01-01', almacen: 'mad3', skus: {} },
    };
    const { estado, versionDePrecios } = await arrancarCon(e, precios);
    expect(versionDePrecios()).toBe(granCanaria.version);
    expect(estado.lista).toEqual(e.lista);
    expect(estado.preciosEnEspera).toBeNull();
  });
});

describe('la prueba personal en 35007 (almacén 3120)', () => {
  /*
   * El menú del documento docs/verificacion-35007-2026-10-14.md: 2 personas,
   * comidas y cenas, 65 €, variedad normal, semana que empieza el miércoles 14
   * de octubre. Por el camino de la app: código postal guardado → zona → capa
   * del almacén → generarParaApp. Si el catálogo verificado cambia, esto avisa
   * antes de que la lista impresa deje de cuadrar con la del teléfono.
   *
   * 15 oct 2026: avisó. Con las 9 equivalencias del mismo producto habilitadas
   * (catalogo/construir-zona.ts) el recetario pasa de 37 a 55 y la misma semana
   * sale a 55,73 € en vez de 57,04 €. El documento del 14 oct describe el
   * catálogo anterior.
   *
   * Y el mismo día, con el lote de recetas de Gran Canaria
   * (docs/recetas/lote-gran-canaria.json), 71 recetas y 61,46 €.
   */
  it('la app monta la misma compra de 61,46 €, solo con productos de la zona', async () => {
    window.localStorage.clear();
    window.localStorage.setItem(CLAVE, JSON.stringify({ perfil: { codigoPostal: '35007' } }));
    const { estadoParaTests, generarParaApp, zonaCargada, datos } = await modulos();
    expect(zonaCargada()).toEqual({ zona: 'gran-canaria', almacen: '3120', cobertura: 'medida' });
    const base = estadoParaTests();
    const s = generarParaApp(
      { ...base.perfil, codigoPostal: '35007', comensales: '2', presupuestoSemanal: 65, fechaInicioSemana: '2026-10-14' },
      { ...base.preferencias, comidas: 'ambas', esfuerzo: 'libre', variedad: 'normal', variedadElegida: true, proteina: 'normal', exclusiones: [], postre: false },
    );
    expect(s.carrito.totalCarrito).toBe(61.46);
    const deLaZona = new Set(Object.values(datos.skus).map((x) => x.sku));
    for (const it of s.lista) expect(deLaZona.has(it.id), it.nombre).toBe(true);
    expect(datos.recetas.length).toBe(71);
  });
});
