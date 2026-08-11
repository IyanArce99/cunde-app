/**
 * Punto de entrada de `/privacidad.html`.
 *
 * Se llama así y no `privacidad.tsx` porque Windows no distingue mayúsculas:
 * `privacidad.tsx` y `Privacidad.tsx` son el MISMO fichero y el segundo se
 * carga el primero sin avisar. En Linux compilaría y en el portátil no.
 */
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import Privacidad from './Privacidad';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Privacidad />
  </StrictMode>,
);
