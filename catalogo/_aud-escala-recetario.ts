/**
 * ═══ ¿HASTA CUÁNTAS RECETAS AGUANTA ESTO? ═══
 *
 * La pregunta era si el recetario debería vivir en Supabase en vez de dentro
 * del APK. Antes de decidir arquitectura hay que saber qué se paga y dónde, así
 * que esto duplica el recetario —cambiando los ids, porque duplicarlos sin más
 * los descartaría por id repetido— y mide las tres cosas por separado:
 *
 *   · el JSON, que es lo que engorda el APK
 *   · el parseo, que es lo que retrasa el arranque
 *   · el motor, que es lo que hace esperar al usuario mirando la pantalla
 *
 * ═══ MEDIDO EL 7 AGO 2026 ═══
 *
 *   recetas    JSON    parse   generar   platos
 *       151  269 KB   1,5 ms    121 ms     12,0
 *       302  473 KB   2,1 ms    181 ms     12,0
 *       604  879 KB   3,4 ms    333 ms     12,0
 *      1208 1692 KB   7,0 ms    675 ms     12,0
 *
 * Y lo que dicen los números, que no es lo que uno esperaría:
 *
 *   1. EL TAMAÑO NO ES EL PROBLEMA. Con 1.200 recetas el JSON son 1,7 MB, que
 *      comprimidos en el APK son unos 400 KB sobre un APK de 12 MB. Nada.
 *   2. EL PARSEO TAMPOCO. 7 ms aquí, quizá 30 en un móvil de gama media, y una
 *      sola vez por arranque.
 *   3. EL MOTOR SÍ, Y CRECE LINEAL. 121 → 675 ms multiplicando por ocho el
 *      recetario. En un móvil de gama media eso son 2-3 segundos por semana
 *      generada, y la hoja de Ajustes genera SEIS (tres niveles de proteína y
 *      tres de variedad) cada vez que se abre.
 *
 * Así que mover el recetario a Supabase no arregla el límite: el motor necesita
 * el recetario ENTERO en memoria para elegir, así que da igual de dónde venga.
 * Lo que sí escala es traerse un TROZO —el que encaja con las exclusiones y el
 * esfuerzo de ese usuario—, que recorta el payload y el cómputo a la vez.
 *
 * Y una cuarta cosa: `platos` se queda clavado en 12,0 en las cuatro filas.
 * Doce es el tope de «mucha variedad», así que más recetas NO dan más platos
 * en una semana. Dan cobertura bajo filtros y memoria entre semanas, que es
 * otra cosa y también vale — pero conviene no confundirlas.
 *
 *   node --experimental-strip-types catalogo/_aud-escala-recetario.ts
 */
import fs from 'node:fs';
import { generarSemana } from '../src/motor/seleccionar.ts';
import type { DatosMotor, PeticionSemana } from '../src/motor/seleccionar.ts';

const base = JSON.parse(fs.readFileSync('src/data/motor-datos.json', 'utf8')) as DatosMotor;

function multiplicar(veces: number): DatosMotor {
  const d = JSON.parse(JSON.stringify(base)) as DatosMotor;
  const original = base.recetas;
  d.recetas = [];
  for (let k = 0; k < veces; k++) {
    for (const r of original) {
      d.recetas.push(k === 0 ? r : { ...r, id: `${r.id}__c${k}`, nombre: `${r.nombre} ${k}` });
    }
  }
  return d;
}

const PET = {
  N: 2, numHuecos: 14, presupuesto: 65, variedad: 'mucha',
  proteina: 'normal', esfuerzo: 'libre', exclusiones: [] as string[],
} as const;

console.log('\n recetas   JSON     parse    generar una semana     platos');
for (const veces of [1, 2, 4, 8]) {
  const d = multiplicar(veces);
  const texto = JSON.stringify(d);
  const kb = Math.round(texto.length / 1024);

  let t = process.hrtime.bigint();
  for (let i = 0; i < 3; i++) JSON.parse(texto);
  const parseMs = Number(process.hrtime.bigint() - t) / 1e6 / 3;

  // Se descarta la primera: el JIT calienta y eso no es lo que ve el usuario.
  generarSemana({ ...PET, datos: d, semanaNumero: 1 } as PeticionSemana);
  t = process.hrtime.bigint();
  let platos = 0;
  for (const semanaNumero of [1, 2, 3]) {
    const s = generarSemana({ ...PET, datos: d, semanaNumero } as PeticionSemana);
    platos += new Set(s.tandas.map((x) => x.receta.id)).size;
  }
  const genMs = Number(process.hrtime.bigint() - t) / 1e6 / 3;

  console.log(
    `${String(d.recetas.length).padStart(8)}${String(kb).padStart(7)} KB`
    + `${parseMs.toFixed(1).padStart(9)} ms${genMs.toFixed(0).padStart(15)} ms`
    + `${(platos / 3).toFixed(1).padStart(12)}`,
  );
}
console.log('\nMedido en portátil. Un móvil de gama media va 3-5 veces más lento.\n');
