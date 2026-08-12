# Monetización · Cunde+

> Estado a 12 de agosto de 2026. **El muro está APAGADO** (`MURO_ACTIVO = false`
> en [`src/lib/suscripcion.ts`](../src/lib/suscripcion.ts)). Todo lo que sigue
> está montado y probado, pero hoy nadie ve un muro ni puede pagar.

---

## El principio

Cunde gratis resuelve su promesa entera: presupuesto, menú, lista de la compra
con precios reales y coste previsto antes de salir de casa.

**Cunde+ no desbloquea el producto. Desbloquea personalización.**

Gratis es «Cunde me hace la semana». Con Cunde+ es «Cunde me la hace
exactamente a mi gusto».

Esa frase decide cada duda. Si una función es necesaria para saber cuánto vas a
gastar, es gratis. Si es para que la semana se parezca más a ti, se puede
cobrar.

---

## Los tres planes

| Plan | Precio | Al año | Producto en tienda |
|---|---:|---:|---|
| Semana | 1,49 € | 77,48 € | `cunde_plus_weekly` |
| **Mes** | **3,99 €** | **47,88 €** | `cunde_plus_monthly` |
| Para siempre | 29,99 € | — | `cunde_plus_lifetime` |

**Los tres dan exactamente lo mismo.** Lo único que cambia es cuánto dura y cómo
se paga. Ningún componente pregunta qué plan tiene el usuario: preguntan
`tieneCundePlus(estado)`. Si mañana hay un cuarto producto, no se toca ni un
componente.

El mensual es el que se quiere vender y además es el más barato al año — un 38%
por debajo del semanal. Eso es deliberado: el plan principal tiene que ser el
que gana en cuanto alguien compara.

### Por qué hay plan semanal si `CLAUDE.md` lo prohíbe

`CLAUDE.md` prohíbe la suscripción semanal por escrito. La regla se escribió
contra una app española que cobra **9,99 € a la semana** —519 € al año— con
prueba trampa de tres días.

Lo predatorio de aquello es el importe y la trampa, no el periodo. 1,49 € a la
semana son 77 € al año: dentro de la banda de la categoría, y sin prueba con
cargo automático detrás.

**La condición que lo mantiene honesto:** cada plan dice en pantalla lo que suma
en un año. Sin esa línea, un precio semanal pequeño es el mismo truco con otra
cifra — 1,49 parece tres veces más barato que 3,99 y en realidad es un 62% más
caro. Esa línea no es decoración: es el permiso para tener este plan.

### El de por vida

Se amortiza en 7,5 meses de plan mensual, así que quien piense quedarse más de
un año lo elige. Con unos 21 € netos tras la comisión de tienda cubre poco más
de medio año de ingreso mensual.

Es una decisión de **captación** —caja por delante, cero fricción, un usuario
que ya no se puede ir— no de ingreso recurrente. Si algún día lo que se busca es
recurrencia, este es el número a subir.

### El plan `hogar` que se fue

Estaba a 39,99 € «preparado para cuando exista la lista compartida». Esa lista
no existe, así que lo único que añadía sobre el plan normal era nada: habría
sido cobrar 10 € de más por el mismo producto. Cuando la lista compartida
exista, será una función de Cunde+, no otro plan.

---

## Qué se cobra

Dos cosas. Están enumeradas en `FuncionPlus`
([`src/lib/premium.ts`](../src/lib/premium.ts)) y no en strings sueltas, para
que añadir una tercera obligue a decidir su regla en un sitio en vez de repartir
un `if (!premium)` por las pantallas.

### 1 · Cambios de plato ilimitados

Gratis: **2 por semana**. Con Cunde+: sin límite y sin contar.

El contador guarda a **qué semana** pertenece la cuenta, no solo cuántos van.
Así el reseteo no necesita ningún gancho que se pueda olvidar: si la semana
guardada no es la actual, la cuenta vale cero.

La semana es la **semana lógica** (`semanaEfectiva`): el máximo entre las
semanas cerradas y las transcurridas desde que se generó. Nace una semana nueva
al cerrar la compra o al pasar siete días.

> **Esto cierra un agujero concreto.** Sin la semana lógica, el ciclo era: gasto
> mis dos cambios → muevo el presupuesto un euro → regenero → recupero los dos.
> `regenerar()` **no** incrementa `semanaNumero`; solo lo hace `GUARDAR_CIERRE`.
> Está comprobado en el reductor, no supuesto.

**Solo `APLICAR_SEMANA` gasta un cambio.** Es el único despachador de la app que
lo hace.

### 2 · Proteína Alta

Básica y Normal, gratis. Alta, con Cunde+.

Alta **no se esconde**: se ve, se puede tocar, y al tocarla sale el muro. Un
nivel oculto no se puede desear, y un nivel que desaparece al no pagar hace
pensar que la app está rota.

> ### ⚠ Esta es la decisión más discutible de todo el documento
>
> `suscripcion.ts` sostuvo durante semanas lo contrario, con este argumento:
> *«cobrar por comer legumbre en vez de carne es cobrar por una dieta, no por
> una función»*. Ese argumento **no se ha refutado** y sigue escrito en el
> código a propósito, encima de la decisión que lo contradice.
>
> Lo que sí se refutó es el dato que antes lo sostenía. Se decía que «alta le
> cuesta más dinero al usuario, así que no hay nada premium ahí». Es falso:
> medido sobre 48 combinaciones, el precio solo sube al subir de nivel en 13
> (27%), y hay casos que van al revés de largo — con 65 € y poca variedad,
> **41,05 € en básica contra 30,94 € en alta**.
>
> **La línea que no se cruza:** alergias, intolerancias y dietas por exclusión
> son gratis para siempre. Alta no es ninguna de esas cosas —nadie se hace daño
> comiendo menos proteína— y ese es el único motivo por el que se puede cobrar.
> Si mañana se decide que sí cruza la línea, quitarlo es borrar un valor del
> enum y un test se pondrá rojo señalando dónde.

### Un tercer límite que no está en `FuncionPlus`

`ALTERNATIVAS_GRATIS = 1` limita cuántas alternativas se **ven** por hueco.
`CAMBIOS_GRATIS_POR_SEMANA = 2` limita cuántas se **aplican** por semana.

Son dos puertas distintas sobre la misma acción y **las dos están activas**. Un
usuario sin Cunde+ y con el muro encendido ve una alternativa por hueco y puede
aplicar dos en toda la semana.

Se dice junto porque leyendo un fichero solo no se ve, y porque es la
combinación —no cada límite por separado— la que decide si el plan gratuito se
siente completo o capado. **Si hay que aflojar, aflojar una:** subir
`ALTERNATIVAS_GRATIS` da a elegir; subir `CAMBIOS_GRATIS_POR_SEMANA` da más
intentos. No son intercambiables.

---

## Qué NO se cobra, y por qué

Esto no es una lista de buenas intenciones. Hay un test
(`premium.test.ts`, «la frontera del producto») que se pone rojo si alguien
añade a `FuncionPlus` un nombre que suene a cualquiera de estas.

| Nunca se cobra | Por qué |
|---|---|
| **Alergias, intolerancias y dietas** | Cobrar por «sin gluten» es cobrar por no envenenar a alguien. No se negocia y no depende de ninguna tabla: es que no está en el código. |
| **La lista de la compra y los precios reales** | Es el producto. Es lo único que ChatGPT no puede hacer. |
| **«Bájame el precio»** | Es la promesa central. Cobrar por bajar la cesta a quien se ha pasado del presupuesto sería vender la solución al problema que la app dice resolver. |
| **«No cocino este día»** | Es la regla 5: *el plan se va a romper el martes, y la app absorbe el fallo*. Cobrar por rehacer el martes es cobrar por cumplir nuestra propia promesa. |
| **Bloquear un plato** | Es una preferencia persistente, no personalización de esta semana. Decir «no me lo vuelvas a poner» no gasta un cambio. Si además quiere sustituirlo **ahora**, eso ya es un cambio voluntario y sí cuenta. |
| **Cerrar la semana con el ticket** | Es la medición del producto. Cobrar por ella es cobrar por saber si la app funciona. |
| **Compartir** | Es distribución. Cobrarla es cobrar por traernos usuarios. |

---

## Cómo está montado

```
lib/suscripcion.ts   precios, IDs de producto, MURO_ACTIVO, los dos límites
lib/premium.ts       TODAS las reglas de acceso. Nadie más decide.
lib/compras.ts       RevenueCat. Lo único que habla con la tienda.
components/MuroDePago.tsx   la pantalla. No decide nada, solo pinta y avisa.
```

**Ninguna pantalla escribe `if (!premium)`.** Preguntan a `premium.ts`.

### La regla, separada de la bandera

Con `MURO_ACTIVO = false` todo el mundo tiene Cunde+ — deliberado: la beta no
puede salir con las funciones capadas y sin forma de pagarlas.

Eso dejaba los tests del límite en una de dos: o se saltaban —y entonces lo más
importante de Cunde+ no estaba probado justo antes de encenderlo— o daban un
verde que solo decía que la bandera está apagada.

Por eso la regla pura vive aparte:

```ts
reglaDeCambios(tienePlus: boolean, usados: number): AccesoCambio
```

No mira la bandera. Se prueba entera hoy, y `accesoACambiarPlato` es una línea
que le pasa el entitlement real.

### Un entitlement, tres productos

RevenueCat concede `cunde_plus` desde cualquiera de los tres. La app pregunta
por el entitlement, nunca por el producto.

`PRODUCTO_DE` traduce entre los dos vocabularios: `'de-por-vida'` (lo que se
guarda en el estado, con guiones, porque se serializa) y `'deporvida'` (la clave
de objeto). Traducir eso a ojo en cada sitio es exactamente cómo se acaba
cobrando el producto equivocado — ya pasó una vez con una cadena de ternarios.
Con el mapa, añadir un plan sin darle producto es un error de compilación.

### La tienda manda sobre el estado

Al arrancar, `permisoSegunLaTienda()` pregunta a RevenueCat y corrige el estado
local. Devuelve `boolean | null`, y **`null` significa «no se pudo saber» y no
toca nada**.

Antes devolvía `boolean` con `catch → false`, lo que contradecía su propio
comentario: sin cobertura, a quien había pagado se le quitaba el acceso. Los
sótanos de los supermercados no tienen cobertura.

---

## Qué pasa en los casos raros

| Caso | Qué pasa |
|---|---|
| **Compra a mitad de semana con los 2 gastados** | Desbloquea al instante. El contador **no** se resetea: si luego caduca, vuelve a estar en el límite en vez de regalar dos más. |
| **Caduca con 7 cambios hechos** | La semana que ya tiene **no se toca**. `restantes` sale 0, nunca negativo. No puede hacer más sin volver a pagar. |
| **Cancela la compra a medias** | `{estado: 'cancelada'}`. No se despacha `SET_SUSCRIPCION`, no se pinta error. Cancelar no es fallar. |
| **Falla el pago** | `{estado: 'fallo'}`. Se dice, y la app sigue funcionando entera. |
| **Reinstala la app** | «Restaurar compras» en el muro. Devuelve `{estado, tenia}` para poder decir «no había nada que restaurar» en vez de un éxito silencioso que parece un fallo. |
| **Viene de v15** | Entra con `{semana: 0, usados: 0}`. La semana 0 no coincide con ninguna real —empiezan en 1— así que migra con cero cambios usados sin lógica de migración. |
| **Tiene el plan `'año'`, que ya no se vende** | Sigue dando Cunde+. `Suscripcion` mantiene ese valor a propósito: quitarlo le quitaría a alguien lo que pagó. |
| **El contador guardado está corrupto** | Se repara a cero. Regalar dos cambios es infinitamente mejor que una pantalla en blanco al tocar la función que paga. |

---

## Analítica

12 eventos, en [`docs/analytics.md`](analytics.md):

`paywall_opened` · `paywall_closed` · `paywall_plan_selected` ·
`purchase_started` · `purchase_completed` · `purchase_cancelled` ·
`purchase_failed` · `restore_started` · `restore_completed` ·
`dish_change_used` · `dish_change_limit_reached` · `premium_feature_attempted`

`paywall_opened` lleva el **origen** (`cambios_plato`, `proteina_alta`,
`semana_2`) en el campo `source` que ya existía, no en uno paralelo. Sin eso no
se puede saber qué límite vende, que es la única pregunta que estos eventos
tienen que contestar.

**Nunca** el importe exacto, ni el ID de transacción, ni el recibo, ni el token
de tienda.

---

## Antes de encender el muro

1. Que haya usuarios que hayan llegado a la **semana 4**. Es la métrica que
   decide si esto es un negocio, y no se puede poner precio a algo que nadie ha
   usado una semana entera.
2. Los tres productos dados de alta y **aprobados** en Play Console.
3. Comprado de verdad con una cuenta de prueba, los tres.
4. Probado el restaurar en un dispositivo limpio.
5. Cambiar **una línea**: `MURO_ACTIVO = true`.

La checklist de lo que hay que hacer fuera del código está en
[`docs/lanzamiento-cunde-plus.md`](lanzamiento-cunde-plus.md).
