import { EXCLUSIONES, FILTROS } from '../motor/seleccionar.ts';

/**
 * El orden en que se enseñan las restricciones. Es una decisión de producto,
 * no del motor: por FRECUENCIA REAL en España, no por categoría ni por el
 * orden en que las fui implementando. Quien busca "gluten" o "lactosa" lo
 * encuentra en la primera línea; la mostaza y los sulfitos, que casi nadie
 * excluye, van al final.
 *
 * Alergia y preferencia van separadas porque son cosas distintas: es la misma
 * línea que decide si las trazas bloquean o no, y la que decide si sale el
 * aviso de "comprueba la etiqueta".
 */
export const ALERGIAS = [
  'Gluten', 'Lactosa', 'Huevo', 'Frutos secos', 'Marisco', 'Pescado',
  'Cacahuete', 'Soja', 'Sésamo', 'Apio', 'Sulfitos', 'Mostaza',
];

export const DIETAS = ['Vegetariano', 'Vegano', 'Cerdo'];

/**
 * Un filtro que el motor sabe aplicar pero que la app no enseña es un filtro
 * que no existe para el usuario — y en alérgenos eso es un agujero de
 * seguridad, no un descuido de UI. Al revés, uno que se enseña y el motor no
 * conoce es una promesa falsa. Las dos cosas se rompen en silencio, así que
 * se comprueban al arrancar.
 */
const enLaApp = new Set([...ALERGIAS, ...DIETAS]);
const sinEnsenar = EXCLUSIONES.filter((e) => !enLaApp.has(e));
const inventados = [...enLaApp].filter((e) => !FILTROS[e]);

if (sinEnsenar.length) {
  throw new Error(`El motor filtra "${sinEnsenar.join('", "')}" y la app no lo ofrece. Ver src/lib/restricciones.ts`);
}
if (inventados.length) {
  throw new Error(`La app ofrece "${inventados.join('", "')}" y el motor no sabe filtrarlo. Ver src/motor/seleccionar.ts`);
}
