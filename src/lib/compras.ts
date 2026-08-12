import { Capacitor } from '@capacitor/core';
import { Purchases, LOG_LEVEL } from '@revenuecat/purchases-capacitor';
import type { PurchasesPackage } from '@revenuecat/purchases-capacitor';
import { MURO_ACTIVO, PRODUCTOS } from './suscripcion';
import type { Plan } from './suscripcion';

/**
 * COMPRAS · el puente con RevenueCat.
 *
 * RevenueCat y no las APIs nativas porque el estado de la suscripción tiene que
 * ser el mismo en Android y en iOS, y porque restaurar compras a mano es donde
 * se rompen todas las integraciones caseras.
 *
 * NADA DE ESTO SE EJECUTA CON `MURO_ACTIVO` EN FALSE. No es defensa: es que sin
 * usuarios que hayan llegado a la semana 4 no se puede poner precio, y arrancar
 * el SDK crea un usuario anónimo en RevenueCat que ensucia las métricas de
 * conversión desde el primer día.
 *
 * En el navegador tampoco: el plugin es nativo y `Purchases` no existe ahí.
 * Toda la app se desarrolla y se prueba en Chrome, así que esto degrada en
 * silencio y no rompe el arranque.
 */

/**
 * ═══ UN ENTITLEMENT, TRES PRODUCTOS ═══
 *
 * Semanal, mensual y para siempre conceden EXACTAMENTE el mismo permiso. La app
 * nunca pregunta qué plan tiene alguien; pregunta si tiene Cunde+.
 *
 * Esto hay que crearlo con este nombre exacto en el panel de RevenueCat y
 * asociarle los tres productos. Ver docs/monetizacion.md.
 */
export const PERMISO_PLUS = 'cunde_plus';

/** El offering por defecto. RevenueCat sirve el marcado como «current». */
export const OFFERING = 'default';

const enNativo = () => Capacitor.isNativePlatform();
const activable = () => MURO_ACTIVO && enNativo();

/**
 * ═══ EL RESULTADO DE UNA COMPRA TIENE TRES FORMAS, NO DOS ═══
 *
 * Antes esto devolvía un booleano, y con un booleano «el usuario le dio a
 * cancelar» y «la tienda falló» son lo mismo: `false`. Y no lo son —al primero
 * hay que dejarlo en paz y al segundo hay que decirle qué pasó.
 */
export type ResultadoCompra =
  | { estado: 'ok' }
  | { estado: 'cancelada' }
  | { estado: 'fallo'; motivo?: string };

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
 * Devuelve `null` cuando NO SE PUEDE SABER, y esa es la diferencia que importa.
 *
 * ═══ EL FALLO QUE ESTO ARREGLA ═══
 *
 * Antes devolvía `boolean` y el `catch` hacía `return false`. El comentario de
 * al lado decía, con estas palabras, «sin red no se degrada al plan gratuito:
 * quien ha pagado y abre la app en el sótano del súper no puede perder lo que
 * ha pagado». El código hacía exactamente lo contrario de lo que decía el
 * comentario.
 *
 * No importaba porque nadie llamaba a esta función. En cuanto se conecta, un
 * usuario de pago sin cobertura —el caso de uso literal de la pantalla Compra—
 * se quedaba sin Cunde+.
 *
 * Con `null`, quien llama sabe que no hay respuesta y conserva lo último que
 * sabía. RevenueCat además cachea el `customerInfo` en disco, así que sin red
 * suele responder con el último estado conocido sin llegar aquí.
 */
export async function permisoSegunLaTienda(): Promise<boolean | null> {
  if (!activable()) return null;
  try {
    const { customerInfo } = await Purchases.getCustomerInfo();
    return customerInfo.entitlements.active[PERMISO_PLUS] !== undefined;
  } catch {
    return null;
  }
}

/** Los paquetes que la tienda ofrece de verdad, con su precio localizado. */
export async function paquetesDisponibles(): Promise<PurchasesPackage[]> {
  if (!activable()) return [];
  try {
    const { current } = await Purchases.getOfferings();
    return current?.availablePackages ?? [];
  } catch {
    return [];
  }
}

/**
 * ═══ LOS PRECIOS QUE SE PINTAN SALEN DE LA TIENDA ═══
 *
 * `priceString` ya viene con la moneda, el formato y los impuestos del país del
 * usuario. Escribir «3,99 €» a mano acierta en España y miente en cualquier
 * otro sitio — y además se queda viejo en cuanto se cambia el precio en Play
 * Console sin publicar app.
 *
 * Devuelve un mapa plan → texto. Vacío mientras no haya tienda: el muro pinta
 * entonces `PRECIOS`, que son los de desarrollo. Ver `MuroDePago`.
 */
export async function preciosDeLaTienda(): Promise<Partial<Record<Plan, string>>> {
  const paquetes = await paquetesDisponibles();
  if (paquetes.length === 0) return {};
  const porId = new Map(paquetes.map((p) => [p.product.identifier, p.product.priceString]));
  const salida: Partial<Record<Plan, string>> = {};
  for (const plan of Object.keys(PRODUCTOS) as Plan[]) {
    const precio = porId.get(PRODUCTOS[plan]);
    if (precio) salida[plan] = precio;
  }
  return salida;
}

/**
 * Comprar. Devuelve qué pasó, no solo si salió bien.
 *
 * Quien llama actualiza el estado. Los precios que se cobran son los de la
 * ficha de la tienda, no los de `PRECIOS` — esos son para pintar antes de que
 * la tienda responda y para razonar sobre el posicionamiento.
 */
export async function comprar(plan: Plan): Promise<ResultadoCompra> {
  if (!activable()) return { estado: 'fallo', motivo: 'compras no disponibles' };
  try {
    const paquetes = await paquetesDisponibles();
    /* Un mapa y no una cadena de ternarios: la versión anterior acababa en
       `: PRODUCTOS.hogar`, así que un plan nuevo compraba el producto de hogar
       sin que nada fallara a la vista. Con el índice directo, un plan sin
       producto es un error de TypeScript. */
    const id = PRODUCTOS[plan];
    const paquete = paquetes.find((p) => p.product.identifier === id);
    if (!paquete) return { estado: 'fallo', motivo: `sin paquete para ${id}` };

    const { customerInfo } = await Purchases.purchasePackage({ aPackage: paquete });
    return customerInfo.entitlements.active[PERMISO_PLUS] !== undefined
      ? { estado: 'ok' }
      : { estado: 'fallo', motivo: 'la compra no activó el permiso' };
  } catch (e) {
    /**
     * Cancelar NO es un error, y hay que distinguirlo o la app le enseña un
     * fallo a quien simplemente cambió de idea. RevenueCat marca ese caso con
     * `userCancelled` en el error.
     */
    const err = e as { userCancelled?: boolean; code?: string; message?: string };
    if (err?.userCancelled || err?.code === '1') return { estado: 'cancelada' };
    return { estado: 'fallo', motivo: err?.message };
  }
}

/**
 * RESTAURAR COMPRAS.
 *
 * Apple la exige para aprobar la app, y con razón: quien cambia de móvil o
 * reinstala tiene que recuperar lo que pagó sin escribir a nadie. Es además lo
 * único que hace utilizable el plan de por vida.
 *
 * Devuelve `false` cuando no hay nada que restaurar, y eso hay que decirlo tal
 * cual: fingir éxito deja al usuario creyendo que ya tiene Cunde+.
 */
export async function restaurarCompras(): Promise<ResultadoCompra & { tenia?: boolean }> {
  if (!activable()) return { estado: 'fallo', motivo: 'compras no disponibles' };
  try {
    const { customerInfo } = await Purchases.restorePurchases();
    const activo = customerInfo.entitlements.active[PERMISO_PLUS] !== undefined;
    return { estado: 'ok', tenia: activo };
  } catch (e) {
    return { estado: 'fallo', motivo: (e as { message?: string })?.message };
  }
}
