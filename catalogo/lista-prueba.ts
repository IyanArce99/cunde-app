#!/usr/bin/env node --experimental-strip-types
/**
 * La lista de la compra de la prueba personal, para imprimir o llevar en el
 * móvil: la misma semana que monta la app para 35007 (almacén 3120) con 2
 * personas, comidas y cenas, 65 €, variedad normal, empezando el miércoles 14
 * de octubre de 2026. Producto, formato, envases, cuánto usa el menú de cada
 * uno, importe online y enlace; y aparte, los básicos que no suman.
 *
 *   node --experimental-strip-types catalogo/lista-prueba.ts > docs/compra-prueba-35007.md
 */
import fs from 'node:fs';
import { datosDeZona } from '../src/motor/zona.ts';
import { generarSemana } from '../src/motor/seleccionar.ts';

const leer = (r: string) => JSON.parse(fs.readFileSync(r, 'utf8'));
const zona = leer('src/data/zonas/gran-canaria.json');
const d = datosDeZona(leer('src/data/motor-datos.json'), zona, '3120');
const s = generarSemana({
  datos: d, N: 2, numHuecos: 14, presupuesto: 65, variedad: 'normal', proteina: 'normal',
  esfuerzo: 'libre', exclusiones: [], semanaNumero: 1, ordenDias: ['MIÉ', 'JUE', 'VIE', 'SÁB', 'DOM', 'LUN', 'MAR'],
});
const eur = (n: number) => `${n.toFixed(2).replace('.', ',')} €`;
const cant = (x: number, u: string) => (u === 'ud' ? `${String(Math.round(x * 10) / 10).replace('.', ',')} ud` : x < 1 ? `${Math.round(x * 1000)} ${u === 'kg' ? 'g' : 'ml'}` : `${String(Math.round(x * 100) / 100).replace('.', ',')} ${u === 'kg' ? 'kg' : 'l'}`);
const envase = (l: any) => `${l.packaging ?? 'Unidad'} ${cant(l.contenidoEtiqueta ?? l.contenidoEnvase, l.unidad)}${l.pesoVariable ? ' aprox.' : ''}${l.contenidoEtiqueta ? ` (${cant(l.contenidoEnvase, l.unidad)} escurr.)` : ''}`;

const compra = s.carrito.lineas.filter((l) => !l.esDespensa && l.compras > 0)
  .sort((a, b) => a.departamento.localeCompare(b.departamento) || a.nombre.localeCompare(b.nombre));
const basicos = s.carrito.lineas.filter((l) => l.esDespensa);

const o: string[] = [];
o.push('# Lista de la compra · prueba en 35007', '');
o.push(`Mercadona, tienda online del **almacén 3120** (Las Palmas, 35005-35009). Precios consultados el ${zona.version}. **En la tienda física pueden cambiar**: apunta en la columna «Ticket» lo que cobren.`, '');
o.push('2 personas · comidas y cenas · 65 € · variedad normal · semana del **miércoles 14 al martes 20 de octubre**.', '');
o.push('> Si abres la app otro día, la semana empieza ese día y el menú cambia (entre 50,06 € y 57,04 € según el día, medido). Entonces vale la lista que te dé la app: sale del mismo catálogo verificado. Esta es la de empezar en miércoles.', '');
o.push('## Menú', '', '| Día | Comida | Cena |', '|---|---|---|');
const dias: Record<string, string[]> = {};
for (const h of s.huecos) (dias[h.dia] ??= []).push(`${h.receta?.nombre ?? '—'}${h.tipo === 'sobras' ? ' (sobras)' : h.tipo === 'ensamblaje' ? ' (aprovechando)' : ''}`);
for (const [dia, v] of Object.entries(dias)) o.push(`| ${dia} | ${v[0]} | ${v[1]} |`);
o.push('', `## Compra · ${compra.length} productos · ${compra.reduce((a, l) => a + l.compras, 0)} envases · **${eur(s.carrito.totalCarrito)}**`, '');
o.push('| ✓ | Pasillo | Producto | Formato | Envases | El menú usa | Importe online | Ticket |', '|---|---|---|---|---|---|---|---|');
for (const l of compra) {
  o.push(`| ☐ | ${l.departamento} | [${l.nombre}](https://tienda.mercadona.es/product/${l.sku}/) | ${envase(l)} | ${l.compras} | ${cant(l.necesario, l.unidad)} | ${eur(l.carritoCoste)} | |`);
}
o.push(`|  |  | **Total** |  | **${compra.reduce((a, l) => a + l.compras, 0)}** |  | **${eur(s.carrito.totalCarrito)}** | |`, '');
o.push('## Básicos que NO están en el total', '', 'Se asumen en casa. Marca los que tienes; si te falta alguno, la app lo suma al tocarlo en «Por si te falta».', '');
o.push('| Lo tengo | Producto | Formato | El menú usa | Si lo compras (online) |', '|---|---|---|---|---|');
for (const l of basicos) {
  const precio = l.compras > 0 ? l.carritoCoste : (Math.max(1, Math.ceil(l.necesario / l.contenidoEnvase)) * (d.skus[l.canonicos[0]]?.precio ?? 0));
  o.push(`| ☐ | [${l.nombre}](https://tienda.mercadona.es/product/${l.sku}/) | ${envase(l)} | ${cant(l.necesario, l.unidad)} | ${eur(precio)} |`);
}
o.push('', '## Qué comprobar o fotografiar en la tienda', '');
o.push('- **El ticket entero**: es la primera comparación entre la tienda física y la online.');
o.push('- **Limón**: si en el lineal se vende por pieza o a peso, y a cuánto.');
o.push('- **Cous cous mediano Hacendado**: foto del código de barras y del bloque de ingredientes de la caja. Si el EAN es 8011033012108 y no dice mostaza, la traza de mostaza se puede quitar; si dice mostaza, se queda.');
o.push('- **Si quieres ampliar el recetario** (no hace falta para esta prueba): foto del cartel o de la etiqueta de pimiento verde, berenjena, calabacín, pepino, repollo y calabaza; de la etiqueta de la bandeja de contramuslo, costilla, entrecot, filete de vacuno, solomillo, morcillo y chuletas de cordero; y, si compras calamar, su peso antes y después de limpiarlo.');
console.log(o.join('\n'));
