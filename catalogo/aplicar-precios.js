#!/usr/bin/env node
/**
 * Aplica a `motor-datos.json` los cambios de precio que encontró
 * `revisar-precios.js`. Es el paso que ese script NO hace a propósito.
 *
 * ═══ POR QUÉ SON DOS SCRIPTS Y NO UNO ═══
 *
 * Revisar es leer; aplicar es cambiar el número que el usuario ve en la
 * pantalla del supermercado. Un cron que hiciera las dos cosas publicaría solo
 * lo que un scrape devolvió esa madrugada, y el día que Mercadona cambie un
 * campo o devuelva medio catálogo a cero, la app diría esos ceros. El informe
 * es automático; publicarlo es una decisión.
 *
 * Uso:
 *   node aplicar-precios.js catalogo/precios-2026-08-07.json
 *   node aplicar-precios.js catalogo/precios-2026-08-07.json --ensayo
 *
 * `--ensayo` dice qué haría y no escribe nada.
 *
 * ═══ LO QUE COMPRUEBA ANTES DE ESCRIBIR ═══
 *
 * Nada de esto es paranoia: son las formas conocidas en que un scrape estropea
 * un catálogo sin que salte ningún error.
 *
 *   · Precio 0, negativo o no numérico  → se rechaza esa línea.
 *   · Salto de más del 60%              → se rechaza y se avisa. Un precio que
 *     se triplica de un día para otro es casi siempre un cambio de formato del
 *     producto (bandeja de 400 g que pasa a 1 kg), no una subida.
 *   · El SKU no está en el catálogo     → se ignora, no se inventa una entrada.
 *   · Más de un tercio de los productos cambiando → se para entero. Eso no es
 *     una lista de precios nueva, es otra cosa.
 *
 * Y siempre deja una copia con fecha antes de tocar nada.
 *
 * ═══ EL ORDEN, QUE NO ES OPCIONAL ═══
 *
 * `motor-datos.json` lo escriben TRES cosas, y las dos primeras leen del volcado
 * del catálogo, que tiene los precios del día en que se raspó:
 *
 *   1. generar.ts            recetas, ingredientes y SKU elegidos
 *   2. postres.js --escribir añade los SKU de postre
 *   3. aplicar-precios.js    pone los precios de la última revisión
 *
 * Así que este va SIEMPRE el último. Ejecutarlo antes de regenerar es tirar el
 * trabajo, y no avisa: los precios vuelven a los del volcado en silencio.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATOS = path.join(__dirname, '..', 'src', 'data', 'motor-datos.json');
/**
 * ═══ Y TAMBIÉN EL MAPEO, O EL ARREGLO DURA HASTA EL SIGUIENTE BUILD ═══
 *
 * `motor-datos.json` no se escribe a mano: lo COMPILA `generar.ts` a partir de
 * `mapeo-propuesto.json`, que a su vez sale del volcado del catálogo. Así que
 * tocar solo el fichero compilado deja los precios nuevos hasta que alguien
 * regenere — y entonces vuelven los del volcado sin que nadie se entere.
 *
 * Detectado antes de que pasara, al ir a añadir recetas: añadir una receta
 * obliga a regenerar, y eso habría revertido la revisión de precios de hoy en
 * silencio. Se actualizan los dos.
 */
const MAPEO = path.join(__dirname, 'mapeo-propuesto.json');

/** Salto relativo por encima del cual el cambio se considera sospechoso. */
const SALTO_SOSPECHOSO = 0.60;
/** Y qué fracción del catálogo puede moverse antes de que esto huela mal. */
const FRACCION_MAXIMA = 1 / 3;

const informePath = process.argv[2];
const ensayo = process.argv.includes('--ensayo');
if (!informePath) {
  console.error('Falta el informe: node aplicar-precios.js catalogo/precios-2026-08-07.json');
  process.exit(1);
}

const informe = JSON.parse(fs.readFileSync(informePath, 'utf8'));
const datos = JSON.parse(fs.readFileSync(DATOS, 'utf8'));
const mapeo = JSON.parse(fs.readFileSync(MAPEO, 'utf8'));

const cambios = informe.cambios ?? [];
if (!cambios.length) {
  console.log('El informe no trae cambios. No hay nada que aplicar.');
  process.exit(0);
}

if (cambios.length > informe.total * FRACCION_MAXIMA) {
  console.error(
    `PARO: ${cambios.length} de ${informe.total} productos cambian de precio `
    + `(más de un ${Math.round(FRACCION_MAXIMA * 100)}%). Eso no es una lista de precios `
    + 'nueva; revísalo a mano antes de publicar nada.',
  );
  process.exit(1);
}

const aplicados = [];
const rechazados = [];

for (const c of cambios) {
  const actual = datos.skus[c.canonico];
  if (!actual) {
    rechazados.push(`${c.nombre}: el canónico «${c.canonico}» no está en el catálogo`);
    continue;
  }
  if (actual.sku !== c.sku) {
    // El SKU cambió por debajo: es otro producto, no otro precio. Lo decide una
    // persona, porque puede significar que la referencia se descatalogó.
    rechazados.push(`${c.nombre}: el sku del catálogo es ${actual.sku} y el informe trae ${c.sku}`);
    continue;
  }
  const nuevo = c.precioNuevo;
  if (typeof nuevo !== 'number' || !Number.isFinite(nuevo) || nuevo <= 0) {
    rechazados.push(`${c.nombre}: precio inválido (${nuevo})`);
    continue;
  }
  const salto = Math.abs(nuevo - actual.precio) / actual.precio;
  if (salto > SALTO_SOSPECHOSO) {
    rechazados.push(
      `${c.nombre}: salta un ${Math.round(salto * 100)}% (${actual.precio} -> ${nuevo}). `
      + 'Suele ser un cambio de formato, no una subida.',
    );
    continue;
  }

  /* El precio por unidad se RECALCULA, no se copia del informe: es lo que usa
     el motor para valorar el consumo, y si los dos números dejan de cuadrar la
     app cobra una cosa y calcula con otra. */
  const porUnidad = Number((nuevo / actual.contenido).toFixed(4));
  aplicados.push({
    canonico: c.canonico,
    nombre: actual.nombre,
    de: actual.precio,
    a: nuevo,
    ppuDe: actual.precio_kg_l_ud,
    ppuA: porUnidad,
  });
  if (!ensayo) {
    actual.precio = nuevo;
    actual.precio_kg_l_ud = porUnidad;
    /* El mismo SKU dentro de los candidatos del mapeo, que es de donde lo
       volverá a leer `generar.ts`. Si solo se toca el compilado, el siguiente
       build revierte esto sin decir nada. */
    const candidatos = mapeo[c.canonico]?.candidatos ?? [];
    const cand = candidatos.find((x) => x.sku === actual.sku);
    if (cand) {
      cand.precio = nuevo;
      cand.precio_kg_l_ud = porUnidad;
    } else {
      rechazados.push(`${c.nombre}: actualizado en motor-datos pero NO está en mapeo-propuesto`);
    }
  }
}

console.log(`\nAPLICADOS: ${aplicados.length}   RECHAZADOS: ${rechazados.length}\n`);
for (const a of aplicados) {
  const signo = a.a > a.de ? '+' : '';
  console.log(
    `  ${String(a.de.toFixed(2)).padStart(6)} -> ${String(a.a.toFixed(2)).padStart(6)}  `
    + `(${signo}${(a.a - a.de).toFixed(2)})  ${a.nombre}`,
  );
}
if (rechazados.length) {
  console.log('\nRechazados, para mirar a mano:');
  for (const r of rechazados) console.log('  · ' + r);
}

if (ensayo) {
  console.log('\n--ensayo: no he escrito nada.');
  process.exit(0);
}

/* La fecha que ve el usuario. Sale en la cabecera de la pantalla Compra
   —«Precios de Mercadona del 7 AGO»— y es lo que le dice si esto es de hoy.
   Cambiar los precios sin cambiarla sería la peor de las dos opciones. */
const fecha = (informe.revisadoEn ?? new Date().toISOString()).slice(0, 10);
const antes = datos.generadoEn;
datos.generadoEn = fecha;
/* Sin duplicar: reaplicar el mismo informe —que pasa cada vez que se regenera—
   dejaba la misma frase dos y tres veces pegadas en la nota. */
const rastro = `precios revisados ${fecha}`;
if (!datos.nota.includes(rastro)) {
  datos.nota = `${datos.nota} · ${rastro} (${aplicados.length} cambios, almacén ${informe.almacen})`;
}

const copia = DATOS.replace(/\.json$/, `.${antes}.bak.json`);
if (!fs.existsSync(copia)) fs.copyFileSync(DATOS, copia);
/**
 * `motor-datos.json` SIN SANGRAR, como lo dejan `generar.ts` y `postres.js`.
 *
 * Este fichero se empaqueta dentro de la app y se precarga entero en el service
 * worker: es lo que hace que la pantalla Compra funcione en el sótano del
 * supermercado. Escribirlo con dos espacios de sangría lo engordaba un 40% —de
 * 240 a 403 KB— y ese peso lo paga el primer arranque, que es justo la métrica
 * que decide el producto.
 *
 * El mapeo sí va sangrado: no se empaqueta, se revisa a mano.
 */
fs.writeFileSync(DATOS, JSON.stringify(datos));
fs.writeFileSync(MAPEO, `${JSON.stringify(mapeo, null, 2)}\n`);

console.log(`\nFecha del catálogo: ${antes} -> ${fecha}`);
console.log(`Copia de seguridad: ${path.basename(copia)}`);
console.log(`Escritos ${path.basename(DATOS)} y ${path.basename(MAPEO)}`);
