/**
 * LOS INVARIANTES DEL MOTOR.
 *
 * Esto es al motor lo que catalogo/coherencia.ts es al recetario, y existe
 * por la misma razón: un fallo que nadie comprueba sobrevive rondas enteras.
 *
 * El caso que lo motivó: la silueta de la semana podía reservar el LUNES
 * como día de aprovechamiento, y el lunes no tiene nada cocinado antes de lo
 * que aprovechar. Con "mucha variedad" —que necesita exactamente dos huecos
 * de sobra para llegar a catorce— eso dejaba la semana ENTERA vacía en 2 de
 * cada 7 números de semana. Sobrevivió una ronda completa porque todas las
 * mediciones usaban `semanaNumero = 1`, que resultó ser una rotación buena.
 * Se encontró de casualidad.
 *
 * Regla de esta suite: cada invariante se comprueba sobre un BARRIDO, no
 * sobre un caso. Un caso que pasa no prueba nada — eso es exactamente lo que
 * pasó con la silueta.
 */

import { describe, expect, it } from 'vitest';
import datosJson from '../data/motor-datos.json';
import { consumoPorRacion, existenciasTrasLaSemana, proteinaAnimal, proteinaPorRacion } from './carrito.ts';
import { registroDe } from './reparto.ts';
import {
  costesPorProteina, generarSemana, rehacerDesde, repararHueco, recetarioAdaptado,
  FILTROS, GRAMOS_POR_NIVEL, ORDEN_PROTEINA, SEMANAS_DE_MEMORIA, siluetaDeSemana,
} from './seleccionar.ts';
import type { NivelProteina, PeticionSemana, Variedad } from './seleccionar.ts';
import type { DatosMotor, Hueco } from './tipos.ts';

const datos = datosJson as unknown as DatosMotor;
const VARIEDADES: Variedad[] = ['poca', 'normal', 'mucha'];
const NIVELES: NivelProteina[] = ['basica', 'normal', 'alta'];
const SEMANAS = [1, 2, 3, 4, 5, 6, 7];
const BASE = { datos, N: 2, numHuecos: 14, presupuesto: 51 } as const;

/** Todas las combinaciones × todos los números de semana de un ciclo. */
function* barrido(): Generator<PeticionSemana> {
  for (const variedad of VARIEDADES) {
    for (const proteina of NIVELES) {
      for (const semanaNumero of SEMANAS) {
        yield { ...BASE, variedad, proteina, semanaNumero };
      }
    }
  }
}

const nombre = (p: PeticionSemana) => `${p.variedad}·${p.proteina} semana ${p.semanaNumero}`;
const diaDe = (h: Hueco) => h.dia;

describe('el motor siempre devuelve una semana', () => {
  it('ninguna combinación × número de semana sale vacía', () => {
    const vacias: string[] = [];
    for (const peticion of barrido()) {
      const s = generarSemana(peticion);
      if (s.huecos.length !== peticion.numHuecos) vacias.push(nombre(peticion));
    }
    expect(vacias).toEqual([]);
  });

  it('con 7 huecos (solo comidas) tampoco', () => {
    const vacias: string[] = [];
    for (const variedad of VARIEDADES) {
      for (const semanaNumero of SEMANAS) {
        const s = generarSemana({ ...BASE, numHuecos: 7, variedad, proteina: 'normal', semanaNumero });
        if (s.huecos.length !== 7) vacias.push(`${variedad} semana ${semanaNumero}`);
      }
    }
    expect(vacias).toEqual([]);
  });

  it('sigue devolviendo semana con los filtros que menos recetas dejan', () => {
    const apretados = [
      { exclusiones: ['Vegano'] },
      { exclusiones: ['Vegano', 'Gluten'] },
      { exclusiones: ['Vegetariano'], esfuerzo: 'minimo' as const },
      { exclusiones: ['Huevo', 'Gluten', 'Soja'] },
    ];
    for (const f of apretados) {
      for (const semanaNumero of [1, 3, 5]) {
        const s = generarSemana({ ...BASE, variedad: 'normal', proteina: 'normal', semanaNumero, ...f });
        expect(s.huecos.length, `${f.exclusiones.join('+')} semana ${semanaNumero}`).toBe(14);
      }
    }
  });
});

describe('la forma de la semana', () => {
  it('ningún día es 100% sobras', () => {
    const malos: string[] = [];
    for (const peticion of barrido()) {
      const s = generarSemana(peticion);
      const porDia = new Map<string, Hueco[]>();
      for (const h of s.huecos) {
        if (!porDia.has(diaDe(h))) porDia.set(diaDe(h), []);
        porDia.get(diaDe(h))!.push(h);
      }
      for (const [dia, huecos] of porDia) {
        if (!huecos.some((h) => h.tipo === 'cocinado' || h.tipo === 'libre')) {
          malos.push(`${nombre(peticion)} · ${dia}`);
        }
      }
    }
    expect(malos).toEqual([]);
  });

  it('la silueta cambia de una semana a la siguiente, en los tres niveles', () => {
    // Se comprueba con el topeSobras REAL de cada variedad, no con uno
    // inventado: con "poca" el cupo llegaba a cubrir todos los días
    // disponibles y la rotación se quedaba sin nada que rotar — las siete
    // semanas salían con la misma forma y nadie lo vio.
    const topeSobras: Record<Variedad, number> = { poca: 14, normal: 4, mucha: 2 };
    for (const variedad of VARIEDADES) {
      const siluetas = SEMANAS.map((n) => [...siluetaDeSemana(14, topeSobras[variedad], n)].sort().join(','));
      for (let k = 1; k < siluetas.length; k++) {
        expect(siluetas[k], `${variedad}: semana ${k} y ${k + 1} iguales`).not.toBe(siluetas[k - 1]);
      }
    }
  });

  it('la forma REAL de la semana cambia entre semanas consecutivas', () => {
    for (const variedad of VARIEDADES) {
      const formas = SEMANAS.map((n) =>
        generarSemana({ ...BASE, variedad, proteina: 'normal', semanaNumero: n })
          .huecos.map((h) => (h.tipo === 'cocinado' ? 'C' : 's')).join(''));
      for (let k = 1; k < formas.length; k++) {
        expect(formas[k], `${variedad}: semanas ${k} y ${k + 1} con la misma silueta`).not.toBe(formas[k - 1]);
      }
    }
  });

  it('el lunes nunca lleva hueco de sobras: no hay nada cocinado antes', () => {
    for (const peticion of barrido()) {
      const lunes = generarSemana(peticion).huecos.filter((h) => h.dia === 'LUN');
      for (const h of lunes) {
        expect(h.tipo, `${nombre(peticion)} · LUN ${h.ranura}`).not.toBe('sobras');
        expect(h.tipo, `${nombre(peticion)} · LUN ${h.ranura}`).not.toBe('ensamblaje');
      }
    }
  });

  it('toda sobra viene de un hueco cocinado ANTERIOR de la misma receta', () => {
    for (const peticion of barrido()) {
      const s = generarSemana(peticion);
      s.huecos.forEach((h, i) => {
        if (h.tipo !== 'sobras' && h.tipo !== 'ensamblaje') return;
        expect(h.origen, `${nombre(peticion)} · hueco ${i} sin origen`).toBeTruthy();
        const j = s.huecos.findIndex((x) => x.dia === h.origen!.dia && x.ranura === h.origen!.ranura);
        expect(j, `${nombre(peticion)} · origen inexistente`).toBeGreaterThanOrEqual(0);
        expect(j, `${nombre(peticion)} · la sobra del hueco ${i} viene de ${j}, que es posterior`).toBeLessThan(i);
        expect(s.huecos[j].tipo).toBe('cocinado');
        expect(s.huecos[j].receta?.id).toBe(h.receta?.id);
      });
    }
  });
});

describe('lo que promete `cuadra`', () => {
  it('si cuadra, cabe en el presupuesto Y llega al suelo de proteína', () => {
    for (const peticion of barrido()) {
      const s = generarSemana(peticion);
      if (!s.cuadra) continue;
      expect(s.carrito.totalCarrito, `${nombre(peticion)} dice que cuadra y se pasa`).toBeLessThanOrEqual(51);
      expect(
        s.nutricion.proteinaPorPersonaDia,
        `${nombre(peticion)} dice que cuadra y no llega al suelo`,
      ).toBeGreaterThanOrEqual(GRAMOS_POR_NIVEL[peticion.proteina!]);
    }
  });

  it('si no cuadra, ofrece una salida en vez de un muro', () => {
    for (const peticion of barrido()) {
      const s = generarSemana(peticion);
      if (s.cuadra) continue;
      expect(s.salida, `${nombre(peticion)} no cuadra y no da salida`).toBeTruthy();
      expect(['presupuesto', 'proteina', 'ambos']).toContain(s.salida!.motivo);
    }
  });

  it('el suelo se escala con los huecos: 7 comidas no piden la proteína de 14', () => {
    const s = generarSemana({ ...BASE, numHuecos: 7, variedad: 'normal', proteina: 'normal', semanaNumero: 1 });
    expect(s.huecos.length).toBe(7);
    // Con la mitad de comidas planificadas, exigir el suelo diario entero era
    // matemáticamente imposible y la semana salía SIEMPRE marcada como rota.
    expect(s.cuadra).toBe(true);
  });

  it('el motor nunca deja un hueco vacío por su cuenta', () => {
    // El suelo se mide sobre los huecos CON COMIDA, así que un hueco vacío
    // baja el listón. Es seguro solo mientras los huecos vacíos los pida el
    // usuario. Este test es lo que lo sujeta.
    for (const peticion of barrido()) {
      for (const numHuecos of [7, 14]) {
        const s = generarSemana({ ...peticion, numHuecos });
        const vacios = s.huecos.filter((h) => h.tipo === 'libre').length;
        expect(vacios, `${nombre(peticion)} · ${numHuecos} huecos deja ${vacios} sin llenar`).toBe(0);
      }
    }
  });
});

describe('los filtros no se saltan nunca', () => {
  const casos: { nombre: string; exclusiones: string[] }[] =
    Object.keys(FILTROS).map((f) => ({ nombre: f, exclusiones: [f] }));

  it.each(casos)('«$nombre»: ninguna receta de la semana lo incumple', ({ nombre: filtro, exclusiones }) => {
    const permitidas = new Set(recetarioAdaptado(datos, exclusiones).map((r) => r.id));
    for (const semanaNumero of [1, 4]) {
      const s = generarSemana({ ...BASE, variedad: 'normal', proteina: 'normal', semanaNumero, exclusiones });
      for (const t of s.tandas) {
        expect(permitidas.has(t.receta.id), `${filtro}: se coló "${t.receta.nombre}"`).toBe(true);
      }
    }
  });

  it('el filtro de alergia mira las trazas y el de preferencia no', () => {
    // La pasta declara trazas de huevo. Un alérgico no puede comerla; un
    // vegano sí — una traza es una advertencia de línea de fábrica, no un
    // ingrediente.
    const conTrazaHuevo = datos.recetas.filter((r) =>
      r.ingredientes.some((i) => (datos.ingredientes[i.canonico].trazas ?? []).includes('huevo')));
    expect(conTrazaHuevo.length).toBeGreaterThan(0);

    const sinHuevo = new Set(recetarioAdaptado(datos, ['Huevo']).map((r) => r.id));
    const veganas = new Set(recetarioAdaptado(datos, ['Vegano']).map((r) => r.id));
    for (const r of conTrazaHuevo) {
      const esVegetal = r.ingredientes.every((i) =>
        !['carne', 'pescado', 'marisco', 'huevo', 'lacteo'].includes(datos.ingredientes[i.canonico].origen));
      expect(sinHuevo.has(r.id), `"${r.nombre}" tiene trazas de huevo y pasa el filtro de alergia`).toBe(false);
      if (esVegetal) expect(veganas.has(r.id), `"${r.nombre}" es vegetal y el filtro vegano la tira`).toBe(true);
    }
  });
});

describe('determinismo', () => {
  it('la misma petición da exactamente la misma semana', () => {
    for (const peticion of barrido()) {
      const a = generarSemana(peticion);
      const b = generarSemana(peticion);
      expect(a.huecos.map((h) => `${h.dia}|${h.ranura}|${h.receta?.id}|${h.tipo}`))
        .toEqual(b.huecos.map((h) => `${h.dia}|${h.ranura}|${h.receta?.id}|${h.tipo}`));
      expect(a.carrito.totalCarrito).toBe(b.carrito.totalCarrito);
    }
  });

  it('el precio que enseña el selector es el de la semana que se genera', () => {
    for (const variedad of VARIEDADES) {
      const peticion = { ...BASE, variedad, proteina: 'normal' as NivelProteina, semanaNumero: 1 };
      const costes = costesPorProteina(peticion);
      for (const nivel of ORDEN_PROTEINA) {
        const s = generarSemana({ ...peticion, proteina: nivel });
        if (!Number.isFinite(costes[nivel].carrito)) continue;
        expect(costes[nivel].carrito, `${variedad}·${nivel}: el selector miente`).toBe(s.carrito.totalCarrito);
      }
    }
  });
});

describe('el retoque es local', () => {
  it('cambiar o liberar un hueco toca ese hueco y como mucho su sobra', () => {
    for (const variedad of VARIEDADES) {
      const peticion = { ...BASE, variedad, proteina: 'normal' as NivelProteina, semanaNumero: 2 };
      const base = generarSemana(peticion);
      for (let i = 0; i < base.huecos.length; i++) {
        for (const retoque of ['cambiar', 'libre'] as const) {
          const r = repararHueco(peticion, base, i, retoque);
          if (!r) continue; // sin candidato local: cae al reparto global, medido aparte
          const cambiados = r.huecos.filter((h, k) =>
            h.receta?.id !== base.huecos[k].receta?.id || h.tipo !== base.huecos[k].tipo).length;
          expect(cambiados, `${variedad} hueco ${i} (${retoque}) cambió ${cambiados}`).toBeLessThanOrEqual(2);
        }
      }
    }
  });

  it('«cambiar» no repone el mismo plato', () => {
    for (const variedad of VARIEDADES) {
      const peticion = { ...BASE, variedad, proteina: 'normal' as NivelProteina, semanaNumero: 2 };
      const base = generarSemana(peticion);
      for (let i = 0; i < base.huecos.length; i++) {
        const r = repararHueco(peticion, base, i, 'cambiar');
        if (!r) continue;
        expect(r.huecos[i].receta?.id, `${variedad} hueco ${i}: el veto no aplicó`)
          .not.toBe(base.huecos[i].receta?.id);
      }
    }
  });

  it('«bájame el precio» NUNCA sube el precio', () => {
    // Lo cazó el usuario usando la app: pulsaba y a veces le salía un plato
    // más caro. Y era cierto —31 de 126 pulsaciones encarecían la semana,
    // una de ellas 6,37 €— porque el presupuesto no es solo techo sino
    // objetivo: el motor apunta al 95% y subía la semana que iba por debajo.
    for (const variedad of VARIEDADES) {
      for (const proteina of NIVELES) {
        const peticion = { ...BASE, variedad, proteina, semanaNumero: 2 };
        const base = generarSemana(peticion);
        for (let i = 0; i < base.huecos.length; i++) {
          const r = rehacerDesde(peticion, base, i, 'barato');
          expect(
            r.carrito.totalCarrito,
            `${variedad}·${proteina} hueco ${i}: pide barato y sube `
            + `${(r.carrito.totalCarrito - base.carrito.totalCarrito).toFixed(2)} €`,
          ).toBeLessThanOrEqual(base.carrito.totalCarrito + 0.005);
        }
      }
    }
  });
});

describe('la memoria entre semanas', () => {
  it('encadenando semanas, el solape baja', () => {
    const encadenar = (conMemoria: boolean) => {
      let historial: string[][] = [];
      let previa: string[] = [];
      const solapes: number[] = [];
      for (let n = 1; n <= 6; n++) {
        const s = generarSemana({
          ...BASE, variedad: 'normal', proteina: 'normal', semanaNumero: n,
          recetasRecientes: conMemoria ? historial : [],
        });
        const recetas = [...new Set(s.tandas.map((t) => t.receta.id))];
        if (n > 1) solapes.push(recetas.filter((r) => previa.includes(r)).length);
        previa = recetas;
        historial = [recetas, ...historial].slice(0, SEMANAS_DE_MEMORIA);
      }
      return solapes.reduce((a, b) => a + b, 0) / solapes.length;
    };
    const sin = encadenar(false);
    const con = encadenar(true);
    expect(con, `sin memoria ${sin.toFixed(1)}, con memoria ${con.toFixed(1)}`).toBeLessThan(sin);
    expect(con).toBeLessThan(4);
  });

  it('la memoria se relaja antes que romper el suelo de proteína', () => {
    // Se le da como "reciente" TODO el recetario: si la memoria fuera una
    // prohibición, aquí no habría semana. Tiene que degradar, no romperse.
    const todo = datos.recetas.map((r) => r.id);
    const s = generarSemana({
      ...BASE, variedad: 'normal', proteina: 'normal', semanaNumero: 1,
      recetasRecientes: [todo, todo, todo],
    });
    expect(s.huecos.length).toBe(14);
    expect(s.nutricion.cumpleSuelo).toBe(true);
  });
});

describe('la cuenta de la compra', () => {
  it('el carrito nunca es menor que el consumo: el envase entero se paga', () => {
    for (const peticion of barrido()) {
      const c = generarSemana(peticion).carrito;
      expect(c.totalCarrito, nombre(peticion)).toBeGreaterThanOrEqual(c.totalConsumo - 0.005);
      expect(c.totalPerecedero + c.totalInventario).toBeLessThanOrEqual(c.totalCarrito - c.totalConsumo + 0.05);
    }
  });

  it('el euro de más acaba en el plato, no en la basura', () => {
    /**
     * Casi se cuela lo contrario. Al hacer que el motor aprovechara el
     * presupuesto, con 65 € subía el carrito 13,72 € y solo 5,31 € llegaban
     * al plato: el perecedero pasaba de 3,59 € a 7,35 €. Gastar más comprando
     * comida que no se come es peor que no gastar, y es justo lo que este
     * proyecto dice que hay que minimizar.
     *
     * Se mide en agregado, no celda a celda: el greedy depende del camino y
     * hay celdas sueltas donde subir el presupuesto sale peor (ver la nota del
     * callejón sin salida en seleccionar.ts). Lo que no puede pasar es que la
     * tendencia sea comprar basura.
     */
    let comido = 0;
    let tirado = 0;
    for (const variedad of VARIEDADES) {
      for (const proteina of NIVELES) {
        const flaco = generarSemana({ ...BASE, variedad, proteina, presupuesto: 45, semanaNumero: 1 }).carrito;
        const gordo = generarSemana({ ...BASE, variedad, proteina, presupuesto: 80, semanaNumero: 1 }).carrito;
        comido += gordo.totalConsumo - flaco.totalConsumo;
        tirado += gordo.totalPerecedero - flaco.totalPerecedero;
      }
    }
    expect(comido, 'de 45 € a 80 € no se come más').toBeGreaterThan(0);
    expect(
      tirado / comido,
      `pasar de 45 € a 80 € come ${comido.toFixed(2)} € más y tira ${tirado.toFixed(2)} € más`,
    ).toBeLessThanOrEqual(0.8);
  });

  it('lo que ya está en el armario no se vuelve a comprar', () => {
    /**
     * El motor arrancaba cada semana con la cocina vacía. Medido con una
     * persona sola y 32 €, ocho semanas seguidas: pagaba ~31 € todas y se
     * comía ~14 €, comprando cebollas con 1,65 kg guardados y huevos con 18
     * en la nevera. Con despensa: 29,29 € de carrito y 17,24 € de comida.
     */
    for (const N of [1, 2, 4]) {
      const peticion = {
        ...BASE, N, presupuesto: 32 * N, variedad: 'normal' as Variedad, proteina: 'normal' as NivelProteina,
      };
      const primera = generarSemana({ ...peticion, semanaNumero: 1 });
      const enCasa = existenciasTrasLaSemana(primera.carrito);
      expect(Object.keys(enCasa).length, `N=${N}: la primera semana no deja nada en casa`).toBeGreaterThan(0);

      const sinDespensa = generarSemana({ ...peticion, semanaNumero: 2 });
      const conDespensa = generarSemana({ ...peticion, semanaNumero: 2, existencias: enCasa });

      // Nada de lo que hay en casa en cantidad suficiente vuelve al carrito.
      for (const l of conDespensa.carrito.lineas) {
        const tiene = enCasa[l.sku];
        if (!tiene || tiene.cantidad < l.necesario) continue;
        expect(l.compras, `N=${N}: compra "${l.nombre}" teniendo ${tiene.cantidad} en casa`).toBe(0);
      }
      // Y por el mismo dinero se come más.
      const antes = sinDespensa.carrito;
      const ahora = conDespensa.carrito;
      expect(
        ahora.totalConsumo / Math.max(0.01, ahora.totalCarrito),
        `N=${N}: la despensa no mejora los euros de comida por euro de carrito`,
      ).toBeGreaterThan(antes.totalConsumo / antes.totalCarrito);
    }
  });

  it('la despensa caduca en vez de crecer para siempre', () => {
    // Sin restar los días de la semana el armario llegaba a 40 productos y
    // 51 € a la sexta semana, y una bolsa de cebollas no está buena mes y
    // medio después.
    let enCasa = {} as ReturnType<typeof existenciasTrasLaSemana>;
    const tamanos: number[] = [];
    for (let semanaNumero = 1; semanaNumero <= 10; semanaNumero++) {
      const s = generarSemana({
        ...BASE, N: 1, presupuesto: 32, variedad: 'normal', proteina: 'normal', semanaNumero, existencias: enCasa,
      });
      enCasa = existenciasTrasLaSemana(s.carrito, enCasa);
      tamanos.push(Object.keys(enCasa).length);
      for (const [sku, e] of Object.entries(enCasa)) {
        expect(e.diasRestantes, `${sku} lleva en el armario más de lo que aguanta`).toBeGreaterThan(0);
      }
    }
    // Estado estable, no crecimiento: la segunda mitad no puede doblar a la primera.
    const media = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
    expect(media(tamanos.slice(5)), `el armario crece sin parar: ${tamanos.join(' ')}`)
      .toBeLessThan(media(tamanos.slice(0, 5)) * 2);
  });

  it('un hueco de sobras no cuesta nada y uno de ensamblaje sí', () => {
    for (const peticion of barrido()) {
      const s = generarSemana(peticion);
      for (const h of s.huecos) {
        if (h.tipo !== 'ensamblaje' || !h.ensamblaje) continue;
        const anade = consumoPorRacion(
          { ...h.receta!, ingredientes: h.ensamblaje.ingredientes }, datos, peticion.N,
        );
        expect(anade, `"${h.ensamblaje.nombre}" no añade nada: sería una sobra disfrazada`).toBeGreaterThan(0);
      }
    }
  });
});

describe('la semana se lee como comida de casa', () => {
  it('la cena no es otra comida entera', () => {
    // Antes de la regla de registro: arroz con pollo de 45 min como cena de
    // domingo, potaje de garbanzos de 55 para cenar un viernes.
    const pesadasDeCena: string[] = [];
    let cenas = 0;
    for (const peticion of barrido()) {
      for (const h of generarSemana(peticion).huecos) {
        if (h.ranura !== 'cena' || h.tipo !== 'cocinado' || !h.receta) continue;
        cenas++;
        if (registroDe(h.receta) === 'comida') pesadasDeCena.push(`${nombre(peticion)}: ${h.receta.nombre}`);
      }
    }
    // Blanda, no prohibición: bajo filtros estrechos puede no haber nada
    // ligero disponible, y una cena pesada es mejor que ninguna cena.
    const proporcion = pesadasDeCena.length / cenas;
    expect(proporcion, `${pesadasDeCena.length} de ${cenas} cenas son plato de mediodía`).toBeLessThan(0.35);
  });

  it('ningún ingrediente domina la semana', () => {
    // "Champiñón en 5 platos", "mucho tomate transversal": platos distintos
    // que saben todos igual. El motor contaba recetas, no sabores.
    for (const peticion of barrido()) {
      const s = generarSemana(peticion);
      const cuenta = new Map<string, number>();
      for (const t of s.tandas) {
        for (const ing of t.receta.ingredientes) {
          if (datos.ingredientes[ing.canonico].es_despensa) continue;
          cuenta.set(ing.canonico, (cuenta.get(ing.canonico) ?? 0) + 1);
        }
      }
      const tope = Math.max(3, Math.ceil(s.tandas.length * 0.6));
      for (const [ing, n] of cuenta) {
        // La cebolla y el ajo son base de sofrito y están en casi todo; el
        // problema son los ingredientes con sabor propio.
        if (['cebolla', 'ajo', 'tomate_triturado', 'tomate_frito'].includes(ing)) continue;
        expect(n, `${nombre(peticion)}: "${ing}" en ${n} de ${s.tandas.length} tandas`).toBeLessThanOrEqual(tope);
      }
    }
  });

  it('hay carne o pescado fresco cuando el recetario da para ello', () => {
    // Este invariante lo protegía la regla `obligado_fresco`, que la
    // telemetría midió en CERO rechazos. Se retiró del motor y se comprueba
    // aquí: si algún día deja de cumplirse, salta el test en vez de pasar
    // desapercibido.
    for (const peticion of barrido()) {
      const s = generarSemana(peticion);
      expect(s.nutricion.huecosConFresca, `${nombre(peticion)} sin proteína fresca`).toBeGreaterThanOrEqual(2);
    }
  });

  it('ningún día pide más de dos horas de fogón', () => {
    for (const peticion of barrido()) {
      const s = generarSemana(peticion);
      const porDia = new Map<string, number>();
      for (const h of s.huecos) {
        if (!h.receta) continue;
        const min = h.tipo === 'cocinado' ? h.receta.minutos : (h.ensamblaje?.minutos ?? 0);
        porDia.set(h.dia, (porDia.get(h.dia) ?? 0) + min);
      }
      for (const [dia, min] of porDia) {
        expect(min, `${nombre(peticion)} · ${dia}: ${min} min de cocina`).toBeLessThanOrEqual(120);
      }
    }
  });
});

describe('el recetario que ve el motor', () => {
  it('toda receta tiene proteína, coste y producto mapeado', () => {
    for (const r of datos.recetas) {
      expect(proteinaPorRacion(r, datos, 2), r.nombre).toBeGreaterThan(0);
      expect(consumoPorRacion(r, datos, 2), r.nombre).toBeGreaterThan(0);
      expect(['ninguna', 'conserva', 'fresca']).toContain(proteinaAnimal(r, datos));
    }
  });
});
