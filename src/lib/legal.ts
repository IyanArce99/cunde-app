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
