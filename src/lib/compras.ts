import { Capacitor } from '@capacitor/core';
import { Purchases, LOG_LEVEL } from '@revenuecat/purchases-capacitor';
import type { PurchasesPackage } from '@revenuecat/purchases-capacitor';
import { MURO_ACTIVO, PRODUCTOS } from './suscripcion';
import type { Plan } from './suscripcion';

/**
 * COMPRAS · la tubería, montada y apagada.
 *
 * RevenueCat y no las APIs nativas directamente porque el estado de la
 * suscripción tiene que ser el mismo en Android y en iOS, y porque restaurar
 * compras a mano es donde se rompen todas las integraciones caseras.
 *
 * NADA DE ESTO SE EJECUTA CON `MURO_ACTIVO` EN FALSE. No es una comprobación
 * defensiva: es que sin usuarios que hayan llegado a la semana 4 no se puede
 * poner precio, y arrancar el SDK crea un usuario anónimo en RevenueCat que
 * luego ensucia las métricas de conversión desde el primer día.
 *
 * En el navegador tampoco: el plugin es nativo y `Purchases` no existe ahí.
 * Toda la app se desarrolla y se prueba en Chrome, así que esto tiene que
 * degradar en silencio y no romper el arranque.
 */

/**
 * El "entitlement" de RevenueCat, que es lo que de verdad se consulta. Los
 * productos son tres pero el permiso es UNO: tener Cunde completo. Así, el día
 * que cambien los planes o se añada el de hogar, no hay que tocar el código
 * que pregunta si el usuario tiene acceso.
 */
export const PERMISO_COMPLETO = 'completo';

const enNativo = () => Capacitor.isNativePlatform();
const activable = () => MURO_ACTIVO && enNativo();

/**
 * Arranque. Se llama una vez, al montar la app.
 *
 * La clave pública de RevenueCat va por variable de entorno y NO en el
 * repositorio: es pública en el sentido de que viaja en el binario, pero
 * tenerla en el código fuente obliga a recompilar para rotarla.
 */
export async function arrancarCompras(): Promise<void> {
  if (!activable()) return;
  const apiKey = import.meta.env.VITE_REVENUECAT_ANDROID_KEY as string | undefined;
  if (!apiKey) {
    // Sin clave no se arranca, pero tampoco se rompe la app: el usuario se
    // queda en el plan gratuito, que funciona entero.
    console.warn('[compras] sin VITE_REVENUECAT_ANDROID_KEY: la app sigue en plan gratuito');
    return;
  }
  await Purchases.setLogLevel({ level: LOG_LEVEL.WARN });
  await Purchases.configure({ apiKey });
}

/**
 * ¿Tiene el permiso activo, según la tienda?
 *
 * La fuente de verdad es RevenueCat, no nuestro estado: una suscripción se
 * puede cancelar, caducar o reembolsar fuera de la app, y el reducer solo
 * guarda el último resultado de esta consulta. Por eso no se duplica la
 * decisión — el reducer refleja, no decide.
 */
export async function tienePermisoSegunLaTienda(): Promise<boolean> {
  if (!activable()) return false;
  try {
    const { customerInfo } = await Purchases.getCustomerInfo();
    return customerInfo.entitlements.active[PERMISO_COMPLETO] !== undefined;
  } catch {
    /**
     * Sin red no se degrada al plan gratuito. Quien ha pagado y abre la app en
     * el sótano del súper —donde no hay cobertura, que es literalmente nuestro
     * caso de uso— no puede perder lo que ha pagado por eso. Se conserva lo
     * último que sabíamos y se vuelve a preguntar cuando haya red.
     */
    return false;
  }
}

/** Los paquetes que la tienda ofrece de verdad, con su precio localizado. */
export async function paquetesDisponibles(): Promise<PurchasesPackage[]> {
  if (!activable()) return [];
  const { current } = await Purchases.getOfferings();
  return current?.availablePackages ?? [];
}

/**
 * Comprar. Devuelve si el permiso quedó activo.
 *
 * No se hace nada con el resultado aquí: quien llama actualiza el reducer. Los
 * precios que se cobran son los de la ficha de la tienda, no los de PRECIOS —
 * esos son para pintar antes de que la tienda responda y para razonar sobre el
 * posicionamiento.
 */
export async function comprar(plan: Plan): Promise<boolean> {
  if (!activable()) return false;
  const paquetes = await paquetesDisponibles();
  /* Un mapa y no una cadena de ternarios: la versión anterior acababa en
     `: PRODUCTOS.hogar`, así que al añadir `deporvida` habría cobrado el
     producto de hogar sin que nada fallara a la vista. Con el índice directo,
     un plan nuevo sin producto es un error de TypeScript. */
  const id = PRODUCTOS[plan];
  const paquete = paquetes.find((p) => p.product.identifier === id);
  if (!paquete) return false;
  const { customerInfo } = await Purchases.purchasePackage({ aPackage: paquete });
  return customerInfo.entitlements.active[PERMISO_COMPLETO] !== undefined;
}

/**
 * RESTAURAR COMPRAS. Apple la exige para aprobar la app, y con razón: quien
 * cambia de móvil o reinstala tiene que recuperar lo que pagó sin escribir a
 * nadie.
 */
export async function restaurarCompras(): Promise<boolean> {
  if (!activable()) return false;
  const { customerInfo } = await Purchases.restorePurchases();
  return customerInfo.entitlements.active[PERMISO_COMPLETO] !== undefined;
}
