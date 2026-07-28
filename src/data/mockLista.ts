import type { ItemLista } from '../state/types';

export const listaCompra: ItemLista[] = [
  // FRUTA Y VERDURA
  { id: 'limon', pasillo: 'FRUTA Y VERDURA', nombre: 'Limón', formatoVenta: 'Malla 500 g', precio: 1.15, paraPlato: 'Pollo al limón', marcado: false },
  { id: 'zanahoria', pasillo: 'FRUTA Y VERDURA', nombre: 'Zanahoria', formatoVenta: 'Bolsa 1 kg', precio: 0.95, paraPlato: 'Lentejas con verduras', marcado: false },
  { id: 'puerro', pasillo: 'FRUTA Y VERDURA', nombre: 'Puerro', formatoVenta: 'Manojo 3 uds', precio: 1.20, paraPlato: 'Lentejas con verduras', marcado: false },
  { id: 'patata', pasillo: 'FRUTA Y VERDURA', nombre: 'Patata', formatoVenta: 'Malla 2 kg', precio: 1.85, paraPlato: 'Merluza al horno', marcado: false },
  { id: 'tomate', pasillo: 'FRUTA Y VERDURA', nombre: 'Tomate rama', formatoVenta: 'Malla 1 kg', precio: 1.95, paraPlato: 'Pasta con atún', marcado: false },
  { id: 'lechuga', pasillo: 'FRUTA Y VERDURA', nombre: 'Lechuga', formatoVenta: 'Unidad', precio: 0.95, paraPlato: 'Tortilla y ensalada', marcado: false },
  { id: 'pimiento', pasillo: 'FRUTA Y VERDURA', nombre: 'Pimiento rojo', formatoVenta: 'Bandeja 3 uds', precio: 1.75, paraPlato: 'Arroz con pollo', marcado: false },
  { id: 'calabaza', pasillo: 'FRUTA Y VERDURA', nombre: 'Calabaza', formatoVenta: 'Trozo 1 kg', precio: 1.95, paraPlato: 'Crema de calabaza', marcado: false },
  { id: 'cebolla', pasillo: 'FRUTA Y VERDURA', nombre: 'Cebolla', formatoVenta: 'Malla 1 kg', precio: 1.10, paraPlato: 'Crema de calabaza', marcado: false },
  { id: 'platano', pasillo: 'FRUTA Y VERDURA', nombre: 'Plátano de Canarias', formatoVenta: 'Bandeja 1 kg', precio: 1.55, marcado: false },
  { id: 'manzana', pasillo: 'FRUTA Y VERDURA', nombre: 'Manzana Golden', formatoVenta: 'Bolsa 1 kg', precio: 1.65, marcado: false },

  // CARNICERÍA
  { id: 'pollo', pasillo: 'CARNICERÍA', nombre: 'Pollo en cuartos', formatoVenta: 'Bandeja 700 g', precio: 5.40, paraPlato: 'Pollo al limón', marcado: true },
  { id: 'muslos', pasillo: 'CARNICERÍA', nombre: 'Muslos de pollo', formatoVenta: 'Bandeja 900 g', precio: 4.25, paraPlato: 'Arroz con pollo', marcado: false },
  { id: 'picada', pasillo: 'CARNICERÍA', nombre: 'Carne picada mixta', formatoVenta: 'Bandeja 500 g', precio: 3.95, marcado: false },

  // PESCADERÍA
  { id: 'merluza', pasillo: 'PESCADERÍA', nombre: 'Merluza en lomos', formatoVenta: 'Bandeja 400 g', precio: 7.95, paraPlato: 'Merluza al horno', marcado: false },
  { id: 'salmon', pasillo: 'PESCADERÍA', nombre: 'Salmón fresco', formatoVenta: 'Bandeja 300 g', precio: 5.50, marcado: false },

  // DESPENSA
  { id: 'lentejas', pasillo: 'DESPENSA', nombre: 'Lentejas pardinas', formatoVenta: 'Paquete 1 kg', precio: 1.75, paraPlato: 'Lentejas con verduras', marcado: false },
  { id: 'macarrones', pasillo: 'DESPENSA', nombre: 'Macarrones', formatoVenta: 'Paquete 500 g', precio: 0.95, paraPlato: 'Pasta con atún', marcado: false },
  { id: 'atun', pasillo: 'DESPENSA', nombre: 'Atún claro', formatoVenta: 'Pack 3 latas', precio: 3.10, paraPlato: 'Pasta con atún', marcado: false, procedenciaPrecio: 'precio del 24 jul' },
  { id: 'arroz', pasillo: 'DESPENSA', nombre: 'Arroz redondo', formatoVenta: 'Paquete 1 kg', precio: 1.45, paraPlato: 'Arroz con pollo', marcado: false },
  { id: 'huevos', pasillo: 'DESPENSA', nombre: 'Huevos', formatoVenta: 'Docena', precio: 2.55, paraPlato: 'Tortilla y ensalada', marcado: true },
  { id: 'aceite', pasillo: 'DESPENSA', nombre: 'Aceite de oliva', formatoVenta: 'Botella 1 L', precio: 7.95, marcado: true, procedenciaPrecio: 'precio del 24 jul' },
  { id: 'pan', pasillo: 'DESPENSA', nombre: 'Pan de molde', formatoVenta: 'Paquete 460 g', precio: 1.35, marcado: false },
  { id: 'leche', pasillo: 'DESPENSA', nombre: 'Leche semidesnatada', formatoVenta: 'Pack 6x1 L', precio: 5.70, marcado: false },
  { id: 'yogur', pasillo: 'DESPENSA', nombre: 'Yogur natural', formatoVenta: 'Pack 8 uds', precio: 2.15, marcado: false },
  { id: 'cafe', pasillo: 'DESPENSA', nombre: 'Café molido', formatoVenta: 'Paquete 250 g', precio: 2.60, marcado: false },
  { id: 'galletas', pasillo: 'DESPENSA', nombre: 'Galletas María', formatoVenta: 'Paquete 800 g', precio: 1.90, marcado: false },
  { id: 'queso', pasillo: 'DESPENSA', nombre: 'Queso rallado', formatoVenta: 'Bolsa 200 g', precio: 1.95, marcado: false, procedenciaPrecio: 'estimado' },
];
