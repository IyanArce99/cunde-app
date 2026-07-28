import { useCallback, useState } from 'react';
import { IonContent, IonPage } from '@ionic/react';
import { useHistory } from 'react-router-dom';
import { useAppState } from '../state/AppStateContext';
import { pasillosOrdenados, subtotalPasillo, totalLista, totalLlevas, totalPrevisto } from '../lib/derive';
import { eur } from '../lib/format';
import { useContador } from '../hooks/useContador';
import { useEnLinea } from '../hooks/useEnLinea';
import TopTabs from '../components/TopTabs';
import TicketRow from '../components/TicketRow';
import ShoppingRow from '../components/ShoppingRow';
import PrimaryButton from '../components/PrimaryButton';
import CierreDeSemana from '../components/CierreDeSemana';
import './Compra.css';

const Compra: React.FC = () => {
  const history = useHistory();
  const { estado, dispatch } = useAppState();
  const { lista, perfil, semana } = estado;
  const enLinea = useEnLinea();
  const [mostrarCierre, setMostrarCierre] = useState(false);

  const onToggle = useCallback((id: string) => dispatch({ type: 'TOGGLE_ITEM', id }), [dispatch]);

  const pasillos = pasillosOrdenados(lista);
  const total = totalLista(lista);
  const llevas = totalLlevas(lista);
  const restan = total - llevas;
  const pct = total === 0 ? 0 : (llevas / total) * 100;
  const cifraLlevasRef = useContador(llevas, { formatear: (n) => eur(n) });

  const previsto = totalPrevisto(semana.platos, perfil.comensales);

  return (
    <IonPage>
      <IonContent fullscreen scrollY={false} className="pantalla-content">
        <div className="pantalla compra">
          <TopTabs activo="compra" />

          {!enLinea && (
            <div className="compra__offline">
              <TicketRow label="Sin conexión" value="tus marcas se guardan" size={13} color="var(--gris)" />
            </div>
          )}

          <div className="compra__lista-envoltorio">
            <div className="compra__lista">
              {pasillos.map((pasillo) => (
                <div key={pasillo}>
                  <div className="compra__pasillo-cabecera">
                    <span className="compra__pasillo-nombre">{pasillo}</span>
                    <span className="compra__pasillo-linea" />
                    <span className="compra__pasillo-subtotal">{eur(subtotalPasillo(lista, pasillo))}</span>
                  </div>
                  {lista
                    .filter((item) => item.pasillo === pasillo)
                    .map((item) => (
                      <ShoppingRow key={item.id} item={item} onToggle={onToggle} />
                    ))}
                </div>
              ))}
            </div>
          </div>

          <div className="compra__pie">
            <div className="compra__pie-cabecera">
              <div>
                <span className="compra__pie-etiqueta">LLEVAS</span>
                <div className="compra__pie-cifra">
                  <span ref={cifraLlevasRef} />
                </div>
              </div>
              <span className="compra__pie-restan">
                restan
                <br />
                {eur(restan)}
              </span>
            </div>
            <div className="compra__pie-barra">
              <div className="compra__pie-barra-relleno" style={{ width: `${pct}%` }} />
            </div>
            <PrimaryButton onClick={() => setMostrarCierre(true)}>Cerrar la compra</PrimaryButton>
          </div>
        </div>

        {mostrarCierre && (
          <CierreDeSemana
            previsto={previsto}
            presupuesto={perfil.presupuestoSemanal}
            onGuardar={(importeReal) => {
              dispatch({ type: 'GUARDAR_CIERRE', importeRealTicket: importeReal });
              setMostrarCierre(false);
              history.push('/semana');
            }}
            onCerrar={() => setMostrarCierre(false)}
          />
        )}
      </IonContent>
    </IonPage>
  );
};

export default Compra;
