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

  return (
    <div className="semanas" aria-busy={costes === null}>
      {ordenadas.map(({ v, c }) => {
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
            {/* Los dos datos con los que se decide, sin adjetivarlos. Que uno
                sea "mejor" que otro depende de la semana que tenga el usuario,
                y eso no lo sabemos nosotros. */}
            <span className="semanas__dato">
              {c ? `${c.platos} platos` : 'calculando'}
            </span>
            <span className="semanas__dato">
              {c ? (c.repeticiones === 0 ? 'sin repetir' : `repites ${c.repeticiones}`) : ''}
            </span>
            {fuera && <span className="semanas__fuera">{motivo(c)}</span>}
          </button>
        );
      })}
    </div>
  );
};

/** Por qué no se puede elegir. En una línea, sin culpar al usuario. */
function motivo(c: CosteOpcion | null): string {
  if (!c) return '';
  if (c.porque === 'recetario') return 'no hay recetas';
  if (c.porque === 'presupuesto') return 'no cabe';
  if (c.porque === 'proteina') return 'no llega';
  return '';
}

export default SelectorVariedad;
