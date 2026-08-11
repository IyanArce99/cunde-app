/**
 * ═══ ¿CUÁNTAS RECETAS HACEN FALTA DE VERDAD? ═══
 *
 * La pregunta es de producto, no de tamaño: una semana son 14 comidas y como
 * mucho 12 platos distintos. Nadie ve cien recetas de golpe. Así que ¿para qué
 * sirve tener 151, o 1000?
 *
 * Lo que se mide aquí es lo único que responde: cuántas recetas DISTINTAS gasta
 * un usuario real a lo largo de doce semanas seguidas, con la memoria del motor
 * puesta como en la app. Si con doce semanas usa cuarenta, tener mil sobra.
 *
 * Se simula la secuencia de verdad: la semana N recibe como memoria lo que se
 * comió en las N-1, N-2 y N-3, que es lo que hace el reducer.
 *
 * ═══ MEDIDO EL 7 AGO 2026 · 151 RECETAS ═══
 *
 * En DOCE semanas seguidas un usuario gasta entre 20 y 63 recetas distintas:
 * del 23% al 49% de las que tiene disponibles. Nunca más de la mitad.
 *
 *   sin filtros  mucha    151 disponibles →  63 usadas (42%)
 *   vegetariano  normal   101 disponibles →  42 usadas (42%)
 *   vegano       normal    74 disponibles →  33 usadas (45%)
 *
 * O sea que 151 ya es más de lo que nadie ve en tres meses, y subir a mil no
 * cambiaría ni un plato de la semana de nadie. La conclusión es que añadir
 * recetas «para tener más» no es una palanca de producto.
 *
 * ═══ LO QUE SÍ SE VE EN LA ÚLTIMA COLUMNA ═══
 *
 * A partir de la semana 5 se repite, y mucho: con «mucha variedad» entre 6 y 12
 * de los 12 platos ya se habían comido antes. En vegano son 12 de 12.
 *
 * Y eso NO lo arregla el recetario: lo gobierna SEMANAS_DE_MEMORIA, que son 3.
 * Pasada la memoria, el motor vuelve a su óptimo y repite. Si «no me repitas»
 * fuera un problema real de usuario, la palanca es la ventana de memoria —que
 * es gratis— y no escribir recetas nuevas.
 *
 * La única razón buena para añadir una receta es que caiga en un filtro flaco:
 * vegano tiene 74 disponibles contra 151 del caso general, y ahí sí cambia la
 * semana de alguien.
 *
 *   node --experimental-strip-types catalogo/_aud-cuantas-hacen-falta.ts
 */
import datosJson from '../src/data/motor-datos.json' with { type: 'json' };
import { generarSemana, recetarioAdaptado, SEMANAS_DE_MEMORIA } from '../src/motor/seleccionar.ts';
import type { DatosMotor } from '../src/motor/tipos.ts';

const datos = datosJson as unknown as DatosMotor;
const SEMANAS = 12;

const PERFILES = [
  { etiqueta: 'sin filtros', exclusiones: [] as string[] },
  { etiqueta: 'sin pescado', exclusiones: ['Pescado'] },
  { etiqueta: 'sin gluten', exclusiones: ['Gluten'] },
  { etiqueta: 'vegetariano', exclusiones: ['Vegetariano'] },
  { etiqueta: 'vegano', exclusiones: ['Vegano'] },
];

const VARIEDADES = ['poca', 'normal', 'mucha'] as const;

console.log(`\nDoce semanas seguidas para 2 personas, 14 comidas, 65 €.`);
console.log(`Memoria del motor: ${SEMANAS_DE_MEMORIA} semanas.\n`);
console.log('  perfil            variedad   disponibles   usadas en 12 sem   %    repetidas ya en sem 5');

for (const p of PERFILES) {
  const disponibles = recetarioAdaptado(datos, p.exclusiones).length;
  for (const variedad of VARIEDADES) {
    const usadas = new Set<string>();
    let alQuinto = 0;
    const historial: string[][] = [];
    for (let semana = 1; semana <= SEMANAS; semana++) {
      const s = generarSemana({
        datos, N: 2, numHuecos: 14, presupuesto: 65, variedad, proteina: 'normal',
        esfuerzo: 'libre', exclusiones: p.exclusiones, semanaNumero: semana,
        recetasRecientes: historial.slice(0, SEMANAS_DE_MEMORIA),
      });
      const ids = [...new Set(s.tandas.map((t) => t.receta.id))];
      /* Cuántos platos de la semana 5 ya se habían comido antes: es lo que el
         usuario vive como «esto ya me lo pusiste». La 5 y no la 2 porque la
         memoria cubre 3 y hasta ahí no puede repetir aunque quiera. */
      if (semana === 5) alQuinto = ids.filter((id) => usadas.has(id)).length;
      for (const id of ids) usadas.add(id);
      historial.unshift(ids);
    }
    console.log(
      `  ${p.etiqueta.padEnd(18)}${variedad.padEnd(11)}`
      + `${String(disponibles).padStart(9)}`
      + `${String(usadas.size).padStart(16)}`
      + `${String(Math.round(usadas.size / disponibles * 100)).padStart(6)}%`
      + `${String(alQuinto).padStart(11)} de 12`,
    );
  }
  console.log('');
}
