import { createContext, useContext, useEffect, useMemo, useReducer } from 'react';
import type { ReactNode } from 'react';
import type { AppState, Comensales, Perfil, PlanSerial, Preferencias, Ranura, Suscripcion } from './types';
import { numComensales, numHuecos } from './types';
import { tramoDiferencia, tramoImporte, tramoPresupuesto } from '../lib/analitica-buckets';
import {
  despensaTrasLaSemana, generarParaApp, indiceDeHueco, retocarParaApp, variedadPorDefecto,
} from '../data/motor';
import { SEMANAS_DE_MEMORIA } from '../motor/seleccionar.ts';
import { despensaVisible, semanasDeMemoria } from '../lib/suscripcion';
import { analitica } from '../lib/analitica';
import { provinciaDe } from '../lib/codigoPostal';
import { permisoSegunLaTienda } from '../lib/compras';
import { conValoracion, cuentaPreferencias, huellaPreferencias } from '../lib/preferencias';
import { crearExtra, extrasSinPrecio, totalExtras } from '../lib/extras';
import { semanaEfectiva, totalLista } from '../lib/derive';
import { aFechaDia, diasDesde, esFechaDia, hoy, sumarDias, diasEntre } from '../lib/fechas';
import { tieneCundePlus } from '../lib/premium';
import type { FechaDia } from '../lib/fechas';
import type { ValoracionPlato } from '../lib/preferencias';
import type { ExtraCompra } from '../lib/extras';
import type { EstadoSuscripcion } from '../lib/suscripcion';
import { datos, reprecioDeLista, versionDePrecios, zonaCargada } from '../data/motor';
import type { Retoque, SemanaParaApp } from '../data/motor';
import { CLAVES_ANTERIORES, STORAGE_KEY } from './almacenamiento';

// Las versiones del estado guardado y su migración: ver state/almacenamiento.ts.

const estadoInicial: AppState = {
  onboardingCompletado: false,
  perfil: {
    comensales: '2',
    super: 'Mercadona',
    presupuestoSemanal: 65,
    // Vacío de salida: lo pide el onboarding y no deja seguir sin él. Ver la
    // nota sobre el código postal en types.ts.
    codigoPostal: null,
    almacen: null,
    /* Hoy. Sin preguntar: quien acaba el onboarding un viernes quiere empezar
       el viernes, y una pregunta más en el embudo cuesta más de lo que aporta
       — se cambia de un toque desde ajustes. */
    fechaInicioSemana: hoy(),
  },
  preferencias: {
    // `variedad` es solo el valor de partida hasta la primera generación: con
    // `variedadElegida: false`, `regenerar` pone la alta si cabe y, si no, la
    // que menos desperdicia. Ver variedadPorDefecto() en data/motor.ts.
    comidas: 'ambas', esfuerzo: 'libre', variedad: 'mucha', variedadElegida: false,
    proteina: 'normal', exclusiones: [], postre: false,
  },
  semana: { plan: { tandas: [], huecos: [] }, dias: [], generadaEn: 0, fechaInicio: null },
  historial: [],
  preferenciasPlatos: {},
  extrasCompra: [],
  despensa: {},
  lista: [],
  sinCobertura: null,
  salidaPresupuesto: null,
  cierre: { importeRealTicket: null, guardada: false },
  suscripcion: null,
  huboSuscripcion: false,
  /* Semana 0 para que no coincida con ninguna real: quien migre desde una
     versión anterior entra con cero cambios usados, que es lo correcto. */
  cambiosDePlato: { semana: 0, usados: 0 },
  zonaDelPlan: null,
  preciosDeLaLista: null,
  preciosEnEspera: null,
  avisoPrecios: null,
  contadores: { semanaNumero: 1, ajustesEstaSemana: 0, semanaVistaGratis: 0, bajadoConRetoques: 0 },
  deshacerCierre: null,
};

type Accion =
  | { type: 'SET_COMENSALES'; comensales: Comensales }
  | { type: 'SET_SUPER'; super: string }
  | { type: 'SET_CODIGO_POSTAL'; codigoPostal: string | null; almacen: string | null }
  | { type: 'SET_PRESUPUESTO'; presupuesto: number }
  | {
    type: 'SET_AJUSTES';
    preferencias: Preferencias;
    perfil: Pick<Perfil, 'comensales' | 'presupuestoSemanal'>;
  }
  | { type: 'COMPLETAR_ONBOARDING' }
  | { type: 'TOGGLE_ITEM'; id: string }
  | { type: 'TOGGLE_PASILLO'; pasillo: string; marcar: boolean }
  | { type: 'TOGGLE_LO_TENGO'; id: string }
  | { type: 'GUARDAR_CIERRE'; importeRealTicket: number }
  | { type: 'DESHACER_CIERRE' }
  | { type: 'OLVIDAR_DESHACER' }
  | { type: 'SET_SUSCRIPCION'; plan: Suscripcion }
  | { type: 'SEGUIR_GRATIS'; numeroSemana: number }
  /** El botón «Preparar siguiente semana». Ver `tocaAbrirLaSiguiente`. */
  | { type: 'PREPARAR_SIGUIENTE_SEMANA' }
  | { type: 'SET_PREFERENCIAS'; preferencias: Preferencias }
  | { type: 'RETOCAR_HUECO'; dia: string; ranura: Ranura; retoque: Retoque }
  | { type: 'APLICAR_SEMANA'; semana: SemanaParaApp }
  | { type: 'VALORAR_PLATO'; platoId: string; valoracion: ValoracionPlato; tipo: 'receta' | 'ensamblaje' }
  /** «Aplicar al menú»: rehace la semana con los platos valorados. Ver el caso. */
  | { type: 'APLICAR_PREFERENCIAS_PLATOS' }
  | { type: 'ANADIR_EXTRA'; nombre: string; precio: number | null }
  | { type: 'QUITAR_EXTRA'; id: string }
  | { type: 'TOGGLE_EXTRA'; id: string }
  | { type: 'PRECIO_EXTRA'; id: string; precio: number | null }
  | { type: 'SET_INICIO_SEMANA'; fecha: FechaDia; origen: 'hoy' | 'manana' | 'lunes' | 'elegida' };

/**
 * Vuelve a montar la semana entera con el motor. Si las restricciones no dan
 * para llenarla, NO se borra la semana que el usuario ya tiene delante: se
 * guarda el diagnóstico y la pantalla ofrece las salidas. Dejarle sin nada
 * sería el muro que CLAUDE.md prohíbe.
 */
/**
 * EL BLOQUEO VA AQUÍ, NO EN EL ENRUTADOR.
 *
 * Lo que se paga —la despensa acumulada y la memoria de tres semanas— no son
 * pantallas: son dos parámetros que entran en el motor. Ponerlo aquí tiene una
 * propiedad que un muro de rutas no tiene: NO SE PUEDE ESQUIVAR POR URL,
 * porque no hay URL que esquivar. El plan gratuito ve su semana entera, su
 * lista entera y todas las rutas de la app; lo que no tiene es memoria.
 *
 * Y la despensa NO SE BORRA al caducar: se conserva entera en el estado y solo
 * se deja de descontar más allá de la última semana. Volver a pagar la
 * recupera tal cual. Ver lib/suscripcion.ts.
 */
export function estadoSuscripcion(estado: AppState): EstadoSuscripcion {
  if (estado.suscripcion) return 'activa';
  return estado.huboSuscripcion ? 'caducada' : 'ninguna';
}

/**
 * `previa`: la semana que se está sustituyendo, SOLO cuando se rehace la misma
 * semana por un cambio de ajustes. Nunca al abrir la semana siguiente, que
 * tiene que ser otra.
 */
function regenerar(estado: AppState, previa?: PlanSerial): AppState {
  const sus = estadoSuscripcion(estado);
  const memoria = estado.historial.slice(0, semanasDeMemoria(sus, SEMANAS_DE_MEMORIA));
  // Sin suscripción, solo lo que sobró de la semana pasada (semanas === 0).
  const despensa = despensaVisible(estado.despensa, sus, (v) => (v.semanas ?? 0) === 0);

  /**
   * QUÉ SEMANA DARLE A QUIEN NO HA ELEGIDO NINGUNA.
   *
   * Antes era `variedad: 'normal'` fija. Los tres niveles no están ordenados
   * por calidad, así que eso es elegir por nombre: medido, el arranque perdía
   * contra otra que el motor sabía montar. Luego lo decidió `mejorVariedad`,
   * la que menos desperdicia. Desde el 15 oct 2026 es la ALTA si cabe, y
   * `mejorVariedad` si no: ver `variedadPorDefecto` en data/motor.ts. Deja de
   * hacerlo en cuanto el usuario elige en el selector.
   *
   * Perfiles que ya existían con `variedadElegida: false` (la eligió la app):
   * pasan a la regla nueva en su SIGUIENTE generación —semana nueva, ajustes
   * o cambio de zona—. La semana que tienen abierta no se toca: puede estar a
   * medio comprar, y rehacerla por debajo rompería la lista que llevan.
   *
   * Cuesta tres construcciones en vez de una, ~70 ms más. Se pagan solas: van
   * al mismo caché que consulta la hoja de ajustes, así que el selector de
   * variedad, que antes se abría con "···" y rellenaba después, ya está
   * calculado cuando se abre.
   */
  const preferencias = estado.preferencias.variedadElegida
    ? estado.preferencias
    : {
      ...estado.preferencias,
      variedad: variedadPorDefecto(
        estado.perfil, estado.preferencias, estado.contadores.semanaNumero, memoria, despensa,
        estado.preferenciasPlatos,
      ),
    };

  // Dos cosas evitan que la semana 2 se parezca a la 1: el número de semana,
  // del que sale la SILUETA (qué días llevan hueco aprovechado), y el
  // HISTORIAL, que penaliza los platos de las semanas cerradas. Sin el
  // segundo, la silueta cambiaba y los platos no.
  //
  // Y aquí es donde entra lo que el usuario ha dicho de los platos: al
  // GENERAR, no al valorar. Ver el caso VALORAR_PLATO.
  const semana = generarParaApp(
    estado.perfil, preferencias, estado.contadores.semanaNumero, memoria, despensa,
    estado.preferenciasPlatos, previa,
  );
  /**
   * La semana que se acaba de montar QUEDA ATADA a la fecha con que se montó.
   *
   * Ese es el segundo dato de fecha y aquí se ve por qué hacen falta los dos:
   * la preferencia puede cambiar mañana y esta semana tiene que seguir
   * representando los mismos siete días. Ver AppState.semana.fechaInicio.
   */
  const fechaInicio = estado.perfil.fechaInicioSemana;
  if (semana.sinCobertura) {
    analitica('generation_failed_by_disliked_dishes', {
      week_number: estado.contadores.semanaNumero,
      source_screen: 'semana',
      total_disliked_dishes: semana.sinCobertura.platosBloqueados ?? 0,
    });
  } else {
    /**
     * ═══ EL EVENTO QUE DECIDE SI ESTO ES UN NEGOCIO ═══
     *
     * `regenerar` es el ÚNICO punto por el que pasa una semana montada, venga
     * de completar el onboarding, de guardar ajustes o de cambiar los
     * comensales. Por eso el evento va aquí y no en cada pantalla: instrumentar
     * los sitios que llaman a esto sería contar la misma semana varias veces o
     * ninguna, según el camino.
     *
     * `week_number` es lo que convierte esto en una métrica de retención: la
     * semana 2, la 3 y la 4 son un `where` sobre este mismo evento.
     *
     * Nada de importes: tramo de presupuesto y un booleano de si cabe. Cuántos
     * filtros hay, no cuáles — una alergia concreta es un dato de salud.
     */
    analitica('week_generated', {
      week_number: estado.contadores.semanaNumero,
      people: numComensales(estado.perfil.comensales),
      meals: numHuecos(preferencias.comidas),
      within_budget: semana.carrito.totalCarrito <= estado.perfil.presupuestoSemanal,
      budget_bucket: tramoPresupuesto(estado.perfil.presupuestoSemanal),
      has_diet_filters: preferencias.exclusiones.length > 0,
      diet_filters_count: preferencias.exclusiones.length,
      has_dessert: !!preferencias.postre,
      variety: preferencias.variedad,
      protein: preferencias.proteina,
    });

    const { bloqueados, favoritos } = cuentaPreferencias(estado.preferenciasPlatos);
    if (bloqueados + favoritos > 0) {
      analitica('generation_affected_by_preferences', {
        week_number: estado.contadores.semanaNumero,
        total_disliked_dishes: bloqueados,
        total_liked_dishes: favoritos,
      });
    }
  }
  if (semana.sinCobertura) return { ...estado, preferencias, sinCobertura: semana.sinCobertura };
  return {
    ...estado,
    preferencias,
    semana: {
      plan: semana.plan, dias: semana.dias, generadaEn: Date.now(), fechaInicio,
      preferenciasAlGenerar: huellaPreferencias(estado.preferenciasPlatos),
    },
    lista: semana.lista,
    sinCobertura: null,
    salidaPresupuesto: semana.cuadra ? null : (semana.salida ?? null),
    // Generar cierra la ventana de deshacer. La instantánea no guarda la lista
    // —el cierre no la tocaba— así que restaurarla con una semana nueva ya
    // puesta dejaría el menú de antes con la compra de ahora.
    deshacerCierre: null,
  };
}

/**
 * La semana siguiente se monta AQUÍ, al pasar el muro, y no al cerrar la
 * compra. Cerrar la compra pasa en el súper: el usuario acaba de comprar
 * ESTA comida y va a cocinarla toda la semana, así que cambiarle el menú en
 * ese momento sería tirarle a la basura el plan que tiene en el carro.
 *
 * Sin esto la app se quedaba clavada: cerrabas la semana, el contador subía,
 * el historial se guardaba... y seguías viendo el mismo menú para siempre,
 * porque nada volvía a llamar al motor salvo cambiar una preferencia. Se vio
 * en el navegador —la semana 2 repetía 10 de 10 platos— y no era la memoria
 * fallando: era que la semana 2 nunca llegaba a generarse.
 */
/**
 * ═══ CUÁNDO EMPIEZA LA SEMANA SIGUIENTE ═══
 *
 * Dos casos, y el umbral es un día:
 *
 *   · Se genera EN CALIENTE, el mismo día del cierre o el siguiente → empieza
 *     donde acababa la anterior. Es lo que espera quien cierra la compra del
 *     domingo y planifica la semana que viene: continuidad.
 *   · Han pasado más días → empieza HOY. Proponerle el 14 de agosto a quien
 *     vuelve el 22 es proponerle una semana que ya pasó, y la app estaría
 *     planificando el pasado.
 *
 * Un solo umbral y no una escala: cualquier cosa más fina —"si han pasado dos
 * días, a medias"— sería una regla que nadie puede predecir mirando la app.
 */
function inicioDeLaSiguiente(anterior: FechaDia | null): FechaDia {
  const ahora = hoy();
  if (!anterior) return ahora;
  const siguiente = sumarDias(anterior, 7);
  /* Ni un día en el pasado. Hasta el 14 oct 2026 se admitía uno (`>= -1`):
     cuando la siguiente se abría al cerrar la compra del domingo, el lunes era
     mañana. Ahora se prepara cuando la vigente ya ha acabado, así que
     «siguiente» casi siempre es hoy o ya pasó, y una semana que empieza ayer
     nace con un día perdido. Con el muro, que sigue abriendo al cerrar,
     «siguiente» está en el futuro y no cambia nada. */
  return diasEntre(ahora, siguiente) >= 0 ? siguiente : ahora;
}

function abrirSemanaSiTocaba(estado: AppState): AppState {
  if (!estado.cierre.guardada) return estado;
  /* La contabilidad de la semana que se deja, sobre el plan tal y como quedó.
     Va aquí y no en GUARDAR_CIERRE; ver ese caso. `cierre.guardada` se apaga en
     la misma acción, así que no puede contarse dos veces. */
  const comidas = [...new Set(estado.semana.plan.tandas.map((t) => t.recetaId))];
  const inicioNueva = inicioDeLaSiguiente(estado.semana.fechaInicio);
  /* Lo que sobró ha pasado en la nevera desde que empezó la semana vieja hasta
     que empieza la nueva: siete días si se prepara a tiempo, más si no. Nunca
     menos de siete: con el muro la nueva se prepara al cerrar la compra, y esa
     comida se cocina igual durante la semana que queda. */
  const diasEnLaNevera = estado.semana.fechaInicio
    ? Math.max(DIAS_DE_UNA_SEMANA, diasEntre(estado.semana.fechaInicio, inicioNueva))
    : DIAS_DE_UNA_SEMANA;
  return regenerar({
    ...estado,
    historial: [comidas, ...estado.historial].slice(0, SEMANAS_DE_MEMORIA),
    // Lo que sobró se queda en el armario para la semana que viene: sin esto
    // el motor volvía a comprar cebollas con 1,65 kg en casa.
    despensa: despensaTrasLaSemana(
      estado.perfil, estado.preferencias, estado.semana.plan, estado.despensa, diasEnLaNevera,
    ),
    perfil: { ...estado.perfil, fechaInicioSemana: inicioNueva },
    cierre: { importeRealTicket: null, guardada: false },
    contadores: {
      ...estado.contadores,
      semanaNumero: estado.contadores.semanaNumero + 1,
      ajustesEstaSemana: 0,
    },
  });
}

const DIAS_DE_UNA_SEMANA = 7;

/**
 * ═══ CUÁNDO SE OFRECE PREPARAR LA SEMANA SIGUIENTE ═══
 *
 * Cuando la compra está cerrada Y ya han pasado los siete días de la semana
 * vigente. Las dos cosas: cerrar el ticket el lunes no quita el menú del
 * lunes, y que pasen los días sin haber cerrado no da por comprada una compra
 * que nadie ha confirmado.
 *
 * Y se OFRECE, no se hace. La semana pasa cuando el usuario pulsa «Preparar
 * siguiente semana» en Semana (`PREPARAR_SIGUIENTE_SEMANA`). Del 13 al 14 oct
 * de 2026 se hacía sola al arrancar o al volver a primer plano, y eso le
 * quitaba el menú a quien compra tarde: cierra el ticket el día 9 de una
 * semana que empezó el 1, y al abrir la app al día siguiente ya no estaban ni
 * los platos ni las recetas de lo que acababa de comprar.
 *
 * Existe porque la única puerta era el muro (`SEGUIR_GRATIS` y
 * `SET_SUSCRIPCION`), y con el muro apagado y sin tienda configurada nadie la
 * cruzaba: se cerraba la compra y la app enseñaba esa semana para siempre.
 *
 * Solo para quien no tiene el muro delante. Si lo tiene, la semana siguiente
 * se sigue abriendo al pasarlo, como siempre.
 *
 * Todo sale del estado y del reloj del móvil: funciona sin conexión.
 */
export function tocaAbrirLaSiguiente(estado: AppState, hoyDia: FechaDia = hoy()): boolean {
  if (!estado.onboardingCompletado || !estado.cierre.guardada) return false;
  if (!tieneCundePlus(estado)) return false;
  /* Las semanas anteriores a las fechas no saben cuándo empezaron: se usa el
     día en que se generaron, que es lo más cerca que se puede estar. */
  const inicio = estado.semana.fechaInicio
    ?? (estado.semana.generadaEn ? aFechaDia(new Date(estado.semana.generadaEn)) : null);
  if (!inicio) return false;
  return diasEntre(sumarDias(inicio, DIAS_DE_UNA_SEMANA), hoyDia) >= 0;
}

/* Exportado solo para los tests: comprobar que valorar un plato NO mueve la
   semana y que regenerar SÍ la aplica no se puede hacer desde fuera del
   reducer sin montar la app entera. Ver preferencias.motor.test.ts. */
export function reducer(estado: AppState, accion: Accion): AppState {
  return conHuellaDelPlan(estado, reducerSinHuella(estado, accion));
}

/**
 * Cada plan nuevo apunta de qué zona es y con qué precios se valoró su lista.
 * Va aquí, envolviendo al reducer, y no en cada caso que regenera: son una
 * docena y el día que se añada otro nadie se acordaría. Ver AppState.zonaDelPlan.
 */
function conHuellaDelPlan(antes: AppState, despues: AppState): AppState {
  if (despues.semana.plan === antes.semana.plan) return despues;
  return {
    ...despues,
    zonaDelPlan: zonaCargada().zona,
    preciosDeLaLista: versionDePrecios(),
    preciosEnEspera: null,
    avisoPrecios: null,
  };
}

function reducerSinHuella(estado: AppState, accion: Accion): AppState {
  switch (accion.type) {
    case 'SET_COMENSALES': {
      const siguiente = { ...estado, perfil: { ...estado.perfil, comensales: accion.comensales } };
      return estado.onboardingCompletado ? regenerar(siguiente) : siguiente;
    }
    case 'SET_SUPER':
      return { ...estado, perfil: { ...estado.perfil, super: accion.super } };
    /**
     * NO regenera la semana. Hoy solo hay un catálogo cargado, así que cambiar
     * el código postal no cambia ningún precio todavía; el día que haya
     * catálogo por almacén, este caso pasa a llamar a regenerar() y ese es el
     * único cambio que hará falta. Se guarda desde ya para que el dato exista
     * cuando llegue ese momento y para poder decir en pantalla de dónde son
     * los precios que se están enseñando.
     */
    case 'SET_CODIGO_POSTAL':
      return {
        ...estado,
        perfil: { ...estado.perfil, codigoPostal: accion.codigoPostal, almacen: accion.almacen },
      };
    case 'SET_PRESUPUESTO':
      return { ...estado, perfil: { ...estado.perfil, presupuestoSemanal: accion.presupuesto } };
    case 'COMPLETAR_ONBOARDING':
      /* Antes de regenerar: así el par onboarding_completed → week_generated
         queda en ese orden, que es como se lee el embudo. */
      analitica('onboarding_completed', {
        people: numComensales(estado.perfil.comensales),
        budget_bucket: tramoPresupuesto(estado.perfil.presupuestoSemanal),
        has_diet_filters: estado.preferencias.exclusiones.length > 0,
        diet_filters_count: estado.preferencias.exclusiones.length,
        province: provinciaDe(estado.perfil.codigoPostal),
      });
      return regenerar({ ...estado, onboardingCompletado: true });
    case 'TOGGLE_ITEM':
      return {
        ...estado,
        lista: estado.lista.map((it) => (it.id === accion.id ? { ...it, enElCarro: !it.enElCarro } : it)),
      };
    /**
     * Marcar un pasillo entero. `marcar` viene decidido desde la pantalla y no
     * se invierte aquí: si se calculara dentro, un pasillo a medias podría
     * quedarse oscilando según qué fila mirase primero. La regla es una y va
     * escrita en la vista: si falta alguno, se marcan todos; si están todos,
     * se quitan todos.
     *
     * No toca los que están fuera de cuentas —despensa dada por hecha o
     * sobrante de la semana pasada—: esos no están en ningún pasillo.
     */
    case 'TOGGLE_PASILLO':
      return {
        ...estado,
        lista: estado.lista.map((it) => {
          if (it.pasillo !== accion.pasillo) return it;
          if ((it.esDespensa || it.yaEnCasa) && it.loTengo !== false) return it;
          return { ...it, enElCarro: accion.marcar };
        }),
      };
    case 'TOGGLE_LO_TENGO': {
      const item = estado.lista.find((it) => it.id === accion.id);
      const lista = estado.lista.map(
        (it) => (it.id === accion.id ? { ...it, loTengo: it.loTengo === false } : it),
      );
      // Si lo que se desmarca es un sobrante de una semana anterior, la
      // corrección tiene que llegar al MOTOR: si solo cambiara la lista, la
      // semana siguiente volvería a dar por hecho ese producto. La despensa
      // se cuadraba sola con la caducidad y nunca con la realidad.
      if (item?.yaEnCasa && item.loTengo !== false && estado.despensa[accion.id]) {
        // Desestructurar para omitir: la clave que sale no se usa, solo se
        // deja fuera del resto.
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { [accion.id]: _fuera, ...resto } = estado.despensa;
        return { ...estado, lista, despensa: resto };
      }
      return { ...estado, lista };
    }
    case 'GUARDAR_CIERRE': {
      /**
       * ═══ CERRAR LA COMPRA NO ES ACABAR LA SEMANA ═══
       *
       * Se cierra en el súper, con la comida recién comprada y siete días de
       * cocina por delante. Aquí solo se guarda el ticket. El historial, la
       * despensa y el número de semana se mueven al ABRIR la siguiente —ver
       * `abrirSemanaSiTocaba`—, y no es un detalle de orden:
       *
       *   · Hasta el 13 oct 2026 se movían aquí, y era inocuo porque lo
       *     siguiente era siempre el muro y, detrás, la semana nueva. Con el
       *     muro apagado la semana cerrada sigue vigente varios días, y
       *     retocarla, regenerarla o volver a ponerle precio con la despensa ya
       *     actualizada descontaba de ella sus propios sobrantes.
       *   · Y lo que se cuenta al abrir es la semana tal y como QUEDÓ: si el
       *     jueves se dijo «no cocino», eso ya está en el plan.
       */

      /**
       * El final del embudo. Tramo de desviación, no el importe del ticket:
       * para saber si Cunde acierta con el presupuesto basta el tramo, y el
       * importe exacto de la compra de alguien junto a su número de semana ya
       * empieza a señalar a una persona. Ese dato lo tiene el usuario en su
       * móvil; no hace falta una segunda copia en un servidor.
       *
       * `items_checked` sobre `items_total` responde lo que ninguna otra cosa
       * responde: si la lista se USA en el súper o solo se abre.
       */
      {
        const previsto = totalLista(estado.lista);
        const extras = totalExtras(estado.extrasCompra);
        analitica('checkout_completed', {
          week_number: estado.contadores.semanaNumero,
          screen: 'cierre',
          within_budget: accion.importeRealTicket <= estado.perfil.presupuestoSemanal,
          difference_bucket: tramoDiferencia(previsto + extras, accion.importeRealTicket),
          has_extras: estado.extrasCompra.length > 0,
          has_unpriced_extras: extrasSinPrecio(estado.extrasCompra) > 0,
          items_checked: estado.lista.filter((i) => i.enElCarro).length,
          items_total: estado.lista.length,
        });
      }

      return {
        ...estado,
        cierre: {
          importeRealTicket: accion.importeRealTicket,
          guardada: true,
          /* La foto de contra qué se comparaba. Se toma AQUÍ porque los extras
             se vacían tres líneas más abajo y la lista se regenera al abrir la
             semana siguiente. Ver la cabecera de `Cierre`. */
          menuPrevisto: totalLista(estado.lista),
          extras: totalExtras(estado.extrasCompra),
          extrasSinPrecio: extrasSinPrecio(estado.extrasCompra),
        },
        /**
         * Y los extras se vacían: pertenecen a ESTA compra.
         *
         * El café que apuntaste esta semana no tiene por qué estar en la lista
         * de la siguiente — y si lo arrastráramos, la lista se convertiría poco
         * a poco en una lista permanente de la compra, que es exactamente lo
         * que este producto no es. La copia queda en `deshacerCierre`.
         */
        extrasCompra: [],
        // La foto de antes, para poder volver. Ver AppState.deshacerCierre.
        deshacerCierre: {
          historial: estado.historial,
          despensa: estado.despensa,
          cierre: estado.cierre,
          contadores: estado.contadores,
          semana: estado.semana,
          extrasCompra: estado.extrasCompra,
        },
      };
    }
    /**
     * Volver al momento anterior al cierre. Devuelve los cinco campos tal cual
     * estaban y borra la propia oferta de deshacer: se ofrece una vez, no es
     * una papelera. La lista de la compra no se toca porque el cierre tampoco
     * la tocó — lo que llevabas marcado sigue marcado.
     */
    case 'DESHACER_CIERRE':
      return estado.deshacerCierre
        ? { ...estado, ...estado.deshacerCierre, deshacerCierre: null }
        : estado;
    case 'OLVIDAR_DESHACER':
      return estado.deshacerCierre ? { ...estado, deshacerCierre: null } : estado;
    case 'SET_SUSCRIPCION':
      return abrirSemanaSiTocaba({
        ...estado,
        suscripcion: accion.plan,
        // Se marca para siempre: es lo que distingue "caducada" de "nunca
        // pagó", y lo que permite decirle a quien vuelve que su despensa
        // sigue ahí en vez de tratarlo como nuevo.
        huboSuscripcion: estado.huboSuscripcion || accion.plan !== null,
      });
    case 'SEGUIR_GRATIS':
      return abrirSemanaSiTocaba({
        ...estado,
        contadores: { ...estado.contadores, semanaVistaGratis: accion.numeroSemana },
      });
    case 'PREPARAR_SIGUIENTE_SEMANA':
      /* Si no toca —una segunda pulsación, un estado recargado que ya pasó—
         devuelve el MISMO objeto: la transición no puede hacerse dos veces. */
      return tocaAbrirLaSiguiente(estado) ? abrirSemanaSiTocaba(estado) : estado;
    case 'SET_PREFERENCIAS': {
      const siguiente = {
        ...estado,
        preferencias: accion.preferencias,
        contadores: { ...estado.contadores, ajustesEstaSemana: estado.contadores.ajustesEstaSemana + 1 },
      };
      /**
       * Se compara la preferencia ENTERA, no una lista de campos.
       *
       * Aquí había una enumeración —comidas, variedad, proteína, esfuerzo,
       * exclusiones— y funcionaba hasta que se añadió el postre: la
       * preferencia se guardaba, la hoja se cerraba, y la semana seguía siendo
       * la de antes. Nada fallaba a la vista, simplemente el motor no se
       * volvía a llamar. Costó encontrarlo precisamente porque no rompía nada.
       *
       * Con la comparación completa, la próxima preferencia que se añada entra
       * sola. `JSON.stringify` vale porque el objeto es plano y sus claves se
       * escriben siempre en el mismo orden —lo construye la hoja de ajustes en
       * un único sitio— y porque el coste de un falso positivo es regenerar de
       * más, mientras que el de un falso negativo es este bug.
       */
      const cambiaLaSemana =
        JSON.stringify(accion.preferencias) !== JSON.stringify(estado.preferencias);
      return cambiaLaSemana && estado.onboardingCompletado ? regenerar(siguiente, estado.semana.plan) : siguiente;
    }
    /**
     * ═══ LO QUE GUARDA LA HOJA DE AJUSTES · TODO DE UNA VEZ ═══
     *
     * La hoja cambia preferencias Y perfil (cuántos sois, cuánto tienes), y
     * encadenar `SET_COMENSALES` + `SET_PRESUPUESTO` + `SET_PREFERENCIAS`
     * fallaba de dos maneras a la vez:
     *
     *   · De más: `SET_COMENSALES` regenera con el tope VIEJO y `SET_PREFERENCIAS`
     *     vuelve a regenerar con el nuevo. Dos reconstrucciones de 2,6 s para
     *     una semana, y la primera para tirarla.
     *   · De menos: si solo mueves el tope, `SET_PRESUPUESTO` no regenera —nunca
     *     lo ha hecho— y `SET_PREFERENCIAS` tampoco, porque las preferencias no
     *     han cambiado. Guardabas 80 € y seguías viendo la semana de 51.
     *
     * Lo segundo es el mismo bug que ya tuvo el postre y por el que la
     * comparación de arriba dejó de ser una lista de campos: se guarda, la hoja
     * se cierra, y la semana es la de antes. No rompe nada a la vista.
     *
     * Una acción, un estado siguiente, una regeneración si algo cambió.
     */
    case 'SET_AJUSTES': {
      const perfil = { ...estado.perfil, ...accion.perfil };
      const siguiente = {
        ...estado,
        perfil,
        preferencias: accion.preferencias,
        contadores: { ...estado.contadores, ajustesEstaSemana: estado.contadores.ajustesEstaSemana + 1 },
      };
      const cambiaLaSemana =
        JSON.stringify(accion.preferencias) !== JSON.stringify(estado.preferencias)
        || perfil.comensales !== estado.perfil.comensales
        || perfil.presupuestoSemanal !== estado.perfil.presupuestoSemanal;
      return cambiaLaSemana && estado.onboardingCompletado ? regenerar(siguiente, estado.semana.plan) : siguiente;
    }
    case 'RETOCAR_HUECO': {
      // Se rehace desde ese hueco con el mismo motor: cambia el reparto, la
      // lista de la compra y el total. Ya no hay huecos intocables.
      const indice = indiceDeHueco(estado.semana.plan, accion.dia, accion.ranura);
      if (indice < 0) return estado;
      const semana = retocarParaApp(
        estado.perfil, estado.preferencias, estado.semana.plan, indice, accion.retoque,
        estado.contadores.semanaNumero, estado.historial, estado.despensa, estado.preferenciasPlatos,
      );
      // Lo que se ahorra con el retoque se acumula: es el dato real que el
      // muro enseña cuando todavía no hay despensa. Solo suma si BAJA.
      const antes = estado.lista.reduce((a, it) => a + (((it.esDespensa || it.yaEnCasa) && it.loTengo !== false) ? 0 : it.precio), 0);
      const ahora = semana.lista.reduce((a, it) => a + (((it.esDespensa || it.yaEnCasa) && it.loTengo !== false) ? 0 : it.precio), 0);
      const bajada = Math.max(0, antes - ahora);
      return {
        ...estado,
        semana: { ...estado.semana, plan: semana.plan, dias: semana.dias },
        lista: semana.lista,
        contadores: {
          ...estado.contadores,
          ajustesEstaSemana: estado.contadores.ajustesEstaSemana + 1,
          bajadoConRetoques: estado.contadores.bajadoConRetoques + bajada,
        },
      };
    }
    /**
     * APLICAR UNA SEMANA YA CONSTRUIDA.
     *
     * La usa "cambiar por" de la hoja del día: el motor devolvió dos o tres
     * alternativas, cada una con SU semana completa, y el usuario ha elegido
     * una viendo su precio. Aquí solo se guarda.
     *
     * No se recalcula a propósito. Si se volviera a llamar al motor, podría
     * devolver una semana distinta de la que se enseñó con ese delta, y el
     * usuario habría elegido un ahorro que no recibe — que en una app cuya
     * tesis es la cifra es el peor fallo posible.
     */
    /**
     * ═══ EL CAMBIO VOLUNTARIO DE PLATO · Y EL ÚNICO QUE GASTA ═══
     *
     * Esta acción tiene UN despachador en toda la app: elegir una alternativa
     * en la hoja del día. O sea, exactamente «quiero otro plato aquí».
     *
     * Lo demás va por `RETOCAR_HUECO` y NO gasta nada, cada cosa por su motivo:
     *   · «Bájame el precio» es la promesa central del producto. Cobrar por
     *     bajar la cesta a quien se ha pasado sería vender la solución al
     *     problema que la app dice resolver.
     *   · «No cocino este día» es absorber el fallo del martes, que es la regla
     *     5 del proyecto.
     *   · Bloquear un plato es una preferencia persistente («no me lo vuelvas a
     *     poner»), no una personalización de esta semana.
     * Y ninguna regeneración del sistema pasa por aquí: `regenerar()` es otra
     * cosa. Así que ni un cambio de alergia, ni un SKU que desaparezca, ni una
     * corrección automática pueden gastar un cambio del usuario.
     *
     * Se cuenta SIEMPRE, también con Cunde+. No hace falta funcionalmente
     * —ilimitado es ilimitado— pero si la suscripción caduca a mitad de semana
     * el contador ya refleja la realidad, en vez de aparecer a cero y regalar
     * dos cambios más.
     */
    case 'APLICAR_SEMANA': {
      const antes = estado.lista.reduce((a, it) => a + (((it.esDespensa || it.yaEnCasa) && it.loTengo !== false) ? 0 : it.precio), 0);
      const ahora = accion.semana.lista.reduce((a, it) => a + (((it.esDespensa || it.yaEnCasa) && it.loTengo !== false) ? 0 : it.precio), 0);
      /* La semana a la que pertenece la cuenta. Si la guardada es otra, esta
         empieza de cero: el reseteo no necesita ningún gancho. */
      const semanaAhora = semanaEfectiva(estado.contadores.semanaNumero, estado.semana.generadaEn);
      const yaUsados = estado.cambiosDePlato.semana === semanaAhora ? estado.cambiosDePlato.usados : 0;
      return {
        ...estado,
        semana: { ...estado.semana, plan: accion.semana.plan, dias: accion.semana.dias },
        lista: accion.semana.lista,
        cambiosDePlato: { semana: semanaAhora, usados: yaUsados + 1 },
        contadores: {
          ...estado.contadores,
          ajustesEstaSemana: estado.contadores.ajustesEstaSemana + 1,
          bajadoConRetoques: estado.contadores.bajadoConRetoques + Math.max(0, antes - ahora),
        },
      };
    }
    /**
     * ═══ VALORAR NO REGENERA LA SEMANA ═══
     *
     * Se guarda y ya. Nada más se mueve.
     *
     * Es la decisión de producto más importante de esta función y va en contra
     * de lo que hace todo el resto del reducer, así que conviene decir por qué:
     * el usuario está mirando un plato de una semana que ya ha planificado, y
     * puede que ya haya hecho la compra. Cambiarle el menú porque ha dicho "no
     * me lo vuelvas a poner" sería leerle "no me lo pongas" — que no es lo que
     * ha dicho— y además le dejaría en la nevera comida de un plato que la app
     * acaba de quitar del plan.
     *
     * La preferencia entra cuando la semana se genere, se regenere o se ajuste.
     * Eso ya pasa solo: `regenerar` lee `preferenciasPlatos` del estado.
     */
    case 'VALORAR_PLATO': {
      const preferenciasPlatos = conValoracion(
        estado.preferenciasPlatos,
        accion.platoId,
        accion.valoracion,
        new Date().toISOString(),
      );
      // `conValoracion` devuelve el MISMO objeto si no cambia nada: tocar dos
      // veces la opción que ya estaba puesta no tiene por qué escribir estado.
      if (preferenciasPlatos === estado.preferenciasPlatos) return estado;

      const { bloqueados, favoritos } = cuentaPreferencias(preferenciasPlatos);
      const comun = {
        dish_id: accion.platoId,
        dish_type: accion.tipo,
        preference: accion.valoracion,
        week_number: estado.contadores.semanaNumero,
        total_disliked_dishes: bloqueados,
        total_liked_dishes: favoritos,
      } as const;
      if (accion.valoracion === 'neutral') {
        analitica('dish_preference_removed', comun);
      } else {
        analitica('dish_preference_set', comun);
        analitica(accion.valoracion === 'me_gusta' ? 'dish_liked' : 'dish_disliked', comun);
      }

      return { ...estado, preferenciasPlatos };
    }
    /**
     * ═══ APLICAR AL MENÚ · LA REGENERACIÓN QUE PIDE EL USUARIO ═══
     *
     * Valorar no regenera (ver arriba). Esta es la otra mitad: el usuario ha
     * marcado varios «me gusta» y pide, con un botón y tras leer que cambian
     * el menú, la lista y el total, que entren ya en ESTA semana.
     *
     *   · No toca el presupuesto ni ninguna otra preferencia.
     *   · Con la compra empezada (algo en el carro) no hace nada: rehacer la
     *     lista por debajo a quien está en el súper es lo que la regla 5
     *     prohíbe. La pantalla ya no ofrece el botón en ese caso.
     *   · No gasta cambios de plato: no es «otro plato aquí».
     *   · Con la semana de ahora como previa, para que lo que no cambia no se
     *     mueva por nada.
     */
    case 'APLICAR_PREFERENCIAS_PLATOS': {
      if (!preferenciasPendientes(estado) || compraEmpezada(estado)) return estado;
      return regenerar(
        { ...estado, contadores: { ...estado.contadores, ajustesEstaSemana: estado.contadores.ajustesEstaSemana + 1 } },
        estado.semana.plan,
      );
    }

    /**
     * ═══ LOS EXTRAS · CUATRO CASOS Y NINGUNO TOCA LA SEMANA ═══
     *
     * Ninguno llama a `regenerar`, y no es un olvido: el café no entra en el
     * motor, no cambia el menú, no cambia el presupuesto de la comida y no
     * cambia el coste por ración. Lo único que mueven es su propia cuenta.
     *
     * Todos escriben SOLO `extrasCompra`. Que `lista` no se toque en ninguno de
     * los cuatro es lo que garantiza que la cifra del menú no se mueva.
     */
    case 'ANADIR_EXTRA': {
      const nombre = accion.nombre.trim();
      if (!nombre) return estado;
      const extra = crearExtra(nombre, accion.precio, new Date().toISOString());
      const extrasCompra = [...estado.extrasCompra, extra];
      analitica('extra_item_added', {
        ...resumenExtras(extrasCompra, estado),
        has_price: accion.precio !== null,
        ...(accion.precio !== null ? { price_bucket: tramoImporte(accion.precio) } : {}),
      });
      return { ...estado, extrasCompra };
    }
    case 'QUITAR_EXTRA': {
      const extrasCompra = estado.extrasCompra.filter((e) => e.id !== accion.id);
      if (extrasCompra.length === estado.extrasCompra.length) return estado;
      analitica('extra_item_removed', resumenExtras(extrasCompra, estado));
      return { ...estado, extrasCompra };
    }
    case 'TOGGLE_EXTRA': {
      const actual = estado.extrasCompra.find((e) => e.id === accion.id);
      if (!actual) return estado;
      const extrasCompra = estado.extrasCompra.map(
        (e) => (e.id === accion.id ? { ...e, marcado: !e.marcado } : e),
      );
      analitica(actual.marcado ? 'extra_item_unchecked' : 'extra_item_checked', {
        ...resumenExtras(extrasCompra, estado),
        has_price: actual.precio !== null,
      });
      return { ...estado, extrasCompra };
    }
    /**
     * Poner precio y corregirlo son el MISMO caso.
     *
     * Es la razón de ser de que el precio pueda faltar: se apunta el café el
     * domingo sin saber lo que vale y se pone en el súper, delante del lineal.
     * Se distinguen solo para la analítica —«añadido» y «cambiado» dicen cosas
     * distintas sobre cómo se usa esto— pero la mecánica es una.
     */
    case 'PRECIO_EXTRA': {
      const actual = estado.extrasCompra.find((e) => e.id === accion.id);
      if (!actual || actual.precio === accion.precio) return estado;
      const extrasCompra = estado.extrasCompra.map(
        (e) => (e.id === accion.id ? { ...e, precio: accion.precio } : e),
      );
      analitica(actual.precio === null ? 'extra_item_price_added' : 'extra_item_price_changed', {
        ...resumenExtras(extrasCompra, estado),
        has_price: accion.precio !== null,
        ...(accion.precio !== null ? { price_bucket: tramoImporte(accion.precio) } : {}),
      });
      return { ...estado, extrasCompra };
    }
    /**
     * ═══ CAMBIAR EL DÍA DE INICIO NO REGENERA NADA ═══
     *
     * Y es la decisión central de esta funcionalidad, así que conviene decir
     * por qué en el sitio donde alguien iría a añadir un `regenerar(...)`.
     *
     * Lo único que cambia es la relación posición → fecha. El plan sigue
     * siendo el mismo, la lista de la compra la misma, las marcas las mismas y
     * la despensa la misma. Regenerar aquí le tiraría al usuario un menú que a
     * lo mejor ya ha comprado solo porque el lunes pasa a llamarse viernes.
     *
     * `semana.fechaInicio` SÍ se mueve, y no es una contradicción: la semana
     * que tiene delante pasa a representar esos otros siete días, con los
     * mismos platos en el mismo orden. Es exactamente lo que el usuario ha
     * pedido al tocar la fila.
     *
     * (Lo que NO se puede evitar es que la próxima generación coloque el fin de
     * semana en otro sitio: `ordenDias` cambia y con él dónde cae la regla de
     * «sábado noche se cocina». Eso es correcto — es la regla haciendo su
     * trabajo— y solo se nota en la semana siguiente, no en ésta.)
     */
    case 'SET_INICIO_SEMANA': {
      if (!esFechaDia(accion.fecha) || accion.fecha === estado.perfil.fechaInicioSemana) return estado;
      analitica('week_start_date_changed', {
        source: accion.origen,
        days_from_today: diasEntre(hoy(), accion.fecha),
        previous_start_day: diasDesde(estado.perfil.fechaInicioSemana)[0],
        new_start_day: diasDesde(accion.fecha)[0],
        week_number: estado.contadores.semanaNumero,
      });
      return {
        ...estado,
        perfil: { ...estado.perfil, fechaInicioSemana: accion.fecha },
        // La semana de delante pasa a representar esos días. Sin tocar el plan.
        semana: { ...estado.semana, fechaInicio: accion.fecha },
      };
    }
    default:
      return estado;
  }
}

/**
 * Lo que va en cada evento de extras. NUNCA el nombre: el usuario escribe ahí
 * lo que quiere —«pañales», «test de embarazo», «champú anticaída»— y eso es
 * suyo. Salen cuentas, no contenido.
 */
function resumenExtras(extras: AppState['extrasCompra'], estado: AppState) {
  return {
    extras_count: extras.length,
    /* Tramo y no `toFixed(2)`: la suma exacta de lo que alguien apunta a mano es
       su compra, no un patrón. Ver `tramoImporte`. */
    extras_total_bucket: tramoImporte(totalExtras(extras)),
    unpriced_extras_count: extrasSinPrecio(extras),
    week_number: estado.contadores.semanaNumero,
  };
}

/**
 * ═══ MIGRAR SIN PERDER NADA ═══
 *
 * Se busca la clave más nueva que exista y se funde sobre el estado por
 * defecto. Los campos nuevos entran de fábrica; los que ya estaban se
 * conservan. Ver CLAVES_ANTERIORES.
 *
 * `reparar` existe porque un estado viejo puede traer un campo con la forma
 * antigua, y `{...defecto, ...guardado}` lo pisaría con la mala: `undefined` y
 * `null` machacan igual que un valor bueno. Se comprueban solo los campos donde
 * eso rompería la app, no todos — esto es una fusión, no un validador de
 * esquema, y un validador completo aquí acabaría rechazando estados
 * perfectamente usables por un campo que no le gusta.
 *
 * La clave vieja NO se borra. Si algo sale mal en esta versión y hay que volver
 * atrás, el estado anterior sigue donde estaba. Ocupa unos kilobytes.
 */
function cargarEstadoInicial(): AppState {
  for (const clave of [STORAGE_KEY, ...CLAVES_ANTERIORES]) {
    try {
      const guardado = window.localStorage.getItem(clave);
      if (!guardado) continue;
      return conPreciosDeHoy(enSuZona(reparar({ ...estadoInicial, ...JSON.parse(guardado) })));
    } catch {
      // Clave corrupta: se prueba la siguiente en vez de tirar todo el estado.
    }
  }
  return estadoInicial;
}

/**
 * ═══ UN PLAN DE OTRA ZONA NO SE REUTILIZA ═══
 *
 * Si el plan guardado se montó con el catálogo de otra zona —el usuario ha
 * cambiado de código postal, o viene de cuando solo había Madrid— se monta uno
 * nuevo con el de ahora. Sus productos podrían no existir en este lineal y sus
 * precios serían de otro sitio. Lo del usuario que no depende de la zona
 * (perfil, preferencias, historial, despensa) se queda.
 */
function enSuZona(estado: AppState): AppState {
  const zona = zonaCargada().zona;
  if ((estado.zonaDelPlan ?? 'madrid') === zona) return estado.zonaDelPlan ? estado : { ...estado, zonaDelPlan: zona };
  const huella = { zonaDelPlan: zona, preciosDeLaLista: versionDePrecios(), preciosEnEspera: null, avisoPrecios: null };
  if (!estado.onboardingCompletado) return { ...estado, ...huella };
  const nuevo = regenerar(estado);
  // Sin semana posible en esta zona: la lista de la otra tampoco se enseña.
  if (nuevo.semana.plan === estado.semana.plan) return { ...nuevo, lista: [], ...huella };
  return { ...nuevo, ...huella };
}

/**
 * ═══ PRECIOS NUEVOS SOBRE UNA COMPRA YA PLANEADA ═══
 *
 * Los precios nuevos se aplican AL ARRANCAR, nunca en caliente (lib/precios.ts).
 * Pero una lista hecha el domingo sigue ahí el martes, y aplicarlos sin más le
 * cambiaba el total sin decir nada. Ahora:
 *
 *   · Si la compra está EMPEZADA (algo marcado en el carro), la lista no se
 *     toca: el usuario está comparando con las etiquetas. Los precios nuevos
 *     quedan en `preciosEnEspera` y entran cuando se rehace la lista.
 *   · Si no, se revalora y, si el total cambia, se guarda `avisoPrecios` con
 *     el de antes y el de después, y Compra lo dice.
 *
 * Ver `reprecioDeLista` para por qué el plan manda sobre la lista y qué se le
 * devuelve al usuario de lo suyo.
 */
function conPreciosDeHoy(estado: AppState): AppState {
  const ahora = versionDePrecios();
  // Sin dato, la lista es de los precios del APK: es lo que había antes de esto.
  const antes = estado.preciosDeLaLista ?? datos.generadoEn;
  if (ahora === antes) return estado.preciosDeLaLista ? estado : { ...estado, preciosDeLaLista: ahora };
  if (!estado.lista.length || !estado.semana.plan?.tandas?.length) {
    return { ...estado, preciosDeLaLista: ahora, preciosEnEspera: null };
  }
  if (estado.lista.some((it) => it.enElCarro)) return { ...estado, preciosEnEspera: ahora };
  const lista = reprecioDeLista(estado.lista, estado.semana.plan, estado.perfil, estado.preferencias, estado.despensa);
  // No se pudo revalorar: se queda como estaba, y lo dice la fecha que enseña.
  if (lista === estado.lista) return { ...estado, preciosEnEspera: ahora };
  const totalAntes = totalLista(estado.lista);
  const totalDespues = totalLista(lista);
  return {
    ...estado,
    lista,
    preciosDeLaLista: ahora,
    preciosEnEspera: null,
    avisoPrecios: Math.abs(totalDespues - totalAntes) >= 0.005
      ? { desde: antes, hasta: ahora, antes: totalAntes, despues: totalDespues }
      : null,
  };
}

/** Lo que hay que garantizar que existe y tiene la forma buena. */
/** ¿Hay «me gusta» o «no me lo pongas» que la semana de ahora no tiene? */
export function preferenciasPendientes(estado: AppState): boolean {
  if (!estado.onboardingCompletado) return false;
  return (estado.semana.preferenciasAlGenerar ?? '') !== huellaPreferencias(estado.preferenciasPlatos);
}

/** Algo marcado ya en el carro: la compra va por la mitad y la lista no se rehace. */
export function compraEmpezada(estado: AppState): boolean {
  return estado.lista.some((it) => it.enElCarro);
}

function reparar(estado: AppState): AppState {
  const guardadas = estado.preferencias ?? {};
  return {
    ...estado,
    preferencias: {
      ...estadoInicial.preferencias,
      ...guardadas,
      // v12. Quien viene de v11 o antes nunca pudo elegir la variedad: la tenía
      // de fábrica, así que entra como no elegida y la escoge `mejorVariedad`.
      variedadElegida: typeof guardadas.variedadElegida === 'boolean' ? guardadas.variedadElegida : false,
      exclusiones: Array.isArray(guardadas.exclusiones) ? guardadas.exclusiones : [],
    },
    // v13. Un estado anterior no lo trae, y sin objeto revientan los helpers.
    preferenciasPlatos: esMapaDePreferencias(estado.preferenciasPlatos) ? estado.preferenciasPlatos : {},
    // v14. Igual: sin array, la sección de "otras cosas" reventaría al pintar.
    extrasCompra: sonExtras(estado.extrasCompra) ? estado.extrasCompra : [],
    /**
     * v15. Quien viene de antes no tiene fecha de inicio, y aquí hay dos
     * decisiones distintas:
     *
     *   · La PREFERENCIA entra como HOY. Es lo único razonable: no sabemos
     *     cuándo empezó su semana y hoy es la respuesta que menos sorprende.
     *   · La SEMANA ACTIVA se queda en `null`, y NO se le pone hoy. Sus platos
     *     se generaron para otros siete días que no sabemos cuáles fueron, y
     *     ponerle la fecha de hoy sería inventarse que empieza hoy. Con `null`
     *     la interfaz enseña los nombres de siempre —LUN, MAR…— que es lo que
     *     esa semana significaba cuando se generó.
     *
     * En cuanto genere la siguiente, esa sí llevará fecha.
     */
    perfil: {
      ...estadoInicial.perfil,
      ...(estado.perfil ?? {}),
      fechaInicioSemana: esFechaDia(estado.perfil?.fechaInicioSemana)
        ? estado.perfil.fechaInicioSemana
        : hoy(),
    },
    semana: {
      ...estadoInicial.semana,
      ...(estado.semana ?? {}),
      fechaInicio: esFechaDia(estado.semana?.fechaInicio) ? estado.semana.fechaInicio : null,
      /* v17. Una semana de antes no sabe con qué preferencias se montó. Se da
         por montada con las de ahora: lo que se marque desde aquí sí se ve
         como pendiente, y no se ofrece rehacer una semana por nada. */
      preferenciasAlGenerar: typeof estado.semana?.preferenciasAlGenerar === 'string'
        ? estado.semana.preferenciasAlGenerar
        : huellaPreferencias(esMapaDePreferencias(estado.preferenciasPlatos) ? estado.preferenciasPlatos : {}),
    },
    /**
     * v16. El contador de cambios de plato de Cunde+.
     *
     * Quien viene de v15 no lo trae y le entra el de fábrica —`semana: 0`, que
     * no coincide con ninguna semana real porque empiezan en 1—, o sea que
     * migra con cero cambios usados sin necesitar ninguna lógica aparte.
     *
     * Se repara además la forma porque `APLICAR_SEMANA` lee `.semana` sin
     * comprobar nada: un `null` guardado por lo que sea rompería el cambio de
     * plato, y el usuario vería la app colgarse justo al tocar la función que
     * paga. Ante la duda, cero: regalar dos cambios es infinitamente mejor que
     * una pantalla en blanco.
     */
    cambiosDePlato: esContadorDeCambios(estado.cambiosDePlato)
      ? estado.cambiosDePlato
      : { ...estadoInicial.cambiosDePlato },
    historial: Array.isArray(estado.historial) ? estado.historial : [],
    despensa: estado.despensa && typeof estado.despensa === 'object' ? estado.despensa : {},
    lista: Array.isArray(estado.lista) ? estado.lista : [],
  };
}

function esContadorDeCambios(v: unknown): v is AppState['cambiosDePlato'] {
  if (!v || typeof v !== 'object') return false;
  const { semana, usados } = v as { semana?: unknown; usados?: unknown };
  return Number.isFinite(semana) && Number.isFinite(usados) && (usados as number) >= 0;
}

/**
 * Que el mapa guardado tenga la forma de ahora. Un valor suelto o con una
 * valoración que ya no existe se descarta ENTERO en vez de colarse: un mapa
 * medio bueno haría fallar el motor en un sitio lejano y difícil de atar a
 * esto.
 */
/**
 * Que la lista de extras tenga la forma de ahora. Se descarta ENTERA si no,
 * por lo mismo que el mapa de preferencias: una lista medio buena fallaría al
 * sumar o al pintar, lejos de aquí y sin pista de la causa.
 *
 * `precio` admite `null` a propósito y hay que dejarlo pasar explícitamente: es
 * el caso normal de "lo apunto y ya veré lo que cuesta", no un dato ausente.
 */
function sonExtras(v: unknown): v is AppState['extrasCompra'] {
  if (!Array.isArray(v)) return false;
  return v.every((e) => e && typeof e === 'object'
    && typeof (e as ExtraCompra).id === 'string'
    && typeof (e as ExtraCompra).nombre === 'string'
    && typeof (e as ExtraCompra).marcado === 'boolean'
    && ((e as ExtraCompra).precio === null || typeof (e as ExtraCompra).precio === 'number'));
}

function esMapaDePreferencias(v: unknown): v is AppState['preferenciasPlatos'] {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return false;
  return Object.values(v as Record<string, unknown>).every((p) => {
    if (!p || typeof p !== 'object') return false;
    const { platoId, valoracion } = p as { platoId?: unknown; valoracion?: unknown };
    return typeof platoId === 'string' && (valoracion === 'me_gusta' || valoracion === 'no_quiero');
  });
}

/**
 * El estado que saldría de lo que hay ahora en localStorage.
 *
 * Solo para los tests de migración: es la única forma de comprobar que un
 * estado viejo se conserva sin montar la app entera, y esa comprobación
 * importa —la migración anterior borraba la despensa de todo el mundo—.
 * Ver migracion.test.ts.
 */
export function estadoParaTests(): AppState {
  return cargarEstadoInicial();
}

interface AppStateContextValue {
  estado: AppState;
  dispatch: React.Dispatch<Accion>;
}

const AppStateContext = createContext<AppStateContextValue | null>(null);

export function AppStateProvider({ children }: Readonly<{ children: ReactNode }>) {
  const [estado, dispatch] = useReducer(reducer, undefined, cargarEstadoInicial);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(estado));
  }, [estado]);

  /**
   * ═══ LA TIENDA MANDA SOBRE EL ESTADO PREMIUM ═══
   *
   * Una vez al arrancar. No antes de cada acción: «cambiar plato» y «proteína
   * alta» tienen que responder al instante, y una llamada de red antes de cada
   * toque sería medio segundo en el mejor caso y una app colgada en el sótano
   * del súper en el peor.
   *
   * `null` significa QUE NO SE HA PODIDO SABER —sin red, normalmente— y ahí no
   * se toca nada: quien pagó conserva lo suyo. Ese era el fallo que tenía
   * `compras.ts`, cuyo `catch` devolvía `false` y degradaba al plan gratuito
   * justo a quien está usando la app donde no hay cobertura.
   *
   * Cuando la tienda sí contesta, se corrige en las dos direcciones: activa si
   * compró fuera de la app o restauró en otro móvil, y quita si la suscripción
   * caducó o le devolvieron el dinero. Eso es lo que impide que un `true` mal
   * puesto se quede para siempre en `localStorage`.
   *
   * Lo que NO hace es tocar la semana ya generada. Si alguien la montó con
   * proteína alta y luego caduca, su semana sigue tal cual: lo que vuelve a
   * pedir Cunde+ es el siguiente cambio, no el que ya hizo.
   */
  useEffect(() => {
    let vivo = true;
    void permisoSegunLaTienda().then((tiene) => {
      if (!vivo || tiene === null) return;
      const teniamos = estado.suscripcion !== null;
      if (tiene === teniamos) return;
      dispatch({ type: 'SET_SUSCRIPCION', plan: tiene ? 'de-por-vida' : null });
    });
    return () => { vivo = false; };
    /* Una vez por arranque: si dependiera de `estado.suscripcion` se volvería a
       preguntar cada vez que cambia, que es justo cuando ya lo sabemos.
       eslint-disable-next-line react-hooks/exhaustive-deps */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const value = useMemo(() => ({ estado, dispatch }), [estado]);

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}

export function useAppState() {
  const ctx = useContext(AppStateContext);
  if (!ctx) throw new Error('useAppState debe usarse dentro de AppStateProvider');
  return ctx;
}
