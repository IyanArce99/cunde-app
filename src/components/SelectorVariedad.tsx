import type { Variedad } from '../state/types';
import type { Contexto } from '../lib/derive';
import type { CosteOpcion } from '../motor/seleccionar.ts';
import { eur } from '../lib/format';
import './SelectorVariedad.css';

const ORDEN: Variedad[] = ['poca', 'normal', 'mucha'];

/**
 * TRES SEMANAS REALES, ORDENADAS POR PRECIO. SIN ADJETIVOS.
 *
 * Esto era "¿Cuánta variedad quieres? · Poca / Normal / Mucha", y prometía que
 * más variedad cuesta más. Era falso en 12 de 15 combinaciones de comensales y
 * presupuesto: con 1 persona y 80 €, "mucha" salía 8,57 € MÁS BARATA que
 * "poca".
 *
 * Y no era un fallo del motor que se pudiera arreglar. Medido sobre las 15
 * celdas, ordenando de barata a cara, ninguna consecuencia acompaña al precio:
 *
 *   minutos de cocina 5/15 · proteína 4/15 · tandas 4/15
 *   platos distintos  3/15 · perecedero 3/15 · repeticiones 1/15
 *
 * y el azar da 5/15. Todo está en el nivel del azar o por debajo. La causa es
 * estructural: los tres niveles NO son conjuntos anidados —"mucha" permite 12
 * recetas pero prohíbe las sobras, "poca" permite 5 pero deja recalentar media
 * semana—, así que ni un optimizador perfecto los ordenaría. La premisa estaba
 * mal desde el diseño, no desde la implementación.
 *
 * Conservar los nombres habría sido mentir: "poca variedad" tendría más platos
 * que "mucha" en 6 de 15, y "casi sin repetir" repetiría más que la barata en 5
 * de 15. Una de cada tres veces la etiqueta contradiría lo que hay dentro, en
 * una app cuya única defensa es que sus números no mienten.
 *
 * Lo que queda: tres semanas que el motor sabe montar, puestas en fila por lo
 * que cuestan, cada una con lo que trae. El orden es verdad por construcción
 * porque el criterio de presentación ES el precio. El usuario elige mirando
 * datos, no adjetivos, que es lo que hace en el resto de la app.
 *
 * NO HAY MIGRACIÓN. El valor guardado sigue siendo 'poca' | 'normal' | 'mucha'
 * —son las tres estrategias de búsqueda del motor, que no cambian— y lo único
 * que cambia es cómo se presentan. Quien tenía "poca" guardada sigue con
 * exactamente la misma semana; ahora la ve donde le toque por precio, con sus
 * cifras, en vez de con una etiqueta que a lo mejor no era cierta.
 */
const SelectorVariedad: React.FC<{
  ctx: Contexto;
  costes: Record<Variedad, CosteOpcion> | null;
  onCambiar: (v: Variedad) => void;
}> = ({ ctx, costes, onCambiar }) => {
  /**
   * Ordenar por precio, y las no disponibles al final: una semana que no cabe
   * o no llega al suelo de proteína no compite por ser la más barata.
   */
  const ordenadas = ORDEN
    .map((v) => ({ v, c: costes?.[v] ?? null }))
    .sort((a, b) => {
      if (!a.c || !b.c) return 0;
      if (a.c.disponible !== b.c.disponible) return a.c.disponible ? -1 : 1;
      if (!Number.isFinite(a.c.carrito)) return 1;
      if (!Number.isFinite(b.c.carrito)) return -1;
      return a.c.carrito - b.c.carrito;
    });

  /**
   * ═══ DOS OPCIONES, Y SALEN DE LOS DATOS · NO ESTÁN FIJADAS A MANO ═══
   *
   * Eran tres botones con tres precios, y la decisión que hay detrás es una
   * sola: ¿me importa volver a cocinar lo mismo, o prefiero pagar menos?
   *
   * Así que se reparten en dos grupos por lo único que las separa —si alguna
   * receta se cocina dos veces— y de cada grupo se enseña la más barata. Las
   * etiquetas son verdad POR CONSTRUCCIÓN: «nunca repites plato» solo aparece
   * sobre una semana cuyo `platosRepetidos` es 0. No se puede desincronizar de
   * los datos porque sale de ellos.
   *
   * Y no se fija «poca» y «mucha» a dedo: si un día «normal» resultara ser la
   * más barata de las que repiten, sería esa la que se enseña. Medido a 14
   * comidas: poca 9 tandas / 5 recetas, normal 10 / 9, mucha 12 / 12.
   *
   * ═══ Y CON 7 COMIDAS NO SE ENSEÑA NADA ═══
   *
   * Porque ahí no hay dos grupos: con siete huecos casi ninguna semana repite
   * plato —medido, 0 de 5 en «normal» y en «mucha»— así que los tres niveles dan
   * 5,0 · 5,4 · 6,2 platos y el precio va al REVÉS, más variado sale más barato.
   * Tres botones para una decisión que no existe. Si solo queda un grupo, el
   * selector entero desaparece: quien decide eso es el dato, no un `if` sobre el
   * número de comidas.
   */
  const disponibles = ordenadas.filter((o) => o.c?.disponible && Number.isFinite(o.c.carrito));
  /**
   * De cada grupo, la del usuario si está ahí; si no, la más barata.
   *
   * Lo segundo era lo único que hacía, y se vio en la primera captura: con
   * «poca» puesta a 63,77 € el selector enseñaba «normal» a 63,14 y «mucha» a
   * 59,88, porque normal es más barata que poca dentro del grupo que repite.
   * Resultado: ninguno de los dos botones salía marcado y el usuario no
   * encontraba su propia semana en pantalla.
   *
   * Lo que el usuario tiene puesto no se puede esconder nunca, aunque no sea lo
   * más barato de su grupo.
   */
  const deGrupo = (grupo: typeof disponibles) =>
    grupo.find((o) => o.v === ctx.variedad) ?? grupo[0];
  const repiten = disponibles.filter((o) => (o.c!.platosRepetidos ?? 0) > 0);
  const sinRepetir = disponibles.filter((o) => (o.c!.platosRepetidos ?? 0) === 0);
  const dosGrupos = repiten.length > 0 && sinRepetir.length > 0;
  /* Mientras el motor calcula no hay grupos todavía, y esconder el selector para
     enseñarlo medio segundo después es peor que dejarlo con «calculando». */
  let aEnseñar = ordenadas.slice(0, 2);
  if (costes !== null) {
    if (!dosGrupos) return null;
    aEnseñar = [deGrupo(repiten), deGrupo(sinRepetir)];
  }

  return (
    <div className="semanas" aria-busy={costes === null}>
      {aEnseñar.map(({ v, c }) => {
        const elegida = ctx.variedad === v;
        const fuera = !!c && !c.disponible;
        return (
          <button
            key={v}
            type="button"
            className={`semanas__op${elegida ? ' semanas__op--elegida' : ''}${fuera ? ' semanas__op--fuera' : ''}`}
            aria-pressed={elegida}
            disabled={fuera}
            onClick={() => onCambiar(v)}
          >
            <span className="semanas__precio">
              {c && Number.isFinite(c.carrito) ? eur(c.carrito) : '···'}
            </span>
            {/**
              * LO QUE DE VERDAD CAMBIA ENTRE LAS DOS: SI VUELVES A COCINAR LO
              * MISMO.
              *
              * Decía «repites 2» sobre la semana de mucha variedad, y en esa
              * semana no se cocina dos veces ningún plato: esos dos huecos son
              * sobras del lunes, que es cómo la semana sale barata. La palabra
              * era la misma para dos cosas distintas y la etiqueta mentía.
              *
              * Ahora se cuenta `platosRepetidos` —tandas menos recetas
              * distintas— y por eso «nunca repites plato» se puede afirmar.
              */}
            <span className="semanas__dato">{queTrae(c)}</span>
            {fuera && <span className="semanas__fuera">{motivo(c)}</span>}
          </button>
        );
      })}
    </div>
  );
};

/** Lo que separa a las dos semanas, dicho sin adjetivos. */
function queTrae(c: CosteOpcion | null): string {
  if (!c) return 'calculando';
  if (c.platosRepetidos === 0) return 'nunca repites plato';
  return `repites ${c.platosRepetidos} ${c.platosRepetidos === 1 ? 'plato' : 'platos'}`;
}

/** Por qué no se puede elegir. En una línea, sin culpar al usuario. */
function motivo(c: CosteOpcion | null): string {
  if (!c) return '';
  if (c.porque === 'recetario') return 'no hay recetas';
  if (c.porque === 'presupuesto') return 'no cabe';
  if (c.porque === 'proteina') return 'no llega';
  return '';
}

export default SelectorVariedad;
