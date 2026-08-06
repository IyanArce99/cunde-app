import type { Existencias } from '../motor/carrito.ts';

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
}

/**
 * EL CÓDIGO POSTAL CON EL QUE SE ARRANCA.
 *
 * Viene puesto, y eso NO es rellenar un dato por el usuario: es enseñar el que
 * la app ya está usando. Hoy el catálogo cargado es el de Madrid y el motor
 * tira de él tanto si el campo está vacío como si no —`almacen` no lo lee
 * nadie todavía—, así que un campo en blanco no significaba "zona
 * desconocida": significaba "Madrid, y sin decirlo".
 *
 * Lo que se gana además es que el onboarding entero deja de tener teclado. Era
 * el único, y estaba en la primera pantalla del embudo: cinco cifras a mano
 * antes de haber visto nada del producto.
 *
 * Cuando haya catálogo por almacén esto pasa a ser lo que parece —el CP de
 * verdad del usuario— y quien no lo cambie seguirá recibiendo Madrid, igual
 * que hoy. La nota bajo el campo dice de dónde son los precios, y avisa en
 * cuanto se escribe uno de otra provincia.
 */
export const CP_POR_DEFECTO = '28001';

export interface Cierre {
  importeRealTicket: number | null;
  guardada: boolean;
}

export type Suscripcion = null | 'mes' | 'año';

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
  salidas: { tipo: 'exclusion' | 'esfuerzo' | 'comidas'; que: string; huecosCubribles: number }[];
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
  semana: { plan: PlanSerial; dias: DiaSemana[]; generadaEn: number };
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
  deshacerCierre: null | Pick<AppState, 'historial' | 'despensa' | 'cierre' | 'contadores' | 'semana'>;
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
