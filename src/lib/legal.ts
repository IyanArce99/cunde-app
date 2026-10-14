/**
 * Dónde está la política de privacidad.
 *
 * `www.` y `.html` a propósito, porque es lo único que responde hoy (14 oct
 * 2026): `https://cunde.app/…` falla por el certificado (solo cubre `www`) y
 * `/privacidad` sin `.html` da 404 hasta que se despliegue landing/vercel.json
 * con `cleanUrls`. Cuando el dominio esté arreglado, esta URL sigue valiendo:
 * Vercel redirige `.html` a la ruta limpia.
 */
export const URL_PRIVACIDAD = 'https://www.cunde.app/privacidad.html';

/**
 * A dónde escribe quien prueba la beta. La misma dirección que la web.
 *
 * El 14 oct 2026 `cunde.app` NO tiene registros MX: lo que se mande aquí
 * rebota. Hay que activar una redirección de correo en el registrador antes de
 * repartir la beta (docs/lanzamiento-beta.md). Si se usa otra dirección, se
 * cambia aquí y en landing/src.
 */
export const CORREO_CONTACTO = 'hola@cunde.app';

/**
 * El enlace de «Cuéntanos qué falla»: abre el correo del teléfono con la
 * versión y la zona ya puestas. Nada más: ni presupuesto, ni filtros, ni el
 * código postal. Lo que quiera contar, lo escribe la persona.
 */
export function enlaceDeOpinion(zona: string): string {
  const asunto = `Cunde ${__VERSION_APP__} · ${zona}`;
  const cuerpo = ['Qué ha pasado:', '', '', 'En qué pantalla:', '', '', `— Cunde ${__VERSION_APP__} · ${zona}`].join('\n');
  return `mailto:${CORREO_CONTACTO}?subject=${encodeURIComponent(asunto)}&body=${encodeURIComponent(cuerpo)}`;
}
