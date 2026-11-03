import { haversine } from './haversine';
import { Encontro } from './types';
import { Grupo } from './grupo';
import { LIMITE_METROS, ehProtetiva, classificar, montar } from './regras';

const RAIO_TERRA_M = 6_371_000;
const RAD_PARA_GRAU = 180 / Math.PI;
const MARGEM = 1.01; // folga contra erro de arredondamento

const LAT_CELULA_GRAUS = (LIMITE_METROS / RAIO_TERRA_M) * RAD_PARA_GRAU * MARGEM;
const SEN_METADE_ARCO = Math.sin(LIMITE_METROS / (2 * RAIO_TERRA_M));

function larguraCelulaLon(latMaxAbsGraus: number): number {
  const cosMin = Math.cos((latMaxAbsGraus * Math.PI) / 180);
  const razao = SEN_METADE_ARCO / cosMin;
  if (!(razao < 1)) return 1e9; // junto do polo: uma coluna só
  return 2 * Math.asin(razao) * RAD_PARA_GRAU * MARGEM;
}

// ---- Tabela hash própria (endereçamento aberto, em arrays tipados) ----
// Chave = (linha, coluna) da célula; valor = último ponto inserido nela.
// "geracao" marca quais posições pertencem ao timestamp atual, então não
// precisa limpar a tabela a cada timestamp.
let tabGen: Int32Array = new Int32Array(0);
let tabLinha: Int32Array = new Int32Array(0);
let tabColuna: Int32Array = new Int32Array(0);
let tabTopo: Int32Array = new Int32Array(0);
let mascara = 0;
let geracao = 0;

// Dados por ponto (reaproveitados entre timestamps)
let linhas: Int32Array = new Int32Array(1024);
let colunas: Int32Array = new Int32Array(1024);
let proximo: Int32Array = new Int32Array(1024); // lista encadeada por célula

interface Achado { i: number; j: number; d: number; protetiva: boolean }
const achados: Achado[] = [];

function prepararEstruturas(n: number): void {
  if (n > proximo.length) {
    const tam = Math.max(n, proximo.length * 2);
    linhas = new Int32Array(tam);
    colunas = new Int32Array(tam);
    proximo = new Int32Array(tam);
  }

  let cap = 16;
  while (cap < n * 2) cap <<= 1;
  if (cap > tabGen.length) {
    tabGen = new Int32Array(cap);
    tabLinha = new Int32Array(cap);
    tabColuna = new Int32Array(cap);
    tabTopo = new Int32Array(cap);
    geracao = 0;
  }
  mascara = cap - 1;

  if (geracao === 0x7fffffff) {
    tabGen.fill(0);
    geracao = 0;
  }
  geracao++;
}

function slotInicial(linha: number, coluna: number): number {
  let h = Math.imul(linha, 0x9e3779b1) ^ Math.imul(coluna, 0x85ebca6b);
  h ^= h >>> 15;
  return h & mascara;
}

function inserir(i: number, linha: number, coluna: number): void {
  let s = slotInicial(linha, coluna);
  while (tabGen[s] === geracao) {
    if (tabLinha[s] === linha && tabColuna[s] === coluna) {
      proximo[i] = tabTopo[s];
      tabTopo[s] = i;
      return;
    }
    s = (s + 1) & mascara;
  }
  tabGen[s] = geracao;
  tabLinha[s] = linha;
  tabColuna[s] = coluna;
  tabTopo[s] = i;
  proximo[i] = -1;
}

function buscar(linha: number, coluna: number): number {
  let s = slotInicial(linha, coluna);
  while (tabGen[s] === geracao) {
    if (tabLinha[s] === linha && tabColuna[s] === coluna) return tabTopo[s];
    s = (s + 1) & mascara;
  }
  return -1;
}

// lo < hi: mesma ordem de argumentos da força bruta
function testar(g: Grupo, lo: number, hi: number): void {
  let protetiva = false;
  if ((g.protetiva[lo] | g.protetiva[hi]) === 1) {
    protetiva = ehProtetiva(g, lo, hi);
    if (!protetiva) return; // vítima só forma encontro com o agressor dela
  }

  const d = haversine(g.lat[lo], g.lon[lo], g.lat[hi], g.lon[hi]);
  if (d >= LIMITE_METROS) return;

  achados.push({ i: lo, j: hi, d, protetiva });
}

export function detectarGrupo(g: Grupo, encontros: Encontro[]): void {
  const n = g.n;
  if (n < 2) return;
  prepararEstruturas(n);

  let latMaxAbs = 0;
  for (let i = 0; i < n; i++) {
    const l = Math.abs(g.lat[i]);
    if (l > latMaxAbs) latMaxAbs = l;
  }
  const lonCelula = larguraCelulaLon(latMaxAbs);

  // 1. distribui os pontos nas células
  for (let i = 0; i < n; i++) {
    const linha = Math.floor((g.lat[i] + 90) / LAT_CELULA_GRAUS);
    const coluna = Math.floor((g.lon[i] + 180) / lonCelula);
    linhas[i] = linha;
    colunas[i] = coluna;
    inserir(i, linha, coluna);
  }

  // 2. cada par de células vizinhas é visitado uma única vez:
  achados.length = 0;
  for (let i = 0; i < n; i++) {
    const l = linhas[i];
    const c = colunas[i];
    let j: number;

    for (j = buscar(l, c); j > i; j = proximo[j]) testar(g, i, j);

    for (j = buscar(l, c + 1); j !== -1; j = proximo[j]) {
      testar(g, i < j ? i : j, i < j ? j : i);
    }
    for (let dc = -1; dc <= 1; dc++) {
      for (j = buscar(l + 1, c + dc); j !== -1; j = proximo[j]) {
        testar(g, i < j ? i : j, i < j ? j : i);
      }
    }
  }
  if (achados.length === 0) return;

  // 3. mesma ordem de saída da força bruta (por i, depois j)
  achados.sort((x, y) => x.i - y.i || x.j - y.j);
  for (const { i, j, d, protetiva } of achados) {
    encontros.push(montar(g, classificar(g, i, j, protetiva), i, j, d));
  }
}