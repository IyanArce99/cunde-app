/**
 * ═══ LO QUE NO SE SABE NO SE PRESENTA COMO COMPATIBLE ═══
 *
 * Recetas y postres aplican la misma regla (filtros.ts): con un filtro de
 * ALERGIA, un producto cuya etiqueta no se conoce (`alergenos_desconocidos`)
 * no se ofrece; con uno de preferencia, que va por el origen, sí. Y un producto
 * comprobado con su etiqueta no es desconocido aunque su ficha online no traiga
 * texto.
 */
import { describe, expect, it } from 'vitest';
import datosJson from '../data/motor-datos.json';
import { postrePermitido } from './postres.ts';
import { adaptarReceta, recetarioAdaptado } from './seleccionar.ts';
import type { DatosMotor } from './tipos.ts';

const madrid = datosJson as unknown as DatosMotor;
const usa = (c: string) => madrid.recetas.filter((r) => r.ingredientes.some((i) => i.canonico === c));

describe('recetas con un producto de etiqueta desconocida', () => {
  // La pechuga de pollo de Madrid: su ficha no trae ingredientes ni alérgenos.
  it('la pechuga de Madrid está marcada como desconocida', () => {
    expect(madrid.skus.pechuga_pollo.alergenos_desconocidos).toBe(true);
  });

  it('con un filtro de alergia, sus recetas no se ofrecen', () => {
    const conPechuga = usa('pechuga_pollo');
    expect(conPechuga.length).toBeGreaterThan(0);
    const sinGluten = new Set(recetarioAdaptado(madrid, ['Gluten']).map((r) => r.id));
    for (const r of conPechuga) expect(sinGluten.has(r.id), r.id).toBe(false);
  });

  it('sin filtros, o con uno de preferencia, sí', () => {
    const libre = new Set(recetarioAdaptado(madrid, []).map((r) => r.id));
    const sinCerdo = new Set(recetarioAdaptado(madrid, ['Cerdo']).map((r) => r.id));
    for (const r of usa('pechuga_pollo')) {
      expect(libre.has(r.id), r.id).toBe(true);
      if (!r.ingredientes.some((i) => madrid.ingredientes[i.canonico].alergenos.includes('cerdo'))) {
        expect(sinCerdo.has(r.id), r.id).toBe(true);
      }
    }
  });

  it('una especia de despensa desconocida se quita del plato, no tumba la receta', () => {
    // El romero: despensa, sublineal o fijo, y etiqueta desconocida.
    expect(madrid.skus.romero.alergenos_desconocidos).toBe(true);
    const r = usa('romero').find((x) => x.ingredientes.every((i) => i.canonico === 'romero' || !madrid.skus[i.canonico]?.alergenos_desconocidos));
    if (!r) return; // hoy todas las que lo usan llevan otro desconocido
    const a = adaptarReceta(r, ['Gluten'], Infinity, madrid.ingredientes, madrid.skus);
    expect(a?.omitidos).toContain('romero');
  });
});

describe('desconocido no es lo mismo que comprobado sin alérgenos', () => {
  it('la cebolla, sin texto en su ficha pero verificada con la foto de su etiqueta, no es desconocida', () => {
    expect(madrid.skus.cebolla.alergenos_desconocidos).toBeUndefined();
    const sinGluten = new Set(recetarioAdaptado(madrid, ['Gluten']).map((r) => r.id));
    const soloCebolla = usa('cebolla').filter((r) => r.ingredientes.every((i) => !madrid.skus[i.canonico]?.alergenos_desconocidos
      && !madrid.ingredientes[i.canonico].alergenos.includes('gluten') && !(madrid.ingredientes[i.canonico].trazas ?? []).includes('gluten')));
    expect(soloCebolla.length).toBeGreaterThan(0);
    for (const r of soloCebolla) expect(sinGluten.has(r.id), r.id).toBe(true);
  });
});

describe('recetas y postres, la misma regla', () => {
  it('un producto desconocido sale igual en una receta que en un postre', () => {
    const pechuga = madrid.skus.pechuga_pollo;
    const receta = usa('pechuga_pollo')[0];
    const platano = madrid.ingredientes.postre_platano;
    for (const ex of [['Gluten'], ['Soja'], ['Vegetariano'], []]) {
      const recetaVale = adaptarReceta(receta, ex, Infinity, madrid.ingredientes, madrid.skus) !== null;
      const postreVale = postrePermitido(platano, madrid.skus.postre_platano, ex);
      const alergia = ex.length > 0 && ex[0] !== 'Vegetariano';
      expect(postreVale, `postre ${ex}`).toBe(!alergia);
      if (ex[0] !== 'Vegetariano') expect(recetaVale, `receta ${ex}`).toBe(!alergia || !pechuga.alergenos_desconocidos);
    }
  });
});
