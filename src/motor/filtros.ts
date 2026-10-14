/**
 * ═══ LOS FILTROS DE DIETA Y ALERGIA, EN UN SOLO SITIO ═══
 *
 * Vivían en seleccionar.ts y solo los usaban las recetas: los postres tenían
 * su propia comprobación, que comparaba nombres de filtro y no leía trazas. El
 * yogur Danone de Gran Canaria («puede contener trazas de gluten y frutos de
 * cáscara») lo destapó. Ahora recetas y postres preguntan aquí, con las mismas
 * reglas. Ver postres.ts.
 */
import type { Alergeno, IngredienteCanonico, Origen } from './tipos.ts';

/**
 * Los filtros los gobiernan los DATOS del ingrediente (`origen` y
 * `alergenos` en docs/ingredientes-canonicos.json), no una lista a mano en
 * el código. Con 35 ingredientes la lista se podía mantener; con 100 y varias
 * personas escribiendo recetas, se olvida una y el filtro miente en silencio
 * — que es exactamente lo que pasaba con "sin frutos secos".
 */
/**
 * Un filtro es de ALERGIA o de PREFERENCIA, y la diferencia manda sobre las
 * trazas. "Puede contener trazas de soja" es una advertencia de línea de
 * fábrica: para quien tiene alergia a la soja es motivo suficiente para no
 * comerlo, y para un vegano no significa absolutamente nada. Meterlas en el
 * mismo saco dejaría a un vegano sin pasta por una advertencia que no habla
 * de ingredientes.
 */
export interface Filtro {
  origenes?: Origen[];
  alergeno?: Alergeno;
  tipo: 'alergia' | 'preferencia';
}

export const FILTROS: Record<string, Filtro> = {
  // Preferencia: elegir no comerlo. No miran trazas.
  Vegetariano: { origenes: ['carne', 'pescado', 'marisco'], tipo: 'preferencia' },
  Vegano: { origenes: ['carne', 'pescado', 'marisco', 'huevo', 'lacteo'], tipo: 'preferencia' },
  Cerdo: { alergeno: 'cerdo', tipo: 'preferencia' },

  // Alergia: no poder comerlo. Miran trazas.
  //
  // "Vegetariano" NO sustituye a "sin huevo": uno es preferencia y el otro es
  // salud. Un padre con un hijo alérgico al huevo no puede usar el filtro
  // vegetariano —le quita también la carne— ni fiarse de él, porque no mira
  // las trazas. El huevo es de las alergias infantiles más frecuentes y el
  // recetario tiene 16 platos que lo llevan.
  Huevo: { origenes: ['huevo'], alergeno: 'huevo', tipo: 'alergia' },
  Pescado: { origenes: ['pescado'], alergeno: 'pescado', tipo: 'alergia' },
  Marisco: { origenes: ['marisco'], alergeno: 'marisco', tipo: 'alergia' },
  Gluten: { alergeno: 'gluten', tipo: 'alergia' },
  Lactosa: { alergeno: 'lactosa', tipo: 'alergia' },
  'Frutos secos': { alergeno: 'frutos_secos', tipo: 'alergia' },
  Cacahuete: { alergeno: 'cacahuete', tipo: 'alergia' },
  Sésamo: { alergeno: 'sesamo', tipo: 'alergia' },
  Mostaza: { alergeno: 'mostaza', tipo: 'alergia' },
  Apio: { alergeno: 'apio', tipo: 'alergia' },
  Soja: { alergeno: 'soja', tipo: 'alergia' },
  Sulfitos: { alergeno: 'sulfitos', tipo: 'alergia' },
};

/** Los que son cuestión de salud. La app los agrupa aparte y van primero. */
export const EXCLUSIONES_ALERGIA = Object.entries(FILTROS)
  .filter(([, f]) => f.tipo === 'alergia').map(([n]) => n);

export const EXCLUSIONES_PREFERENCIA = Object.entries(FILTROS)
  .filter(([, f]) => f.tipo === 'preferencia').map(([n]) => n);

/** Las exclusiones que la app ofrece. Debe cuadrar con DIETAS en AjustesSemana. */
export const EXCLUSIONES = Object.keys(FILTROS);

/** ¿Choca ESTE ingrediente con ESTA exclusión? */
export function ingredienteVetado(meta: IngredienteCanonico, filtro: Filtro): boolean {
  if (filtro.origenes?.includes(meta.origen)) return true;
  if (!filtro.alergeno) return false;
  if (meta.alergenos.includes(filtro.alergeno)) return true;
  // Las trazas solo cuentan cuando el filtro es por alergia.
  return filtro.tipo === 'alergia' && (meta.trazas ?? []).includes(filtro.alergeno);
}
