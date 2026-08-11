/**
 * ═══ LO QUE VA EN EL CARRO Y NO ES COMIDA DE LA SEMANA ═══
 *
 * Café, papel higiénico, comida del perro, champú. Cosas que se compran en el
 * mismo viaje y no tienen nada que ver con el menú.
 *
 * ═══ LA REGLA QUE JUSTIFICA TODO ESTE FICHERO ═══
 *
 * Un extra NO PUEDE tocar la cifra del menú. Nunca.
 *
 * Cunde vende una frase —«tu semana cuesta 61,20 €»— y esa frase deja de ser
 * verdad en el momento en que un detergente entra en la suma. Por eso los
 * extras no viven dentro de `AppState.lista` con una marca que los distinga,
 * sino en una lista APARTE: si estuvieran dentro, `totalLista` tendría que
 * filtrarlos, y bastaría con que alguien escribiera un `reduce` nuevo sin el
 * filtro para que la promesa se rompiera en silencio. Estando fuera no hay
 * nada que filtrar — el motor y las cuentas del menú no pueden verlos aunque
 * quieran.
 *
 * Por lo mismo, aquí no hay una sola importación de `src/motor/`.
 */

export interface ExtraCompra {
  id: string;
  nombre: string;
  /**
   * `null` es «todavía no sé lo que cuesta», y es un caso de primera clase, no
   * un hueco a rellenar.
   *
   * Se apunta el café el domingo sin saber el precio, y se pone en el súper al
   * verlo en el lineal. Guardar 0 aquí sería decir que el café es gratis, y
   * esta app se sostiene sobre que un número que se enseña es verdad.
   */
  precio: number | null;
  marcado: boolean;
  /** ISO-8601. Para que la lista salga en el orden en que se apuntaron. */
  creadoEn: string;
}

/**
 * ═══ IDENTIFICADOR ═══
 *
 * Nunca el nombre: se puede apuntar «Leche» dos veces —una para el desayuno y
 * otra para el gato— y son dos líneas distintas de la lista.
 *
 * `crypto.randomUUID` cuando está, y cuando no, `getRandomValues`. La
 * alternativa importa: `randomUUID` NO existe fuera de un contexto seguro, y
 * esta app se sirve como PWA por red local para probar en el móvil —
 * `http://192.168.x.x` no es contexto seguro—. Sin alternativa, añadir un extra
 * reventaría justo en el escenario en que se prueba.
 *
 * El último recurso mezcla el reloj con un contador propio, no `Math.random()`:
 * el proyecto prohíbe la aleatoriedad y, aunque aquí no afectaría a ninguna
 * decisión del motor, dos ids iguales serían dos filas que se pisan.
 */
let contador = 0;
export function nuevoIdExtra(): string {
  const c = globalThis.crypto;
  if (c?.randomUUID) return c.randomUUID();
  if (c?.getRandomValues) {
    const b = c.getRandomValues(new Uint8Array(16));
    return [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
  }
  contador += 1;
  return `extra-${Date.now().toString(36)}-${contador.toString(36)}`;
}

export function crearExtra(nombre: string, precio: number | null, ahora: string): ExtraCompra {
  return { id: nuevoIdExtra(), nombre: nombre.trim(), precio, marcado: false, creadoEn: ahora };
}

/**
 * ═══ LOS TRES NÚMEROS, Y POR QUÉ SON TRES ═══
 *
 * `totalMenu` no está aquí: lo calcula `totalLista` en derive.ts sobre la lista
 * del motor, y no se toca. Que su fórmula viva en otro fichero al que los
 * extras no llegan es la garantía estructural de la regla de arriba.
 */

/**
 * Solo los que tienen precio. Los que no lo tienen NO suman cero: es que no
 * están en esta cuenta, que es distinto — y por eso hace falta el tercer
 * número de abajo para poder decirlo.
 */
export function totalExtras(extras: ExtraCompra[]): number {
  return extras.reduce((suma, e) => suma + (e.precio ?? 0), 0);
}

/** Lo que ya está en el carro, de los extras. El gemelo de `totalLlevas`. */
export function extrasLlevados(extras: ExtraCompra[]): number {
  return extras.reduce((suma, e) => suma + (e.marcado ? (e.precio ?? 0) : 0), 0);
}

/**
 * Cuántos no tienen precio.
 *
 * Es el número que convierte «TOTAL 69,50 €» en «TOTAL CON PRECIOS 69,50 €».
 * Sin él, la pantalla estaría diciendo que la compra cuesta 69,50 € cuando hay
 * dos cosas dentro cuyo precio nadie conoce — y eso es exactamente el tipo de
 * cifra que la app no puede permitirse enseñar.
 */
export function extrasSinPrecio(extras: ExtraCompra[]): number {
  return extras.reduce((n, e) => n + (e.precio === null ? 1 : 0), 0);
}

/** `totalMenu + totalExtras`. El menú entra ya calculado desde fuera. */
export function totalCompraPrevista(totalMenu: number, extras: ExtraCompra[]): number {
  return totalMenu + totalExtras(extras);
}

/**
 * ═══ LEER UN PRECIO ESCRITO A MANO ═══
 *
 * Devuelve `null` si no hay nada que leer, y eso NO es un error: es el caso
 * normal de «lo apunto ahora y ya veré lo que cuesta».
 *
 * Acepta coma y punto porque en un teclado numérico de móvil el separador que
 * sale depende del idioma del sistema, no del de la app: quien tenga el móvil
 * en inglés escribe 3.45 en una app en español. Rechazar eso sería culpar al
 * usuario de una decisión que no ha tomado él.
 *
 * `undefined` significa «esto no es un precio» y quien llama decide qué hacer;
 * `null` significa «no ha puesto ninguno», que sí es válido.
 */
export function leerPrecio(texto: string): number | null | undefined {
  const limpio = texto.trim().replace(',', '.');
  if (limpio === '') return null;
  const n = Number(limpio);
  if (!Number.isFinite(n) || n < 0) return undefined;
  // A céntimos: sin esto, 3,455 entraría y la suma daría un total con tres
  // decimales que no cuadra con ningún ticket.
  return Math.round(n * 100) / 100;
}
