/**
 * ═══ LOS POSTRES SE FILTRAN COMO LAS RECETAS ═══
 *
 * Hasta el 14 oct, `permitido` (postres.ts) comparaba el alérgeno del postre con
 * el nombre del filtro y no leía trazas. El yogur Danone de Gran Canaria
 * («puede contener trazas de gluten y frutos de cáscara») habría llegado a
 * quien filtra gluten. Ahora la regla es `ingredienteVetado` (filtros.ts), la de
 * las recetas, sobre el producto concreto de la zona; y lo que no se sabe de un
 * producto no se trata como «sin alérgenos».
 */
import { describe, expect, it } from 'vitest';
import datosJson from '../data/motor-datos.json';
import { cartaDePostres, planDePostres, postrePermitido } from './postres.ts';
import { EXCLUSIONES, generarSemana } from './seleccionar.ts';
import { datosDeZona } from './zona.ts';
import type { CatalogoZona } from './zona.ts';
import type { DatosMotor, IngredienteCanonico } from './tipos.ts';

const madrid = datosJson as unknown as DatosMotor;
const ids = (d: DatosMotor, ex: string[]) => cartaDePostres(d, ex).map((x) => x.ing.id);
/** ¿Vale este postre con estas exclusiones? La carta solo lleva cuatro, por precio: no estar no es estar excluido. */
const vale = (d: DatosMotor, id: string, ex: string[]) => postrePermitido(d.ingredientes[id], d.skus[id], ex);
/** Una copia de Madrid con un ingrediente de postre cambiado. */
const conIngrediente = (id: string, cambio: Partial<IngredienteCanonico>): DatosMotor => ({
  ...madrid,
  ingredientes: { ...madrid.ingredientes, [id]: { ...madrid.ingredientes[id], ...cambio } },
});

describe('todos los postres de hoy', () => {
  const postres = Object.values(madrid.ingredientes).filter((i) => (i as { es_postre?: boolean }).es_postre);

  it('declaran sus alérgenos con las claves de la app, no con el nombre del filtro', () => {
    const claves = new Set(['gluten', 'lactosa', 'frutos_secos', 'cacahuete', 'huevo', 'pescado', 'marisco', 'soja', 'sesamo', 'mostaza', 'apio', 'sulfitos', 'cerdo']);
    expect(postres.length).toBe(6);
    for (const p of postres) {
      for (const a of [...p.alergenos, ...(p.trazas ?? [])]) expect(claves.has(a), `${p.id}: «${a}»`).toBe(true);
    }
  });

  it('cada uno sale exactamente para los filtros que tocan su alérgeno', () => {
    // Recorre todas las exclusiones de la app, una a una, sobre los seis postres.
    for (const p of postres) {
      const sku = madrid.skus[p.id];
      for (const ex of EXCLUSIONES) {
        const vale = postrePermitido(p, sku, [ex]);
        const deberia = !(
          (ex === 'Lactosa' && p.alergenos.includes('lactosa'))
          || (ex === 'Huevo' && p.alergenos.includes('huevo'))
          || (ex === 'Soja' && p.alergenos.includes('soja'))
          || ((ex === 'Vegetariano' || ex === 'Vegano' || ex === 'Cerdo') && (p as { postre_no_vegetariano?: boolean }).postre_no_vegetariano)
          || (ex === 'Vegano' && p.origen === 'lacteo')
          // El plátano: ficha sin ingredientes ni alérgenos → desconocido.
          // Con un filtro de ALERGIA no se ofrece; uno de preferencia va por origen.
          || (sku.alergenos_desconocidos === true && ['Gluten', 'Lactosa', 'Frutos secos', 'Cacahuete', 'Sésamo', 'Mostaza', 'Apio', 'Soja', 'Sulfitos', 'Huevo', 'Pescado', 'Marisco'].includes(ex))
        );
        expect(vale, `${p.id} con «${ex}»`).toBe(deberia);
      }
    }
  });
});

describe('alérgeno y traza declarados', () => {
  it('alérgeno declarado: las natillas valen sin filtros y salen con «Lactosa»', () => {
    expect(vale(madrid, 'postre_natillas', [])).toBe(true);
    expect(vale(madrid, 'postre_natillas', ['Lactosa'])).toBe(false);
  });

  it('traza declarada: sale con el filtro de alergia, no con uno sin relación', () => {
    const d = conIngrediente('postre_manzana', { trazas: ['gluten'] });
    expect(vale(d, 'postre_manzana', [])).toBe(true);
    expect(vale(d, 'postre_manzana', ['Gluten'])).toBe(false);
    expect(vale(d, 'postre_manzana', ['Lactosa'])).toBe(true);
  });

  it('una traza no cuenta para una preferencia: la de cerdo no aparta a quien no come cerdo', () => {
    const d = conIngrediente('postre_manzana', { trazas: ['cerdo'] });
    expect(vale(d, 'postre_manzana', ['Cerdo'])).toBe(true);
  });
});

describe('el producto concreto de la zona', () => {
  /*
   * Mismo canónico, distinto producto: en Madrid, yogur natural Hacendado (sin
   * trazas); en Gran Canaria, yogur natural Danone, con trazas de gluten y frutos
   * de cáscara que se suman SOLO allí (Sku.trazas_zona → src/motor/zona.ts).
   */
  const gc: CatalogoZona = {
    zona: 'gran-canaria', nombre: 'Gran Canaria', cadena: 'mercadona', almacenes: ['3120'], version: '2026-10-14', porAlmacen: {},
    skus: {
      ...madrid.skus,
      postre_yogur_natural: { ...madrid.skus.postre_yogur_natural, sku: '20087', nombre: 'Yogur natural Danone', trazas_zona: ['gluten', 'frutos_secos'] },
    },
  };
  const enGC = datosDeZona(madrid, gc);

  it('en Madrid el yogur vale para quien filtra gluten; en Gran Canaria, no', () => {
    expect(vale(madrid, 'postre_yogur_natural', ['Gluten'])).toBe(true);
    expect(vale(enGC, 'postre_yogur_natural', ['Gluten'])).toBe(false);
    expect(vale(enGC, 'postre_yogur_natural', ['Frutos secos'])).toBe(false);
  });

  it('y en Gran Canaria sigue valiendo para quien no filtra nada', () => {
    expect(vale(enGC, 'postre_yogur_natural', [])).toBe(true);
  });
});

describe('información desconocida', () => {
  it('el plátano, sin ingredientes ni alérgenos en su ficha, está marcado como desconocido', () => {
    expect(madrid.skus.postre_platano.alergenos_desconocidos).toBe(true);
  });

  it('no se trata como «sin alérgenos»: con cualquier filtro de alergia NO se ofrece, aunque sea fruta', () => {
    for (const ex of ['Gluten', 'Frutos secos', 'Lactosa', 'Soja']) {
      expect(vale(madrid, 'postre_platano', [ex]), ex).toBe(false);
    }
  });

  it('pero un filtro de preferencia, que va por el origen, no depende de la etiqueta', () => {
    expect(vale(madrid, 'postre_platano', ['Vegetariano'])).toBe(true);
    expect(vale(madrid, 'postre_platano', ['Cerdo'])).toBe(true);
    expect(vale(madrid, 'postre_platano', [])).toBe(true);
  });
});

describe('ningún postre compatible', () => {
  // Sin manzana en esta zona, y con filtros que tumban los otros cinco.
  const sinManzana: DatosMotor = { ...madrid, skus: Object.fromEntries(Object.entries(madrid.skus).filter(([c]) => c !== 'postre_manzana')) };
  const ex = ['Lactosa', 'Soja', 'Vegetariano', 'Gluten'];

  it('la carta queda vacía: la garantía de fruta no mete una incompatible', () => {
    expect(cartaDePostres(sinManzana, ex)).toEqual([]);
    expect(planDePostres(sinManzana, ex, 2, 14)).toEqual([]);
  });

  it('y la semana sale sin postre ni producto de postre en la compra', () => {
    const s = generarSemana({
      datos: sinManzana, N: 2, numHuecos: 14, presupuesto: 90, variedad: 'normal', proteina: 'normal',
      esfuerzo: 'libre', exclusiones: ex, semanaNumero: 1, postre: true,
    });
    expect(s.postres).toEqual([]);
    const dePostre = new Set(Object.entries(madrid.skus).filter(([c]) => c.startsWith('postre_')).map(([, x]) => x.sku));
    for (const l of s.carrito.lineas) {
      // El yogur natural de las recetas comparte SKU con el de postre: lo que se
      // mira es que ninguna línea venga del postre.
      expect(l.canonicos.some((c) => c.startsWith('postre_')), l.nombre).toBe(false);
    }
    expect(dePostre.size).toBeGreaterThan(0);
  });

  it('con un solo postre compatible, la carta es ese y nada más', () => {
    expect(ids(madrid, ex)).toEqual(['postre_manzana']);
  });
});
