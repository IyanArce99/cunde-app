import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

/**
 * ═══ EL TEST QUE PROTEGE LA ARQUITECTURA, NO UNA FUNCIÓN ═══
 *
 * La regla es que ningún componente, página ni reductor sepa que detrás de la
 * analítica hay Supabase. Es una regla fácil de escribir en un documento y
 * fácil de romper sin querer: alguien necesita un dato, importa el cliente
 * «solo esta vez», y a los tres meses hay quince sitios que hay que tocar para
 * cambiar de proveedor.
 *
 * Un test lo impide de verdad. Este no comprueba comportamiento: comprueba que
 * la forma del código sigue siendo la que se decidió.
 */

const RAIZ = path.resolve(__dirname, '..');

function ficheros(dir: string): string[] {
  const salida: string[] = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) salida.push(...ficheros(p));
    /* Fuera los `.d.ts`: declaran tipos, no ejecutan nada. `vite-env.d.ts`
       nombra `VITE_SUPABASE_ANON_KEY` para tiparla, que es justo lo contrario
       de acoplarse a Supabase — es documentar la variable en un solo sitio. */
    else if (/\.(ts|tsx)$/.test(e.name) && !/\.(test|d)\.tsx?$/.test(e.name)) salida.push(p);
  }
  return salida;
}

/** El único fichero de la app al que se le permite conocer el destino. */
const SUMIDERO = path.join(RAIZ, 'lib', 'analitica-supabase.ts');
/** Y el único que puede enchufarlo. */
const ARRANQUE = path.join(RAIZ, 'main.tsx');

describe('desacople de la analítica', () => {
  const todos = ficheros(RAIZ);

  it('solo el sumidero habla con Supabase', () => {
    const culpables = todos
      .filter((f) => f !== SUMIDERO)
      /* `lib/precios.ts` es otro subsistema y usa su propia URL; se le permite
         mencionar Supabase, pero no la RPC de analítica. */
      .filter((f) => /track_events|VITE_SUPABASE_ANON_KEY/.test(fs.readFileSync(f, 'utf8')))
      .map((f) => path.relative(RAIZ, f));
    expect(culpables).toEqual([]);
  });

  it('solo el arranque registra el sumidero', () => {
    const culpables = todos
      .filter((f) => f !== ARRANQUE && f !== path.join(RAIZ, 'lib', 'analitica.ts'))
      .filter((f) => /registrarSumideroAnalitica\s*\(/.test(fs.readFileSync(f, 'utf8')))
      .map((f) => path.relative(RAIZ, f));
    expect(culpables).toEqual([]);
  });

  it('ningún componente importa la cola ni la identidad directamente', () => {
    const permitidos = new Set([SUMIDERO, path.join(RAIZ, 'lib', 'analitica-supabase.ts')]);
    const culpables = todos
      .filter((f) => !permitidos.has(f) && !f.includes(`${path.sep}lib${path.sep}analitica-`))
      .filter((f) => /from '.*analitica-(cola|identidad)'/.test(fs.readFileSync(f, 'utf8')))
      .map((f) => path.relative(RAIZ, f));
    expect(culpables).toEqual([]);
  });

  /**
   * Lo que el usuario escribe en un extra puede ser «Medicinas mamá». Que ese
   * texto no salga del móvil no puede depender de que nadie se despiste.
   */
  it('ninguna llamada a analitica manda el nombre de un extra ni una exclusión', () => {
    const sospechosas: string[] = [];
    for (const f of todos) {
      const texto = fs.readFileSync(f, 'utf8');
      for (const m of texto.matchAll(/analitica\([^)]*\{[^}]*\}/gs)) {
        if (/\b(nombre|name|texto|label|exclusiones|alergias)\s*:/.test(m[0])) {
          sospechosas.push(`${path.relative(RAIZ, f)}: ${m[0].slice(0, 80)}`);
        }
      }
    }
    expect(sospechosas).toEqual([]);
  });
});
