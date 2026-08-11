import { datos } from '../data/motor';
import type { Plato } from '../state/types';

/**
 * ═══ QUÉ TE PARECE UN PLATO ═══
 *
 * Tres estados y no cinco estrellas. Una escala de 1 a 5 le pide al usuario que
 * calibre —¿esto es un 3 o un 4?— y a cambio nos da un número que no sabemos
 * usar: el motor no necesita saber cuánto le gusta algo, necesita saber si lo
 * pone o no lo pone. Las tres opciones son exactamente las tres decisiones que
 * el motor puede tomar.
 *
 * Y no es una nota: es una instrucción. "No me lo vuelvas a poner" no dice que
 * el plato sea malo, dice qué tiene que hacer la app.
 */
export type ValoracionPlato = 'me_gusta' | 'neutral' | 'no_quiero';

export interface PreferenciaPlato {
  platoId: string;
  /**
   * `neutral` no se guarda nunca: borra la entrada. Un mapa donde "no opino"
   * ocupa sitio crece hasta el tamaño del recetario, hay que filtrarlo en cada
   * lectura, y no distingue "he dicho que me da igual" de "no he dicho nada" —
   * que para el motor son lo mismo.
   */
  valoracion: Exclude<ValoracionPlato, 'neutral'>;
  /** ISO-8601. Solo para poder ordenar la lista de bloqueados por lo último. */
  actualizadaEn: string;
}

export type PreferenciasPlatos = Record<string, PreferenciaPlato>;

/**
 * ═══ QUÉ SE VALORA CUANDO SE VALORA UN PLATO ═══
 *
 * El usuario toca un hueco de la semana, pero un hueco no siempre es un plato
 * distinto. Los cuatro casos:
 *
 *   cocinado    → la receta. Lo obvio.
 *   sobras      → la receta TAMBIÉN. Es el mismo plato recalentado, y valorarlo
 *                 aparte haría que "no me lo vuelvas a poner" en el martes no
 *                 quitara el lunes que lo cocina. Peor: el usuario vería que la
 *                 app le sigue poniendo lo que acaba de rechazar.
 *   ensamblaje  → depende. Si tiene nombre propio ("Garbanzos salteados con
 *                 huevo") es OTRO plato a ojos de quien lo come, con su receta,
 *                 sus minutos y su precio, y se valora aparte. Si no lo tiene,
 *                 la app lo enseña con el nombre del plato original y valorarlo
 *                 aparte sería pedir opinión sobre algo que el usuario no
 *                 distingue.
 *   libre       → no hay nada que valorar.
 *
 * Devuelve `null` cuando no se puede valorar, y quien llama pinta o no pinta la
 * sección según eso. No hay estado intermedio.
 */
export function identidadDePlato(plato: Plato | null): { id: string; tipo: 'receta' | 'ensamblaje' } | null {
  if (!plato) return null;
  if (plato.ensamblajeId) return { id: plato.ensamblajeId, tipo: 'ensamblaje' };
  if (!plato.recetaId) return null;
  return { id: plato.recetaId, tipo: 'receta' };
}

/** Lo que el usuario ha dicho de este plato. `neutral` si no ha dicho nada. */
export function valoracionDe(preferencias: PreferenciasPlatos, plato: Plato | null): ValoracionPlato {
  const id = identidadDePlato(plato)?.id;
  if (!id) return 'neutral';
  return preferencias[id]?.valoracion ?? 'neutral';
}

/**
 * Aplica una valoración. `neutral` borra, el resto escribe.
 *
 * Devuelve el mapa nuevo, o EL MISMO objeto si no cambia nada — así el reducer
 * puede comparar por identidad y no regenerar la semana por un toque que no
 * cambia el estado.
 */
export function conValoracion(
  preferencias: PreferenciasPlatos,
  platoId: string,
  valoracion: ValoracionPlato,
  ahora: string,
): PreferenciasPlatos {
  const actual = preferencias[platoId]?.valoracion;
  if (valoracion === 'neutral') {
    if (!actual) return preferencias;
    const { [platoId]: _fuera, ...resto } = preferencias;
    return resto;
  }
  if (actual === valoracion) return preferencias;
  return { ...preferencias, [platoId]: { platoId, valoracion, actualizadaEn: ahora } };
}

/**
 * Los ids que el motor NO puede poner.
 *
 * Van aparte de `exclusiones` en todo el camino hasta el motor, y no es una
 * manía de tipos: una alergia y un "no me gusta el pescado azul" se parecen en
 * el efecto y no se parecen en nada más. La alergia mira trazas, no se puede
 * saltar nunca ni para completar la semana, y cuando bloquea el recetario el
 * diagnóstico tiene que ofrecer quitarla sabiendo lo que ofrece. El gusto se
 * puede desbloquear de un toque y su salida es otra frase.
 *
 * Mezclarlos habría hecho que la pantalla de "no me salen las cuentas" dijera
 * «quita el marisco y salen 14 comidas» cuando el problema real es que has
 * bloqueado cuarenta platos.
 */
export function platosBloqueados(preferencias: PreferenciasPlatos): string[] {
  return Object.values(preferencias).filter((p) => p.valoracion === 'no_quiero').map((p) => p.platoId);
}

/** Los ids que el motor prefiere poner, si todo lo demás da igual. */
export function platosFavoritos(preferencias: PreferenciasPlatos): string[] {
  return Object.values(preferencias).filter((p) => p.valoracion === 'me_gusta').map((p) => p.platoId);
}

/**
 * ═══ LOS BLOQUEADOS, CON NOMBRE, PARA PODER ENSEÑARLOS ═══
 *
 * Es el único sitio de la app que traduce un id a un nombre visible, y va en
 * una sola dirección: id → nombre. Nunca al revés. Buscar la receta por su
 * nombre es lo que este cambio venía a evitar.
 *
 * ═══ LOS IDS QUE YA NO EXISTEN ═══
 *
 * Una receta puede haberse retirado del recetario, o venir de una versión con
 * otro catálogo. Ese id no casa con nada y aquí se decide qué hacer con él.
 *
 * NO se esconde y NO se borra. Se enseña con `existe: false` y quien pinta la
 * lista lo dice. Esconderlo dejaría un contador de "3 platos" sobre una lista
 * de 2 —la clase de incoherencia que hace desconfiar de las cifras de una app
 * que se vende por sus cifras—, y borrarlo sería tirar una preferencia que
 * vuelve a servir en cuanto la receta regrese.
 *
 * Ordenados por lo último bloqueado: quien entra aquí viene casi siempre a
 * deshacer lo que acaba de hacer.
 */
export function nombresDeBloqueados(
  preferencias: PreferenciasPlatos,
  catalogo: { recetas: { id: string; nombre: string }[]; ensamblajes?: Record<string, { id: string; nombre: string }[]> } = datos,
): { id: string; nombre: string; tipo: 'receta' | 'ensamblaje'; existe: boolean }[] {
  const porId = new Map<string, { nombre: string; tipo: 'receta' | 'ensamblaje' }>();
  for (const r of catalogo.recetas) porId.set(r.id, { nombre: r.nombre, tipo: 'receta' });
  for (const lista of Object.values(catalogo.ensamblajes ?? {})) {
    for (const e of lista) porId.set(e.id, { nombre: e.nombre, tipo: 'ensamblaje' });
  }

  return Object.values(preferencias)
    .filter((p) => p.valoracion === 'no_quiero')
    .sort((a, b) => (a.actualizadaEn < b.actualizadaEn ? 1 : -1))
    .map((p) => {
      const encontrado = porId.get(p.platoId);
      return {
        id: p.platoId,
        tipo: encontrado?.tipo ?? 'receta',
        existe: !!encontrado,
        // Sin nombre no se enseña el id crudo: es un identificador interno y
        // en pantalla se lee como un error. Se dice lo que es.
        nombre: encontrado?.nombre ?? 'Un plato que ya no existe',
      };
    });
}

/**
 * Cuántos hay de cada, para la fila de ajustes y para la analítica.
 * Se cuenta sobre el mapa entero, incluidos los ids que ya no existen en el
 * recetario: ver `nombresDeBloqueados`.
 */
export function cuentaPreferencias(preferencias: PreferenciasPlatos): { bloqueados: number; favoritos: number } {
  let bloqueados = 0;
  let favoritos = 0;
  for (const p of Object.values(preferencias)) {
    if (p.valoracion === 'no_quiero') bloqueados++;
    else favoritos++;
  }
  return { bloqueados, favoritos };
}
