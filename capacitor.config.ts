import type { CapacitorConfig } from '@capacitor/cli';

/**
 * EL appId ES IRREVERSIBLE. Publicada la app, cambiarlo no actualiza nada:
 * crea una app NUEVA, sin reseñas, sin usuarios y sin historial. Google Play y
 * App Store lo usan como clave primaria y no admiten renombrado.
 *
 * `es.cunde.app`, y el razonamiento por si hay que revisarlo A TIEMPO:
 *
 *   · La convención es DNS invertido de un dominio propio. `es.cunde.app` se
 *     lee al derecho como app.cunde.es — producto español con dominio propio.
 *     SI ACABAS COMPRANDO cunde.app EN VEZ DE UN .es, el invertido correcto
 *     sería `app.cunde` y hay que cambiarlo antes de publicar. Después, no.
 *   · Nada de `com.` genérico sin un .com detrás: es lo que produce colisiones
 *     en las consolas.
 *   · Sin referencias a Mercadona: la marca no es nuestra y en la ficha de la
 *     tienda daría problemas.
 *
 * El mismo identificador en Android y en iOS a propósito: RevenueCat empareja
 * los productos por él, y tenerlos distintos obliga a mantener dos catálogos de
 * suscripción en paralelo.
 */
const config: CapacitorConfig = {
  appId: 'es.cunde.app',
  // Con mayúscula: es el nombre que sale bajo el icono en el móvil.
  appName: 'Cunde',
  webDir: 'dist',
};

export default config;
