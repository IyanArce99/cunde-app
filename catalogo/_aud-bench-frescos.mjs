// Suma de huecos con proteína fresca y proteína media sobre las semanas con despensa, por etiqueta del banco.
import fs from 'node:fs';
for (const etiqueta of process.argv.slice(2)) {
  const ms = JSON.parse(fs.readFileSync(`catalogo/bench-motor/${etiqueta}.json`, 'utf8')).medidas.filter((m) => m.delArmario > 0);
  const suma = (f) => ms.reduce((a, m) => a + f(m), 0);
  console.log(`${etiqueta.padEnd(6)} semanas ${ms.length} · frescos ${suma((m) => m.frescos)} · proteína media ${(suma((m) => m.proteina) / ms.length).toFixed(1)} · cumplen suelo ${ms.filter((m) => m.cumpleSuelo).length} · sobras ${suma((m) => m.sobras)} · platos ${suma((m) => m.distintas)} · gasto efectivo>tope ${ms.filter((m) => m.carrito + m.delArmario > m.presupuesto).length}`);
}
