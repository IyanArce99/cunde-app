/**
 * EL PROMPT DE UNA FOTO DE PLATO · UN SOLO SITIO
 *
 * Lo usan dos cosas: `prompts-fotos.js`, que escribe el .md para pegar a mano,
 * y `generar-fotos.js`, que llama a la API. Vivía duplicado y eso es
 * exactamente cómo acaban dos tandas de fotos que no casan entre sí: cambias el
 * estilo en un sitio, sigues generando por el otro, y a las 20 fotos descubres
 * que hay dos fondos distintos.
 */

/**
 * EL BLOQUE DE ESTILO · NO CAMBIA ENTRE FOTOS
 *
 * Cenital y plato centrado porque es lo único que se puede repetir 151 veces
 * sin que se note la mano: cualquier ángulo en escorzo obliga a decidir altura
 * y rotación en cada foto, y ahí es donde se desalinean.
 *
 * El fondo es el papel de la app (#EFEDE6). Medido sobre las 20 primeras, los
 * fondos salen entre #E2DCD0 y #F3EEE2 — no clavan el color, pero da igual:
 * `.foto-plato` lleva un borde de 1 px, así que la foto va enmarcada y no
 * sangra contra el fondo. Lo que importa es que se parezcan ENTRE ELLAS, y ahí
 * la dispersión medida es de 5 a 30 puntos RGB, invisible a 328 px.
 *
 * Nada de atrezo. La primera foto que hubo —encimera de granito, sartén al
 * fondo, trapo, tenedor— es preciosa de una en una y un desastre repetida: el
 * atrezo cambia en cada generación y es lo primero que delata que están hechas
 * por máquina.
 *
 * «Una sola imagen» y «un único plato» están dichos dos veces y a propósito:
 * pidiendo varios platos seguidos, el modelo compone un collage.
 */
export const ESTILO = [
  'UNA SOLA IMAGEN de UN ÚNICO plato. No es un collage, no es una cuadrícula, no hay varios platos.',
  'Fotografía cenital (90°, directamente desde arriba) de comida casera española.',
  'Plato llano blanco, liso, sin cenefa ni logotipo, perfectamente centrado en el encuadre y ocupando cerca del 85% del ancho.',
  /* Tres frases para el fondo y no una. Con «fondo liso de color papel cálido
     #EFEDE6» la API devolvió #E1CFB6: un beige dorado, a 57 puntos RGB del
     resto del conjunto, cuando la dispersión entre las 20 primeras era de 5 a
     30 y ya resultaba invisible. Lo que se le escapaba era «cálido» —lo leyó
     como tinte dorado— y el viñeteado de los bordes. */
  'FONDO: color plano y uniforme #EFEDE6, un beige papel muy claro, casi blanco roto, NADA dorado ni tostado ni crema oscuro.',
  'El fondo tiene exactamente el mismo tono en las cuatro esquinas: sin viñeteado, sin degradado, sin zonas más oscuras.',
  'Sin textura de madera, mármol, granito, lino ni mantel.',
  'Sin cubiertos, sin vasos, sin servilletas, sin tablas, sin ingredientes sueltos alrededor, sin manos, sin texto.',
  'Luz plana y difusa, acabado mate: sin brillo de estudio, sin reflejos especulares en la salsa, sin contraluz.',
  'Sombra bajo el plato apenas insinuada, muy corta y muy suave.',
  /* «Sin decoración» no bastaba: puso rodajas de limón de adorno en el pollo al
     limón. El limón está en la receta, así que la regla tiene que distinguir
     entre ingrediente cocinado y guarnición puesta encima para la foto. */
  'Solo los ingredientes del guiso, ya cocinados y mezclados. Nada colocado encima para decorar: ni rodajas de limón, ni ramitas de hierbas, ni hojas, ni brotes, ni virutas.',
  'Ración normal de casa, no de restaurante: sin emplatado de pinzas, sin quenelle.',
  'Aspecto de comida recién hecha en una cocina de casa, apetecible pero no retocada.',
  'Cuadrada 1:1, enfoque nítido en todo el plato.',
].join(' ');

/* Lo de despensa no se ve en la foto (sal, aceite, pimienta) o se ve como
   color, no como ingrediente. Nombrarlo hace que el generador dibuje un salero. */
const INVISIBLE = new Set(['sal', 'pimienta_negra', 'aceite_oliva', 'agua', 'vinagre', 'caldo_pastilla']);

const COMO_SE_SIRVE = {
  sarten: 'salteado en sartén, con su jugo',
  horno: 'asado al horno, con los bordes tostados',
  olla: 'guisado caldoso en un plato hondo',
  cruda: 'en frío, sin cocinar',
  hervido: 'cocido, escurrido',
};

/** Lo que de verdad se ve en el plato, de más a menos cantidad. */
export function loQueSeVe(receta, datos) {
  return receta.ingredientes
    .filter((i) => !INVISIBLE.has(i.canonico))
    .filter((i) => !datos.ingredientes[i.canonico]?.es_despensa || i.cantidad >= 3)
    .sort((a, b) => b.cantidad - a.cantidad)
    .slice(0, 5)
    .map((i) => datos.ingredientes[i.canonico]?.nombre?.toLowerCase() ?? i.canonico.replace(/_/g, ' '));
}

/** El prompt completo de una receta. Lo único que cambia es la primera frase. */
export function promptDe(receta, datos) {
  const visible = loQueSeVe(receta, datos);
  const servido = COMO_SE_SIRVE[receta.tecnica] ?? 'servido en su plato';
  return `${receta.nombre}: ${visible.join(', ')}, ${servido}. ${ESTILO}`;
}

/**
 * Las que faltan, en orden de encargo.
 *
 * La verdad de «ya hecha» es el WebP publicado o el bruto sin procesar: si está
 * en cualquiera de los dos, no hay que volver a generarla.
 */
export function pendientes(datos, orden, yaHechas) {
  const rango = new Map(orden.map((id, i) => [id, i]));
  return datos.recetas
    .filter((r) => !yaHechas.has(r.id))
    .sort((a, b) => (rango.get(a.id) ?? 9999) - (rango.get(b.id) ?? 9999));
}
