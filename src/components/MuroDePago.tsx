import { useState } from 'react';
import type { Suscripcion } from '../state/types';
import { eur } from '../lib/format';
import TicketRow from './TicketRow';
import PrimaryButton from './PrimaryButton';
import BottomSheet from './BottomSheet';
import './MuroDePago.css';

interface MuroDePagoProps {
  presupuesto: number;
  pagaste: number;
  onElegirPlan: (plan: Suscripcion) => void;
  onSeguirGratis: () => void;
}

const MuroDePago: React.FC<MuroDePagoProps> = ({ presupuesto, pagaste, onElegirPlan, onSeguirGratis }) => {
  const [plan, setPlan] = useState<Suscripcion>(null);
  const diferencia = presupuesto - pagaste;
  const dentro = diferencia >= 0;

  const ctaLabel = plan
    ? `Empezar · ${plan === 'mes' ? '4,99 € al mes' : '34,99 € al año'}`
    : 'Elige un plan';

  return (
    <BottomSheet>
      <span className="muro__etiqueta">LA SEMANA PASADA</span>
      <div className="muro__cuentas">
        <TicketRow label="Presupuesto" value={eur(presupuesto)} size={15} />
        <TicketRow label="Pagaste" value={eur(pagaste)} size={15} />
        <div className="muro__resalte">
          <TicketRow
            label={dentro ? 'Te quedaste dentro' : 'Te pasaste'}
            value={eur(Math.abs(diferencia))}
            size={15}
          />
        </div>
      </div>
      <p className="muro__cuerpo">
        La semana 2 y las siguientes, con precios actualizados y ajustes sin límite, van en el plan de pago.
      </p>
      <div className="muro__planes">
        <button
          className={`muro__plan${plan === 'mes' ? ' muro__plan--seleccionado' : ''}`}
          onClick={() => setPlan('mes')}
          type="button"
        >
          <span className="muro__plan-precio">4,99 €</span>
          <span className="muro__plan-periodo">al mes</span>
        </button>
        <button
          className={`muro__plan${plan === 'año' ? ' muro__plan--seleccionado' : ''}`}
          onClick={() => setPlan('año')}
          type="button"
        >
          <span className="muro__plan-precio">34,99 €</span>
          <span className="muro__plan-periodo">al año</span>
        </button>
      </div>
      <PrimaryButton disabled={!plan} onClick={() => plan && onElegirPlan(plan)}>
        {ctaLabel}
      </PrimaryButton>
      <div className="muro__salida">
        <a href="#!" onClick={(e) => { e.preventDefault(); onSeguirGratis(); }}>
          Seguir con el plan gratis
        </a>
      </div>
      <p className="muro__legal">Se cobra hoy. Cancelas cuando quieras.</p>
    </BottomSheet>
  );
};

export default MuroDePago;
