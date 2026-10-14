/**
 * ═══ LO PENDIENTE SE DICE, Y CON ALERGIAS NO ENTRA ═══
 *
 * Madrid conserva productos que la auditoría de mad3 no da por comprobados
 * (solo el nombre o la categoría dicen que son el ingrediente). Para quien no
 * tiene alergias valen, pero la lista lo dice: `sin_verificar` en el catálogo,
 * `sinVerificar` en la fila. Gran Canaria solo lleva lo verificado, salvo
 * despensa que se asume en casa, y esa también lo dice.
 *
 * Con una alergia, nada cuyo etiquetado no se conoce llega a la semana: ni en
 * los platos, ni en los postres, ni en las alternativas que ofrece la hoja.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import madridJson from '../data/motor-datos.json';
import granCanaria from '../data/zonas/gran-canaria.json';
import type { Sku } from '../motor/tipos';
import type { ItemLista } from './types';

const CLAVE = 'cunde:estado:v16';

async function con(codigoPostal: string) {
  window.localStorage.clear();
  window.localStorage.setItem(CLAVE, JSON.stringify({ perfil: { codigoPostal } }));
  vi.resetModules();
  const ctx = await import('./AppStateContext');
  const motor = await import('../data/motor');
  const base = ctx.estadoParaTests();
  const perfil = { ...base.perfil, codigoPostal, fechaInicioSemana: '2026-10-12' };
  // El catálogo que la app tiene cargado, indexado por SKU de Mercadona.
  const porSku = new Map<string, Sku>(Object.values(motor.datos.skus).map((s) => [String(s.sku), s]));
  return { ...motor, base, perfil, porSku };
}

const madrid = madridJson as unknown as { skus: Record<string, Sku> };

beforeEach(() => window.localStorage.clear());

describe('Madrid: lo pendiente va en la lista, señalado', () => {
  it('el catálogo marca lo que mad3 no da por comprobado, y nada más', () => {
    const marcados = Object.values(madrid.skus).filter((s) => s.sin_verificar);
    expect(marcados.length).toBeGreaterThan(0);
    // Lo comprobado de la auditoría no lleva la marca.
    expect(madrid.skus.lenteja_pardina?.sin_verificar).toBeUndefined();
  });

  it('cada fila de la lista lleva la marca si y solo si su producto la lleva', async () => {
    const { generarParaApp, base, perfil, porSku } = await con('28001');
    const s = generarParaApp(perfil, { ...base.preferencias, postre: true });
    const filas = s.lista.filter((i: ItemLista) => porSku.has(i.id));
    expect(filas.length).toBeGreaterThan(10);
    for (const i of filas) expect(!!i.sinVerificar, i.nombre).toBe(!!porSku.get(i.id)!.sin_verificar);
    // Con la semana de muestra de Madrid sale al menos uno: la marca se ve.
    expect(filas.some((i) => i.sinVerificar)).toBe(true);
  });
});

describe('con alergias, nada de etiquetado desconocido', () => {
  for (const [cp, zona] of [['28001', 'madrid'], ['35007', 'gran-canaria']] as const) {
    for (const alergia of ['Gluten', 'Lactosa', 'Frutos secos']) {
      it(`${zona} · ${alergia}: platos, postres y alternativas`, async () => {
        const { generarParaApp, alternativasParaApp, zonaCargada, base, perfil, porSku } = await con(cp);
        expect(zonaCargada().zona).toBe(zona);
        const prefs = { ...base.preferencias, postre: true, exclusiones: [alergia] };
        const s = generarParaApp(perfil, prefs);
        const desconocidos = (lista: ItemLista[]) => lista.filter((i) => porSku.get(i.id)?.alergenos_desconocidos).map((i) => i.nombre);
        expect(desconocidos(s.lista)).toEqual([]);
        const hueco = s.plan.huecos.findIndex((h) => h.tipo !== 'libre');
        for (const a of alternativasParaApp(perfil, prefs, s.plan, hueco, 1, [], {}, 3)) {
          expect(desconocidos(a.semana.lista), a.nombre).toEqual([]);
        }
      });
    }
  }
});

describe('Gran Canaria: solo lo verificado', () => {
  it('lo que no está verificado es despensa, y lo dice', () => {
    const z = granCanaria as unknown as { skus: Record<string, Sku | null>; porAlmacen?: Record<string, Record<string, Sku>>; estado: Record<string, { verificacion: string }> };
    const todos = [...Object.entries(z.skus), ...Object.values(z.porAlmacen ?? {}).flatMap((c) => Object.entries(c))];
    for (const [canonico, s] of todos) {
      if (!s?.sin_verificar) continue;
      expect(z.estado[canonico]?.verificacion, canonico).toMatch(/^existe y coincide; despensa/);
    }
    // Y lo verificado no hereda la marca de Madrid aunque allí esté pendiente.
    const enMadridPendientes = Object.keys(madrid.skus).filter((c) => madrid.skus[c].sin_verificar && z.skus[c]);
    for (const c of enMadridPendientes) {
      if (/verificado$/.test(z.estado[c]?.verificacion ?? '')) expect(z.skus[c]!.sin_verificar, c).toBeUndefined();
    }
  });
});
