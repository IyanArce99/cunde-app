#!/usr/bin/env node
/**
 * Genera los PNG del icono de la app desde public/cunde-icono.svg.
 *
 * Sin dependencias nuevas: rasteriza con el Edge que ya trae Windows en modo
 * headless. Meter `sharp` o `resvg` en el proyecto por cinco minutos de
 * trabajo de build no compensa — y en la máquina de CI no habría binario
 * nativo que instalar.
 *
 * Uso: node catalogo/iconos.mjs
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const aqui = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.join(aqui, '..');
const SVG = path.join(RAIZ, 'public', 'cunde-icono.svg');
const DESTINO = path.join(RAIZ, 'public', 'iconos');

const NAVEGADORES = [
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
];

/**
 * Todo lo que piden las dos tiendas más lo del navegador.
 *
 *   Android/PWA  48 72 96 144 192 512   (mdpi -> xxxhdpi, Play Store)
 *   iOS          20 29 40 58 60 76 80 87 120 152 167 180 1024
 *   Web          16 32 64 180 (apple-touch-icon)
 */
const TAMANOS = [
  16, 20, 29, 32, 40, 48, 58, 60, 64, 72, 76, 80, 87, 96,
  120, 144, 152, 167, 180, 192, 512, 1024,
];

function navegador() {
  const encontrado = NAVEGADORES.find((r) => fs.existsSync(r));
  if (!encontrado) throw new Error(`No encuentro Edge ni Chrome. Probé:\n  ${NAVEGADORES.join('\n  ')}`);
  return encontrado;
}

/**
 * El SVG se incrusta en un HTML sin márgenes y del tamaño exacto. Así el
 * recorte de la captura ES el icono: no hay que recortar después ni queda
 * borde blanco del body.
 */
function paginaPara(svg, lado) {
  return `<!doctype html><meta charset="utf-8">
<style>
  html,body { margin:0; padding:0; width:${lado}px; height:${lado}px; overflow:hidden; background:transparent }
  svg { display:block; width:${lado}px; height:${lado}px }
</style>
${svg}`;
}

function main() {
  const exe = navegador();
  const svg = fs.readFileSync(SVG, 'utf8');
  fs.mkdirSync(DESTINO, { recursive: true });
  const temporal = fs.mkdtempSync(path.join(os.tmpdir(), 'cunde-iconos-'));

  console.log(`Rasterizando con ${path.basename(exe)}\n`);
  for (const lado of TAMANOS) {
    const html = path.join(temporal, `icono-${lado}.html`);
    const png = path.join(DESTINO, `icono-${lado}.png`);
    fs.writeFileSync(html, paginaPara(svg, lado), 'utf8');

    execFileSync(exe, [
      '--headless=new',
      '--disable-gpu',
      '--hide-scrollbars',
      '--force-device-scale-factor=1',
      `--window-size=${lado},${lado}`,
      `--screenshot=${png}`,
      `file:///${html.replace(/\\/g, '/')}`,
    ], { stdio: 'pipe' });

    if (!fs.existsSync(png)) throw new Error(`no salió ${png}`);
    console.log(`  icono-${String(lado).padStart(4)}.png  ${String(fs.statSync(png).size).padStart(7)} bytes`);
  }

  // El favicon y el apple-touch-icon son los mismos PNG con el nombre que
  // busca cada plataforma. Copiarlos evita que index.html tenga que conocer
  // la convención de nombres de este script.
  fs.copyFileSync(path.join(DESTINO, 'icono-32.png'), path.join(RAIZ, 'public', 'favicon.png'));
  fs.copyFileSync(path.join(DESTINO, 'icono-180.png'), path.join(RAIZ, 'public', 'apple-touch-icon.png'));

  fs.rmSync(temporal, { recursive: true, force: true });
  console.log(`\n${TAMANOS.length} PNG en public/iconos/`);
  console.log('  favicon.png y apple-touch-icon.png actualizados en public/');
}

main();
