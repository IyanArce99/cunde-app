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
      <h2 className="cierre__titulo">
        ¿Qué ha marcado
        <br />
        el ticket?
      </h2>
      <div className="cierre__caja">
        {/* El placeholder desaparece al escribir y no es un nombre accesible:
            para un lector de pantalla este campo era "editar texto, 0,00" y
            nada más. El rótulo va explícito y dice la unidad, que el "0,00"
            solo insinúa. */}
        <input
          className="cierre__input"
          type="text"
          inputMode="decimal"
          placeholder="0,00"
          aria-label="Lo que ha marcado el ticket, en euros"
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

      {/* Decía "Ajusto los precios de tu Mercadona con esto": explicaba lo que
          gana la app, no lo que gana quien está tecleando en la cola del súper.
          Y se callaba lo único que hace volver — que esto no se pierde, que va
          sumando semana a semana. */}
      <p className="cierre__nota">Afino los precios de tu tienda y te llevo la cuenta semana a semana.</p>
      <PrimaryButton disabled={!hayValor} onClick={() => hayValor && onGuardar(pagado)}>
        Guardar esta semana
      </PrimaryButton>
      <div className="cierre__salida">
        <a className="salida-texto" href="#!" onClick={(e) => { e.preventDefault(); onCerrar(); }}>
          Ahora no
        </a>
      </div>
    </BottomSheet>
  );
};

export default CierreDeSemana;
