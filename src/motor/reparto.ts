import { DIAS } from './tipos.ts';
import type { Ensamblaje, Hueco, Parte, Ranura, Receta, Tanda } from './tipos.ts';

/**
 * Nadie quiere el mismo plato tres veces en una semana. Este tope no sale de
 * ningún dato: es una decisión de producto y por eso está aquí, a la vista y
 * a una línea de cambiarse.
 */
export const TOPE_HARTAZGO = 2;

/** Lo que se tarda en montar un hueco de ensamblaje (rehacer el acompañamiento). */
export const MINUTOS_ENSAMBLAJE = 5;

// --- Dónde puede caer una sobra -------------------------------------------
//
// La regla vieja era "el hueco inmediatamente siguiente", y producía el peor
// caso posible: lentejas a mediodía y lentejas por la noche del mismo día.
// Las tres reglas de abajo lo impiden.

/** Una sobra nunca se come el mismo día que se cocinó. */
export const SEPARACION_MINIMA_DIAS = 1;

/**
 * Y caduca. Sale de `dias_nevera` de la receta, no de una constante única:
 * un potaje aguanta tres días en la nevera y un revuelto no. El umbral de 4
 * días separa el guiso del plato de sartén en el recetario que hay.
 */
export function ventanaDeSobra(receta: Receta): number {
  return receta.dias_nevera >= 4 ? 3 : 2;
}

/**
 * Sábado cena y domingo comida son las dos comidas por las que el usuario
 * juzga la app. Ahí no se comen sobras: se cocina.
 */
export function esFinDeSemanaBueno(dia: string, ranura: Ranura): boolean {
  return (dia === 'SÁB' && ranura === 'cena') || (dia === 'DOM' && ranura === 'comida');
}

/**
 * Si el plato es de mediodía, de noche, o vale para las dos.
 *
 * En España la cena es ligera —tortilla, revuelto, plancha, sopa— y la
 * comida es el plato fuerte. El motor no lo distinguía y programaba un arroz
 * de 45 minutos como cena de domingo, o un potaje de garbanzos de 55 para
 * cenar un viernes. Fue el reproche más repetido al leer las semanas: "casi
 * todas las cenas son otra comida entera".
 *
 * Se DEDUCE de campos que ya existen —técnica, tags y minutos— en vez de
 * pedir una marca nueva en las 90 recetas: una lista escrita a mano es otra
 * cosa que se queda atrás cuando entra un lote nuevo, que es exactamente el
 * fallo que arreglamos con la regla de la sal.
 */
export type Registro = 'comida' | 'cena' | 'ambas';

export function registroDe(receta: Receta): Registro {
  if (receta.tags.includes('cena') || receta.tags.includes('frio')) return 'cena';
  // El huevo a la sartén es cena en España aunque lleve su tiempo: una
  // tortilla de patata son 35 minutos y nadie la llama plato de mediodía.
  if (receta.tags.includes('huevo') && receta.tecnica === 'sarten') return 'cena';
  // Lo que ocupa la olla o el horno mucho rato es plato de mediodía. El
  // límite va solo sobre esas dos técnicas: media hora de sartén no hace
  // pesado un plato.
  if ((receta.tecnica === 'olla' || receta.tecnica === 'horno') && receta.minutos >= 35) return 'comida';
  if (receta.tecnica === 'olla' && receta.tags.includes('legumbre')) return 'comida';
  if (receta.minutos <= 20 && (receta.tecnica === 'sarten' || receta.tags.includes('rapido'))) return 'cena';
  return 'ambas';
}

export interface Posicion {
  dia: string;
  ranura: Ranura;
  diaIndice: number;
}

export function posicionesDeSemana(numHuecos: number): Posicion[] {
  const ranuras: Ranura[] = numHuecos >= 14 ? ['comida', 'cena'] : ['comida'];
  const posiciones: Posicion[] = [];
  DIAS.forEach((dia, diaIndice) => {
    for (const ranura of ranuras) posiciones.push({ dia, ranura, diaIndice });
  });
  return posiciones;
}

/** ¿Tiene alguno de los huecos vecinos esta misma receta? */
export function vecinoRepite(ocupados: (Hueco | null)[], indice: number, recetaId: string): boolean {
  return [indice - 1, indice + 1].some((k) => ocupados[k]?.receta?.id === recetaId);
}

/** ¿Este día ya ha cedido su hueco sin cocinar? */
export function yaTieneSobra(posiciones: Posicion[], ocupados: (Hueco | null)[], diaIndice: number): boolean {
  return posiciones.some(
    (p, k) => p.diaIndice === diaIndice
      && (ocupados[k]?.tipo === 'sobras' || ocupados[k]?.tipo === 'ensamblaje'),
  );
}

/**
 * El hueco donde puede caer la sobra de una tanda cocinada en `origen`:
 * libre, al menos un día después, como mucho dos, y con preferencia por la
 * misma comida del día (la comida del martes antes que su cena).
 * Devuelve null si no hay ninguno — entonces la receta rinde 1 y el motor
 * cocina otra cosa.
 */
export function huecoParaSobra(
  posiciones: Posicion[],
  ocupados: (Hueco | null)[],
  origen: number,
  receta: Receta,
  /**
   * La silueta de la semana: qué días admiten un hueco sin cocinar. Sin ella
   * la sobra caía siempre en el día siguiente a la misma hora y el martes
   * salía 100% recalentado en todas las semanas. Ver siluetaDeSemana().
   */
  diasConSobra?: Set<number>,
): number | null {
  const desde = posiciones[origen];
  const ventana = ventanaDeSobra(receta);
  const candidatos: { indice: number; mismaRanura: boolean; distancia: number }[] = [];

  for (let i = 0; i < posiciones.length; i++) {
    if (ocupados[i]) continue;
    if (esFinDeSemanaBueno(posiciones[i].dia, posiciones[i].ranura)) continue;
    if (diasConSobra && !diasConSobra.has(posiciones[i].diaIndice)) continue;
    // Y un día del conjunto cede UN hueco, no los dos.
    if (yaTieneSobra(posiciones, ocupados, posiciones[i].diaIndice)) continue;
    const distancia = posiciones[i].diaIndice - desde.diaIndice;
    if (distancia < SEPARACION_MINIMA_DIAS || distancia > ventana) continue;
    if (vecinoRepite(ocupados, i, receta.id)) continue;
    candidatos.push({ indice: i, mismaRanura: posiciones[i].ranura === desde.ranura, distancia });
  }

  if (!candidatos.length) return null;
  // Primero la misma comida del día, luego lo más cerca posible.
  candidatos.sort((a, b) => {
    if (a.mismaRanura !== b.mismaRanura) return a.mismaRanura ? -1 : 1;
    return a.distancia - b.distancia || a.indice - b.indice;
  });
  return candidatos[0].indice;
}

// --- Rinde ------------------------------------------------------------------

export function tieneAcompanamiento(receta: Receta): boolean {
  return receta.ingredientes.some((i) => i.parte === 'acompanamiento');
}

/**
 * Cuántos huecos cubre de verdad una tanda. Tres topes y manda el más bajo:
 *   1. lo declarado en la receta (juicio de cocina)
 *   2. lo que aguanta en la nevera (dias_nevera, seguridad alimentaria)
 *   3. TOPE_HARTAZGO (producto)
 */
export function rindeEfectivo(receta: Receta, parte: Parte, numHuecos: number): number {
  const declarado = receta.rinde_huecos[parte] ?? 1;
  const huecosPorDia = numHuecos / DIAS.length;
  const porNevera = Math.max(1, Math.floor(receta.dias_nevera * huecosPorDia));
  return Math.max(1, Math.min(declarado, porNevera, TOPE_HARTAZGO));
}

/**
 * Construye la tanda y decide dónde cae su sobra, si es que puede tenerla.
 * `permiteSobra` lo dicta el nivel de variedad: quien paga por no repetir no
 * quiere sobras, y quien quiere ahorrar las quiere todas.
 */
export interface OpcionesTanda {
  /** Si el nivel de variedad permite gastar un hueco en sobras. */
  permiteSobra: boolean;
  /** Días que admiten hueco sin cocinar. Ver siluetaDeSemana(). */
  diasConSobra?: Set<number>;
  /** El plato que se monta con la sobra, si el recetario tiene uno. */
  ensamblaje?: Ensamblaje;
}

export function planificarTanda(
  receta: Receta,
  numHuecos: number,
  posiciones: Posicion[],
  ocupados: (Hueco | null)[],
  indiceCocinado: number,
  opciones: OpcionesTanda,
): { tanda: Tanda; huecos: Hueco[] } | null {
  const { permiteSobra, diasConSobra, ensamblaje } = opciones;
  if (vecinoRepite(ocupados, indiceCocinado, receta.id)) return null;

  const origen = posiciones[indiceCocinado];
  const huecos: Hueco[] = [{ dia: origen.dia, ranura: origen.ranura, receta, tipo: 'cocinado' }];

  const puedeRendirDos = permiteSobra && rindeEfectivo(receta, 'principal', numHuecos) >= 2;
  const destino = puedeRendirDos
    ? huecoParaSobra(posiciones, ocupados, indiceCocinado, receta, diasConSobra)
    : null;

  if (destino === null) {
    return { tanda: { receta, huecosPrincipal: 1, huecosAcompanamiento: 1 }, huecos };
  }

  // Tres cosas distintas para el segundo hueco, y la diferencia se ve:
  //   ENSAMBLAJE — la tanda de ayer se convierte en otro plato con lo que se
  //                añade hoy (pollo guisado -> pollo con arroz). Cuesta lo
  //                añadido, no cero y no el plato entero.
  //   sobras     — el mismo plato tal cual, recalentado. Cuesta 0.
  //   guarnición — el principal aguanta pero el acompañamiento no, así que se
  //                rehace solo esa parte (es el caso viejo de 'ensamblaje').
  const acompanamiento = tieneAcompanamiento(receta)
    ? Math.min(rindeEfectivo(receta, 'acompanamiento', numHuecos), 2)
    : 2;

  const hueco: Hueco = {
    dia: posiciones[destino].dia,
    ranura: posiciones[destino].ranura,
    receta,
    tipo: ensamblaje || acompanamiento < 2 ? 'ensamblaje' : 'sobras',
    origen: { dia: origen.dia, ranura: origen.ranura },
  };
  if (ensamblaje) hueco.ensamblaje = ensamblaje;
  huecos.push(hueco);

  return {
    tanda: {
      receta,
      huecosPrincipal: 2,
      // Con ensamblaje de verdad el acompañamiento del plato original NO se
      // repite: lo que se añade es la receta del ensamblaje.
      huecosAcompanamiento: ensamblaje ? 1 : acompanamiento,
      ...(ensamblaje ? { ensamblaje } : {}),
    },
    huecos,
  };
}
