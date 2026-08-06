import type { CosteOpcion } from '../motor/seleccionar.ts';
import { eur } from '../lib/format';
import './SelectorCoste.css';

export interface OpcionCoste<T extends string> {
  valor: T;
  label: string;
  /** Una línea, sin adjetivos: qué obtienes. */
  nota: string;
}

interface SelectorCosteProps<T extends string> {
  opciones: OpcionCoste<T>[];
  /**
   * `null` mientras el motor calcula. Las opciones siguen siendo elegibles:
   * el precio informa la decisión pero no hace falta para tomarla, y bloquear
   * los tres botones durante un segundo por un dato que aún no está sería
   * castigar al usuario por la lentitud del motor.
   */
  costes: Record<T, CosteOpcion> | null;
  valor: T;
  onCambiar: (v: T) => void;
  /**
   * Qué se enseña bajo la etiqueta. En variedad el precio ES el intercambio;
   * en proteína no —el intercambio es proteína contra desperdicio— y poner el
   * precio de protagonista hacía leer los tres niveles como una escalera de
   * precio que no son.
   */
  ejes?: (coste: CosteOpcion) => { principal: string; secundario: string };
}

/**
 * Las dos palancas del producto se eligen igual: con las consecuencias
 * delante en el momento de decidir, no después de generar. Lo que cambia es
 * QUÉ consecuencia manda en cada una.
 *
 * Un nivel que no se puede montar sale marcado AQUÍ, no falla al elegirlo.
 * Dejar que se elija para luego enseñar un error es el muro por la puerta de
 * atrás.
 */
function SelectorCoste<T extends string>({
  opciones, costes, valor, onCambiar, ejes,
}: Readonly<SelectorCosteProps<T>>) {
  const posibles = costes
    ? opciones.map((o) => costes[o.valor]).filter((c) => c.disponible && Number.isFinite(c.carrito))
    : [];
  const masBarata = posibles.length ? Math.min(...posibles.map((c) => c.carrito)) : Number.NaN;

  return (
    <div className="selcoste" aria-busy={costes === null}>
      {opciones.map((o) => {
        const coste = costes?.[o.valor] ?? null;
        const seleccionado = valor === o.valor;
        const clases = ['selcoste__opcion'];
        if (seleccionado) clases.push('selcoste__opcion--seleccionado');
        if (coste && !coste.disponible) clases.push('selcoste__opcion--fuera');

        const fuera = coste ? motivo(coste) : null;
        let lineas: { principal: string; secundario: string };
        if (!coste) lineas = { principal: '···', secundario: 'calculando' };
        else if (ejes && !fuera) lineas = ejes(coste);
        else lineas = { principal: precioDe(coste), secundario: fuera ?? extraDe(coste, masBarata) };

        return (
          <button
            key={o.valor}
            type="button"
            className={clases.join(' ')}
            onClick={() => onCambiar(o.valor)}
            aria-pressed={seleccionado}
            disabled={!!coste && !coste.disponible}
          >
            <span className="selcoste__label">{o.label}</span>
            <span className="selcoste__nota">{o.nota}</span>
            <span className="selcoste__principal">{lineas.principal}</span>
            <span className="selcoste__extra">{lineas.secundario}</span>
          </button>
        );
      })}
    </div>
  );
}

const precioDe = (c: CosteOpcion) =>
  (c.disponible && Number.isFinite(c.carrito) ? eur(c.carrito) : '—');

/** Por qué no se puede. En una palabra, o null si sí se puede. */
function motivo(coste: CosteOpcion): string | null {
  if (coste.porque === 'recetario') return 'no hay recetas';
  if (coste.porque === 'presupuesto') return 'no cabe';
  if (coste.porque === 'proteina') return 'no llega';
  return null;
}

function extraDe(coste: CosteOpcion, masBarata: number): string {
  const extra = coste.carrito - masBarata;
  return extra < 0.005 ? 'lo más barato' : `+${eur(extra)}`;
}

export default SelectorCoste;
