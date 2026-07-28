import { IonContent, IonPage } from '@ionic/react';
import { useHistory } from 'react-router-dom';
import PrimaryButton from '../../components/PrimaryButton';
import './Portada.css';

const Portada: React.FC = () => {
  const history = useHistory();

  return (
    <IonPage>
      <IonContent fullscreen scrollY={false} className="pantalla-content">
        <div className="pantalla pantalla--onboarding portada">
          <div className="portada__cabecera">
            <span className="portada__marca">CUNDE</span>
          </div>
          <div className="portada__titular-envoltorio">
            <h1 className="portada__titular">
              Dime tu presupuesto.
              <br />
              Te digo qué coméis
              <br />
              esta semana y
              <br />
              cuánto cuesta.
            </h1>
          </div>
          <div className="portada__acciones">
            <PrimaryButton onClick={() => history.push('/onboarding/datos')}>Empezar</PrimaryButton>
            <span className="portada__nota">Sin registro. Sin tarjeta.</span>
          </div>
        </div>
      </IonContent>
    </IonPage>
  );
};

export default Portada;
