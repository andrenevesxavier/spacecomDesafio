import { Grupo } from './grupo';
import { Encontro, TipoEncontro } from './types';

export const LIMITE_METROS = 20;

export function ehProtetiva(g: Grupo, i: number, j: number): boolean {
  if (g.protetiva[i] === 1) {
    const r = g.restricoes[i];
    if (r !== null && r.includes(g.id[j])) return true;
  }
  if (g.protetiva[j] === 1) {
    const r = g.restricoes[j];
    if (r !== null && r.includes(g.id[i])) return true;
  }
  return false;
}

export function classificar(
  g: Grupo, i: number, j: number, protetiva: boolean
): TipoEncontro {
  if (protetiva) return 'protetiva';
  if (g.faccao[i] !== -1 && g.faccao[i] === g.faccao[j]) return 'faccao';
  return 'generico';
}

export function montar(
  g: Grupo, tipo: TipoEncontro, i: number, j: number, d: number
): Encontro {
  const [x, y] = g.id[i] < g.id[j] ? [i, j] : [j, i]; // IDs ordenados

  return {
    tipo,
    monitoradosEncontro: [g.id[x], g.id[y]],
    timestamp: g.timestamp,
    posicoes: {
      [g.id[x]]: { lat: g.lat[x], lon: g.lon[x] },
      [g.id[y]]: { lat: g.lat[y], lon: g.lon[y] },
    },
    distanciaMetros: d,
  };
}