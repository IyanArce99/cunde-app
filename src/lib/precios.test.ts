/**
 * ═══ PRECIOS QUE VIENEN DE FUERA ═══
 *
 * Esto es lo único de la app que se cree algo que no ha calculado ella. Y lo
 * que se cree son los números que sostienen el producto entero: el usuario
 * está delante del lineal comparando lo que dice la app con lo que dice la
 * etiqueta.
 *
 * Así que lo que se prueba no es que funcione cuando todo va bien —eso es lo
 * fácil— sino que NO se aplique cuando el servidor devuelve cualquier cosa: un
 * JSON a medias, precios a cero, medio catálogo movido, una instantánea vieja.
 * En todos esos casos el comportamiento correcto es quedarse con lo de ayer.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  aplicarInstantanea, buscarActualizacion, esInstantanea, guardar, leerGuardada,
} from './precios';
import type { FilaPrecio, Instantanea } from './precios';
import type { DatosMotor, Sku } from '../motor/tipos.ts';

const sku = (precio: number, extra: Partial<Sku> = {}): Sku => ({
  sku: '1', nombre: 'Cosa', contenido: 1, unidad: 'kg', precio, precio_kg_l_ud: precio,
  packaging: 'Paquete', unidades_pack: null, peso_variable: false,
  departamento: 'Dep', subfamilia: 'Sub', ...extra,
} as Sku);

function catalogo(): DatosMotor {
  const skus: Record<string, Sku> = {};
  for (let i = 0; i < 12; i++) skus[`ing${i}`] = sku(2);
  return { generadoEn: '2026-08-01', recetas: [], ingredientes: {}, skus } as unknown as DatosMotor;
}

const instantanea = (skus: Instantanea['skus'], version = '2026-08-07'): Instantanea =>
  ({ version, almacen: 'mad3', skus });

const fila = (precio: number): FilaPrecio => ({
  sku: '1', nombre: 'Cosa', contenido: 1, unidad: 'kg', precio, precio_kg_l_ud: precio,
  packaging: 'Paquete', unidades_pack: null, peso_variable: false,
  departamento: 'Dep', subfamilia: 'Sub',
});

describe('validar lo que llega', () => {
  it('acepta una instantánea buena', () => {
    expect(esInstantanea(instantanea({ ing0: fila(2.5) }))).toBe(true);
  });

  it('rechaza precios a cero o negativos', () => {
    // El caso que de verdad da miedo: un scrape a medias devolviendo ceros y la
    // app diciéndole al usuario que su compra sale gratis.
    expect(esInstantanea(instantanea({ ing0: fila(0) }))).toBe(false);
    expect(esInstantanea(instantanea({ ing0: fila(-1) }))).toBe(false);
  });

  it('rechaza lo que no tiene forma de instantánea', () => {
    for (const x of [null, undefined, 42, 'hola', {}, { version: '' }, { version: '2026-08-07' }]) {
      expect(esInstantanea(x)).toBe(false);
    }
    expect(esInstantanea({ version: '2026-08-07', almacen: 'mad3', skus: { a: { sku: 1 } } })).toBe(false);
  });

  it('rechaza contenido a cero: dividir por él da un precio infinito', () => {
    expect(esInstantanea(instantanea({ ing0: { ...fila(2), contenido: 0 } }))).toBe(false);
  });
});

describe('aplicar', () => {
  it('mete los precios nuevos en el catálogo', () => {
    const d = catalogo();
    const r = aplicarInstantanea(d, instantanea({ ing0: fila(2.5), ing1: fila(1.8) }));
    expect(r.aplicados).toBe(2);
    expect(d.skus.ing0.precio).toBe(2.5);
    expect(d.skus.ing1.precio).toBe(1.8);
    expect(d.skus.ing2.precio).toBe(2);
  });

  it('trae la fila entera, no solo el precio', () => {
    /* Es lo que permite sustituir un producto descatalogado sin publicar una
       versión: cambia el sku, el nombre y el formato de golpe. */
    const d = catalogo();
    aplicarInstantanea(d, instantanea({
      ing0: { ...fila(3), sku: '999', nombre: 'Otro producto', contenido: 0.5 },
    }));
    expect(d.skus.ing0.sku).toBe('999');
    expect(d.skus.ing0.nombre).toBe('Otro producto');
    expect(d.skus.ing0.contenido).toBe(0.5);
  });

  it('rechaza un salto de más del 60% y deja el resto', () => {
    const d = catalogo();
    const r = aplicarInstantanea(d, instantanea({ ing0: fila(20), ing1: fila(2.2) }));
    expect(d.skus.ing0.precio).toBe(2);
    expect(d.skus.ing1.precio).toBe(2.2);
    expect(r.rechazados).toHaveLength(1);
  });

  it('si cambia más de un tercio del catálogo, NO aplica nada', () => {
    /**
     * Un puñado de precios distintos es un martes cualquiera. Un tercio
     * moviéndose de golpe es que algo se ha roto arriba, y ante eso los precios
     * de ayer son mejores que los de nadie.
     */
    const d = catalogo();
    const skus: Instantanea['skus'] = {};
    for (let i = 0; i < 6; i++) skus[`ing${i}`] = fila(2.3);
    const r = aplicarInstantanea(d, instantanea(skus));
    expect(r.descartada).toBe('demasiados-cambios');
    expect(r.aplicados).toBe(0);
    for (let i = 0; i < 12; i++) expect(d.skus[`ing${i}`].precio).toBe(2);
  });

  it('ignora canónicos que este APK no conoce, sin romperse', () => {
    // La instantánea puede venir de un catálogo más nuevo que la app instalada.
    const d = catalogo();
    const r = aplicarInstantanea(d, instantanea({ ing0: fila(2.1), inventado: fila(9) }));
    expect(r.aplicados).toBe(1);
    expect(d.skus.inventado).toBeUndefined();
  });

  it('una instantánea vacía no se aplica', () => {
    const d = catalogo();
    expect(aplicarInstantanea(d, instantanea({})).descartada).toBe('vacia');
  });

  it('el catálogo entero a un céntimo se rechaza línea a línea, sin descartarse', () => {
    /**
     * El caso que destapó la prueba de navegador, y la distinción importa.
     *
     * Todas las líneas se caen por su cuenta en el tope del 60%, así que
     * `descartada` NO se activa: no hay «demasiados cambios» porque no queda
     * ningún cambio bueno que contar. Quien lea el resultado tiene que mirar
     * `aplicados`, no solo `descartada` — mirando solo eso, la app anunciaba la
     * fecha de una instantánea de la que no había aplicado ni una línea.
     */
    const d = catalogo();
    const skus: Instantanea['skus'] = {};
    for (let i = 0; i < 12; i++) skus[`ing${i}`] = fila(0.01);
    const r = aplicarInstantanea(d, instantanea(skus));
    expect(r.descartada).toBeUndefined();
    expect(r.aplicados).toBe(0);
    expect(r.rechazados).toHaveLength(12);
    for (let i = 0; i < 12; i++) expect(d.skus[`ing${i}`].precio).toBe(2);
  });
});

describe('guardar y leer', () => {
  beforeEach(() => localStorage.clear());

  it('lo que se guarda se lee igual', () => {
    const i = instantanea({ ing0: fila(2.5) });
    guardar(i);
    expect(leerGuardada()).toEqual(i);
  });

  it('si lo guardado está corrupto se devuelve null, no se lanza', () => {
    localStorage.setItem('cunde:precios:v1', '{roto');
    expect(leerGuardada()).toBeNull();
  });

  it('lo guardado también se valida al leerlo', () => {
    // Alguien pudo tocar el almacenamiento, o venir de una versión anterior.
    localStorage.setItem('cunde:precios:v1', JSON.stringify({ version: '2026-08-07', skus: { a: {} } }));
    expect(leerGuardada()).toBeNull();
  });
});

describe('buscar actualización', () => {
  it('devuelve la instantánea cuando es más nueva', async () => {
    const i = instantanea({ ing0: fila(2.5) }, '2026-08-07');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => i }));
    expect(await buscarActualizacion('u', '2026-08-01')).toEqual(i);
  });

  it('NO devuelve una más vieja ni la misma', async () => {
    /* Es lo que impide que un caché intermedio le devuelva precios de la semana
       pasada a alguien que ya tiene los de hoy. */
    const i = instantanea({ ing0: fila(2.5) }, '2026-08-01');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => i }));
    expect(await buscarActualizacion('u', '2026-08-07')).toBeNull();
    expect(await buscarActualizacion('u', '2026-08-01')).toBeNull();
  });

  it('sin red devuelve null y NO lanza', async () => {
    // Esto corre en el arranque: una promesa rechazada aquí es una pantalla en
    // blanco por no haber podido consultar un precio.
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('sin red')));
    await expect(buscarActualizacion('u', '2026-08-01')).resolves.toBeNull();
  });

  it('un 500 o un HTML de error no se cuelan', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, json: async () => ({}) }));
    expect(await buscarActualizacion('u', '2026-08-01')).toBeNull();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => '<html>' }));
    expect(await buscarActualizacion('u', '2026-08-01')).toBeNull();
  });
});
