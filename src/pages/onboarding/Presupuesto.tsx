import { IonContent, IonPage } from '@ionic/react';
import { useHistory } from 'react-router-dom';
import { useAppState } from '../../state/AppStateContext';
import { numComensales, etiquetaComensales } from '../../state/types';
import { costePorPlato, presupuestoMinimoViable } from '../../lib/derive';
import { eur } from '../../lib/format';
import TicketRow from '../../components/TicketRow';
import BudgetSlider from '../../components/BudgetSlider';
import PrimaryButton from '../../components/PrimaryButton';
import './Presupuesto.css';

const Presupuesto: React.FC = () => {
  const history = useHistory();
  const { estado, dispatch } = useAppState();
  const { comensales, super: superElegido, presupuestoSemanal } = estado.perfil;
  const n = numComensales(comensales);
  const minimoViable = presupuestoMinimoViable(comensales);
  const noCuadra = presupuestoSemanal < minimoViable;

  return (
    <IonPage>
      <IonContent fullscreen scrollY={false} className="pantalla-content">
        <div className="pantalla pantalla--onboarding presupuesto">
          <div className="presupuesto__cabecera">
            <div className="presupuesto__cabecera-fila">
              <span className="presupuesto__marca">CUNDE</span>
              <span className="presupuesto__paso">2/2</span>
            </div>
            <TicketRow label="Comensales" value={comensales} />
            <TicketRow label="Súper" value={superElegido} />
          </div>

          <div className="presupuesto__cuerpo">
            <h2 className="presupuesto__pregunta">
              ¿Cuánto quieres gastar
              <br />
              a la semana?
            </h2>
            <div className="presupuesto__centro">
              <div className="presupuesto__cifra">{presupuestoSemanal} €</div>
              <div className="presupuesto__por-dia">{eur(presupuestoSemanal / 7 / n, 2)} por persona y día</div>

              <div className="presupuesto__slider">
                <BudgetSlider
                  value={presupuestoSemanal}
                  min={30}
                  max={200}
                  onChange={(v) => dispatch({ type: 'SET_PRESUPUESTO', presupuesto: v })}
                />
              </div>

              {noCuadra ? (
                <div className="presupuesto__aviso">
                  <p className="presupuesto__aviso-texto">
                    Con {presupuestoSemanal} € no me salen las cuentas para {etiquetaComensales(comensales)}. Con{' '}
                    {minimoViable} € sí.
                  </p>
                  <div className="presupuesto__aviso-acciones">
                    <button
                      type="button"
                      className="presupuesto__aviso-subir"
                      onClick={() => dispatch({ type: 'SET_PRESUPUESTO', presupuesto: minimoViable })}
                    >
                      Subir a {minimoViable} €
                    </button>
                    <button
                      type="button"
                      className="presupuesto__aviso-volver"
                      onClick={() => history.push('/onboarding/datos')}
                    >
                      o compra para menos personas
                    </button>
                  </div>
                </div>
              ) : (
                <div className="presupuesto__resumen">
                  <TicketRow
                    label={`14 platos · ${etiquetaComensales(comensales)}`}
                    value={`${eur(costePorPlato(presupuestoSemanal, comensales))}/plato`}
                    color="var(--gris)"
                  />
                </div>
              )}
            </div>
          </div>

          <PrimaryButton onClick={() => history.push('/onboarding/generando')}>Ver mi semana</PrimaryButton>
          <span className="presupuesto__nota">Sin registro. Sin tarjeta.</span>
        </div>
      </IonContent>
    </IonPage>
  );
};

export default Presupuesto;
