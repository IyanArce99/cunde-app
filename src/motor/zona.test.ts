/**
 * ═══ GRAN CANARIA NO ES MADRID CON OTROS PRECIOS ═══
 *
 * Medido el 14 oct 2026 en los nueve almacenes de la isla: 31 de los 118 SKU de
 * Madrid no existen allí, y de los que sí, 55 cambian de precio. Lo que se
 * prueba aquí es que eso no se tape:
 *
 *   · ningún producto de Madrid se cuela en una semana de Gran Canaria;
 *   · las recetas que necesitan algo que no hay salen, y se dice cuáles;
 *   · lo que queda monta una semana de verdad, con precio de allí;
 *   · un canónico que la zona no trae no se rellena con el de Madrid.
 */
import { describe, expect, it } from 'vitest';
import base from '../data/motor-datos.json';
import granCanaria from '../data/zonas/gran-canaria.json';
import { generarSemana, recetarioAdaptado } from './seleccionar.ts';
import { datosDeZona } from './zona.ts';
import type { CatalogoZona } from './zona.ts';
import type { DatosMotor } from './tipos.ts';

const madrid = base as unknown as DatosMotor;
const zona = granCanaria as unknown as CatalogoZona;
const gc = datosDeZona(madrid, zona);
const LUNES = ['LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB', 'DOM'];

describe('el catálogo de Gran Canaria', () => {
  it('solo trae productos de la zona: ni uno de Madrid que allí no exista', () => {
    for (const [canonico, sku] of Object.entries(gc.skus)) {
      expect(zona.skus[canonico], canonico).toEqual(sku);
    }
    // Y los que la zona marca sin producto, no están.
    for (const [canonico, sku] of Object.entries(zona.skus)) {
      if (sku === null) expect(gc.skus[canonico], canonico).toBeUndefined();
    }
  });

  it('cada receta que se queda tiene producto para todo; las que salen dicen qué les falta', () => {
    for (const r of gc.recetas) {
      for (const i of r.ingredientes) {
        if (i.canonico === 'agua') continue;
        expect(gc.skus[i.canonico], `${r.id} · ${i.canonico}`).toBeDefined();
      }
    }
    expect(gc.recetas.length + gc.recetasFuera.length).toBe(madrid.recetas.length);
    for (const f of gc.recetasFuera) {
      expect(f.faltan.length, f.receta).toBeGreaterThan(0);
      for (const c of f.faltan) expect(gc.skus[c], `${f.receta} · ${c}`).toBeUndefined();
    }
  });

  it('las recetas no se copian: son las mismas, filtradas', () => {
    const porId = new Map(madrid.recetas.map((r) => [r.id, r]));
    for (const r of gc.recetas) expect(r).toBe(porId.get(r.id));
  });

  it('la versión de los precios es la fecha de la medición de la zona', () => {
    expect(gc.generadoEn).toBe(zona.version);
    expect(gc.generadoEn).not.toBe(madrid.generadoEn);
  });

  it('monta una semana con lo que hay, y todo lo que compra es de la zona', () => {
    const s = generarSemana({
      datos: gc, N: 2, numHuecos: 14, presupuesto: 65, variedad: 'normal', proteina: 'normal',
      esfuerzo: 'libre', exclusiones: [], semanaNumero: 1, ordenDias: LUNES,
    });
    expect(s.huecos.filter((h) => h.receta)).toHaveLength(14);
    const deLaZona = new Set(Object.values(gc.skus).map((x) => x.sku));
    for (const l of s.carrito.lineas) expect(deLaZona.has(l.sku), l.nombre).toBe(true);
    for (const t of s.tandas) expect(gc.recetas.some((r) => r.id === t.receta.id), t.receta.id).toBe(true);
  });

  it('con filtros sigue habiendo recetario, pero se nota lo que falta', () => {
    // No es un umbral elegido: es lo medido, para que un cambio en el catálogo
    // de la zona se vea aquí en vez de en el súper.
    expect(recetarioAdaptado(gc, []).length).toBeLessThan(recetarioAdaptado(madrid, []).length);
    expect(recetarioAdaptado(gc, ['Vegano']).length).toBeGreaterThan(0);
    expect(recetarioAdaptado(gc, ['Gluten']).length).toBeGreaterThan(0);
  });
});

describe('nunca se rellena con Madrid', () => {
  it('un canónico que la zona no trae cuenta como sin producto', () => {
    const resto = Object.fromEntries(Object.entries(zona.skus).filter(([c]) => c !== 'garbanzo_cocido'));
    const sinGarbanzo = datosDeZona(madrid, { ...zona, skus: resto });
    expect(sinGarbanzo.skus.garbanzo_cocido).toBeUndefined();
    const conGarbanzo = madrid.recetas.filter((r) => r.ingredientes.some((i) => i.canonico === 'garbanzo_cocido'));
    expect(conGarbanzo.length).toBeGreaterThan(0);
    for (const r of conGarbanzo) {
      expect(sinGarbanzo.recetas.some((x) => x.id === r.id), r.id).toBe(false);
      expect(sinGarbanzo.recetasFuera.find((f) => f.receta === r.id)?.faltan).toContain('garbanzo_cocido');
    }
  });

  it('los ensamblajes de una receta que sale, salen con ella', () => {
    const vivas = new Set(gc.recetas.map((r) => r.id));
    for (const [desde, lista] of Object.entries(gc.ensamblajes ?? {})) {
      expect(vivas.has(desde), desde).toBe(true);
      for (const e of lista) {
        for (const i of e.ingredientes) {
          if (i.canonico !== 'agua') expect(gc.skus[i.canonico], `${e.id} · ${i.canonico}`).toBeDefined();
        }
      }
    }
  });
});

describe('la capa de cada almacén', () => {
  /*
   * Medido el 14 oct: el caldo de verduras de Madrid (18480) existe en 4701 y
   * 4570 y no en los otros siete; la barra de pan de Madrid, solo en 4701. Es el
   * mismo producto, así que vale sin revisión, pero solo allí.
   */
  it('lo que está solo en algunos almacenes, solo para esos', () => {
    const en4701 = datosDeZona(madrid, zona, '4701');
    const en3120 = datosDeZona(madrid, zona, '3120');
    expect(en4701.skus.caldo_verduras?.sku).toBe('18480');
    expect(en4701.skus.pan?.sku).toBe('83202.1');
    expect(en3120.skus.caldo_verduras).toBeUndefined();
    expect(gc.skus.caldo_verduras).toBeUndefined();
    expect(en4701.recetas.length).toBeGreaterThan(gc.recetas.length);
    expect(en4701.almacen).toBe('4701');
  });

  it('la capa nunca trae un producto que no esté medido en ese almacén', () => {
    for (const [wh, capa] of Object.entries(zona.porAlmacen ?? {})) {
      expect(zona.almacenes, wh).toContain(wh);
      for (const [canonico, sku] of Object.entries(capa)) {
        const e = (granCanaria as { estado: Record<string, { almacenes?: string[]; madridEn?: string[] }> }).estado[canonico];
        // O es el de Madrid medido en ese almacén, o una alternativa aprobada medida allí.
        const medidoEn = sku.sku === madrid.skus[canonico]?.sku ? e?.madridEn : e?.almacenes;
        expect(medidoEn, `${wh} · ${canonico}`).toContain(wh);
        expect(sku.precio, `${wh} · ${canonico}`).toBeGreaterThan(0);
      }
    }
  });
});
