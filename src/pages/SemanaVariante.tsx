import { IonContent, IonPage } from '@ionic/react';
import { useHistory } from 'react-router-dom';
import { useAppState } from '../state/AppStateContext';
import { numComensales, ranurasVisibles } from '../state/types';
import { costePersonaDia, totalLista } from '../lib/derive';
import { eur } from '../lib/format';
import { nombreRanura } from '../lib/menu';
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
  const { perfil, preferencias, semana, lista } = estado;
  // Carrito real, no consumo — mismo criterio que la pantalla 1c.
  const total = totalLista(lista);
  const sobra = perfil.presupuestoSemanal - total;
  const porDia = costePersonaDia(total, perfil.comensales);
  const n = numComensales(perfil.comensales);
  const ranuras = ranurasVisibles(preferencias.comidas);

  return (
    <IonPage>
      <IonContent fullscreen scrollY={false} className="pantalla-content">
        <div className="pantalla semana-variante">
          <TopTabs activo="semana" />

          <div className="semana-variante__resumen">
            {/* Antes esto era una frase partida en tres trozos con tres
                tipografías: "TE SALE A" en versalitas espaciadas, la cifra en
                display y "por persona / y día" en otra caja al lado. Ni era un
                rótulo ni era una frase. Ahora es lo que la app hace en todas
                las demás pantallas: rótulo de máquina encima, cifra debajo. */}
            <span className="semana-variante__etiqueta">POR PERSONA Y DÍA</span>
            <div className="semana-variante__cifra">{eur(porDia)}</div>
            <div className="semana-variante__cuentas">
              <TicketRow
                label={`Semana · ${perfil.comensales === '1' ? '1 persona' : perfil.comensales + ' personas'}`}
                value={eur(total)}
                size={15}
              />
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
              {semana.dias.flatMap((dia) =>
                ranuras
                  .filter(({ clave }) => dia[clave])
                  .map(({ clave }) => {
                    const plato = dia[clave]!;
                    return (
                      <TicketRow
                        key={`${dia.dia}-${clave}`}
                        label={
                          <>
                            <span className="semana-variante__dia">{dia.dia}</span>{' '}
                            {ranuras.length > 1 ? `${nombreRanura(clave)} · ` : ''}
                            {plato.nombre}
                          </>
                        }
                        value={plato.tipo === 'sobras' ? 'sobras' : eur(plato.precioRacion * n)}
                        size={15}
                      />
                    );
                  }),
              )}
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
