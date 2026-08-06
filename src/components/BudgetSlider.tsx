import { useCallback, useRef } from 'react';
import './BudgetSlider.css';

interface BudgetSliderProps {
  value: number;
  min: number;
  max: number;
  onChange: (valor: number) => void;
  /** Lo que se lee en voz alta en vez del número pelado. */
  etiquetaValor?: (valor: number) => string;
}

/** Un euro por flecha, diez por página: mover 170 € de uno en uno no es usable. */
const PASO = 1;
const PASO_GRANDE = 10;

/**
 * Deslizador propio y no `input[type=range]` porque el nativo no se puede
 * pintar como el ticket sin pelearse con tres motores distintos.
 *
 * Lo que sí hay que traer del nativo es TODO lo demás, que faltaba: era un
 * `div` con pointerdown, así que con teclado no se podía tocar y para un
 * lector de pantalla no existía. En la pantalla donde se decide la única
 * cifra que importa, eso deja fuera a quien navega con teclado o con lector.
 */
const BudgetSlider: React.FC<BudgetSliderProps> = ({ value, min, max, onChange, etiquetaValor }) => {
  const trackRef = useRef<HTMLDivElement>(null);

  const fijarDesdeX = (x: number) => {
    const track = trackRef.current;
    if (!track) return;
    const rect = track.getBoundingClientRect();
    const p = Math.min(1, Math.max(0, (x - rect.left) / rect.width));
    onChange(Math.round(min + p * (max - min)));
  };

  const alPulsar = (e: React.PointerEvent) => {
    fijarDesdeX(e.clientX);
    const alMover = (ev: PointerEvent) => fijarDesdeX(ev.clientX);
    const alSoltar = () => {
      window.removeEventListener('pointermove', alMover);
      window.removeEventListener('pointerup', alSoltar);
    };
    window.addEventListener('pointermove', alMover);
    window.addEventListener('pointerup', alSoltar);
  };

  const alTeclear = useCallback((e: React.KeyboardEvent) => {
    const salto: Record<string, number> = {
      ArrowRight: PASO, ArrowUp: PASO, ArrowLeft: -PASO, ArrowDown: -PASO,
      PageUp: PASO_GRANDE, PageDown: -PASO_GRANDE,
    };
    let siguiente: number | null = null;
    if (e.key in salto) siguiente = value + salto[e.key];
    else if (e.key === 'Home') siguiente = min;
    else if (e.key === 'End') siguiente = max;
    if (siguiente === null) return;
    // Solo aquí: si se llamara siempre, la página dejaría de hacer scroll con
    // las flechas cuando el foco pasa por encima del deslizador.
    e.preventDefault();
    onChange(Math.min(max, Math.max(min, siguiente)));
  }, [value, min, max, onChange]);

  const pct = ((value - min) / (max - min)) * 100;

  return (
    <div>
      <div
        ref={trackRef}
        className="budget-slider"
        onPointerDown={alPulsar}
        onKeyDown={alTeclear}
        role="slider"
        tabIndex={0}
        aria-label="Presupuesto de la semana"
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={value}
        /* Sin esto se anuncia "65", que en esta pantalla podría ser cualquier
           cosa. La unidad se dice porque es el dato del producto entero. */
        aria-valuetext={etiquetaValor ? etiquetaValor(value) : `${value} euros`}
      >
        <div className="budget-slider__carril" />
        <div className="budget-slider__recorrido" style={{ width: `${pct}%` }} />
        <div className="budget-slider__pulgar" style={{ left: `calc(${pct}% - 14px)` }} />
      </div>
      <div className="budget-slider__extremos" aria-hidden="true">
        <span>{min} €</span>
        <span>{max} €</span>
      </div>
    </div>
  );
};

export default BudgetSlider;
