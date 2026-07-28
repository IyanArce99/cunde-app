import { useEffect } from 'react';
import { IonContent, IonPage } from '@ionic/react';
import { useHistory } from 'react-router-dom';
import { useAppState } from '../../state/AppStateContext';
import TicketRow from '../../components/TicketRow';
import './Generando.css';

const Generando: React.FC = () => {
  const history = useHistory();
  const { estado, dispatch } = useAppState();
  const { comensales, super: superElegido, presupuestoSemanal } = estado.perfil;

  useEffect(() => {
    const temporizador = setTimeout(() => {
      dispatch({ type: 'COMPLETAR_ONBOARDING' });
      history.replace('/semana');
    }, 2200);
    return () => clearTimeout(temporizador);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <IonPage>
      <IonContent fullscreen scrollY={false} className="pantalla-content">
        <div className="pantalla pantalla--onboarding generando">
          <div className="generando__cabecera">
            <span className="generando__marca">CUNDE</span>
            <TicketRow label="Comensales" value={comensales} />
            <TicketRow label="Súper" value={superElegido} />
            <TicketRow label="Presupuesto" value={`${presupuestoSemanal} €`} />
          </div>

          <div className="generando__centro">
            <p className="generando__mensaje">
              Encadenando ingredientes para que no sobre nada<span className="generando__cursor" />
            </p>
            <div className="generando__barra">
              <div className="generando__barra-relleno" />
            </div>
            <span className="generando__resumen">7 días · 14 platos · {presupuestoSemanal} €</span>
          </div>
        </div>
      </IonContent>
    </IonPage>
  );
};

export default Generando;
