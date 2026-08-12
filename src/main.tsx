import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { sincronizarPrecios } from './lib/sincronizarPrecios';
import { analitica, registrarSumideroAnalitica } from './lib/analitica';
import { sumideroSupabase } from './lib/analitica-supabase';
import { arrancarCompras } from './lib/compras';

// Conmutador temporal de comparación de viñetas (?v=a | ?v=b). Se captura al
// arrancar porque la portada no monta ninguna viñeta y al llegar a la primera
// pantalla que sí la monta el parámetro ya se ha perdido en el push de ruta.
// Se va con la decisión.
{
  const v = new URLSearchParams(window.location.search).get('v');
  if (v) window.sessionStorage.setItem('cunde:vineta', v);
}


/**
 * Los precios nuevos, si los hay, para la SIGUIENTE apertura.
 *
 * Aquí y no dentro de un componente: no pinta nada, no tiene estado y no debe
 * volver a lanzarse en cada montaje. Ver lib/sincronizarPrecios.ts para por qué
 * lo que se baja hoy no se aplica hoy.
 */
sincronizarPrecios();

/**
 * ═══ LA ANALÍTICA SE ENCHUFA AQUÍ, Y SOLO AQUÍ ═══
 *
 * `registrarSumideroAnalitica` llevaba meses existiendo sin que nadie lo
 * llamara: todos los `analitica(...)` repartidos por la app se emitían al
 * vacío. Este es el único sitio del código que sabe que detrás hay Supabase.
 *
 * Sin `VITE_SUPABASE_URL` devuelve `null` y no se registra nada: en desarrollo
 * y en un clon sin credenciales, la app no encola ni pide nada.
 *
 * En desarrollo, además, por consola — para poder ver que un evento sale con lo
 * que tiene que llevar sin abrir el panel de red.
 */
{
  const supabase = sumideroSupabase();
  if (import.meta.env.DEV) {
    registrarSumideroAnalitica((evento, props) => {
      console.info(`[analytics] ${evento}`, props);
      supabase?.(evento, props);
    });
  } else if (supabase) {
    registrarSumideroAnalitica(supabase);
  }
}

/* El primer evento de la sesión. Va después de registrar el sumidero o se
   perdería, que es justo el evento que cuenta las aperturas. */
analitica('app_opened');

/**
 * ═══ COMPRAS · ARRANCAR EL SDK Y PREGUNTARLE A LA TIENDA ═══
 *
 * `arrancarCompras` llevaba meses escrito sin que nadie lo llamara, igual que
 * la analítica. Con `MURO_ACTIVO` en false no hace nada y ni siquiera crea un
 * usuario anónimo en RevenueCat.
 *
 * ═══ Y POR QUÉ EL CHEQUEO VA AQUÍ Y NO ANTES DE CADA ACCIÓN ═══
 *
 * Porque «cambiar plato» y «proteína alta» tienen que responder al instante, y
 * una llamada de red antes de cada toque sería medio segundo de espera en el
 * mejor caso y una app colgada en el sótano del súper en el peor.
 *
 * Se pregunta UNA vez al arrancar, y lo hace `AppStateProvider` porque ahí
 * está el reductor: aquí no hay forma de escribir el estado sin tocar
 * `localStorage` a mano por debajo de React. Ver `AppStateContext`.
 */
void arrancarCompras();

const container = document.getElementById('root');
const root = createRoot(container!);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);