/**
 * ═══ ANALÍTICA · SIN PROVEEDOR ═══
 *
 * No hay proveedor todavía y no lo va a haber en este cambio. Lo que hay es el
 * sitio por donde pasarán los eventos, para que el día que se conecte uno no
 * haya que ir a buscar veinte `track()` repartidos por los componentes.
 *
 * Por defecto no hace NADA. Ni consola, ni cola, ni red. La app funciona sin
 * conexión —la pantalla Compra se usa en sótanos de supermercado— y una cola de
 * eventos que se guarda esperando conexión es un sitio donde se acumulan datos
 * del usuario sin que nadie lo haya decidido.
 *
 * ═══ QUÉ NO SE MANDA ═══
 *
 * Nunca el nombre del plato, ni sus ingredientes, ni las exclusiones. Que
 * alguien bloquee `merluza_horno` es una preferencia; que alguien tenga puesto
 * "sin gluten" es un dato de salud, y no hay ningún evento aquí que lo lleve.
 * `dish_id` es un identificador del recetario, igual para todos los usuarios y
 * sin nada personal dentro.
 */

export type EventoAnalitica =
  | 'week_start_date_changed'
  | 'week_start_date_picker_opened'
  | 'extra_item_added'
  | 'extra_item_removed'
  | 'extra_item_checked'
  | 'extra_item_unchecked'
  | 'extra_item_price_added'
  | 'extra_item_price_changed'
  | 'shopping_closed_with_extras'
  | 'dish_preference_set'
  | 'dish_preference_removed'
  | 'dish_liked'
  | 'dish_disliked'
  | 'disliked_dish_restored'
  | 'generation_affected_by_preferences'
  | 'generation_failed_by_disliked_dishes'
  | 'share_sheet_opened'
  | 'share_image_generated'
  | 'share_image_failed'
  | 'share_completed'
  | 'share_dismissed'
  | 'share_downloaded';

export interface PropsAnalitica {
  dish_id?: string;
  dish_type?: 'receta' | 'ensamblaje';
  preference?: 'me_gusta' | 'neutral' | 'no_quiero';
  week_number?: number;
  source_screen?: 'hoja_dia' | 'ajustes' | 'platos_bloqueados' | 'semana';
  total_disliked_dishes?: number;
  total_liked_dishes?: number;
  /* Extras. NUNCA el nombre: el usuario escribe ahí lo que quiere y eso es
     suyo. Salen cuentas, no contenido. */
  has_price?: boolean;
  price?: number;
  extras_count?: number;
  extras_total?: number;
  unpriced_extras_count?: number;
  /* Fecha de inicio. Se manda el DÍA DE LA SEMANA y la distancia en días, no
     la fecha: para saber si la gente empieza en lunes o en viernes no hace
     falta saber qué día concreto abrió la app. */
  days_from_today?: number;
  previous_start_day?: string;
  new_start_day?: string;
  source?: 'hoy' | 'manana' | 'lunes' | 'elegida' | 'ajustes';
  /**
   * ═══ COMPARTIR ═══
   *
   * Sale la FORMA de la tarjeta, no su contenido: qué tipo era, si el usuario
   * llegó a mandarla y cuánto tardó en fabricarse el PNG. Con eso se responde
   * lo único que hay que saber —si la gente comparte y si el generador va
   * lento en móviles viejos— sin que salga de aquí ni un euro ni un plato.
   *
   * `diff_bucket` es un tramo («0-2», «2-5»…) y no el porcentaje exacto: para
   * saber si Cunde acierta con el presupuesto basta con el tramo, y un número
   * fino junto a un número de semana empieza a identificar a una persona.
   */
  share_type?: 'semana' | 'resultado';
  share_result?: 'compartido' | 'cancelado' | 'descargado' | 'fallo';
  /** Milisegundos de generación, redondeados a 100: es una medida, no un reloj. */
  generation_ms?: number;
  diff_bucket?: string;
  has_extras?: boolean;
}

type Sumidero = (evento: EventoAnalitica, props: PropsAnalitica) => void;

/** Nadie escucha hasta que alguien se registre. */
let sumidero: Sumidero | null = null;

/**
 * Conecta un proveedor. Lo llamará el arranque de la app el día que exista uno;
 * hasta entonces, `registrar` solo lo usan los tests para comprobar que los
 * eventos salen con lo que tienen que llevar.
 */
export function registrarSumideroAnalitica(nuevo: Sumidero | null): void {
  sumidero = nuevo;
}

/**
 * Emitir NUNCA puede romper la app.
 *
 * Un proveedor de analítica es código de terceros que se cae, y esta app tiene
 * una pantalla que se usa de pie en un supermercado sin cobertura. Que una
 * métrica falle no puede dejar a nadie sin su lista de la compra.
 */
export function analitica(evento: EventoAnalitica, props: PropsAnalitica = {}): void {
  if (!sumidero) return;
  try {
    sumidero(evento, props);
  } catch {
    // Una métrica perdida no es un fallo del producto.
  }
}
