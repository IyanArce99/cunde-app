/**
 * ═══ EL CÓDIGO POSTAL ═══
 *
 * Se pide en el onboarding y hoy NO cambia ni un precio: el catálogo cargado es
 * el de Madrid para todo el mundo. Se pide igual porque es el dato que dice en
 * qué almacenes de Mercadona hay usuarios, y sin eso la capa regional de frescos
 * habría que montarla a ciegas para 157 almacenes.
 *
 * El formato español es PPnnn: PP es la provincia, de 01 a 52.
 */

/** Lo que el usuario teclea, reducido a cifras y a cinco como mucho. */
export function limpiarCodigoPostal(texto: string): string {
  return texto.replace(/\D/g, '').slice(0, 5);
}

/**
 * Cinco cifras y una provincia que exista. No comprueba que el código esté
 * asignado —eso lo sabe Correos, no una expresión regular— y no hace falta:
 * lo que se usa de él es la zona.
 */
export function esCodigoPostal(cp: string | null | undefined): cp is string {
  if (typeof cp !== 'string' || !/^\d{5}$/.test(cp)) return false;
  const provincia = Number(cp.slice(0, 2));
  return provincia >= 1 && provincia <= 52;
}

/**
 * La provincia, que es lo único del código postal que sale del teléfono.
 *
 * Dos cifras y no las cinco: un código postal entero junto a un identificador
 * de instalación sitúa a alguien en un barrio, y para decidir qué almacén
 * cargar basta con saber cuánta gente hay en Asturias.
 */
export function provinciaDe(cp: string | null | undefined): string | undefined {
  return esCodigoPostal(cp) ? cp.slice(0, 2) : undefined;
}
