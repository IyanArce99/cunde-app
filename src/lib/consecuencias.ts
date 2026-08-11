import { useEffect, useState } from 'react';
import { datos } from '../data/motor';
import { recetarioAdaptado } from '../motor/seleccionar.ts';
import { presupuestoMinimoViable } from './derive';
import type { Comensales, ComidasPref, Esfuerzo, NivelProteina } from '../state/types';

/**
 * CONSECUENCIAS VIVAS · lo que le pasa a tu semana al tocar cada opción.
 *
 * Un formulario pregunta y calla. Aquí cada respuesta mueve un número en la
 * misma pantalla, así que se ve qué compra cada decisión antes de tomarla.
 *
 * Regla de la casa: el número tiene que ser VERDAD y tiene que MOVERSE. Un dato
 * que no cambia al tocar es adorno, y un dato inventado para que se mueva es
 * peor que no ponerlo. Los dos que hay aquí salen del motor con el catálogo
 * real, los mismos que luego montan la semana.
 */

/**
 * Cuántas recetas sobreviven a los filtros.
 *
 * Es la columna "vivas" de la matriz de cobertura, calculada en vivo. Cuesta
 * 0,25 ms sobre 112 recetas —medido—, así que va en el render sin más.
 */
export function recetasQueTeValen(exclusiones: string[]): number {
  return recetarioAdaptado(datos, exclusiones).length;
}

export const TOTAL_RECETAS = datos.recetas.length;

/**
 * EL UMBRAL DE REPETICIÓN, medido, no elegido a ojo.
 *
 * Fuerza bruta sobre las 575 combinaciones de uno, dos y tres filtros: la peor
 * que existe hoy es "Soja + Sulfitos + Vegano", que deja 17 recetas. Con ese
 * recetario la semana SIGUE MONTANDO —cero huecos vacíos, catorce comidas—,
 * pero baja de 12 platos distintos a 9 y alguno aparece tres veces.
 *
 * Por eso el aviso no dice "no puedo montar la semana": sería mentira, y sería
 * el muro que la regla del proyecto prohíbe. Dice lo único que cambia de
 * verdad, que es que vas a repetir plato.
 */
export const POCAS_RECETAS = 30;

/** Qué contar de las recetas vivas: el número y si empieza a apretar. */
export function estadoDelRecetario(exclusiones: string[]) {
  const vivas = recetasQueTeValen(exclusiones);
  return { vivas, aprieta: vivas < POCAS_RECETAS, total: TOTAL_RECETAS };
}

// ---------------------------------------------------------------------------
// El suelo de presupuesto
// ---------------------------------------------------------------------------

/**
 * Las claves ya calculadas. `presupuestoMinimoViable` guarda su resultado en el
 * caché de derive.ts para siempre, así que basta con saber si ya pasamos por
 * aquí para devolverlo sin parpadeo la segunda vez.
 */
const yaCalculado = new Set<string>();

const claveSuelo = (
  c: Comensales, comidas: ComidasPref, esfuerzo: Esfuerzo, exclusiones: string[], proteina: NivelProteina,
) => `${c}|${comidas}|${esfuerzo}|${[...exclusiones].sort().join(',')}|${proteina}`;

/**
 * LO QUE CUESTA LA SEMANA MÁS BARATA QUE SÉ MONTAR.
 *
 * Es el dato que va bajo "¿cuántos sois?" y se eligió frente a las
 * alternativas obvias —"14 comidas", "x € por persona y día"— por tres cosas:
 *
 *   · Es el que más se mueve: 43 · 52 · 62 · 81 · 92 € de uno a cinco. El
 *     número de comidas no cambia con los comensales y el coste por persona y
 *     día necesita un presupuesto que en esta pantalla todavía no existe.
 *   · Llega a tiempo. El presupuesto por defecto son 65 €, y para cinco el
 *     suelo son 92: hoy eso se descubre una pantalla más tarde, ya con el
 *     deslizador delante. Aquí se sabe al tocar el 5.
 *   · Prepara la pregunta siguiente. Quien llega al deslizador sabiendo el
 *     suelo no lo mueve a ciegas.
 *
 * Cuesta 400-500 ms porque monta una semana entera con el catálogo real. Por
 * eso NO se calcula durante el render: se deja pintar el toque y se calcula
 * después. Mientras tanto la línea enseña puntos, no un cero ni un salto.
 */
export function useSuelo(
  comensales: Comensales,
  comidas: ComidasPref,
  esfuerzo: Esfuerzo,
  exclusiones: string[],
  proteina: NivelProteina,
  postre = false,
): number | null {
  const k = `${claveSuelo(comensales, comidas, esfuerzo, exclusiones, proteina)}|${postre}`;
  const calcular = () => presupuestoMinimoViable(comensales, comidas, esfuerzo, exclusiones, proteina, postre);

  // Si ya se calculó con estos mismos parámetros, sale del caché al instante y
  // no hay estado intermedio: volver atrás no debe parpadear.
  const [suelo, setSuelo] = useState<number | null>(() => (yaCalculado.has(k) ? calcular() : null));

  useEffect(() => {
    if (yaCalculado.has(k)) { setSuelo(calcular()); return; }
    setSuelo(null);
    let vivo = true;
    /**
     * Dos marcos: el primero termina el pintado del toque, el segundo empieza
     * ya con el botón en su estado nuevo. Con un solo rAF el trabajo entra en
     * el mismo marco y el botón tarda medio segundo en verse pulsado.
     */
    const id = requestAnimationFrame(() => requestAnimationFrame(() => {
      const v = calcular();
      yaCalculado.add(k);
      if (vivo) setSuelo(v);
    }));
    return () => { vivo = false; cancelAnimationFrame(id); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [k]);

  return suelo;
}
