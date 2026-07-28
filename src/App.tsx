import { Redirect, Route } from 'react-router-dom';
import { IonApp, IonRouterOutlet, setupIonicReact } from '@ionic/react';
import { IonReactRouter } from '@ionic/react-router';
import { AppStateProvider, useAppState } from './state/AppStateContext';
import Portada from './pages/onboarding/Portada';
import Datos from './pages/onboarding/Datos';
import Presupuesto from './pages/onboarding/Presupuesto';
import Generando from './pages/onboarding/Generando';
import Semana from './pages/Semana';
import SemanaVariante from './pages/SemanaVariante';
import Compra from './pages/Compra';

/* Core CSS required for Ionic components to work properly */
import '@ionic/react/css/core.css';

/* Basic CSS for apps built with Ionic */
import '@ionic/react/css/normalize.css';
import '@ionic/react/css/structure.css';
import '@ionic/react/css/typography.css';

/* Optional CSS utils that can be commented out */
import '@ionic/react/css/padding.css';
import '@ionic/react/css/float-elements.css';
import '@ionic/react/css/text-alignment.css';
import '@ionic/react/css/text-transformation.css';
import '@ionic/react/css/flex-utils.css';
import '@ionic/react/css/display.css';

/**
 * Ionic Dark Mode
 * -----------------------------------------------------
 * For more info, please see:
 * https://ionicframework.com/docs/theming/dark-mode
 */

/* import '@ionic/react/css/palettes/dark.always.css'; */
/* import '@ionic/react/css/palettes/dark.class.css'; */
import '@ionic/react/css/palettes/dark.system.css';

/* Theme variables */
import './theme/variables.css';
import './theme/tokens.css';

setupIonicReact();

const Enrutador: React.FC = () => {
  const { estado } = useAppState();

  return (
    <IonRouterOutlet>
      <Route exact path="/onboarding/portada">
        <Portada />
      </Route>
      <Route exact path="/onboarding/datos">
        <Datos />
      </Route>
      <Route exact path="/onboarding/presupuesto">
        <Presupuesto />
      </Route>
      <Route exact path="/onboarding/generando">
        <Generando />
      </Route>
      <Route exact path="/semana">
        <Semana />
      </Route>
      <Route exact path="/semana/variante">
        <SemanaVariante />
      </Route>
      <Route exact path="/compra">
        <Compra />
      </Route>
      <Route exact path="/">
        <Redirect to={estado.onboardingCompletado ? '/semana' : '/onboarding/portada'} />
      </Route>
    </IonRouterOutlet>
  );
};

const App: React.FC = () => (
  <IonApp>
    <AppStateProvider>
      <IonReactRouter>
        <Enrutador />
      </IonReactRouter>
    </AppStateProvider>
  </IonApp>
);

export default App;
