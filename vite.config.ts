/// <reference types="vitest" />

import legacy from '@vitejs/plugin-legacy'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { defineConfig } from 'vite'

// https://vitejs.dev/config/
export default defineConfig({
  /**
   * EL CATÁLOGO, COMO CADENA QUE SE PARSEA, NO COMO OBJETO JS.
   *
   * Por defecto Vite incrusta un `.json` importado como un literal de objeto de
   * JavaScript, y eso lo tiene que analizar el parser del lenguaje. Con
   * `stringify` lo emite como `JSON.parse("…")`, que es un parser especializado
   * y mucho más rápido para cargas grandes.
   *
   * Aquí importa porque `motor-datos.json` son 256 KB —las 142 recetas, los
   * ingredientes y los 108 SKU— y entran en el arranque: sin ellos la app no
   * genera nada. El porcentaje de gente que llega a ver su menú es LA métrica
   * del producto, y se decide en esos primeros milisegundos.
   *
   * Ningún `.json` del proyecto se importa por nombre —solo por defecto—, que
   * es lo único que esta opción rompería.
   */
  json: { stringify: true },
  plugins: [
    react(),
    legacy(),
    /**
     * SERVICE WORKER · para que Compra funcione sin cobertura.
     *
     * No es un extra: es una regla del proyecto. La pantalla Compra se usa en
     * el sótano de un supermercado, donde no hay red. Sin service worker,
     * abrirla ahí da una pantalla en blanco — y la lista de la compra es justo
     * lo único que hace falta en ese momento.
     *
     * Y de paso resuelve el problema de probarla en un iPhone sin Mac ni App
     * Store: se publica el `dist/`, se abre en Safari y "Añadir a pantalla de
     * inicio" la deja con su icono, a pantalla completa y funcionando offline.
     * Para el test de cuatro semanas eso vale igual que una app nativa, y
     * sirve para iOS y Android con una sola URL.
     */
    VitePWA({
      // autoUpdate y no prompt: quien está de pie en el súper no tiene que
      // decidir sobre actualizaciones. Se aplica en la siguiente apertura.
      registerType: 'autoUpdate',
      includeAssets: ['favicon.png', 'apple-touch-icon.png', 'iconos/*.png', 'marca/**/*.svg'],
      // El manifest bueno ya está en public/manifest.json. Se usa ese en vez de
      // generar otro, para no acabar con dos que se desincronizan.
      manifest: false,
      workbox: {
        /**
         * motor-datos.json son 289 KB y es el catálogo entero: sin él la app no
         * genera nada. Entra en la precarga a propósito, aunque encarezca la
         * primera visita — es la diferencia entre funcionar sin red y no
         * funcionar.
         */
        globPatterns: ['**/*.{js,css,html,json,png,svg,woff,woff2}'],
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
        // Sin red, cualquier ruta devuelve el index: es una SPA y las rutas las
        // resuelve el enrutador, no el servidor.
        navigateFallback: 'index.html',
      },
      devOptions: {
        // Apagado en desarrollo: un service worker cacheando mientras se toca
        // el código es la forma más rápida de perder una tarde persiguiendo un
        // cambio que sí está hecho pero no se ve.
        enabled: false,
      },
    }),
  ],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/setupTests.ts',
    /**
     * SOLO `src/`. Y no es cosmética.
     *
     * `npx vitest run` a secas barría también `.claude/worktrees/`, donde viven
     * las copias del repo que usan los agentes en paralelo. Salían 11 fallos de
     * ficheros que no están en este árbol —con trazas apuntando a un
     * `node_modules` que no es el nuestro— y costaba media hora entender que el
     * código de aquí estaba bien.
     *
     * Un test que falla tiene que señalar a código de este repositorio. Si no,
     * la suite deja de ser una señal y pasa a ser ruido que se aprende a
     * ignorar, que es la peor cosa que le puede pasar a una suite.
     */
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    exclude: ['**/node_modules/**', '**/dist/**', '.claude/**', 'android/**'],
  }
})
