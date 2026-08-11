/**
 * ═══ DÍAS DE CALENDARIO, NO INSTANTES ═══
 *
 * Todo lo que hay aquí trabaja con `YYYY-MM-DD`: un día del calendario del
 * usuario, sin hora y sin zona. "El 7 de agosto" es el 7 de agosto esté donde
 * esté, y no un instante que pueda caer en otro día según dónde se mire.
 *
 * ═══ POR QUÉ NO SE USA `new Date('2026-08-07')` ═══
 *
 * Porque NO da el 7 de agosto. El estándar dice que una cadena así se
 * interpreta en UTC, así que en España eso es el 7 a las 02:00 en verano — y en
 * cualquier zona al oeste de Greenwich, el 6 por la tarde. Formatearla devuelve
 * el día anterior.
 *
 * Es el fallo clásico de las apps de calendario y aquí sería especialmente
 * malo: la semana empezaría un día antes de lo que el usuario eligió, y el
 * único síntoma sería que las etiquetas "no cuadran". Así que:
 *
 *   · para LEER una fecha se parte la cadena a mano y se construye con
 *     `new Date(a, m - 1, d)`, que es local por definición.
 *   · para ESCRIBIRLA se compone a mano. `toISOString()` convierte a UTC y
 *     reintroduce el problema por la puerta de atrás.
 *
 * En este fichero no hay ni un `toISOString` ni un `Date.parse`, y hay un test
 * que lo comprueba.
 */

/** Un día del calendario, `YYYY-MM-DD`. Nunca lleva hora. */
export type FechaDia = string;

const dos = (n: number) => String(n).padStart(2, '0');

/** De un `Date` local al día que ese `Date` representa en la zona del usuario. */
export function aFechaDia(d: Date): FechaDia {
  return `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}`;
}

/**
 * De `YYYY-MM-DD` a un `Date` a MEDIODÍA local.
 *
 * A mediodía y no a medianoche a propósito: el día en que cambia el horario de
 * verano tiene 23 o 25 horas, y una fecha a las 00:00 más 24 horas puede caer
 * en el mismo día o saltarse uno. Desde las 12:00 quedan doce horas de margen a
 * cada lado y ningún cambio de hora del mundo llega a tanto.
 *
 * Aquí no se usa aritmética de milisegundos de todas formas —`sumarDias` va por
 * `setDate`, que el motor de fechas ya resuelve bien— pero el mediodía protege
 * a cualquiera que en el futuro reste dos de estos y divida.
 */
export function deFechaDia(f: FechaDia): Date {
  const [a, m, d] = f.split('-').map(Number);
  return new Date(a, (m ?? 1) - 1, d ?? 1, 12, 0, 0, 0);
}

/** ¿Es una fecha con la forma que esperamos y que existe de verdad? */
export function esFechaDia(v: unknown): v is FechaDia {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  // Y que exista: '2026-02-30' pasa el patrón y no es un día.
  return aFechaDia(deFechaDia(v)) === v;
}

/** El día de hoy, en la zona del usuario. */
export function hoy(): FechaDia {
  return aFechaDia(new Date());
}

/**
 * Sumar días. `setDate` con un número fuera de rango pasa al mes o al año
 * siguiente él solo, así que el cambio de mes, de año y el 29 de febrero
 * salen gratis. Cualquier cosa que hiciéramos a mano sería peor.
 */
export function sumarDias(f: FechaDia, dias: number): FechaDia {
  const d = deFechaDia(f);
  d.setDate(d.getDate() + dias);
  return aFechaDia(d);
}

/** Diferencia en días de calendario. Negativa si la segunda es anterior. */
export function diasEntre(desde: FechaDia, hasta: FechaDia): number {
  const a = deFechaDia(desde);
  const b = deFechaDia(hasta);
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}

/**
 * ═══ EL PUENTE CON EL MOTOR ═══
 *
 * Las mismas siete claves que usa el motor (`DIAS` en motor/tipos.ts), en el
 * orden de `Date.getDay()`: 0 es domingo en JavaScript.
 *
 * Se duplica la lista a propósito en vez de importarla: `DIAS` es el orden de
 * una semana que empieza en lunes, y esto es un mapa de "número de día de la
 * semana → nombre". Son dos cosas distintas que hoy comparten las cadenas, y
 * atarlas haría que rotar una rotara la otra.
 */
const NOMBRE_POR_DIA_JS = ['DOM', 'LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB'];

/** El nombre corto del día de la semana: la misma clave que usa el motor. */
export function nombreDeDia(f: FechaDia): string {
  return NOMBRE_POR_DIA_JS[deFechaDia(f).getDay()];
}

/**
 * ═══ CÓMO SE LE DICE AL MOTOR POR DÓNDE EMPIEZA ═══
 *
 * `DIAS` rotado para que la posición 0 sea el día real del inicio. Empezando en
 * viernes: VIE, SÁB, DOM, LUN, MAR, MIÉ, JUE.
 *
 * Esto es lo que hace que la funcionalidad no sea solo cambiar etiquetas. El
 * motor tiene UNA regla que depende del día real del calendario —
 * `esFinDeSemanaBueno`: sábado noche y domingo mediodía se cocina, no se comen
 * sobras— y con los nombres fijos esa regla habría caído en el miércoles y el
 * jueves de quien empieza en viernes. Rotando, `esFinDeSemanaBueno` no se toca
 * y sigue acertando.
 *
 * Y como los nombres siguen siendo los mismos siete, el plan guardado no cambia
 * de forma: ni migración de planes, ni claves nuevas en localStorage.
 */
export function diasDesde(f: FechaDia): string[] {
  const primero = deFechaDia(f).getDay();
  // De domingo=0 a lunes=0, que es el orden de DIAS en el motor.
  const desdeLunes = (primero + 6) % 7;
  const orden = ['LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB', 'DOM'];
  return [...orden.slice(desdeLunes), ...orden.slice(0, desdeLunes)];
}

/**
 * La fecha del día `indice` de una semana. `null` si la semana no la sabe —las
 * generadas antes de esta versión— y entonces quien pinta enseña el nombre de
 * siempre en vez de inventarse un día.
 *
 * Una función y no un cálculo repetido en cada componente: son siete tarjetas,
 * una hoja de día y una de cambio, y cada una haría su propia aritmética.
 */
export function fechaDePosicion(inicio: FechaDia | null, indice: number): FechaDia | null {
  return inicio ? sumarDias(inicio, indice) : null;
}

/** El próximo lunes. Si hoy ES lunes, el de la semana que viene. */
export function proximoLunes(desde: FechaDia): FechaDia {
  const dia = deFechaDia(desde).getDay();
  // De 1 (lunes) a 7 días: nunca devuelve el mismo día.
  return sumarDias(desde, ((8 - dia) % 7) || 7);
}
