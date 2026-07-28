import { IonContent, IonPage } from '@ionic/react';
import { useHistory } from 'react-router-dom';
import { useAppState } from '../state/AppStateContext';
import { costePersonaDia, totalPrevisto } from '../lib/derive';
import { eur } from '../lib/format';
import TopTabs from '../components/TopTabs';
import TicketRow from '../components/TicketRow';
import PrimaryButton from '../components/PrimaryButton';
import './SemanaVariante.css';

/**
 * 2a del fichero de diseño: hipótesis alternativa a 1c (no es la decisión final),
 * expuesta aquí como ruta de referencia para comparar ambas variantes.
 */
const SemanaVariante: React.FC = () => {
  const history = useHistory();
  const { estado } = useAppState();
  const { perfil, semana } = estado;
  const total = totalPrevisto(semana.platos, perfil.comensales);
  const sobra = perfil.presupuestoSemanal - total;
  const porDia = costePersonaDia(total, perfil.comensales);

  return (
    <IonPage>
      <IonContent fullscreen scrollY={false} className="pantalla-content">
        <div className="pantalla semana-variante">
          <TopTabs activo="semana" />

          <div className="semana-variante__resumen">
            <span className="semana-variante__etiqueta">TE SALE A</span>
            <div className="semana-variante__cifra-fila">
              <span className="semana-variante__cifra">{eur(porDia)}</span>
              <span className="semana-variante__cifra-nota">
                por persona
                <br />
                y día
              </span>
            </div>
            <div className="semana-variante__cuentas">
              <TicketRow label={`Semana · ${perfil.comensales === '1' ? '1 persona' : perfil.comensales + ' personas'}`} value={eur(total)} size={15} />
              <TicketRow
                label={`De ${eur(perfil.presupuestoSemanal)}, te sobran`}
                value={eur(sobra)}
                size={15}
                color="var(--azulete)"
              />
            </div>
          </div>

          <div className="semana-variante__dias-envoltorio">
            <div className="semana-variante__dias">
              {semana.platos.map((plato) => (
                <TicketRow
                  key={plato.dia}
                  label={
                    <>
                      <span className="semana-variante__dia">{plato.dia}</span> {plato.nombre}
                    </>
                  }
                  value={eur(plato.precioRacion * (perfil.comensales === '5+' ? 5 : parseInt(perfil.comensales, 10)))}
                  size={15}
                />
              ))}
            </div>
          </div>

          <div className="semana-variante__pie">
            <PrimaryButton onClick={() => history.push('/compra')}>Ver la lista</PrimaryButton>
            <button className="semana-variante__refrescar" type="button" aria-label="Rehacer la semana">
              ↻
            </button>
          </div>
        </div>
      </IonContent>
    </IonPage>
  );
};

export default SemanaVariante;
