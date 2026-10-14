#!/usr/bin/env node
/**
 * POSTRES · elegir los SKU y meterlos en el catálogo del motor.
 *
 * No raspa nada: lee el volcado que ya está en disco
 * (catalogo_mercadona_mad3_2026-07-28.json). Mercadona no se entera de que
 * esto existe.
 *
 * ═══ QUÉ ES UN POSTRE AQUÍ ═══
 *
 * Una unidad que se come después de comer y que NO se cocina: un yogur, una
 * pieza de fruta, una gelatina. Por eso no entra como receta —no tiene pasos,
 * ni tiempo, ni raciones— sino como una línea más del carrito.
 *
 * ═══ LOS CRITERIOS DE SELECCIÓN ═══
 *
 * 1. BARATO POR UNIDAD, no por envase. Un pack de 6 yogures a 1,00 € son
 *    0,167 € el postre; uno de 2 unidades a 1,30 € son 0,65 €. Cuatro veces
 *    más caro por lo mismo. La app es de dinero: se elige por €/unidad.
 * 2. QUE CUBRA A TODO EL MUNDO. Si el único postre lleva leche, quien tenga
 *    la lactosa marcada se queda sin postre y el interruptor le miente. Hace
 *    falta al menos uno por cada combinación de restricciones habitual, y la
 *    fruta es el comodín: no tiene ningún alérgeno.
 * 3. QUE AGUANTE LA SEMANA. Un postre que caduca el miércoles obliga a
 *    comprar dos veces. Yogur y gelatina aguantan; la fruta de hueso, no
 *    tanto — por eso plátano y manzana y no nectarina.
 * 4. SIN DUPLICAR SABOR. Catorce yogures de fresa no son un postre, son un
 *    castigo. La rotación va por tipo.
 *
 * ═══ POR QUÉ LA GELATINA NO ES VEGETARIANA ═══
 *
 * La gelatina alimentaria es colágeno de origen animal (piel y hueso de cerdo
 * o vacuno). Mercadona no lo declara como alérgeno —no lo es— pero sí importa
 * para "Vegetariano", "Vegano" y "Cerdo". Se marca a mano porque el catálogo
 * no trae ese dato y equivocarse aquí es servirle cerdo a quien no lo come.
 *
 * Uso:  node catalogo/postres.js            (enseña la selección)
 *       node catalogo/postres.js --escribir (la mete en motor-datos.json)
 */
import fs from 'node:fs';
import path from 'node:path';
import { etiquetaDesconocida } from './alergenos-etiqueta.js';
import { fileURLToPath } from 'node:url';

const aqui = path.dirname(fileURLToPath(import.meta.url));
const CATALOGO = path.join(aqui, 'catalogo_mercadona_mad3_2026-07-28.json');
const DATOS = path.join(aqui, '..', 'src', 'data', 'motor-datos.json');

/**
 * LA CARTA DE POSTRES.
 *
 * `sku` fijado a mano y no buscado por texto: un `includes('yogur')` cambia de
 * resultado en cuanto Mercadona renombra un producto, y entonces el postre de
 * alguien cambia sin que nadie lo haya decidido. El script comprueba que cada
 * SKU sigue existiendo y avisa si el nombre o el precio se han movido.
 *
 * `porUnidad` es cuántas unidades de catálogo se come una persona de una
 * sentada. Para lo que viene en pack es 1 unidad del pack; para la fruta a
 * peso es el peso de una pieza, que es lo que el usuario llama "una pieza".
 */
const CARTA = [
  {
    id: 'postre_yogur_natural',
    nombre: 'Yogur natural',
    sku: '22313',
    porUnidad: 1,
    unidad: 'ud',
    alergenos: ['lactosa'],
    origen: 'lacteo',
    dias: 21,
    // El más barato por unidad de toda la sección: 6 por 1,00 €.
    nota: 'el más barato por unidad de la sección',
  },
  {
    id: 'postre_gelatina',
    nombre: 'Gelatina de fresa',
    sku: '68172',
    porUnidad: 1,
    unidad: 'ud',
    alergenos: [],
    // Sin lactosa, sin gluten, sin frutos secos. Pero NO vegetariana: la
    // gelatina es colágeno animal. Ver la cabecera.
    noVegetariano: true,
    origen: 'otro',
    dias: 60,
    nota: 'sin lactosa; no vegetariana (colágeno animal)',
  },
  {
    id: 'postre_platano',
    esFruta: true,
    nombre: 'Plátano',
    sku: '3819',
    // 150 g es una pieza mediana con piel, que es como se vende y como se
    // pesa en caja. Lo que se come son ~100 g; la diferencia es la piel y la
    // recoge `rendimiento_comestible`.
    porUnidad: 0.15,
    unidad: 'kg',
    alergenos: [],
    origen: 'vegetal',
    dias: 7,
    nota: 'el comodín: vale para cualquier restricción',
  },
  {
    id: 'postre_manzana',
    esFruta: true,
    nombre: 'Manzana',
    sku: '3028',
    porUnidad: 0.22,
    unidad: 'kg',
    alergenos: [],
    origen: 'vegetal',
    dias: 21,
    nota: 'aguanta tres semanas: es el que salva la última compra',
  },
  {
    id: 'postre_natillas',
    nombre: 'Natillas de vainilla',
    sku: '68137',
    porUnidad: 1,
    unidad: 'ud',
    alergenos: ['lactosa', 'huevo'],
    origen: 'lacteo',
    dias: 30,
    nota: 'lleva huevo además de leche',
  },
  {
    id: 'postre_soja',
    nombre: 'Postre de soja',
    sku: null, // se resuelve abajo: la familia entera es pequeña
    buscarEn: 'Postres de soja',
    porUnidad: 1,
    unidad: 'ud',
    alergenos: ['soja'],
    origen: 'vegetal',
    dias: 30,
    nota: 'el postre lácteo de quien no toma lácteos',
  },
];

const catalogo = JSON.parse(fs.readFileSync(CATALOGO, 'utf8'));
const porSku = new Map(catalogo.map((p) => [p.sku, p]));

const elegidos = [];
const avisos = [];

for (const item of CARTA) {
  let p = item.sku ? porSku.get(item.sku) : null;

  // Para el postre de soja se elige el más barato por unidad de su familia,
  // porque son ocho productos y no hay una referencia obvia.
  if (!p && item.buscarEn) {
    const familia = catalogo
      .filter((x) => x.familia === item.buscarEn)
      .map((x) => ({ x, porUd: x.precio / (x.unidades_pack || 1) }))
      .sort((a, b) => a.porUd - b.porUd);
    if (familia.length) { p = familia[0].x; item.sku = p.sku; }
  }

  if (!p) { avisos.push(`${item.id}: SKU ${item.sku} NO EXISTE en el catálogo`); continue; }

  const uds = p.unidades_pack || 1;

  /**
   * LA RACIÓN SE EXPRESA SIEMPRE EN LA UNIDAD DEL CATÁLOGO. Es el bug que
   * costó caro: el yogur se vende como "0,75 kg" aunque dentro vengan seis
   * vasos, así que decir "1 unidad" hacía que el motor pidiera 7 KILOS de
   * yogur y comprara diez packs. 27,63 € de postre para dos personas cuando
   * son seis.
   *
   * Para lo que viene en pack, una ración es el contenido partido por las
   * unidades del pack. Para la fruta a peso, el peso de una pieza.
   */
  const racionEnUnidadCatalogo = Math.round(
    (item.unidad === 'ud' ? (p.contenido || 1) / uds : item.porUnidad) * 1e6,
  ) / 1e6;

  const precioUnidad = racionEnUnidadCatalogo
    * (p.precio_referencia ?? (p.precio / (p.contenido || 1)));

  elegidos.push({
    ...item, producto: p, udsPack: uds, precioUnidad,
    racionEnUnidadCatalogo,
    unidadCatalogo: p.unidad_contenido,
  });
}

const eur = (n) => n.toFixed(3).replace('.', ',') + ' €';
console.log('=== LA CARTA DE POSTRES ===\n');
for (const e of elegidos) {
  console.log(`${e.id}`);
  console.log(`  SKU ${e.producto.sku} · ${e.producto.nombre}`);
  console.log(`  envase: ${e.producto.precio.toFixed(2)} € · ${e.udsPack} ud`
    + (e.unidad === 'kg' ? ` · ${e.producto.precio_referencia} €/kg` : ''));
  console.log(`  UNA RACIÓN: ${eur(e.precioUnidad)}`
    + `  (${e.racionEnUnidadCatalogo.toFixed(3)} ${e.unidadCatalogo})`);
  console.log(`  alérgenos: ${e.alergenos.length ? e.alergenos.join(', ') : 'ninguno'}`
    + (e.noVegetariano ? ' · NO vegetariano' : ''));
  console.log(`  ${e.nota}\n`);
}

if (avisos.length) {
  console.log('=== AVISOS ===');
  for (const a of avisos) console.log('  ! ' + a);
  console.log('');
}

// ---------------------------------------------------------------------------
// Lo que cuesta de verdad una semana con postre
// ---------------------------------------------------------------------------
const mediaBarata = elegidos
  .map((e) => e.precioUnidad).sort((a, b) => a - b).slice(0, 4)
  .reduce((s, x) => s + x, 0) / 4;
console.log('=== LO QUE AÑADE AL CARRITO ===');
console.log('  (media de los cuatro más baratos: ' + eur(mediaBarata) + ' por postre)\n');
console.log('  personas  huecos  postres  coste/semana');
for (const N of [1, 2, 4]) {
  for (const huecos of [7, 14]) {
    const n = N * huecos;
    console.log(`  ${String(N).padStart(8)}  ${String(huecos).padStart(6)}  ${String(n).padStart(7)}`
      + `  ${(n * mediaBarata).toFixed(2).padStart(9)} €`);
  }
}

if (!process.argv.includes('--escribir')) {
  console.log('\n(sin --escribir no se toca motor-datos.json)');
  process.exit(0);
}

// ---------------------------------------------------------------------------
// Escribir en el catálogo del motor
// ---------------------------------------------------------------------------
const datos = JSON.parse(fs.readFileSync(DATOS, 'utf8'));
/* El peso de la pieza de fruta de HOY, no el del volcado de julio: ver piezas.ts. */
const RUTA_PIEZAS = path.join(aqui, 'peso-pieza.json');
const piezas = fs.existsSync(RUTA_PIEZAS) ? JSON.parse(fs.readFileSync(RUTA_PIEZAS, 'utf8')).skus : {};

/*
 * Las claves de alérgeno son las de la app (`lactosa`, `huevo`, `soja`): los
 * postres se filtran con las mismas reglas que las recetas (src/motor/filtros.ts).
 * Antes iban con el nombre del filtro («Lactosa») y no llevaban trazas.
 *
 * De la etiqueta guardada (alergenos-por-ean.json) salen las TRAZAS del
 * producto y si su información de alérgenos es DESCONOCIDA: sin lista de
 * ingredientes ni texto de alérgenos («x99.» no cuenta) no es «sin alérgenos».
 */
const porEan = JSON.parse(fs.readFileSync(path.join(aqui, 'alergenos-por-ean.json'), 'utf8'));
const FILTRABLES = new Set(['gluten', 'lactosa', 'frutos_secos', 'cacahuete', 'huevo', 'pescado', 'marisco', 'soja', 'sesamo', 'mostaza', 'apio', 'sulfitos', 'cerdo']);
const verificaciones = fs.existsSync(path.join(aqui, 'verificaciones.json'))
  ? JSON.parse(fs.readFileSync(path.join(aqui, 'verificaciones.json'), 'utf8')).skus : {};
const etiquetaDe = (sku) => {
  const r = porEan[sku];
  const desconocida = etiquetaDesconocida(r, verificaciones[sku]);
  const trazas = (r?.trazas ?? []).filter((t) => FILTRABLES.has(t));
  return { desconocida, trazas };
};

for (const e of elegidos) {
  const etiqueta = etiquetaDe(e.producto.sku);
  datos.ingredientes[e.id] = {
    id: e.id,
    nombre: e.nombre,
    unidad_base: e.unidadCatalogo === 'kg' ? 'g' : e.unidadCatalogo === 'l' ? 'ml' : 'ud',
    es_despensa: false,
    dias_conservacion: e.dias,
    gramos_por_unidad: e.unidadCatalogo === 'kg' ? e.racionEnUnidadCatalogo * 1000 : null,
    origen: e.origen,
    alergenos: e.alergenos,
    ...(etiqueta.trazas.filter((t) => !e.alergenos.includes(t)).length
      ? { trazas: etiqueta.trazas.filter((t) => !e.alergenos.includes(t)) } : {}),
    proteina_g_por_100: 0,
    base: null,
    // La piel del plátano y el corazón de la manzana no se comen.
    rendimiento_comestible: e.id === 'postre_platano' ? 0.65
      : e.id === 'postre_manzana' ? 0.9 : 1,
    /** Marca que esto es postre y no ingrediente de ninguna receta. */
    es_postre: true,
    /** Cuánto se come de una sentada, en unidades de catálogo. */
    postre_por_racion: e.racionEnUnidadCatalogo,
    /** La gelatina no la come un vegetariano aunque no sea alérgeno. */
    postre_no_vegetariano: !!e.noVegetariano,
    /**
     * Marca explícita, no deducida. Se dedu jo con `origen === 'vegetal'` y
     * el postre de soja también es vegetal: la comprobación "¿hay fruta en
     * la carta?" daba que sí teniendo cuatro postres procesados y ninguna
     * pieza de fruta. La fruta es el único postre sin alérgenos y el que
     * sostiene la rotación cuando los filtros aprietan: no puede depender
     * de una inferencia.
     */
    postre_es_fruta: !!e.esFruta,
  };
  const pz = piezas[e.producto.sku];
  /* Sin mirar el precio: el del volcado es de julio y el de hoy lo pone después
     aplicar-precios.js. La auditoría de la que sale el peso ya comprobó que el
     precio de hoy es el mismo. */
  const conPieza = Boolean(pz);
  datos.skus[e.id] = {
    sku: e.producto.sku,
    nombre: e.producto.nombre,
    contenido: conPieza ? pz.pieza : e.producto.contenido,
    unidad: e.producto.unidad_contenido,
    precio: e.producto.precio,
    precio_kg_l_ud: conPieza ? Number((e.producto.precio / pz.pieza).toFixed(3)) : e.producto.precio_referencia,
    ...(etiqueta.desconocida ? { alergenos_desconocidos: true } : {}),
    packaging: e.producto.packaging,
    unidades_pack: e.producto.unidades_pack,
    peso_variable: e.producto.peso_variable,
    departamento: e.producto.departamento,
    subfamilia: e.producto.subfamilia,
  };
}

datos.nota = (datos.nota || '') + ` · postres añadidos ${new Date().toISOString().slice(0, 10)}`;
fs.writeFileSync(DATOS, JSON.stringify(datos));
console.log(`\nEscritos ${elegidos.length} postres en motor-datos.json`);
