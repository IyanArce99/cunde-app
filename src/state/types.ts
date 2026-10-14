import type { Existencias } from '../motor/carrito.ts';
import type { PreferenciasPlatos } from '../lib/preferencias';
import type { ExtraCompra } from '../lib/extras';
import type { FechaDia } from '../lib/fechas';

export type Comensales = '1' | '2' | '3' | '4' | '5+';

/** Un día no tiene "un plato": tiene huecos que llenar. Esta es la ranura. */
export type Ranura = 'comida' | 'cena';

/**
 * cocinado   — se cocina el plato entero.
 * sobras     — todo viene de una tanda anterior. Coste 0.
 * ensamblaje — el principal viene de antes y el acompañamiento se hace al
 *              momento (la tortilla de ayer con ensalada nueva). Coste: solo
 *              el acompañamiento.
 */
export type TipoPlato = 'cocinado' | 'sobras' | 'ensamblaje';

export interface Plato {
  nombre: string;
  minutos: number;
  precioRacion: number;
  tipo: TipoPlato;
  /**
   * ═══ LOS IDS, QUE ANTES NO BAJABAN HASTA AQUÍ ═══
   *
   * `Plato` solo llevaba el nombre visible, así que cualquier cosa que la UI
   * quisiera decirle al motor sobre un plato concreto tenía que ir por nombre.
   * Eso ya estaba señalado como frágil en el proyecto y la valoración de platos
   * lo habría multiplicado: una preferencia guardada por nombre se pierde en
   * cuanto alguien corrige una tilde en el recetario.
   *
   * `recetaId` es SIEMPRE el de la receta que se cocina — también en las sobras
   * y en los ensamblajes, porque los dos salen de esa tanda.
   * `ensamblajeId` solo está cuando el hueco es un ensamblaje CON NOMBRE PROPIO
   * ("Garbanzos salteados con huevo"), que es otro plato a ojos del usuario.
   * Ver `identidadDePlato` en lib/preferencias.ts.
   */
  recetaId: string;
  ensamblajeId?: string;
  /** De qué hueco viene lo aprovechado. En 'sobras' y 'ensamblaje'. */
  origen?: { dia: string; ranura: Ranura };
  /**
   * El plato del que sale este ensamblaje. Solo cuando el hueco es OTRO plato
   * hecho con la tanda de ayer, no el mismo recalentado: "de los garbanzos
   * del lunes". Ver Ensamblaje en src/motor/tipos.ts.
   */
  desde?: string;
  /**
   * Especias de despensa que se han quitado para que el plato encaje con un
   * filtro, ya con su nombre de verdad ("Comino molido"). La hoja del día lo
   * dice: quitar un ingrediente sin avisar es mentir sobre lo que se cocina.
   */
  omitidos?: string[];
  /**
   * Foto del plato, si la hay. Nombre de fichero en /recetas/.
   * Solo se pinta donde el usuario ya ha parado a mirar —la hoja del día y la
   * ficha— nunca en la tarjeta, que es una línea de ticket para barrer siete
   * días de un vistazo.
   */
  foto?: string;
  /**
   * ═══ EL POSTRE DE ESTA COMIDA ═══
   *
   * Cuelga del plato y no del día porque el postre es de la COMIDA: con comidas
   * y cenas hay dos al día y son distintos.
   *
   * No es un `Plato`: no se cocina, no tiene minutos, no tiene pasos y no se
   * puede cambiar por otro. Es un yogur que se saca de la nevera. Por eso lleva
   * solo lo que hace falta para decirlo y para cuadrar la cuenta, y por eso no
   * entra en `precioRacion` —que es lo que cuesta el plato y es con lo que se
   * comparan las alternativas—: se suma aparte, donde se suma el día.
   *
   * Un hueco sin plato («No cocinas») no lo enseña, porque no hay comida a la
   * que ponerle postre. Su ración sí está comprada: el coste se aparta antes de
   * saber qué huecos quedarán libres, que es justo lo que permite descontarlo
   * del presupuesto. Sale por el mismo sitio que cualquier otro sobrante.
   */
  postre?: { nombre: string; precioRacion: number };
}

export interface DiaSemana {
  dia: string;
  comida: Plato | null;
  cena: Plato | null;
}

/**
 * La semana tal y como la deja el motor, en forma guardable: referencias a
 * receta por id, no las recetas enteras. Se rehidrata contra motor-datos.json.
 */
export interface PlanSerial {
  tandas: {
    recetaId: string;
    huecosPrincipal: number;
    huecosAcompanamiento: number;
    /** El plato en que se convierte la sobra. Ver Ensamblaje. */
    ensamblajeId?: string;
  }[];
  huecos: {
    dia: string;
    ranura: Ranura;
    recetaId: string | null;
    tipo: TipoPlato | 'libre';
    origen?: { dia: string; ranura: Ranura };
    ensamblajeId?: string;
  }[];
}

export interface ItemLista {
  id: string;
  pasillo: string;
  nombre: string;
  formatoVenta: string;
  precio: number;
  paraPlato?: string;
  /** El marcado normal de la lista: ya va en el carro. */
  enElCarro: boolean;
  procedenciaPrecio?: string;
  /** El producto no está verificado como ese ingrediente (ver `Sku.sin_verificar`): la fila lo dice. */
  sinVerificar?: boolean;
  /** Despensa: aceite, sal, vinagre, especias. Sección "Por si te falta". */
  esDespensa?: boolean;
  /**
   * Solo despensa. Por defecto `true`: se da por hecho que ya lo tienes en
   * casa y queda fuera del total. Al pasarlo a `false`, el producto entra en
   * el total y se marca con `enElCarro` como cualquier otro.
   *
   * Son dos campos y no uno a propósito: en el súper, de pie y con una mano,
   * un solo control no puede significar "lo tengo en casa" y "lo llevo en el
   * carro" a la vez. Si desmarcas el aceite porque te falta, tienes que poder
   * marcarlo cuando lo eches al carro.
   */
  loTengo?: boolean;
  /**
   * La app cree que esto ya está en tu cocina, de una semana anterior. No sale
   * en los pasillos y no cuenta en el total, pero SÍ se puede corregir: si se
   * te puso malo el pimiento o te comiste el arroz, quitas la marca de
   * `loTengo` y vuelve a la lista y a la cuenta.
   *
   * Sin esto la despensa se cuadraba sola con la caducidad y nunca con la
   * realidad, y a las pocas semanas la app estaba dando por hecha comida que
   * no existe — que es la forma más rápida de perder la confianza en la cifra.
   */
  yaEnCasa?: boolean;
}

export interface Perfil {
  comensales: Comensales;
  super: string;
  presupuestoSemanal: number;
  /**
   * DÓNDE COMPRA, no dónde vive.
   *
   * Medido contra la API de Mercadona el 30 jul, seis códigos postales de seis
   * provincias (catalogo/comparar-almacenes.js):
   *
   *   · El PRECIO apenas cambia: 1,04 € sobre 145 en la misma cesta, un 0,7%.
   *     Y con un patrón limpio — 0 de 69 productos envasados cambian de precio
   *     entre almacenes; 11 de 14 de peso variable, sí. Nacional para el tarro,
   *     regional para el fresco.
   *   · Lo que cambia de verdad es la REFERENCIA: el mismo producto lleva SKU
   *     distinto según la zona (los filetes de vacuno son 8936 en Madrid y 2900
   *     en Sevilla; la dorada, 87300 en A Coruña y 81234.1 en Sevilla). 25 de
   *     nuestros 108 SKU no existen en algún almacén, pero el ingrediente sí:
   *     Sevilla tiene cinco corderos y seis doradas, con otros números.
   *
   * O sea que el código postal no hace falta para acertar el precio. Hace
   * falta para elegir el SKU correcto, que es lo que decide si el producto de
   * la lista existe en el lineal que el usuario tiene delante.
   *
   * Se guarda el CP y el ALMACÉN por separado a propósito: el almacén lo
   * resuelve Mercadona (`PUT /postal-codes/actions/change-pc/` devuelve el
   * `x-customer-wh`), así que no mantenemos ninguna tabla de 11.000 códigos —
   * pero una vez resuelto hay que conservarlo, porque la pantalla Compra
   * funciona sin conexión y ahí no se puede volver a preguntar.
   */
  codigoPostal: string | null;
  almacen: string | null;
  /**
   * QUÉ DÍA EMPIEZA LA SEMANA DEL USUARIO. `YYYY-MM-DD`, día de calendario.
   *
   * Es una PREFERENCIA: la que se usará al generar la siguiente. Lo que
   * representa la semana que ya tiene delante vive en `semana.fechaInicio`.
   *
   * Va en el perfil y no en `Preferencias` porque `Preferencias` es lo que
   * entra en la petición del motor y decide QUÉ semana sale —comidas, variedad,
   * proteína, exclusiones—, y esto no cambia ni un plato: cambia qué días son.
   * Además, todo lo que está en `Preferencias` regenera al tocarse, y esto no
   * debe regenerar nada.
   *
   * Nunca un `Date` ni un instante ISO con hora: "el 7 de agosto" es el 7 de
   * agosto en la cocina del usuario, no un momento del tiempo que pueda caer en
   * otro día según la zona. Ver lib/fechas.ts.
   */
  fechaInicioSemana: FechaDia;
}

/**
 * EL CÓDIGO POSTAL YA NO VIENE PUESTO.
 *
 * Hasta el 13 oct 2026 se arrancaba con `28001` relleno: el catálogo cargado es
 * el de Madrid, y enseñar ese código era decir la verdad sin poner un teclado
 * en la primera pantalla del embudo. El coste, que no se vio entonces, es que
 * así nunca se sabe dónde están los usuarios: todos salían de Madrid.
 *
 * Ahora empieza en `null` y el paso «¿Dónde compras?» lo pide y no deja seguir
 * sin él. Sigue sin cambiar ni un precio —`almacen` no lo lee nadie—, y la
 * pantalla lo dice. Ver lib/codigoPostal.ts.
 */

export interface Cierre {
  importeRealTicket: number | null;
  guardada: boolean;
  /**
   * ═══ CONTRA QUÉ SE COMPARABA ESE TICKET ═══
   *
   * Se congela al cerrar porque los tres números se pierden en ese mismo
   * instante: `GUARDAR_CIERRE` vacía `extrasCompra` —los extras son de ESA
   * compra— y la lista se regenera en cuanto se abre la semana siguiente.
   *
   * Sin esto, cualquier pantalla que quiera decir «previste 57,40 € y pagaste
   * 71,30 €» lee los extras de la semana NUEVA, que están vacíos, y le atribuye
   * a Cunde una diferencia de 13,90 € de los que 6,80 € eran detergente y otra
   * parte una cosa cuyo precio nadie sabía. Salió al mirar la tarjeta que se
   * comparte: afirmaba exactamente eso.
   *
   * Opcionales por compatibilidad: un cierre guardado antes de que esto
   * existiera no los tiene, y quien los use debe callarse en vez de suponer
   * cero —que es la suposición que causa el error—.
   */
  menuPrevisto?: number;
  extras?: number;
  extrasSinPrecio?: number;
}

/**
 * `de-por-vida` no caduca nunca: una vez puesto, `estadoSuscripcion` lo trata
 * como activo para siempre. Va con guiones y no con espacios porque se
 * serializa a `localStorage` y viaja a RevenueCat como identificador.
 *
 * `'año'` sigue aceptándose aunque ya no se venda: es un valor que pudo quedar
 * guardado en el móvil de alguien, y quitarlo del tipo convertiría a ese
 * usuario en no suscrito de un día para otro. Se retira cuando conste que no
 * queda ninguno.
 */
export type Suscripcion = null | 'semana' | 'mes' | 'de-por-vida' | 'año';

export type ComidasPref = 'comidas' | 'cenas' | 'ambas';
export type Esfuerzo = 'minimo' | 'normal' | 'libre';

/**
 * Cuántas recetas distintas puede usar la semana. Es la palanca de dinero más
 * grande del producto: cada receta nueva trae una proteína nueva que paga en
 * solitario un envase mínimo. La decide el usuario viendo el precio, no la
 * decido yo por él.
 */
export type Variedad = 'poca' | 'normal' | 'mucha';

/**
 * Cuánta proteína quiere. Es la segunda palanca del producto, y por la misma
 * razón que la variedad: subirla encarece el carrito Y multiplica la comida
 * que se estropea, porque la proteína fresca viene en bandejas que no caben
 * en su vida útil. No es un ajuste que se pueda acertar por el usuario.
 */
export type NivelProteina = 'basica' | 'normal' | 'alta';

export interface Preferencias {
  comidas: ComidasPref;
  esfuerzo: Esfuerzo;
  variedad: Variedad;
  /**
   * ¿La eligió el usuario, o se la pusimos nosotros?
   *
   * Los tres niveles de variedad no están ordenados por calidad —ver la
   * cabecera de `SelectorVariedad.tsx`—, así que fijar una por nombre es
   * elegir a ciegas: medido, la de arranque perdía contra otra que el motor
   * sabía montar. Mientras nadie la haya tocado, la elige `mejorVariedad()`
   * cada vez que cambia algo que la pueda mover (comensales, tope, huecos,
   * proteína, exclusiones).
   *
   * En cuanto el usuario toca el selector, esto pasa a `true` y no se le vuelve
   * a mover nunca: un ajuste que el usuario pone y la app le quita por su
   * cuenta es peor que un ajuste mal puesto de salida.
   */
  variedadElegida: boolean;
  proteina: NivelProteina;
  exclusiones: string[];
  /**
   * Postre en cada comida: yogur, fruta, gelatina. Ver motor/postres.ts.
   *
   * Apagado por defecto y no encendido: sube la cesta entre 4 y 8 € a la
   * semana según cuántos sean, y esta app existe para que nadie se lleve una
   * sorpresa en caja. Que lo encienda quien lo quiera, viendo lo que cuesta.
   */
  postre: boolean;
}

/**
 * Las restricciones han dejado el recetario sin con qué montar la semana.
 * No es un error: es un estado con salidas. Ver src/motor/seleccionar.ts.
 */
export interface SinCobertura {
  recetasVivas: number;
  huecosCubribles: number;
  huecosPedidos: number;
  /**
   * `bloqueados` es un tipo aparte de `exclusion` a propósito.
   *
   * Una alergia y un "no me lo vuelvas a poner" bloquean igual y NO se dicen
   * igual: a quien tiene puesto "sin gluten" se le pregunta si quiere quitarlo
   * —y eso es una decisión de salud que la app no debe empujar—, mientras que a
   * quien ha bloqueado cuarenta platos se le dice cuántos y se le lleva a la
   * lista para desbloquear uno. Con un solo tipo, la pantalla tendría que
   * adivinar cuál de las dos frases toca a partir del texto de `que`.
   */
  salidas: {
    tipo: 'exclusion' | 'esfuerzo' | 'comidas' | 'bloqueados';
    que: string;
    huecosCubribles: number;
  }[];
  /** Cuántos platos ha bloqueado el usuario. Para poder decir el número. */
  platosBloqueados?: number;
}

/** Ver SemanaGenerada['salida'] en src/motor/seleccionar.ts. */
export interface SalidaSemana {
  variedadMasBarata: Variedad | null;
  presupuestoNecesario: number;
  proteinaAlcanzable: NivelProteina | null;
  motivo: 'presupuesto' | 'proteina' | 'ambos';
}

export interface AppState {
  onboardingCompletado: boolean;
  perfil: Perfil;
  preferencias: Preferencias;
  /**
   * `plan` es lo que de verdad define la semana (las tandas y su reparto en
   * huecos); `dias` es la vista que pinta la UI, derivada del plan. Se guardan
   * los dos porque el plan es lo que el motor necesita para rehacer desde un
   * hueco, y recalcularlo en cada render sería tirar trabajo.
   */
  /**
   * `fechaInicio` es un HECHO de esta semana, no una preferencia.
   *
   * La preferencia vive en `Perfil.fechaInicioSemana` y dice cuándo quiero que
   * empiecen mis semanas. Ésta dice qué siete días representa la que tengo
   * delante. Son dos datos distintos y hacen falta los dos: sin este, cambiar
   * la preferencia reescribiría las fechas de una semana que a lo mejor ya está
   * comprada, y el usuario vería su lunes convertirse en viernes.
   *
   * `null` en las semanas generadas antes de esta versión: no hay forma de
   * saber qué días fueron y no se inventan. La interfaz enseña los nombres de
   * siempre cuando falta.
   */
  semana: { plan: PlanSerial; dias: DiaSemana[]; generadaEn: number; fechaInicio: FechaDia | null };
  /**
   * Lo que se comió en las semanas ya cerradas, de la más reciente a la más
   * antigua, como ids de receta. Es la MEMORIA del motor: sin ella la semana
   * 2 repetía 8 de cada 10 platos de la semana 1, porque el motor es una
   * función pura de las preferencias y con las mismas entradas devuelve el
   * mismo óptimo. Se guardan SEMANAS_DE_MEMORIA (3): a partir de ahí la
   * penalización es menor que el ruido del coste y no cambiaría ninguna
   * decisión.
   */
  historial: string[][];
  /**
   * QUÉ LE PARECE AL USUARIO CADA PLATO.
   *
   * Por id de receta o de ensamblaje, nunca por nombre: el nombre visible se
   * corrige, se le quita una tilde o se reescribe entero, y una preferencia
   * atada a él se pierde en silencio. Ver lib/preferencias.ts, que además
   * decide qué id le toca a una sobra y a un ensamblaje.
   *
   * Solo guarda lo que NO es neutral. "Está bien" borra la entrada: es lo mismo
   * que no haber dicho nada, y guardarlo llenaría el mapa de ruido.
   *
   * Los ids que ya no existen en el recetario SE CONSERVAN. Limpiarlos al
   * arrancar parece higiene y es pérdida de datos: una receta puede
   * desaparecer una versión y volver a la siguiente, y quien la había
   * bloqueado se la encontraría otra vez en la mesa sin haber cambiado de
   * opinión. No molestan: el motor los busca con `Set.has` y no casan.
   */
  preferenciasPlatos: PreferenciasPlatos;
  /**
   * LO QUE EL USUARIO AÑADE A MANO A LA COMPRA: café, papel, champú.
   *
   * Va FUERA de `lista`, y esa separación es la funcionalidad entera. `lista`
   * es lo que el motor ha calculado para el menú y `totalLista` la suma para
   * decir «tu semana cuesta 61,20 €». Si un detergente entrara ahí, esa frase
   * dejaría de ser verdad — y aunque se filtrara por un flag, bastaría un
   * `reduce` nuevo escrito sin el filtro para romperla en silencio.
   *
   * Estando en otro campo no hay nada que filtrar: las cuentas del menú no
   * pueden verlos. Ver lib/extras.ts.
   *
   * Pertenecen a UNA compra. Al cerrar la semana se vacían y se guardan en la
   * foto de `deshacerCierre`, para que deshacer los devuelva tal cual.
   */
  extrasCompra: ExtraCompra[];
  /**
   * LO QUE QUEDÓ EN CASA de las semanas anteriores, por SKU.
   *
   * Sin esto el motor arrancaba cada semana con la cocina vacía y volvía a
   * comprar lo que ya estaba en el armario. Medido con una persona sola y
   * 32 €, ocho semanas seguidas: pagaba ~31 € todas y se comía ~14 €,
   * comprando cebollas con 1,65 kg guardados y huevos con 18 en la nevera.
   * Con despensa baja a 29,29 € de carrito y sube a 17,24 € de comida.
   *
   * Se llena al CERRAR la compra, no al generar la semana: hasta que el
   * usuario no vuelve del súper no se sabe qué hay de verdad en casa.
   */
  despensa: Existencias;
  lista: ItemLista[];
  /** Presente cuando los últimos ajustes no dan para llenar la semana. */
  sinCobertura: SinCobertura | null;
  /** Presente cuando la semana no cabe o no llega al nivel. Nunca el muro. */
  salidaPresupuesto: SalidaSemana | null;
  cierre: Cierre;
  suscripcion: Suscripcion;
  /**
   * Si alguna vez hubo suscripción. Distingue "caducada" de "nunca pagó", que
   * no es lo mismo: a quien vuelve hay que poder decirle que su despensa sigue
   * entera, y a quien nunca pagó no hay nada que devolverle.
   */
  huboSuscripcion: boolean;
  /**
   * ═══ CAMBIOS VOLUNTARIOS DE PLATO GASTADOS ═══
   *
   * Guarda a QUÉ semana pertenece la cuenta, no solo cuántos van. Así no hace
   * falta ningún gancho de reseteo: si la semana guardada no es la actual, la
   * cuenta vale cero. Un contador suelto habría necesitado acordarse de ponerlo
   * a cero en `GUARDAR_CIERRE`, y de eso uno se olvida.
   *
   * `semana` es `semanaEfectiva()`, o sea el máximo entre semanas cerradas y
   * semanas transcurridas. Nace una semana nueva al cerrar la compra o al pasar
   * siete días — no al regenerar, que es lo que cierra el agujero de recuperar
   * cambios moviendo el presupuesto.
   *
   * Solo cuentan los cambios que el usuario PIDE. Ver lib/premium.ts.
   */
  cambiosDePlato: { semana: number; usados: number };
  /**
   * ═══ CON QUÉ SE HIZO ESTE PLAN Y ESTA LISTA ═══
   *
   * `zonaDelPlan`: la zona cuyo catálogo montó la semana (ver lib/zona.ts). Si
   * al arrancar la zona cargada es otra, el plan NO se reutiliza: sus productos
   * pueden no existir allí y sus precios serían de otro sitio.
   *
   * `preciosDeLaLista`: la versión de precios con la que se valoró la lista que
   * el usuario tiene delante. Es la fecha que enseña Compra.
   *
   * `preciosEnEspera`: precios más nuevos que NO se han aplicado a la lista
   * porque la compra ya estaba empezada. Entran cuando se rehace la lista.
   *
   * `avisoPrecios`: la última vez que unos precios nuevos movieron la lista sin
   * que el usuario tocara nada, con el total de antes y el de después. Una
   * actualización nunca cambia una compra en silencio: o espera, o lo dice.
   *
   * `null` en estados anteriores: el plan era de Madrid, que era lo único.
   */
  zonaDelPlan: string | null;
  preciosDeLaLista: string | null;
  preciosEnEspera: string | null;
  avisoPrecios: { desde: string; hasta: string; antes: number; despues: number } | null;
  contadores: {
    semanaNumero: number;
    ajustesEstaSemana: number;
    semanaVistaGratis: number;
    /**
     * Euros que "bájame el precio" le ha quitado a la compra desde que usa la
     * app. Es el segundo dato real que el muro puede enseñar cuando todavía no
     * hay despensa acumulada — y es suyo, no una media del sector.
     */
    bajadoConRetoques: number;
  };
  /**
   * Lo que el cierre de semana pisa, guardado para poder devolverlo.
   *
   * Cerrar la semana es la única acción de la app que no tiene vuelta: sube el
   * contador, mete los platos en el historial, cambia la despensa y arranca el
   * reloj de la siguiente. Se hace en el súper, de pie, con una mano — que es
   * exactamente donde se toca lo que no se quería tocar.
   *
   * No es el estado entero: solo los cinco campos que la acción toca. Se
   * guardan enteros y no como diferencia porque restaurar tiene que ser exacto,
   * y va en el estado persistido para que sobreviva a cerrar la app.
   */
  /**
   * Los extras entran en la foto igual que el historial y la despensa: cerrar
   * la semana los vacía —pertenecen a esa compra— y deshacer tiene que
   * devolverlos exactamente como estaban. Sin ellos aquí, deshacer restauraría
   * la semana pero el usuario habría perdido lo que apuntó a mano.
   */
  deshacerCierre: null | Pick<
    AppState, 'historial' | 'despensa' | 'cierre' | 'contadores' | 'semana' | 'extrasCompra'
  >;
}

export function numComensales(c: Comensales): number {
  return c === '5+' ? 5 : Number.parseInt(c, 10);
}

export function etiquetaComensales(c: Comensales): string {
  const n = numComensales(c);
  return n + (n === 1 ? ' persona' : ' personas');
}

/** 7 días × las comidas que pida la preferencia. */
export function numHuecos(c: ComidasPref): number {
  return c === 'ambas' ? 14 : 7;
}

/**
 * Qué ranuras se pintan y cómo se llaman. La semana de 7 huecos guarda su
 * plato siempre en `comida` — si el usuario pidió cenas es el mismo hueco
 * con otro nombre, no hace falta duplicar la variante generada.
 */
export function ranurasVisibles(c: ComidasPref): { clave: Ranura; etiqueta: string }[] {
  if (c === 'ambas') {
    return [
      { clave: 'comida', etiqueta: 'COMIDA' },
      { clave: 'cena', etiqueta: 'CENA' },
    ];
  }
  return [{ clave: 'comida', etiqueta: c === 'cenas' ? 'CENA' : 'COMIDA' }];
}

/** Todos los huecos llenos de la semana, en orden. */
export function platosDeSemana(dias: DiaSemana[]): Plato[] {
  const platos: Plato[] = [];
  for (const d of dias) {
    if (d.comida) platos.push(d.comida);
    if (d.cena) platos.push(d.cena);
  }
  return platos;
}
