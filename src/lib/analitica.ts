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
  /**
   * ═══ EL EMBUDO · LOS QUE RESPONDEN LA PREGUNTA QUE IMPORTA ═══
   *
   * La métrica principal no son descargas ni sesiones: es **qué parte de la
   * gente genera una segunda semana**, y luego una tercera y una cuarta.
   *
   * Por eso NO existe `week_2_started`. La semana va como columna
   * (`week_number`) en `week_generated`, así que semana 2, 3 y 4 son un `where`
   * sobre un solo evento. Un evento por semana sería la misma información
   * escrita tres veces y con tres sitios donde equivocarse.
   */
  /**
   * ═══ CUNDE+ · EL EMBUDO DE CONVERSIÓN ═══
   *
   * Lo que hay que poder contestar con SQL:
   *   · cuántos llegan al límite de cambios, y qué parte de ellos compra
   *   · cuántos intentan proteína alta, y qué parte compra
   *   · conversión por ORIGEN: no es lo mismo el muro que sale por cambios que
   *     el que sale por proteína, y la diferencia decide dónde apretar
   *   · reparto entre semanal, mensual y de por vida
   *
   * `premium_feature_attempted` cubre cualquier función de pago que alguien
   * intente sin tenerla — hoy solo proteína alta, mañana lo que venga. Por eso
   * no hay un `high_protein_attempted`: sería el mismo evento con otro nombre.
   *
   * El intento de tercer cambio NO lleva evento propio: se deduce de
   * `dish_change_limit_reached` + `paywall_opened` con `source: cambios_plato`.
   */
  | 'paywall_opened'
  | 'paywall_closed'
  | 'paywall_plan_selected'
  | 'purchase_started'
  | 'purchase_completed'
  | 'purchase_cancelled'
  | 'purchase_failed'
  | 'restore_purchases_started'
  | 'restore_purchases_completed'
  | 'dish_change_used'
  | 'dish_change_limit_reached'
  | 'premium_feature_attempted'
  | 'app_opened'
  | 'onboarding_started'
  | 'onboarding_completed'
  | 'week_generated'
  | 'week_adjusted'
  | 'shopping_opened'
  | 'shopping_item_checked'
  | 'shopping_item_unchecked'
  | 'checkout_opened'
  | 'checkout_completed'
  | 'dish_changed'
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
  /**
   * ═══ DÓNDE PASÓ · LISTA CERRADA ═══
   *
   * Nunca una ruta ni texto libre: un `screen` arbitrario acaba llevando
   * identificadores dentro y convierte una columna de agrupación en un vertedero.
   * `analitica-supabase.ts` descarta cualquier valor fuera de esta lista.
   */
  screen?:
    | 'onboarding_portada' | 'onboarding_super' | 'onboarding_datos'
    | 'onboarding_presupuesto' | 'semana' | 'compra' | 'ajustes'
    | 'hoja_dia' | 'cierre' | 'platos_bloqueados';

  /* ═══ EL EMBUDO ═══
     Buckets y booleanos, nunca importes. Ver analitica-buckets.ts. */
  people?: number;
  meals?: number;
  within_budget?: boolean;
  /** Si hay filtros, no CUÁLES: una alergia concreta es un dato de salud. */
  has_diet_filters?: boolean;
  diet_filters_count?: number;
  has_dessert?: boolean;
  budget_bucket?: string;
  /**
   * La provincia: las dos primeras cifras del código postal, nunca las cinco.
   * Solo viaja en `onboarding_completed`. Ver lib/codigoPostal.ts.
   */
  province?: string;
  difference_bucket?: string;
  has_unpriced_extras?: boolean;
  /** Cuántas casillas llevaba marcadas al cerrar: mide si la lista se usa. */
  items_checked?: number;
  items_total?: number;
  variety?: string;
  protein?: string;

  /* ═══ CUNDE+ ═══
     Nunca importes, ni identificadores de transacción, ni recibos, ni tokens de
     Google o Apple. Para analítica de producto basta con QUÉ plan y DE DÓNDE
     venía; el dinero lo lleva RevenueCat, que es su trabajo. */
  plan?: 'semana' | 'mes' | 'de-por-vida';
  /** Qué función de pago se intentó usar sin tenerla. */
  feature?: 'cambios_ilimitados' | 'proteina_alta';
  /** Si el usuario ya tiene Cunde+ en el momento del evento. */
  is_plus?: boolean;
  /** Cuántos cambios gratis llevaba gastados. Mide dónde está el techo real. */
  free_changes_used?: number;
  /** Si «restaurar compras» encontró algo. */
  restored?: boolean;

  dish_id?: string;
  dish_type?: 'receta' | 'ensamblaje';
  preference?: 'me_gusta' | 'neutral' | 'no_quiero';
  week_number?: number;
  source_screen?: 'hoja_dia' | 'ajustes' | 'platos_bloqueados' | 'semana';
  total_disliked_dishes?: number;
  total_liked_dishes?: number;
  /* Extras. NUNCA el nombre: el usuario escribe ahí lo que quiere y eso es
     suyo. Salen cuentas, no contenido.
     Y NUNCA el importe exacto, que es lo que estas dos hacían: `price` llevaba
     los euros tal cual los teclea el usuario y `extras_total` la suma con dos
     decimales. La regla de arriba —tramos y booleanos— no tiene excepción para
     los extras, y la política de privacidad promete literalmente que no se
     envían importes exactos. Ahora son tramos. Ver `tramoImporte`. */
  has_price?: boolean;
  price_bucket?: string;
  extras_count?: number;
  extras_total_bucket?: string;
  unpriced_extras_count?: number;
  /* Fecha de inicio. Se manda el DÍA DE LA SEMANA y la distancia en días, no
     la fecha: para saber si la gente empieza en lunes o en viernes no hace
     falta saber qué día concreto abrió la app. */
  days_from_today?: number;
  previous_start_day?: string;
  new_start_day?: string;
  /**
   * De dónde vino la acción.
   *
   * Un solo campo para las dos familias que lo necesitan —el selector de fecha
   * de inicio y el muro de pago— porque preguntan lo mismo: «¿desde qué sitio
   * llegó el usuario aquí?». Dos campos con el mismo significado y distinto
   * nombre habrían obligado a hacer dos `group by` para responder una pregunta.
   *
   * Los valores no se solapan, así que en SQL basta con filtrar por evento.
   */
  source?:
    /* selector de fecha de inicio */
    | 'hoy' | 'manana' | 'lunes' | 'elegida' | 'ajustes'
    /* muro de pago · ver OrigenMuro en MuroDePago.tsx */
    | 'cambios_plato' | 'proteina_alta' | 'semana_2';
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
