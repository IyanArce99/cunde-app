import { useState } from 'react';
import { eur, eurConSigno } from '../lib/format';
import TicketRow from './TicketRow';
import PrimaryButton from './PrimaryButton';
import BottomSheet from './BottomSheet';
import './CierreDeSemana.css';

interface CierreDeSemanaProps {
  previsto: number;
  presupuesto: number;
  onGuardar: (importeReal: number) => void;
  onCerrar: () => void;
}

const CierreDeSemana: React.FC<CierreDeSemanaProps> = ({ previsto, presupuesto, onGuardar, onCerrar }) => {
  const [texto, setTexto] = useState('');
  const pagado = parseFloat(texto.replace(',', '.'));
  const hayValor = texto.trim() !== '' && !Number.isNaN(pagado);
  const diferencia = hayValor ? pagado - previsto : 0;
  const dentroPresupuesto = hayValor ? pagado <= presupuesto : true;

  return (
    <BottomSheet onDismiss={onCerrar}>
      <span className="cierre__etiqueta">CIERRE DE LA SEMANA</span>
      <h2 className="cierre__titulo">
        ¿Qué ha marcado
        <br />
        el ticket?
      </h2>
      <div className="cierre__caja">
        <input
          className="cierre__input"
          type="text"
          inputMode="decimal"
          placeholder="0,00"
          value={texto}
          onChange={(e) => setTexto(e.target.value.replace(/[^0-9,]/g, ''))}
          autoFocus
        />
        <span className="cierre__moneda">€</span>
      </div>

      {hayValor && (
        <div className="cierre__cuentas">
          <TicketRow label="Previsto" value={eur(previsto)} size={15} />
          <TicketRow label="Pagado" value={eur(pagado)} size={15} />
          <div className="cierre__diferencia">
            <TicketRow
              label="Diferencia"
              value={eurConSigno(diferencia)}
              size={15}
              color={Math.abs(diferencia) < 0.005 ? 'var(--azulete)' : 'var(--roja)'}
            />
          </div>
          <TicketRow
            label={`Sobre ${eur(presupuesto)}`}
            value={dentroPresupuesto ? 'dentro' : 'fuera'}
            size={15}
            color="var(--azulete)"
          />
        </div>
      )}

      <p className="cierre__nota">Ajusto los precios de tu Mercadona con esto.</p>
      <PrimaryButton disabled={!hayValor} onClick={() => hayValor && onGuardar(pagado)}>
        Guardar esta semana
      </PrimaryButton>
      <div className="cierre__salida">
        <a href="#!" onClick={(e) => { e.preventDefault(); onCerrar(); }}>
          Ahora no
        </a>
      </div>
    </BottomSheet>
  );
};

export default CierreDeSemana;
