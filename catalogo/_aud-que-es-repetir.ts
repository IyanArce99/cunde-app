/**
 * ═══ ¿QUÉ ES «REPETIR»? DOS COSAS DISTINTAS ═══
 *
 * Se estaba usando la misma palabra para dos cosas que no lo son:
 *
 *   A) COCINAR dos veces el mismo plato en la semana.
 *   B) COMER dos veces lo mismo porque un hueco se cubre con lo que sobró.
 *
 * Con «mucha variedad» A no pasa nunca —cada tanda es una receta distinta— pero
 * B sí: 12 recetas no llenan 14 comidas, así que dos huecos se comen de lo que
 * ya está cocinado. Desde la cocina son doce platos; desde el plato del martes,
 * es lo mismo que el lunes.
 *
 * Esto imprime la semana entera para poder mirarla en vez de discutir la
 * palabra.
 *
 *   node --experimental-strip-types catalogo/_aud-que-es-repetir.ts
 */
import datosJson from '../src/data/motor-datos.json' with { type: 'json' };
import { generarSemana } from '../src/motor/seleccionar.ts';
import type { DatosMotor } from '../src/motor/tipos.ts';

const datos = datosJson as unknown as DatosMotor;

for (const variedad of ['mucha', 'poca'] as const) {
  const s = generarSemana({
    datos, N: 2, numHuecos: 14, presupuesto: 65, variedad, proteina: 'normal',
    esfuerzo: 'libre', exclusiones: [], semanaNumero: 1,
  });

  const recetas = s.tandas.map((t) => t.receta.id);
  const distintas = new Set(recetas).size;
  const cocinadas = s.huecos.filter((h) => h.tipo === 'cocinado').length;

  console.log(`\n═══ VARIEDAD «${variedad.toUpperCase()}» · 14 comidas para 2, 65 € ═══\n`);
  for (const h of s.huecos) {
    const nombre = h.receta?.nombre ?? 'No cocinas';
    const como = h.tipo === 'cocinado' ? 'COCINAS' : (h.tipo === 'sobras' ? 'sobras ' : 'con lo de');
    const de = h.origen ? ` (de ${h.origen.dia} ${h.origen.ranura})` : '';
    console.log(`  ${h.dia.padEnd(4)} ${h.ranura.padEnd(7)} ${como}  ${nombre}${de}`);
  }
  console.log(`\n  recetas distintas cocinadas: ${distintas}`);
  console.log(`  huecos en los que COCINAS:   ${cocinadas} de ${s.huecos.length}`);
  console.log(`  huecos que comes de lo ya hecho: ${s.huecos.length - cocinadas}`);
  console.log(`  ¿alguna receta cocinada DOS veces?: ${recetas.length !== distintas ? 'SÍ' : 'no'}`);
}
console.log('');
