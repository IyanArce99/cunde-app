import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { sincronizarPrecios } from './lib/sincronizarPrecios';

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

const container = document.getElementById('root');
const root = createRoot(container!);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);