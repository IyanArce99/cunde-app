import type { AppState, Suscripcion } from '../state/types';
import { MURO_ACTIVO } from './suscripcion';

/**
 * ═══ CUNDE+ · UN SOLO SITIO CON LAS REGLAS DE ACCESO ═══
 *
 * El principio, y de él sale todo lo demás:
 *
 *   Cunde gratis resuelve su promesa entera — presupuesto, menú, lista y
 *   precio previsto. Cunde+ no desbloquea el producto: desbloquea
 *   PERSONALIZACIÓN. Gratis es «Cunde me hace la semana»; con Cunde+ es «Cunde
 *   me la hace exactamente a mi gusto».
 *
 * Por eso aquí no hay ninguna función que capee la lista de la compra, ni los
 * precios, ni el cierre, ni compartir. Y muy explícitamente NINGUNA que toque
 * alergias o dietas: cobrar por «sin gluten» es cobrar por no envenenar a
 * alguien. Eso no se negocia y no depende de esta tabla — es que no está.
 *
 * ═══ UN ENTITLEMENT, TRES PRODUCTOS ═══
 *
 * Semanal, mensual y para siempre dan EXACTAMENTE lo mismo. La diferencia es
 * cuánto dura y cómo se paga. Por eso ningún componente pregunta qué plan tiene
 * el usuario: preguntan `tieneCundePlus(estado)`.
 *
 * Si mañana hay un cuarto producto, no se toca ni un componente.
 */

/**
 * Las funciones que Cunde+ desbloquea. Enumeradas y no strings sueltas para
 * que añadir una obligue a decidir su regla aquí, y no a repartir un
 * `if (!premium)` por las pantallas.
 */
export type FuncionPlus =
  | 'cambios_ilimitados'
  | 'proteina_alta';

/** Cuántos cambios voluntarios de plato entran en el plan gratuito. */
export const CAMBIOS_GRATIS_POR_SEMANA = 2;

/**
 * ¿Tiene Cunde+?
 *
 * ═══ CON EL MURO APAGADO, TODO EL MUNDO LO TIENE ═══
 *
 * Y no es un descuido ni una comprobación defensiva. `MURO_ACTIVO` en false
 * significa «la pregunta del precio todavía no se hace»: sin usuarios que hayan
 * llegado a la semana 4 no se puede poner precio a nada. Si esta función
 * devolviera `false` con el muro apagado, la beta saldría con las funciones
 * capadas y sin ninguna forma de pagarlas.
 *
 * Encender el muro es una línea en `suscripcion.ts` y desde ese momento esta
 * función pasa a mirar la suscripción de verdad.
 */
export function tieneCundePlus(estado: Pick<AppState, 'suscripcion'>): boolean {
  if (!MURO_ACTIVO) return true;
  return estado.suscripcion !== null;
}

/**
 * ¿Puede usar esta función?
 *
 * La forma general, para que añadir `batch_cooking` o `advanced_pantry` mañana
 * sea una línea aquí y ninguna en los componentes.
 */
export function puedeUsar(funcion: FuncionPlus, estado: Pick<AppState, 'suscripcion'>): boolean {
  void funcion; // hoy las dos dependen solo del entitlement
  return tieneCundePlus(estado);
}

/**
 * ═══ EL CONTADOR DE CAMBIOS · POR SEMANA LÓGICA ═══
 *
 * `cambiosDePlato` guarda a QUÉ semana pertenece la cuenta, no solo cuántos van.
 * Así el reseteo no necesita ningún gancho: si la semana guardada no es la
 * actual, la cuenta vale cero y ya está.
 *
 * Eso cierra el agujero de «uso mis dos cambios, muevo el presupuesto un euro,
 * regenero y recupero los dos»: `regenerar()` NO incrementa `semanaNumero` —lo
 * hace solo `GUARDAR_CIERRE`— así que tocar ajustes deja el contador donde
 * estaba. Lo comprobado en el reductor, no supuesto.
 *
 * La semana lógica es `semanaEfectiva()`: el máximo entre el contador de
 * semanas cerradas y las semanas transcurridas desde que se generó. O sea,
 * nace una semana nueva al CERRAR la compra o al pasar siete días — las dos
 * cosas que de verdad son «otra semana».
 */
export function cambiosUsados(estado: Pick<AppState, 'cambiosDePlato'>, semanaActual: number): number {
  const c = estado.cambiosDePlato;
  if (!c || c.semana !== semanaActual) return 0;
  return c.usados;
}

export interface AccesoCambio {
  /** Si se puede cambiar el plato ahora mismo. */
  puede: boolean;
  /** Cuántos cambios gratis quedan. `null` con Cunde+: no se cuenta. */
  restantes: number | null;
}

/**
 * ═══ LA REGLA, SEPARADA DE LA BANDERA ═══
 *
 * `tieneCundePlus` lee `MURO_ACTIVO`, y con el muro apagado devuelve `true`
 * para todo el mundo. Eso hacía que los tests del límite solo se pudieran
 * comprobar encendiendo una constante global — o sea, no se comprobaban.
 *
 * Aquí está la regla pura: dado si tiene Cunde+ y cuántos lleva gastados, qué
 * puede hacer. Se prueba entera, con la bandera en el estado que sea.
 */
export function reglaDeCambios(tienePlus: boolean, usados: number): AccesoCambio {
  if (tienePlus) return { puede: true, restantes: null };
  return {
    puede: usados < CAMBIOS_GRATIS_POR_SEMANA,
    /* Nunca negativo: quien tenía Cunde+, hizo siete cambios y luego caducó
       tiene `usados = 7`. Lo que le queda es cero, no menos cinco. */
    restantes: Math.max(0, CAMBIOS_GRATIS_POR_SEMANA - usados),
  };
}

/**
 * ¿Puede cambiar un plato?
 *
 * Con Cunde+, siempre y sin contar. Sin él, hasta agotar los gratis de esta
 * semana.
 *
 * Nota sobre el premium caducado: si alguien hizo 7 cambios con Cunde+ y luego
 * caduca, `usados` vale 7 y `restantes` sale 0 — no un número negativo ni un
 * estado inválido. La semana que ya tiene NO se toca; simplemente no puede
 * hacer más cambios sin volver a pagar.
 */
export function accesoACambiarPlato(
  estado: Pick<AppState, 'suscripcion' | 'cambiosDePlato'>,
  semanaActual: number,
): AccesoCambio {
  return reglaDeCambios(tieneCundePlus(estado), cambiosUsados(estado, semanaActual));
}

/**
 * ¿Puede elegir este nivel de proteína?
 *
 * Básica y Normal, siempre. Alta, con Cunde+.
 *
 * Alta no se esconde: se ve, se puede tocar, y al tocarla sale el muro. Un nivel
 * oculto no se puede desear, y un nivel que desaparece al no pagar hace pensar
 * que la app está rota.
 */
export function reglaDeProteina(tienePlus: boolean, nivel: 'basica' | 'normal' | 'alta'): boolean {
  if (nivel !== 'alta') return true;
  return tienePlus;
}

export function puedeElegirProteina(
  nivel: 'basica' | 'normal' | 'alta',
  estado: Pick<AppState, 'suscripcion'>,
): boolean {
  return reglaDeProteina(puedeUsar('proteina_alta', estado), nivel);
}

/**
 * ═══ POR QUÉ AQUÍ NO ESTÁ «BÁJAME EL PRECIO» NI «NO COCINO» ═══
 *
 * Son gratis y tienen que seguir siéndolo, cada uno por su motivo:
 *
 *   · «Bájame el precio» es la promesa central del producto. Cobrar por bajar
 *     la cesta cuando alguien se ha pasado del presupuesto sería vender la
 *     solución al problema que la app dice resolver.
 *   · «No cocino este día» es absorber el fallo del martes, que es la regla 5
 *     del proyecto. Cobrar por rehacer el martes es cobrar por cumplir nuestra
 *     propia promesa.
 *   · Bloquear un plato es una preferencia persistente, no una personalización
 *     de esta semana. Decir «no me lo vuelvas a poner» no gasta un cambio; si
 *     además quiere sustituirlo AHORA, eso ya es un cambio voluntario y sí
 *     cuenta.
 *
 * Que no aparezcan en `FuncionPlus` no es un olvido: es la decisión.
 */

/** Solo para los tests: un estado mínimo con o sin Cunde+. */
export function _estadoConPlan(plan: Suscripcion): Pick<AppState, 'suscripcion'> {
  return { suscripcion: plan };
}
