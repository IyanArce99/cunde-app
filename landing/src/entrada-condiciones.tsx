/**
 * Punto de entrada de `/condiciones.html`.
 *
 * Se llama así y no `condiciones.tsx` por lo mismo que `entrada-privacidad`:
 * Windows no distingue mayúsculas, así que `condiciones.tsx` y `Condiciones.tsx`
 * son el MISMO fichero y el segundo se carga el primero sin avisar. En Linux
 * compilaría y en el portátil no.
 */
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import Condiciones from './Condiciones';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Condiciones />
  </StrictMode>,
);
