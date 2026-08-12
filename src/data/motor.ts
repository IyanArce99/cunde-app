import datosJson from './motor-datos.json';
import {
  calcularCarrito, consumoDeEnsamblaje, consumoPorRacion, existenciasTrasLaSemana,
} from '../motor/carrito.ts';
import type { Existencias } from '../motor/carrito.ts';
import { platosBloqueados, platosFavoritos } from '../lib/preferencias';
import { diasDesde } from '../lib/fechas';
import type { PreferenciasPlatos } from '../lib/preferencias';
import { planDePostres, postrePorHueco, precioDeRacion } from '../motor/postres.ts';
import type { RacionPostre } from '../motor/postres.ts';
import {
  alternativasParaHueco, generarSemana, mejorVariedad, nutricionDe, recetarioAdaptado, rehacerDesde,
  repararHueco, GRAMOS_POR_NIVEL,
} from '../motor/seleccionar.ts';
import type {
  PeticionSemana, SemanaGenerada, Retoque, Variedad, NivelProteina,
} from '../motor/seleccionar.ts';
import type { Carrito, DatosMotor, Hueco, Ranura } from '../motor/tipos.ts';
import { numComensales, numHuecos } from '../state/types';
import { aplicarInstantanea, leerGuardada } from '../lib/precios';
import type { DiaSemana, ItemLista, Perfil, PlanSerial, Plato, Preferencias } from '../state/types';

export const datos = datosJson as unknown as DatosMotor;

/**
 * ═══ LOS PRECIOS GUARDADOS PISAN A LOS DEL APK · Y ES LO PRIMERO QUE PASA ═══
 *
 * Aquí, en el módulo y no en un `useEffect`, porque `datos` lo importan media
 * docena de ficheros por referencia y algunos calculan en cuanto se cargan —el
 * suelo de presupuesto de la pantalla 3/3, por ejemplo—. Si esto se hiciera
 * después de montar React, esos cálculos ya habrían salido con los precios del
 * APK y la primera cifra que ve el usuario sería la vieja.
 *
 * Es síncrono a propósito: sale de `localStorage`, no de la red. Lo que viene
 * de la red se guarda para la SIGUIENTE apertura. Ver lib/precios.ts.
 */
/**
 * La versión que de verdad está aplicada, que NO es la que se ha descargado.
 *
 * Lo cazó la prueba de navegador: con una instantánea que se descarta por
 * inverosímil —el catálogo entero a un céntimo— la cabecera seguía anunciando
 * su fecha mientras las cifras eran las del APK. O sea, la app diciendo «precios
 * del 1 de junio» debajo de precios de agosto. Se anuncia lo aplicado, no lo
 * recibido.
 */
const versionAplicada = (() => {
  const guardada = leerGuardada();
  if (!guardada || guardada.version <= datos.generadoEn) return datos.generadoEn;
  const r = aplicarInstantanea(datos, guardada);
  /**
   * `aplicados === 0` y no solo `descartada`, y la diferencia la encontró la
   * prueba de navegador.
   *
   * Con el catálogo entero a un céntimo, ninguna línea llega a `descartada`:
   * cada una se cae por su cuenta en el tope del 60% y la instantánea se queda
   * sin nada que aplicar. Mirando solo `descartada`, la cabecera anunciaba esa
   * fecha con los precios del APK debajo. Si no se aplicó ni una línea, los
   * precios son los de antes y eso es lo que hay que decir.
   */
  if (r.descartada || r.aplicados === 0) {
    console.warn(`precios: instantánea ${guardada.version} sin efecto (${r.descartada ?? 'todo rechazado'})`);
    return datos.generadoEn;
  }
  return guardada.version;
})();

/** La fecha de los precios que el usuario está viendo AHORA MISMO. */
export function versionDePrecios(): string {
  return versionAplicada;
}

/** ¿Se han aplicado precios distintos a los que trae el APK? */
export function hayPreciosNuevos(): boolean {
  return versionDePrecios() !== datos.generadoEn;
}

/**
 * Puente entre el estado de la app y el motor. El motor no sabe nada de
 * React ni de localStorage; aquí se traduce el perfil del usuario a una
 * petición y se vuelve a bajar el resultado a las formas que pinta la UI.
 */
export function peticionDe(
  perfil: Perfil,
  preferencias: Preferencias,
  semanaNumero = 1,
  historial: string[][] = [],
  existencias: Existencias = {},
  /**
   * Lo que el usuario ha dicho de los platos. Entra por aquí y no por
   * `preferencias` porque `Preferencias` es lo que se contesta en el onboarding
   * y en la hoja de ajustes —cosas que el usuario ELIGE de una lista cerrada— y
   * esto son ids del recetario que se acumulan de uno en uno. Ver
   * lib/preferencias.ts.
   */
  preferenciasPlatos: PreferenciasPlatos = {},
): PeticionSemana {
  return {
    datos,
    /* Los siete días en el orden en que los vive el usuario. Es lo único que
       necesita el motor para que su regla de fin de semana caiga donde toca.
       Ver `posicionesDeSemana` en motor/reparto.ts. */
    ordenDias: diasDesde(perfil.fechaInicioSemana),
    platosBloqueados: platosBloqueados(preferenciasPlatos),
    platosFavoritos: platosFavoritos(preferenciasPlatos),
    N: numComensales(perfil.comensales),
    numHuecos: numHuecos(preferencias.comidas),
    variedad: preferencias.variedad,
    proteina: preferencias.proteina,
    esfuerzo: preferencias.esfuerzo,
    exclusiones: preferencias.exclusiones,
    postre: preferencias.postre,
    presupuesto: perfil.presupuestoSemanal,
    // De aquí sale la FORMA de la semana. Sin él, la semana 4 tendría la
    // misma silueta que la 1 y se leería como plantilla — y la semana 4 es
    // la métrica que decide si esto es un negocio.
    semanaNumero,
    // Y de aquí sale el CONTENIDO: sin memoria, la silueta cambiaba y los
    // platos no. Ver AppState.historial.
    recetasRecientes: historial,
    // Y de aquí sale lo que NO hay que volver a comprar. Ver AppState.despensa.
    existencias,
  };
}

// --- Serialización -----------------------------------------------------------
// En localStorage no caben (ni deben caber) las recetas enteras: se guardan
// referencias por id y se rehidratan contra motor-datos.json al arrancar.

export function serializar(semana: SemanaGenerada): PlanSerial {
  return {
    tandas: semana.tandas.map((t) => ({
      recetaId: t.receta.id,
      huecosPrincipal: t.huecosPrincipal,
      huecosAcompanamiento: t.huecosAcompanamiento,
      ...(t.ensamblaje ? { ensamblajeId: t.ensamblaje.id } : {}),
    })),
    huecos: semana.huecos.map((h) => ({
      dia: h.dia,
      ranura: h.ranura,
      recetaId: h.receta?.id ?? null,
      tipo: h.tipo,
      ...(h.origen ? { origen: h.origen } : {}),
      ...(h.ensamblaje ? { ensamblajeId: h.ensamblaje.id } : {}),
    })),
  };
}

/** El ensamblaje por su id, buscando en el de la receta de la que come. */
function ensamblajePorId(recetaId: string, id: string | undefined) {
  if (!id) return undefined;
  return (datos.ensamblajes?.[recetaId] ?? []).find((e) => e.id === id);
}

/**
 * Se rehidrata contra el recetario ADAPTADO a las mismas exclusiones con las
 * que se generó, no contra el crudo. Si no, la receta que el motor montó sin
 * comino volvería con comino al recargar la página, y el carrito guardado
 * dejaría de cuadrar con el que se enseña. Ver adaptarReceta().
 */
export function hidratar(
  plan: PlanSerial,
  N: number,
  exclusiones: string[],
  proteina: NivelProteina,
  existencias: Existencias = {},
  /**
   * El postre NO se guarda en el plan, se RECALCULA. Puede hacerse porque
   * `planDePostres` es determinista: mismas restricciones, mismos comensales y
   * mismos huecos dan siempre la misma carta y el mismo reparto.
   *
   * Y hay que hacerlo. Aquí estaba el agujero: `generarParaApp` montaba la
   * semana con postre, guardaba el plan —que solo lleva tandas y huecos— y en
   * cada rehidratación el carrito se reconstruía sin postres. O sea que el
   * postre desaparecía al recargar la página, al retocar un hueco y al cerrar
   * la semana, y la cifra volvía a la de siempre sin que nadie lo tocara.
   */
  postre = false,
): SemanaGenerada {
  const recetario = recetarioAdaptado(datos, exclusiones);
  const recetaPorId = (id: string) => {
    const r = recetario.find((x) => x.id === id) ?? datos.recetas.find((x) => x.id === id);
    if (!r) throw new Error(`receta desconocida: ${id}`);
    return r;
  };

  const tandas = plan.tandas.map((t) => ({
    receta: recetaPorId(t.recetaId),
    huecosPrincipal: t.huecosPrincipal,
    huecosAcompanamiento: t.huecosAcompanamiento,
    ...(t.ensamblajeId ? { ensamblaje: ensamblajePorId(t.recetaId, t.ensamblajeId) } : {}),
  }));
  const huecos: Hueco[] = plan.huecos.map((h) => ({
    dia: h.dia,
    ranura: h.ranura,
    receta: h.recetaId ? recetaPorId(h.recetaId) : null,
    tipo: h.tipo,
    ...(h.origen ? { origen: h.origen } : {}),
    ...(h.recetaId && h.ensamblajeId
      ? { ensamblaje: ensamblajePorId(h.recetaId, h.ensamblajeId) }
      : {}),
  }));
  const postres = postre ? planDePostres(datos, exclusiones, N, plan.huecos.length) : [];
  const carrito = calcularCarrito(tandas, datos, N, existencias, postres);
  return {
    huecos,
    tandas,
    carrito,
    postres,
    recetasDistintas: [...new Set(tandas.map((t) => t.receta.nombre))],
    nutricion: nutricionDe(huecos, datos, N, GRAMOS_POR_NIVEL[proteina]),
    cuadra: true,
  };
}

// --- Bajada a las formas que pinta la UI ------------------------------------

const MINUTOS_ENSAMBLAJE = 5;

/** Lo que devuelve `postrePorHueco`: el postre que toca en cada comida. */
type PostreDeHueco = ReturnType<typeof postrePorHueco>[number];

/** Los nombres de verdad de lo que se ha quitado, para poder decirlo. */
function omitidosDe(hueco: Hueco): { omitidos: string[] } | Record<string, never> {
  const ids = hueco.receta?.omitidos ?? [];
  if (!ids.length) return {};
  return { omitidos: ids.map((id) => datos.ingredientes[id]?.nombre ?? id) };
}

function platoDeHueco(hueco: Hueco, N: number): Plato | null {
  if (hueco.tipo === 'libre' || !hueco.receta) return null;
  if (hueco.tipo === 'sobras') {
    return {
      nombre: hueco.receta.nombre, minutos: 0, precioRacion: 0, tipo: 'sobras', origen: hueco.origen,
      // Una sobra ES el mismo plato recalentado, así que lleva el id de su
      // receta y ninguno propio: valorarla es valorar el plato original.
      recetaId: hueco.receta.id,
      // Una sobra ES el mismo plato: si tiene foto, es la suya.
      ...(hueco.receta.foto ? { foto: hueco.receta.foto } : {}),
    };
  }
  if (hueco.tipo === 'ensamblaje') {
    // Un ensamblaje de verdad es OTRO PLATO hecho con la tanda de ayer: tiene
    // su nombre, sus minutos y cuesta lo que se le añade. El caso viejo —el
    // principal aguanta pero la guarnición no— sigue existiendo y se sirve
    // con el nombre del plato original.
    const e = hueco.ensamblaje;
    return {
      nombre: e ? e.nombre : hueco.receta.nombre,
      minutos: e ? e.minutos : MINUTOS_ENSAMBLAJE,
      precioRacion: Number(
        (e ? consumoDeEnsamblaje(e, datos, N) : consumoPorRacion(hueco.receta, datos, N, 'acompanamiento')).toFixed(2),
      ),
      tipo: 'ensamblaje',
      origen: hueco.origen,
      // La receta base SIEMPRE, para saber de qué tanda come. El id propio solo
      // cuando el ensamblaje tiene nombre propio: sin `e`, lo que el usuario ve
      // es el plato original servido de acompañamiento, no otro plato.
      recetaId: hueco.receta.id,
      ...(e ? { ensamblajeId: e.id, desde: hueco.receta.nombre } : {}),
      ...omitidosDe(hueco),
    };
  }
  return {
    nombre: hueco.receta.nombre,
    minutos: hueco.receta.minutos,
    precioRacion: Number(consumoPorRacion(hueco.receta, datos, N).toFixed(2)),
    tipo: 'cocinado',
    recetaId: hueco.receta.id,
    ...(hueco.receta.foto ? { foto: hueco.receta.foto } : {}),
    ...omitidosDe(hueco),
  };
}

/**
 * ═══ AQUÍ SE PERDÍA EL POSTRE ═══
 *
 * `diasDe` recorría los huecos y montaba los días sin mirar el postre, que no
 * llegaba a esta función. Resultado: encender el interruptor subía la cifra y no
 * cambiaba ni una línea de lo que el usuario ve — ni en la semana, ni al abrir
 * el día. Reportado como «sube el precio pero no sale en el menú ni en la
 * receta», y era exacto.
 *
 * El postre entra por posición: el hueco `i` de la semana lleva el postre `i` de
 * la rotación, que es la misma cuenta con la que se compran las raciones. Un
 * hueco sin plato no lo enseña; ver el comentario de `Plato.postre`.
 */
export function diasDe(huecos: Hueco[], N: number, postres: PostreDeHueco[] = []): DiaSemana[] {
  const porDia = new Map<string, DiaSemana>();
  huecos.forEach((h, i) => {
    if (!porDia.has(h.dia)) porDia.set(h.dia, { dia: h.dia, comida: null, cena: null });
    const plato = platoDeHueco(h, N);
    const postre = postres[i];
    porDia.get(h.dia)![h.ranura] = plato && postre
      ? {
        ...plato,
        postre: {
          nombre: postre.ing.nombre,
          precioRacion: Number(precioDeRacion(postre.ing, postre.sku).toFixed(2)),
        },
      }
      : plato;
  });
  return [...porDia.values()];
}

function formatearContenido(contenido: number, unidad: string): string {
  if (unidad === 'kg' || unidad === 'l') {
    if (contenido < 1) return `${Math.round(contenido * 1000)} ${unidad === 'kg' ? 'g' : 'ml'}`;
    return `${Number(contenido.toFixed(2))} ${unidad === 'kg' ? 'kg' : 'L'}`;
  }
  return `${contenido} uds`;
}

export function listaDe(carrito: Carrito, huecos: Hueco[], postres: RacionPostre[] = []): ItemLista[] {
  // Qué platos usan cada canónico, para la línea "para: ...". Si lo usa más
  // de uno no se atribuye a ninguno: repartir el envase sería inventar.
  const platosPorCanonico = new Map<string, Set<string>>();
  for (const h of huecos) {
    if (!h.receta || h.tipo !== 'cocinado') continue;
    for (const ing of h.receta.ingredientes) {
      if (!platosPorCanonico.has(ing.canonico)) platosPorCanonico.set(ing.canonico, new Set());
      platosPorCanonico.get(ing.canonico)!.add(h.receta.nombre);
    }
  }
  /* Los canónicos que están en la lista por el postre. Sin esto, el yogur y el
     plátano salían como dos filas más sin decir de dónde venían: el usuario veía
     productos que no había pedido y que no correspondían a ningún plato. */
  const canonicosDePostre = new Set(postres.map((p) => p.ingrediente.id));

  return carrito.lineas
    .map((l) => {
      const usan = new Set(l.canonicos.flatMap((c) => [...(platosPorCanonico.get(c) ?? [])]));
      const esPostre = l.canonicos.some((c) => canonicosDePostre.has(c));
      /* «para: el postre» y no un nombre de plato: el postre no es de ninguno
         en concreto, es de toda la semana. La fila se lee igual que las demás y
         deja de ser un producto aparecido de la nada. */
      const paraPlato = esPostre ? 'el postre' : (usan.size === 1 ? [...usan][0] : undefined);
      const base = `${l.packaging ?? 'Unidad'} ${formatearContenido(l.contenidoEnvase, l.unidad)}`;
      /**
       * Lo que sale ENTERO del armario tiene `compras: 0`, así que su
       * `carritoCoste` es cero. No se puede dejar en cero: si el usuario dice
       * que no lo tiene, ese producto tiene que entrar en la cuenta por lo que
       * cuesta comprarlo. Se calcula el envase que haría falta.
       */
      // Vale también para la despensa declarada: un aceite que ya está en el
      // armario tiene `compras: 0`, y si se excluía por `esDespensa` se
      // quedaba a 0,00 € — al quitarle la marca el total no se movía y la
      // corrección no llegaba al motor. Los dos motivos son independientes.
      const yaEnCasa = l.compras === 0;
      const envases = yaEnCasa ? Math.max(1, Math.ceil(l.necesario / l.contenidoEnvase)) : l.compras;
      // El precio por unidad sale del consumo, que es lo único que esta línea
      // tiene valorado cuando no se compra nada: consumoCoste = necesario × ppu.
      const porUnidad = l.necesario > 0 ? l.consumoCoste / l.necesario : 0;
      const precio = yaEnCasa
        ? Number((envases * l.contenidoEnvase * porUnidad).toFixed(2))
        : Number(l.carritoCoste.toFixed(2));
      return {
        id: l.sku,
        pasillo: l.departamento.toUpperCase(),
        nombre: l.nombre,
        formatoVenta: envases > 1 ? `${base} ×${envases}` : base,
        precio,
        ...(paraPlato ? { paraPlato } : {}),
        enElCarro: false,
        /**
         * Solo se etiqueta lo EXCEPCIONAL. "precio del 28 jul" iba en las 27
         * filas, decía lo mismo en todas y gastaba una línea entera por
         * producto en la pantalla que se usa de pie, con una mano y empujando
         * un carro. La fecha del catálogo es una sola y va una sola vez, arriba
         * de la lista.
         *
         * "peso variable" sí se queda en la fila: es lo único que distingue un
         * precio que se va a cumplir de uno que depende de lo que pese la
         * pieza, y eso hay que saberlo delante del lineal, no en una cabecera.
         */
        ...(l.pesoVariable ? { procedenciaPrecio: 'peso variable' } : {}),
        ...(l.esDespensa ? { esDespensa: true, loTengo: true } : {}),
        ...(yaEnCasa ? { yaEnCasa: true, loTengo: true } : {}),
        // Y si es despensa PERO hay que comprarla, sigue siendo "por si te
        // falta": se da por hecha aunque no haya sobrante que la respalde.
      } satisfies ItemLista;
    })
    .sort((a, b) => ordenDePasillo(a.pasillo) - ordenDePasillo(b.pasillo)
      || a.nombre.localeCompare(b.nombre));
}

/**
 * ═══ EL ORDEN DE LOS PASILLOS ES EL DEL SÚPER, NO EL DEL DICCIONARIO ═══
 *
 * Aquí había `a.pasillo.localeCompare(b.pasillo)`, o sea orden alfabético. La
 * lista abría por APERITIVOS y seguía por ARROZ, LEGUMBRES Y PASTA — no porque
 * sea por donde se entra, sino porque empiezan por A.
 *
 * Eso rompe la regla 6 del proyecto: la pantalla Compra se usa de pie, con una
 * mano, empujando un carro. Recorrer el súper en orden de diccionario obliga a
 * volver sobre tus pasos entre secciones que están en extremos opuestos, y la
 * lista deja de ser una ruta para ser un índice.
 *
 * `orden_pasillo` está en el modelo de datos de CLAUDE.md, pero **nunca se
 * capturó**: los productos del catálogo traen `departamento` y `subfamilia` y
 * nada más. Así que el orden va aquí, explícito, hasta que el dato exista.
 *
 * ═══ ESTE ORDEN ES UNA HIPÓTESIS RAZONADA, NO UN DATO MEDIDO ═══
 *
 * Sale del recorrido típico de un Mercadona: se entra por fruta y verdura, el
 * fresco va por el perímetro, el seco por el centro y los congelados caen cerca
 * de las cajas. **No está verificado en tienda**, y las tiendas varían.
 *
 * Comprobarlo cuesta una compra con el móvil en la mano, y corregirlo es mover
 * una línea de esta lista. Está montado así a propósito: cualquier orden
 * plausible bate al alfabético, y este se arregla sin tocar lógica.
 *
 * Un departamento que no esté aquí cae al final en vez de romper nada — es lo
 * que pasará cuando el catálogo crezca, y descolocar un pasillo nuevo es mejor
 * que perderlo.
 */
const ORDEN_PASILLOS = [
  'Fruta y verdura',
  'Carne',
  'Marisco y pescado',
  'Charcutería y quesos',
  'Panadería y pastelería',
  'Huevos, leche y mantequilla',
  'Postres y yogures',
  'Conservas, caldos y cremas',
  'Arroz, legumbres y pasta',
  'Aceite, especias y salsas',
  'Aperitivos',
  'Pizzas y platos preparados',
  'Congelados',
];

/**
 * Se compara en mayúsculas porque `pasillo` ya viene con `.toUpperCase()`
 * aplicado (ver arriba) y la lista de arriba está escrita como el catálogo, en
 * capitalización normal. Sin esto no casaba ni uno: todos caían al final con el
 * mismo rango, el orden quedaba en manos de la ordenación previa del carrito y
 * el arreglo no hacía nada — medido en navegador antes de darlo por bueno.
 */
const ORDEN_EN_MAYUSCULAS = ORDEN_PASILLOS.map((p) => p.toUpperCase());

function ordenDePasillo(pasillo: string): number {
  const i = ORDEN_EN_MAYUSCULAS.indexOf(pasillo.toUpperCase());
  return i === -1 ? ORDEN_EN_MAYUSCULAS.length : i;
}

// --- Lo que usa el estado ----------------------------------------------------

export interface SemanaParaApp {
  plan: PlanSerial;
  dias: DiaSemana[];
  lista: ItemLista[];
  carrito: Carrito;
  recetasDistintas: string[];
  /** Lo que esta semana no hay que comprar porque ya está en casa. */
  delArmario: { productos: number; valor: number };
  cuadra: boolean;
  salida?: SemanaGenerada['salida'];
  sinCobertura?: SemanaGenerada['sinCobertura'];
}

/**
 * La rotación de postres, reconstruida desde el plan de raciones.
 *
 * No hace falta que el motor la devuelva aparte: `postres` viene en el orden de
 * la carta y la rotación es esa misma carta por turnos, así que el hueco `i`
 * lleva el postre que ocupa la posición `i` módulo el número de postres. Es la
 * misma cuenta que hizo `postrePorHueco` al repartir las raciones, leída al
 * revés.
 *
 * Vale mientras haya al menos tantas comidas como postres en la carta —siempre:
 * son 7 o 14 comidas contra 4 postres como mucho—. Con menos, algún postre se
 * quedaría a cero raciones, saldría del plan y la cuenta se desalinearía; por
 * eso está dicho aquí y no dado por supuesto.
 */
function rotacionDePostres(semana: SemanaGenerada): PostreDeHueco[] {
  const plan = semana.postres;
  if (!plan.length) return [];
  return semana.huecos.map((_, i) => {
    const p = plan[i % plan.length];
    return { ing: p.ingrediente, sku: p.sku };
  });
}

function bajar(semana: SemanaGenerada, N: number): SemanaParaApp {
  const postres = rotacionDePostres(semana);
  return {
    plan: serializar(semana),
    dias: diasDe(semana.huecos, N, postres),
    lista: listaDe(semana.carrito, semana.huecos, semana.postres),
    carrito: semana.carrito,
    recetasDistintas: semana.recetasDistintas,
    delArmario: {
      productos: semana.carrito.lineas.filter((l) => l.compras === 0).length,
      valor: semana.carrito.totalDelArmario,
    },
    cuadra: semana.cuadra,
    salida: semana.salida,
    sinCobertura: semana.sinCobertura,
  };
}

export function generarParaApp(
  perfil: Perfil,
  preferencias: Preferencias,
  semanaNumero = 1,
  historial: string[][] = [],
  existencias: Existencias = {},
  preferenciasPlatos: PreferenciasPlatos = {},
): SemanaParaApp {
  const peticion = peticionDe(perfil, preferencias, semanaNumero, historial, existencias, preferenciasPlatos);
  return bajar(generarSemana(peticion), peticion.N);
}

/**
 * Retocar un hueco. "Cambiar" y "libre" van por la reparación LOCAL: se
 * deshace solo la tanda que cubre ese hueco y el resto de la semana no se
 * mueve — tocar el martes ya no reescribe el jueves. Si con el resto
 * congelado no hay ningún candidato, se recurre al reparto global de
 * rehacerDesde, que es honesto pero ruidoso (la hoja de confirmación enseña
 * el diff completo antes de aplicar nada).
 *
 * "Barato" sigue siendo global a propósito: pedir "lo más barato de aquí al
 * domingo" ES pedir que se reorganice.
 */
export function retocarParaApp(
  perfil: Perfil,
  preferencias: Preferencias,
  plan: PlanSerial,
  indiceHueco: number,
  retoque: Retoque,
  semanaNumero = 1,
  historial: string[][] = [],
  existencias: Existencias = {},
  preferenciasPlatos: PreferenciasPlatos = {},
): SemanaParaApp {
  const peticion = peticionDe(perfil, preferencias, semanaNumero, historial, existencias, preferenciasPlatos);
  const actual = hidratar(
    plan, peticion.N, preferencias.exclusiones, preferencias.proteina, existencias, preferencias.postre,
  );
  const local = retoque === 'barato' ? null : repararHueco(peticion, actual, indiceHueco, retoque);
  return bajar(local ?? rehacerDesde(peticion, actual, indiceHueco, retoque), peticion.N);
}

/** Lo que la hoja del día necesita para ofrecer "cambiar por". */
export interface AlternativaParaApp {
  recetaId: string;
  nombre: string;
  minutos: number;
  deltaRacion: number;
  /** La semana ya rehecha con este plato, lista para guardar sin recalcular. */
  semana: SemanaParaApp;
}

/**
 * DOS O TRES PLATOS QUE PODRÍAN IR EN ESE HUECO, con su diferencia por ración.
 *
 * Cada uno viene con SU semana ya construida, no con una promesa: al elegir
 * uno se guarda esa misma semana. Si se recalculara al aplicar, el motor podría
 * devolver otra cosa y el usuario habría elegido un precio que no recibe.
 */
/**
 * Cuál de las tres semanas desperdicia menos, con este perfil. Ver
 * `mejorVariedad` en el motor: el criterio y por qué es ese están allí.
 *
 * Vive aquí y no en el contexto de estado porque es el motor quien lo sabe, y
 * porque así usa el mismo `peticionDe` que todo lo demás — si se armara la
 * petición a mano, un día mediría una semana distinta de la que se genera.
 */
export function variedadQueMenosDesperdicia(
  perfil: Perfil,
  preferencias: Preferencias,
  semanaNumero = 1,
  historial: string[][] = [],
  existencias: Existencias = {},
  preferenciasPlatos: PreferenciasPlatos = {},
): Variedad {
  return mejorVariedad(peticionDe(perfil, preferencias, semanaNumero, historial, existencias, preferenciasPlatos));
}

export function alternativasParaApp(
  perfil: Perfil,
  preferencias: Preferencias,
  plan: PlanSerial,
  indiceHueco: number,
  semanaNumero = 1,
  historial: string[][] = [],
  existencias: Existencias = {},
  /* Dos de salida. Cada una cuesta una construcción entera del motor (~35 ms),
     así que la cuarta y la quinta solo se pagan si alguien las pide. */
  cuantas = 2,
  preferenciasPlatos: PreferenciasPlatos = {},
): AlternativaParaApp[] {
  const peticion = peticionDe(perfil, preferencias, semanaNumero, historial, existencias, preferenciasPlatos);
  const actual = hidratar(
    plan, peticion.N, preferencias.exclusiones, preferencias.proteina, existencias, preferencias.postre,
  );
  return alternativasParaHueco(peticion, actual, indiceHueco, cuantas).map((a) => ({
    recetaId: a.recetaId,
    nombre: a.nombre,
    minutos: a.minutos,
    deltaRacion: a.deltaRacion,
    semana: bajar(a.semana, peticion.N),
  }));
}

/**
 * QUÉ QUEDA EN CASA al cerrar la semana: lo que había, más lo comprado, menos
 * lo consumido, con una semana menos de vida. Se llama al guardar el cierre y
 * no al generar, porque hasta que el usuario no vuelve del súper no se sabe
 * qué hay de verdad en la cocina.
 */
export function despensaTrasLaSemana(
  perfil: Perfil,
  preferencias: Preferencias,
  plan: PlanSerial,
  antes: Existencias = {},
): Existencias {
  if (!plan.tandas.length) return antes;
  const N = numComensales(perfil.comensales);
  const semana = hidratar(plan, N, preferencias.exclusiones, preferencias.proteina, antes, preferencias.postre);
  return existenciasTrasLaSemana(semana.carrito, antes);
}

/**
 * ═══ VOLVER A PONERLE PRECIO A UNA LISTA YA GUARDADA ═══
 *
 * Sin esto, actualizar los precios sin publicar versión quedaba a medias y
 * MENTÍA: la cabecera de la pantalla Compra decía «precios del 1 de enero»
 * porque la instantánea ya se había aplicado, pero las cifras de la lista eran
 * las del día en que se generó la semana. Salió en la prueba de navegador — la
 * fecha cambiaba y el total no.
 *
 * El plan es la fuente de la verdad; la lista es un derivado. Así que se vuelve
 * a derivar contra el catálogo de ahora y se le devuelven al usuario sus marcas
 * —lo que ya lleva en el carro y lo que ha dicho que tiene en casa—, que es lo
 * único suyo que hay en esa lista.
 *
 * Devuelve la lista de entrada si algo no cuadra. Perder los precios nuevos es
 * una imprecisión de céntimos; perder la lista de la compra en el súper es
 * quedarse sin la app.
 */
export function reprecioDeLista(
  lista: ItemLista[],
  plan: PlanSerial,
  perfil: Perfil,
  preferencias: Preferencias,
  existencias: Existencias = {},
): ItemLista[] {
  if (!lista.length || !plan?.tandas?.length) return lista;
  try {
    const N = numComensales(perfil.comensales);
    const semana = hidratar(
      plan, N, preferencias.exclusiones, preferencias.proteina, existencias, preferencias.postre,
    );
    const frescas = listaDe(semana.carrito, semana.huecos, semana.postres);
    /* Lo que el usuario ha tocado, por id de producto. `loTengo` puede ser
       `false` a propósito —«esto NO lo tengo»— así que se distingue de que no
       esté puesto, que es lo que ya arregló una vez la despensa. */
    const suyo = new Map(lista.map((it) => [it.id, it]));
    return frescas.map((it) => {
      const antes = suyo.get(it.id);
      if (!antes) return it;
      return {
        ...it,
        enElCarro: antes.enElCarro,
        ...(antes.loTengo !== undefined ? { loTengo: antes.loTengo } : {}),
      };
    });
  } catch {
    return lista;
  }
}

/** Índice del hueco (día, ranura) dentro del plan. */
export function indiceDeHueco(plan: PlanSerial, dia: string, ranura: Ranura): number {
  return plan.huecos.findIndex((h) => h.dia === dia && h.ranura === ranura);
}

export type { Variedad, NivelProteina, Retoque };
