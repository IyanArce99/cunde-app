import datosJson from './motor-datos.json';
import {
  calcularCarrito, consumoDeEnsamblaje, consumoPorRacion, existenciasTrasLaSemana,
} from '../motor/carrito.ts';
import type { Existencias } from '../motor/carrito.ts';
import { planDePostres } from '../motor/postres.ts';
import {
  generarSemana, nutricionDe, recetarioAdaptado, rehacerDesde, repararHueco, GRAMOS_POR_NIVEL,
} from '../motor/seleccionar.ts';
import type {
  PeticionSemana, SemanaGenerada, Retoque, Variedad, NivelProteina,
} from '../motor/seleccionar.ts';
import type { Carrito, DatosMotor, Hueco, Ranura } from '../motor/tipos.ts';
import { numComensales, numHuecos } from '../state/types';
import type { DiaSemana, ItemLista, Perfil, PlanSerial, Plato, Preferencias } from '../state/types';

export const datos = datosJson as unknown as DatosMotor;

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
): PeticionSemana {
  return {
    datos,
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
      ...(e ? { desde: hueco.receta.nombre } : {}),
      ...omitidosDe(hueco),
    };
  }
  return {
    nombre: hueco.receta.nombre,
    minutos: hueco.receta.minutos,
    precioRacion: Number(consumoPorRacion(hueco.receta, datos, N).toFixed(2)),
    tipo: 'cocinado',
    ...(hueco.receta.foto ? { foto: hueco.receta.foto } : {}),
    ...omitidosDe(hueco),
  };
}

export function diasDe(huecos: Hueco[], N: number): DiaSemana[] {
  const porDia = new Map<string, DiaSemana>();
  for (const h of huecos) {
    if (!porDia.has(h.dia)) porDia.set(h.dia, { dia: h.dia, comida: null, cena: null });
    porDia.get(h.dia)![h.ranura] = platoDeHueco(h, N);
  }
  return [...porDia.values()];
}

function formatearContenido(contenido: number, unidad: string): string {
  if (unidad === 'kg' || unidad === 'l') {
    if (contenido < 1) return `${Math.round(contenido * 1000)} ${unidad === 'kg' ? 'g' : 'ml'}`;
    return `${Number(contenido.toFixed(2))} ${unidad === 'kg' ? 'kg' : 'L'}`;
  }
  return `${contenido} uds`;
}

export function listaDe(carrito: Carrito, huecos: Hueco[]): ItemLista[] {
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

  return carrito.lineas
    .map((l) => {
      const usan = new Set(l.canonicos.flatMap((c) => [...(platosPorCanonico.get(c) ?? [])]));
      const paraPlato = usan.size === 1 ? [...usan][0] : undefined;
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
    .sort((a, b) => a.pasillo.localeCompare(b.pasillo) || a.nombre.localeCompare(b.nombre));
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

function bajar(semana: SemanaGenerada, N: number): SemanaParaApp {
  return {
    plan: serializar(semana),
    dias: diasDe(semana.huecos, N),
    lista: listaDe(semana.carrito, semana.huecos),
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
): SemanaParaApp {
  const peticion = peticionDe(perfil, preferencias, semanaNumero, historial, existencias);
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
): SemanaParaApp {
  const peticion = peticionDe(perfil, preferencias, semanaNumero, historial, existencias);
  const actual = hidratar(
    plan, peticion.N, preferencias.exclusiones, preferencias.proteina, existencias, preferencias.postre,
  );
  const local = retoque === 'barato' ? null : repararHueco(peticion, actual, indiceHueco, retoque);
  return bajar(local ?? rehacerDesde(peticion, actual, indiceHueco, retoque), peticion.N);
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

/** Índice del hueco (día, ranura) dentro del plan. */
export function indiceDeHueco(plan: PlanSerial, dia: string, ranura: Ranura): number {
  return plan.huecos.findIndex((h) => h.dia === dia && h.ranura === ranura);
}

export type { Variedad, NivelProteina, Retoque };
