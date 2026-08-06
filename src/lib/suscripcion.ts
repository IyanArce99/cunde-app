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
 * 29,99 € al año y no 34,99 a propósito: una app que ahorra dinero no puede
 * ser cara. A 29,99 la frase de venta cabe en una línea y usa la misma unidad
 * que el producto — "te cuesta 0,57 € a la semana y la despensa te ahorró
 * 8,57 € esta semana" —, un ratio de 15 a 1.
 *
 * Banda de mercado verificada: la categoría va de 4,99 a 12 $/mes (Mealime
 * 5,99 $/mes o 49,99 $/año, Eat This Much ~5 $/mes, Plan to Eat 5,95 $/mes,
 * PlateJoy 12 $/mes). La excepción es AnyList a 9,99 $/año individual y 14,99 $
 * hogar, que es además la app con mejor retención demostrada del sector.
 * Estamos deliberadamente en la banda baja.
 */
export const PRECIOS = {
  mes: 4.99,
  anual: 29.99,
  /** Preparado. No se ofrece hasta que exista la lista compartida. */
  hogar: 39.99,
} as const;

/** Lo que cuesta la semana en el plan anual. Es la unidad con la que se vende. */
export const POR_SEMANA_ANUAL = PRECIOS.anual / 52;

/** Identificadores de producto en RevenueCat. Los mismos en las dos tiendas. */
export const PRODUCTOS = {
  mes: 'cunde_mensual',
  anual: 'cunde_anual',
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
 *   · Los tres niveles de proteína. Es una preferencia dietética, y encima
 *     "alta" le cuesta MÁS dinero al usuario: no hay nada premium ahí.
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
