/**
 * ═══ QUÉ TE PARECE ESTE PLATO · LOS INVARIANTES ═══
 *
 * Los del motor van con barrido, como manda la suite de motor.test.ts: un caso
 * que pasa no prueba nada. Los del estado y la interfaz van con casos, porque
 * ahí lo que se comprueba es una máquina de estados pequeña y cerrada.
 *
 * Lo que NO se prueba aquí y es deliberado: que el bonus tenga un valor
 * concreto. Eso es calibración, se mide con un barrido fuera de la suite y
 * cambiará. Lo que sí tiene que aguantar es la PROPIEDAD: que un favorito salga
 * más y que no salga demasiado.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import datosJson from '../data/motor-datos.json';
import { generarSemana, recetarioAdaptado } from '../motor/seleccionar.ts';
import type { PeticionSemana } from '../motor/seleccionar.ts';
import type { DatosMotor } from '../motor/tipos.ts';
import {
  conValoracion, identidadDePlato, valoracionDe, platosBloqueados, platosFavoritos,
  cuentaPreferencias, nombresDeBloqueados,
} from './preferencias';
import type { PreferenciasPlatos } from './preferencias';
import { analitica, registrarSumideroAnalitica } from './analitica';
import ValoracionPlatoSelector from '../components/ValoracionPlatoSelector';
import HojaPlatosBloqueados from '../components/HojaPlatosBloqueados';
import type { Plato } from '../state/types';

const datos = datosJson as unknown as DatosMotor;
const AHORA = '2026-08-07T10:00:00.000Z';

const BASE = {
  datos, N: 2, numHuecos: 14, presupuesto: 65, variedad: 'normal', proteina: 'normal',
  esfuerzo: 'libre', exclusiones: [], postre: false, semanaNumero: 1,
  recetasRecientes: [], existencias: {},
} as const satisfies PeticionSemana;

const idsDeSemana = (p: PeticionSemana) =>
  generarSemana(p).huecos.map((h) => h.receta?.id).filter(Boolean) as string[];

const plato = (extra: Partial<Plato>): Plato => ({
  nombre: 'X', minutos: 10, precioRacion: 1, tipo: 'cocinado', recetaId: 'r1', ...extra,
});

afterEach(() => {
  cleanup();
  registrarSumideroAnalitica(null);
});

// ---------------------------------------------------------------------------
// 1, 2 · El mapa de preferencias
// ---------------------------------------------------------------------------

describe('guardar y quitar una valoración', () => {
  it('se guarda con su id, su valoración y su fecha', () => {
    const p = conValoracion({}, 'lentejas_chorizo', 'me_gusta', AHORA);
    expect(p.lentejas_chorizo).toEqual({
      platoId: 'lentejas_chorizo', valoracion: 'me_gusta', actualizadaEn: AHORA,
    });
    // Y se lee tal cual: es lo que se restaura al abrir la app.
    expect(valoracionDe(p, plato({ recetaId: 'lentejas_chorizo' }))).toBe('me_gusta');
  });

  it('«está bien» BORRA la entrada, venga de gustar o de no gustar', () => {
    for (const antes of ['me_gusta', 'no_quiero'] as const) {
      const conAlgo = conValoracion({}, 'r1', antes, AHORA);
      const neutral = conValoracion(conAlgo, 'r1', 'neutral', AHORA);
      expect(neutral).toEqual({});
      expect(valoracionDe(neutral, plato({}))).toBe('neutral');
    }
  });

  it('cambiar de opinión sustituye, no acumula', () => {
    let p: PreferenciasPlatos = conValoracion({}, 'r1', 'me_gusta', AHORA);
    p = conValoracion(p, 'r1', 'no_quiero', AHORA);
    expect(Object.keys(p)).toEqual(['r1']);
    expect(platosBloqueados(p)).toEqual(['r1']);
    expect(platosFavoritos(p)).toEqual([]);
  });

  it('repetir lo que ya está puesto devuelve el MISMO objeto', () => {
    // De esto depende que el reducer no escriba estado por un toque inútil.
    const p = conValoracion({}, 'r1', 'me_gusta', AHORA);
    expect(conValoracion(p, 'r1', 'me_gusta', AHORA)).toBe(p);
    expect(conValoracion({}, 'r1', 'neutral', AHORA)).toEqual({});
  });
});

// ---------------------------------------------------------------------------
// 11 · Qué se valora en cada tipo de hueco
// ---------------------------------------------------------------------------

describe('a qué plato se ata la valoración', () => {
  it('una sobra se valora como SU RECETA, no como plato aparte', () => {
    const cocinado = plato({ recetaId: 'lentejas', tipo: 'cocinado' });
    const sobra = plato({ recetaId: 'lentejas', tipo: 'sobras' });
    expect(identidadDePlato(sobra)).toEqual({ id: 'lentejas', tipo: 'receta' });
    // Y por tanto: bloquear desde la sobra bloquea también el día que se cocina.
    const p = conValoracion({}, identidadDePlato(sobra)!.id, 'no_quiero', AHORA);
    expect(valoracionDe(p, cocinado)).toBe('no_quiero');
  });

  it('un ensamblaje CON nombre propio se valora aparte de su receta base', () => {
    const base = plato({ recetaId: 'garbanzos', tipo: 'cocinado' });
    const ens = plato({ recetaId: 'garbanzos', ensamblajeId: 'garbanzos_huevo', tipo: 'ensamblaje' });
    expect(identidadDePlato(ens)).toEqual({ id: 'garbanzos_huevo', tipo: 'ensamblaje' });
    const p = conValoracion({}, 'garbanzos_huevo', 'no_quiero', AHORA);
    expect(valoracionDe(p, ens)).toBe('no_quiero');
    // La receta base NO se arrastra: son dos platos distintos para quien come.
    expect(valoracionDe(p, base)).toBe('neutral');
  });

  it('un ensamblaje SIN nombre propio hereda la identidad de su receta', () => {
    // Es el caso viejo: el principal aguanta y se sirve con el nombre original,
    // así que el usuario no distingue dos platos y no puede opinar de dos.
    const ens = plato({ recetaId: 'garbanzos', tipo: 'ensamblaje' });
    expect(identidadDePlato(ens)).toEqual({ id: 'garbanzos', tipo: 'receta' });
  });

  it('un hueco libre no se valora', () => {
    expect(identidadDePlato(null)).toBeNull();
    expect(valoracionDe({}, null)).toBe('neutral');
  });
});

// ---------------------------------------------------------------------------
// 3, 4, 5, 6, 7 · El motor
// ---------------------------------------------------------------------------

describe('el motor y las preferencias', () => {
  it('un plato bloqueado no aparece en NINGUNA semana nueva', () => {
    const bloqueado = idsDeSemana(BASE)[0];
    for (let semanaNumero = 1; semanaNumero <= 5; semanaNumero++) {
      for (const N of [1, 2, 4]) {
        const ids = idsDeSemana({ ...BASE, N, semanaNumero, platosBloqueados: [bloqueado] });
        expect(ids).not.toContain(bloqueado);
      }
    }
  });

  it('bloquear un plato NO desaparece del recetario los demás', () => {
    const todas = recetarioAdaptado(datos).map((r) => r.id);
    const conVeto = recetarioAdaptado(datos, [], Infinity, [todas[0]]).map((r) => r.id);
    expect(conVeto).toHaveLength(todas.length - 1);
    expect(conVeto).not.toContain(todas[0]);
  });

  it('un favorito sale MÁS, y no de forma excesiva', () => {
    /* La propiedad, no el número: marcar tiene que servir de algo y no puede
       convertir la semana en el mismo plato siete veces. */
    const sinMarcar = new Map<string, number>();
    const marcados: string[] = [];
    for (let s = 1; s <= 4; s++) {
      for (const id of idsDeSemana({ ...BASE, semanaNumero: s })) {
        sinMarcar.set(id, (sinMarcar.get(id) ?? 0) + 1);
      }
    }
    // Se marcan ocho que NO salían: si ya salían, el bonus no probaría nada.
    for (const r of recetarioAdaptado(datos)) {
      if (!sinMarcar.has(r.id) && marcados.length < 8) marcados.push(r.id);
    }

    let antes = 0;
    let despues = 0;
    let maximoEnUnaSemana = 0;
    for (let s = 1; s <= 4; s++) {
      antes += idsDeSemana({ ...BASE, semanaNumero: s }).filter((i) => marcados.includes(i)).length;
      const ids = idsDeSemana({ ...BASE, semanaNumero: s, platosFavoritos: marcados });
      despues += ids.filter((i) => marcados.includes(i)).length;
      for (const m of marcados) {
        maximoEnUnaSemana = Math.max(maximoEnUnaSemana, ids.filter((i) => i === m).length);
      }
    }
    expect(despues).toBeGreaterThan(antes);
    /* Tres es la tanda entera —el día que se cocina, su sobra y su ensamblaje—
       y eso NO es repetir plato, es aprovecharlo. Por encima de tres sería el
       bonus ganándole a BONUS_VARIEDAD, que es lo que no puede pasar. */
    expect(maximoEnUnaSemana).toBeLessThanOrEqual(3);
  });

  it('las preferencias no rompen el presupuesto', () => {
    const favoritos = recetarioAdaptado(datos).map((r) => r.id).slice(0, 10);
    for (const presupuesto of [55, 65, 90]) {
      for (const N of [1, 2, 3]) {
        const s = generarSemana({ ...BASE, N, presupuesto, platosFavoritos: favoritos });
        if (!s.cuadra) continue;
        expect(s.carrito.totalCarrito).toBeLessThanOrEqual(presupuesto);
      }
    }
  });

  it('marcar como favorito un plato prohibido NO lo mete en la semana', () => {
    /* El caso que importa de verdad: gusto contra seguridad alimentaria. El
       bonus es un término de puntuación y la exclusión es una criba previa, así
       que ni con el peso al máximo puede colarse. */
    const veganas = new Set(recetarioAdaptado(datos, ['Vegano']).map((r) => r.id));
    const prohibidas = recetarioAdaptado(datos).map((r) => r.id).filter((id) => !veganas.has(id));
    expect(prohibidas.length).toBeGreaterThan(0);

    const ids = idsDeSemana({
      ...BASE, exclusiones: ['Vegano'], platosFavoritos: prohibidas, pesoFavorito: 1000,
    });
    for (const id of ids) expect(veganas.has(id)).toBe(true);
  });

  it('sigue siendo determinista', () => {
    const p: PeticionSemana = {
      ...BASE,
      platosFavoritos: recetarioAdaptado(datos).map((r) => r.id).slice(0, 5),
      platosBloqueados: recetarioAdaptado(datos).map((r) => r.id).slice(60, 70),
    };
    const a = generarSemana(p);
    const b = generarSemana(p);
    expect(idsDeSemana(p)).toEqual(idsDeSemana(p));
    expect(a.carrito.totalCarrito).toBe(b.carrito.totalCarrito);
    expect(a.huecos.map((h) => h.tipo)).toEqual(b.huecos.map((h) => h.tipo));
  });

  it('un id que ya no existe en el recetario no rompe nada', () => {
    const s = generarSemana({
      ...BASE,
      platosBloqueados: ['receta_que_no_existe', ''],
      platosFavoritos: ['otra_que_tampoco', 'x'],
    });
    expect(s.huecos.filter((h) => h.receta).length).toBeGreaterThan(0);
    // Y da exactamente la misma semana que sin ellos: no casan con nada.
    expect(s.huecos.map((h) => h.receta?.id)).toEqual(generarSemana(BASE).huecos.map((h) => h.receta?.id));
  });
});

// ---------------------------------------------------------------------------
// 10 · Muchos bloqueos: diagnóstico, no muro
// ---------------------------------------------------------------------------

describe('cuando los bloqueos dejan al motor sin recetario', () => {
  const casiTodas = recetarioAdaptado(datos).map((r) => r.id).slice(0, -2);

  it('no revienta ni devuelve una semana a medias: da diagnóstico', () => {
    const s = generarSemana({ ...BASE, platosBloqueados: casiTodas });
    expect(s.sinCobertura).toBeTruthy();
    // Ningún hueco a medio llenar: o hay semana o hay diagnóstico.
    expect(s.huecos.filter((h) => h.receta)).toHaveLength(0);
  });

  it('el diagnóstico dice cuántos platos hay bloqueados y ofrece revisarlos', () => {
    const s = generarSemana({ ...BASE, platosBloqueados: casiTodas });
    expect(s.sinCobertura?.platosBloqueados).toBe(casiTodas.length);
    const salida = s.sinCobertura?.salidas.find((x) => x.tipo === 'bloqueados');
    expect(salida).toBeTruthy();
    expect(salida?.que).toBe(String(casiTodas.length));
  });

  it('NO se desbloquea nada por su cuenta para poder generar', () => {
    /* La regla del encargo: una preferencia que la app borra sola para salir
       del paso es una app que no escucha. Se comprueba que la petición que
       entra es la misma que se usa — el motor no puede tocarla. */
    const bloqueados = [...casiTodas];
    generarSemana({ ...BASE, platosBloqueados: bloqueados });
    expect(bloqueados).toEqual(casiTodas);
  });

  it('bloquear lo que queda de una alergia da diagnóstico con LAS DOS salidas', () => {
    const veganas = recetarioAdaptado(datos, ['Vegano']).map((r) => r.id);
    const s = generarSemana({ ...BASE, exclusiones: ['Vegano'], platosBloqueados: veganas });
    expect(s.sinCobertura).toBeTruthy();
    const tipos = new Set(s.sinCobertura?.salidas.map((x) => x.tipo));
    // La de la alergia y la de los platos, distinguibles: son dos cosas
    // distintas y la pantalla tiene que poder decirlas con frases distintas.
    expect(tipos.has('bloqueados')).toBe(true);
    expect(tipos.has('exclusion')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 14, 15 · La lista de bloqueados
// ---------------------------------------------------------------------------

describe('la lista de platos bloqueados', () => {
  const catalogo = {
    recetas: [{ id: 'r1', nombre: 'Lentejas con chorizo' }],
    ensamblajes: { r1: [{ id: 'e1', nombre: 'Lentejas salteadas' }] },
  };

  it('resuelve nombres de recetas y de ensamblajes, y ordena por lo último', () => {
    const p: PreferenciasPlatos = {
      r1: { platoId: 'r1', valoracion: 'no_quiero', actualizadaEn: '2026-01-01T00:00:00.000Z' },
      e1: { platoId: 'e1', valoracion: 'no_quiero', actualizadaEn: '2026-06-01T00:00:00.000Z' },
      f1: { platoId: 'f1', valoracion: 'me_gusta', actualizadaEn: AHORA },
    };
    const lista = nombresDeBloqueados(p, catalogo);
    expect(lista.map((x) => x.id)).toEqual(['e1', 'r1']); // los favoritos no salen
    expect(lista[0]).toMatchObject({ nombre: 'Lentejas salteadas', tipo: 'ensamblaje', existe: true });
    expect(lista[1]).toMatchObject({ nombre: 'Lentejas con chorizo', tipo: 'receta', existe: true });
  });

  it('un id que ya no existe se ENSEÑA, marcado, y no se esconde ni revienta', () => {
    const p: PreferenciasPlatos = {
      fantasma: { platoId: 'fantasma', valoracion: 'no_quiero', actualizadaEn: AHORA },
    };
    const lista = nombresDeBloqueados(p, catalogo);
    expect(lista).toHaveLength(1);
    expect(lista[0].existe).toBe(false);
    // Nunca el id crudo en pantalla: es un identificador interno.
    expect(lista[0].nombre).not.toContain('fantasma');
  });

  it('permite devolver un plato, y el contador baja', () => {
    /* Con una receta REAL: la hoja resuelve contra el recetario de verdad, y
       con un id inventado enseñaría el caso de "ya no existe", que es otro. */
    const real = datos.recetas[0];
    const p: PreferenciasPlatos = {
      [real.id]: { platoId: real.id, valoracion: 'no_quiero', actualizadaEn: AHORA },
    };
    const onPermitir = vi.fn();
    render(<HojaPlatosBloqueados preferenciasPlatos={p} onPermitir={onPermitir} onCerrar={() => {}} />);

    expect(screen.getByText(real.nombre)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Permitir' }));
    expect(onPermitir).toHaveBeenCalledWith(real.id, 'receta');

    // Y devolverlo lo saca del mapa: eso es lo que hace el reducer con neutral.
    expect(cuentaPreferencias(conValoracion(p, real.id, 'neutral', AHORA)).bloqueados).toBe(0);
  });

  it('sin ninguno dice «Ninguno» en vez de una lista vacía', () => {
    render(<HojaPlatosBloqueados preferenciasPlatos={{}} onPermitir={() => {}} onCerrar={() => {}} />);
    expect(screen.getByText(/Ninguno/)).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// 13 · La interfaz
// ---------------------------------------------------------------------------

describe('el selector de valoración', () => {
  it('marca con aria-pressed la que está puesta, y solo esa', () => {
    render(<ValoracionPlatoSelector valor="no_quiero" onCambiar={() => {}} />);
    const pulsados = screen.getAllByRole('button').filter((b) => b.getAttribute('aria-pressed') === 'true');
    expect(pulsados).toHaveLength(1);
    expect(pulsados[0].textContent).toBe('No, gracias');
  });

  it('sin valoración, la marcada es «Está bien»: neutral ES el estado por defecto', () => {
    render(<ValoracionPlatoSelector valor="neutral" onCambiar={() => {}} />);
    const pulsado = screen.getAllByRole('button').find((b) => b.getAttribute('aria-pressed') === 'true');
    expect(pulsado?.textContent).toBe('Está bien');
  });

  it('avisa de lo que pasa SOLO al bloquear, y dice que esta semana no cambia', () => {
    const { rerender } = render(<ValoracionPlatoSelector valor="me_gusta" onCambiar={() => {}} />);
    expect(screen.queryByText(/No saldrá/)).toBeNull();

    rerender(<ValoracionPlatoSelector valor="no_quiero" onCambiar={() => {}} />);
    const nota = screen.getByText(/No saldrá en las próximas semanas/);
    expect(nota.textContent).toContain('Esta se queda como está');

    // Y volver a «está bien» lo quita: la restricción desaparece.
    rerender(<ValoracionPlatoSelector valor="neutral" onCambiar={() => {}} />);
    expect(screen.queryByText(/No saldrá/)).toBeNull();
  });

  it('el grupo tiene nombre accesible: sin él son tres botones sueltos', () => {
    render(<ValoracionPlatoSelector valor="neutral" onCambiar={() => {}} />);
    expect(screen.getByRole('group', { name: '¿Qué te parece este plato?' })).toBeTruthy();
  });

  it('cada opción avisa con su valor', () => {
    const onCambiar = vi.fn();
    render(<ValoracionPlatoSelector valor="neutral" onCambiar={onCambiar} />);
    fireEvent.click(screen.getByRole('button', { name: 'Me gusta' }));
    expect(onCambiar).toHaveBeenCalledWith('me_gusta');
    fireEvent.click(screen.getByRole('button', { name: 'No, gracias' }));
    expect(onCambiar).toHaveBeenCalledWith('no_quiero');
  });
});

// ---------------------------------------------------------------------------
// Analítica
// ---------------------------------------------------------------------------

describe('la analítica', () => {
  it('no hace nada si nadie escucha, y un proveedor que falla no rompe la app', () => {
    expect(() => analitica('dish_liked', { dish_id: 'r1' })).not.toThrow();
    registrarSumideroAnalitica(() => { throw new Error('el proveedor se ha caído'); });
    expect(() => analitica('dish_liked', { dish_id: 'r1' })).not.toThrow();
  });

  it('lleva el id del plato pero NUNCA su nombre ni lo que el usuario no come', () => {
    const visto: { evento: string; props: object }[] = [];
    registrarSumideroAnalitica((evento, props) => visto.push({ evento, props }));
    analitica('dish_disliked', {
      dish_id: 'lentejas_chorizo', dish_type: 'receta', preference: 'no_quiero',
      week_number: 3, total_disliked_dishes: 2, total_liked_dishes: 1,
    });
    expect(visto).toHaveLength(1);
    const claves = Object.keys(visto[0].props);
    for (const prohibida of ['dish_name', 'nombre', 'exclusiones', 'allergies']) {
      expect(claves).not.toContain(prohibida);
    }
  });
});
