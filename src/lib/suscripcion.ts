/**
 * SUSCRIPCIÓN · un solo sitio para el precio, la bandera y qué se capa.
 *
 * ═══ EL PRINCIPIO ═══
 * "Lo de esta semana es gratis. Se paga lo que se acumula."
 *
 * No capamos el producto: vendemos que la app RECUERDE. Cualquiera puede
 * cuadrar su semana, ver los precios reales, llevarse la lista al súper y
 * cerrarla, para siempre y sin límite. Lo que se paga es que la despensa siga
 * ahí la semana que viene, que no te repita platos durante tres semanas y que
 * lleve la cuenta de lo que has ahorrado.
 *
 * Esa frontera no es arbitraria: lo acumulado es lo único que cuesta cero
 * producir, no lo puede tener nadie más porque son TUS datos, y no degrada el
 * bucle de esta semana por no pagarlo.
 */

/**
 * EL MURO SALE APAGADO.
 *
 * No se puede poner precio a algo que nadie ha usado una semana entera. La
 * tubería queda montada y probada; la caja se abre cuando haya usuarios que
 * hayan llegado a la semana 4, que es la métrica que decide si esto es un
 * negocio.
 *
 * Con la bandera en false TODO es gratis y el muro no aparece nunca — no es
 * "todos son premium", es que la pregunta no se hace.
 */
export const MURO_ACTIVO = false;

/**
 * PRECIOS. Están aquí y en ningún otro sitio porque se van a mover.
 *
 * Decididos por producto el 11 ago 2026. Banda de mercado verificada: la
 * categoría va de 4,99 a 12 $/mes (Mealime 5,99, Eat This Much ~5, Plan to Eat
 * 5,95, PlateJoy 12). AnyList, la de mejor retención del sector, cobra 9,99 $
 * AL AÑO. Estamos deliberadamente en la banda baja.
 *
 * ═══ LA FORMA DE LA TABLA ═══
 *
 *     1,49 × 52  =  77,48 € al año
 *     3,99 × 12  =  47,88 € al año   ← el que se quiere vender, y el más barato
 *     29,99 una vez
 *
 * El mensual es un 38% más barato al año que el semanal, así que es el que sale
 * ganando en cuanto alguien compara — que es lo que tiene que pasar con el plan
 * principal. El semanal no está para venderse: está para que quien no quiera
 * comprometerse a un mes tenga por dónde entrar, y paga esa comodidad.
 *
 * ═══ HAY PLAN SEMANAL, Y `CLAUDE.md` LO PROHÍBE POR ESCRITO ═══
 *
 * La regla se escribió contra una app española que cobra 9,99 € A LA SEMANA
 * —519 € al año— con prueba trampa de tres días. Lo predatorio de aquello es el
 * importe y la trampa, no el periodo: 1,49 € a la semana son 77 al año, dentro
 * de la banda de la categoría y sin prueba con cargo automático detrás.
 *
 * Lo que mantiene esto honesto es que cada plan diga EN PANTALLA lo que suma en
 * un año. Sin esa línea, un precio semanal pequeño es el mismo truco con otra
 * cifra: 1,49 parece tres veces más barato que 3,99 y en realidad es un 62% más
 * caro. Esa línea no es decoración, es la condición para poder tener este plan.
 *
 * ═══ EL DE POR VIDA A 29,99 ═══
 *
 * Se amortiza en 7,5 meses de plan mensual, así que quien piense quedarse más
 * de un año lo elige. Con unos 21 € netos tras la comisión de tienda cubre poco
 * más de medio año de ingreso mensual: es una decisión de captación —caja por
 * delante, cero fricción, y un usuario que ya no se puede ir— no de ingreso
 * recurrente. Si lo que se busca es recurrencia, este es el número a subir.
 */
export const PRECIOS = {
  semana: 1.49,
  mes: 3.99,
  deporvida: 29.99,
  /** Preparado. No se ofrece hasta que exista la lista compartida. */
  hogar: 39.99,
} as const;

/**
 * Lo que cuesta la semana en cada plan. Es la unidad con la que se vende: el
 * argumento es «te cuesta X a la semana y la despensa te ahorró 8,57 €», y sin
 * una unidad común los tres periodos no se pueden comparar de un vistazo.
 */
export const POR_SEMANA = {
  semana: PRECIOS.semana,
  mes: PRECIOS.mes / 4.33,
} as const;

/** Lo que suma cada plan recurrente en un año. Para poder decirlo en pantalla. */
export const AL_ANO = {
  semana: PRECIOS.semana * 52,
  mes: PRECIOS.mes * 12,
} as const;

/** Identificadores de producto en RevenueCat. Los mismos en las dos tiendas. */
export const PRODUCTOS = {
  semana: 'cunde_semanal',
  mes: 'cunde_mensual',
  /* En las tiendas es un producto NO consumible, no una suscripción. Hay que
     darlo de alta así en App Store Connect y Play Console, o RevenueCat no
     sabrá que no caduca. */
  deporvida: 'cunde_de_por_vida',
  hogar: 'cunde_hogar_anual',
} as const;

export type Plan = keyof typeof PRECIOS;

/**
 * ═══ QUÉ SE CAPA ═══
 *
 * GRATIS PARA SIEMPRE, y cada cosa por su motivo:
 *   · El menú con precios reales y la lista entera. Es el producto.
 *   · TODOS los filtros de alergia y dieta. Es seguridad alimentaria, no una
 *     función: cobrar por "sin gluten" es cobrar por no envenenar a alguien.
 *   · Los tres retoques, sin límite. Son la métrica 2, la que predice la
 *     conversión — cobrarlos es cobrar por lo único que nos dice quién va a
 *     pagar. Y la regla 5 dice que la app absorbe el fallo del martes: cobrar
 *     por rehacer el martes es cobrar por cumplir nuestra propia promesa.
 *   · Los tres niveles de proteína. Es una preferencia dietética, y ninguno de
 *     los tres es "el bueno" que se pueda vender aparte.
 *
 *     Aquí ponía que "alta le cuesta MÁS dinero al usuario, así que no hay nada
 *     premium ahí". Es falso y estaba sosteniendo esta decisión: medido sobre
 *     48 combinaciones, el precio solo sube al subir de nivel en 13 (27%), y
 *     hay casos que van al revés de largo — una persona con 65 € y poca
 *     variedad paga 41,05 € en «básica» y 30,94 € en «alta».
 *
 *     La conclusión no cambia, pero el motivo sí, y era el motivo el que
 *     importaba: no se cobra porque cobrar por comer legumbre en vez de carne
 *     es cobrar por una dieta, no por una función. Si algún día alguien busca
 *     "lo caro" para ponerlo detrás del muro, que no se apoye en este dato.
 *   · El selector de semana ya arreglado.
 *   · Cerrar la semana con el ticket.
 *   · Memoria de UNA semana: no te repite la anterior. Sin esto el motor cicla
 *     y la app se siente rota, no limitada.
 *   · La despensa de la semana inmediatamente anterior.
 *
 * COMPLETO:
 *   · Despensa acumulada con caducidad. Ahorra 8,57 €/semana netos, medido en
 *     ocho semanas seguidas. Es el argumento de venta entero.
 *   · Memoria de tres semanas (PENAL_RECIENTE completo). Baja el solape de
 *     4,3 a 0,4 de 10.
 *   · Historial de presupuestado contra pagado, y el ahorro acumulado.
 *   · Aviso del jueves de lo que va a caducar.
 *   · Lista compartida, cuando exista.
 */
export const SEMANAS_DE_MEMORIA_GRATIS = 1;
export const SEMANAS_DE_DESPENSA_GRATIS = 1;

/**
 * CUÁNTOS CAMBIOS DE PLATO SE OFRECEN SIN PAGAR.
 *
 * ═══ LA OBJECIÓN, ESCRITA AQUÍ PARA QUE NO SE PIERDA ═══
 *
 * Esto contradice lo de arriba. Tres párrafos más arriba dice, con estas
 * palabras, que los retoques van sin límite porque son la métrica 2 y "cobrarlos
 * es cobrar por lo único que nos dice quién va a pagar". Cambiar el plato de un
 * hueco es exactamente eso: un retoque, con otro nombre.
 *
 * El riesgo concreto: quien abre la hoja del día lo hace porque algo no le
 * encaja —no le gusta, no tiene tiempo, no le apetece—. Enseñarle UNA salida y
 * cobrar la segunda convierte el momento de "esto no me vale" en "y encima me
 * cobras". Es el momento con peor ánimo de todo el recorrido para pedir dinero,
 * y el que la regla 5 del proyecto dice que la app tiene que absorber.
 *
 * Contraargumento a favor: una alternativa no es una limitación de producto si
 * la que se ofrece es LA BUENA. El motor las devuelve ordenadas, así que la
 * primera es la mejor candidata; las demás son variedad, no rescate. Con esa
 * lectura, capar a una deja intacto el "arréglame el martes" y solo cobra el
 * "enséñame más opciones", que sí es acumulación y no rescate.
 *
 * ═══ CÓMO QUEDA MONTADO ═══
 *
 * La hoja enseña UNA alternativa a todo el mundo, pague o no. Lo que se cobra
 * es la SEGUNDA tanda: "ver más platos" pide dos más si hay suscripción y abre
 * el muro si no la hay. Así el tope de una es visible desde hoy —no depende de
 * la bandera— y lo único que la bandera enciende es la puerta de pago.
 *
 * De paso sale gratis en rendimiento: dos candidatos menos por hoja abierta son
 * 70 ms menos de motor cada vez que alguien toca una comida.
 *
 * Revertirlo es subir esta constante a 2 y borrar la rama del muro en
 * `verMasPlatos` (Semana.tsx).
 */
export const ALTERNATIVAS_GRATIS = 1;

/**
 * Cuántas trae cada tanda de "ver más platos". Dos y no cinco porque cada
 * candidato es una construcción entera del motor (~35 ms) y nadie compara cinco
 * platos de golpe: se mira el siguiente, y si tampoco, el siguiente.
 */
export const ALTERNATIVAS_POR_TANDA = 2;

export type EstadoSuscripcion = 'ninguna' | 'activa' | 'caducada';

/**
 * ¿Tiene acceso a lo acumulado?
 *
 * Con el muro apagado, todo el mundo. Es lo que hace que la bandera sea de
 * verdad una bandera y no una rama muerta: el resto del código pregunta aquí y
 * no sabe nada de banderas.
 */
export function tieneCompleto(estado: EstadoSuscripcion): boolean {
  if (!MURO_ACTIVO) return true;
  return estado === 'activa';
}

/**
 * AL CADUCAR, LA DESPENSA SE CONGELA. NO SE BORRA.
 *
 * Borrar datos del usuario por dejar de pagar es de las cosas que peor
 * sientan y es una fábrica de reseñas de una estrella. Lo que hay en la
 * despensa lo compró él con su dinero; que nosotros dejemos de contarlo no
 * significa que no esté en su cocina.
 *
 * Así que al caducar se deja de USAR más allá de la última semana, pero se
 * conserva entero. Volver a pagar lo recupera tal cual, sin haber perdido
 * nada — y esa es además la mejor razón para volver.
 *
 * Devuelve lo que el motor puede descontar esta semana.
 */
export function despensaVisible<T>(
  despensa: Record<string, T>,
  estado: EstadoSuscripcion,
  esDeLaSemanaPasada: (v: T) => boolean,
): Record<string, T> {
  if (tieneCompleto(estado)) return despensa;
  // Sin suscripción se usa solo lo de la semana inmediatamente anterior. El
  // resto sigue guardado y vuelve entero al pagar.
  const visible: Record<string, T> = {};
  for (const [k, v] of Object.entries(despensa)) {
    if (esDeLaSemanaPasada(v)) visible[k] = v;
  }
  return visible;
}

/** Cuántas semanas de historial puede usar el motor para no repetir. */
export function semanasDeMemoria(estado: EstadoSuscripcion, tope: number): number {
  return tieneCompleto(estado) ? tope : SEMANAS_DE_MEMORIA_GRATIS;
}
