import { useState } from 'react';
import BottomSheet from './BottomSheet';
import PrimaryButton from './PrimaryButton';
import { diaConFecha, fechaParaLeer } from '../lib/format';
import { esFechaDia, hoy, proximoLunes, sumarDias } from '../lib/fechas';
import type { FechaDia } from '../lib/fechas';
import './HojaInicioSemana.css';
import './AjustesSemana.css';

interface HojaInicioSemanaProps {
  valor: FechaDia;
  onElegir: (fecha: FechaDia, origen: 'hoy' | 'manana' | 'lunes' | 'elegida') => void;
  onCerrar: () => void;
}

/**
 * ═══ EMPEZAR LA SEMANA ═══
 *
 * Tres atajos y una fecha libre. Nada de calendario mensual: el 95% de las
 * veces la respuesta es hoy, mañana o el lunes que viene, y montar una rejilla
 * de 30 casillas para eso es hacerle buscar al usuario lo que ya sabe.
 *
 * ═══ CADA ATAJO ENSEÑA SU FECHA ═══
 *
 * «Hoy» solo no basta: hay que poder comprobar de un vistazo que hoy es viernes
 * 7 antes de tocar. Sin la fecha debajo, elegir «Próximo lunes» es elegir a
 * ciegas — y esto decide qué siete días te va a planificar la app.
 *
 * ═══ Y LA FECHA LIBRE ES UN `input type="date"` ═══
 *
 * El del sistema, no uno propio. En móvil abre la rueda nativa que el usuario
 * ya sabe usar, viene con teclado y lector de pantalla resueltos, y respeta el
 * idioma y el formato de su dispositivo. Un calendario nuestro sería trabajo
 * para empeorar las tres cosas.
 *
 * Su `value` es `YYYY-MM-DD`, que es justo el formato en que guardamos las
 * fechas, así que no hay conversión que pueda desplazar un día. Ver
 * lib/fechas.ts para por qué eso importa tanto aquí.
 */
const HojaInicioSemana: React.FC<HojaInicioSemanaProps> = ({ valor, onElegir, onCerrar }) => {
  const ahora = hoy();
  const [libre, setLibre] = useState<FechaDia>(valor);

  const atajos: { clave: 'hoy' | 'manana' | 'lunes'; label: string; fecha: FechaDia }[] = [
    { clave: 'hoy', label: 'Hoy', fecha: ahora },
    { clave: 'manana', label: 'Mañana', fecha: sumarDias(ahora, 1) },
    { clave: 'lunes', label: 'Próximo lunes', fecha: proximoLunes(ahora) },
  ];

  return (
    <BottomSheet onDismiss={onCerrar}>
      <div className="ajustes__cabecera">
        <span className="ajustes__titulo">EMPEZAR LA SEMANA</span>
        <button type="button" className="ajustes__cerrar" aria-label="Cerrar" onClick={onCerrar}>
          ✕
        </button>
      </div>

      <div className="inicio__opciones">
        {atajos.map((o) => (
          <button
            key={o.clave}
            type="button"
            className={`inicio__opcion${valor === o.fecha ? ' inicio__opcion--elegida' : ''}`}
            aria-pressed={valor === o.fecha}
            /* En pantalla «Hoy / VIE · 7 AGO»; leído, «Hoy, viernes 7 de agosto
               de 2026». Es la misma información dicha para el medio en que se
               recibe: «vie punto siete ago» no significa nada en voz alta. */
            aria-label={`${o.label}, ${fechaParaLeer(o.fecha)}`}
            onClick={() => onElegir(o.fecha, o.clave)}
          >
            <span className="inicio__opcion-que" aria-hidden="true">{o.label}</span>
            <span className="inicio__opcion-cuando" aria-hidden="true">{diaConFecha(o.fecha)}</span>
          </button>
        ))}
      </div>

      <label className="inicio__libre">
        <span className="inicio__libre-rotulo">Otro día</span>
        <input
          className="inicio__libre-campo"
          type="date"
          value={libre}
          aria-label="Elegir otra fecha de inicio"
          onChange={(e) => { if (esFechaDia(e.target.value)) setLibre(e.target.value); }}
        />
      </label>

      {/* El botón solo se enciende si la fecha libre es distinta de la puesta:
          si no, es un botón que promete un cambio que no va a pasar. */}
      <PrimaryButton disabled={libre === valor} onClick={() => onElegir(libre, 'elegida')}>
        Empezar el {diaConFecha(libre)}
      </PrimaryButton>

      <p className="inicio__nota">
        Cambia los días, no los platos: tu semana sigue siendo la misma y tu lista también.
      </p>
    </BottomSheet>
  );
};

export default HojaInicioSemana;
