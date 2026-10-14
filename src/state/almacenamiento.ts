/**
 * Las claves del estado en `localStorage`. Viven aparte de AppStateContext
 * porque también las lee data/motor.ts, antes de que exista React, para saber
 * de qué zona cargar el catálogo; e importar el contexto desde ahí sería un
 * ciclo (el contexto importa el motor).
 */

/**
 * ═══ LAS VERSIONES DEL ESTADO GUARDADO ═══
 *
 * v8 despensa · v9 código postal · v10 código postal por defecto · v11 postre
 * v12 `variedadElegida` · v13 `preferenciasPlatos` · v14 `extrasCompra`
 * v15 `fechaInicioSemana` y `semana.fechaInicio` · v16 `cambiosDePlato`.
 *
 * ═══ Y CÓMO SE MIGRABA, QUE ESTABA MAL ═══
 *
 * Hasta v12 "migrar" era cambiar esta constante. `cargarEstadoInicial` solo
 * miraba la clave nueva, así que subir de versión BORRABA todo lo del usuario:
 * su despensa acumulada, su historial de tres semanas, el contador de semana y
 * el cierre. Nadie lo notó porque en desarrollo se limpia el almacenamiento
 * cada dos por tres, pero en producción cada versión habría reseteado a todo el
 * mundo — y la despensa acumulada es literalmente lo que vendemos.
 *
 * Ahora se lee la primera clave que exista, de la más nueva a la más vieja, y
 * se funde sobre el estado por defecto. Los campos que no existían entran con
 * su valor de fábrica; los que sí, se conservan. Ver `cargarEstadoInicial`.
 */
export const STORAGE_KEY = 'cunde:estado:v16';

/**
 * De la más nueva a la más vieja. Se lee la primera que exista.
 *
 * No se listan todas desde v1: v7 y anteriores tenían el plan de la semana con
 * otra forma y rehidratarlo daría una semana rota, que es peor que empezar de
 * cero. Desde v8 el plan es compatible.
 */
export const CLAVES_ANTERIORES = [
  'cunde:estado:v15',
  'cunde:estado:v14',
  'cunde:estado:v13',
  'cunde:estado:v12',
  'cunde:estado:v11',
  'cunde:estado:v10',
  'cunde:estado:v9',
  'cunde:estado:v8',
];
