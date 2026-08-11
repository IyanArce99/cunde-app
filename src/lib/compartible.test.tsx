import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import {
  diferencia, filasDelTicket, porPersonaYComida, porcentajeDiferencia,
  rangoDeSemana, sePuedeComparar, totalPrevisto, tramoDeDiferencia,
} from './compartible';
import type { DatosCompartibles } from './compartible';
import TicketCompartible from '../components/TicketCompartible';
import HojaCompartir, { texto } from '../components/HojaCompartir';
import { registrarSumideroAnalitica } from './analitica';
import type { EventoAnalitica, PropsAnalitica } from './analitica';

/**
 * ═══ LO QUE ESTOS TESTS VIGILAN ═══
 *
 * Compartir es la única cosa de la app que manda datos FUERA. Todo lo demás
 * vive en el móvil del usuario y se rompe hacia dentro; esto se rompe hacia
 * fuera, delante de gente que no ha instalado nada.
 *
 * Así que hay dos familias de test y la primera importa más que la segunda:
 *
 *   1. QUÉ SALE — que en la tarjeta no aparezca nada que el usuario no haya
 *      decidido compartir, y que no se afirme lo que no se puede medir.
 *   2. QUÉ PASA — que el preview y el PNG digan lo mismo, que cancelar no sea
 *      un fallo, y que la hoja no se quede colgada.
 */

const SEMANA: DatosCompartibles = {
  tipo: 'semana',
  supermercado: 'Mercadona',
  personas: 2,
  comidas: 7,
  rango: '7–13 AGO',
  presupuesto: 65,
  menu: 61.2,
};

const RESULTADO: DatosCompartibles = {
  tipo: 'resultado',
  supermercado: 'Mercadona',
  personas: 2,
  comidas: 7,
  rango: '7–13 AGO',
  menu: 61.2,
  ticket: 62.4,
};

describe('qué sale en la tarjeta', () => {
  it('la interfaz no tiene NINGÚN campo privado', () => {
    /**
     * El test que sostiene todo el diseño de `compartible.ts`.
     *
     * No comprueba un render: comprueba las CLAVES del objeto. Si alguien
     * añade `codigoPostal` o `exclusiones` a `DatosCompartibles` porque «hace
     * falta para la tarjeta», este test se cae aquí y no tres meses después en
     * una captura de pantalla de un usuario.
     */
    const prohibidas = [
      'codigoPostal', 'cp', 'almacen', 'exclusiones', 'alergias', 'platos',
      'recetas', 'skus', 'historial', 'despensa', 'email', 'id', 'usuario',
      'contadores', 'suscripcion',
    ];
    const claves = Object.keys({ ...SEMANA, ...RESULTADO });
    for (const p of prohibidas) expect(claves).not.toContain(p);
  });

  it('no aparece ningún nombre de plato en el texto renderizado', () => {
    render(<TicketCompartible datos={SEMANA} />);
    const texto = document.body.textContent ?? '';
    for (const plato of ['Lentejas', 'Merluza', 'Pollo', 'Arroz']) {
      expect(texto).not.toContain(plato);
    }
  });

  it('el supermercado sí sale: es público', () => {
    render(<TicketCompartible datos={SEMANA} />);
    expect(screen.getByText(/MERCADONA/)).toBeTruthy();
  });

  it('la frase que acompaña no lleva cifras', () => {
    // El importe está en la imagen. En el texto se colaría en sitios donde la
    // imagen no se ve: una notificación, el asunto de un correo.
    for (const d of [SEMANA, RESULTADO]) expect(texto(d)).not.toMatch(/\d/);
  });

  it('la frase no es publicidad', () => {
    for (const d of [SEMANA, RESULTADO]) {
      expect(texto(d)).not.toMatch(/desc[aá]rga|inst[aá]la|http|!|¡/i);
    }
  });
});

describe('las dos cuentas, que no se mezclan', () => {
  it('el por persona y comida usa el CARRITO, no el consumo', () => {
    expect(porPersonaYComida(SEMANA)).toBeCloseTo(61.2 / 2 / 7, 6);
  });

  it('los extras con precio suman al por persona y comida', () => {
    expect(porPersonaYComida({ ...SEMANA, extras: 8 })).toBeCloseTo(69.2 / 2 / 7, 6);
  });

  it('con cero personas no divide entre cero', () => {
    expect(porPersonaYComida({ ...SEMANA, personas: 0 })).toBeNull();
  });

  it('con cero comidas tampoco', () => {
    expect(porPersonaYComida({ ...SEMANA, comidas: 0 })).toBeNull();
  });

  it('el total previsto es menú más extras con precio', () => {
    expect(totalPrevisto({ ...SEMANA, extras: 8, extrasSinPrecio: 2 })).toBeCloseTo(69.2, 6);
  });
});

describe('cuándo se puede comparar', () => {
  it('con ticket y sin extras sin precio, sí', () => {
    expect(sePuedeComparar(RESULTADO)).toBe(true);
    expect(diferencia(RESULTADO)).toBeCloseTo(1.2, 6);
  });

  it('con UN extra sin precio, NO', () => {
    const d = { ...RESULTADO, extrasSinPrecio: 1 };
    expect(sePuedeComparar(d)).toBe(false);
    expect(diferencia(d)).toBeNull();
    expect(porcentajeDiferencia(d)).toBeNull();
  });

  it('la tarjeta de semana nunca compara: no hay ticket todavía', () => {
    expect(sePuedeComparar(SEMANA)).toBe(false);
  });

  it('sin ticket no compara aunque el tipo sea resultado', () => {
    expect(sePuedeComparar({ ...RESULTADO, ticket: undefined })).toBe(false);
  });

  it('con previsto 0 no sale un Infinity%', () => {
    // Pasó de verdad en el cierre: un porcentaje infinito en una imagen que se
    // manda a otra gente.
    expect(porcentajeDiferencia({ ...RESULTADO, menu: 0, ticket: 12 })).toBeNull();
  });

  it('el porcentaje va en absoluto: el signo lo lleva la diferencia', () => {
    const menos = { ...RESULTADO, ticket: 55 };
    expect(diferencia(menos)!).toBeLessThan(0);
    expect(porcentajeDiferencia(menos)!).toBeGreaterThan(0);
  });

  it('el tramo no dice el euro exacto', () => {
    expect(tramoDeDiferencia(RESULTADO)).toBe('0-2');
    expect(tramoDeDiferencia({ ...RESULTADO, ticket: 90 })).toBe('10+');
    expect(tramoDeDiferencia({ ...RESULTADO, extrasSinPrecio: 1 })).toBeNull();
  });
});

describe('el rango de fechas', () => {
  it('dentro del mismo mes dice el mes una vez', () => {
    expect(rangoDeSemana('2026-08-07')).toBe('7–13 AGO');
  });

  it('cruzando de mes los dice los dos', () => {
    expect(rangoDeSemana('2026-08-28')).toBe('28 AGO – 3 SEP');
  });

  it('cruzando de año NO dice el año', () => {
    expect(rangoDeSemana('2026-12-29')).toBe('29 DIC – 4 ENE');
  });

  it('sin fecha de inicio no se inventa un rango', () => {
    expect(rangoDeSemana(null)).toBeNull();
  });
});

describe('las filas del ticket', () => {
  it('la semana enseña presupuesto, cesta y saldo', () => {
    const etiquetas = filasDelTicket(SEMANA).map((f) => ('etiqueta' in f ? f.etiqueta : f.clase));
    expect(etiquetas).toEqual(['PRESUPUESTO', 'CESTA', 'TE SOBRAN']);
  });

  it('pasarse del presupuesto cambia el rótulo y pinta en rojo', () => {
    const filas = filasDelTicket({ ...SEMANA, menu: 71 });
    const total = filas.find((f) => f.clase === 'total')!;
    expect(total).toMatchObject({ etiqueta: 'TE PASAS', color: 'roja' });
  });

  it('sobrar NO se pinta en rojo', () => {
    const total = filasDelTicket(SEMANA).find((f) => f.clase === 'total')!;
    expect('color' in total ? total.color : undefined).toBeUndefined();
  });

  it('sin extras no sale una fila «EXTRAS 0,00 €»', () => {
    const etiquetas = filasDelTicket(RESULTADO).map((f) => ('etiqueta' in f ? f.etiqueta : ''));
    expect(etiquetas).not.toContain('EXTRAS');
    expect(etiquetas).toContain('PREVISTO');
  });

  it('con extras el menú se llama MENÚ y aparecen las tres filas', () => {
    const etiquetas = filasDelTicket({ ...RESULTADO, extras: 8 })
      .map((f) => ('etiqueta' in f ? f.etiqueta : ''));
    expect(etiquetas).toEqual(['MENÚ', 'EXTRAS', 'TOTAL PREVISTO', 'TICKET', 'DIFERENCIA']);
  });

  it('con extras sin precio no hay fila DIFERENCIA, hay explicación', () => {
    const filas = filasDelTicket({ ...RESULTADO, extras: 8, extrasSinPrecio: 2 });
    expect(filas.some((f) => 'etiqueta' in f && f.etiqueta === 'DIFERENCIA')).toBe(false);
    const nota = filas.find((f) => f.clase === 'nota');
    expect(nota && 'texto' in nota ? nota.texto : '').toMatch(/2 extras sin precio/);
  });

  it('un solo extra sin precio se dice en singular', () => {
    const filas = filasDelTicket({ ...RESULTADO, extrasSinPrecio: 1 });
    const nota = filas.find((f) => f.clase === 'nota');
    expect(nota && 'texto' in nota ? nota.texto : '').toMatch(/1 extra sin precio/);
  });
});

describe('el preview y la imagen dicen lo mismo', () => {
  it('el preview pinta exactamente las filas de filasDelTicket', () => {
    /**
     * El test que garantiza que la previsualización no miente.
     *
     * Si el HTML y el canvas decidieran por su cuenta qué filas enseñar, el
     * usuario aprobaría una tarjeta y mandaría otra. Aquí se comprueba que el
     * preview no añade ni se salta ninguna.
     */
    const datos = { ...RESULTADO, extras: 8 };
    render(<TicketCompartible datos={datos} />);
    for (const f of filasDelTicket(datos)) {
      if (!('etiqueta' in f)) continue;
      expect(screen.getByText(f.etiqueta)).toBeTruthy();
      /* El espacio de `eur()` es DURO (U+00A0). Testing-library normaliza el
         texto del DOM pero no el patrón, así que buscar el valor tal cual no
         encuentra nada. Se normaliza aquí para comparar lo mismo con lo mismo
         — el espacio duro es intencionado y está probado en format.ts. */
      expect(screen.getAllByText(f.valor.replace(/ /g, ' ')).length).toBeGreaterThan(0);
    }
  });

  it('el preview es texto, no una imagen', () => {
    // Un `img` con el PNG no lo lee un lector de pantalla ni respeta el tamaño
    // de letra del sistema, y obligaría a generar la imagen para poder verla.
    const { container } = render(<TicketCompartible datos={SEMANA} />);
    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('canvas')).toBeNull();
  });

  it('los conceptos y sus importes van emparejados para el lector de pantalla', () => {
    const { container } = render(<TicketCompartible datos={SEMANA} />);
    expect(container.querySelectorAll('dt').length).toBe(container.querySelectorAll('dd').length);
    expect(container.querySelectorAll('dt').length).toBeGreaterThan(0);
  });

  it('la cifra grande de la semana es el por persona y comida', () => {
    render(<TicketCompartible datos={SEMANA} />);
    expect(screen.getByText('POR PERSONA Y COMIDA')).toBeTruthy();
    expect(screen.getByText('4,37 €')).toBeTruthy();
  });

  it('el porcentaje sale con UNA décima, no con dos', () => {
    render(<TicketCompartible datos={RESULTADO} />);
    expect(screen.getByText('2,0%')).toBeTruthy();
  });

  it('el singular de personas se dice bien', () => {
    render(<TicketCompartible datos={{ ...SEMANA, personas: 1 }} />);
    expect(screen.getByText(/1 PERSONA ·/)).toBeTruthy();
  });

  it('sin rango la cabecera no deja un separador huérfano', () => {
    render(<TicketCompartible datos={{ ...SEMANA, rango: null }} />);
    expect(screen.getByText('MERCADONA')).toBeTruthy();
  });
});

/* ═══ LA HOJA ═══ */

const eventos: { evento: EventoAnalitica; props: PropsAnalitica }[] = [];

beforeEach(() => {
  eventos.length = 0;
  registrarSumideroAnalitica((evento, props) => { eventos.push({ evento, props }); });
});

afterEach(() => {
  registrarSumideroAnalitica(null);
  vi.restoreAllMocks();
});

/** El PNG no se puede generar en jsdom: no hay canvas 2D de verdad. */
function fingirCanvas(base64 = 'AAAA') {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
    fillRect: () => {}, fillText: () => {}, beginPath: () => {}, moveTo: () => {},
    lineTo: () => {}, stroke: () => {}, set font(_: string) {}, set fillStyle(_: string) {},
    set textAlign(_: string) {}, set textBaseline(_: string) {}, set letterSpacing(_: string) {},
    set strokeStyle(_: string) {}, set lineWidth(_: number) {},
  } as unknown as CanvasRenderingContext2D);
  vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue(`data:image/png;base64,${base64}`);
}

describe('la hoja de compartir', () => {
  it('la previsualización aparece SIN generar la imagen', () => {
    // Es la decisión de diseño de la hoja: se ve al instante y el PNG —cientos
    // de milisegundos en un móvil viejo— solo se fabrica si el usuario pulsa.
    const toDataURL = vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL');
    render(<HojaCompartir datos={SEMANA} onCerrar={() => {}} />);
    expect(screen.getByText('PRESUPUESTO')).toBeTruthy();
    expect(toDataURL).not.toHaveBeenCalled();
  });

  it('avisa de que se comparte una imagen y nada más', () => {
    render(<HojaCompartir datos={SEMANA} onCerrar={() => {}} />);
    expect(screen.getByText(/Se comparte una imagen/)).toBeTruthy();
  });

  it('emite share_sheet_opened UNA vez, con el tipo pero sin importes', () => {
    render(<HojaCompartir datos={RESULTADO} onCerrar={() => {}} />);
    const abiertas = eventos.filter((e) => e.evento === 'share_sheet_opened');
    expect(abiertas).toHaveLength(1);
    expect(abiertas[0].props.share_type).toBe('resultado');
    expect(abiertas[0].props.diff_bucket).toBe('0-2');
    expect(JSON.stringify(abiertas[0].props)).not.toContain('61.2');
  });

  it('compartir bien cierra la hoja y cuenta share_completed', async () => {
    fingirCanvas();
    Object.assign(navigator, {
      canShare: () => true,
      share: vi.fn().mockResolvedValue(undefined),
    });
    const onCerrar = vi.fn();
    render(<HojaCompartir datos={SEMANA} onCerrar={onCerrar} />);
    fireEvent.click(screen.getByRole('button', { name: /Compartir|Guardar la imagen/ }));
    await waitFor(() => expect(onCerrar).toHaveBeenCalled());
    expect(eventos.map((e) => e.evento)).toContain('share_completed');
  });

  it('CANCELAR no es un fallo: no cierra la hoja y cuenta share_dismissed', async () => {
    /**
     * Cancelar es una respuesta, no un error.
     *
     * Contarlo como fallo llenaría la analítica de errores que no lo son, y
     * cerrar la hoja le quitaría al usuario la posibilidad de volver a
     * intentarlo — que es justo lo que va a querer si cerró la hoja del
     * sistema sin querer.
     */
    fingirCanvas();
    Object.assign(navigator, {
      canShare: () => true,
      share: vi.fn().mockRejectedValue(new DOMException('cancelado', 'AbortError')),
    });
    const onCerrar = vi.fn();
    render(<HojaCompartir datos={SEMANA} onCerrar={onCerrar} />);
    fireEvent.click(screen.getByRole('button', { name: /Compartir|Guardar la imagen/ }));
    await waitFor(() => expect(eventos.map((e) => e.evento)).toContain('share_dismissed'));
    expect(onCerrar).not.toHaveBeenCalled();
    expect(eventos.map((e) => e.evento)).not.toContain('share_image_failed');
  });

  it('si la imagen no se puede generar, se dice y el botón vuelve a servir', async () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
    render(<HojaCompartir datos={SEMANA} onCerrar={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: /Compartir|Guardar la imagen/ }));
    await waitFor(() => expect(screen.getByText(/No he podido preparar la imagen/)).toBeTruthy());
    expect(eventos.map((e) => e.evento)).toContain('share_image_failed');
    const boton = screen.getByRole('button', { name: /Compartir|Guardar la imagen/ });
    expect((boton as HTMLButtonElement).disabled).toBe(false);
  });

  it('el aviso de estado es una región viva', () => {
    // Sin esto, quien no ve la pantalla pulsa «Compartir» y no se entera ni de
    // que está preparándose ni de que ha fallado.
    const { container } = render(<HojaCompartir datos={SEMANA} onCerrar={() => {}} />);
    expect(container.querySelector('output')).toBeTruthy();
  });

  it('el tiempo de generación se cuenta redondeado, no al milisegundo', async () => {
    fingirCanvas();
    Object.assign(navigator, { canShare: () => false, share: undefined });
    render(<HojaCompartir datos={SEMANA} onCerrar={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: /Compartir|Guardar la imagen/ }));
    await waitFor(() => {
      const e = eventos.find((x) => x.evento === 'share_image_generated');
      expect(e).toBeTruthy();
      expect(e!.props.generation_ms! % 100).toBe(0);
    });
  });
});
