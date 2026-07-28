import { useRef } from 'react';
import './BudgetSlider.css';

interface BudgetSliderProps {
  value: number;
  min: number;
  max: number;
  onChange: (valor: number) => void;
}

const BudgetSlider: React.FC<BudgetSliderProps> = ({ value, min, max, onChange }) => {
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

  const pct = ((value - min) / (max - min)) * 100;

  return (
    <div>
      <div ref={trackRef} className="budget-slider" onPointerDown={alPulsar}>
        <div className="budget-slider__carril" />
        <div className="budget-slider__recorrido" style={{ width: `${pct}%` }} />
        <div className="budget-slider__pulgar" style={{ left: `calc(${pct}% - 14px)` }} />
      </div>
      <div className="budget-slider__extremos">
        <span>{min} €</span>
        <span>{max} €</span>
      </div>
    </div>
  );
};

export default BudgetSlider;
