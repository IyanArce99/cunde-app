/**
 * ═══ OTRAS COSAS · LOS INVARIANTES ═══
 *
 * Uno manda sobre todos los demás y está probado en tres sitios distintos a
 * propósito: **un extra no puede tocar la cifra del menú**. Cunde vende la
 * frase «tu semana cuesta 61,20 €» y deja de ser verdad en cuanto un detergente
 * entra en esa suma.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import {
  crearExtra, nuevoIdExtra, leerPrecio, totalExtras, extrasLlevados, extrasSinPrecio,
  totalCompraPrevista,
} from './extras';
import type { ExtraCompra } from './extras';
import { analitica, registrarSumideroAnalitica } from './analitica';
import { totalLista } from './derive';
import type { ItemLista } from '../state/types';
import FilaExtra from '../components/FilaExtra';
import HojaExtra from '../components/HojaExtra';

const AHORA = '2026-08-07T10:00:00.000Z';
const extra = (nombre: string, precio: number | null, marcado = false): ExtraCompra =>
  ({ ...crearExtra(nombre, precio, AHORA), marcado });

afterEach(() => {
  cleanup();
  registrarSumideroAnalitica(null);
});

// ---------------------------------------------------------------------------
// 1, 2, 16 · Crear
// ---------------------------------------------------------------------------

describe('añadir un producto', () => {
  it('con precio', () => {
    const e = crearExtra('Papel higiénico', 4.25, AHORA);
    expect(e).toMatchObject({ nombre: 'Papel higiénico', precio: 4.25, marcado: false, creadoEn: AHORA });
    expect(e.id).toBeTruthy();
  });

  it('sin precio: `null`, que NO es lo mismo que 0', () => {
    const e = crearExtra('Café', null, AHORA);
    expect(e.precio).toBeNull();
    expect(e.precio).not.toBe(0);
  });

  it('dos veces el mismo nombre son dos productos distintos', () => {
    // Leche para el desayuno y leche para el gato. Son dos líneas de la lista.
    const a = crearExtra('Leche', 1.1, AHORA);
    const b = crearExtra('Leche', 1.1, AHORA);
    expect(a.id).not.toBe(b.id);
  });

  it('los identificadores no se repiten', () => {
    const ids = new Set(Array.from({ length: 500 }, () => nuevoIdExtra()));
    expect(ids.size).toBe(500);
  });

  it('y siguen sin repetirse sin `crypto`: la PWA se prueba por red local', () => {
    /* `crypto.randomUUID` NO existe fuera de contexto seguro, y la app se sirve
       en http://192.168.x.x para probar en el móvil. Sin alternativa, añadir un
       extra reventaría justo ahí. */
    const original = globalThis.crypto;
    try {
      Object.defineProperty(globalThis, 'crypto', { value: undefined, configurable: true });
      const ids = new Set(Array.from({ length: 200 }, () => nuevoIdExtra()));
      expect(ids.size).toBe(200);
    } finally {
      Object.defineProperty(globalThis, 'crypto', { value: original, configurable: true });
    }
  });
});

// ---------------------------------------------------------------------------
// 6, 7 · Leer un precio escrito a mano
// ---------------------------------------------------------------------------

describe('leer un precio', () => {
  it('acepta coma y punto: el teclado del móvil da uno u otro según el idioma', () => {
    expect(leerPrecio('3,45')).toBe(3.45);
    expect(leerPrecio('3.45')).toBe(3.45);
    expect(leerPrecio(' 12 ')).toBe(12);
  });

  it('vacío es «no lo sé», que es válido y no un error', () => {
    expect(leerPrecio('')).toBeNull();
    expect(leerPrecio('   ')).toBeNull();
  });

  it('lo que no es un precio se rechaza, no se convierte en 0', () => {
    for (const malo of ['abc', '-3', '1,2,3']) expect(leerPrecio(malo)).toBeUndefined();
  });

  it('redondea a céntimos: un total con tres decimales no cuadra con ningún ticket', () => {
    expect(leerPrecio('3,455')).toBe(3.46);
  });
});

// ---------------------------------------------------------------------------
// 8, 9, 10, 17 · Las tres cifras
// ---------------------------------------------------------------------------

describe('los tres totales', () => {
  const lista: ExtraCompra[] = [
    extra('Café', null),
    extra('Papel higiénico', 4.25, true),
    extra('Agua', 2.1),
  ];

  it('`totalExtras` suma SOLO los que tienen precio', () => {
    expect(totalExtras(lista)).toBeCloseTo(6.35, 2);
  });

  it('los que no tienen precio no suman cero: se cuentan aparte', () => {
    expect(extrasSinPrecio(lista)).toBe(1);
    expect(extrasSinPrecio([])).toBe(0);
  });

  it('`totalCompraPrevista` es menú + extras', () => {
    expect(totalCompraPrevista(61.2, lista)).toBeCloseTo(67.55, 2);
  });

  it('lo llevado suma solo lo marcado', () => {
    expect(extrasLlevados(lista)).toBeCloseTo(4.25, 2);
  });

  it('═══ LOS EXTRAS NO TOCAN EL TOTAL DEL MENÚ ═══', () => {
    /* La regla que justifica la funcionalidad entera. Se comprueba de la forma
       más tonta posible a propósito: `totalLista` recibe la lista del motor y
       no hay ninguna manera de meterle un extra, porque son tipos distintos en
       campos distintos del estado. */
    const delMotor: ItemLista[] = [
      { id: 'a', pasillo: 'P', nombre: 'Alubias', formatoVenta: 'Tarro', precio: 1.5, enElCarro: false },
      { id: 'b', pasillo: 'P', nombre: 'Arroz', formatoVenta: 'Paquete', precio: 1.2, enElCarro: false },
    ];
    const menuAntes = totalLista(delMotor);
    expect(menuAntes).toBeCloseTo(2.7, 2);

    // Con 200 € de extras encima, el menú sigue costando lo mismo.
    const muchos = Array.from({ length: 20 }, () => extra('Champú', 10));
    expect(totalExtras(muchos)).toBeCloseTo(200, 2);
    expect(totalLista(delMotor)).toBe(menuAntes);
    // Y el total de la compra sí los ve, que es el otro lado de la regla.
    expect(totalCompraPrevista(menuAntes, muchos)).toBeCloseTo(202.7, 2);
  });

  it('sin extras, el total de compra ES el del menú', () => {
    expect(totalCompraPrevista(61.2, [])).toBe(61.2);
    expect(totalExtras([])).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// 11 · El motor no los conoce
// ---------------------------------------------------------------------------

describe('el motor no sabe que existen', () => {
  it('lib/extras.ts no importa nada del motor', async () => {
    /* Si algún día alguien mete `import ... from '../motor/...'` aquí, es que
       los extras han empezado a influir en la selección de recetas. */
    const fuente = await import('node:fs').then((fs) => fs.readFileSync('src/lib/extras.ts', 'utf8'));
    // Las líneas de import, no el texto: el propio comentario del fichero dice
    // "aquí no hay una sola importación de src/motor/" y eso no es una.
    const imports = fuente.split('\n').filter((l) => l.trimStart().startsWith('import'));
    expect(imports.some((l) => l.includes('motor'))).toBe(false);
  });

  it('`PeticionSemana` no tiene ningún campo de extras', async () => {
    const fuente = await import('node:fs').then((fs) => fs.readFileSync('src/motor/seleccionar.ts', 'utf8'));
    const peticion = fuente.slice(fuente.indexOf('export interface PeticionSemana'));
    expect(peticion.slice(0, peticion.indexOf('\n}'))).not.toContain('extra');
  });
});

// ---------------------------------------------------------------------------
// 4, 5, 17 · La fila
// ---------------------------------------------------------------------------

describe('la fila de un extra', () => {
  it('«sin precio» y nunca «0,00 €»', () => {
    render(<FilaExtra extra={extra('Café', null)} onMarcar={() => {}} onAbrir={() => {}} />);
    expect(screen.getByText('sin precio')).toBeTruthy();
    expect(screen.queryByText(/0,00/)).toBeNull();
  });

  it('con precio, lo enseña con su formato', () => {
    render(<FilaExtra extra={extra('Agua', 2.1)} onMarcar={() => {}} onAbrir={() => {}} />);
    expect(screen.getByText(/2,10/)).toBeTruthy();
  });

  it('marcar y desmarcar avisan, y el estado se anuncia con aria-checked', () => {
    const onMarcar = vi.fn();
    const { rerender } = render(
      <FilaExtra extra={extra('Café', null, false)} onMarcar={onMarcar} onAbrir={() => {}} />,
    );
    const caja = screen.getByRole('checkbox');
    expect(caja.getAttribute('aria-checked')).toBe('false');
    fireEvent.click(caja);
    expect(onMarcar).toHaveBeenCalled();

    rerender(<FilaExtra extra={extra('Café', null, true)} onMarcar={onMarcar} onAbrir={() => {}} />);
    expect(screen.getByRole('checkbox').getAttribute('aria-checked')).toBe('true');
  });

  it('editar es un objetivo SEPARADO de marcar, y se llama por su producto', () => {
    // Con quince extras, quince botones que se anuncian «Editar» son quince
    // botones idénticos para un lector de pantalla.
    const onMarcar = vi.fn();
    const onAbrir = vi.fn();
    render(<FilaExtra extra={extra('Champú', 3)} onMarcar={onMarcar} onAbrir={onAbrir} />);
    fireEvent.click(screen.getByRole('button', { name: 'Editar Champú' }));
    expect(onAbrir).toHaveBeenCalled();
    expect(onMarcar).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// 1, 2, 5, 6, 7 · La hoja
// ---------------------------------------------------------------------------

describe('la hoja de añadir', () => {
  const abrir = (props: Partial<Parameters<typeof HojaExtra>[0]> = {}) => {
    const onAnadir = vi.fn();
    const onPrecio = vi.fn();
    const onQuitar = vi.fn();
    render(
      <HojaExtra
        extra={null}
        onAnadir={onAnadir}
        onPrecio={onPrecio}
        onQuitar={onQuitar}
        onCerrar={() => {}}
        {...props}
      />,
    );
    return { onAnadir, onPrecio, onQuitar };
  };

  it('sin nombre no deja añadir', () => {
    abrir();
    expect((screen.getByRole('button', { name: 'Añadir a la compra' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('con nombre y sin precio, añade con `null`', () => {
    const { onAnadir } = abrir();
    fireEvent.change(screen.getByLabelText('Qué es'), { target: { value: 'Café' } });
    fireEvent.click(screen.getByRole('button', { name: 'Añadir a la compra' }));
    expect(onAnadir).toHaveBeenCalledWith('Café', null);
  });

  it('con precio, lo lee', () => {
    const { onAnadir } = abrir();
    fireEvent.change(screen.getByLabelText('Qué es'), { target: { value: 'Agua' } });
    fireEvent.change(screen.getByLabelText(/Cuánto cuesta/), { target: { value: '2,10' } });
    fireEvent.click(screen.getByRole('button', { name: 'Añadir a la compra' }));
    expect(onAnadir).toHaveBeenCalledWith('Agua', 2.1);
  });

  it('un precio imposible bloquea y explica la salida', () => {
    abrir();
    fireEvent.change(screen.getByLabelText('Qué es'), { target: { value: 'Café' } });
    fireEvent.change(screen.getByLabelText(/Cuánto cuesta/), { target: { value: 'abc' } });
    expect((screen.getByRole('button', { name: 'Añadir a la compra' }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText(/Déjalo en blanco si no lo sabes/)).toBeTruthy();
  });

  it('el campo del precio pide teclado decimal: `numeric` no trae la coma en iOS', () => {
    abrir();
    expect(screen.getByLabelText(/Cuánto cuesta/).getAttribute('inputMode')).toBe('decimal');
  });

  it('avisa de que no suma al menú, que es la promesa que hay que sostener', () => {
    abrir();
    fireEvent.change(screen.getByLabelText(/Cuánto cuesta/), { target: { value: '3' } });
    expect(screen.getByText(/no al coste del menú/)).toBeTruthy();
  });
});

describe('la hoja de corregir', () => {
  it('pone precio a lo que no lo tenía', () => {
    const cafe = extra('Café', null);
    const onPrecio = vi.fn();
    render(
      <HojaExtra extra={cafe} onAnadir={() => {}} onPrecio={onPrecio} onQuitar={() => {}} onCerrar={() => {}} />,
    );
    fireEvent.change(screen.getByLabelText(/Cuánto cuesta/), { target: { value: '3,89' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(onPrecio).toHaveBeenCalledWith(cafe.id, 3.89);
  });

  it('cambia un precio que ya estaba', () => {
    const agua = extra('Agua', 2.1);
    const onPrecio = vi.fn();
    render(
      <HojaExtra extra={agua} onAnadir={() => {}} onPrecio={onPrecio} onQuitar={() => {}} onCerrar={() => {}} />,
    );
    fireEvent.change(screen.getByLabelText(/Cuánto cuesta/), { target: { value: '2,45' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(onPrecio).toHaveBeenCalledWith(agua.id, 2.45);
  });

  it('vaciar el precio lo devuelve a «sin precio», no a cero', () => {
    const agua = extra('Agua', 2.1);
    const onPrecio = vi.fn();
    render(
      <HojaExtra extra={agua} onAnadir={() => {}} onPrecio={onPrecio} onQuitar={() => {}} onCerrar={() => {}} />,
    );
    fireEvent.change(screen.getByLabelText(/Cuánto cuesta/), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(onPrecio).toHaveBeenCalledWith(agua.id, null);
  });

  it('quitar está aquí y no en la fila: en el súper, un borrado por fila es un accidente', () => {
    const cafe = extra('Café', null);
    const onQuitar = vi.fn();
    render(
      <HojaExtra extra={cafe} onAnadir={() => {}} onPrecio={() => {}} onQuitar={onQuitar} onCerrar={() => {}} />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Quitar de la compra' }));
    expect(onQuitar).toHaveBeenCalledWith(cafe.id);
  });

  it('al añadir NO se ofrece quitar: no hay nada que quitar todavía', () => {
    render(
      <HojaExtra extra={null} onAnadir={() => {}} onPrecio={() => {}} onQuitar={() => {}} onCerrar={() => {}} />,
    );
    expect(screen.queryByRole('button', { name: 'Quitar de la compra' })).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Analítica
// ---------------------------------------------------------------------------

describe('la analítica de extras', () => {
  it('NUNCA lleva el nombre: ahí el usuario escribe lo que quiere y es suyo', () => {
    const visto: { evento: string; props: object }[] = [];
    registrarSumideroAnalitica((evento, props) => visto.push({ evento, props }));
    analitica('extra_item_added', {
      has_price: true, price: 4.25, extras_count: 3, extras_total: 8.3,
      unpriced_extras_count: 1, week_number: 2,
    });
    const claves = Object.keys(visto[0].props);
    for (const prohibida of ['nombre', 'name', 'item_name', 'label']) {
      expect(claves).not.toContain(prohibida);
    }
  });
});
