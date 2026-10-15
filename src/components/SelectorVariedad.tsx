import type { Variedad } from '../state/types';
import type { Contexto } from '../lib/derive';
import type { CosteOpcion } from '../motor/seleccionar.ts';
import { eur } from '../lib/format';
import './SelectorVariedad.css';

/** De más a menos variedad: así se lee la fila. */
const ORDEN: Variedad[] = ['mucha', 'normal', 'poca'];

export const NOMBRE_VARIEDAD: Record<Variedad, string> = { mucha: 'Alta', normal: 'Normal', poca: 'Baja' };

/**
 * ═══ LOS TRES NIVELES, SIEMPRE A LA VISTA, CON LO QUE TRAE CADA SEMANA ═══
 *
 * Hasta el 15 oct 2026 este selector enseñaba solo dos semanas —la más barata
 * de las que repiten plato y la más barata de las que no— y desaparecía entero
 * cuando no había dos grupos. La hoja dejaba el rótulo «Variedad» sin nada
 * debajo: en el teléfono no había forma de elegirla. Se vio en la beta.
 *
 * Ahora van los tres niveles, por su nombre y en orden fijo. El nombre dice lo
 * que el motor GARANTIZA (src/motor/seleccionar.ts), no lo que cuesta:
 *
 *   Alta    hasta 12 recetas, ninguna se cocina dos veces, sobras ≤ 15 %
 *   Normal  hasta 9, cada una como mucho dos veces, sobras ≤ 30 %
 *   Baja    hasta 5, hasta tres veces, sin tope de sobras
 *
 * Lo que NO garantiza el nombre es el precio: los niveles no son conjuntos
 * anidados y «alta» puede salir más barata que «baja» (medido, 12 de 15
 * combinaciones; ver el historial de este fichero). Por eso cada botón lleva
 * su precio y sus cifras, que salen de la semana que el motor monta de verdad:
 * platos distintos, comidas de sobras y platos que se cocinan otra vez.
 *
 * «Nunca repites plato» se fue: en la semana de variedad alta no se cocina
 * nada dos veces, pero sí puede haber comidas de sobras —lo del lunes, el
 * martes— y eso, para quien lo come, es repetir. Se dicen las dos cosas.
 */
const SelectorVariedad: React.FC<{
  ctx: Contexto;
  costes: Record<Variedad, CosteOpcion> | null;
  onCambiar: (v: Variedad) => void;
}> = ({ ctx, costes, onCambiar }) => {
  const alta = costes?.mucha ?? null;

  return (
    <>
      <div className="semanas" aria-busy={costes === null}>
        {ORDEN.map((v) => {
          const c = costes?.[v] ?? null;
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
              <span className="semanas__nombre">{NOMBRE_VARIEDAD[v]}</span>
              <span className="semanas__precio">
                {c && Number.isFinite(c.carrito) ? eur(c.carrito) : '···'}
              </span>
              {queTrae(c).map((linea) => (
                <span key={linea} className="semanas__dato">{linea}</span>
              ))}
              {fuera && <span className="semanas__fuera">{motivo(c)}</span>}
            </button>
          );
        })}
      </div>
      {/* Si la alta no se puede dar, se dice por qué con la cifra que la
          desbloquea, en vez de dejar un botón apagado sin más. */}
      {alta && !alta.disponible && <p className="semanas__nota">{porQueNoAlta(alta, ctx.presupuesto)}</p>}
    </>
  );
};

/** Lo que trae esa semana, en cifras. Una idea por línea. */
export function queTrae(c: CosteOpcion | null): string[] {
  if (!c) return ['calculando'];
  if (!Number.isFinite(c.carrito)) return [];
  const lineas = [`${c.platos} ${c.platos === 1 ? 'plato' : 'platos'}`];
  lineas.push(c.repeticiones === 0 ? 'sin sobras' : `${c.repeticiones} de sobras`);
  if (c.platosRepetidos > 0) lineas.push(`cocinas ${c.platosRepetidos} otra vez`);
  return lineas;
}

/** Por qué no se puede elegir. En una línea, sin culpar al usuario. */
function motivo(c: CosteOpcion | null): string {
  if (!c) return '';
  if (c.porque === 'recetario') return 'no hay recetas';
  if (c.porque === 'presupuesto') return 'no cabe';
  if (c.porque === 'proteina') return 'no llega';
  return '';
}

/** La frase de debajo cuando la variedad alta no sale. */
export function porQueNoAlta(c: CosteOpcion, tope: number): string {
  if (c.porque === 'presupuesto' && Number.isFinite(c.carrito)) {
    return `La variedad alta sale por ${eur(c.carrito)} y tu tope es ${eur(tope)}.`;
  }
  if (c.porque === 'proteina') return 'Con la variedad alta no llego a la proteína que pides.';
  return 'Con tus filtros no me salen recetas para la variedad alta.';
}

export default SelectorVariedad;
