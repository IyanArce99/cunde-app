import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';

// Conmutador temporal de comparación de viñetas (?v=a | ?v=b). Se captura al
// arrancar porque la portada no monta ninguna viñeta y al llegar a la primera
// pantalla que sí la monta el parámetro ya se ha perdido en el push de ruta.
// Se va con la decisión.
{
  const v = new URLSearchParams(window.location.search).get('v');
  if (v) window.sessionStorage.setItem('cunde:vineta', v);
}


const container = document.getElementById('root');
const root = createRoot(container!);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);