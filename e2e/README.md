# Pruebas de recorrido (fuera de vitest)

Scripts que conducen la app real por el protocolo de depuración de Chrome
(CDP), sin dependencias. No sustituyen a una prueba en un teléfono de verdad.

| script | qué prueba | cómo |
|---|---|---|
| `precios-local.mjs` | Instantáneas por zona (descarga, aviso, compra en curso, rechazos), sin conexión y analítica con su cola offline sin duplicados | 1. `node catalogo/servidor-pruebas.mjs` · 2. `npx vite build --mode pruebas --outDir dist-pruebas` y `npx vite preview --mode pruebas --outDir dist-pruebas --port 5299` · 3. `node e2e/precios-local.mjs <repo> <perfil-chrome> <carpeta-salida>` |
| `recorrido-android.mjs` | La beta junto a la versión actual, y el recorrido entero: zona → semana → «No cocino» → comprar → cerrar → reabrir sin red → semana siguiente con la fecha adelantada | Emulador o teléfono con depuración USB, APK de `assembleDebug` y `assembleBeta` compilados. `node e2e/recorrido-android.mjs <repo> <carpeta-capturas>` |

`cdp.mjs` abre Chrome sin ventana (`CHROME` para otra ruta). La fecha se
adelanta inyectando un `Date` desplazado en el WebView; el reloj virtual de CDP
no sirvió.
