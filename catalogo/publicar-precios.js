#!/usr/bin/env node
/**
 * Construye la INSTANTÁNEA de precios que consume la app.
 *
 * Es el eslabón que faltaba: `revisar-precios.js` pregunta a Mercadona y
 * `aplicar-precios.js` toca el catálogo del repositorio, pero ninguno de los
 * dos hace que el precio nuevo llegue a un móvil ya instalado. Eso solo pasaba
 * publicando una versión en la Play Store, que tarda días y se revisa a mano.
 *
 * Lo que sale de aquí es un JSON de ~30 KB que se sube a donde sea —Supabase,
 * su Storage, un fichero estático— y que la app se baja al arrancar. Ver
 * src/lib/precios.ts.
 *
 * Uso:
 *   node publicar-precios.js                          (Madrid, el catálogo actual)
 *   node publicar-precios.js --salida instantanea.json
 *   node publicar-precios.js --zona gran-canaria      (src/data/zonas/gran-canaria.json)
 *
 * ═══ CADA INSTANTÁNEA DICE DE QUÉ ZONA ES ═══
 *
 * La app rechaza entera una instantánea de otra zona (ver `zona` en
 * src/lib/precios.ts). Las de antes del 14 oct 2026 no llevaban el campo y
 * eran de mad3, así que la app lee «sin zona» como Madrid.
 *
 * Para Gran Canaria esto empaqueta lo que hay en src/data/zonas/, que lo
 * escribe catalogo/construir-zona.ts tras auditar los nueve almacenes. Los
 * canónicos sin producto en la zona no van: la app los deja fuera.
 *
 * ═══ POR QUÉ LLEVA LA FILA ENTERA Y NO SOLO EL PRECIO ═══
 *
 * Solo los precios serían 4,3 KB en vez de 30. Pero cuando Mercadona
 * descataloga un producto hay que sustituirlo por otro SKU, con otro nombre y
 * otro formato, y con solo el precio esa corrección seguiría necesitando
 * publicar una versión — que es justo lo que esto viene a evitar. 26 KB es un
 * precio barato por no volver a depender de la tienda.
 *
 * ═══ ESTO NO DECIDE, SOLO EMPAQUETA ═══
 *
 * Las comprobaciones de si los precios son creíbles están en
 * `aplicar-precios.js`, que es quien las mira antes de tocar el catálogo, y se
 * repiten EN EL CLIENTE por si acaso. Aquí solo se empaqueta lo que ya está
 * decidido. Publicar sigue siendo una acción deliberada de una persona, no un
 * efecto secundario del cron.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const aqui = path.dirname(fileURLToPath(import.meta.url));
const iZona = process.argv.indexOf('--zona');
const ZONA = iZona > -1 ? process.argv[iZona + 1] : 'madrid';
const DATOS = ZONA === 'madrid'
  ? path.join(aqui, '..', 'src', 'data', 'motor-datos.json')
  : path.join(aqui, '..', 'src', 'data', 'zonas', `${ZONA}.json`);

const i = process.argv.indexOf('--salida');
const SALIDA = i > -1 ? process.argv[i + 1]
  : path.join(aqui, ZONA === 'madrid' ? 'instantanea-precios.json' : `instantanea-precios-${ZONA}.json`);

const datos = JSON.parse(fs.readFileSync(DATOS, 'utf8'));

/* Los mismos campos que declara `FilaPrecio` en src/lib/precios.ts. Ni uno más:
   las recetas y los ingredientes pesan diez veces esto y no cambian a diario. */
const CAMPOS = [
  'sku', 'nombre', 'contenido', 'unidad', 'precio', 'precio_kg_l_ud',
  'packaging', 'unidades_pack', 'peso_variable', 'departamento', 'subfamilia',
];
/* Solo en las conservas: el neto de la etiqueta. Con él la app distingue un
   cambio de precio de un cambio de envase. */
const OPCIONALES = ['contenido_etiqueta', 'alergenos_desconocidos'];

const skus = {};
const malos = [];
for (const [canonico, s] of Object.entries(datos.skus)) {
  if (s === null) continue; // sin producto en la zona: la app ya lo deja fuera
  if (!(s.precio > 0) || !(s.contenido > 0)) {
    malos.push(`${canonico}: precio ${s.precio}, contenido ${s.contenido}`);
    continue;
  }
  const fila = {};
  for (const c of CAMPOS) fila[c] = s[c] ?? null;
  for (const c of OPCIONALES) if (s[c] != null) fila[c] = s[c];
  skus[canonico] = fila;
}

if (malos.length) {
  console.error('\nHay SKU sin precio o sin contenido. No publico un catálogo con huecos:\n');
  for (const m of malos) console.error(`  ✗ ${m}`);
  process.exit(1);
}

const instantanea = {
  // La fecha del catálogo. Es lo que la app compara para saber si hay algo
  // nuevo, y por eso tiene que ser ordenable como cadena: ISO y nada más.
  version: ZONA === 'madrid' ? datos.generadoEn : datos.version,
  almacen: ZONA === 'madrid' ? 'mad3' : datos.almacenes.join(','),
  zona: ZONA,
  skus,
};

fs.writeFileSync(SALIDA, JSON.stringify(instantanea));
const kb = Math.round(fs.statSync(SALIDA).size / 1024 * 10) / 10;
console.log(`\nInstantánea ${instantanea.version} · ${Object.keys(skus).length} SKU · ${kb} KB`);
console.log(`Escrita ${SALIDA}`);
console.log('\nSúbela a donde apunte VITE_PRECIOS_URL. La app la aplicará en la siguiente apertura.');
