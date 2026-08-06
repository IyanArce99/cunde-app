#!/usr/bin/env node
/**
 * Propone, para cada ingrediente canónico de docs/recetas-piloto.json, qué
 * productos del catálogo real podrían corresponderle. NO decide cuál usar
 * — eso lo revisa un humano sobre catalogo/mapeo-propuesto.json.
 *
 * Uso: node mapear.js
 *
 * Cómo busca: por palabras completas (no substring — "sal" no debe
 * encontrar "salchicha" ni "ensalada"), sin acentos ni mayúsculas, con una
 * lista de palabras exigidas y otra de palabras a evitar por ingrediente
 * (ver TABLA_BUSQUEDA más abajo). La tabla es la parte que más veces habrá
 * que retocar si algo no encaja: está pensada para poder ajustarse rápido.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RUTA_CATALOGO = path.join(__dirname, 'catalogo_mercadona_mad3_2026-07-28.json');
const RUTA_INGREDIENTES = path.join(__dirname, '..', 'docs', 'ingredientes-canonicos.json');
const RUTA_SALIDA = path.join(__dirname, 'mapeo-propuesto.json');

function normalizar(texto) {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, ''); // quita acentos
}

function palabras(texto) {
  return new Set(normalizar(texto).split(/[^a-z0-9]+/).filter(Boolean));
}

/**
 * El español pluraliza añadiendo "s" o "es" (verdura/verduras,
 * puerro/puerros, limon/limones). La tabla de búsqueda solo escribe la
 * forma singular; aquí se generan las formas plurales para no perder
 * productos reales solo por eso (pasó con puerro, huevo, verdura,
 * contramuslo, spaghetti en la primera pasada).
 */
function formas(base) {
  return new Set([base, base + 's', base + 'es']);
}

/**
 * requiere: TODAS estas palabras (o alguno de los grupos, si es un array
 *           de arrays, cuenta como "cualquiera de este grupo") deben
 *           aparecer como palabra completa en el nombre del producto
 *           (en singular o plural).
 * evita:    si aparece cualquiera de estas palabras (singular o plural),
 *           se descarta.
 * departamentos: si se da, solo se buscan candidatos en estos departamentos
 *           (reduce falsos positivos de palabras que se repiten en varias
 *           secciones, p. ej. "aceite" aparece también en cosmética, "sal"
 *           en "bajo en sal").
 *
 * Tabla ajustada tras revisar contra el catálogo real (no adivinada):
 * Mercadona llama "Spaghetti" a los espaguetis (no "espagueti"), junta
 * ajo y cebolla en una sola subfamilia de Fruta y verdura, y casi toda
 * su merluza es congelada ("Lomos... del Cabo"), no fresca.
 */
const TABLA_BUSQUEDA = {
  pechuga_pollo: { requiere: ['pechuga', 'pollo'], evita: ['pavo', 'loncha', 'marinad', 'marinada', 'marinadas', 'empanad', 'empanada', 'empanadas'], departamentos: ['Carne'] },
  limon: { requiere: ['limon'], evita: ['zumo', 'refresco', 'aroma', 'te', 'infusion'], departamentos: ['Fruta y verdura'] },
  ajo: { requiere: ['ajo'], evita: ['sal', 'polvo', 'granulado', 'aceite', 'patatas', 'picada', 'negro', 'perejil', 'tierno'], departamentos: ['Fruta y verdura'] },
  aceite_oliva: { requiere: [['aceite'], ['oliva']], evita: ['girasol', 'coco', 'tomate', 'frito', 'salsa', 'mayonesa', 'alioli', 'vinagreta'], departamentos: ['Aceite, especias y salsas'] },
  sal: { requiere: ['sal'], evita: ['salchicha', 'salsa', 'ensalada', 'salmon', 'salvado', 'ajo', 'apio', 'cebolla', 'bicarbonato', 'frutas'], departamentos: ['Aceite, especias y salsas'] },
  pimienta_negra: { requiere: ['pimienta', 'negra'] },
  lenteja_pardina: { requiere: ['lenteja'], evita: ['lata', 'conserva', 'cocida', 'pasta', 'fusilli', 'jardinera', 'riojana', 'papilla', 'snack'], departamentos: ['Arroz, legumbres y pasta'] },
  cebolla: { requiere: ['cebolla'], evita: ['frita', 'sal', 'polvo', 'encurtido', 'sopa', 'caramelizada', 'salteado'], departamentos: ['Fruta y verdura'] },
  zanahoria: { requiere: ['zanahoria'], evita: ['zumo', 'crema', 'papilla'], departamentos: ['Fruta y verdura'] },
  puerro: { requiere: ['puerro'], evita: ['crema', 'sopa'] },
  patata: { requiere: ['patata'], evita: ['frita', 'chips', 'snack', 'pure', 'congelada', 'gofre'], departamentos: ['Fruta y verdura'] },
  pimenton_dulce: { requiere: ['pimenton'], evita: ['picante'] },
  laurel: { requiere: ['laurel'] },
  lomo_merluza: { requiere: ['merluza', 'lomo'] }, // casi todo el catálogo es congelado — es lo real, no un fallo
  espagueti: { requiere: ['spaghetti'], evita: ['huevo', 'carbonara', 'integral'] }, // Mercadona no usa "espagueti"
  atun_lata: { requiere: ['atun'], evita: ['fresco', 'lomo', 'tarrina', 'gato', 'perro'], departamentos: ['Conservas, caldos y cremas'] },
  tomate_triturado: { requiere: ['tomate', 'triturado'] },
  queso_rallado: { requiere: ['queso', 'rallado'] },
  huevo: { requiere: ['huevo'], evita: ['clara', 'liquida', 'liquido', 'codorniz', 'cocid', 'sorpresa'], departamentos: ['Huevos, leche y mantequilla'] },
  lechuga: { requiere: ['lechuga'], evita: ['ensalada'] },
  tomate: { requiere: ['tomate'], evita: ['triturado', 'frito', 'kepchup', 'ketchup', 'zumo', 'salsa', 'deshidratad', 'seco', 'rallado'], departamentos: ['Fruta y verdura'] },
  // Sin 'rellena': el optimizador elegía "Aceitunas verdes rellenas de
  // anchoa" — un producto con pescado dentro para un canónico declarado
  // vegetal. El filtro Vegano y el de Pescado lo daban por bueno.
  aceituna_verde: { requiere: ['aceituna', 'verde'], evita: ['rellena', 'anchoa', 'pimiento', 'gazpacha'] },
  vinagre: { requiere: ['vinagre'], evita: ['balsamico', 'balsamica', 'reduccion', 'modena', 'jerez'], departamentos: ['Aceite, especias y salsas'] },
  contramuslo_pollo: { requiere: ['contramuslo', 'pollo'], evita: ['pavo'] },
  arroz_redondo: { requiere: ['arroz', 'redondo'], evita: ['cocido'], departamentos: ['Arroz, legumbres y pasta'] },
  caldo_verduras: { requiere: ['caldo', 'verdura'], evita: ['pastilla', 'concentrado'] },
  pimiento_rojo: { requiere: ['pimiento', 'rojo'], evita: ['relleno', 'asado', 'lata', 'frasco'] },
  guisante: { requiere: ['guisante'], evita: ['zanahoria'] },
  calabaza: { requiere: ['calabaza'], evita: ['pipas', 'semilla', 'crema'], departamentos: ['Fruta y verdura'] },
  nata_cocinar: { requiere: ['nata', 'cocinar'] },
  garbanzo_cocido: { requiere: ['garbanzo', 'cocido'], evita: ['harina', 'riojana'] },
  espinaca: { requiere: ['espinaca'], evita: ['pasta', 'pizza', 'empanadilla', 'smoothie', 'lasaña', 'burger', 'hamburguesa', 'crema'] },
  calabacin: { requiere: ['calabacin'], evita: ['crema'], departamentos: ['Fruta y verdura'] },
  pimiento_verde: { requiere: ['pimiento', 'verde'], evita: ['relleno', 'asado', 'lata', 'frasco'] },
  champinon: { requiere: ['champinon'], evita: ['crema', 'sopa', 'pate', 'salteado', 'pizza'] },

  // --- Ampliación para llegar a 50 recetas (fase 0) ------------------------
  // Los departamentos salen de sondear el catálogo, no de suponer: el tofu
  // de Mercadona vive en "Pizzas y platos preparados > Hummus y otros", y
  // las bebidas vegetales en "Huevos, leche y mantequilla".

  // Especias y aderezos
  vinagre_manzana: { requiere: ['vinagre', 'manzana'], departamentos: ['Aceite, especias y salsas'] },
  comino: { requiere: ['comino'], departamentos: ['Aceite, especias y salsas'] },
  oregano: { requiere: ['oregano'], departamentos: ['Aceite, especias y salsas'] },
  curcuma: { requiere: ['curcuma'], evita: ['infusion'], departamentos: ['Aceite, especias y salsas'] },
  curry: { requiere: ['curry'], evita: ['salsa', 'tikka'], departamentos: ['Aceite, especias y salsas'] },
  perejil: { requiere: ['perejil'], evita: ['ajo', 'alioli', 'aliño', 'picada'], departamentos: ['Aceite, especias y salsas'] },
  tomillo: { requiere: ['tomillo'], evita: ['infusion', 'piquitos'], departamentos: ['Aceite, especias y salsas'] },
  romero: { requiere: ['romero'], evita: ['burger', 'aceite', 'alcohol'], departamentos: ['Aceite, especias y salsas'] },
  colorante_alimentario: { requiere: ['colorante'], evita: ['crema', 'rostro'], departamentos: ['Aceite, especias y salsas'] },

  // Verduras
  berenjena: { requiere: ['berenjena'], evita: ['almagro', 'parmigiana', 'aliñada'], departamentos: ['Fruta y verdura'] },
  acelga: { requiere: ['acelga'] },
  judia_verde: { requiere: ['judia', 'verde'], evita: ['salteado'] },
  brocoli: { requiere: ['brocoli'], evita: ['coliflor', 'zanahoria', 'crema'] },
  coliflor: { requiere: ['coliflor'], evita: ['brocoli', 'migas', 'crema'] },
  repollo: { requiere: ['repollo'], departamentos: ['Fruta y verdura'] },
  pepino: { requiere: ['pepino'], evita: ['encurtido', 'agridulce'], departamentos: ['Fruta y verdura'] },
  apio: { requiere: ['apio'], evita: ['sal'], departamentos: ['Fruta y verdura'] },
  esparrago_verde: { requiere: ['esparrago', 'verde'], evita: ['salteado', 'gambas'] },
  alcachofa: { requiere: ['alcachofa'], evita: ['baby'] },
  seta: { requiere: ['seta'], evita: ['salsa', 'risotto', 'crema', 'salteado', 'champinones', 'arroz', 'secreto'], departamentos: ['Fruta y verdura', 'Congelados'] },
  maiz_dulce: { requiere: ['maiz', 'dulce'], evita: ['mazorca'] },

  // Salsas y caldos
  tomate_frito: { requiere: ['tomate', 'frito'], evita: ['artesana', 'aceite'], departamentos: ['Aceite, especias y salsas'] },
  caldo_pollo: { requiere: ['caldo', 'pollo'], evita: ['pastilla', 'concentrado', 'casero'] },

  // Legumbres y proteína vegetal
  lenteja_cocida: { requiere: ['lenteja', 'cocida'], evita: ['riojana', 'jardinera'], departamentos: ['Arroz, legumbres y pasta'] },
  garbanzo_seco: { requiere: ['garbanzo'], evita: ['cocido', 'harina', 'hummus'], departamentos: ['Arroz, legumbres y pasta'] },
  alubia_blanca_cocida: { requiere: ['alubia', 'cocida', 'blanca'], departamentos: ['Arroz, legumbres y pasta'] },
  alubia_pinta_cocida: { requiere: ['alubia', 'cocida', 'pinta'], departamentos: ['Arroz, legumbres y pasta'] },
  alubia_roja_cocida: { requiere: ['alubia', 'cocida', 'roja'], departamentos: ['Arroz, legumbres y pasta'] },
  alubia_blanca_seca: { requiere: ['alubia', 'blanca'], evita: ['cocida'], departamentos: ['Arroz, legumbres y pasta'] },
  soja_texturizada: { requiere: ['soja', 'texturizada'] },
  tofu: { requiere: ['tofu'] },
  hummus: { requiere: ['hummus'], evita: ['piquillo'] },

  // Cereales
  arroz_largo: { requiere: ['arroz', 'largo'], evita: ['integral', 'cocido'], departamentos: ['Arroz, legumbres y pasta'] },
  arroz_integral: { requiere: ['arroz', 'integral'], evita: ['cocido'], departamentos: ['Arroz, legumbres y pasta'] },
  quinoa: { requiere: ['quinoa'], evita: ['muesli', 'cocida'], departamentos: ['Arroz, legumbres y pasta'] },
  harina_maiz: { requiere: ['harina', 'maiz'] },
  macarron: { requiere: ['macarron'], evita: ['integral', 'gratinado', 'boloñesa'], departamentos: ['Arroz, legumbres y pasta'] },
  fideo: { requiere: ['fideo'], evita: ['oriental', 'gamba', 'arroz'], departamentos: ['Arroz, legumbres y pasta'] },
  pan: { requiere: ['pan'], evita: ['molde', 'rallado', 'tostado', 'hamburguesa', 'perrito', 'pizza'], departamentos: ['Panadería y pastelería'] },

  // Bebidas vegetales
  bebida_soja: { requiere: ['bebida', 'soja'], evita: ['vainilla', 'chocolate', 'sabor'], departamentos: ['Huevos, leche y mantequilla'] },
  bebida_arroz: { requiere: ['bebida', 'arroz'], departamentos: ['Huevos, leche y mantequilla'] },

  // Lácteos
  leche_semi: { requiere: ['leche', 'semidesnatada'], evita: ['sin lactosa', 'condensada', 'polvo'], departamentos: ['Huevos, leche y mantequilla'] },
  yogur_natural: { requiere: ['yogur', 'natural'], evita: ['edulcorado', 'azucar', 'sabor', 'griego'], departamentos: ['Postres y yogures'] },
  queso_fresco: { requiere: ['queso', 'fresco'], evita: ['crema', 'cottage', 'desnatado', 'tarrina'], departamentos: ['Charcutería y quesos'] },

  // Carne barata
  muslo_pollo: { requiere: ['muslo', 'pollo'], evita: ['contramuslo', 'pavo'], departamentos: ['Carne'] },
  jamoncito_pollo: { requiere: ['jamoncito', 'pollo'], evita: ['maiz'], departamentos: ['Carne'] },
  pollo_troceado: { requiere: ['pollo', 'troceado'], departamentos: ['Carne'] },
  carne_picada_cerdo: { requiere: ['picada', 'cerdo'], evita: ['vacuno'], departamentos: ['Carne'] },
  carne_picada_mixta: { requiere: ['picada', 'vacuno', 'cerdo'], departamentos: ['Carne'] },
  carne_picada_vacuno: { requiere: ['picada', 'vacuno'], evita: ['cerdo'], departamentos: ['Carne'] },
  lomo_cerdo: { requiere: ['lomo', 'cerdo'], evita: ['adobado', 'adobada', 'iberico', 'embuchado', 'fiambre', 'empanado', 'empanada', 'marinado', 'marinada'], departamentos: ['Carne'] },
  costilla_cerdo: { requiere: ['costilla', 'cerdo'], evita: ['adobada', 'iberico', 'barbacoa'], departamentos: ['Carne'] },
  panceta: { requiere: ['panceta'], evita: ['adobada', 'torrezno', 'ahumada'], departamentos: ['Carne'] },
  bacon: { requiere: ['bacon'], evita: ['flauta', 'pincho', 'cono', 'queso', 'pizza'], departamentos: ['Charcutería y quesos', 'Carne'] },
  chorizo: { requiere: ['chorizo'], evita: ['loncha', 'aperitivo', 'pamplona', 'picante', 'iberico', 'sarta', 'tortilla', 'pizza'], departamentos: ['Carne', 'Charcutería y quesos'] },
  salchicha_fresca: { requiere: ['longaniza'], evita: ['loncha'], departamentos: ['Carne'] },

  // Pescado y marisco barato
  sardina_fresca: { requiere: ['sardina'], evita: ['ahumada', 'lata', 'aceite'], departamentos: ['Marisco y pescado'] },
  bacalao_congelado: { requiere: ['bacalao'], evita: ['migas', 'piquillo', 'buñuelo', 'croqueta', 'ahumado', 'ahumada'] },
  caballa_lata: { requiere: ['caballa'], evita: ['melva'], departamentos: ['Conservas, caldos y cremas'] },
  mejillon_lata: { requiere: ['mejillon', 'escabeche'], departamentos: ['Conservas, caldos y cremas'] },
  mejillon_congelado: { requiere: ['mejillon', 'cocido'], evita: ['escabeche', 'tigre', 'relleno'], departamentos: ['Congelados', 'Marisco y pescado'] },
  calamar_congelado: { requiere: ['calamar'], evita: ['salsa', 'tinta', 'anilla', 'rebozad', 'romana'] },
  gamba_congelada: { requiere: ['gamba'], evita: ['fideo', 'salteado', 'oriental', 'cocida'] },

  // Frutos secos (para que el filtro "sin frutos secos" tenga sentido)
  almendra: { requiere: ['almendra'], evita: ['chocolate', 'turron', 'bebida', 'crema', 'leche', 'rosegon', 'pasta', 'galleta'], departamentos: ['Aperitivos'] },
  cacahuete: { requiere: ['cacahuete'], evita: ['chocolate', 'crema', 'calabaza'], departamentos: ['Aperitivos'] },
};

function tieneAlguna(tokensProducto, palabraBase) {
  const grupo = formas(normalizar(palabraBase));
  for (const t of tokensProducto) if (grupo.has(t)) return true;
  return false;
}

function coincideRequisito(tokensProducto, requisito) {
  // requisito puede ser ['a','b'] (las dos) o [['a'],['b']] (una de cada grupo)
  return requisito.every((r) =>
    Array.isArray(r) ? r.some((alt) => tieneAlguna(tokensProducto, alt)) : tieneAlguna(tokensProducto, r)
  );
}

function buscarCandidatos(catalogo, config) {
  const requisito = config.requiere.map((r) => (Array.isArray(r) ? r.map(normalizar) : normalizar(r)));
  const evita = (config.evita || []).map(normalizar);

  return catalogo.filter((p) => {
    if (p.precio === null || p.contenido === null) return false; // sin contenido no se puede calcular nada
    if (config.departamentos && !config.departamentos.includes(p.departamento)) return false;
    const tokens = palabras(p.nombre);
    if (!coincideRequisito(tokens, requisito)) return false;
    if (evita.some((e) => tieneAlguna(tokens, e))) return false;
    return true;
  });
}

/**
 * Deliberadamente NO se usa el `precio_referencia` que trae el catálogo de
 * Mercadona: por ley, el precio por unidad de un producto envasado en
 * líquido (atún, champiñón o garbanzo en conserva) se calcula sobre el
 * peso ESCURRIDO, no sobre el `contenido` bruto del envase — y en huevos,
 * Mercadona lo da por DOCENA aunque el envase sea de 24. Ese campo es
 * correcto para lo que la ley obliga a mostrar en el lineal, pero no es
 * consistente con `contenido` (que es sobre lo que se calculan los
 * redondeos de compra), y usarlo tal cual generaba coste de consumo mayor
 * que coste de carrito — desperdicio negativo, imposible. Se recalcula
 * siempre precio/contenido para que las dos cifras hablen de lo mismo.
 */
function precioReferenciaOMejorEsfuerzo(p) {
  if (p.contenido) return +(p.precio / p.contenido).toFixed(3);
  return null;
}

function mediaYDesviacion(valores) {
  const n = valores.length;
  const media = valores.reduce((a, b) => a + b, 0) / n;
  const varianza = valores.reduce((a, b) => a + (b - media) ** 2, 0) / n;
  return { media, desviacion: Math.sqrt(varianza) };
}

function clasificarConfianza(candidatos) {
  if (candidatos.length === 0) return 'revisar'; // "sin nada válido" se deriva luego de candidatos.length===0

  // €/kg y €/ud no son comparables entre sí (p. ej. "Cebollas tiernas" se
  // vende por manojo/ud, el resto por kg) — mezclarlos en la misma varianza
  // producía "revisar" por un artefacto de unidades, no por ambigüedad real.
  // Se compara solo dentro del grupo de unidad más frecuente.
  const porUnidad = new Map();
  for (const c of candidatos) {
    if (!porUnidad.has(c.unidad)) porUnidad.set(c.unidad, []);
    porUnidad.get(c.unidad).push(c);
  }
  const grupoMayoritario = [...porUnidad.values()].sort((a, b) => b.length - a.length)[0];

  const refs = grupoMayoritario.map((c) => c.precio_kg_l_ud).filter((v) => v !== null);
  if (refs.length < 2) return candidatos.length <= 3 ? 'alta' : 'media';
  const { media, desviacion } = mediaYDesviacion(refs);
  const coefVariacion = media > 0 ? desviacion / media : 0;
  if (coefVariacion < 0.25 && candidatos.length <= 6) return 'alta';
  if (coefVariacion < 0.6) return 'media';
  return 'revisar';
}

function main() {
  const catalogo = JSON.parse(fs.readFileSync(RUTA_CATALOGO, 'utf8'));

  // La fuente de verdad es el VOCABULARIO, no las recetas: hay que mapear
  // todo lo que las recetas futuras van a poder usar, no solo lo que se usa
  // hoy. Si un canónico no encuentra producto en Mercadona, sale de aquí
  // antes de que nadie escriba una receta con él.
  const vocabulario = JSON.parse(fs.readFileSync(RUTA_INGREDIENTES, 'utf8')).ingredientes;
  const canonicos = new Set(vocabulario.map((i) => i.id));

  const faltanEnTabla = [...canonicos].filter((c) => !TABLA_BUSQUEDA[c]);
  if (faltanEnTabla.length) {
    console.error('Faltan en TABLA_BUSQUEDA:', faltanEnTabla);
    process.exit(1);
  }
  const sobranEnTabla = Object.keys(TABLA_BUSQUEDA).filter((c) => !canonicos.has(c));
  if (sobranEnTabla.length) console.warn('En TABLA_BUSQUEDA pero no en el vocabulario:', sobranEnTabla);

  const mapeo = {};
  const resumen = { alta: 0, media: 0, revisar: 0, sinCandidatos: 0 };

  for (const canonico of [...canonicos].sort()) {
    const config = TABLA_BUSQUEDA[canonico];
    const encontrados = buscarCandidatos(catalogo, config).map((p) => ({
      sku: p.sku,
      nombre: p.nombre,
      contenido: p.contenido,
      unidad: p.unidad_contenido,
      precio: p.precio,
      precio_kg_l_ud: precioReferenciaOMejorEsfuerzo(p),
      packaging: p.packaging,
      es_pack: p.es_pack,
      unidades_pack: p.unidades_pack,
      peso_variable: p.peso_variable,
      departamento: p.departamento,
      subfamilia: p.subfamilia,
    }));

    // orden: primero la unidad más habitual entre los candidatos (€/kg y
    // €/ud no se pueden comparar — "Cebollas tiernas" se vende por manojo,
    // el resto de cebollas por kg; sin esto la de manojo salía primera solo
    // por tener un número más pequeño, no por ser la opción más razonable),
    // dentro de ese grupo los que no son de peso variable (precio más
    // predecible), y por último precio de referencia ascendente.
    const conteoUnidad = new Map();
    for (const c of encontrados) conteoUnidad.set(c.unidad, (conteoUnidad.get(c.unidad) || 0) + 1);
    const unidadHabitual = [...conteoUnidad.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];

    encontrados.sort((a, b) => {
      const esHabitualA = a.unidad === unidadHabitual;
      const esHabitualB = b.unidad === unidadHabitual;
      if (esHabitualA !== esHabitualB) return esHabitualA ? -1 : 1;
      if (a.peso_variable !== b.peso_variable) return a.peso_variable ? 1 : -1;
      const pa = a.precio_kg_l_ud ?? Infinity;
      const pb = b.precio_kg_l_ud ?? Infinity;
      return pa - pb;
    });

    const candidatos = encontrados.slice(0, 10);
    const confianza = clasificarConfianza(candidatos);

    mapeo[canonico] = { confianza, total_candidatos_encontrados: encontrados.length, candidatos };

    resumen[confianza]++;
    if (candidatos.length === 0) resumen.sinCandidatos++;
  }

  fs.writeFileSync(RUTA_SALIDA, JSON.stringify(mapeo, null, 2), 'utf8');

  console.log(`\n${canonicos.size} ingredientes canónicos procesados.\n`);
  console.log(`  alta:     ${resumen.alta}`);
  console.log(`  media:    ${resumen.media}`);
  console.log(`  revisar:  ${resumen.revisar}`);
  console.log(`  sin candidatos válidos en el catálogo: ${resumen.sinCandidatos}`);
  console.log(`\nGuardado en: ${RUTA_SALIDA}\n`);

  console.log('Detalle rápido (confianza — canónico — nº candidatos — mejor opción):');
  for (const canonico of Object.keys(mapeo).sort()) {
    const m = mapeo[canonico];
    const mejor = m.candidatos[0];
    console.log(
      `  [${m.confianza.padEnd(8)}] ${canonico.padEnd(20)} ${String(m.total_candidatos_encontrados).padStart(3)} cand. — ${mejor ? mejor.nombre + ' (' + mejor.precio + '€)' : '(ninguno)'}`
    );
  }
}

main();
