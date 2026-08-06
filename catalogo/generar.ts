#!/usr/bin/env node --experimental-strip-types
/**
 * Paso de build. Ya no genera semanas: eso lo hace el motor en el cliente
 * (src/motor), porque el usuario cambia variedad, comensales y comidas en
 * vivo y hornear todas las combinaciones pesaba más que el propio motor.
 *
 * Lo que sí hace aquí, que el cliente no puede:
 *   1. Elegir qué producto real cubre cada ingrediente canónico, mirando el
 *      catálogo entero (4.606 productos). Se escribe en mapeo-elegido.json
 *      para poder revisarlo y corregirlo a mano.
 *   2. Empaquetar en src/data/motor-datos.json solo lo que el motor necesita:
 *      las 10 recetas, la tabla de ingredientes y los ~35 SKU elegidos.
 *
 * Uso: node --experimental-strip-types generar.ts
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  aUnidadCatalogo, escalar, factorPenalizacion, diasEfectivos, esCandidatoUsable, SIN_SKU,
} from '../src/motor/carrito.ts';
import { generarSemana } from '../src/motor/seleccionar.ts';
import { informar, revisarCoherencia } from './coherencia.ts';
import type { DatosMotor, Sku } from '../src/motor/tipos.ts';

const aqui = path.dirname(fileURLToPath(import.meta.url));
const RUTA_MAPEO_PROPUESTO = path.join(aqui, 'mapeo-propuesto.json');
const RUTA_MAPEO_ELEGIDO = path.join(aqui, 'mapeo-elegido.json');
const RUTA_RECETAS = path.join(aqui, '..', 'docs', 'recetas-piloto.json');
const RUTA_INGREDIENTES = path.join(aqui, '..', 'docs', 'ingredientes-canonicos.json');
const RUTA_SALIDA = path.join(aqui, '..', 'src', 'data', 'motor-datos.json');
const RUTA_MUESTRA = path.join(aqui, '..', 'src', 'data', 'muestra-portada.json');

/**
 * El producto que la portada usa como PRUEBA.
 *
 * UNO, no tres. Con tres eran ocho líneas de letra pequeña en la pantalla
 * cuyo único trabajo es conseguir un toque, y cada línea es una oportunidad
 * de no darlo. Tres productos no demuestran más que uno: la afirmación es "sé
 * el precio de un producto concreto", y un SKU la demuestra entera.
 *
 * Lo único que el competidor gratuito no puede hacer es dar el precio de un
 * SKU concreto, y la primera pantalla no enseñaba ninguno. Se escriben en su
 * propio fichero y no se lee motor-datos.json desde la portada: son 289 KB de
 * JSON que se parsearían antes del primer pintado, y el porcentaje que llega
 * a ver su menú es la métrica que decide el producto.
 *
 * Generado, no escrito a mano: así no puede quedarse con un precio viejo.
 */
const MUESTRA_PORTADA = ['pechuga_pollo'];

/**
 * La semana de ejemplo de la portada: el caso más común y el que trae el
 * onboarding por defecto. Se genera con el MISMO motor que la app, así que el
 * ticket de la primera pantalla es un ticket que la app sabe producir — no una
 * maqueta con cifras bonitas. Si el catálogo sube de precio, la portada sube.
 */
const EJEMPLO = { N: 2, presupuesto: 65, lineas: 3 } as const;

/** "Bandeja 500 g", no "Bandeja 0.5 kg": el envase se lee como en la etiqueta. */
function formatearContenido(contenido: number, unidad: string): string {
  if (unidad === 'kg' || unidad === 'l') {
    if (contenido < 1) return `${Math.round(contenido * 1000)} ${unidad === 'kg' ? 'g' : 'ml'}`;
    return `${Number(contenido.toFixed(2))} ${unidad === 'kg' ? 'kg' : 'L'}`;
  }
  return `${contenido} uds`;
}

const RUTA_LOTES = path.join(aqui, '..', 'docs', 'recetas');
const RUTA_ENSAMBLAJES = path.join(aqui, '..', 'docs', 'ensamblajes.json');

const leer = (ruta: string) => JSON.parse(fs.readFileSync(ruta, 'utf8'));

/**
 * Palabras del nombre de un producto que delatan un origen o un alérgeno.
 * Sirven para pillar cuando el optimizador elige un SKU que contradice lo
 * que el ingrediente canónico declara.
 */
const DELATORAS: { palabras: string[]; origen?: string; alergeno?: string }[] = [
  { palabras: ['anchoa', 'atun', 'bonito', 'sardina', 'caballa', 'merluza', 'bacalao', 'salmon', 'pescado'], origen: 'pescado' },
  { palabras: ['mejillon', 'calamar', 'gamba', 'langostino', 'sepia', 'pulpo', 'marisco', 'almeja', 'berberecho'], origen: 'marisco' },
  { palabras: ['pollo', 'pavo', 'cerdo', 'ternera', 'vacuno', 'jamon', 'chorizo', 'bacon', 'bacón', 'panceta', 'carne', 'longaniza'], origen: 'carne' },
  { palabras: ['queso', 'nata', 'leche', 'mantequilla', 'yogur', 'lacteo'], origen: 'lacteo' },
  { palabras: ['huevo'], origen: 'huevo' },
  { palabras: ['queso', 'nata', 'leche', 'mantequilla', 'yogur'], alergeno: 'lactosa' },
  { palabras: ['trigo', 'gluten', 'spaghetti', 'macarron', 'fideo', 'pan'], alergeno: 'gluten' },
  { palabras: ['almendra', 'avellana', 'nuez', 'nueces', 'cacahuete', 'pistacho', 'anacardo'], alergeno: 'frutos_secos' },
  // Sin 'lomo': es un corte, no un animal — "Lomo de bacalao" no lleva cerdo.
  // El cerdo de verdad lo cazan 'cerdo', 'jamon', 'chorizo' y compañía.
  { palabras: ['cerdo', 'jamon', 'chorizo', 'bacon', 'bacón', 'panceta', 'longaniza'], alergeno: 'cerdo' },
];

/**
 * Falsos positivos conocidos de la búsqueda por palabra, con su porqué. Cada
 * excepción hay que justificarla aquí: es la puerta por la que se puede colar
 * otra vez un alérgeno de verdad.
 */
const EXCEPCIONES: { canonico: string; palabra: string; porque: string }[] = [
  { canonico: 'calabaza', palabra: 'cacahuete', porque: '"calabaza cacahuete" es la variedad butternut, no un fruto seco' },
];

const normalizar = (t: string) => t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/**
 * El sistema de filtros dietéticos confía en `origen` y `alergenos` del
 * ingrediente canónico. Pero el PRODUCTO lo elige el optimizador por coste, y
 * nada garantizaba que fuese coherente con lo que el canónico declara: así se
 * coló "Aceitunas verdes rellenas de anchoa" en un canónico marcado vegetal,
 * y el filtro de Pescado lo daba por bueno. Esto se niega a generar si vuelve
 * a pasar — más vale romper el build que mentir sobre un alérgeno.
 */
function guardiaDeCoherencia(skus: Record<string, Sku>, ingredientes: Record<string, any>) {
  const fallos: string[] = [];

  // PRIMERA RED: la etiqueta real por EAN. Es la que caza lo que el nombre no
  // dice — un chorizo con lactosa, un caldo con gluten. Ver enriquecer.js.
  const RUTA_EAN = path.join(aqui, 'alergenos-por-ean.json');
  const porEan = fs.existsSync(RUTA_EAN) ? leer(RUTA_EAN) : {};
  for (const [canonico, sku] of Object.entries(skus)) {
    const real = porEan[sku.sku];
    if (!real?.alergenos?.length) continue;
    const meta = ingredientes[canonico];
    const declarado = new Set<string>([
      ...meta.alergenos,
      ...(meta.origen === 'huevo' ? ['huevo'] : []),
      ...(meta.origen === 'lacteo' ? ['lactosa'] : []),
      ...(meta.origen === 'pescado' ? ['pescado'] : []),
      ...(meta.origen === 'marisco' ? ['marisco'] : []),
      ...(meta.origen === 'carne' ? ['carne'] : []),
    ]);
    for (const a of real.alergenos) {
      // Los que el motor sabe filtrar hoy (ver Alergeno) más los que gobierna
      // `origen`. Si aquí falta uno que la etiqueta declara, la app ofrece un
      // filtro que no lo caza: por eso la lista se amplía a la vez que el enum.
      const filtrables = [
        'gluten', 'lactosa', 'frutos_secos', 'cerdo', 'marisco', 'apio', 'soja', 'sulfitos',
        'huevo', 'pescado',
      ];
      if (!filtrables.includes(a)) continue;
      if (declarado.has(a)) continue;
      fallos.push(`${canonico}: la ETIQUETA de "${sku.nombre}" declara ${a.toUpperCase()} y el vocabulario no lo dice`);
    }
  }

  // SEGUNDA RED: el nombre del producto. Ya no es la única defensa, pero
  // sigue puesta: cubre los SKU que no respondieron al enriquecido.
  for (const [canonico, sku] of Object.entries(skus)) {
    const meta = ingredientes[canonico];
    const nombre = normalizar(sku.nombre);
    const palabras = new Set(nombre.split(/[^a-z0-9]+/).filter(Boolean));

    for (const regla of DELATORAS) {
      const delatora = regla.palabras.find(
        (p) => palabras.has(normalizar(p))
          && !EXCEPCIONES.some((e) => e.canonico === canonico && e.palabra === p),
      );
      if (!delatora) continue;
      if (regla.origen && meta.origen !== regla.origen && !ingredienteYaLoDeclara(meta, regla)) {
        fallos.push(`${canonico}: "${sku.nombre}" suena a ${regla.origen} ("${delatora}") pero el canónico dice origen "${meta.origen}"`);
      }
      if (regla.alergeno && !meta.alergenos.includes(regla.alergeno)) {
        fallos.push(`${canonico}: "${sku.nombre}" suena a ${regla.alergeno} ("${delatora}") pero el canónico no lo declara`);
      }
    }
  }
  return fallos;
}

/** Un canónico de carne puede llevar la palabra "pollo" sin ser sospechoso. */
function ingredienteYaLoDeclara(meta: any, regla: { origen?: string }) {
  if (!regla.origen) return true;
  // carne/pescado/marisco son todos "animal": no se delatan entre sí de forma útil
  const animal = ['carne', 'pescado', 'marisco'];
  return animal.includes(meta.origen) && animal.includes(regla.origen);
}

/**
 * Coste de cubrir una necesidad con ESTE producto: los paquetes que hay que
 * comprar más el sobrante penalizado por lo perecedero que sea. No es €/kg —
 * es lo que evita que un pack barato por kilo pero mal dimensionado gane solo
 * por serlo (un congelado de 1,2 kg para una necesidad de 300 g).
 */
function costeEfectivo(sku: Sku, necesario: number, unidad: 'g' | 'ml' | 'ud', diasFresco: number): number {
  const enCatalogo = aUnidadCatalogo(necesario, unidad, sku);
  const compras = Math.ceil(enCatalogo / sku.contenido);
  const sobrante = (compras * sku.contenido - enCatalogo) * sku.precio_kg_l_ud;
  return compras * sku.precio + sobrante * factorPenalizacion(diasEfectivos(sku, diasFresco));
}

function elegirSkus(mapeoPropuesto: any, recetas: any[], ingredientes: Record<string, any>) {
  if (fs.existsSync(RUTA_MAPEO_ELEGIDO)) return leer(RUTA_MAPEO_ELEGIDO) as Record<string, string>;

  // Necesidad de todo el recetario a N=2, una tanda por receta. No depende de
  // qué recetas acaben en la semana: si dependiera habría un ciclo, porque la
  // selección usa los precios que salen de este mapeo.
  const necesidad = new Map<string, { cantidad: number; unidad: 'g' | 'ml' | 'ud' }>();
  for (const receta of recetas) {
    for (const ing of receta.ingredientes) {
      if (!necesidad.has(ing.canonico)) necesidad.set(ing.canonico, { cantidad: 0, unidad: ing.unidad });
      necesidad.get(ing.canonico)!.cantidad += escalar(ing.cantidad, ing.escalado, 2);
    }
  }

  // Un ingrediente que todavía no usa ninguna receta también necesita
  // producto elegido: sin él, quien escriba una receta nueva no puede
  // ponerle precio. Se le supone una necesidad semanal media para dos
  // personas — solo decide qué formato entra, y en cuanto haya recetas de
  // verdad se vuelve a elegir con la demanda real (borra mapeo-elegido.json).
  const NECESIDAD_SUPUESTA: Record<string, number> = { g: 300, ml: 300, ud: 2 };

  const elegido: Record<string, string> = {};
  for (const [canonico, info] of Object.entries<any>(mapeoPropuesto)) {
    if (SIN_SKU.has(canonico)) continue; // el agua no se compra
    const meta = ingredientes[canonico];
    if (!meta) throw new Error(`${canonico} no está en docs/ingredientes-canonicos.json`);
    const necesita = necesidad.get(canonico)
      ?? { cantidad: NECESIDAD_SUPUESTA[meta.unidad_base], unidad: meta.unidad_base as 'g' | 'ml' | 'ud' };

    const usables = info.candidatos.filter((c: Sku) => esCandidatoUsable(necesita.unidad, c));
    if (!usables.length) throw new Error(`${canonico}: ningún candidato convertible desde "${necesita.unidad}"`);

    let mejor: Sku | null = null;
    let mejorCoste = Infinity;
    for (const candidato of usables as Sku[]) {
      const coste = costeEfectivo(candidato, necesita.cantidad, necesita.unidad, meta.dias_conservacion);
      if (coste < mejorCoste) { mejorCoste = coste; mejor = candidato; }
    }
    elegido[canonico] = mejor!.sku;
  }

  fs.writeFileSync(RUTA_MAPEO_ELEGIDO, JSON.stringify(elegido, null, 2), 'utf8');
  return elegido;
}

/**
 * El recetario son el piloto más los lotes de docs/recetas/. Se mantienen en
 * ficheros separados a propósito: cada lote se puede revisar, corregir o
 * retirar entero sin tocar el resto.
 */
function cargarRecetario() {
  const recetas = [...leer(RUTA_RECETAS).recetas];
  if (fs.existsSync(RUTA_LOTES)) {
    for (const fichero of fs.readdirSync(RUTA_LOTES).filter((f) => f.endsWith('.json')).sort()) {
      recetas.push(...leer(path.join(RUTA_LOTES, fichero)).recetas);
    }
  }

  const vistos = new Map<string, string>();
  for (const r of recetas) {
    if (vistos.has(r.id)) throw new Error(`id de receta duplicado: "${r.id}"`);
    vistos.set(r.id, r.nombre);
  }
  return recetas;
}

function main() {
  const mapeoPropuesto = leer(RUTA_MAPEO_PROPUESTO);
  const recetas = cargarRecetario();
  const ingredientesLista = leer(RUTA_INGREDIENTES).ingredientes;
  const ingredientes: Record<string, any> = {};
  for (const ing of ingredientesLista) ingredientes[ing.id] = ing;

  // Los ensamblajes se agrupan por la receta de la que comen. Se validan
  // aquí: uno que apunte a una receta que ya no existe es un hueco que el
  // motor intentaría montar sobre nada.
  const ensamblajes: Record<string, any[]> = {};
  if (fs.existsSync(RUTA_ENSAMBLAJES)) {
    const idsReceta = new Set(recetas.map((r: any) => r.id));
    for (const e of leer(RUTA_ENSAMBLAJES).ensamblajes) {
      if (!idsReceta.has(e.desde)) throw new Error(`ensamblaje "${e.id}": la receta "${e.desde}" no existe`);
      for (const ing of e.ingredientes) {
        if (!ingredientes[ing.canonico]) throw new Error(`ensamblaje "${e.id}": "${ing.canonico}" no está en el vocabulario`);
      }
      (ensamblajes[e.desde] ??= []).push(e);
    }
  }

  // Los ingredientes de los ensamblajes también necesitan producto elegido.
  const elegido = elegirSkus(mapeoPropuesto, [...recetas, ...Object.values(ensamblajes).flat()], ingredientes);

  // Solo lo que el motor necesita: nada de los 4.606 productos del catálogo.
  const skus: Record<string, Sku> = {};
  for (const [canonico, sku] of Object.entries(elegido)) {
    const c = mapeoPropuesto[canonico].candidatos.find((x: Sku) => x.sku === sku);
    if (!c) throw new Error(`el sku ${sku} de "${canonico}" ya no está entre sus candidatos`);
    skus[canonico] = {
      sku: c.sku, nombre: c.nombre, contenido: c.contenido, unidad: c.unidad,
      precio: c.precio, precio_kg_l_ud: c.precio_kg_l_ud, packaging: c.packaging,
      unidades_pack: c.unidades_pack, peso_variable: c.peso_variable,
      departamento: c.departamento, subfamilia: c.subfamilia,
    };
  }

  const fallos = guardiaDeCoherencia(skus, ingredientes);
  if (fallos.length) {
    console.error('\nEl producto elegido contradice lo que declara el ingrediente canónico:\n');
    for (const f of fallos) console.error(`  ✗ ${f}`);
    console.error('\nCorrige la búsqueda en mapear.js o el vocabulario. No genero nada así:');
    console.error('los filtros dietéticos de la app dependen de que esto cuadre.\n');
    process.exit(1);
  }

  const datos: DatosMotor & { generadoEn: string; nota: string; ensamblajes: Record<string, any[]> } = {
    generadoEn: '2026-07-28',
    nota:
      'Generado por catalogo/generar.ts. Es todo lo que el motor (src/motor) necesita para montar ' +
      'cualquier semana en el cliente: recetas, tabla de ingredientes canónicos y el producto real ' +
      'elegido para cada uno. Los precios son del catálogo de Mercadona (almacén mad3).',
    recetas,
    ingredientes,
    skus,
    ensamblajes,
  };

  // COHERENCIA ANTES DE ESCRIBIR NADA. Todas las reglas vigentes contra
  // TODAS las recetas, vengan del lote que vengan. Esto existe porque la
  // regla de la sal cambió y se aplicó solo a los lotes nuevos: la mitad del
  // recetario se quedó atrás semanas y ninguna métrica lo detectó, porque la
  // sal no mueve dinero. Cambiar una regla en catalogo/reglas.ts rompe el
  // build para toda receta que no la cumpla, sea de hoy o del piloto.
  const coherencia = revisarCoherencia(datos);
  const incoherencias = coherencia.filter((f) => f.nivel === 'error');
  if (incoherencias.length) {
    console.error(`\nEl recetario no cumple las reglas vigentes (${incoherencias.length} incoherencias).`);
    informar(coherencia, false);
    console.error('Corrige las recetas o la regla en catalogo/reglas.ts. No genero nada así.\n');
    process.exit(1);
  }

  fs.writeFileSync(RUTA_SALIDA, JSON.stringify(datos, null, 2), 'utf8');

  const muestra: Record<string, unknown> = {
    nota: 'Generado por catalogo/generar.ts para la portada. No editar a mano.',
    capturadoEn: datos.generadoEn,
    productos: MUESTRA_PORTADA.map((canonico) => {
      const sku = skus[canonico];
      if (!sku) throw new Error(`la muestra de portada pide "${canonico}" y no está mapeado`);
      return {
        nombre: sku.nombre,
        formato: `${sku.packaging ?? 'Unidad'} ${formatearContenido(sku.contenido, sku.unidad)}`,
        precio: sku.precio,
      };
    }),
  };
  /**
   * El ticket de la portada, generado. Tres líneas y "y N productos más": la
   * densidad importa porque esa pantalla solo tiene que conseguir un toque, y
   * con cinco líneas era más letra pequeña de la que nadie lee de pie.
   */
  const semana = generarSemana({
    datos: datos as DatosMotor,
    N: EJEMPLO.N,
    numHuecos: 14,
    variedad: 'normal',
    proteina: 'normal',
    presupuesto: EJEMPLO.presupuesto,
    semanaNumero: 1,
  });
  const compradas = semana.carrito.lineas
    .filter((l) => !l.esDespensa && l.compras > 0)
    .sort((a, b) => b.carritoCoste - a.carritoCoste);
  const destacadas = compradas.slice(0, EJEMPLO.lineas);
  const resto = compradas.slice(EJEMPLO.lineas);
  muestra.ticket = {
    personas: EJEMPLO.N,
    total: semana.carrito.totalCarrito,
    comidas: semana.huecos.filter((h) => h.receta).length,
    lineas: destacadas.map((l) => ({
      nombre: l.nombre,
      formato: `${l.packaging ?? 'Unidad'} ${formatearContenido(l.contenidoEnvase, l.unidad)}`,
      precio: Number(l.carritoCoste.toFixed(2)),
    })),
    restoProductos: resto.length,
    restoImporte: Number(resto.reduce((a, l) => a + l.carritoCoste, 0).toFixed(2)),
  };

  fs.writeFileSync(RUTA_MUESTRA, JSON.stringify(muestra, null, 2), 'utf8');

  const avisos = coherencia.filter((f) => f.nivel === 'aviso');
  const kb = (fs.statSync(RUTA_SALIDA).size / 1024).toFixed(1);
  if (avisos.length) console.log(`  ${avisos.length} avisos de coherencia (no bloquean): catalogo/coherencia.ts`);
  const numEnsamblajes = Object.values(ensamblajes).flat().length;
  console.log(`Escrito ${RUTA_SALIDA} (${kb} KB)`);
  console.log(`  ${recetas.length} recetas · ${numEnsamblajes} ensamblajes · ${Object.keys(ingredientes).length} ingredientes canónicos · ${Object.keys(skus).length} SKU elegidos`);
}

main();
