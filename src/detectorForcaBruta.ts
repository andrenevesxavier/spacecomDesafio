import { haversine } from './haversine';
import { Encontro } from './types';
import { Grupo } from './grupo';
import { LIMITE_METROS, ehProtetiva, classificar, montar } from './regras';

export function detectarGrupo(g: Grupo, encontros: Encontro[]): void {
  const n = g.n;
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      let protetiva = false;
      if ((g.protetiva[i] | g.protetiva[j]) === 1) {
        protetiva = ehProtetiva(g, i, j);
        if (!protetiva) continue;
      }

      const d = haversine(g.lat[i], g.lon[i], g.lat[j], g.lon[j]);
      if (d >= LIMITE_METROS) continue;

      encontros.push(montar(g, classificar(g, i, j, protetiva), i, j, d));
    }
  }
}