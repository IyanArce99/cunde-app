#!/usr/bin/env node --experimental-strip-types
/**
 * ═══ PRUEBA INTERNA · «SOY MÁS DE CARNE» CON LO QUE LA APP YA PERMITE ═══
 *
 * La app no tiene un ajuste de «más carne». Lo que sí tiene son los platos
 * que te gustan (VALORAR_PLATO → `platosFavoritos`), que el motor premia con
 * BONUS_FAVORITO por hueco sin tocar filtros, presupuesto ni proteína. Aquí se
 * simula a alguien que ha marcado «me gusta» en los platos de pollo y de lomo
 * de cerdo disponibles en 3120, y se compara con el menú general.
 *
 * Caso: 35007 → 3120 · 2 personas · comidas y cenas · semana desde el lunes
 * 19 oct 2026 · sin despensa · sin filtros · proteína normal · sin postre ·
 * variedad alta · 80 y 100 €. Escribe docs/preferencia-carne-2026-10-16.md.
 *
 *   node --experimental-strip-types catalogo/_aud-preferencia-carne.ts
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { generarSemana, variedadDeSemana } from '../src/motor/seleccionar.ts';
import type { PeticionSemana, SemanaGenerada } from '../src/motor/seleccionar.ts';
import { datosDeZona } from '../src/motor/zona.ts';
import type { CatalogoZona } from '../src/motor/zona.ts';
import { DIAS } from '../src/motor/tipos.ts';
import type { DatosMotor } from '../src/motor/tipos.ts';

const aqui = path.dirname(fileURLToPath(import.meta.url));
const leer = (f: string) => JSON.parse(fs.readFileSync(path.join(aqui, '..', f), 'utf8'));
const gc = datosDeZona(leer('src/data/motor-datos.json') as DatosMotor, leer('src/data/zonas/gran-canaria.json') as CatalogoZona, '3120');

/** Pollo y lomo de cerdo disponibles en 3120. Sin chorizo ni picada: no es lo que se pidió. */
const FAVORITOS = [
  'pollo_limon', 'pollo_guisado_patata', 'jamoncitos_ajillo_champinones', 'pollo_puerro_crema',
  'jamoncitos_horno_patata_zanahoria', 'pollo_judias_almendra', 'ensalada_pollo_maiz',
  'lomo_pimientos_horno', 'lomo_ajillo_champinones', 'lomo_champinones_crema', 'lomo_almendra_alcachofas',
].filter((id) => gc.recetas.some((r) => r.id === id));

const pet = (tope: number, extra: Partial<PeticionSemana> = {}): PeticionSemana => ({
  datos: gc, N: 2, numHuecos: 14, variedad: 'mucha', proteina: 'normal', esfuerzo: 'libre', exclusiones: [],
  presupuesto: tope, postre: false, semanaNumero: 1, recetasRecientes: [], existencias: {}, ordenDias: DIAS, ...extra,
});
const eur = (n: number) => `${n.toFixed(2).replace('.', ',')} €`;
const L: string[] = [];
const out = (s = '') => L.push(s);
const CARNE = new Set(['pollo', 'cerdo', 'vacuno', 'cordero']);

function resumen(s: SemanaGenerada) {
  const v = variedadDeSemana(s, gc);
  const cat: Record<string, number> = {};
  for (const t of s.tandas) cat[t.receta.proteina] = (cat[t.receta.proteina] ?? 0) + 1;
  const c = s.carrito;
  return `${eur(c.totalCarrito)} | ${eur(c.totalConsumo)} | ${eur(c.totalPerecedero)} | ${v.categorias} | ${v.maxPorCategoria} | ${s.tandas.filter((t) => CARNE.has(t.receta.proteina)).length} | ${(cat.legumbre ?? 0)} | ${(cat.pescado ?? 0) + (cat.marisco ?? 0)} | ${s.nutricion.proteinaPorPersonaDia.toFixed(1).replace('.', ',')} | ${s.cuadra ? 'sí' : 'no'}`;
}

function menu(s: SemanaGenerada) {
  out('| día | comida | cena |');
  out('|---|---|---|');
  for (const d of DIAS) {
    const c = (ranura: string) => {
      const h = s.huecos.find((x) => x.dia === d && x.ranura === ranura);
      if (!h?.receta) return '—';
      const m = CARNE.has(h.receta.proteina) ? '**' : '';
      return `${m}${h.receta.nombre}${m} · ${h.receta.proteina}${h.tipo === 'cocinado' ? '' : ` *(${h.tipo})*`}`;
    };
    out(`| ${d} | ${c('comida')} | ${c('cena')} |`);
  }
  out();
}

out('# «Soy más de carne» · prueba interna con los favoritos · 16 oct 2026');
out();
out('> Generado por `catalogo/_aud-preferencia-carne.ts`. No cambia ningún valor por defecto: simula a un usuario');
out('> que ha marcado «me gusta» en estos platos, que es lo que la app ya permite hoy.');
out();
out(`**Favoritos simulados (${FAVORITOS.length}):** ${FAVORITOS.map((id) => gc.recetas.find((r) => r.id === id)!.nombre).join(', ')}.`);
out();
out('| | caja | consumo | perecedero | categorías | máx. por categoría | tandas de carne | de legumbre | de pescado o marisco | prot. g | cuadra |');
out('|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|');
const res: Record<string, SemanaGenerada> = {};
for (const tope of [80, 100]) {
  res[`${tope}g`] = generarSemana(pet(tope));
  res[`${tope}f`] = generarSemana(pet(tope, { platosFavoritos: FAVORITOS }));
  out(`| ${tope} € · general | ${resumen(res[`${tope}g`])} |`);
  out(`| ${tope} € · con favoritos de carne | ${resumen(res[`${tope}f`])} |`);
}
out();
for (const tope of [80, 100]) {
  out(`## ${tope} € · general`);
  out();
  menu(res[`${tope}g`]);
  out(`## ${tope} € · con favoritos de carne`);
  out();
  menu(res[`${tope}f`]);
}
const salida = path.join(aqui, '..', 'docs', 'preferencia-carne-2026-10-16.md');
fs.writeFileSync(salida, `${L.join('\n')}\n`);
console.log(`Escrito ${salida}`);
