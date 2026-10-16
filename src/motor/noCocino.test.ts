/**
 * ═══ «NO COCINO ESTE DÍA» QUITA UNA COMIDA, NO ENCARECE LA COMPRA ═══
 *
 * El caso que lo motivó (catalogo/_aud-no-cocino.ts): 2 personas, 65 €,
 * semana de lunes; liberar la sobra del miércoles cambiaba las alubias del
 * lunes por un potaje con bacalao y la compra pasaba de 54,32 € a 69,44 €,
 * fuera del presupuesto.
 *
 * Desde el 14 oct 2026 esa semana sale por 54,23 €: las conservas se cuentan
 * por su peso escurrido (catalogo/escurridos.ts) y la fruta y la verdura por
 * lo que pesa hoy la pieza (catalogo/piezas.ts). El caso sigue siendo el
 * mismo; cambia la cifra de partida.
 *
 * Regla: con los mismos precios y la misma despensa, quitar una comida sin
 * sustituir las demás no puede subir la compra, y los platos de los otros
 * días se quedan. Se comprueba sobre BARRIDOS, no sobre un caso.
 */

import { describe, expect, it } from 'vitest';
import datosJson from '../data/motor-datos.json';
import { existenciasTrasLaSemana } from './carrito.ts';
import {
  cocinarHueco, generarSemana, liberarHueco, nutricionDe, recetarioAdaptado, rehacerDesde, repararHueco,
  GRAMOS_POR_NIVEL,
} from './seleccionar.ts';
import type { PeticionSemana, SemanaGenerada, Variedad } from './seleccionar.ts';
import type { DatosMotor, Hueco } from './tipos.ts';

const datos = datosJson as unknown as DatosMotor;
const LUNES = ['LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB', 'DOM'];
const BASE: PeticionSemana = {
  datos, N: 2, numHuecos: 14, presupuesto: 65, variedad: 'normal', proteina: 'normal',
  esfuerzo: 'libre', exclusiones: [], semanaNumero: 1, ordenDias: LUNES,
};

const caja = (s: SemanaGenerada) => s.carrito.totalCarrito;
const clave = (h: Hueco) => `${h.tipo}:${h.receta?.id ?? '-'}`;

/** Lo que tiene que cumplir cualquier «no cocino», sobre cualquier semana. */
function comprobarLiberar(peticion: PeticionSemana, s: SemanaGenerada, i: number, que: string) {
  const r = liberarHueco(peticion, s, i);
  const etiqueta = `${que} · hueco ${i} (${clave(s.huecos[i])})`;

  // 1 · la compra no sube
  expect(caja(r), `${etiqueta}: ${caja(s)} → ${caja(r)} €`).toBeLessThanOrEqual(caja(s) + 0.005);
  // 2 · el hueco queda libre
  expect(r.huecos[i].tipo, etiqueta).toBe('libre');
  // 3 · los demás días conservan su plato; como mucho, la sobra de la misma
  //     tanda pasa a cocinarse (mismo plato) o el ensamblaje a plato base
  const receta = s.huecos[i].receta?.id;
  r.huecos.forEach((h, k) => {
    if (k === i) return;
    if (clave(h) === clave(s.huecos[k])) return;
    expect(h.receta?.id, `${etiqueta}: cambió el plato de ${h.dia} ${h.ranura}`).toBe(receta);
    expect(h.tipo, `${etiqueta}: ${h.dia} ${h.ranura}`).toBe('cocinado');
  });
  // 4 · `cuadra` dice la verdad
  const nut = nutricionDe(r.huecos, datos, peticion.N, GRAMOS_POR_NIVEL[peticion.proteina ?? 'normal']);
  expect(r.cuadra, etiqueta).toBe(caja(r) <= (peticion.presupuesto ?? Infinity) && nut.cumpleSuelo);
  // 5 · ninguna tanda sin hueco y ningún hueco con plato sin tanda
  const recetasConHueco = new Set(r.huecos.filter((h) => h.receta).map((h) => h.receta!.id));
  for (const t of r.tandas) expect(recetasConHueco.has(t.receta.id), `${etiqueta}: tanda huérfana`).toBe(true);
  for (const id of recetasConHueco) expect(r.tandas.some((t) => t.receta.id === id), `${etiqueta}: hueco sin tanda`).toBe(true);
  return r;
}

describe('no cocino · el caso que lo destapó', () => {
  /* 54,23 € hasta el 15 oct 2026; con el lote de Gran Canaria en el recetario
     (docs/recetas/lote-gran-canaria.json) la semana base de Madrid sale a
     53,93 €; con el envase compartido y los plazos por horas (16 oct),
     51,85 €; con los envases abiertos contados sesión a sesión —lo que queda
     de un bote solo vale dentro de las horas de su ficha— (16 oct), 54,15 €.
     Lo que se comprueba no cambia: liberar no sube la compra. */
  it('2 personas, 65 €, semana de lunes: liberar la sobra del miércoles no sube de 54,15 €', () => {
    const s = generarSemana(BASE);
    expect(caja(s)).toBe(54.15);
    const i = s.huecos.findIndex((h) => h.dia === 'MIÉ' && h.ranura === 'comida');
    expect(s.huecos[i].tipo).toBe('sobras');
    const r = comprobarLiberar(BASE, s, i, 'caso');
    expect(caja(r)).toBeLessThanOrEqual(54.15);
    expect(r.cuadra).toBe(true);
    // El lunes sigue siendo el mismo plato.
    expect(r.huecos[0].receta?.id).toBe(s.huecos[0].receta?.id);
  });

  it('y por los caminos de la app (repararHueco y rehacerDesde) da lo mismo', () => {
    const s = generarSemana(BASE);
    const i = s.huecos.findIndex((h) => h.dia === 'MIÉ' && h.ranura === 'comida');
    const a = liberarHueco(BASE, s, i);
    expect(repararHueco(BASE, s, i, 'libre')!.huecos.map(clave)).toEqual(a.huecos.map(clave));
    expect(rehacerDesde(BASE, s, i, 'libre').huecos.map(clave)).toEqual(a.huecos.map(clave));
  });
});

describe('no cocino · barrido de huecos', () => {
  const VARIEDADES: Variedad[] = ['poca', 'normal', 'mucha'];

  it('ningún hueco de ninguna semana sube la compra al liberarlo', () => {
    for (const variedad of VARIEDADES) {
      for (const semanaNumero of [1, 2, 3]) {
        const p = { ...BASE, variedad, semanaNumero };
        const s = generarSemana(p);
        for (let i = 0; i < s.huecos.length; i++) comprobarLiberar(p, s, i, `${variedad} sem ${semanaNumero}`);
      }
    }
  });

  it('cubre comidas independientes, tandas con sobra y ensamblajes', () => {
    /* Que el barrido de arriba no pase por no encontrar los casos difíciles. */
    const tipos = new Set<string>();
    let conSobraCocinada = 0;
    for (const variedad of VARIEDADES) {
      for (const semanaNumero of [1, 2, 3]) {
        const s = generarSemana({ ...BASE, variedad, semanaNumero });
        for (const h of s.huecos) tipos.add(h.tipo);
        conSobraCocinada += s.huecos.filter((h) => h.tipo === 'cocinado'
          && s.huecos.some((x) => x.origen?.dia === h.dia && x.origen?.ranura === h.ranura)).length;
      }
    }
    expect([...tipos].sort()).toEqual(['cocinado', 'ensamblaje', 'sobras']);
    expect(conSobraCocinada).toBeGreaterThan(0);
  });

  it('con postre: el postre de la comida que no se hace deja de comprarse', () => {
    const p = { ...BASE, N: 3, presupuesto: 80, postre: true };
    const s = generarSemana(p);
    const raciones = (x: SemanaGenerada) => x.postres.reduce((a, r) => a + r.raciones, 0);
    expect(raciones(s)).toBe(14 * 3);
    for (let i = 0; i < s.huecos.length; i++) {
      const r = comprobarLiberar(p, s, i, 'postre');
      expect(raciones(r), `hueco ${i}`).toBe(13 * 3);
    }
  });

  it('con despensa: lo que hay en casa no cambia la regla', () => {
    const s1 = generarSemana(BASE);
    const p = {
      ...BASE, semanaNumero: 2, existencias: existenciasTrasLaSemana(s1.carrito),
      recetasRecientes: [[...new Set(s1.tandas.map((t) => t.receta.id))]],
    };
    const s = generarSemana(p);
    expect(s.carrito.totalDelArmario).toBeGreaterThan(0);
    for (let i = 0; i < s.huecos.length; i++) comprobarLiberar(p, s, i, 'despensa');
  });

  it('con filtros: lo que queda sigue respetándolos', () => {
    const p = { ...BASE, exclusiones: ['Vegano', 'Gluten'] };
    const permitidas = new Set(recetarioAdaptado(datos, p.exclusiones).map((r) => r.id));
    const s = generarSemana(p);
    for (let i = 0; i < s.huecos.length; i++) {
      const r = comprobarLiberar(p, s, i, 'vegano sin gluten');
      for (const t of r.tandas) expect(permitidas.has(t.receta.id)).toBe(true);
    }
  });

  it('liberar dos días seguidos tampoco sube, y un hueco ya libre no cambia nada', () => {
    const s = generarSemana(BASE);
    const r1 = liberarHueco(BASE, s, 3);
    const r2 = comprobarLiberar(BASE, r1, 8, 'segundo');
    expect(caja(r2)).toBeLessThanOrEqual(caja(s) + 0.005);
    expect(liberarHueco(BASE, r2, 3)).toBe(r2);
  });
});

describe('volver a cocinar un día libre', () => {
  it('rellena solo ese hueco y deja el resto como estaba, en los tres niveles de variedad', () => {
    for (const [variedad, semanaNumero] of [['poca', 1], ['normal', 1], ['normal', 2], ['normal', 3], ['mucha', 1], ['mucha', 2]] as const) {
      const p = { ...BASE, variedad, semanaNumero };
      const s = generarSemana(p);
      for (const i of [0, 4, 9, 13]) {
        const libre = liberarHueco(p, s, i);
        const vuelta = cocinarHueco(p, libre, i);
        expect(vuelta, `${variedad} sem ${semanaNumero} hueco ${i}`).not.toBeNull();
        expect(vuelta!.huecos[i].tipo, `sem ${semanaNumero} hueco ${i}`).toBe('cocinado');
        vuelta!.huecos.forEach((h, k) => {
          if (k !== i) expect(clave(h), `sem ${semanaNumero} hueco ${i} → ${k}`).toBe(clave(libre.huecos[k]));
        });
        const nut = nutricionDe(vuelta!.huecos, datos, p.N, GRAMOS_POR_NIVEL.normal);
        expect(vuelta!.cuadra).toBe(caja(vuelta!) <= 65 && nut.cumpleSuelo);
        expect(vuelta!.huecos.filter((h) => h.tipo === 'libre')).toHaveLength(0);
      }
    }
  });

  it('sobre un hueco con plato no hace nada', () => {
    const s = generarSemana(BASE);
    expect(cocinarHueco(BASE, s, 0)).toBeNull();
    expect(rehacerDesde(BASE, s, 0, 'cocinar')).toBe(s);
  });
});
