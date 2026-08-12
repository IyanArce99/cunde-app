import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

/* `import.meta.dirname` y no `__dirname`: Vite 8 avisa de que el cargador
   nativo de configuración —que va a ser el de por defecto— no soporta el
   segundo. */
const aqui = import.meta.dirname;

/**
 * DOS PÁGINAS, DOS HTML · SIN ENRUTADOR
 *
 * La landing tiene exactamente dos URLs: `/` y `/privacidad`. Meter
 * `react-router` para eso sería añadir una dependencia y renderizado en cliente
 * a cambio de nada.
 *
 * Con dos entradas, Vite emite dos HTML de verdad: cada uno tiene su `<title>`,
 * su descripción y su canónica en el propio fichero, sin que haga falta
 * JavaScript para que un buscador o un WhatsApp los lean.
 */
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      input: {
        main: resolve(aqui, 'index.html'),
        privacidad: resolve(aqui, 'privacidad.html'),
      },
    },
  },
});
