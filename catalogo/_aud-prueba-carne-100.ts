#!/usr/bin/env node --experimental-strip-types
/**
 * ═══ LA SEMANA DE PRUEBA · 100 € CON FAVORITOS DE CARNE ═══
 *
 * Menú, lista de la compra e instrucciones de conservación de la semana que
 * sale con los favoritos de pollo y lomo de cerdo (ver
 * catalogo/_aud-preferencia-carne.ts). Las instrucciones solo dicen lo que
 * consta en una ficha consultada o en la receta; lo demás remite a la
 * etiqueta. Escribe docs/prueba-carne-100-2026-10-16.md.
 *
 *   node --experimental-strip-types catalogo/_aud-prueba-carne-100.ts
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { esCongelado, horasAbiertoDe } from '../src/motor/carrito.ts';
import { generarSemana } from '../src/motor/seleccionar.ts';
import { datosDeZona } from '../src/motor/zona.ts';
import type { CatalogoZona } from '../src/motor/zona.ts';
import { DIAS } from '../src/motor/tipos.ts';
import type { DatosMotor } from '../src/motor/tipos.ts';

const aqui = path.dirname(fileURLToPath(import.meta.url));
const leer = (f: string) => JSON.parse(fs.readFileSync(path.join(aqui, '..', f), 'utf8'));
const gc = datosDeZona(leer('src/data/motor-datos.json') as DatosMotor, leer('src/data/zonas/gran-canaria.json') as CatalogoZona, '3120');
const FAVORITOS = [
  'pollo_limon', 'pollo_guisado_patata', 'jamoncitos_ajillo_champinones', 'pollo_puerro_crema',
  'jamoncitos_horno_patata_zanahoria', 'pollo_judias_almendra', 'ensalada_pollo_maiz',
  'lomo_pimientos_horno', 'lomo_ajillo_champinones', 'lomo_champinones_crema', 'lomo_almendra_alcachofas',
].filter((id) => gc.recetas.some((r) => r.id === id));

/** Lo que dicen las fichas consultadas (3120, 16 oct 2026). Nada más. */
const FICHAS: Record<string, string> = {
  '3400': 'Pechuga: entre 0 y 4 ºC. **Una vez abierto el envase, consumir en 24 horas** (ficha 3400).',
  '4119': 'Lomo: en refrigeración entre 0 y 4 ºC. **Una vez abierto, consumir antes de 48 horas** (ficha 4119).',
  '25183': 'Jamoncitos congelados: a −18 ºC. **Descongelar completamente antes de usar, una vez descongelados consumir en 24 horas**, no volver a congelar (ficha 25183). Descongela solo los que vayas a cocinar.',
  '62050': 'Bacalao: a −18 ºC. **Sacar del envase y descongelar 12 horas en el frigorífico sobre una rejilla; una vez descongelado, consumir en 24 horas** (ficha 62050). Viene en su punto de sal.',
  '62212': 'Merluza: a −18 ºC o menos. Descongelar en el frigorífico sobre rejilla 12-24 horas; no volver a congelar (ficha 62212).',
};

const p = {
  datos: gc, N: 2, numHuecos: 14, variedad: 'mucha' as const, proteina: 'normal' as const, esfuerzo: 'libre' as const,
  exclusiones: [], presupuesto: 100, postre: false, semanaNumero: 1, recetasRecientes: [], existencias: {},
  ordenDias: DIAS, platosFavoritos: FAVORITOS,
};
const s = generarSemana(p);
const eur = (n: number) => `${n.toFixed(2).replace('.', ',')} €`;
const num = (n: number) => `${Number(n.toFixed(3))}`.replace('.', ',');
const L: string[] = [];
const out = (x = '') => L.push(x);

out('# Semana de prueba · 100 € con favoritos de pollo y cerdo · 16 oct 2026');
out();
out('> Generada por `catalogo/_aud-prueba-carne-100.ts`. Caso: 35007 → 3120 · 2 personas · comidas y cenas ·');
out('> semana desde el **lunes 19 oct 2026** · despensa vacía · sin filtros · proteína normal · sin postre ·');
out('> variedad alta · tope 100 €. En el teléfono el menú puede salir distinto: depende de la fecha de inicio,');
out('> del número de semana, del historial y de lo que haya en casa.');
out();
out(`**Caja ${eur(s.carrito.totalCarrito)}** · se come ${eur(s.carrito.totalConsumo)} · perecedero estimado ${eur(s.carrito.totalPerecedero)} · proteína ${s.nutricion.proteinaPorPersonaDia.toFixed(1).replace('.', ',')} g por persona y día · ${s.cuadra ? 'cuadra' : 'NO cuadra'}.`);
out();
out('## Menú');
out();
out('| día | comida (14:00) | cena (21:00) |');
out('|---|---|---|');
for (const d of DIAS) {
  const c = (r: string) => {
    const h = s.huecos.find((x) => x.dia === d && x.ranura === r);
    if (!h?.receta) return '—';
    const fav = FAVORITOS.includes(h.receta.id) ? ' ♥' : '';
    return `${h.receta.nombre}${fav}${h.tipo === 'sobras' ? ' *(sobras)*' : h.tipo === 'ensamblaje' ? ' *(con lo de otro día)*' : ''}`;
  };
  out(`| ${d} | ${c('comida')} | ${c('cena')} |`);
}
out();
out('♥ = plato de los favoritos simulados. Las horas son el supuesto del motor para contar los plazos.');
out();

out('## Lista de la compra');
out();
out('| producto | envases | se usa | sobra | de eso, abierto | precio | sobrante dado por perdido |');
out('|---|---:|---:|---:|---:|---:|---:|');
const lineas = s.carrito.lineas.filter((l) => !l.esDespensa && l.compras > 0).sort((a, b) => a.departamento.localeCompare(b.departamento) || b.carritoCoste - a.carritoCoste);
for (const l of lineas) {
  out(`| ${l.nombre} | ${l.compras} × ${num(l.contenidoEnvase)} ${l.unidad} | ${num(l.necesario)} ${l.unidad} | ${num(l.sobranteCantidad)} ${l.unidad} | ${l.sobranteAbierto ? `${num(l.sobranteAbierto)} ${l.unidad}` : '—'} | ${eur(l.carritoCoste)} | ${l.perecederoCoste > 0.005 ? eur(l.perecederoCoste) : '—'} |`);
}
out();
const despensa = s.carrito.lineas.filter((l) => l.esDespensa);
out(`Despensa (fuera del total, se supone en casa): ${despensa.map((l) => l.nombre).join(', ')}.`);
out();

out('«De eso, abierto»: lo que queda en un envase ya abierto. La app no lo pasa a la semana siguiente y lo cuenta');
out('entero como perdido: o la ficha no da plazo una vez abierto, o el siguiente uso cae fuera de él.');
out();
out('## Conservación');
out();
out('Tres cosas distintas, y cada una con su fuente. **Ningún test de software valida estos plazos**: los tests');
out('comprueban que la app aplica los datos que tiene, no que los datos sean seguros. Manda siempre la etiqueta.');
out();
out('### 1 · Producto sin abrir');
out();
out('La fecha va en la etiqueta y la app no la conoce. Lo que la app usa para planificar es una estimación del');
out('vocabulario (por ejemplo, 4 días para la pechuga desde la compra), no la fecha real. Congelados: congelador.');
out();
for (const l of lineas) if (FICHAS[l.sku.split('.')[0]]) out(`- ${FICHAS[l.sku.split('.')[0]]}`);
out();
out('### 2 · Producto abierto');
out();
out('Horas de la ficha de Mercadona consultada el 16 oct 2026 (almacén 3120). Las sesiones se cuentan con comida a');
out('las 14:00 y cena a las 21:00: si cocinas a otra hora, el margen cambia.');
out();
const HORA: Record<string, number> = { comida: 14, cena: 21 };
const sesiones = (sku: string) => s.tandas.filter((t) => t.receta.ingredientes.some((i) => gc.skus[i.canonico]?.sku === sku)).map((t) => {
  const h = s.huecos.find((x) => x.receta?.id === t.receta.id && x.tipo === 'cocinado')!;
  return { nombre: t.receta.nombre, h, hora: DIAS.indexOf(h.dia) * 24 + HORA[h.ranura] };
}).sort((a, b) => a.hora - b.hora);
const conFicha: string[] = [];
const sinFicha: string[] = [];
for (const l of lineas) {
  const c = l.canonicos[0];
  const sku = gc.skus[c];
  if (esCongelado(sku)) continue;
  const horas = horasAbiertoDe(gc.ingredientes[c], sku);
  const us = sesiones(l.sku);
  if (!us.length) continue;
  const dondes = us.map((u) => `${u.h.dia} ${u.h.ranura} («${u.nombre}»)`).join(', ');
  if (horas !== undefined) {
    conFicha.push(`- **${l.nombre}**: ${horas ? `${horas} h una vez abierto` : 'consumir todo una vez abierto'}. Se usa ${dondes}.${l.sobranteAbierto ? ` Se dan por perdidos ${num(l.sobranteAbierto)} ${l.unidad} abiertos.` : ''}`);
  } else if ((l.sobranteAbierto ?? 0) > 0) {
    sinFicha.push(`- **${l.nombre}**: se usa ${dondes}. Sin dato de abierto, cada sesión abre su envase${l.sobranteAbierto ? ` y se dan por perdidos ${num(l.sobranteAbierto)} ${l.unidad}` : ''}. Si la etiqueta da plazo y te cuadra, lo que sobre te puede valer: eso es decisión tuya, no de la app.`);
  }
}
out(conFicha.length ? conFicha.join('\n') : '- Ninguno esta semana.');
out();
out('**Sin dato en la app.** No se da por aprovechable lo que queda abierto: la lista compra lo que haga falta y el');
out('resto cuenta como perdido.');
out();
out(sinFicha.length ? sinFicha.join('\n') : '- Ninguno esta semana.');
out();
out('**Lo que no se «abre»** —fruta y verdura entera, huevos, secos en paquete—: la app suma lo de toda la semana y');
out('usa la estimación sin abrir del punto 1. Los secos ya abiertos (almendra, soja texturizada), bien cerrados.');
out();
out('### 3 · Comida cocinada (sobras)');
out();
out('El plazo es el de la receta (`dias_nevera`), redactado al escribirla: **no está comprobado en cocina ni por');
out('ningún test**. Guarda en la nevera en cuanto se temple.');
out();
for (const t of s.tandas) {
  const hs = s.huecos.filter((h) => h.receta?.id === t.receta.id);
  if (hs.length < 2) continue;
  out(`- ${t.receta.nombre}: se cocina el ${hs[0].dia} (${hs[0].ranura}) y se come también el ${hs.slice(1).map((h) => `${h.dia} (${h.ranura})`).join(', ')}. La receta dice ${t.receta.dias_nevera ?? '?'} días.`);
}
out();
const salida = path.join(aqui, '..', 'docs', 'prueba-carne-100-2026-10-16.md');
fs.writeFileSync(salida, `${L.join('\n')}\n`);
console.log(`Escrito ${salida}`);
