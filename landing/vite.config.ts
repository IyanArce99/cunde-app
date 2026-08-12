import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

/* `import.meta.dirname` y no `__dirname`: Vite 8 avisa de que el cargador
   nativo de configuración —que va a ser el de por defecto— no soporta el
   segundo. */
const aqui = import.meta.dirname;

/**
 * UNA PÁGINA, UN HTML · SIN ENRUTADOR
 *
 * La landing tiene tres URLs: `/`, `/privacidad` y `/condiciones`. Meter
 * `react-router` para eso sería añadir una dependencia y renderizado en cliente
 * a cambio de nada.
 *
 * Con una entrada por página, Vite emite HTML de verdad: cada uno tiene su
 * `<title>`, su descripción y su canónica en el propio fichero, sin que haga
 * falta JavaScript para que un buscador o un WhatsApp los lean.
 *
 * Las legales van juntas a propósito: Google exige las dos para aprobar una app
 * con compras, y si una se publica sin la otra el enlace queda roto en la ficha.
 */
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      input: {
        main: resolve(aqui, 'index.html'),
        privacidad: resolve(aqui, 'privacidad.html'),
        condiciones: resolve(aqui, 'condiciones.html'),
      },
    },
  },
});
