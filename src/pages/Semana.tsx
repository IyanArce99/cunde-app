import { useState } from 'react';
import { IonContent, IonPage } from '@ionic/react';
import { useHistory } from 'react-router-dom';
import { useAppState } from '../state/AppStateContext';
import { etiquetaComensales } from '../state/types';
import type { Plato } from '../state/types';
import { semanaEfectiva, totalPrevisto } from '../lib/derive';
import { eur } from '../lib/format';
import { otroPlatoParecido, platoMasBarato } from '../lib/menu';
import { useContador } from '../hooks/useContador';
import TopTabs from '../components/TopTabs';
import TicketRow from '../components/TicketRow';
import PrimaryButton from '../components/PrimaryButton';
import MuroDePago from '../components/MuroDePago';
import AjustesSemana from '../components/AjustesSemana';
import HojaDeDia from '../components/HojaDeDia';
import EsteDiaNoCocino from '../components/EsteDiaNoCocino';
import RecetaPlato from '../components/RecetaPlato';
import './Semana.css';

const Semana: React.FC = () => {
  const history = useHistory();
  const { estado, dispatch } = useAppState();
  const { perfil, preferencias, semana, cierre, suscripcion, contadores } = estado;
  const total = totalPrevisto(semana.platos, perfil.comensales);
  const sobra = perfil.presupuestoSemanal - total;
  const pctBarra = Math.min(100, (total / perfil.presupuestoSemanal) * 100);
  const cifraRef = useContador(total);
  const [mostrarAjustes, setMostrarAjustes] = useState<'exclusiones' | 'sobrante' | null>(null);
  const [diaAbierto, setDiaAbierto] = useState<Plato | null>(null);
  const [reorganizando, setReorganizando] = useState<Plato | null>(null);
  const [recetaAbierta, setRecetaAbierta] = useState<Plato | null>(null);

  const numeroSemana = semanaEfectiva(contadores.semanaNumero, semana.generadaEn);
  // Persistido en estado global, no en useState: si viviera en el componente,
  // navegar a Compra y volver reseteaba la decisión y el muro reaparecía en
  // cada visita dentro de la misma semana (en vez de una vez por semana).
  const yaVistoGratisEstaSemana = contadores.semanaVistaGratis === numeroSemana;
  const mostrarMuro = numeroSemana >= 2 && suscripcion === null && !yaVistoGratisEstaSemana;

  const pagasteSemanaAnterior = cierre.importeRealTicket ?? total;

  if (mostrarMuro) {
    return (
      <IonPage>
        <IonContent fullscreen scrollY={false} className="pantalla-content">
          <div className="pantalla semana">
            <TopTabs activo="semana" />
            <div className="semana__gate-cabecera">
              <span className="semana__etiqueta">SEMANA {numeroSemana}</span>
              <div className="semana__cifra">—</div>
            </div>
          </div>
          <MuroDePago
            presupuesto={perfil.presupuestoSemanal}
            pagaste={pagasteSemanaAnterior}
            onElegirPlan={(plan) => dispatch({ type: 'SET_SUSCRIPCION', plan })}
            onSeguirGratis={() => dispatch({ type: 'SEGUIR_GRATIS', numeroSemana })}
          />
        </IonContent>
      </IonPage>
    );
  }

  return (
    <IonPage>
      <IonContent fullscreen scrollY={false} className="pantalla-content">
        <div className="pantalla semana">
          <TopTabs activo="semana" />

          <div className="semana__resumen">
            <span className="semana__etiqueta">TU SEMANA</span>
            <div className="semana__cifra" style={{ color: sobra < 0 ? 'var(--roja)' : undefined }}>
              <span ref={cifraRef} />
            </div>
            <div className="semana__barra">
              <div
                className="semana__barra-relleno"
                style={{ width: `${pctBarra}%`, background: sobra < 0 ? 'var(--roja)' : 'var(--azulete)' }}
              />
            </div>
            <div className="semana__barra-pie">
              <span>presupuesto {eur(perfil.presupuestoSemanal)}</span>
              <span className="semana__barra-pie-secundario">7 días · {etiquetaComensales(perfil.comensales)}</span>
            </div>

            {sobra !== 0 && (
              <button
                className={`semana__sobrante${sobra < 0 ? ' semana__sobrante--negativo' : ''}`}
                type="button"
                onClick={() => setMostrarAjustes('sobrante')}
              >
                <span className="semana__sobrante-texto">
                  <span className="semana__sobrante-titulo">
                    {sobra > 0 ? 'Te sobran ' : 'Te pasas '}
                    <span style={{ color: sobra < 0 ? 'var(--roja)' : undefined }}>{eur(Math.abs(sobra))}</span>
                  </span>
                  <span className="semana__sobrante-subtitulo">
                    {sobra > 0 ? 'mejora un plato o guárdalos' : 'ajusta un plato para cuadrar'}
                  </span>
                </span>
                <span className="semana__sobrante-flecha">›</span>
              </button>
            )}

            <button className="semana__ajuste" type="button" onClick={() => setMostrarAjustes('exclusiones')}>
              <TicketRow label="Dime lo que no comes" value="ajustar ›" color="var(--azulete)" size={15} />
            </button>
          </div>

          <div className="semana__dias-envoltorio">
            <div className="semana__dias">
              {semana.platos.map((plato) => (
                <button className="semana__dia" type="button" key={plato.dia} onClick={() => setDiaAbierto(plato)}>
                  <div className="semana__dia-cabecera">
                    <span className="semana__dia-nombre">{plato.dia}</span>
                    <span className="semana__dia-meta">
                      {plato.minutos} min · {eur(plato.precioRacion)} ración
                      <span className="semana__dia-flecha">›</span>
                    </span>
                  </div>
                  <div className="semana__dia-plato">{plato.nombre}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="semana__pie">
            <PrimaryButton onClick={() => history.push('/compra')}>Ver la lista</PrimaryButton>
          </div>
        </div>

        {mostrarAjustes && (
          <AjustesSemana
            preferenciasActuales={preferencias}
            origen={mostrarAjustes}
            onGuardar={(nuevasPreferencias) => {
              dispatch({ type: 'SET_PREFERENCIAS', preferencias: nuevasPreferencias });
              setMostrarAjustes(null);
            }}
            onCerrar={() => setMostrarAjustes(null)}
          />
        )}

        {diaAbierto && (
          <HojaDeDia
            plato={diaAbierto}
            comensales={perfil.comensales}
            semanaActual={semana.platos}
            onCambiarPlato={() => {
              const nuevo = otroPlatoParecido(semana.platos, diaAbierto);
              if (nuevo) dispatch({ type: 'CAMBIAR_PLATO', dia: diaAbierto.dia, plato: nuevo });
              setDiaAbierto(null);
            }}
            onBajarPrecio={() => {
              const barato = platoMasBarato(semana.platos, diaAbierto);
              if (barato) dispatch({ type: 'CAMBIAR_PLATO', dia: diaAbierto.dia, plato: barato });
              setDiaAbierto(null);
            }}
            onNoCocino={() => {
              setReorganizando(diaAbierto);
              setDiaAbierto(null);
            }}
            onVerReceta={() => {
              setRecetaAbierta(diaAbierto);
              setDiaAbierto(null);
            }}
            onCerrar={() => setDiaAbierto(null)}
          />
        )}

        {recetaAbierta && (
          <RecetaPlato plato={recetaAbierta} comensales={perfil.comensales} onCerrar={() => setRecetaAbierta(null)} />
        )}

        {reorganizando && (
          <EsteDiaNoCocino
            diaLibre={reorganizando}
            semanaActual={semana.platos}
            comensales={perfil.comensales}
            onHecho={(diaDestino, nuevoPlato) => {
              dispatch({ type: 'REORGANIZAR_SEMANA', diaLibre: reorganizando.dia, diaDestino, nuevoPlato });
              setReorganizando(null);
            }}
            onDejarComoEsta={() => setReorganizando(null)}
          />
        )}
      </IonContent>
    </IonPage>
  );
};

export default Semana;
