/**
 * ═══ DE QUÉ VIVE LA SEMANA ═══
 *
 * Doce recetas distintas no son doce platos distintos si once salen del mismo
 * garbanzo. Medido antes de PENAL_FUENTE_REPETIDA: sin filtros, el trío de
 * fuentes más repetido cubría 7 de los 12 platos; en vegano, 9,6.
 *
 * Esto vigila que la penalización siga puesta y siga funcionando, y sobre todo
 * los dos límites que le encontramos por el camino:
 *
 *   · No puede ganarle a una instrucción explícita del usuario. Marcar un plato
 *     como favorito tiene que seguir sirviendo (eso lo cubre además
 *     preferencias.test.tsx, que es quien cazó el fallo).
 *   · No puede hundir la proteína por debajo de lo razonable persiguiendo
 *     variedad. En vegano la tensión es real: las fuentes que más aportan son
 *     justo las que se repiten.
 */

import { describe, expect, it } from 'vitest';
import datosJson from '../data/motor-datos.json';
import { generarSemana, nutricionDe } from './seleccionar.ts';
import type { DatosMotor } from './tipos.ts';

const datos = datosJson as unknown as DatosMotor;
/** El mismo umbral que usa el motor para decidir qué define un plato. */
const PROTEINA_QUE_DEFINE = 8;

const BASE = {
  datos, N: 2, numHuecos: 14, presupuesto: 90,
  variedad: 'mucha', proteina: 'normal', esfuerzo: 'libre',
} as const;

/** De qué fuente vive cada tanda, contado por familia como hace el motor. */
function tandasPorFuente(exclusiones: string[], semanaNumero: number): Map<string, number> {
  const s = generarSemana({ ...BASE, exclusiones, semanaNumero });
  const cuenta = new Map<string, number>();
  for (const t of s.tandas) {
    const vistas = new Set<string>();
    for (const ing of t.receta.ingredientes) {
      const meta = datos.ingredientes[ing.canonico];
      if (!meta || meta.es_despensa) continue;
      if ((meta.proteina_g_por_100 ?? 0) < PROTEINA_QUE_DEFINE) continue;
      vistas.add(ing.canonico.split('_')[0]);
    }
    for (const v of vistas) cuenta.set(v, (cuenta.get(v) ?? 0) + 1);
  }
  return cuenta;
}

const top = (c: Map<string, number>, n: number) =>
  [...c.values()].sort((a, b) => b - a).slice(0, n).reduce((a, b) => a + b, 0);

describe('la semana no vive de tres ingredientes', () => {
  it('sin filtros, el trío más repetido cubre de media menos de 5,4 platos', () => {
    /* Medido el 13 oct 2026 sobre las cinco semanas: 4,8 de media con la
       penalización (7, 4, 3, 5, 5) y 6,0 sin ella (7, 5, 6, 6, 6). El 5,4 es el
       punto medio, así que quitarla o dejarla a cero rompe este test — que es
       para lo que está.

       Antes exigía «ninguna semana por encima de 6», con 5,0 y 7,0 de medias.
       Dejó de valer al salir la quinoa del lineal y entrar el cuscús: la
       semana 1 da 7 CON y SIN penalización, porque usa 17 fuentes distintas y
       tres de sus tandas llevan huevo. Un límite por semana ahí ya no
       distingue si la penalización está puesta, y la media sí. El tope por
       semana se queda en 7 para cazar un colapso de verdad. */
    const trios = [1, 2, 3, 4, 5].map((semanaNumero) => top(tandasPorFuente([], semanaNumero), 3));
    for (const t of trios) expect(t).toBeLessThanOrEqual(7);
    expect(trios.reduce((a, b) => a + b, 0) / trios.length).toBeLessThanOrEqual(5.4);
  });

  it('y usa al menos ocho fuentes distintas', () => {
    for (const semanaNumero of [1, 2, 3]) {
      expect(tandasPorFuente([], semanaNumero).size).toBeGreaterThanOrEqual(8);
    }
  });

  it('con filtros duros sigue repartiendo lo que puede', () => {
    /**
     * Vegano es el caso estrecho de verdad: el lineal barato son cuatro
     * legumbres, soja y tofu. No se le exige lo mismo —sería exigirle al motor
     * algo que el catálogo no tiene— pero sí que no colapse en dos fuentes.
     */
    for (const exclusiones of [['Vegano'], ['Vegano', 'Gluten'], ['Vegetariano']]) {
      for (const semanaNumero of [1, 2]) {
        expect(tandasPorFuente(exclusiones, semanaNumero).size).toBeGreaterThanOrEqual(5);
      }
    }
  });
});

describe('la variedad no se cobra en proteína', () => {
  it('la semana sigue llegando a su suelo sin filtros', () => {
    for (const semanaNumero of [1, 2, 3]) {
      const s = generarSemana({ ...BASE, exclusiones: [], semanaNumero });
      expect(nutricionDe(s.huecos, datos, 2, 55).proteinaPorPersonaDia).toBeGreaterThanOrEqual(53);
    }
  });

  it('y en vegano no baja de 50 g, que es donde estaba antes de tocar nada', () => {
    /* 55 g es el suelo del nivel «normal» y en vegano ya se rozaba antes de
       esto. Lo que este test impide es que la variedad lo hunda: a peso 3 caía
       a 52 y a peso 6 a 49. Ver PENAL_FUENTE_REPETIDA. */
    for (const semanaNumero of [1, 2, 3]) {
      const s = generarSemana({ ...BASE, exclusiones: ['Vegano'], semanaNumero });
      expect(nutricionDe(s.huecos, datos, 2, 55).proteinaPorPersonaDia).toBeGreaterThanOrEqual(50);
    }
  });
});
