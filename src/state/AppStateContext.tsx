import { createContext, useContext, useEffect, useMemo, useReducer } from 'react';
import type { ReactNode } from 'react';
import type { AppState, Comensales, Plato, Preferencias, Suscripcion } from './types';
import { menuSemana } from '../data/mockMenu';
import { listaCompra } from '../data/mockLista';
import { PLATO_LIBRE_NOMBRE } from '../lib/menu';

// v3: añade contadores.semanaVistaGratis (el muro de pago se aceptó/descartó
// gratis para esa semana concreta; antes vivía en useState y reaparecía en
// cada visita). Cambiar la clave evita mezclar un estado guardado con la
// forma antigua (campos a medias -> NaN).
const STORAGE_KEY = 'cunde:estado:v3';

const estadoInicial: AppState = {
  onboardingCompletado: false,
  perfil: { comensales: '2', super: 'Mercadona', presupuestoSemanal: 65 },
  preferencias: { comidas: 'ambas', esfuerzo: 'normal', exclusiones: [] },
  semana: { platos: [], generadaEn: 0 },
  lista: [],
  cierre: { importeRealTicket: null, guardada: false },
  suscripcion: null,
  contadores: { semanaNumero: 1, ajustesEstaSemana: 0, semanaVistaGratis: 0 },
};

type Accion =
  | { type: 'SET_COMENSALES'; comensales: Comensales }
  | { type: 'SET_SUPER'; super: string }
  | { type: 'SET_PRESUPUESTO'; presupuesto: number }
  | { type: 'COMPLETAR_ONBOARDING' }
  | { type: 'TOGGLE_ITEM'; id: string }
  | { type: 'GUARDAR_CIERRE'; importeRealTicket: number }
  | { type: 'SET_SUSCRIPCION'; plan: Suscripcion }
  | { type: 'SEGUIR_GRATIS'; numeroSemana: number }
  | { type: 'SET_PREFERENCIAS'; preferencias: Preferencias }
  | { type: 'CAMBIAR_PLATO'; dia: string; plato: Omit<Plato, 'dia'> }
  | { type: 'REORGANIZAR_SEMANA'; diaLibre: string; diaDestino: string; nuevoPlato: Omit<Plato, 'dia'> };

function reducer(estado: AppState, accion: Accion): AppState {
  switch (accion.type) {
    case 'SET_COMENSALES':
      return { ...estado, perfil: { ...estado.perfil, comensales: accion.comensales } };
    case 'SET_SUPER':
      return { ...estado, perfil: { ...estado.perfil, super: accion.super } };
    case 'SET_PRESUPUESTO':
      return { ...estado, perfil: { ...estado.perfil, presupuestoSemanal: accion.presupuesto } };
    case 'COMPLETAR_ONBOARDING':
      return {
        ...estado,
        onboardingCompletado: true,
        semana: { platos: menuSemana, generadaEn: Date.now() },
        lista: listaCompra,
      };
    case 'TOGGLE_ITEM':
      return {
        ...estado,
        lista: estado.lista.map((it) => (it.id === accion.id ? { ...it, marcado: !it.marcado } : it)),
      };
    case 'GUARDAR_CIERRE':
      return {
        ...estado,
        cierre: { importeRealTicket: accion.importeRealTicket, guardada: true },
        contadores: { ...estado.contadores, semanaNumero: estado.contadores.semanaNumero + 1 },
        // se cierra la semana en curso: el reloj de la siguiente empieza ahora.
        semana: { ...estado.semana, generadaEn: Date.now() },
      };
    case 'SET_SUSCRIPCION':
      return { ...estado, suscripcion: accion.plan };
    case 'SEGUIR_GRATIS':
      return {
        ...estado,
        contadores: { ...estado.contadores, semanaVistaGratis: accion.numeroSemana },
      };
    case 'SET_PREFERENCIAS':
      return {
        ...estado,
        preferencias: accion.preferencias,
        contadores: { ...estado.contadores, ajustesEstaSemana: estado.contadores.ajustesEstaSemana + 1 },
      };
    case 'CAMBIAR_PLATO':
      return {
        ...estado,
        semana: {
          ...estado.semana,
          platos: estado.semana.platos.map((p) => (p.dia === accion.dia ? { dia: p.dia, ...accion.plato } : p)),
        },
        contadores: { ...estado.contadores, ajustesEstaSemana: estado.contadores.ajustesEstaSemana + 1 },
      };
    case 'REORGANIZAR_SEMANA':
      return {
        ...estado,
        semana: {
          ...estado.semana,
          platos: estado.semana.platos.map((p) => {
            if (p.dia === accion.diaLibre) return { dia: p.dia, nombre: PLATO_LIBRE_NOMBRE, minutos: 0, precioRacion: 0 };
            if (p.dia === accion.diaDestino) return { dia: p.dia, ...accion.nuevoPlato };
            return p;
          }),
        },
        contadores: { ...estado.contadores, ajustesEstaSemana: estado.contadores.ajustesEstaSemana + 1 },
      };
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

export function AppStateProvider({ children }: { children: ReactNode }) {
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
