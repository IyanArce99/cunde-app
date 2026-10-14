import {
  acumularNecesidad, calcularCarrito, consumoPorRacion, necesidadDePostres, proteinaAnimal, proteinaDeEnsamblaje,
  proteinaPorRacion, totalesDeNecesidad,
} from './carrito.ts';
import type { Existencias } from './carrito.ts';
import { planDePostres } from './postres.ts';
import type { RacionPostre } from './postres.ts';
import { esFinDeSemanaBueno, planificarTanda, posicionesDeSemana, registroDe, rindeEfectivo } from './reparto.ts';
import { DIAS } from './tipos.ts';
import type {
  Alergeno, Carrito, DatosMotor, Ensamblaje, Hueco, IngredienteCanonico, Origen, Receta, Tanda,
} from './tipos.ts';

export type Variedad = 'poca' | 'normal' | 'mucha';
export type Esfuerzo = 'minimo' | 'normal' | 'libre';

/**
 * Cuántas recetas DISTINTAS puede usar la semana. Es el control con el que el
 * usuario compra variedad: cada receta nueva trae una proteína nueva que paga
 * en solitario un envase mínimo, así que más variedad es más caro. La
 * decisión es suya, no mía — por eso el precio de cada nivel se enseña en el
 * momento de elegir.
 */
export const RECETAS_POR_VARIEDAD: Record<Variedad, number> = { poca: 5, normal: 9, mucha: 12 };

/**
 * La variedad no es solo cuántas recetas distintas: es también cuánto se
 * repite lo cocinado. Quien paga por "mucha" está pagando por NO repetir, así
 * que ahí no hay sobras y cada comida se cocina. Quien elige "poca" quiere
 * ahorrar, y las sobras son justo lo que abarata.
 *
 * Fracción de los huecos de la semana que pueden llenarse con sobras.
 *
 * "Mucha" tuvo cero sobras y 14 recetas distintas, y era una definición
 * imposible: con 14 huecos y una tanda por receta hacen falta EXACTAMENTE 14
 * recetas distintas, así que el motor tenía que bajar hasta la cola barata
 * del recetario —platos de legumbre de 13 g— para completar la semana. Salía
 * a 56,80 €, no cabía en 51 € y era el único nivel que no llegaba a 55 g de
 * proteína. Con 12 recetas y dos huecos de sobra el motor puede parar antes
 * de llegar a la cola. Medido en catalogo/suelo-proteina.ts.
 */
export const FRACCION_SOBRAS_POR_VARIEDAD: Record<Variedad, number> = { poca: 1, normal: 0.3, mucha: 0.15 };

/** Cuántas veces puede cocinarse la misma receta en la semana. */
export const TANDAS_POR_RECETA_POR_VARIEDAD: Record<Variedad, number> = { poca: 3, normal: 2, mucha: 1 };

export const MINUTOS_POR_ESFUERZO: Record<Esfuerzo, number> = { minimo: 20, normal: 40, libre: Infinity };

// --- Pesos de la puntuación. En euros por hueco, para que sean comparables ---

/**
 * Lo que "vale" meter una receta nueva. Se aplica igual a todos los
 * candidatos nuevos, así que no decide CUÁL entra —eso lo decide el coste—,
 * solo si toca estrenar o repetir. Es deliberadamente mayor que cualquier
 * coste marginal posible: el techo de variedad ya es una restricción dura, y
 * si el usuario ha elegido variedad hay que gastársela entera. Con un bonus
 * pequeño (probé 2 €) el motor se quedaba en 6 recetas aunque el usuario
 * hubiera pedido "mucha", porque repetir siempre sale casi gratis.
 */
const BONUS_VARIEDAD = 100;

/**
 * CADA NIVEL MINIMIZA LO SUYO.
 *
 * Es la cuarta vez que el mismo error aparece con otra cara: minimizar €/kg
 * daba pollo congelado, minimizar carrito daba menús de patata, y minimizar
 * precio en el nivel "básica" daba la MISMA semana que "normal" —35,54 €,
 * 13,4% de perecedero— mientras el selector prometía "casi no tiras nada".
 * En el momento en que el desperdicio aparece en el copy deja de ser una
 * métrica interna: es la propuesta de valor de ese nivel, y hay que
 * optimizarla de verdad.
 *
 *   básica → minimiza PERECEDERO, sujeta a su suelo de proteína
 *   alta   → minimiza PRECIO, sujeta al suyo
 *   normal → minimiza CARRITO + PERECEDERO
 *
 * El criterio de "normal" no es un punto medio inventado: las dos son euros y
 * no hace falta ponderarlas. Lo que hace es contar dos veces el euro que se
 * tira —una porque lo pagaste y otra porque no te lo comiste—, que es
 * exactamente la definición de desperdicio de CLAUDE.md y la misma fórmula
 * con la que generar.ts ya elige entre formatos de un producto.
 *
 * `peso` entra en la puntuación hueco a hueco; `criterio` desempata entre los
 * arranques. Los dos hacen falta: sin el peso, el greedy ya ha tomado las
 * decisiones malas cuando llega el desempate.
 */
interface Objetivo {
  peso: number;
  criterio: (carrito: number, perecedero: number, consumo: number) => number;
}

/**
 * ═══ EL DESPERDICIO SE MIDE, YA NO SE APROXIMA ═══
 *
 * `normal` desempataba por `carrito + perecedero`. Esa suma es una PROXY del
 * desperdicio: cuenta lo que pagas y penaliza dos veces lo que se pudre, pero
 * no sabe cuánto de lo que compras acaba en un plato. Con ella, una semana que
 * gasta 8 € más y come 1 € menos puede ganar, porque nada mira la comida.
 *
 * Y se veía, con una persona y catorce huecos:
 *
 *     tope 45 €  →  carrito 39,05 €   come 16,86 €
 *     tope 65 €  →  carrito 46,86 €   come 15,74 €   ← 7,81 € más, 1,12 € menos
 *
 * O sea que subir el tope veinte euros te daba menos comida. El pase de holgura
 * no podía verlo: protege el consumo dentro de una construcción, pero
 * `BANDA_PRESUPUESTO.objetivo` entra en la puntuación hueco a hueco, así que
 * con más tope el greedy ya arranca en otro valle.
 *
 * Ahora `normal` desempata por `(carrito − consumo) + perecedero`: el
 * desperdicio de verdad, como lo define CLAUDE.md, más la penalización extra a
 * lo que además se pudre. Los otros dos niveles no cambian — `básica` vende no
 * tirar nada y `alta` vende que salga barato, y ésas son sus métricas.
 */
const OBJETIVO_POR_NIVEL: Record<NivelProteina, Objetivo> = {
  basica: { peso: 6, criterio: (_c, p) => p },
  normal: { peso: 2, criterio: (c, p, consumo) => (c - consumo) + p },
  alta: { peso: 0.5, criterio: (c) => c },
};

/**
 * El objetivo que se usa de verdad. `criterioUnico` es SOLO para calibrar.
 *
 * Unifica las dos mitades a la vez —el peso hueco a hueco y el desempate entre
 * arranques— porque por separado no responde nada: con solo el desempate
 * unificado, el greedy sigue recorriendo un valle distinto en cada nivel y las
 * cifras siguen sin ser comparables. Ver catalogo/_aud-monotonia.ts.
 */
function objetivoDe(peticion: PeticionSemana): Objetivo {
  if (peticion.criterioUnico === 'precio') return { peso: 0.5, criterio: (c) => c };
  if (peticion.criterioUnico === 'desperdicio') {
    return { peso: 2, criterio: (c, p, consumo) => (c - consumo) + p };
  }
  return OBJETIVO_POR_NIVEL[peticion.proteina ?? 'normal'];
}

/**
 * Cuánta proteína quiere el usuario, en gramos por persona y día. Es un
 * control suyo, igual que la variedad, y por la misma razón: proteína y
 * desperdicio son objetivos en CONFLICTO, no dos cosas que equilibrar mejor.
 * La proteína barata que aguanta es de lata o de legumbre; la fresca viene en
 * bandejas que no caben en su vida útil. Medido con 51 € para dos:
 *
 *   suelo  0 g -> perecedero  5,1% ·  9,8% · 14,7%
 *   suelo 60 g -> perecedero 19,4% · 19,0% · 21,6%
 *
 * Eso no lo arregla ningún recetario, así que no lo elijo yo. Los tres
 * números salen de catalogo/suelo-proteina.ts contra el recetario real, no de
 * una recomendación nutricional: son lo que de verdad se puede montar.
 */
export type NivelProteina = 'basica' | 'normal' | 'alta';

export const GRAMOS_POR_NIVEL: Record<NivelProteina, number> = {
  basica: 40,
  normal: 55,
  // 65 no es alcanzable con este recetario en NINGÚN nivel de variedad ni con
  // ningún presupuesto: el barrido se queda en 62 g con poca variedad y baja a
  // partir de ahí. 60 es el techo honesto. Ver catalogo/suelo-proteina.ts.
  alta: 60,
};

/**
 * Lo que se premia por acercarse al ritmo de proteína que hace falta. En
 * euros por hueco, para que sea comparable con el coste marginal: tiene que
 * poder ganarle a los 40 céntimos que separan un plato de garbanzo de uno de
 * pollo, que es exactamente la diferencia que producía semanas sin proteína.
 */
const PESO_PROTEINA = 30;

/** Y algo más por que esa proteína sea fresca y no de lata. */
const BONUS_PROTEINA_FRESCA = 1.5;

/** Sábado cena y domingo comida: ahí se gasta con más holgura. */
const HOLGURA_FIN_DE_SEMANA = 1.6;

/**
 * Topes por categoría, para que no salga una semana de patata con todo.
 * Dos platos por semana con el mismo almidón o la misma legumbre: con 14
 * huecos son 7 bases distintas como mínimo, que es lo que hace que la semana
 * se lea como variada aunque el motor esté optimizando dinero.
 */
const TOPE_POR_BASE = 2;

/**
 * Mínimo de huecos con carne o pescado NO en conserva. Es un mínimo deseado,
 * no una ley: bajo "vegetariano" no hay una sola receta que pueda cumplirlo, y
 * una restricción dura imposible de satisfacer no produce una semana peor,
 * produce CERO semana. Ver `minimoFrescos` en construir().
 */
const MINIMO_HUECOS_FRESCOS = 2;

/**
 * La banda objetivo del presupuesto. El presupuesto dejó de ser solo un techo:
 * si el usuario dice 51 €, una semana de 20 € no es un acierto, es que la app
 * no ha sabido llenarle la semana. El motor apunta al 95% y no se pasa del
 * 100%.
 */
export const BANDA_PRESUPUESTO = { minimo: 0.85, objetivo: 0.95 };

/** Blanda: dos días seguidos con la misma proteína cansa. Salvo si son sobras. */
/**
 * CUÁNTO DEL EURO DE MÁS TIENE QUE ACABAR EN EL PLATO ESTA SEMANA.
 *
 * La pasada de holgura ya exigía que el consumo SUBIERA y que la basura no
 * creciera más deprisa que el consumo. Faltaba lo tercero, y es lo que se
 * escapaba: que la subida de consumo sea una parte decente de lo que se gasta
 * de más. Sin ello aceptaba gastar 10,57 € para poner 2,80 € más en la mesa.
 *
 * Barrido de ocho casos (catalogo/_aud-holgura2.ts), sin este freno:
 *   gasta 147,26 € de más -> 58% al plato, 33% al armario, 9% a la basura.
 * O sea que NO es que se tirara: es que se llenaba la despensa. Recuperado el
 * 91%, que no está mal — pero los dos peores casos (una persona con 60 € y
 * dos con 65) metían el 60-70% en el armario y solo el 25% en el plato. En la
 * semana 1 eso se lee como que la app te ha hecho comprar de más.
 *
 * 0,55 sale de barrer el umbral sobre diez casos (catalogo/_aud-umbral.ts).
 * No es el número que más plato da —eso sería 0,85— sino el que menos comida
 * tira dejando la pasada viva:
 *
 *   umbral  salta  gasta+   plato  armario  basura   BASURA TOTAL
 *    0,00     7     147 €    58%     33%      9%      50,60 €   ← antes
 *    0,40     6     138 €    62%     28%     11%      51,82 €
 *    0,55     4      83 €    76%     13%     11%      46,04 €   ← aquí
 *    0,70     4      89 €    75%      9%     16%      51,77 €
 *    0,85     2      24 €    97%    -20%     23%      42,87 €
 *
 * A 0,85 la basura baja más, pero la pasada casi no salta y vuelve el problema
 * que vino a resolver: dinero sobre la mesa que la pantalla promete gastar y el
 * motor no gasta. 0,70 es peor que 0,55 en todo. Este es el punto.
 *
 * Y hay una razón de producto detrás del número: la app YA tiene una pantalla
 * para gastar la holgura —la hoja de ajustes, con tres semanas y tres niveles
 * de proteína y su precio al lado—. Que el motor se la gaste solo, en silencio
 * y metiendo la mitad en el armario, es hacer por el usuario una decisión que
 * ya sabe tomar viendo el número.
 */
const RENDIMIENTO_MINIMO_HOLGURA = 0.55;

/**
 * ═══ PENDIENTE · SUBIR EL TOPE PUEDE DARTE MENOS COMIDA ═══
 *
 * Medido sobre 64 pares de topes contiguos (1-4 personas × 7 y 14 huecos ×
 * 40…100 €), **en 11 subir el tope BAJA lo que se come**. El peor:
 *
 *     dos personas, 7 huecos:  50 € → come 26,23 €  ·  55 € → come 14,75 €
 *
 * La causa está localizada y NO es el pase de holgura, que sí protege el
 * consumo dentro de una construcción (`mejorConsumo` se guarda al alto).
 * Es que `BANDA_PRESUPUESTO.objetivo` entra en la puntuación hueco a hueco:
 * con más tope, el greedy toma otras decisiones desde el primer plato y acaba
 * en otro valle. Cuando la holgura llega, el daño ya está hecho.
 *
 * Se probaron dos parches por fuera y los dos salieron PEOR que no hacer nada,
 * medidos:
 *
 *   · sonda barata al 75% del tope (`sinHolgura`, sin escalar semillas):
 *     sigue en 11 roturas y sube el coste de 214 a 237 ms por semana. La sonda
 *     construye una semana tan pobre que casi nunca gana la comparación.
 *   · sonda completa al 75%: 13 roturas —dos MÁS— y 435 ms por semana, el
 *     doble. El escalón fijo no cae donde está la semana buena: para el caso de
 *     50 €→55 € habría que sondar en 45 €, que es el 82%, no el 75%.
 *
 * Arreglarlo de verdad es sacar el objetivo de gasto de la puntuación hueco a
 * hueco y convertirlo en una restricción posterior. Eso es rediseñar el corazón
 * del motor, no ponerle una guarda, y toca las 900 semanas de la huella. Queda
 * escrito aquí con sus números para que no se vuelva a intentar por fuera.
 */

const PENAL_PROTEINA_REPETIDA = 1.5;

/**
 * A partir de aquí, el día se hace cuesta arriba. Blanda, porque un domingo
 * de 90 minutos es una elección legítima y un martes de 90 no. Salió de leer
 * las semanas: "75 minutos de cocina el peor día de la semana", "100 minutos
 * en domingo para dos platos de cuchara baratos".
 */
const MINUTOS_COMODOS_POR_DIA = 60;
const PENAL_POR_MINUTO_DE_MAS = 0.02;

/**
 * Poner un plato de mediodía a cenar, y al revés.
 *
 * Asimétrico a propósito: un potaje de garbanzos a las diez de la noche es
 * un problema; un revuelto a mediodía es solo una comida ligera. Blandas las
 * dos, porque bajo filtros estrechos puede no haber con qué elegir — y una
 * cena pesada es mejor que ninguna cena.
 */
const PENAL_CENA_PESADA = 3;
const PENAL_COMIDA_LIGERA = 0.8;

/**
 * El sabor de fondo. Los lectores lo dijeron sin tener la palabra: "mucho
 * tomate transversal", "champiñón en 5 platos de la semana", "el motor
 * cuenta recetas distintas, no sabores". `proteina` y `base` no lo cazan —
 * cinco platos distintos pueden saber los cinco a tomate frito.
 *
 * Penaliza por cada ingrediente del candidato que YA aparece en dos o más
 * tandas de la semana. No hace falta un campo nuevo: los ingredientes que se
 * repiten SON el sabor de fondo.
 */
const TANDAS_PARA_SER_SABOR_DE_FONDO = 2;
/**
 * 2,5 sale de barrer el peso contra las 63 semanas del barrido. Semanas con
 * cinco tandas del mismo sabor: 53 sin penalizar, 33 con 0,7, 18 con 2,5,
 * 7 con 4. Subirlo a 4 cuesta 1,26 € de carrito y deja la proteína en 55,1 g
 * pegada al suelo, y el suelo está para aguantar. A 2,5 son 0,80 € y 55,4 g.
 */
const PESO_SABOR_REPETIDO = 2.5;

/**
 * ═══ DE QUÉ VIVE LA SEMANA · Y POR QUÉ NO BASTABA EL SABOR DE FONDO ═══
 *
 * Medido sobre semanas reales con «mucha variedad», que pide doce platos
 * distintos:
 *
 *   vegano              garbanzo + soja + tofu en 9,6 de 12 platos
 *   vegano sin gluten   los mismos tres en 9 de 12
 *   vegetariano         huevo en 4,7 de 12
 *
 * Doce recetas distintas, sí, pero tres cuartas partes del menú saliendo de
 * tres ingredientes. El usuario no vive doce platos: vive garbanzo otra vez.
 *
 * Se escribieron 30 recetas nuevas para arreglarlo y NO se movió: de las diez
 * veganas, el motor solo elegía tres. Ahí quedó claro que no era falta de
 * recetario. Garbanzo y soja texturizada son de lo más barato del lineal, así
 * que ganan la puntuación una y otra vez, y añadir alternativas solo añade
 * candidatas que pierden.
 *
 * ═══ POR QUÉ NO LO TAPABA `PESO_SABOR_REPETIDO` ═══
 *
 * Porque es PLANO: se activa a partir de dos tandas y a partir de ahí cobra lo
 * mismo. La cuarta tanda de garbanzo paga exactamente lo que la segunda, y
 * frente a un ahorro de céntimo por hueco eso no disuade de nada.
 *
 * Esta escala. Cada tanda previa que ya vivía de la misma fuente suma otro
 * escalón, así que la segunda cuesta 1,5 €, la tercera 3 y la cuarta 4,5: llega
 * un punto en que la alubia, aunque sea más cara, sale ganando. Es el mismo
 * mecanismo que ya usa PENAL_RECIENTE para la memoria entre semanas.
 *
 * Y solo sobre FUENTES DE PROTEÍNA, no sobre cualquier ingrediente: repetir
 * cebolla no es repetir plato, y la cebolla está en todo. Lo que define lo que
 * comes es de qué sale la proteína.
 */
const PROTEINA_QUE_DEFINE_EL_PLATO = 8;

/**
 * ═══ EL BARRIDO, Y LA TENSIÓN QUE DESTAPA ═══
 *
 * Semanas de 14 comidas para 2, 90 €, «mucha variedad», semanas 1-5.
 * «top-3» = de cuántos de los 12 platos vive el trío de fuentes más repetido.
 * Cuanto más bajo, más repartida la semana.
 *
 *   peso   sin filtros   vegano        vegano sin gluten
 *          top-3  prot   top-3  prot   top-3  prot
 *     0     7,0    58     9,4    55     9,6    55
 *     1     6,6    58     8,6    54     9,2    55
 *   1,5     5,0    56     8,6    54     8,6    53   ← el puesto
 *     2     5,0    57     7,2    52     7,6    53
 *     3     4,2    58     6,6    52     7,4    52
 *     6     3,6    58     6,2    50     6,2    49
 *
 * En el caso general la mejora es grande: el trío baja de 7,0 a 5,0 platos de
 * doce, y de paso el desperdicio de la semana cae de 37,73 € a 31,03 €.
 *
 * ═══ EL TECHO NO LO PONE LA VARIEDAD: LO PONE EL FAVORITO ═══
 *
 * A partir de 2 se cae `preferencias.test.tsx`: marcar ocho platos como «me
 * gusta» dejaba de servir para NADA, no entraba ninguno. BONUS_FAVORITO son
 * 2,5 € y esta penalización llega a 10, así que subir el listón de entrada del
 * motor deja el bonus por debajo del ruido. Comprobado que no es el mecanismo
 * lo que falla: con `pesoFavorito` a 10 esos ocho entran 22 veces; a 2,5,
 * ninguna.
 *
 * Así que 1,5 no es un punto de compromiso estético: es el máximo que no rompe
 * una instrucción explícita del usuario. Y la alternativa —subir
 * BONUS_FAVORITO— es recalibrar una constante ajustada para tapar el síntoma de
 * otra, y eso se hace con su propio barrido, no de paso.
 *
 * ═══ LO QUE ESTO NO ARREGLA ═══
 *
 * El vegano apenas se mueve: 9,4 → 8,6. Y no es cuestión de subir el peso. Las
 * fuentes que más proteína aportan son EXACTAMENTE las que se repiten
 * —garbanzo, soja, tofu—, así que repartir cuesta gramos: a peso 3 la proteína
 * ya cae a 52 g contra un suelo de 55, y a 6 se queda en 49.
 *
 * El lineal vegano barato es estrecho y no lo arregla ningún ajuste de pesos.
 * Salidas reales: más productos de proteína vegetal asequibles, o que sea el
 * usuario quien elija entre variedad y proteína, como ya elige entre variedad y
 * precio — son conflictivas por la misma razón. Ver catalogo/_aud-fuentes.ts.
 */
const PENAL_FUENTE_REPETIDA = 1.5;

/**
 * Cuánto pesa aprovechar la asignación del hueco. Ver `aprovechamiento`.
 * Barrido a 65 € para dos: 82% del presupuesto con peso 12, 86% con 30, y de
 * ahí no sube (84% con 60 y con 120). Queda en el mismo orden de magnitud que
 * PESO_PROTEINA a propósito: es un desempate entre platos que ya caben, no
 * una orden de gastar.
 */
const PESO_APROVECHAR = 30;

/**
 * Y agrupa por FAMILIA, no por ingrediente canónico: `tomate_triturado` y
 * `tomate_frito` son dos ingredientes distintos en la base de datos y el
 * mismo sabor en el plato. Contándolos por separado, el tomate se colaba en
 * seis tandas sin activar nunca la penalización.
 *
 * La familia es el primer tramo del id, que es donde ya vive esa información:
 * pollo_pechuga/pollo_muslo, pimiento_verde/pimiento_rojo,
 * arroz_redondo/arroz_bomba. Sin tabla nueva que mantener y sin un campo más
 * que rellenar en cada alta — que es como se quedan atrás las reglas.
 */
/**
 * Con memoria: es una función pura de una cadena, la llama el bucle de
 * candidatos para cada ingrediente de cada receta en cada hueco, y `split`
 * reserva un array entero para quedarse con el primer trozo. El perfilador la
 * daba en el 4,4% del tiempo del motor. Las claves distintas son las de los
 * ingredientes canónicos, un par de cientos: la tabla no crece.
 */
const familias = new Map<string, string>();
export function familiaDeSabor(canonico: string): string {
  let f = familias.get(canonico);
  if (f === undefined) {
    f = canonico.split('_')[0];
    familias.set(canonico, f);
  }
  return f;
}

/**
 * LO QUE COMISTE LA SEMANA PASADA.
 *
 * El motor es una función pura de las preferencias: con las mismas entradas
 * devuelve el mismo óptimo, así que sin memoria la semana 2 repetía 8 de 10
 * platos de la semana 1. Eso deja sin efecto todo el trabajo de la silueta
 * —da igual que el martes ya no sea recalentado si se come lo mismo— y va
 * directo contra el retorno en la semana 4.
 *
 * Graduada, NO prohibición. Prohibir estrecharía el recetario justo donde ya
 * va justo: vegano tiene 29 recetas vivas y "vegetariano + lo mínimo" solo
 * 13; vetar lo de la semana pasada dejaría a un vegano sin con qué llenar la
 * semana. Con penalización, la receta repetida sigue siendo elegible: solo
 * tiene que ser claramente mejor que las alternativas para ganar.
 *
 * El valor está en euros por hueco, como el resto de la puntuación. 4 € es
 * deliberadamente alto frente al coste marginal típico (0,40-1,50 €): la
 * repetición inmediata tiene que perder salvo que no haya nada más.
 */
const PENAL_RECIENTE = [4, 1.6, 0.5];

/**
 * ═══ LO QUE PESA QUE UN PLATO TE GUSTE ═══
 *
 * En euros por hueco, como todo lo demás de la puntuación. El número no sale de
 * la intuición: sale de dónde tiene que caber entre los términos que ya existen.
 *
 *   · POR DEBAJO DE PENAL_RECIENTE[0] = 4. Si un favorito le ganase a "lo
 *     comiste la semana pasada", saldría todas las semanas, y el encargo pide
 *     justo lo contrario. La memoria entre semanas manda sobre el gusto.
 *   · POR ENCIMA DEL RUIDO DEL COSTE MARGINAL (0,40–1,50 € por hueco). Por
 *     debajo de eso no desempataría nunca y la función sería decorativa: el
 *     usuario marcaría platos y no pasaría nada.
 *   · MUY POR DEBAJO DE BONUS_VARIEDAD = 100, que es lo que impide repetir
 *     dentro de la semana. Ese no se toca.
 *
 * ═══ EL BARRIDO ═══
 *
 * 8 favoritos de 112 recetas, 5 semanas encadenadas × 3 tamaños de hogar × 2
 * presupuestos. Por semana de 14 huecos:
 *
 *     peso   sale/sem   máx en 1 sem   carrito    comida
 *        0     0,93           3        49,71 €   30,11 €
 *        1     1,33           3        49,33 €   29,52 €
 *      2,5     2,17           3        50,11 €   29,50 €   ← este
 *        4     3,43           3        49,24 €   28,73 €
 *        8     5,73           3        47,74 €   27,55 €
 *       20     9,77           3        47,84 €   25,70 €
 *
 * A 2,5 los favoritos pasan de 0,93 a 2,17 apariciones por semana —se notan sin
 * invadir— por 0,40 € de carrito y 0,61 € de comida (un 2%).
 *
 * Y se ve dónde está el techo: **a partir de 4 la comida se desploma**. A 20,
 * de 30,11 € baja a 25,70 — casi cinco euros de comida menos por la misma
 * compra. Eso es el motor renunciando a platos que alimentan mejor porque otro
 * lleva una marca. El gusto no puede ganarle a la cuenta en una app de dinero.
 *
 * ═══ LA COLUMNA QUE NO SE MUEVE ═══
 *
 * «Máx en 1 sem» vale 3 con TODOS los pesos, incluido 20. Ahí está la prueba de
 * que los frenos aguantan: por mucho que se suba el bonus, un favorito no puede
 * salir más veces dentro de una semana. Lo impiden `BONUS_VARIEDAD = 100` y que
 * el término vaya con `yaUsada ? 0 : …`, igual que la memoria — el bonus solo
 * compite al ESTRENAR receta. (Los 3 son la tanda entera: el día que se cocina,
 * su sobra y su ensamblaje. Eso no es repetir plato, es aprovecharlo, que es de
 * lo que va el producto.)
 */
const BONUS_FAVORITO = 2.5;

/**
 * Cuántas semanas de historial se guardan. Tres, y sale de PENAL_RECIENTE:
 * la cuarta ya penalizaría menos que el ruido del coste marginal, así que
 * guardarla sería ocupar sitio en localStorage para no cambiar ninguna
 * decisión. Con 72 recetas y ~10 por semana, tres semanas marcan como
 * "reciente" a un tercio del recetario — suficiente para forzar rotación sin
 * agotar los filtros estrechos.
 */
export const SEMANAS_DE_MEMORIA = PENAL_RECIENTE.length;

/**
 * Blanda, a escala de semana entera. Sin esto el motor montaba semanas sin
 * una sola ración de carne ni de pescado: las recetas baratas del piloto son
 * todas de legumbre, huevo y pasta, así que el coste marginal siempre las
 * prefería. Una semana así es correcta en la hoja de cálculo y mala como
 * producto — quien come carne no va a pagar por un plan que no la tiene.
 * Penaliza en proporción a la parte de la semana que esa proteína ya ocupa.
 */
const PESO_CUOTA_PROTEINA = 6;

// ---------------------------------------------------------------------------
// Restricciones duras
// ---------------------------------------------------------------------------

/**
 * Los filtros los gobiernan los DATOS del ingrediente (`origen` y
 * `alergenos` en docs/ingredientes-canonicos.json), no una lista a mano en
 * el código. Con 35 ingredientes la lista se podía mantener; con 100 y varias
 * personas escribiendo recetas, se olvida una y el filtro miente en silencio
 * — que es exactamente lo que pasaba con "sin frutos secos".
 */
/**
 * Un filtro es de ALERGIA o de PREFERENCIA, y la diferencia manda sobre las
 * trazas. "Puede contener trazas de soja" es una advertencia de línea de
 * fábrica: para quien tiene alergia a la soja es motivo suficiente para no
 * comerlo, y para un vegano no significa absolutamente nada. Meterlas en el
 * mismo saco dejaría a un vegano sin pasta por una advertencia que no habla
 * de ingredientes.
 */
export interface Filtro {
  origenes?: Origen[];
  alergeno?: Alergeno;
  tipo: 'alergia' | 'preferencia';
}

export const FILTROS: Record<string, Filtro> = {
  // Preferencia: elegir no comerlo. No miran trazas.
  Vegetariano: { origenes: ['carne', 'pescado', 'marisco'], tipo: 'preferencia' },
  Vegano: { origenes: ['carne', 'pescado', 'marisco', 'huevo', 'lacteo'], tipo: 'preferencia' },
  Cerdo: { alergeno: 'cerdo', tipo: 'preferencia' },

  // Alergia: no poder comerlo. Miran trazas.
  //
  // "Vegetariano" NO sustituye a "sin huevo": uno es preferencia y el otro es
  // salud. Un padre con un hijo alérgico al huevo no puede usar el filtro
  // vegetariano —le quita también la carne— ni fiarse de él, porque no mira
  // las trazas. El huevo es de las alergias infantiles más frecuentes y el
  // recetario tiene 16 platos que lo llevan.
  Huevo: { origenes: ['huevo'], alergeno: 'huevo', tipo: 'alergia' },
  Pescado: { origenes: ['pescado'], alergeno: 'pescado', tipo: 'alergia' },
  Marisco: { origenes: ['marisco'], alergeno: 'marisco', tipo: 'alergia' },
  Gluten: { alergeno: 'gluten', tipo: 'alergia' },
  Lactosa: { alergeno: 'lactosa', tipo: 'alergia' },
  'Frutos secos': { alergeno: 'frutos_secos', tipo: 'alergia' },
  Cacahuete: { alergeno: 'cacahuete', tipo: 'alergia' },
  Sésamo: { alergeno: 'sesamo', tipo: 'alergia' },
  Mostaza: { alergeno: 'mostaza', tipo: 'alergia' },
  Apio: { alergeno: 'apio', tipo: 'alergia' },
  Soja: { alergeno: 'soja', tipo: 'alergia' },
  Sulfitos: { alergeno: 'sulfitos', tipo: 'alergia' },
};

/** Los que son cuestión de salud. La app los agrupa aparte y van primero. */
export const EXCLUSIONES_ALERGIA = Object.entries(FILTROS)
  .filter(([, f]) => f.tipo === 'alergia').map(([n]) => n);

export const EXCLUSIONES_PREFERENCIA = Object.entries(FILTROS)
  .filter(([, f]) => f.tipo === 'preferencia').map(([n]) => n);

/** Las exclusiones que la app ofrece. Debe cuadrar con DIETAS en AjustesSemana. */
export const EXCLUSIONES = Object.keys(FILTROS);

/** ¿Choca ESTE ingrediente con ESTA exclusión? */
function ingredienteVetado(meta: IngredienteCanonico, filtro: Filtro): boolean {
  if (filtro.origenes?.includes(meta.origen)) return true;
  if (!filtro.alergeno) return false;
  if (meta.alergenos.includes(filtro.alergeno)) return true;
  // Las trazas solo cuentan cuando el filtro es por alergia.
  return filtro.tipo === 'alergia' && (meta.trazas ?? []).includes(filtro.alergeno);
}

/**
 * Un gramo de comino no es un plato. El comino lleva gluten en su etiqueta
 * (se envasa en línea compartida), y eso tumbaba el potaje de garbanzos
 * entero del filtro "sin gluten" — cuando la respuesta obvia es hacer el
 * potaje sin comino. Solo vale para despensa que además escale sublineal o
 * fijo: son las especias y los chorros, lo que nadie echa de menos. La
 * proteína y la verdura no se pueden quitar aunque estén en despensa.
 */
function esPrescindible(meta: IngredienteCanonico, ing: Receta['ingredientes'][number]): boolean {
  return meta.es_despensa && (ing.escalado === 'sublineal' || ing.escalado === 'fijo');
}

/**
 * La receta tal y como se puede cocinar con estas exclusiones, o null si no
 * hay forma. Si lo único que choca son especias de despensa, devuelve la
 * receta sin ellas y anota cuáles para que la hoja del día lo diga.
 */
export function adaptarReceta(
  receta: Receta,
  exclusiones: string[],
  minutosMax: number,
  ingredientes: Record<string, IngredienteCanonico>,
): Receta | null {
  if (receta.minutos > minutosMax) return null;

  const quitar = new Set<string>();
  for (const exclusion of exclusiones) {
    const filtro = FILTROS[exclusion];
    if (!filtro) continue;
    for (const ing of receta.ingredientes) {
      const meta = ingredientes[ing.canonico];
      if (!meta) throw new Error(`"${ing.canonico}" (receta ${receta.id}) no está en el vocabulario canónico`);
      if (!ingredienteVetado(meta, filtro)) continue;
      if (!esPrescindible(meta, ing)) return null;
      quitar.add(ing.canonico);
    }
  }

  if (!quitar.size) return receta;
  return {
    ...receta,
    ingredientes: receta.ingredientes.filter((i) => !quitar.has(i.canonico)),
    omitidos: [...quitar].sort((a, b) => a.localeCompare(b)),
  };
}

export function recetaPermitida(
  receta: Receta,
  exclusiones: string[],
  minutosMax: number,
  ingredientes: Record<string, IngredienteCanonico>,
): boolean {
  return adaptarReceta(receta, exclusiones, minutosMax, ingredientes) !== null;
}

/**
 * El recetario tal y como lo ve una petición concreta. Lo usan el motor y la
 * rehidratación del plan guardado: si divergieran, la semana que enseña la
 * app llevaría comino y la que calculó el motor no.
 */
export function recetarioAdaptado(
  datos: DatosMotor,
  exclusiones: string[] = [],
  minutosMax = Infinity,
  /**
   * ═══ LOS PLATOS QUE EL USUARIO NO QUIERE, Y POR QUÉ VAN APARTE ═══
   *
   * Podrían haber entrado como una exclusión más y habría sido menos código.
   * No van ahí por tres motivos que no son de estilo:
   *
   *   1. UNA ALERGIA NO ES UN GUSTO. `adaptarReceta` mira trazas, quita
   *      especias de despensa para salvar el plato y nunca se relaja. Un "no me
   *      gusta la merluza" no tiene trazas, no salva nada quitando comino y se
   *      desbloquea de un toque. Compartir camino habría acabado en un `if` que
   *      distinguiera los dos casos dentro de la función que garantiza que a un
   *      celíaco no le entre gluten, y ese no es sitio para experimentar.
   *   2. EL DIAGNÓSTICO SE ROMPÍA. `diagnosticar()` recorre `exclusiones` y
   *      propone quitar cada una. Con los bloqueos dentro diría «quita
   *      "merluza_horno" y salen 14 comidas» — un id crudo en pantalla — en vez
   *      de «has quitado 40 platos».
   *   3. SON IDS, NO ETIQUETAS. `exclusiones` son claves de FILTROS ('Gluten',
   *      'Vegano'); esto son ids del recetario. Mezclar dos espacios de nombres
   *      en un `string[]` es cómo se acaba con "Gluten" bloqueado como plato.
   *
   * Se filtra DESPUÉS de adaptar, no antes: adaptar puede devolver `null` por
   * su cuenta y así el orden de las dos cribas no cambia el resultado.
   */
  bloqueados: readonly string[] = [],
): Receta[] {
  const veto = bloqueados.length ? new Set(bloqueados) : null;
  return datos.recetas
    .map((r) => adaptarReceta(r, exclusiones, minutosMax, datos.ingredientes))
    .filter((r): r is Receta => r !== null && !(veto?.has(r.id) ?? false));
}

// ---------------------------------------------------------------------------
// Selección
// ---------------------------------------------------------------------------

export interface PeticionSemana {
  datos: DatosMotor;
  N: number;
  numHuecos: number;
  variedad: Variedad;
  esfuerzo?: Esfuerzo;
  exclusiones?: string[];
  presupuesto?: number;
  /** El nivel que ha pedido el usuario. Ver GRAMOS_POR_NIVEL. */
  proteina?: NivelProteina;
  /** Solo para calibrar: ver TOPE_DESPERDICIO. En la app va el valor por defecto. */
  topeDesperdicio?: number;
  /**
   * ═══ LO QUE EL USUARIO HA DICHO DE LOS PLATOS ═══
   *
   * Dos listas de ids, separadas de `exclusiones` a propósito — ver el
   * parámetro `bloqueados` de `recetarioAdaptado` para el porqué largo.
   *
   * `platosBloqueados` es una CRIBA: esos ids no llegan a ser candidatos.
   * `platosFavoritos` es una PREFERENCIA: entra en la puntuación como un
   * término más, en euros por hueco como todos los demás. Ver BONUS_FAVORITO.
   *
   * Los ids que ya no existan en el recetario simplemente no casan con nada y
   * no hacen daño: la criba es un `Set.has` y el bonus un `Set.has`. Eso es
   * deliberado — el recetario cambia y una preferencia guardada tiene que poder
   * sobrevivir a que su receta desaparezca una versión y vuelva a la siguiente.
   */
  /**
   * Los siete días en el ORDEN en que los vive el usuario.
   *
   * Ver `posicionesDeSemana` en reparto.ts para por qué se rotan los nombres en
   * vez de separarlos de la posición: hay una regla del motor que depende del
   * día real del calendario y con nombres fijos caería en el día equivocado.
   *
   * Sin él, se empieza en lunes: exactamente el comportamiento de siempre.
   */
  ordenDias?: readonly string[];
  platosBloqueados?: readonly string[];
  platosFavoritos?: readonly string[];
  /** Solo para calibrar: ver BONUS_FAVORITO. En la app va el valor por defecto. */
  pesoFavorito?: number;
  /** Solo para calibrar: apaga la pasada de aprovechar la holgura. */
  sinHolgura?: boolean;
  /**
   * Solo para comparaciones internas: enciende la pasada de holgura aunque
   * `PASADA_DE_HOLGURA` esté apagada. Ver esa constante. `sinHolgura` sigue
   * mandando si se dan las dos.
   */
  conHolgura?: boolean;
  /** Solo para calibrar: ver RENDIMIENTO_MINIMO_HOLGURA. */
  rendimientoHolgura?: number;
  /**
   * Solo para calibrar: hace que los TRES niveles de proteína desempaten por lo
   * mismo, en vez de cada uno por lo suyo.
   *
   * Existe para poder medir la pregunta que abre `OBJETIVO_POR_NIVEL`: cuánto
   * de la incoherencia del selector —subir de nivel y pagar menos— viene de que
   * cada nivel optimiza un objetivo distinto. Ver catalogo/_aud-monotonia.ts.
   */
  criterioUnico?: 'precio' | 'desperdicio';
  /**
   * Solo para calibrar: reproduce la cuota de antes del 13 oct 2026, que no
   * descontaba lo que ya salía del armario. Ver `armarioActual` en construir().
   */
  cuotaSinArmario?: boolean;
  /**
   * Solo para calibrar: una pasada de holgura que NO apunta a un porcentaje
   * del presupuesto. Acepta gastar más solo por una mejora explícita de
   * calidad —estrenar un plato, repetir menos la fuente de proteína, tirar
   * menos— sin perder nada de lo demás, y hasta `topeExtra` del presupuesto
   * por encima de la semana base. Ver `aceptarPorCalidad` en construirMejor().
   */
  holguraPorCalidad?: {
    topeExtra: number;
    criterio: 'variedad-fuentes' | 'fuentes-perecedero';
    /** Cuánto puede subir el perecedero por cada euro de gasto adicional. 0 si no se da. */
    toleranciaPerecedero?: number;
  };
  /**
   * Postre en cada comida. Ver motor/postres.ts.
   *
   * Entra como BASE de la necesidad, no como suma al final, y esa es toda
   * la diferencia: con el postre dentro desde el primer candidato, el techo
   * de presupuesto ya lo cuenta y el motor elige platos sabiendo que tiene
   * 6 € menos. Sumado después, encender el postre habría roto el tope y la
   * app estaría mintiendo con su propia cifra.
   */
  postre?: boolean;
  /**
   * Qué semana es. NO es cosmético: de él sale la silueta —qué días llevan
   * hueco de sobras— y es lo único que hace que la semana 2 no tenga la misma
   * FORMA que la semana 1. Ver siluetaDeSemana(). Determinista: la misma
   * semana con el mismo número da siempre el mismo reparto.
   */
  semanaNumero?: number;
  /**
   * Lo que se comió en las semanas anteriores, de la más reciente a la más
   * antigua: `recetasRecientes[0]` son los ids de la semana pasada. Ver
   * PENAL_RECIENTE. Sin esto el motor no tiene memoria y repite el óptimo.
   */
  recetasRecientes?: string[][];
  /**
   * Lo que ya hay en el armario y en la nevera, por SKU. Ver `Existencias` en
   * carrito.ts para el agujero que tapa. El motor lo usa en dos sitios: no
   * vuelve a comprar lo que hay, y —porque el coste marginal lo ve— PREFIERE
   * los platos que gastan lo que ya está abierto.
   */
  existencias?: Existencias;
  /**
   * Cuánto pesa la memoria, de 1 a 0. Lo baja construirMejor cuando con la
   * memoria entera no se puede cumplir el suelo o el presupuesto: antes de
   * romper lo que el usuario pidió, se acepta repetir plato. No lo pone
   * nadie desde fuera.
   */
  atenuarMemoria?: number;
}

/**
 * Cuando las restricciones dejan el recetario sin con qué llenar la semana.
 * No es una excepción: es un resultado con salidas. CLAUDE.md — da la
 * salida, nunca el muro.
 */
export interface SinCobertura {
  recetasVivas: number;
  huecosCubribles: number;
  huecosPedidos: number;
  /**
   * Qué soltar para que salga, de menor a mayor renuncia.
   *
   * `bloqueados` va aparte de `exclusion` porque la frase que le toca es otra:
   * proponerle a alguien que se quite la alergia al marisco y proponerle que
   * desbloquee un plato que no le gustaba no se dicen igual. Ver
   * `diagnosticar()` y el tipo gemelo en state/types.ts.
   */
  salidas: {
    tipo: 'exclusion' | 'esfuerzo' | 'comidas' | 'bloqueados';
    que: string;
    huecosCubribles: number;
  }[];
  /** Cuántos platos ha bloqueado el usuario, para poder decir el número. */
  platosBloqueados?: number;
}

export interface SemanaGenerada {
  huecos: Hueco[];
  tandas: Tanda[];
  carrito: Carrito;
  /**
   * El postre de la semana, vacío si no se ha pedido. Va aparte de `carrito`
   * aunque sus líneas ya estén dentro: la lista de la compra necesita las
   * líneas y la pantalla Semana necesita saber QUÉ postre toca, que es otra
   * pregunta.
   */
  postres: RacionPostre[];
  recetasDistintas: string[];
  /** Cabe en el presupuesto Y cumple el nivel de proteína pedido. */
  cuadra: boolean;
  /** Lo que de verdad se come, para poder decirlo sin adornos. */
  nutricion: {
    proteinaPorPersonaDia: number;
    sueloProteina: number;
    cumpleSuelo: boolean;
    huecosConAnimal: number;
    huecosConFresca: number;
  };
  /** Cuando no cuadra: las salidas accionables, nunca el muro. */
  salida?: {
    variedadMasBarata: Variedad | null;
    presupuestoNecesario: number;
    /** El nivel de proteína más alto que sí sale con este presupuesto. */
    proteinaAlcanzable: NivelProteina | null;
    /** Qué falló: el dinero, la proteína, o las dos cosas. */
    motivo: 'presupuesto' | 'proteina' | 'ambos';
  };
  /** Cuando no hay ni recetario con que montarla. */
  sinCobertura?: SinCobertura;
}

/**
 * Un número distinto por día de la semana. SOLO sirve para agrupar —los minutos
 * que se cocinan cada día— y NO es la posición dentro de la semana.
 *
 * Se llamaba `diaIndice`, igual que `Posicion.diaIndice`, y desde que los días
 * se rotan según cuándo empieza la semana los dos significan cosas distintas:
 * empezando en viernes, VIE es la POSICIÓN 0 y esta función devuelve 4. Para
 * agrupar da igual cuál sea mientras sea único por día; para cualquier otra
 * cosa, no — y con el mismo nombre alguien acabaría usando este donde hacía
 * falta el otro.
 */
function claveDeDia(dia: string): number {
  return DIAS.indexOf(dia);
}

// ---------------------------------------------------------------------------
// Telemetría de auditoría
// ---------------------------------------------------------------------------

/**
 * Contadores de por qué se descarta cada candidato. Apagados por defecto —
 * el coste es una comparación con null por rechazo— y NO cambian ninguna
 * decisión del motor: solo cuentan. Los encienden los scripts de auditoría
 * (catalogo/_aud-*.ts) para medir qué restricción ata más, que de otro modo
 * solo se puede intuir.
 */
let telemetria: Record<string, number> | null = null;

export function activarTelemetria(): Record<string, number> {
  telemetria = {};
  return telemetria;
}

export function desactivarTelemetria(): void {
  telemetria = null;
}

function contar(motivo: string): void {
  if (telemetria) telemetria[motivo] = (telemetria[motivo] ?? 0) + 1;
}

/**
 * Qué días de ESTA semana pueden llevar un hueco sin cocinar.
 *
 * El motor llenaba los huecos en orden y cada tanda reclamaba el primer sitio
 * válido para su sobra, que por la regla de "misma comida, un día después" es
 * siempre el día siguiente. Resultado medido: 20 de 20 semanas cocinaban dos
 * platos el lunes y tenían el martes entero de sobras. La silueta no la
 * elegía nadie — emergía del orden de recorrido, y por eso era idéntica
 * siempre. Ahora se decide antes de empezar:
 *
 *   · Los días que NO están en el conjunto tienen sus dos huecos cocinados,
 *     así que ningún día puede ser 100% sobras.
 *   · Como el conjunto rota con el número de semana, la semana 2 tiene otra
 *     forma que la semana 1 aunque los platos fueran los mismos. Es lo que
 *     impide que se lea como plantilla en la semana 4, que es la métrica que
 *     decide si esto es un negocio.
 *
 * El orden base alterna días a propósito: así las tandas se reparten en vez
 * de amontonarse. La rotación es determinista, no aleatoria.
 */
export function siluetaDeSemana(numHuecos: number, topeSobras: number, semanaNumero: number): Set<number> {
  const huecosPorDia = Math.max(1, Math.round(numHuecos / DIAS.length));
  /**
   * El día 0 no está, y no es una preferencia: es que el PRIMER día de la
   * semana no tiene nada cocinado antes de lo que aprovechar. Cuando sí
   * estaba, las rotaciones que lo elegían gastaban un cupo en un día que
   * nunca podía usarlo, y con "mucha variedad" —que necesita exactamente 2
   * huecos de sobra para llegar a 14— eso dejaba solo 1 sitio útil y la
   * semana entera salía VACÍA. Pasaba en las semanas 2 y 3 de cada siete, y
   * no se detectó porque todo se había medido con semanaNumero = 1.
   *
   * Son POSICIONES, no días del calendario, y por eso esto no ha hecho falta
   * tocarlo al dejar que la semana empiece cualquier día: el primer día sigue
   * siendo el primer día, se llame lunes o viernes.
   */
  const ORDEN_BASE = [1, 3, 5, 2, 4, 6];
  const giro = ((semanaNumero % ORDEN_BASE.length) + ORDEN_BASE.length) % ORDEN_BASE.length;
  const orden = ORDEN_BASE.map((_, k) => ORDEN_BASE[(k + giro) % ORDEN_BASE.length]);

  // Con dos huecos al día, cada día del conjunto cede uno; con uno solo, el
  // día entero. Ahí no se puede exigir un plato cocinado cada día sin matar
  // las sobras, así que la regla equivalente es no encadenar dos días.
  /**
   * Siempre se deja UN día fuera del cupo, aunque el nivel de variedad
   * permitiera más. Si el cupo cubre todos los días disponibles no queda
   * nada que rotar y la silueta sale idéntica todas las semanas — que es
   * justo lo que pasaba con "poca variedad": las siete semanas del ciclo
   * tenían la misma forma `CC sC Cs Cs sC sC Cs`. La rotación existía y no
   * hacía nada. Cuesta un hueco de sobra; compra que la semana 2 no se lea
   * como la semana 1.
   */
  const cupo = huecosPorDia >= 2
    ? Math.min(topeSobras, ORDEN_BASE.length - 1)
    : Math.min(topeSobras, Math.floor(DIAS.length / 2));

  const dias = new Set<number>();
  for (const d of orden) {
    if (dias.size >= cupo) break;
    if (huecosPorDia === 1 && (dias.has(d - 1) || dias.has(d + 1))) continue;
    dias.add(d);
  }
  return dias;
}

/** Una tanda propuesta para un hueco, con lo que puntúa. */
interface Candidato {
  tanda: Tanda;
  nuevos: Hueco[];
  puntuacion: number;
}

/**
 * Greedy por coste marginal, como dice CLAUDE.md. El coste de una receta
 * depende de lo que YA hay en el carrito: la segunda que usa cebolla casi no
 * cuesta, porque la malla está pagada. El encadenamiento de ingredientes no
 * está programado como regla — emerge de que el marginal se calcula sobre el
 * carrito acumulado.
 *
 *   puntuación = −coste_marginal − perecedero_marginal
 *                + bonus_variedad − penalización_proteína_repetida
 *
 * (todo por hueco cubierto, para que una tanda que cubre dos no gane solo por
 * repartir su coste entre más comidas.)
 */
export interface ArranqueParcial {
  /** Huecos ya decididos que no se tocan, en su posición original. */
  ocupados?: (Hueco | null)[];
  /** Tandas correspondientes a esos huecos. */
  tandas?: Tanda[];
  /** No volver a proponer esta receta en el primer hueco que se rehaga. */
  vetadaAqui?: string;
  /**
   * Estas recetas (ids separados por «|») no pueden aparecer en NADA de lo
   * que se rellene. Es el veto del "cambiar plato": el de vetadaAqui
   * aterrizaba en el primer hueco que se reconstruía —no necesariamente el
   * tocado— y en 5 de 42 retoques medidos el plato vetado volvía a su sitio
   * como si nada. Admite varias porque repararHueco va vetando candidatos
   * hasta encontrar uno que no saque la semana de cuadre.
   */
  vetadaGlobal?: string;
  /** Ese hueco queda sin cocinar. */
  librearEn?: number;
  /** Arrancar obligatoriamente por esta receta (lo usan los reintentos). */
  forzarPrimera?: string;
  /**
   * Platos distintos de más que se permiten sobre el tope del nivel de
   * variedad. Lo usa la pasada de aprovechamiento cuando sobra presupuesto:
   * ver `aprovecharHolgura` en construirMejor().
   */
  variedadExtra?: number;
  /**
   * Premia gastar lo que cada hueco tiene permitido en vez de quedarse corto.
   * Solo lo enciende la pasada de aprovechamiento, y su resultado tiene que
   * pasar la misma criba: caber en el presupuesto y no empeorar nada.
   */
  aprovechar?: boolean;
  /**
   * A qué parte del presupuesto se apunta, en tanto por uno. Por defecto
   * `BANDA_PRESUPUESTO.objetivo`. La pasada de aprovechamiento lo sube.
   */
  objetivoExtra?: number;
  /**
   * Cuánta de su cuota se le reserva a cada hueco que sigue vacío, en tanto
   * por uno. Con 1 —el valor de siempre— ningún hueco puede gastar más de lo
   * suyo, y por eso no había forma de que un domingo costara el doble que un
   * martes. Bajarlo deja que un hueco tire de lo reservado para los demás.
   */
  fraccionReserva?: number;
  /**
   * Multiplica el tope de huecos sin cocinar. Es la palanca que le faltaba a
   * «poca variedad»: cocina 7 platos y recalienta los otros 7, así que su
   * gasto está topado por siete comidas —con 60 € eso son 4,29 € por ración,
   * que no existen en el recetario— y se quedaba en el 71% del presupuesto
   * hiciera lo que hiciera. Cocinar más veces los MISMOS cinco platos no
   * rompe la promesa del nivel: sigue habiendo cinco platos, solo que recién
   * hechos en vez de recalentados.
   */
  fraccionSobras?: number;
}

/**
 * Reparte tandas sobre los huecos de la semana. Ya no avanza un cursor: una
 * tanda ocupa su hueco cocinado Y, si tiene sobra, otro hueco no contiguo más
 * adelante (ver reparto.ts). Entre medias quedan huecos libres que llenarán
 * otras tandas, y por eso hace falta un mapa de ocupación en vez de un índice.
 *
 * Exportada para los scripts de auditoría (catalogo/_aud-*.ts), que necesitan
 * sembrar arranques a mano. La app entra siempre por generarSemana.
 */
export function construir(
  peticion: PeticionSemana,
  arranque?: ArranqueParcial,
): { huecos: Hueco[]; tandas: Tanda[]; carrito: Carrito; postres: RacionPostre[] } | null {
  const { datos, N, numHuecos, variedad } = peticion;
  const minutosMax = MINUTOS_POR_ESFUERZO[peticion.esfuerzo ?? 'libre'];
  const exclusiones = peticion.exclusiones ?? [];
  const topeRecetas = RECETAS_POR_VARIEDAD[variedad] + (arranque?.variedadExtra ?? 0);
  const topeTandas = TANDAS_POR_RECETA_POR_VARIEDAD[variedad];
  const topeSobras = Math.floor(
    numHuecos * FRACCION_SOBRAS_POR_VARIEDAD[variedad] * (arranque?.fraccionSobras ?? 1),
  );

  const vetadas = new Set((arranque?.vetadaGlobal ?? '').split('|').filter(Boolean));
  const elegibles = recetarioAdaptado(datos, exclusiones, minutosMax, peticion.platosBloqueados)
    .filter((r) => !vetadas.has(r.id));
  if (elegibles.length === 0) return null;
  /* Se resuelve aquí y no dentro del bucle de puntuación: eso corre ~50.000
     veces por generación y construir el Set cada vez sería el coste dominante. */
  const favoritos = peticion.platosFavoritos?.length ? new Set(peticion.platosFavoritos) : null;
  /**
   * Índice por id. El bucle de capacidad —el que decide si toca estrenar
   * receta— buscaba con `elegibles.find(...)` DENTRO de un bucle sobre las
   * recetas ya usadas, y eso corre una vez por hueco y por candidato: con 112
   * recetas elegibles salía a decenas de millones de comparaciones por semana
   * construida. El perfilador lo daba como el 12% del tiempo del motor, el
   * segundo de la lista.
   */
  const porId = new Map(elegibles.map((r) => [r.id, r]));

  // El mínimo de carne o pescado fresco se recorta a lo que el recetario puede
  // dar CON ESTAS restricciones. Sin esto, "vegetariano" no devolvía una
  // semana sin carne: no devolvía nada — al llegar a los dos últimos huecos el
  // motor los declaraba obligatoriamente de proteína fresca, ninguna receta
  // vegetariana lo era, y la construcción entera se caía a cero.
  const minimoFrescos = Math.min(
    MINIMO_HUECOS_FRESCOS,
    elegibles.filter((r) => proteinaAnimal(r, datos) === 'fresca').length,
  );

  const posiciones = posicionesDeSemana(numHuecos, peticion.ordenDias);
  const diasConSobra = siluetaDeSemana(numHuecos, topeSobras, peticion.semanaNumero ?? 1);

  /**
   * El ensamblaje que puede montarse con la sobra de esta receta, si el
   * recetario tiene alguno y sus ingredientes pasan los filtros del usuario:
   * un ensamblaje con huevo no puede servirse a quien excluye el huevo solo
   * porque el guiso de origen sí valiera.
   */
  const ensamblajeDe = (receta: Receta): Ensamblaje | undefined =>
    (datos.ensamblajes?.[receta.id] ?? []).find((e) =>
      adaptarReceta(
        { ...receta, ingredientes: e.ingredientes, minutos: e.minutos },
        exclusiones, minutosMax, datos.ingredientes,
      ) !== null);

  const ocupados: (Hueco | null)[] = arranque?.ocupados
    ? [...arranque.ocupados]
    : new Array(posiciones.length).fill(null);
  const tandas: Tanda[] = [...(arranque?.tandas ?? [])];

  const usos = new Map<string, number>();
  for (const t of tandas) usos.set(t.receta.id, (usos.get(t.receta.id) ?? 0) + 1);

  const basesDe = (r: Receta) =>
    new Set(r.ingredientes.map((i) => datos.ingredientes[i.canonico].base).filter(Boolean) as string[]);

  const proteinasPorDia = new Map<number, Set<string>>();
  // Y lo mismo con las bases y con los días en que ya cae cada receta: son
  // los datos de las dos reglas de "comida de verdad" (ver abajo en buscar).
  const basesPorDia = new Map<number, Set<string>>();
  const diasDeReceta = new Map<string, Set<number>>();
  const anotarProteina = (dia: string, proteina: string) => {
    const d = claveDeDia(dia);
    if (!proteinasPorDia.has(d)) proteinasPorDia.set(d, new Set());
    proteinasPorDia.get(d)!.add(proteina);
  };
  /** En cuántas tandas de la semana aparece ya cada familia de sabor. */
  const tandasPorSabor = new Map<string, number>();
  const anotarIngredientes = (receta: Receta) => {
    const vistas = new Set<string>();
    for (const ing of receta.ingredientes) {
      const meta = datos.ingredientes[ing.canonico];
      if (meta?.es_despensa) continue; // la sal y el aceite están en todo
      // Una receta con tomate frito Y triturado cuenta una vez por su tomate.
      vistas.add(familiaDeSabor(ing.canonico));
    }
    for (const f of vistas) tandasPorSabor.set(f, (tandasPorSabor.get(f) ?? 0) + 1);
  };
  for (const t of tandas) anotarIngredientes(t.receta);

  const minutosPorDia = new Map<number, number>();
  const anotarDia = (receta: Receta, dia: string) => {
    const d = claveDeDia(dia);
    if (!basesPorDia.has(d)) basesPorDia.set(d, new Set());
    for (const b of basesDe(receta)) basesPorDia.get(d)!.add(b);
    if (!diasDeReceta.has(receta.id)) diasDeReceta.set(receta.id, new Set());
    diasDeReceta.get(receta.id)!.add(d);
  };
  for (const h of ocupados) {
    if (!h?.receta) continue;
    anotarProteina(h.dia, h.receta.proteina);
    anotarDia(h.receta, h.dia);
    const minutos = h.tipo === 'cocinado' ? h.receta.minutos : (h.ensamblaje?.minutos ?? 0);
    minutosPorDia.set(claveDeDia(h.dia), (minutosPorDia.get(claveDeDia(h.dia)) ?? 0) + minutos);
  }

  if (arranque?.librearEn != null && !ocupados[arranque.librearEn]) {
    const p = posiciones[arranque.librearEn];
    ocupados[arranque.librearEn] = { dia: p.dia, ranura: p.ranura, receta: null, tipo: 'libre' };
  }

  let sobrasUsadas = ocupados.filter((h) => h && (h.tipo === 'sobras' || h.tipo === 'ensamblaje')).length;
  // La necesidad acumulada es el estado incremental: cada candidato se
  // puntúa clonándola y sumándole SOLO su tanda, en vez de reconstruir el
  // carrito entero (~50.000 veces por generación).
  /**
   * El postre entra AQUÍ, antes del primer candidato, y no al final.
   * `necesidadDePostres` lo deja con la misma forma que cualquier otro
   * ingrediente, así que el coste marginal que guía la selección ya lleva
   * el postre puesto y el tope de presupuesto se respeta de verdad.
   */
  /* Los huecos que ya nacen libres —«no cocino» y los que el usuario dejó así—
     no llevan postre. */
  const libresDeEntrada = new Set<number>();
  ocupados.forEach((h, k) => { if (h?.tipo === 'libre') libresDeEntrada.add(k); });
  const plan = peticion.postre
    ? planDePostres(datos, exclusiones, N, numHuecos, libresDeEntrada)
    : [];
  const basePostres = plan.length ? necesidadDePostres(plan) : undefined;
  let necesidadActual = acumularNecesidad(tandas, datos, N, basePostres);
  let totalesActuales = totalesDeNecesidad(necesidadActual, peticion.existencias);
  let costeActual = totalesActuales.totalCarrito;
  let perecederoActual = totalesActuales.totalPerecedero;
  /**
   * ═══ LO QUE YA SALE DEL ARMARIO CONSUME CUOTA ═══
   *
   * El objetivo de gasto es comida de esta semana, venga de caja o del
   * armario: `construirMejor` ya mide así la holgura (`gastoEfectivo`) para
   * no leer una nevera llena como «no he sabido llenar la semana». Pero las
   * cuotas por hueco de aquí dentro solo restaban el carrito, así que con la
   * nevera llena cada hueco disponía de su cuota ENTERA de dinero nuevo
   * encima de lo que ya tenía en casa.
   *
   * Medido (catalogo/_aud-existencias.ts, 2 personas, 65 €, semana 2 con lo
   * que sobró de la 1): la pasada de holgura, con esta cuota inflada, llevaba
   * el carrito de 40,87 € a 62,45 € —tres bolsas de calamar congelado— para un
   * gasto efectivo de 75,74 €, por encima del propio presupuesto que la
   * pasada dice respetar; con la cocina vacía la misma semana se quedaba en
   * 48,72 €. Tener comida en casa hacía pagar 13,73 € más por caja.
   *
   * El coste marginal de cada candidato sigue siendo por caja a propósito:
   * es lo que hace que el plato que gasta lo abierto salga más barato y gane.
   * Lo que cambia es cuánto queda por gastar.
   */
  let armarioActual = totalesActuales.totalDelArmario;
  let primeraVuelta = true;

  // --- Estado de las restricciones nuevas ---------------------------------
  const objetivo = objetivoDe(peticion);
  const suelo = GRAMOS_POR_NIVEL[peticion.proteina ?? 'normal'];
  // Gramos de proteína que tiene que sumar la semana entera, para todos.
  // ESCALADO por los huecos que de verdad se planifican: con 7 huecos la app
  // resuelve una comida al día, no las dos, y pedirle el suelo diario entero
  // a esa única comida lo hacía matemáticamente imposible — la semana de
  // "solo comidas" salía SIEMPRE marcada como que no llega (26 g frente a
  // 55) por un error de definición, no de comida.
  const objetivoProteina = suelo * DIAS.length * N * (numHuecos / 14);
  const proteinaDe = (r: Receta) => proteinaPorRacion(r, datos, N) * N;
  /** Lo máximo que un hueco puede aportar con ESTE recetario. */
  const techoPorHueco = Math.max(...elegibles.map(proteinaDe));

  /**
   * Cuánto penaliza cada receta por lo reciente que es. Se calcula una vez:
   * la semana pasada pesa PENAL_RECIENTE[0], la anterior [1], y así. Si una
   * receta aparece en dos semanas del historial manda la más reciente.
   */
  const penalPorReceta = new Map<string, number>();
  const memoria = Math.max(0, Math.min(1, peticion.atenuarMemoria ?? 1));
  if (memoria > 0) {
    (peticion.recetasRecientes ?? []).forEach((ids, antiguedad) => {
      const penal = (PENAL_RECIENTE[antiguedad] ?? 0) * memoria;
      if (penal <= 0) return;
      for (const id of ids) {
        if ((penalPorReceta.get(id) ?? 0) < penal) penalPorReceta.set(id, penal);
      }
    });
  }

  const usosPorBase = new Map<string, number>();
  /** Si alguna de las recetas ya elegidas aporta carne o pescado fresco. */
  let hayFrescoEnElMenu = false;
  let proteinaAcumulada = 0;
  let huecosFrescos = 0;
  for (const h of ocupados) {
    if (!h?.receta) continue;
    proteinaAcumulada += proteinaDe(h.receta);
    if (proteinaAnimal(h.receta, datos) === 'fresca') { huecosFrescos++; hayFrescoEnElMenu = true; }
    if (h.tipo === 'cocinado') for (const b of basesDe(h.receta)) usosPorBase.set(b, (usosPorBase.get(b) ?? 0) + 1);
  }

  // El presupuesto es objetivo, no solo techo: se apunta al 95%.
  const presupuesto = peticion.presupuesto ?? Infinity;
  const objetivoGasto = Number.isFinite(presupuesto)
    ? presupuesto * (arranque?.objetivoExtra ?? BANDA_PRESUPUESTO.objetivo)
    : Infinity;

  /**
   * El presupuesto se reparte DE ENTRADA, no según avanza.
   *
   * Antes se dividía lo que quedaba entre los huecos que quedaban. Como los
   * huecos se llenan en orden, el fin de semana siempre llegaba el último y
   * comía las sobras del algoritmo: sábado y domingo salían con garbanzos de
   * 0,46 € porque para entonces el presupuesto estaba agotado. Ahora cada
   * posición tiene su cuota desde el principio y la del fin de semana está
   * reservada: nadie se la puede gastar antes.
   */
  const pesoDe = (k: number) =>
    esFinDeSemanaBueno(posiciones[k].dia, posiciones[k].ranura) ? HOLGURA_FIN_DE_SEMANA : 1;
  const pesoTotal = posiciones.reduce((a, _, k) => a + pesoDe(k), 0);
  const cuotaDe = (k: number) =>
    Number.isFinite(objetivoGasto) ? (objetivoGasto * pesoDe(k)) / pesoTotal : Infinity;

  const libres = () => ocupados.reduce<number>((a, h) => a + (h ? 0 : 1), 0);

  while (libres() > 0) {
    const i = ocupados.findIndex((h) => !h);
    const restantes = libres();
    const distintas = usos.size;
    const finDeSemana = esFinDeSemanaBueno(posiciones[i].dia, posiciones[i].ranura);

    // Lo que se puede gastar en este hueco: su cuota, más lo que hayan
    // ahorrado los huecos ya resueltos. Lo reservado para los que siguen
    // vacíos no se toca — ahí es donde vive la comida del fin de semana.
    let permitidoPorHueco = Infinity;
    if (Number.isFinite(objetivoGasto)) {
      let reservadoParaLosDemas = 0;
      const fraccion = arranque?.fraccionReserva ?? 1;
      for (let k = 0; k < ocupados.length; k++) if (!ocupados[k] && k !== i) reservadoParaLosDemas += cuotaDe(k) * fraccion;
      const delArmario = peticion.cuotaSinArmario ? 0 : armarioActual;
      permitidoPorHueco = Math.max(0, objetivoGasto - costeActual - delArmario - reservadoParaLosDemas);
    }

    // Ritmo de proteína que hace falta de aquí al final para llegar al suelo.
    const proteinaPorHuecoNecesaria = Math.max(0, (objetivoProteina - proteinaAcumulada) / restantes);

    // ¿Alcanza la capacidad de las recetas ya usadas para llenar lo que
    // queda? Si no, hay que estrenar receta sí o sí.
    let capacidad = 0;
    for (const [id, n] of usos) {
      const receta = porId.get(id);
      if (!receta) continue;
      capacidad += (topeTandas - n) * (sobrasUsadas < topeSobras ? rindeEfectivo(receta, 'principal', numHuecos) : 1);
    }
    const obligadoEstrenar = capacidad < restantes;

    // Dos candidatos: el mejor que cabe en el presupuesto y el mejor a secas.
    // El presupuesto es techo duro mientras haya con qué respetarlo; si no
    // queda ninguna opción dentro, se sigue y la semana se marca como que no
    // cuadra (la pantalla ya ofrece las salidas). Sin esto, subir el peso de
    // la proteína disparaba "mucha variedad" al 131% del presupuesto.
    const buscar = (relajado: boolean): Candidato | null => {
      const sello = relajado ? 'relajada:' : '';
      let mejor: Candidato | null = null;
      let mejorDentro: Candidato | null = null;

      for (const receta of elegibles) {
        if (primeraVuelta && arranque?.vetadaAqui === receta.id) continue;
        if (primeraVuelta && arranque?.forzarPrimera && arranque.forzarPrimera !== receta.id) continue;
        const yaUsada = usos.has(receta.id);
        if (yaUsada && usos.get(receta.id)! >= topeTandas) { contar(`${sello}tope_tandas`); continue; }
        if (!yaUsada && distintas >= topeRecetas) { contar(`${sello}tope_variedad`); continue; }
        if (yaUsada && obligadoEstrenar) { contar(`${sello}obligado_estrenar`); continue; }

        // --- Restricciones duras nuevas ---------------------------------
        //
        // Aquí había una regla `obligado_fresco` —"si solo quedan los huecos
        // justos, obliga a carne o pescado fresco"— que la telemetría midió
        // en CERO rechazos sobre una generación completa. Nunca disparaba: el
        // bonus de proteína fresca y el suelo ya colocan la carne mucho antes
        // de llegar a los últimos huecos. Se retira; el invariante que
        // protegía (dos huecos frescos cuando el recetario da para ello) vive
        // ahora como test en motor.test.ts, que es donde se comprueba solo.
        const animal = proteinaAnimal(receta, datos);
        // Ni un tercer plato montado sobre el mismo almidón o la misma legumbre.
        if (!relajado && [...basesDe(receta)].some((b) => (usosPorBase.get(b) ?? 0) >= TOPE_POR_BASE)) {
          contar('tope_por_base');
          continue;
        }
        /**
         * RESERVA DE FRESCO.
         *
         * La regla anterior solo miraba el fin de semana y solo pedía
         * "proteína animal", que el huevo cumple: una semana entera de huevo
         * y conserva la pasaba entera. Al subir el peso del sabor repetido,
         * `poca` en la semana 6 salió con CERO carne o pescado fresco y el
         * test lo cazó.
         *
         * Ahora es una reserva de verdad: si con los huecos que quedan ya no
         * se puede llegar al mínimo, este hueco tiene que ser fresco. Cae con
         * la pasada relajada, como todas las demás, para no devolver nunca
         * una semana vacía.
         */
        if (!relajado && huecosFrescos < minimoFrescos && animal !== 'fresca') {
          // Por huecos: si ya no quedan sitios para llegar al mínimo.
          const libresTrasEste = ocupados.filter((h) => !h).length - 1;
          // Y por CUPO DE RECETAS, que en «poca variedad» es lo que se agota
          // primero: cinco platos distintos, y si los cinco entran sin carne
          // ni pescado el mínimo ya es inalcanzable aunque sobren huecos. Era
          // exactamente el caso de la semana 6: el motor llegaba al final,
          // ninguna receta fresca cabía ya, la pasada estricta se caía 17
          // veces y la relajada se saltaba la reserva entera.
          const cupoNuevasTrasEsta = topeRecetas - distintas - (yaUsada ? 0 : 1);
          if (libresTrasEste < 1 || (!hayFrescoEnElMenu && cupoNuevasTrasEsta < 1)) {
            contar('reserva_de_fresco');
            continue;
          }
        }
        // Y el fin de semana se cocina, no se recalienta.
        if (!relajado && finDeSemana && animal === 'ninguna' && huecosFrescos < minimoFrescos) {
          contar('finde_sin_fresco');
          continue;
        }

        const plan = planificarTanda(receta, numHuecos, posiciones, ocupados, i, {
          permiteSobra: sobrasUsadas < topeSobras,
          diasConSobra,
          ensamblaje: ensamblajeDe(receta),
        });
        if (!plan) { contar(`${sello}sin_sitio_tanda`); continue; } // vecino con la misma receta: prohibido
        const cubre = plan.huecos.length;

        // --- Reglas de comida de verdad, no de hoja de cálculo ------------
        // Salieron de LEER 20 semanas, no de medirlas: "mucha variedad"
        // servía lentejas con verduras a mediodía y lentejas con chorizo por
        // la noche del mismo lunes, y el chilindrón se guisaba fresco viernes
        // Y sábado para cenar el domingo la tanda vieja. Duras en la pasada
        // estricta; la relajada las suelta si el recetario no da para más.
        if (!relajado) {
          let familia = false;
          let repetida = false;
          for (const h of plan.huecos) {
            const d = claveDeDia(h.dia);
            // Ni dos platos de la misma familia el mismo día: misma proteína
            // (dos de huevo, dos de mar) o el mismo almidón/legumbre de base.
            if (receta.proteina !== 'ninguna' && proteinasPorDia.get(d)?.has(receta.proteina)) familia = true;
            for (const b of basesDe(receta)) if (basesPorDia.get(d)?.has(b)) familia = true;
            // Ni volver a COCINAR la misma receta a menos de dos días de la
            // otra tanda: eso es hacer olla pequeña dos veces, lo peor de los
            // dos mundos (más trabajo y más desperdicio).
            const dias = diasDeReceta.get(receta.id);
            if (dias) for (const otro of dias) if (Math.abs(otro - d) < 2) repetida = true;
          }
          if (familia) { contar('familia_mismo_dia'); continue; }
          if (repetida) { contar('tanda_repetida_cerca'); continue; }
        }

        // El suelo de proteína es restricción, no puntuación. Si elegir esto
        // deja el suelo fuera de alcance incluso llenando TODO lo que queda
        // con el plato más proteico del recetario, no sirve. Es poda con
        // vista, no una preferencia: sin ella el greedy se comía el margen en
        // los primeros huecos y descubría que no llegaba cuando ya no había
        // huecos con los que arreglarlo.
        const faltaTras = objetivoProteina - proteinaAcumulada - proteinaDe(receta) * cubre;
        if (!relajado && faltaTras > (restantes - cubre) * techoPorHueco + 1e-9) {
          contar('suelo_inalcanzable');
          continue;
        }
        contar(`${sello}candidato_evaluado`);

        const carritoPrueba = totalesDeNecesidad(
          acumularNecesidad([plan.tanda], datos, N, necesidadActual), peticion.existencias,
        );
        const costeMarginal = (carritoPrueba.totalCarrito - costeActual) / cubre;
        const perecederoMarginal = (carritoPrueba.totalPerecedero - perecederoActual) / cubre;

        const d = claveDeDia(plan.huecos[0].dia);
        const vecinas = new Set([...(proteinasPorDia.get(d) ?? []), ...(proteinasPorDia.get(d - 1) ?? [])]);
        const repiteProteina = vecinas.has(receta.proteina);
        const puestos = ocupados.filter(Boolean).length;
        const cuota = puestos === 0
          ? 0
          : ocupados.filter((h) => h?.receta?.proteina === receta.proteina).length / puestos;

        // El coste ya no se minimiza: solo penaliza lo que se sale de la banda.
        // Mientras quepa en el presupuesto, deciden la proteína y la variedad.
        const excesoCoste = Math.max(0, costeMarginal - permitidoPorHueco);

        /**
         * APROVECHAR LO QUE HAY. Entre dos platos que caben, el motor se
         * quedaba SIEMPRE con el más barato: nada en la puntuación quería
         * gastar. Por eso con 65 € para dos se plantaba en 50 € y las ocho
         * recetas de gama alta que se escribieron para ese hueco —entrecot,
         * cordero, dorada, lubina— no salían nunca. Este término premia usar
         * la asignación del hueco, y lo enciende solo la pasada de
         * aprovechamiento, cuya criba exige que la semana siga cabiendo y no
         * empeore en nada. Se satura en 1: no hay premio por pasarse.
         */
        const aprovechamiento = !arranque?.aprovechar || !Number.isFinite(permitidoPorHueco) || permitidoPorHueco <= 0
          ? 0
          : PESO_APROVECHAR * Math.min(1, costeMarginal / permitidoPorHueco);

        // Premia acercarse al ritmo de proteína que falta; deja de premiar en
        // cuanto está cubierto, para no acabar comprando solomillo.
        const aportePorHueco = proteinaDe(receta);
        const bonusProteina = proteinaPorHuecoNecesaria <= 0
          ? 0
          : PESO_PROTEINA * Math.min(1, aportePorHueco / proteinaPorHuecoNecesaria);

        // Lo que este plan carga de fogón sobre los días que toca, por
        // encima de lo cómodo. Es blanda: si hay que cocinar, se cocina.
        let excesoMinutos = 0;
        for (const h of plan.huecos) {
          const d = claveDeDia(h.dia);
          const suma = (minutosPorDia.get(d) ?? 0)
            + (h.tipo === 'cocinado' ? receta.minutos : (plan.tanda.ensamblaje?.minutos ?? 0));
          excesoMinutos += Math.max(0, suma - MINUTOS_COMODOS_POR_DIA);
        }

        // Comida o cena. Solo cuando se planifican las dos: con siete huecos
        // la ranura se llama "comida" aunque el usuario haya pedido cenas, y
        // el motor no tiene forma de saberlo.
        let penalRegistro = 0;
        if (numHuecos >= 14) {
          const registro = registroDe(receta);
          for (const h of plan.huecos) {
            if (registro === 'comida' && h.ranura === 'cena') penalRegistro += PENAL_CENA_PESADA;
            if (registro === 'cena' && h.ranura === 'comida') penalRegistro += PENAL_COMIDA_LIGERA;
          }
        }

        // Cuántas de sus familias de sabor son ya sabor de fondo de la semana.
        const familias = new Set<string>();
        for (const ing of receta.ingredientes) {
          if (datos.ingredientes[ing.canonico]?.es_despensa) continue;
          familias.add(familiaDeSabor(ing.canonico));
        }
        let sabores = 0;
        for (const f of familias) {
          if ((tandasPorSabor.get(f) ?? 0) >= TANDAS_PARA_SER_SABOR_DE_FONDO) sabores++;
        }

        /**
         * De qué vive este plato, y cuántas tandas de la semana viven ya de lo
         * mismo. Escala: cada tanda previa suma un escalón. Ver
         * PENAL_FUENTE_REPETIDA.
         *
         * Por FAMILIA y no por canónico: `garbanzo_cocido` y `garbanzo_seco`
         * son el mismo garbanzo en el plato, y contándolos por separado la
         * penalización no se activaba nunca — que es el mismo agujero que ya
         * tuvo el tomate con el sabor de fondo.
         */
        const fuentes = new Set<string>();
        for (const ing of receta.ingredientes) {
          const meta = datos.ingredientes[ing.canonico];
          if (!meta || meta.es_despensa) continue;
          if ((meta.proteina_g_por_100 ?? 0) < PROTEINA_QUE_DEFINE_EL_PLATO) continue;
          fuentes.add(familiaDeSabor(ing.canonico));
        }
        let fuentesYaVistas = 0;
        for (const f of fuentes) fuentesYaVistas += tandasPorSabor.get(f) ?? 0;
        /**
         * SALVO QUE EL USUARIO HAYA DICHO QUE LE GUSTA.
         *
         * Lo cazó `preferencias.test.tsx`: con la penalización puesta, marcar
         * ocho platos como favoritos dejaba de servir para nada — ninguno salía.
         * El motivo es de escala: BONUS_FAVORITO son 2,5 € y esta penalización
         * llega a 10, así que un favorito que viva de una fuente repetida no
         * podía ganar por mucho que el usuario lo pidiera.
         *
         * Y eso está mal de principio, no solo de número: repartir las fuentes
         * es una heurística NUESTRA sobre cómo debería verse una buena semana;
         * marcar un favorito es una instrucción SUYA. Cuando chocan, gana la
         * instrucción. Subir el bonus habría tapado el síntoma dejando la app
         * discutiendo con el usuario en todo lo demás.
         *
         * El riesgo de que ocho favoritos de garbanzo hagan una semana de
         * garbanzo existe y se acepta: lo pidió él, y BONUS_VARIEDAD sigue
         * impidiendo que sea el MISMO plato una y otra vez.
         */
        if (favoritos?.has(receta.id)) fuentesYaVistas = 0;

        const puntuacion =
          -excesoCoste
          + aprovechamiento
          - PENAL_POR_MINUTO_DE_MAS * excesoMinutos
          - penalRegistro
          - PESO_SABOR_REPETIDO * sabores
          - PENAL_FUENTE_REPETIDA * fuentesYaVistas
          - objetivo.peso * perecederoMarginal
          + bonusProteina
          + (animal === 'fresca' ? BONUS_PROTEINA_FRESCA : 0)
          + (yaUsada ? 0 : BONUS_VARIEDAD)
          - (repiteProteina ? PENAL_PROTEINA_REPETIDA : 0)
          - PESO_CUOTA_PROTEINA * cuota
          // Lo que se comió las semanas anteriores. Solo cuenta al ESTRENAR:
          // si la receta ya está en esta semana, repetirla dentro de la
          // semana es una decisión de variedad que ya gobierna BONUS_VARIEDAD.
          - (yaUsada ? 0 : (penalPorReceta.get(receta.id) ?? 0))
          // Y lo que el usuario ha dicho que le gusta. Mismo `yaUsada ? 0 :` y
          // por el mismo motivo. Ver BONUS_FAVORITO para el peso.
          + (yaUsada || !favoritos?.has(receta.id) ? 0 : (peticion.pesoFavorito ?? BONUS_FAVORITO));

        const candidato = { tanda: plan.tanda, nuevos: plan.huecos, puntuacion };
        if (!mejor || puntuacion > mejor.puntuacion) mejor = candidato;
        if (carritoPrueba.totalCarrito <= presupuesto && (!mejorDentro || puntuacion > mejorDentro.puntuacion)) {
          mejorDentro = candidato;
        }
      }

      if (!relajado && mejor && !mejorDentro) contar('eleccion_fuera_presupuesto');
      return mejorDentro ?? mejor;
    };

    // Las reglas de "cómo debería verse una buena semana" —proteína fresca y
    // tope por base— son deseos, no leyes. Si con ellas no sobrevive ningún
    // candidato, se sueltan PARA ESTE HUECO en vez de tirar la semana entera.
    // Bajo "vegano" solo quedan 26 recetas montadas sobre cuatro legumbres: el
    // tope de dos platos por base agota el recetario a mitad de semana. La
    // salida correcta es una semana con una legumbre repetida, no ninguna.
    const estricto = buscar(false);
    if (!estricto) contar('pasada_relajada_necesaria');
    const mejor = estricto ?? buscar(true);
    if (!mejor) return null; // ni estrenando ni repitiendo se puede llenar

    tandas.push(mejor.tanda);
    anotarIngredientes(mejor.tanda.receta);
    usos.set(mejor.tanda.receta.id, (usos.get(mejor.tanda.receta.id) ?? 0) + 1);
    for (const b of basesDe(mejor.tanda.receta)) usosPorBase.set(b, (usosPorBase.get(b) ?? 0) + 1);
    for (const h of mejor.nuevos) {
      const indice = posiciones.findIndex((p) => p.dia === h.dia && p.ranura === h.ranura);
      ocupados[indice] = h;
      anotarProteina(h.dia, mejor.tanda.receta.proteina);
      anotarDia(mejor.tanda.receta, h.dia);
      const minutos = h.tipo === 'cocinado' ? mejor.tanda.receta.minutos : (h.ensamblaje?.minutos ?? 0);
      minutosPorDia.set(claveDeDia(h.dia), (minutosPorDia.get(claveDeDia(h.dia)) ?? 0) + minutos);
      proteinaAcumulada += proteinaDe(mejor.tanda.receta);
      if (h.ensamblaje) proteinaAcumulada += proteinaDeEnsamblaje(h.ensamblaje, datos, N) * N;
      if (proteinaAnimal(mejor.tanda.receta, datos) === 'fresca') { huecosFrescos++; hayFrescoEnElMenu = true; }
      if (h.tipo === 'sobras' || h.tipo === 'ensamblaje') sobrasUsadas++;
    }

    necesidadActual = acumularNecesidad([mejor.tanda], datos, N, necesidadActual);
    totalesActuales = totalesDeNecesidad(necesidadActual, peticion.existencias);
    costeActual = totalesActuales.totalCarrito;
    perecederoActual = totalesActuales.totalPerecedero;
    armarioActual = totalesActuales.totalDelArmario;
    primeraVuelta = false;
  }

  const huecos = ocupados.map((h, k) => h ?? { ...posiciones[k], receta: null, tipo: 'libre' as const });
  return { huecos, tandas, postres: plan, carrito: calcularCarrito(tandas, datos, N, peticion.existencias, plan) };
}

const ORDEN_VARIEDAD: Variedad[] = ['poca', 'normal', 'mucha'];

/**
 * El greedy es miope: la primera receta condiciona todo el reparto, y a veces
 * la que menos cuesta de entrada lleva a una semana peor. Sin esto, con 4
 * comensales "poca variedad" salía MÁS CARA que "normal" (53,36 € frente a
 * 51,05 €), que es justo lo contrario de lo que la pantalla promete.
 *
 * Se rehace la semana forzando cada receta como primera y se queda la más
 * barata. Sigue siendo determinista y acotado: nº de recetas × la pasada
 * greedy normal.
 */
/**
 * Cuántos arranques distintos se prueban. Es un tope de coste, no de calidad:
 * el trabajo del greedy crece con el CUADRADO del recetario, así que con 10
 * recetas probarlas todas costaba 60 ms y con 50 se iba por encima de dos
 * minutos — y esto corre en el móvil del usuario cada vez que toca la
 * variedad. Se siembra con las recetas más baratas por ración, que son las
 * que de verdad pueden ganar cuando el objetivo es el carrito más barato.
 */
const SEMILLAS_REINTENTO = 8;

/**
 * Platos distintos que se van soltando sobre el tope del nivel cuando sobra
 * presupuesto. Se prueba de menos a más y se para en cuanto la semana entra
 * en la banda: soltar el tope entero de golpe convierte "poca variedad" en
 * otra cosa, y el usuario eligió ese nivel a propósito.
 */
const VARIEDAD_EXTRA = [1, 2, 3, 4];

/**
 * Lo que se prueba cuando sobra presupuesto, de menos a más atrevido: primero
 * usar mejor lo que ya se tiene, luego soltar platos distintos, y por último
 * las dos cosas a la vez. Todo pasa por la misma criba, así que probar de más
 * no puede empeorar la semana — solo cuesta tiempo, y solo se paga cuando de
 * verdad sobra dinero.
 */
/**
 * Las palancas de la pasada de aprovechamiento y los valores que se le
 * prueban a cada una, en orden de menos a más invasiva.
 *
 * NO se cruzan todas con todas: la rejilla completa son 31 construcciones y
 * medida costaba 1,1 s en el peor caso, con esto corriendo en el móvil del
 * usuario cada vez que mueve el deslizador. Se recorre por coordenadas —se
 * fija la mejor de cada palanca y se pasa a la siguiente—, que son 14 en el
 * peor caso y menos de la mitad en la práctica por el corte de arriba.
 */
const PALANCAS_HOLGURA: { clave: keyof ArranqueParcial; valores: number[] }[] = [
  // Apuntar por encima de 1 es lo que hace que el greedy se atreva con los
  // platos caros en vez de descartarlos por cuota; el reintento de techo lo
  // baja hasta que quepa.
  { clave: 'objetivoExtra', valores: [0.99, 1, 1.15] },
  { clave: 'fraccionReserva', valores: [0.7, 0.45, 0.25] },
  { clave: 'fraccionSobras', valores: [0.6, 0.3, 0] },
  { clave: 'variedadExtra', valores: VARIEDAD_EXTRA },
];

/**
 * Cuando la semana llega a esta parte del presupuesto se deja de probar. No
 * se apunta al 100%: los precios de Mercadona se mueven y media docena de
 * productos son de peso variable, así que prometer 64,90 € sobre 65 € es
 * prometer un ticket que puede salir a 66 y dejar al usuario con la sensación
 * de que la app le ha mentido. El margen es parte del producto.
 */
const GASTO_SUFICIENTE = 0.97;

/**
 * ═══ LA PASADA DE HOLGURA ESTÁ APAGADA PARA LA BETA (13 oct 2026) ═══
 *
 * El presupuesto es el dinero máximo que el usuario quiere pagar por caja: un
 * límite, no una meta. La pasada de holgura lo trataba como meta —rehacía la
 * semana para acercarla al 95 % del tope— y, medido sobre seis hogares y 21
 * semanas encadenadas con despensa (docs/motor-variantes-informe-2026-10-13.md):
 *
 *   · costaba un 5,5 % más de compra neta de inventario (866 € frente a 818 €),
 *   · con los mismos 9 platos, el mismo reparto de fuentes de proteína y el
 *     mismo perecedero (81,1 € frente a 81,2 €),
 *   · a cambio de +0,4 g de proteína por persona y día,
 *   · y producía la única regresión clara de la cuota con despensa: una persona
 *     con 45 € pagaba 2,59 € más por una semana con la mitad de carne o pescado.
 *   · Y era la mitad de la latencia: 280 ms por semana contra 107 en PC.
 *
 * Lo que se pierde al apagarla, también medido: la semana 1 del caso de
 * arranque (2 personas, 65 €) baja de 62,02 € a 54,32 €, con 55,7 g de
 * proteína en vez de 58,8 (suelo 55) y 6 huecos con carne o pescado en vez
 * de 7. La pantalla enseña más sobrante, y el selector de variedad —que ya
 * pone el precio de cada nivel al lado— es donde el usuario decide gastarlo.
 *
 * El código de la pasada se conserva entero y se enciende con `conHolgura`
 * para comparaciones internas (catalogo/_aud-variantes.ts). No es una opción
 * de usuario.
 */
const PASADA_DE_HOLGURA = false;

/**
 * NOTA DE UN CALLEJÓN SIN SALIDA, para que no se vuelva a intentar sin datos.
 *
 * Esta pasada NO garantiza que subir el presupuesto mejore la semana: el
 * greedy depende del camino y el objetivo interno se calcula sobre el
 * presupuesto, así que con 65 € puede tomar una ruta de la que ya no sale.
 * Medido: `poca·alta` con 55 € come 36,66 € y con 65 € come 33,50 €.
 *
 * Se probó a arreglarlo con una rejilla de objetivos en EUROS en vez de en
 * porcentaje —que hace la monotonía cierta por construcción, porque 65 €
 * puede probar todo lo que probaría 55 €—. Cierra esa celda y empeora el
 * conjunto: 93,3% de presupuesto y 35,08 € comidos por semana, contra 94,2%
 * y 35,44 € con la rejilla relativa. Arreglar el agujero de verdad pide dejar
 * el greedy, no otra rejilla.
 */

/**
 * Cuánto perecedero de más se admite por cada euro de comida que se gana.
 *
 * Barrido sobre 243 semanas, mirando lo que acaba en el plato y lo que acaba
 * en la basura:
 *
 *   tope     presupuesto   se come/semana   perecedero
 *   0,15        86,9%         32,41 €         3,76 €
 *   0,30        90,0%         33,61 €         4,18 €
 *   0,50        92,6%         34,77 €         4,61 €
 *   0,80        94,2%         35,44 €         5,16 €
 *   sin tope    94,9%         35,37 €         5,73 €
 *
 * 0,80 no es un punto de compromiso: DOMINA a no poner tope. Se come más
 * comida (35,44 contra 35,37) tirando medio euro menos. Sin el tope el motor
 * compra bandejas que no llega a gastar, y eso ni alimenta ni ahorra.
 */
const MAXIMO_TIRADO_POR_EURO = 0.8;

/**
 * TECHO ABSOLUTO DE DESPERDICIO: qué fracción de lo que se come puede acabar
 * en la basura.
 *
 * MAXIMO_TIRADO_POR_EURO acota el INCREMENTO de perecedero por cada euro de
 * comida ganado, pero no el total, y la búsqueda por coordenadas da dos
 * vueltas sobre cuatro palancas: cada paso pasa la prueba por separado y la
 * deriva se acumula sin freno.
 *
 * La despensa lo agrava. Su comida cuenta en totalConsumo pero cuesta 0 € en
 * el carrito, así que el "he ganado comida" que autoriza más desperdicio se
 * infla gratis. Medido en ocho semanas seguidas con 65 € para dos:
 *
 *   sin despensa   17,6% de media, peor semana 24,8%
 *   con despensa   23,1% de media, peor semana 34,2%
 *
 * Con lo cual la despensa —que existe para AHORRAR— ahorraba 3,77 € de
 * carrito y hacía tirar 3,73 € más: cuatro céntimos netos. Ver el barrido de
 * este valor en catalogo/_aud-barrido-tope.ts.
 */
const TOPE_DESPERDICIO = 0.20;

/** Veces que un intento que se pasa vuelve a probar apuntando más bajo. */
const REINTENTOS_DE_TECHO = 2;
/** Y cuánto se queda por debajo al reapuntar, para no volver a pasarse. */
const MARGEN_DE_AJUSTE = 0.97;

function construirMejor(peticion: PeticionSemana, aFondo = true): Construida | null {
  const minutosMax = MINUTOS_POR_ESFUERZO[peticion.esfuerzo ?? 'libre'];
  const ordenadas = recetarioAdaptado(peticion.datos, peticion.exclusiones, minutosMax, peticion.platosBloqueados)
    .map((r) => ({ r, coste: consumoPorRacion(r, peticion.datos, peticion.N) }))
    .sort((a, b) => a.coste - b.coste)
    .map((x) => x.r);

  const suelo = GRAMOS_POR_NIVEL[peticion.proteina ?? 'normal'];
  const presupuesto = peticion.presupuesto ?? Infinity;

  /**
   * Orden de preferencia entre arranques. Antes era solo "el carrito más
   * barato", y eso tiraba por la borda todo el trabajo de proteína que hace
   * construir(): entre una semana de 47 € con 61 g y otra de 46 € con 54 g
   * ganaba siempre la segunda, y el suelo no se cumplía nunca por un euro.
   * Primero que alimente, luego que quepa, y solo entonces el criterio del
   * nivel — que en "básica" es tirar poco y en "alta" es costar poco.
   */
  const criterio = objetivoDe(peticion).criterio;
  const rango = (c: NonNullable<ReturnType<typeof construir>>) => {
    const nutricion = nutricionDe(c.huecos, peticion.datos, peticion.N, suelo);
    return [
      nutricion.cumpleSuelo ? 0 : 1,
      c.carrito.totalCarrito <= presupuesto ? 0 : 1,
      criterio(c.carrito.totalCarrito, c.carrito.totalPerecedero, c.carrito.totalConsumo),
    ];
  };

  let mejor: ReturnType<typeof construir> = null;
  let rangoMejor: number[] | null = null;
  const probar = (semillas: Receta[]) => {
    for (const receta of semillas) {
      const intento = construir(peticion, { forzarPrimera: receta.id });
      if (!intento) continue;
      const r = rango(intento);
      if (!mejor || mejorRango(r, rangoMejor!)) { mejor = intento; rangoMejor = r; }
    }
  };

  // Arranques por etapas: 8 baratas → 24 → todas. Medido en
  // catalogo/_aud-gap.ts: "mucha·normal" con 8 semillas salía a 56,55 € (no
  // cabe en 51) y con todas cumplía suelo y presupuesto — la semana existía
  // y el recorte de semillas la escondía. Cada etapa solo se paga si la
  // anterior no consiguió suelo+presupuesto, donde la alternativa es enseñar
  // una semana rota. `aFondo=false` es para las sondas de diagnóstico
  // (salidas, presupuesto necesario): ahí basta la estimación de 8 semillas
  // y escalar multiplicaba el peor caso hasta 6 segundos.
  const consiguio = () => rangoMejor && rangoMejor[0] === 0 && rangoMejor[1] === 0;
  probar(ordenadas.slice(0, SEMILLAS_REINTENTO));
  if (aFondo && !consiguio()) probar(ordenadas.slice(SEMILLAS_REINTENTO, 24));
  if (aFondo && !consiguio()) probar(ordenadas.slice(24));

  /**
   * DEGRADACIÓN. Si con la memoria entera no sale una semana que cumpla
   * suelo y presupuesto, se afloja la memoria antes que romper ninguno de
   * los dos: repetir el plato de la semana pasada es un mal menor frente a
   * quedarse corto de proteína o pasarse del dinero. Y el usuario no pidió
   * "no repetir": pidió una semana que cuadre.
   *
   * Solo entra cuando hay memoria que aflojar; sin historial, este bloque no
   * cuesta nada. Los niveles son 50% y 0%: bajar de dos en dos no cambiaba
   * ninguna decisión en las pruebas y sí duplicaba el peor caso.
   */
  const hayMemoria = (peticion.recetasRecientes ?? []).some((s) => s.length > 0);
  if (aFondo && hayMemoria && !consiguio()) {
    for (const atenuar of [0.5, 0]) {
      const suelto = construirMejor({ ...peticion, atenuarMemoria: atenuar }, false);
      if (!suelto) continue;
      const r = rango(suelto);
      if (!mejor || mejorRango(r, rangoMejor!)) { mejor = suelto; rangoMejor = r; }
      if (consiguio()) break;
    }
  }

  /**
   * APROVECHAR LA HOLGURA.
   *
   * El desempate entre arranques es, en último término, "la más barata". Con
   * el presupuesto apretado eso es exactamente lo que hay que hacer, pero en
   * cuanto deja de apretar el motor se planta: medido a N=2, con 40 € gastaba
   * el 98% y con 90 € el 66%, y entre medias la proteína no se movía de 55-59
   * g y los platos distintos se quedaban clavados en 9 —el tope del nivel—
   * costase lo que costase la semana. El dinero de más no compraba NADA. Y la
   * pantalla, mientras tanto, ofrecía "te sobran 14,82 €, sube la variedad y
   * te los gasto en mejor comida": una promesa que el motor no cumplía.
   *
   * `BANDA_PRESUPUESTO.minimo` llevaba desde el principio escrito en el
   * fichero sin que nadie lo leyera. Esto es lo que lo lee: si la semana se
   * queda por debajo de esa banda, se rehace soltando el tope de variedad y
   * se acepta solo si cabe, no baja la proteína y de verdad estrena platos.
   * Nunca puede empeorar la semana: en el peor caso se descarta.
   */
  /**
   * EL GASTO QUE CUENTA incluye lo que sale del armario.
   *
   * Sin esto, una semana con la nevera llena salía a 16,75 € de carrito sobre
   * 64 € de presupuesto y el motor lo leía como "no he sabido llenar la
   * semana": se ponía a comprar de más para cubrir un hueco que no existía
   * —esa semana ya se comía 28,96 € de comida— y los totales salían
   * erráticos de una semana a otra. Los euros del armario son euros de comida
   * pagados en una semana anterior, no presupuesto sin usar.
   */
  const gastoEfectivo = (c: Construida) => c.carrito.totalCarrito + c.carrito.totalDelArmario;
  const holgura = (c: Construida) => presupuesto * BANDA_PRESUPUESTO.minimo - gastoEfectivo(c);
  /* Experimento (ver PeticionSemana.holguraPorCalidad): sin banda, la pasada
     entra siempre que quede dinero y para cuando ninguna palanca aporta. */
  const porCalidad = peticion.holguraPorCalidad;
  const hayHueco = (c: Construida) => (porCalidad ? c.carrito.totalCarrito < presupuesto : holgura(c) > 0);
  const holguraActiva = (peticion.conHolgura ?? PASADA_DE_HOLGURA) && !peticion.sinHolgura;
  if (aFondo && holguraActiva && mejor && Number.isFinite(presupuesto) && hayHueco(mejor)) {
    /**
     * Y se ordena por CALIDAD, no por variedad. La primera versión de esta
     * pasada solo aceptaba semanas con más platos distintos, y se notó en la
     * medida: a 80 € pasaba de gastar el 66% al 88%, pero la proteína seguía
     * clavada en 58 g y los huecos con carne o pescado fresco en 8. Gastaba
     * el dinero de más en MÁS platos, no en MEJORES: catorce comidas de pollo
     * en vez de nueve. Lo que compra el euro de más, por orden, es carne o
     * pescado fresco, luego proteína, y solo al final variedad.
     */
    const antes = nutricionDe(mejor.huecos, peticion.datos, peticion.N, suelo);
    const distintasDe = (c: Construida) => new Set(c.tandas.map((t) => t.receta.id)).size;
    let mejorFresca = antes.huecosConFresca;
    let mejorDistintas = distintasDe(mejor);
    let mejorGasto = gastoEfectivo(mejor);
    /**
     * Y lo que de verdad se persigue: EUROS QUE SE COMEN, no euros que pasan
     * por caja.
     *
     * La primera versión aceptaba por `totalCarrito` y medida hacía justo lo
     * que el proyecto tiene prohibido: con 65 € subía el carrito 13,72 € y de
     * eso solo 5,31 € llegaban al plato —el 39%—, 2,02 € se tiraban y 6,38 €
     * se quedaban en el armario. El perecedero pasaba de 3,59 € a 7,35 €.
     * Gastar el presupuesto entero comprando comida que no se come es peor
     * que no gastarlo: el usuario paga por bolsas de arroz a medias.
     */
    let mejorConsumo = mejor.carrito.totalConsumo;
    let mejorPerecedero = mejor.carrito.totalPerecedero;

    /**
     * ═══ EXPERIMENTO · ACEPTAR SOLO POR CALIDAD EXPLÍCITA ═══
     *
     * Solo con `holguraPorCalidad`. En vez de perseguir la banda del
     * presupuesto, un intento entra si gasta como mucho `topeExtra` del tope
     * más que la semana base, no pierde nada (proteína, fresco mínimo, sobras,
     * platos distintos, repetición de fuentes, perecedero) y gana en algo que
     * el usuario ve: un plato distinto más o una fuente de proteína menos
     * repetida (`variedad-fuentes`), o menos repetición o menos basura
     * (`fuentes-perecedero`). Una semana más barata e igual de buena también
     * entra: no es un incremento de gasto.
     */
    const trioDeFuentes = (c: Construida) => {
      const cuenta = new Map<string, number>();
      for (const t of c.tandas) {
        const vistas = new Set<string>();
        for (const ing of t.receta.ingredientes) {
          const meta = peticion.datos.ingredientes[ing.canonico];
          if (!meta || meta.es_despensa) continue;
          if ((meta.proteina_g_por_100 ?? 0) < PROTEINA_QUE_DEFINE_EL_PLATO) continue;
          vistas.add(familiaDeSabor(ing.canonico));
        }
        for (const v of vistas) cuenta.set(v, (cuenta.get(v) ?? 0) + 1);
      }
      return [...cuenta.values()].sort((a, b) => b - a).slice(0, 3).reduce((a, b) => a + b, 0);
    };
    const carritoBase = mejor.carrito.totalCarrito;
    let mejorCarrito = carritoBase;
    let mejorTrio = trioDeFuentes(mejor);
    const aceptarPorCalidad = (suelto: Construida, ahora: SemanaGenerada['nutricion']): boolean => {
      if (!porCalidad) return false;
      const carrito = suelto.carrito.totalCarrito;
      if (carrito - carritoBase > porCalidad.topeExtra * presupuesto + 0.005) return false;
      if (ahora.proteinaPorPersonaDia < antes.proteinaPorPersonaDia - 0.05) return false;
      if (ahora.huecosConFresca < MINIMO_HUECOS_FRESCOS) return false;
      const sobras = (c: Construida) => c.huecos.filter((h) => h.tipo !== 'cocinado').length;
      if (sobras(suelto) < sobras(mejor!)) return false;
      const distintas = distintasDe(suelto);
      const trio = trioDeFuentes(suelto);
      const perecedero = suelto.carrito.totalPerecedero;
      const margen = (porCalidad.toleranciaPerecedero ?? 0) * Math.max(0, carrito - mejorCarrito);
      if (distintas < mejorDistintas || trio > mejorTrio || perecedero > mejorPerecedero + 0.005 + margen) return false;
      const gana = porCalidad.criterio === 'variedad-fuentes'
        ? distintas > mejorDistintas || trio < mejorTrio
        : trio < mejorTrio || perecedero < mejorPerecedero - 0.5;
      const masBarata = carrito < mejorCarrito - 0.005;
      if (!gana && !masBarata) return false;
      mejor = suelto;
      mejorCarrito = carrito;
      mejorDistintas = distintas;
      mejorTrio = trio;
      mejorPerecedero = perecedero;
      mejorFresca = Math.max(mejorFresca, ahora.huecosConFresca);
      mejorGasto = gastoEfectivo(suelto);
      mejorConsumo = Math.max(mejorConsumo, suelto.carrito.totalConsumo);
      return true;
    };

    /**
     * MEJOR EN TODO O NO ENTRA. Con "fresco primero y proteína después"
     * bastaba para que `básica·poca` pasara de 54 g a 44 g a cambio de un
     * hueco de pescado: cumplía el suelo, así que colaba. La holgura no puede
     * pagarse con nada, y la forma de garantizarlo es no aceptar ningún
     * retroceso en ningún eje. Con todo igual o mejor, gana la que pone más
     * comida en la mesa.
     */
    const probarHolgura = (intento: ArranqueParcial): boolean => {
      /**
       * Y si se pasa, se apunta más bajo en vez de tirar el intento.
       *
       * Sin esto la búsqueda era todo o nada y se veía: en `poca` con 65 €,
       * soltar la reserva daba 68,07 € —se pasa, fuera— y lo anterior que
       * cabía eran 51,33 €. Catorce euros de hueco entre dos escalones
       * contiguos, y la celda se quedaba clavada en el 76% del presupuesto.
       * El reintento escala el objetivo por lo que se ha pasado, así que
       * aterriza cerca del techo en una o dos pasadas más.
       */
      let cfg = intento;
      let suelto = construir(peticion, cfg);
      for (let ajuste = 0; ajuste < REINTENTOS_DE_TECHO && suelto; ajuste++) {
        if (suelto.carrito.totalCarrito <= presupuesto) break;
        const apunta = cfg.objetivoExtra ?? BANDA_PRESUPUESTO.objetivo;
        const bajado = apunta * (presupuesto / suelto.carrito.totalCarrito) * MARGEN_DE_AJUSTE;
        if (bajado >= apunta) break;
        cfg = { ...cfg, objetivoExtra: bajado };
        suelto = construir(peticion, cfg);
      }
      if (!suelto || suelto.carrito.totalCarrito > presupuesto) return false;
      const ahora = nutricionDe(suelto.huecos, peticion.datos, peticion.N, suelo);
      if (porCalidad) return aceptarPorCalidad(suelto, ahora);
      /**
       * La PROTEÍNA no se toca: fue lo que se rompió cuando esta pasada
       * ordenaba por fresco (54 g → 44 g a cambio de un hueco de pescado) y
       * es lo único que el usuario ha pedido explícitamente con el selector.
       *
       * El fresco y la variedad admiten un hueco de menos. Exigirlos clavados
       * bloqueaba la pasada entera: `poca` con 65 € arrancaba con DIEZ huecos
       * de pescado o carne fresca, así que ninguna semana mejor entraba nunca
       * y la celda se quedaba en el 76% del presupuesto. Diez huecos frescos
       * de 49 € no son mejor comida que nueve de 63 €.
       */
      if (ahora.proteinaPorPersonaDia < antes.proteinaPorPersonaDia - 0.05) return false;
      if (ahora.huecosConFresca < Math.max(MINIMO_HUECOS_FRESCOS, mejorFresca - 1)) return false;
      const distintas = distintasDe(suelto);
      if (distintas < mejorDistintas - 1) return false;
      const gasto = gastoEfectivo(suelto);
      const consumo = suelto.carrito.totalConsumo;
      const perecedero = suelto.carrito.totalPerecedero;
      /**
       * El euro de más tiene que acabar en un plato. Se acepta si sube lo que
       * se come, y solo si lo que se tira no crece más deprisa que eso: un
       * plato nuevo que aporta 2 € de comida y deja 1,50 € de perecedero en
       * la nevera no es un plato nuevo, es una bolsa de basura más cara.
       */
      const ganaConsumo = consumo > mejorConsumo + 0.005;
      const tiraDeMas = perecedero - mejorPerecedero;
      if (ganaConsumo && tiraDeMas > (consumo - mejorConsumo) * MAXIMO_TIRADO_POR_EURO) return false;
      /**
       * Y el euro de más tiene que llegar al PLATO, no al armario. La regla de
       * arriba compara la basura con el consumo; esta compara el consumo con
       * lo que se gasta, que es lo que faltaba. Ver RENDIMIENTO_MINIMO_HOLGURA.
       */
      const gastaDeMas = gasto - mejorGasto;
      const minimo = peticion.rendimientoHolgura ?? RENDIMIENTO_MINIMO_HOLGURA;
      if (gastaDeMas > 0.01 && (consumo - mejorConsumo) < minimo * gastaDeMas) return false;
      /**
       * Y NO PUEDE QUITAR SOBRAS.
       *
       * Cocinar una vez y comer dos es una promesa del producto, no un efecto
       * secundario. Sin este freno la pasada compraba huecos cocinados con el
       * dinero de la holgura: medido con poca variedad y 51 €, la semana 6
       * pasaba de nueve huecos cocinados a los catorce —y encima más barata,
       * 49,13 € frente a 50,89—. El usuario pagaba casi lo mismo por cocinar
       * cinco veces más.
       *
       * Además destapó que un invariante se sostenía por suerte: las semanas 6
       * y 7 acababan las dos con los catorce huecos cocinados, la misma forma
       * exacta, y una semana no puede parecerse a la anterior. La silueta dice
       * qué huecos PUEDEN ser sobras, no cuáles tienen que serlo, así que nada
       * impedía que dos semanas seguidas colapsaran a "todo cocinado".
       */
      const sobrasDe = (c: Construida) => c.huecos.filter((h) => h.tipo !== 'cocinado').length;
      if (sobrasDe(suelto) < sobrasDe(mejor!)) return false;
      /**
       * Y un techo sobre el TOTAL, que es lo que faltaba. La regla de arriba
       * mira el paso; esta mira dónde has acabado. Solo bloquea si además la
       * fracción empeora: si la semana de partida ya viene por encima del
       * techo, seguir dejándola mejorar es justo lo que hay que hacer —
       * bloquear todo la dejaría congelada en su peor versión.
       */
      const tope = peticion.topeDesperdicio ?? TOPE_DESPERDICIO;
      const fraccion = consumo > 0 ? perecedero / consumo : 0;
      const fraccionAntes = mejorConsumo > 0 ? mejorPerecedero / mejorConsumo : 0;
      if (fraccion > tope && fraccion > fraccionAntes) return false;
      if (!ganaConsumo && perecedero > mejorPerecedero + 0.005) return false;
      if (ahora.huecosConFresca <= mejorFresca && distintas <= mejorDistintas && !ganaConsumo) return false;
      mejor = suelto;
      // El listón se guarda al ALTO, no al último aceptado: si no, cada
      // aceptación baja el suyo y el fresco se escurre hueco a hueco.
      mejorFresca = Math.max(mejorFresca, ahora.huecosConFresca);
      mejorDistintas = Math.max(mejorDistintas, distintas);
      mejorGasto = gasto;
      mejorConsumo = Math.max(mejorConsumo, consumo);
      mejorPerecedero = perecedero;
      return true;
    };

    // Búsqueda por coordenadas: se fija el mejor valor de cada palanca y se
    // pasa a la siguiente arrastrando lo ya elegido.
    /**
     * Búsqueda por coordenadas: se fija el mejor valor de cada palanca y se
     * pasa a la siguiente arrastrando lo elegido. Dos vueltas, porque hay
     * palancas que por separado no aportan y juntas sí —soltar la reserva no
     * sirve si no hay platos caros que comprar, y al revés— y con una sola
     * vuelta la celda de `poca` con 65 € se quedaba en el 76%.
     *
     * Se probó también bajar una escalera de objetivos desde arriba cogiendo
     * el primero que cupiera. Sale peor (95,2% contra 96,1%) y diez veces más
     * lento en el peor caso: cada escalón que se pasa arrastra sus reintentos
     * de techo, y quedarse con el primero que entra fija un resultado
     * mediocre del que ya no se sale.
     */
    const fijado: ArranqueParcial = { aprovechar: true };
    // Sin banda que perseguir (experimento), la pasada no para por gasto.
    const suficiente = () => !porCalidad && mejorGasto >= presupuesto * GASTO_SUFICIENTE;
    probarHolgura(fijado);
    for (let vuelta = 0; vuelta < 2; vuelta++) {
      if (suficiente()) break;
      for (const { clave, valores } of PALANCAS_HOLGURA) {
        if (suficiente()) break;
        let ganador: number | undefined;
        for (const v of valores) {
          if (v === fijado[clave]) continue;
          if (probarHolgura({ ...fijado, [clave]: v })) ganador = v;
          if (suficiente()) break;
        }
        if (ganador !== undefined) (fijado as Record<string, unknown>)[clave] = ganador;
      }
    }
  }

  /**
   * ═══ SUBIR EL TOPE NO PUEDE DARTE MENOS COMIDA ═══
   *
   * Medido antes de esto, con una persona y catorce huecos:
   *
   *     tope 45 €  →  carrito 39,05 €   come 16,86 €
   *     tope 65 €  →  carrito 46,86 €   come 15,74 €   ← 7,81 € más, 1,12 € menos
   *
   * Le das veinte euros más al motor y come menos. En una app cuya tesis es que
   * el dinero se convierte en comida, no hay ningún fallo peor que ese.
   *
   * ═══ POR QUÉ NO LO PILLABA NADA ═══
   *
   * El pase de holgura sí protege el consumo, pero solo DENTRO de una
   * construcción: guarda `mejorConsumo` al alto y no acepta ningún candidato
   * que baje de ahí. Lo que no puede ver es que el punto de partida ya sea
   * peor, y lo es: `BANDA_PRESUPUESTO.objetivo` entra en la puntuación hueco a
   * hueco, así que con más tope el greedy toma otras decisiones desde el primer
   * plato. Cuando la holgura llega, ya está en otro valle.
   *
   * ═══ LA GUARDA ═══
   *
   * Se construye también con el tope encogido y se compara. Si la semana del
   * tope grande no da más comida que la del pequeño, se devuelve la pequeña:
   * misma o más comida por menos dinero, y el usuario se queda con la holgura
   * en el bolsillo en vez de en el cubo.
   *
   * Solo se paga cuando puede pasar. Con el tope apretado —la semana ya gasta
   * casi todo— encogerlo solo puede dar una semana peor, así que ni se prueba;
   * y esa es la mayoría de los casos, que son los del usuario que ajusta su
   * presupuesto de verdad.
   */
  return mejor ?? construir(peticion);
}

/**
 * Genera la semana. Si no cuadra con el presupuesto, no levanta un muro: da
 * las dos salidas — cuánto costaría con menos variedad, y a cuánto habría que
 * subir el presupuesto para mantener la que pidió.
 */
/** Cuántos huecos se podrían llenar como mucho con estas restricciones. */
function huecosCubribles(peticion: PeticionSemana): { vivas: number; cubribles: number } {
  const minutosMax = MINUTOS_POR_ESFUERZO[peticion.esfuerzo ?? 'libre'];
  const bloqueados = peticion.platosBloqueados?.length ? new Set(peticion.platosBloqueados) : null;
  const vivas = peticion.datos.recetas.filter(
    (r) => !bloqueados?.has(r.id)
      && recetaPermitida(r, peticion.exclusiones ?? [], minutosMax, peticion.datos.ingredientes),
  );
  const rinde = (r: Receta) =>
    FRACCION_SOBRAS_POR_VARIEDAD[peticion.variedad] > 0 ? rindeEfectivo(r, 'principal', peticion.numHuecos) : 1;
  const cubribles = [...vivas]
    .sort((a, b) => rinde(b) - rinde(a))
    .slice(0, RECETAS_POR_VARIEDAD[peticion.variedad])
    .reduce((a, r) => a + rinde(r) * TANDAS_POR_RECETA_POR_VARIEDAD[peticion.variedad], 0);
  return { vivas: vivas.length, cubribles };
}

/**
 * Diagnóstico con salidas cuando no hay recetario suficiente. Prueba a
 * soltar cada restricción por separado y ordena por la que más desbloquea:
 * así la pantalla puede decir "quita 'sin gluten' y salen 14" en vez de
 * dejar al usuario delante de un error.
 */
function diagnosticar(peticion: PeticionSemana): SinCobertura {
  const base = huecosCubribles(peticion);
  const salidas: SinCobertura['salidas'] = [];

  for (const exclusion of peticion.exclusiones ?? []) {
    const resto = (peticion.exclusiones ?? []).filter((e) => e !== exclusion);
    salidas.push({
      tipo: 'exclusion',
      que: exclusion,
      huecosCubribles: huecosCubribles({ ...peticion, exclusiones: resto }).cubribles,
    });
  }
  if ((peticion.esfuerzo ?? 'libre') !== 'libre') {
    salidas.push({
      tipo: 'esfuerzo',
      que: 'sin límite de tiempo',
      huecosCubribles: huecosCubribles({ ...peticion, esfuerzo: 'libre' }).cubribles,
    });
  }
  if (peticion.numHuecos > 7) {
    salidas.push({
      tipo: 'comidas',
      que: 'solo comidas o solo cenas',
      huecosCubribles: huecosCubribles({ ...peticion, numHuecos: 7 }).cubribles,
    });
  }

  /**
   * ═══ Y LOS PLATOS QUE HA BLOQUEADO ═══
   *
   * Va como salida propia y no como una `exclusion` más porque la frase que
   * toca es otra: a nadie se le propone quitarse la alergia al marisco en el
   * mismo tono que desbloquear un plato que no le gustaba.
   *
   * `que` lleva el NÚMERO, no los ids: la pantalla dice "has quitado 40 platos"
   * y lleva a la lista. Enseñar `merluza_horno` en pantalla sería filtrar un
   * identificador interno a la interfaz.
   *
   * Se calcula soltando TODOS los bloqueos a la vez y no de uno en uno: quitar
   * uno solo casi nunca desbloquea la semana, así que la lista de salidas se
   * habría llenado de cuarenta líneas que no arreglan nada.
   */
  const bloqueados = peticion.platosBloqueados ?? [];
  if (bloqueados.length > 0) {
    salidas.push({
      tipo: 'bloqueados',
      que: `${bloqueados.length}`,
      huecosCubribles: huecosCubribles({ ...peticion, platosBloqueados: [] }).cubribles,
    });
  }

  const pedidos = peticion.numHuecos;
  salidas.sort((a, b) => b.huecosCubribles - a.huecosCubribles);
  return {
    recetasVivas: base.vivas,
    huecosCubribles: base.cubribles,
    huecosPedidos: pedidos,
    salidas: salidas.filter((s) => s.huecosCubribles >= (s.tipo === 'comidas' ? 7 : pedidos)),
    ...(bloqueados.length > 0 ? { platosBloqueados: bloqueados.length } : {}),
  };
}

/** Lo que de verdad aporta una semana ya montada. */
export function nutricionDe(
  huecos: Hueco[],
  datos: DatosMotor,
  N: number,
  suelo: number,
): SemanaGenerada['nutricion'] {
  let proteina = 0;
  let huecosConAnimal = 0;
  let huecosConFresca = 0;
  for (const h of huecos) {
    if (!h.receta) continue;
    // El hueco de ensamblaje come la ración del plato original MÁS lo que se
    // le añade: el huevo del salteado de garbanzos alimenta de verdad.
    proteina += proteinaPorRacion(h.receta, datos, N) * N;
    if (h.ensamblaje) proteina += proteinaDeEnsamblaje(h.ensamblaje, datos, N) * N;
    const animal = proteinaAnimal(h.receta, datos);
    if (animal !== 'ninguna') huecosConAnimal++;
    if (animal === 'fresca') huecosConFresca++;
  }
  const proteinaPorPersonaDia = Number((proteina / (DIAS.length * N)).toFixed(1));
  /**
   * El suelo se escala con las comidas que se han PLANIFICADO, igual que el
   * objetivo dentro de construir(). Si el usuario solo pide comidas, la app
   * resuelve una de las dos del día: exigirle a esas siete la proteína de
   * catorce es imposible por definición, y la semana salía siempre marcada
   * como rota (27,6 g contra un suelo de 55) aunque estuviera perfecta.
   * El motor ya lo escalaba por dentro; el veredicto no.
   *
   * Y cuenta los huecos CON COMIDA, no los planificados: al decir "el martes
   * no cocino" el usuario quitaba una cena y la app le respondía que la
   * semana ya no cuadraba por proteína —le reñía por el hueco que él mismo
   * había pedido. Esto no abre una puerta a que el motor deje huecos vacíos
   * para bajarse el listón: solo los crea el usuario. Medido en 126 semanas,
   * cero huecos libres no pedidos, y hay un test que lo sujeta.
   */
  const conComida = huecos.filter((h) => h.receta).length;
  const sueloEfectivo = huecos.length ? (suelo * conComida) / (DIAS.length * 2) : suelo;
  return {
    proteinaPorPersonaDia,
    sueloProteina: Number(sueloEfectivo.toFixed(1)),
    cumpleSuelo: proteinaPorPersonaDia >= sueloEfectivo,
    huecosConAnimal,
    huecosConFresca,
  };
}

const SEMANA_VACIA: Omit<SemanaGenerada, 'sinCobertura'> = {
  huecos: [],
  tandas: [],
  carrito: {
    lineas: [], totalCarrito: 0, totalConsumo: 0, totalPerecedero: 0,
    totalInventario: 0, totalDespensa: 0, totalDelArmario: 0,
  },
  recetasDistintas: [],
  postres: [],
  cuadra: false,
  nutricion: { proteinaPorPersonaDia: 0, sueloProteina: 0, cumpleSuelo: false, huecosConAnimal: 0, huecosConFresca: 0 },
};

export const ORDEN_PROTEINA: NivelProteina[] = ['basica', 'normal', 'alta'];

type Construida = NonNullable<ReturnType<typeof construir>>;

/**
 * Se retiró la reparación de monotonía de precio que había aquí: se
 * construían también los niveles más altos y se le servía a "básica" la
 * semana más barata de todas, viniera de donde viniera. Arreglaba que el
 * precio subiera de izquierda a derecha en el selector, pero **la monotonía
 * de precio nunca debió ser un requisito**: estos tres niveles no son una
 * escalera de precio, son tres puntos de un intercambio entre proteína y
 * desperdicio. Forzarla metía una tercera variable que no pinta nada — y de
 * paso hacía que "básica" sirviera la semana de "normal", que tira lo mismo.
 *
 * Lo que SÍ tiene que ser monótono es cada eje en su dirección: más proteína,
 * más desperdicio. Eso lo garantizan los objetivos por nivel, y lo comprueba
 * catalogo/suelo-proteina.ts.
 */

/** Comparación lexicográfica: gana el primer criterio que difiere. */
function mejorRango(a: number[], b: number[]): boolean {
  for (let k = 0; k < a.length; k++) {
    if (a[k] !== b[k]) return a[k] < b[k];
  }
  return false;
}

export function generarSemana(peticion: PeticionSemana): SemanaGenerada {
  const nivel = peticion.proteina ?? 'normal';
  const construida = construirMejor(peticion);
  if (!construida) return { ...SEMANA_VACIA, sinCobertura: diagnosticar(peticion) };

  const recetasDistintas = [...new Set(construida.tandas.map((t) => t.receta.nombre))];
  const presupuesto = peticion.presupuesto ?? Infinity;
  const nutricion = nutricionDe(construida.huecos, peticion.datos, peticion.N, GRAMOS_POR_NIVEL[nivel]);

  // El suelo es restricción dura: una semana que lo incumple NO es una semana
  // válida aunque el dinero cuadre. Generarla en silencio sería prometer un
  // nivel de proteína y servir otro.
  const cabe = construida.carrito.totalCarrito <= presupuesto;
  if (cabe && nutricion.cumpleSuelo) return { ...construida, recetasDistintas, nutricion, cuadra: true };

  // Salida 1: el nivel de variedad más alto que sí cabe con este presupuesto.
  // Las sondas van sin escalada (aFondo=false): son estimaciones para una
  // frase, no la semana que se sirve.
  let variedadMasBarata: Variedad | null = null;
  for (const v of ORDEN_VARIEDAD) {
    if (v === peticion.variedad) break;
    const prueba = construirMejor({ ...peticion, variedad: v }, false);
    if (prueba && prueba.carrito.totalCarrito <= presupuesto) variedadMasBarata = v;
  }

  // Salida 2: el nivel de proteína más alto que sí sale con este presupuesto.
  let proteinaAlcanzable: NivelProteina | null = null;
  for (const p of ORDEN_PROTEINA) {
    if (p === nivel) break;
    const prueba = construirMejor({ ...peticion, proteina: p }, false);
    if (!prueba || prueba.carrito.totalCarrito > presupuesto) continue;
    if (nutricionDe(prueba.huecos, peticion.datos, peticion.N, GRAMOS_POR_NIVEL[p]).cumpleSuelo) {
      proteinaAlcanzable = p;
    }
  }

  let motivo: 'presupuesto' | 'proteina' | 'ambos' = 'ambos';
  if (cabe) motivo = 'proteina';
  else if (nutricion.cumpleSuelo) motivo = 'presupuesto';

  return {
    ...construida,
    recetasDistintas,
    nutricion,
    cuadra: false,
    salida: {
      variedadMasBarata,
      presupuestoNecesario: Math.ceil(presupuestoNecesarioPara(peticion, construida)),
      proteinaAlcanzable,
      motivo,
    },
  };
}

/**
 * A cuánto habría que subir el presupuesto para que salga lo que se pidió.
 * Si lo que falla es la proteína, el carrito actual no vale como respuesta:
 * ese carrito es justo el que NO cumple. Se sube hasta que cumple o hasta
 * que se ve que no es cuestión de dinero.
 */
function presupuestoNecesarioPara(
  peticion: PeticionSemana,
  construida: NonNullable<ReturnType<typeof construir>>,
): number {
  const suelo = GRAMOS_POR_NIVEL[peticion.proteina ?? 'normal'];
  const base = Math.max(construida.carrito.totalCarrito, peticion.presupuesto ?? 0);
  if (nutricionDe(construida.huecos, peticion.datos, peticion.N, suelo).cumpleSuelo) return base;

  for (const factor of [1.1, 1.25, 1.4]) {
    const prueba = construirMejor({ ...peticion, presupuesto: base * factor }, false);
    if (!prueba) continue;
    if (nutricionDe(prueba.huecos, peticion.datos, peticion.N, suelo).cumpleSuelo) {
      return prueba.carrito.totalCarrito;
    }
  }
  return base; // no es cuestión de dinero: el recetario no da para ese nivel
}

/**
 * Lo que cuesta cada opción y si de verdad se puede elegir. El precio solo no
 * basta: "vegetariano + lo mínimo" deja 12 recetas y "mucha variedad" necesita
 * 14, así que ese nivel tiene que salir marcado como no disponible EN EL
 * SELECTOR. Fallar después de elegirlo es el muro por la puerta de atrás.
 */
export interface CosteOpcion {
  carrito: number;
  /**
   * LO QUE DE VERDAD SE COME de ese carrito.
   *
   * Está aquí porque sin él no se puede comparar una opción con otra sin
   * mentirse: el carrito es lo que pasa por caja, y dos semanas del mismo
   * precio pueden dar cantidades de comida muy distintas. La diferencia entre
   * los dos es el desperdicio, y minimizarla es la función objetivo del
   * producto — así que el número tiene que estar donde se elige.
   */
  consumo: number;
  /** Cabe en el presupuesto y cumple el nivel de proteína pedido. */
  disponible: boolean;
  /** Por qué no, para poder decirlo en una línea. */
  porque?: 'recetario' | 'presupuesto' | 'proteina';
  proteina: number;
  perecedero: number;
  /**
   * Lo que la pantalla necesita para enseñar la semana SIN adjetivos: cuántos
   * platos distintos trae y cuántos de los catorce huecos no se cocinan.
   *
   * Están aquí porque los adjetivos ("poca variedad", "casi sin repetir")
   * resultaron ser mentira: medido en 15 combinaciones de comensales y
   * presupuesto, NINGUNA consecuencia acompaña al precio. La monotonía sale a
   * nivel de azar en todas —minutos 5/15, proteína 4/15, tandas 4/15, platos
   * 3/15, perecedero 3/15, repeticiones 1/15, y el azar da 5/15— porque los
   * tres niveles no son conjuntos anidados: "mucha" permite 12 recetas pero
   * prohíbe sobras, y "poca" permite 5 pero deja recalentar media semana. Ni
   * un optimizador perfecto los ordenaría.
   *
   * Así que se dejan de prometer relaciones y se enseñan los números.
   */
  platos: number;
  repeticiones: number;
  /**
   * ═══ CUÁNTAS VECES TE PONES A COCINAR LO MISMO OTRA VEZ ═══
   *
   * `repeticiones` NO es esto, y confundirlos costó una etiqueta falsa en
   * pantalla: cuenta los huecos que se cubren sin cocinar, o sea las sobras.
   * Con «mucha variedad» eso da 2 y el selector decía «repites 2» — cuando en
   * esa semana no se cocina dos veces ningún plato. Aprovechar la olla del lunes
   * el jueves no es repetir: es de donde sale que la semana cueste 57 € y no 90.
   *
   * Esto sí es repetir: tandas menos recetas distintas. Si cocinas garbanzos el
   * lunes y otra vez el viernes, cuenta uno.
   *
   *   14 comidas   poca    9 tandas ·  5 recetas  → 4
   *                normal 10 tandas ·  9 recetas  → 1
   *                mucha  12 tandas · 12 recetas  → 0
   *
   * Es lo único que sostiene la frase «nunca repites plato», que con el otro
   * número habría sido mentira.
   */
  platosRepetidos: number;
}

function medir(c: Construida | null, peticion: PeticionSemana, nivel: NivelProteina): CosteOpcion {
  if (!c) {
    return {
      carrito: Number.NaN, consumo: Number.NaN, disponible: false, porque: 'recetario',
      proteina: 0, perecedero: 0, platos: 0, repeticiones: 0, platosRepetidos: 0,
    };
  }

  const nutricion = nutricionDe(c.huecos, peticion.datos, peticion.N, GRAMOS_POR_NIVEL[nivel]);
  const cabe = c.carrito.totalCarrito <= (peticion.presupuesto ?? Infinity);
  let porque: CosteOpcion['porque'];
  if (!cabe) porque = 'presupuesto';
  else if (!nutricion.cumpleSuelo) porque = 'proteina';

  return {
    carrito: c.carrito.totalCarrito,
    consumo: c.carrito.totalConsumo,
    disponible: cabe && nutricion.cumpleSuelo,
    porque,
    proteina: nutricion.proteinaPorPersonaDia,
    perecedero: c.carrito.totalPerecedero,
    platos: new Set(c.tandas.map((t) => t.receta.id)).size,
    // Tandas menos recetas distintas. Ver `platosRepetidos` en CosteOpcion.
    platosRepetidos: c.tandas.length - new Set(c.tandas.map((t) => t.receta.id)).size,
    // Todo hueco con plato que no se cocina: sobras y ensamblajes. Es lo que
    // el usuario vive como "repetir", cocine o no.
    repeticiones: c.huecos.filter((h) => h.receta && h.tipo !== 'cocinado').length,
  };
}

/** Lo que cuesta la semana en cada nivel de variedad, con el resto fijo. */
export function costesPorVariedad(peticion: Omit<PeticionSemana, 'variedad'>): Record<Variedad, CosteOpcion> {
  const r = {} as Record<Variedad, CosteOpcion>;
  for (const v of ORDEN_VARIEDAD) r[v] = costeDeUnaVariedad(peticion, v);
  return r;
}

/**
 * CUÁL DE LAS TRES SEMANAS DARLE A QUIEN NO HA ELEGIDO NINGUNA.
 *
 * ═══ POR QUÉ HACÍA FALTA ═══
 *
 * El arranque usaba `variedad: 'normal'` fija, por nombre. Pero los tres
 * niveles no están ordenados por calidad —lo dice con datos la cabecera de
 * `SelectorVariedad.tsx`, y por eso esa pantalla los pinta por precio y sin
 * adjetivos—, así que elegir por nombre es elegir a ciegas.
 *
 * ═══ EL CRITERIO, ELEGIDO MIDIENDO Y NO RAZONANDO ═══
 *
 * Medido sobre 113 combinaciones de comensales × tope × proteína × huecos:
 *
 *                     carrito   comida  desper  usa tope  repite  peores
 *     fijo «normal»   50,76 €   30,98 €    39%     74%     2,9      6
 *     este criterio   55,54 €   34,42 €    38%     81%     2,6      0
 *
 * Gana en todas menos en gasto, y esa no es una columna que se gane: gastar más
 * de un tope que el usuario ha puesto, para darle 3,44 € más de comida y
 * repetirle medio plato menos, es literalmente lo que la app promete.
 *
 * («peores» = arranques que pierden contra otra de las tres en precio,
 * repeticiones, platos y comida a la vez.)
 *
 * El ratio es la función objetivo de CLAUDE.md leída como proporción, que es la
 * lectura que no se puede ganar haciendo trampa comprando menos.
 *
 * ═══ PERO EL RATIO SOLO NO VALE ═══
 *
 * Probado en el navegador: con dos personas y 65 € de tope elegía `poca` —41,08 €
 * repitiendo cinco de catorce comidas—, dejando 23,92 € sin usar. El ratio, a
 * secas, premia comprar poco: la semana que no compra nada no desperdicia nada.
 * Y esa es exactamente la promesa incumplida que el pase de holgura vino a
 * arreglar y que está documentada treinta líneas más arriba — la pantalla dice
 * "te sobran 23,92 €, súbete la variedad" y el motor no se los gasta.
 *
 * Así que el ratio decide SOLO entre las que usan el presupuesto. La banda ya
 * existía (`BANDA_PRESUPUESTO.minimo`), es la misma que usa el pase de holgura
 * para saber si se ha quedado corto, y usarla aquí también evita tener dos
 * definiciones de "gastar el tope" que puedan separarse.
 *
 * Si ninguna llega a la banda —tope generoso, recetario corto— no se castiga a
 * nadie: entonces gana la que más gaste, que es la que más se acerca a lo que
 * el usuario pidió.
 */
export function mejorVariedad(peticion: Omit<PeticionSemana, 'variedad'>): Variedad {
  const costes = costesPorVariedad(peticion);
  const vivas = ORDEN_VARIEDAD
    .map((v) => ({ v, c: costes[v] }))
    .filter(({ c }) => c.disponible && Number.isFinite(c.carrito) && c.carrito > 0);

  // Ninguna cuadra: se devuelve la de siempre y la pantalla enseña las salidas.
  if (!vivas.length) return 'normal';

  /**
   * Fuera las que pierden EN TODO contra otra: más caras, repiten igual o más,
   * traen igual o menos platos y dan igual o menos comida. No hay usuario, por
   * raro que sea, al que le convengan.
   *
   * Esto no es un adorno defensivo, se vio en el navegador: con dos personas y
   * 65 € ninguna llega a la banda de presupuesto, así que decide la rama de
   * abajo —la que más gasta— y la que más gasta era 53,32 € repitiendo 4,
   * habiendo 51,74 € repitiendo 2. Más cara y peor.
   */
  const noDominadas = vivas.filter(({ c: a }) => !vivas.some(({ c: b }) => b !== a
    && b.carrito < a.carrito - 0.01
    && b.repeticiones <= a.repeticiones
    && b.platos >= a.platos
    && b.consumo >= a.consumo - 0.01));
  const candidatas = noDominadas.length ? noDominadas : vivas;

  const presupuesto = peticion.presupuesto ?? Infinity;
  const usanElTope = Number.isFinite(presupuesto)
    ? candidatas.filter(({ c }) => c.carrito >= presupuesto * BANDA_PRESUPUESTO.minimo)
    : candidatas;

  // Ninguna llega a la banda: la que más se acerque a lo que el usuario pidió.
  if (!usanElTope.length) {
    return candidatas.reduce((mejor, act) => (act.c.carrito > mejor.c.carrito ? act : mejor)).v;
  }

  return usanElTope.reduce((mejor, act) => {
    const r = act.c.consumo / act.c.carrito;
    const rm = mejor.c.consumo / mejor.c.carrito;
    // Medio punto de rendimiento no decide nada: por debajo de eso, más comida.
    if (Math.abs(r - rm) > 0.005) return r > rm ? act : mejor;
    return act.c.consumo > mejor.c.consumo ? act : mejor;
  }).v;
}

/**
 * UNA sola variedad. Existe porque hay dos sitios que solo quieren una y
 * estaban pagando las tres: el suelo de presupuesto del paso 2/3 pide la más
 * barata y tiraba las otras dos a la basura, 448 ms para usar 150.
 *
 * `costesPorVariedad` pasa por aquí para que no haya dos caminos que puedan
 * separarse: lo que mide el selector de Ajustes y lo que mide el suelo tiene
 * que ser exactamente lo mismo.
 */
export function costeDeUnaVariedad(
  peticion: Omit<PeticionSemana, 'variedad'>,
  variedad: Variedad,
): CosteOpcion {
  const p = { ...peticion, variedad };
  return medir(construirMejor(p), p, peticion.proteina ?? 'normal');
}

/**
 * Qué entrega cada nivel de proteína. Una pasada por nivel, con el objetivo
 * de ese nivel: lo que se mide es exactamente la semana que se va a generar.
 */
export function costesPorProteina(peticion: PeticionSemana): Record<NivelProteina, CosteOpcion> {
  const r = {} as Record<NivelProteina, CosteOpcion>;
  for (const p of ORDEN_PROTEINA) {
    const q = { ...peticion, proteina: p };
    r[p] = medir(construirMejor(q), q, p);
  }
  return r;
}

// ---------------------------------------------------------------------------
// Rehacer desde un hueco
// ---------------------------------------------------------------------------

export type Retoque = 'cambiar' | 'barato' | 'libre' | 'cocinar';

/** Cuántos sustitutos se prueban antes de aceptar uno que rompa el cuadre. */
const INTENTOS_RETOQUE = 5;

/**
 * Los techos que se le van poniendo a "bájame el precio", en tanto por uno de
 * lo que cuesta ya la semana. Se empieza pidiendo un 12% menos y se afloja si
 * el recetario no da para tanto.
 */
const ESCALONES_DE_REBAJA = [0.88, 0.93, 0.97];

/**
 * Y lo que tiene que ahorrar por cada comida que mueve para que valga la pena
 * ofrecerlo. Visto en la app: pulsar en el primer hueco proponía "10 comidas
 * cambian. Te ahorras 0,18 €" — rehacer la semana entera por dieciocho
 * céntimos. Es un trato malo y ofrecerlo gasta la confianza en el botón.
 */
const AHORRO_MINIMO_POR_HUECO = 0.25;

/**
 * El plan se rompe el martes. La app lo absorbe: se congela todo lo anterior
 * al hueco que se toca y se vuelve a repartir de ahí en adelante con el mismo
 * motor. No hay huecos intocables — un hueco de sobras se puede cambiar
 * porque al hacerlo se rehace también la tanda de la que dependía.
 *
 *   cambiar — otro plato en ese hueco (se veta el que había)
 *   barato  — el reparto que salga más barato de ahí en adelante
 *   libre   — ese hueco no se cocina; el resto se reorganiza
 *
 * Devuelve la semana nueva; quien llama compara con la vieja para contar qué
 * cambió, igual que hace la hoja de "este día no cocino".
 */
/**
 * Qué huecos pertenecen a cada tanda. Una tanda ya no ocupa huecos contiguos:
 * su sobra cae uno o dos días después, así que hay que reconstruir la
 * propiedad casando cocinados con sus sobras por el campo `origen`.
 */
function mapearHuecosDeTanda(semana: SemanaGenerada): Map<Tanda, Hueco[]> {
  const huecosDeTanda = new Map<Tanda, Hueco[]>();
  const pendientes = [...semana.huecos];
  for (const tanda of semana.tandas) {
    const suyos: Hueco[] = [];
    const cocinado = pendientes.findIndex((h) => h.tipo === 'cocinado' && h.receta?.id === tanda.receta.id);
    if (cocinado < 0) continue;
    const [hCocinado] = pendientes.splice(cocinado, 1);
    suyos.push(hCocinado);
    if (tanda.huecosPrincipal >= 2) {
      const sobra = pendientes.findIndex(
        (h) => (h.tipo === 'sobras' || h.tipo === 'ensamblaje')
          && h.origen?.dia === hCocinado.dia && h.origen?.ranura === hCocinado.ranura,
      );
      if (sobra >= 0) suyos.push(...pendientes.splice(sobra, 1));
    }
    huecosDeTanda.set(tanda, suyos);
  }
  return huecosDeTanda;
}

/** La semana reconstruida, con su nutrición y su cuadre recalculados. */
function terminarRetoque(
  peticion: PeticionSemana,
  rehecha: NonNullable<ReturnType<typeof construir>>,
): SemanaGenerada {
  const nutricion = nutricionDe(
    rehecha.huecos, peticion.datos, peticion.N, GRAMOS_POR_NIVEL[peticion.proteina ?? 'normal'],
  );
  return {
    ...rehecha,
    recetasDistintas: [...new Set(rehecha.tandas.map((t) => t.receta.nombre))],
    nutricion,
    cuadra: rehecha.carrito.totalCarrito <= (peticion.presupuesto ?? Infinity) && nutricion.cumpleSuelo,
  };
}

/**
 * EL CAMBIO MÍNIMO. Tocar un hueco deshace SOLO la tanda que lo cubre y
 * congela todas las demás — las anteriores Y las posteriores. El agujero que
 * queda (el hueco tocado y, si la tanda tenía sobra, su pareja) se rellena
 * con el mismo motor de candidatos, que ve el resto de la semana como fija.
 *
 * Antes el retoque congelaba solo lo ANTERIOR y reconstruía todo el sufijo:
 * medido sobre 84 retoques, la mediana era 6 de 14 huecos cambiados y tocar
 * el lunes cambiaba 11,8 de media. Desde el usuario eso es "toqué el martes
 * y me has cambiado la semana" — la sensación de perder el control que
 * desinstala la app. Con esto, cambiar un plato toca ese hueco y como mucho
 * su sobra; el precio se mueve (la lista de la compra es global por diseño)
 * pero los DEMÁS platos se quedan donde estaban.
 *
 * Devuelve null si no hay ningún candidato con el resto congelado — entonces
 * quien llama decide si recurre al reparto global (rehacerDesde), que es
 * honesto pero ruidoso.
 */
/**
 * ═══ «NO COCINO ESTE DÍA» QUITA UNA COMIDA, NO REHACE LA SEMANA ═══
 *
 * Antes iba por `repararHueco`, que deshace la tanda ENTERA del hueco tocado y
 * rellena con el motor lo que queda libre. Cuando el hueco era una sobra, eso
 * dejaba vacío el día en que se cocinaba, y el motor lo llenaba con otra cosa.
 * Medido (catalogo/_aud-no-cocino.ts, 2 personas, 65 €, semana de lunes):
 * liberar la sobra del miércoles cambiaba las alubias del lunes por un potaje
 * con bacalao y la compra pasaba de 54,32 € a 69,44 €, fuera del presupuesto.
 * Decir «ese día no cocino» costaba quince euros.
 *
 * Ahora no se elige ningún plato. Se quita la comida y se recalcula la compra
 * de lo que queda:
 *
 *   · hueco cocinado sin sobra      → la tanda sale entera.
 *   · hueco de sobra o ensamblaje   → la tanda se queda con su día de cocina,
 *                                     para un hueco en vez de dos.
 *   · hueco cocinado CON sobra      → lo que iba a ser sobra se cocina ese
 *                                     otro día, para un hueco. Si era un
 *                                     ensamblaje, pasa a ser el plato base: un
 *                                     ensamblaje solo existe sobre la olla de
 *                                     otro día, y esa olla ya no se hace.
 *
 * En los tres casos las cantidades de cada ingrediente solo pueden bajar, y el
 * postre de ese hueco se deja de comprar. Con los mismos precios y la misma
 * despensa, la compra NO puede subir. Hay un test que lo sujeta.
 */
export function liberarHueco(
  peticion: PeticionSemana,
  semana: SemanaGenerada,
  indiceHueco: number,
): SemanaGenerada {
  const tocado = semana.huecos[indiceHueco];
  if (!tocado?.receta || tocado.tipo === 'libre') return semana;
  const indiceDe = (h: Hueco) => semana.huecos.findIndex((x) => x.dia === h.dia && x.ranura === h.ranura);

  let duena: Tanda | null = null;
  let suyos: Hueco[] = [];
  for (const [tanda, huecos] of mapearHuecosDeTanda(semana)) {
    if (huecos.some((h) => indiceDe(h) === indiceHueco)) { duena = tanda; suyos = huecos; break; }
  }
  if (!duena) return semana;

  const huecos = [...semana.huecos];
  huecos[indiceHueco] = { dia: tocado.dia, ranura: tocado.ranura, receta: null, tipo: 'libre' };

  const otro = suyos.find((h) => indiceDe(h) !== indiceHueco);
  const tandas: Tanda[] = [];
  for (const t of semana.tandas) {
    if (t !== duena) { tandas.push(t); continue; }
    if (!otro) continue; // cocinado sin sobra: la tanda sale entera
    const k = indiceDe(otro);
    if (tocado.tipo === 'cocinado') {
      // La sobra pasa a cocinarse ese día; sin origen y sin ensamblaje.
      huecos[k] = { dia: otro.dia, ranura: otro.ranura, receta: duena.receta, tipo: 'cocinado' };
    }
    tandas.push({
      receta: duena.receta,
      huecosPrincipal: 1,
      huecosAcompanamiento: Math.min(1, duena.huecosAcompanamiento),
    });
  }

  const libres = new Set<number>();
  huecos.forEach((h, k) => { if (h.tipo === 'libre') libres.add(k); });
  const postres = peticion.postre
    ? planDePostres(peticion.datos, peticion.exclusiones ?? [], peticion.N, huecos.length, libres)
    : [];
  const carrito = calcularCarrito(tandas, peticion.datos, peticion.N, peticion.existencias, postres);
  return terminarRetoque(peticion, { huecos, tandas, carrito, postres });
}

/**
 * ═══ VOLVER A COCINAR UN DÍA LIBRE ═══
 *
 * El camino de vuelta de `liberarHueco`. Rellena SOLO ese hueco, con el mismo
 * motor de candidatos y el resto de la semana congelado: las demás comidas no
 * se mueven. Añadir una comida sí puede subir la compra —es comida de más—, y
 * `cuadra` dice si sigue cabiendo.
 *
 * `null` si no hay ningún plato que quepa en ese hueco con lo que ya hay.
 */
export function cocinarHueco(
  peticion: PeticionSemana,
  semana: SemanaGenerada,
  indiceHueco: number,
): SemanaGenerada | null {
  if (semana.huecos[indiceHueco]?.tipo !== 'libre') return null;
  const ocupados: (Hueco | null)[] = semana.huecos.map((h, k) => (k === indiceHueco ? null : h));
  const rehecha = construir(peticion, { ocupados, tandas: [...semana.tandas] });
  if (!rehecha?.huecos[indiceHueco]?.receta) return null;
  return terminarRetoque(peticion, rehecha);
}

export function repararHueco(
  peticion: PeticionSemana,
  semana: SemanaGenerada,
  indiceHueco: number,
  retoque: 'cambiar' | 'libre',
): SemanaGenerada | null {
  if (retoque === 'libre') return liberarHueco(peticion, semana, indiceHueco);
  const indiceDe = (h: Hueco) => semana.huecos.findIndex((x) => x.dia === h.dia && x.ranura === h.ranura);
  const mapa = mapearHuecosDeTanda(semana);

  let duena: Tanda | null = null;
  for (const [tanda, huecos] of mapa) {
    if (huecos.some((h) => indiceDe(h) === indiceHueco)) { duena = tanda; break; }
  }
  if (!duena) return null; // hueco libre o plan inconsistente: que decida el global

  const ocupados: (Hueco | null)[] = new Array(semana.huecos.length).fill(null);
  const tandasFijas: Tanda[] = [];
  for (const [tanda, huecos] of mapa) {
    if (tanda === duena) continue;
    tandasFijas.push(tanda);
    for (const h of huecos) ocupados[indiceDe(h)] = h;
  }
  // Los huecos 'libre' de la semana original también se conservan tal cual.
  semana.huecos.forEach((h, k) => {
    if (h.tipo === 'libre' && k !== indiceHueco) ocupados[k] = h;
  });

  /**
   * Se prueban varios candidatos, no solo el mejor.
   *
   * El motor deja la semana al borde a propósito —gasta el 95% del
   * presupuesto y aterriza uno o dos gramos por encima del suelo—, así que
   * el mejor sustituto para un hueco a menudo la saca de cuadre por unos
   * céntimos. Medido antes de esto: de 28 retoques por celda, entre 7 y 23
   * dejaban la semana fuera de presupuesto o por debajo del suelo. Ahora, si
   * el primero rompe algo que la semana cumplía, se veta también y se prueba
   * el siguiente. Se para en cuanto uno conserva el cuadre.
   */
  const cuadrabaAntes = semana.carrito.totalCarrito <= (peticion.presupuesto ?? Infinity)
    && semana.nutricion.cumpleSuelo;
  const vetadas = new Set<string>([duena.receta.id]);
  let primera: SemanaGenerada | null = null;

  for (let intento = 0; intento < INTENTOS_RETOQUE; intento++) {
    const arranque: ArranqueParcial = { ocupados, tandas: tandasFijas };
    arranque.vetadaGlobal = [...vetadas].join('|');

    const rehecha = construir(peticion, arranque);
    if (!rehecha) break;

    const resultado = terminarRetoque(peticion, rehecha);
    const puesta = resultado.huecos[indiceHueco]?.receta?.id;
    // El veto no aplicó: mejor devolver null y que decida el reparto global
    // que enseñarle al usuario que su toque no ha hecho nada.
    if (puesta && vetadas.has(puesta)) break;

    primera ??= resultado;
    if (!cuadrabaAntes || resultado.cuadra) return resultado;
    // Rompió el cuadre: se veta lo que acaba de poner y se prueba otra cosa.
    if (!puesta) break;
    vetadas.add(puesta);
  }

  return primera;
}

/** Una alternativa concreta para un hueco, ya medida contra lo que hay puesto. */
export interface Alternativa {
  recetaId: string;
  nombre: string;
  minutos: number;
  /** Lo que costaría la ración de este plato. */
  precioRacion: number;
  /** Diferencia por ración contra el plato que está puesto. Negativa = ahorra. */
  deltaRacion: number;
  /** La semana entera ya rehecha con este plato. Se aplica sin recalcular. */
  semana: SemanaGenerada;
}

/**
 * QUÉ MÁS PUEDE IR EN ESTE HUECO, con lo que cuesta el cambio.
 *
 * La hoja del día ofrecía "cambiar plato" a ciegas: se tocaba y salía otra
 * cosa, sin saber qué ni a cuánto. Esto enseña dos o tres candidatos con su
 * diferencia POR RACIÓN y con signo, que es la cifra con la que se decide.
 *
 * Por ración y no el precio absoluto: lo que el usuario quiere saber no es que
 * el otro plato vale 0,95 € —eso no lo sitúa— sino que le ahorra 0,89. Es la
 * misma unidad que ya lee en la tarjeta del día.
 *
 * Se apoya en la misma maquinaria que `repararHueco`: construir la semana
 * entera vetando lo que ya se ha visto. Eso importa porque cada alternativa
 * viene con SU semana ya cuadrada — al elegir una no hay que volver a
 * calcular, y sobre todo no puede salir una semana distinta de la que se
 * enseñó con ese precio.
 *
 * Cuesta una construcción por candidato (~35 ms), así que se pide fuera del
 * render como el resto de estimaciones.
 */
export function alternativasParaHueco(
  peticion: PeticionSemana,
  semana: SemanaGenerada,
  indiceHueco: number,
  cuantas = 2,
): Alternativa[] {
  const actual = semana.huecos[indiceHueco]?.receta;
  if (!actual) return [];
  const precioActual = consumoPorRacion(actual, peticion.datos, peticion.N);

  const vistas = new Set<string>([actual.id]);
  const salida: Alternativa[] = [];

  /* Un intento de más que candidatos pedidos: alguno se repite o no cambia
     nada, y sin margen la hoja se quedaba con una sola opción. */
  for (let intento = 0; intento < cuantas + 3 && salida.length < cuantas; intento++) {
    const rehecha = repararHueco(
      { ...peticion, recetasRecientes: [[...vistas], ...(peticion.recetasRecientes ?? [])] },
      semana,
      indiceHueco,
      'cambiar',
    );
    if (!rehecha) break;
    const puesta = rehecha.huecos[indiceHueco]?.receta;
    if (!puesta || vistas.has(puesta.id)) break;
    vistas.add(puesta.id);
    const precio = consumoPorRacion(puesta, peticion.datos, peticion.N);
    salida.push({
      recetaId: puesta.id,
      nombre: puesta.nombre,
      minutos: puesta.minutos,
      precioRacion: precio,
      deltaRacion: precio - precioActual,
      semana: rehecha,
    });
  }
  return salida;
}

export function rehacerDesde(
  peticion: PeticionSemana,
  semana: SemanaGenerada,
  indiceHueco: number,
  retoque: Retoque,
): SemanaGenerada {
  // Quitar o devolver una comida no reparte la semana: ver liberarHueco.
  if (retoque === 'libre') return liberarHueco(peticion, semana, indiceHueco);
  if (retoque === 'cocinar') return cocinarHueco(peticion, semana, indiceHueco) ?? semana;
  // Se congela POR TANDA, no por posición — se conserva la tanda solo si
  // TODOS sus huecos caen antes del que se toca. La tanda que contiene el
  // hueco tocado se deshace entera, y con ella su sobra.
  const indiceDe = (h: Hueco) => semana.huecos.findIndex((x) => x.dia === h.dia && x.ranura === h.ranura);
  const huecosDeTanda = mapearHuecosDeTanda(semana);

  const ocupados: (Hueco | null)[] = new Array(semana.huecos.length).fill(null);
  const tandasFijas: Tanda[] = [];
  for (const [tanda, suyos] of huecosDeTanda) {
    if (suyos.some((h) => indiceDe(h) >= indiceHueco)) continue;
    tandasFijas.push(tanda);
    for (const h of suyos) ocupados[indiceDe(h)] = h;
  }

  const arranque: ArranqueParcial = { ocupados, tandas: tandasFijas };
  if (retoque === 'cambiar') {
    // Veto FUERTE también aquí. `vetadaAqui` solo rige en el primer hueco que
    // se reconstruye, que no tiene por qué ser el tocado: medido, 2 de 28
    // retoques acababan reponiendo el mismo plato y el usuario veía que su
    // toque no había hecho nada.
    arranque.vetadaAqui = semana.huecos[indiceHueco].receta?.id;
    arranque.vetadaGlobal = semana.huecos[indiceHueco].receta?.id;
  }

  if (retoque !== 'barato') {
    const rehecha = construir(peticion, arranque);
    if (!rehecha) return semana; // no hay forma: se deja como estaba
    return terminarRetoque(peticion, rehecha);
  }

  /**
   * "BÁJAME EL PRECIO" TIENE QUE BAJAR EL PRECIO.
   *
   * Era el mismo motor con la variedad apretada al mínimo y el resultado se
   * devolvía tal cual, sin mirar si de verdad salía más barato. Y no tenía
   * por qué: el presupuesto no es solo techo, es objetivo —el motor apunta al
   * 95%—, así que una semana que iba por debajo la SUBÍA hasta la banda.
   * Medido sobre 126 pulsaciones: 72 bajaban, 23 la dejaban igual y 31 la
   * encarecían, una de ellas 6,37 €. El usuario pide barato y la app le cobra
   * más; no hay excusa de diseño que sostenga eso.
   *
   * Ahora se le da al motor un techo por debajo de lo que ya cuesta —y se
   * baja el listón escalón a escalón si no encuentra nada— y al final se
   * compara: si nada sale más barato, la semana se queda como estaba.
   */
  const actual = semana.carrito.totalCarrito;
  const cuadrabaAntes = semana.cuadra;
  // Un ahorro que tira el suelo de proteína no es el mismo ahorro. Se guardan
  // por separado y gana siempre el que mantiene la semana en pie, aunque el
  // otro sea más barato.
  let conCuadre: SemanaGenerada | null = null;
  let sinCuadre: SemanaGenerada | null = null;

  for (const escalon of ESCALONES_DE_REBAJA) {
    const rehecha = construir(
      { ...peticion, variedad: 'poca', presupuesto: actual * escalon },
      arranque,
    );
    if (!rehecha) continue;
    const r = terminarRetoque(peticion, rehecha);
    const ahorro = actual - r.carrito.totalCarrito;
    if (ahorro <= 0.005) continue;
    const movidos = r.huecos.filter((h, k) =>
      h.receta?.id !== semana.huecos[k]?.receta?.id || h.tipo !== semana.huecos[k]?.tipo).length;
    if (ahorro < AHORRO_MINIMO_POR_HUECO * movidos) continue;
    if (r.cuadra || !cuadrabaAntes) {
      conCuadre = r;
      break; // los escalones van de más a menos agresivo: el primero que vale, vale
    }
    if (!sinCuadre || r.carrito.totalCarrito < sinCuadre.carrito.totalCarrito) sinCuadre = r;
  }

  return conCuadre ?? sinCuadre ?? semana;
}



