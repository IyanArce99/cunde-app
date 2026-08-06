#!/usr/bin/env node --experimental-strip-types
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as M from '../src/motor/seleccionar.ts';
import type { DatosMotor } from '../src/motor/tipos.ts';
const aqui = path.dirname(fileURLToPath(import.meta.url));
const datos: DatosMotor = JSON.parse(fs.readFileSync(path.join(aqui, '..', 'src', 'data', 'motor-datos.json'), 'utf8'));
const base = { datos, N: 2, numHuecos: 14, esfuerzo: 'libre' as const, exclusiones: [], proteina: 'normal' as const, semanaNumero: 1, variedad: 'normal' as const, presupuesto: 65 };
for (let i = 0; i < 40; i++) M.construir(base);
