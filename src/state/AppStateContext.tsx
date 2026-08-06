import { createContext, useContext, useEffect, useMemo, useReducer } from 'react';
import type { ReactNode } from 'react';
import type { AppState, Comensales, Preferencias, Ranura, Suscripcion } from './types';
import { CP_POR_DEFECTO } from './types';
import { despensaTrasLaSemana, generarParaApp, indiceDeHueco, retocarParaApp } from '../data/motor';
import { SEMANAS_DE_MEMORIA } from '../motor/seleccionar.ts';
import { despensaVisible, semanasDeMemoria } from '../lib/suscripcion';
import type { EstadoSuscripcion } from '../lib/suscripcion';
import type { Retoque } from '../data/motor';

// v10: la despensa lleva la edad en semanas (para el plan gratuito) y el
// estado recuerda si alguna vez hubo suscripción. Un v9 en disco no los tiene.
// (v9 fue el código postal; v8, la despensa.)
// (v11 es el postre; v10 fue el código postal por defecto.)
const STORAGE_KEY = 'cunde:estado:v11';

const estadoInicial: AppState = {
  onboardingCompletado: false,
  perfil: {
    comensales: '2',
    super: 'Mercadona',
    presupuestoSemanal: 65,
    // Puesto de salida: es la zona del catálogo que la app lleva cargado, así
    // que enseñarlo es decir la verdad, no rellenar por el usuario. Ver
    // CP_POR_DEFECTO en types.ts.
    codigoPostal: CP_POR_DEFECTO,
    almacen: null,
  },
  preferencias: {
    comidas: 'ambas', esfuerzo: 'libre', variedad: 'normal', proteina: 'normal',
    exclusiones: [], postre: false,
  },
  semana: { plan: { tandas: [], huecos: [] }, dias: [], generadaEn: 0 },
  historial: [],
  despensa: {},
  lista: [],
  sinCobertura: null,
  salidaPresupuesto: null,
  cierre: { importeRealTicket: null, guardada: false },
  suscripcion: null,
  huboSuscripcion: false,
  contadores: { semanaNumero: 1, ajustesEstaSemana: 0, semanaVistaGratis: 0, bajadoConRetoques: 0 },
  deshacerCierre: null,
};

type Accion =
  | { type: 'SET_COMENSALES'; comensales: Comensales }
  | { type: 'SET_SUPER'; super: string }
  | { type: 'SET_CODIGO_POSTAL'; codigoPostal: string | null; almacen: string | null }
  | { type: 'SET_PRESUPUESTO'; presupuesto: number }
  | { type: 'COMPLETAR_ONBOARDING' }
  | { type: 'TOGGLE_ITEM'; id: string }
  | { type: 'TOGGLE_PASILLO'; pasillo: string; marcar: boolean }
  | { type: 'TOGGLE_LO_TENGO'; id: string }
  | { type: 'GUARDAR_CIERRE'; importeRealTicket: number }
  | { type: 'DESHACER_CIERRE' }
  | { type: 'OLVIDAR_DESHACER' }
  | { type: 'SET_SUSCRIPCION'; plan: Suscripcion }
  | { type: 'SEGUIR_GRATIS'; numeroSemana: number }
  | { type: 'SET_PREFERENCIAS'; preferencias: Preferencias }
  | { type: 'RETOCAR_HUECO'; dia: string; ranura: Ranura; retoque: Retoque };

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
function estadoSuscripcion(estado: AppState): EstadoSuscripcion {
  if (estado.suscripcion) return 'activa';
  return estado.huboSuscripcion ? 'caducada' : 'ninguna';
}

function regenerar(estado: AppState): AppState {
  // Dos cosas evitan que la semana 2 se parezca a la 1: el número de semana,
  // del que sale la SILUETA (qué días llevan hueco aprovechado), y el
  // HISTORIAL, que penaliza los platos de las semanas cerradas. Sin el
  // segundo, la silueta cambiaba y los platos no.
  const sus = estadoSuscripcion(estado);
  const semana = generarParaApp(
    estado.perfil, estado.preferencias, estado.contadores.semanaNumero,
    estado.historial.slice(0, semanasDeMemoria(sus, SEMANAS_DE_MEMORIA)),
    // Sin suscripción, solo lo que sobró de la semana pasada (semanas === 0).
    despensaVisible(estado.despensa, sus, (v) => (v.semanas ?? 0) === 0),
  );
  if (semana.sinCobertura) return { ...estado, sinCobertura: semana.sinCobertura };
  return {
    ...estado,
    semana: { plan: semana.plan, dias: semana.dias, generadaEn: Date.now() },
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
function abrirSemanaSiTocaba(estado: AppState): AppState {
  if (!estado.cierre.guardada) return estado;
  return regenerar({
    ...estado,
    cierre: { importeRealTicket: null, guardada: false },
    contadores: { ...estado.contadores, ajustesEstaSemana: 0 },
  });
}

function reducer(estado: AppState, accion: Accion): AppState {
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
      // Al cerrar la semana, lo que se ha comido pasa al historial. NO se
      // regenera aquí: el usuario acaba de comprar ESTA comida y va a
      // cocinarla toda la semana. La memoria se aplica en la siguiente
      // generación, que es cuando pide una semana nueva.
      const comidas = [...new Set(estado.semana.plan.tandas.map((t) => t.recetaId))];
      return {
        ...estado,
        historial: [comidas, ...estado.historial].slice(0, SEMANAS_DE_MEMORIA),
        // Y lo que sobró se queda en el armario para la semana que viene: sin
        // esto el motor volvía a comprar cebollas con 1,65 kg en casa.
        despensa: despensaTrasLaSemana(estado.perfil, estado.preferencias, estado.semana.plan, estado.despensa),
        cierre: { importeRealTicket: accion.importeRealTicket, guardada: true },
        contadores: { ...estado.contadores, semanaNumero: estado.contadores.semanaNumero + 1 },
        // se cierra la semana en curso: el reloj de la siguiente empieza ahora.
        semana: { ...estado.semana, generadaEn: Date.now() },
        // La foto de antes, para poder volver. Ver AppState.deshacerCierre.
        deshacerCierre: {
          historial: estado.historial,
          despensa: estado.despensa,
          cierre: estado.cierre,
          contadores: estado.contadores,
          semana: estado.semana,
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
      return cambiaLaSemana && estado.onboardingCompletado ? regenerar(siguiente) : siguiente;
    }
    case 'RETOCAR_HUECO': {
      // Se rehace desde ese hueco con el mismo motor: cambia el reparto, la
      // lista de la compra y el total. Ya no hay huecos intocables.
      const indice = indiceDeHueco(estado.semana.plan, accion.dia, accion.ranura);
      if (indice < 0) return estado;
      const semana = retocarParaApp(
        estado.perfil, estado.preferencias, estado.semana.plan, indice, accion.retoque,
        estado.contadores.semanaNumero, estado.historial, estado.despensa,
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
    default:
      return estado;
  }
}

function cargarEstadoInicial(): AppState {
  try {
    const guardado = window.localStorage.getItem(STORAGE_KEY);
    if (guardado) return { ...estadoInicial, ...JSON.parse(guardado) };
  } catch {
    // localStorage no disponible o JSON corrupto: seguimos con el estado por defecto
  }
  return estadoInicial;
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

  const value = useMemo(() => ({ estado, dispatch }), [estado]);

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}

export function useAppState() {
  const ctx = useContext(AppStateContext);
  if (!ctx) throw new Error('useAppState debe usarse dentro de AppStateProvider');
  return ctx;
}
