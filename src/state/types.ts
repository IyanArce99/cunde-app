export type Comensales = '1' | '2' | '3' | '4' | '5+';

export interface Plato {
  dia: string;
  nombre: string;
  minutos: number;
  precioRacion: number;
}

export interface ItemLista {
  id: string;
  pasillo: string;
  nombre: string;
  formatoVenta: string;
  precio: number;
  paraPlato?: string;
  marcado: boolean;
  procedenciaPrecio?: string;
}

export interface Perfil {
  comensales: Comensales;
  super: string;
  presupuestoSemanal: number;
}

export interface Cierre {
  importeRealTicket: number | null;
  guardada: boolean;
}

export type Suscripcion = null | 'mes' | 'año';

export type ComidasPref = 'comidas' | 'cenas' | 'ambas';
export type Esfuerzo = 'minimo' | 'normal' | 'libre';

export interface Preferencias {
  comidas: ComidasPref;
  esfuerzo: Esfuerzo;
  exclusiones: string[];
}

export interface AppState {
  onboardingCompletado: boolean;
  perfil: Perfil;
  preferencias: Preferencias;
  semana: { platos: Plato[]; generadaEn: number };
  lista: ItemLista[];
  cierre: Cierre;
  suscripcion: Suscripcion;
  contadores: { semanaNumero: number; ajustesEstaSemana: number; semanaVistaGratis: number };
}

export function numComensales(c: Comensales): number {
  return c === '5+' ? 5 : parseInt(c, 10);
}

export function etiquetaComensales(c: Comensales): string {
  const n = numComensales(c);
  return n + (n === 1 ? ' persona' : ' personas');
}
