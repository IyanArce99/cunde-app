/// <reference types="vitest" />

import legacy from '@vitejs/plugin-legacy'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { defineConfig } from 'vite'

// https://vitejs.dev/config/
export default defineConfig({
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
  }
})
