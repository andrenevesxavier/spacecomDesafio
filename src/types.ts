export interface Ponto {
  id: number;
  faccao: number | null;
  timestamp: string;
  lat: number;
  lon: number;
  protetiva: boolean;
  restricoes: number[]; 
}

export type TipoEncontro = 'generico' | 'faccao' | 'protetiva';

export interface Encontro {
  tipo: TipoEncontro;
  monitoradosEncontro: [number, number];
  timestamp: string;
  posicoes: Record<string, { lat: number; lon: number }>;
  distanciaMetros: number;
}