import { IonContent, IonPage } from '@ionic/react';
import { useHistory } from 'react-router-dom';
import type { Comensales } from '../../state/types';
import { useAppState } from '../../state/AppStateContext';
import OptionButton from '../../components/OptionButton';
import PrimaryButton from '../../components/PrimaryButton';
import './Datos.css';

const OPCIONES_COMENSALES: Comensales[] = ['1', '2', '3', '4', '5+'];
const OPCIONES_SUPER = ['Mercadona', 'Lidl', 'Carrefour', 'Dia', 'Alcampo', 'Consum'];

const Datos: React.FC = () => {
  const history = useHistory();
  const { estado, dispatch } = useAppState();

  return (
    <IonPage>
      <IonContent fullscreen scrollY={false} className="pantalla-content">
        <div className="pantalla pantalla--onboarding datos">
          <div className="datos__cabecera">
            <span className="datos__marca">CUNDE</span>
            <span className="datos__paso">1/2</span>
          </div>

          <div className="datos__cuerpo">
            <h2 className="datos__pregunta">¿Cuántos sois?</h2>
            <div className="datos__grid-comensales">
              {OPCIONES_COMENSALES.map((opcion) => (
                <OptionButton
                  key={opcion}
                  label={opcion}
                  variante="grid"
                  seleccionado={estado.perfil.comensales === opcion}
                  onClick={() => dispatch({ type: 'SET_COMENSALES', comensales: opcion })}
                />
              ))}
            </div>

            <h2 className="datos__pregunta datos__pregunta--super">¿Dónde compras?</h2>
            <div className="datos__fila-super">
              {OPCIONES_SUPER.map((opcion) => (
                <OptionButton
                  key={opcion}
                  label={opcion}
                  variante="pill"
                  seleccionado={estado.perfil.super === opcion}
                  onClick={() => dispatch({ type: 'SET_SUPER', super: opcion })}
                />
              ))}
            </div>

            <p className="datos__nota">
              Lo que no comes, el tiempo que tienes y si
              <br />
              quieres comidas o cenas: te lo pregunto
              <br />
              sobre el menú, cuando ya lo tengas delante.
            </p>
          </div>

          <PrimaryButton onClick={() => history.push('/onboarding/presupuesto')}>Seguir</PrimaryButton>
        </div>
      </IonContent>
    </IonPage>
  );
};

export default Datos;
