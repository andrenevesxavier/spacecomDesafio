import { readFileSync } from 'node:fs';

interface Encontro {
  tipo: string;
  monitoradosEncontro: [number, number];
  timestamp: string;
  posicoes: Record<string, { lat: number; lon: number }>;
  distanciaMetros: number;
}

const [arquivoGerado, arquivoGabarito] = process.argv.slice(2);
if (!arquivoGerado || !arquivoGabarito) {
  console.error('Uso: node dist/comparar.js <gerado.json> <gabarito.json>');
  process.exit(1);
}

const ler = (caminho: string): Encontro[] =>
  JSON.parse(readFileSync(caminho, 'utf-8'));

const chavePar = (e: Encontro): string => {
  const [x, y] = [...e.monitoradosEncontro].sort((a, b) => a - b);
  return `${e.timestamp}|${x},${y}`;
};

const gerado = ler(arquivoGerado);
const gabarito = ler(arquivoGabarito);

const mapaGabarito = new Map<string, Encontro>();
for (const e of gabarito) mapaGabarito.set(chavePar(e), e);

const mapaGerado = new Map<string, Encontro>();
const duplicados: string[] = [];
for (const e of gerado) {
  const k = chavePar(e);
  if (mapaGerado.has(k)) duplicados.push(`${k} (${mapaGerado.get(k)!.tipo} e ${e.tipo})`);
  else mapaGerado.set(k, e);
}

let corretos = 0;
const tipoErrado: string[] = [];
const distanciaDiferente: string[] = [];
const posicaoDiferente: string[] = [];
const sobrando: string[] = [];
const faltando: string[] = [];

for (const [k, g] of mapaGerado) {
  const esperado = mapaGabarito.get(k);
  if (!esperado) {
    sobrando.push(`${k} [${g.tipo}]`);
    continue;
  }
  if (g.tipo !== esperado.tipo) {
    tipoErrado.push(`${k} gerado=${g.tipo} esperado=${esperado.tipo}`);
    continue;
  }
  corretos++;

  if (g.distanciaMetros !== esperado.distanciaMetros) {
    distanciaDiferente.push(
      `${k} gerado=${g.distanciaMetros} esperado=${esperado.distanciaMetros}`
    );
  }
  for (const id of Object.keys(esperado.posicoes)) {
    const pg = g.posicoes[id];
    const pe = esperado.posicoes[id];
    if (!pg || pg.lat !== pe.lat || pg.lon !== pe.lon) {
      posicaoDiferente.push(`${k} ID ${id}`);
    }
  }
}

for (const [k, e] of mapaGabarito) {
  if (!mapaGerado.has(k)) faltando.push(`${k} [${e.tipo}]`);
}

const incorretos = sobrando.length + tipoErrado.length + duplicados.length;

const secao = (titulo: string, itens: string[]) => {
  if (itens.length === 0) return;
  console.log(`\n${titulo} (${itens.length}):`);
  itens.slice(0, 20).forEach((i) => console.log('  -', i));
  if (itens.length > 20) console.log(`  ... e mais ${itens.length - 20}`);
};

console.log(`Gerados:   ${gerado.length}`);
console.log(`Gabarito:  ${gabarito.length}`);
console.log(`Corretos:  ${corretos}`);
console.log(`Incorretos: ${incorretos}`);
console.log(`Faltando:  ${faltando.length}`);
console.log(`Score (corretos - incorretos): ${corretos - incorretos}`);

secao('Duplicados no seu JSON (mesmo par e timestamp)', duplicados);
secao('Tipo errado', tipoErrado);
secao('Sobrando (falsos positivos)', sobrando);
secao('Faltando', faltando);
secao('Distância diferente do gabarito', distanciaDiferente);
secao('Posição diferente do gabarito', posicaoDiferente);

if (incorretos === 0 && faltando.length === 0 && distanciaDiferente.length === 0 && posicaoDiferente.length === 0) {
  console.log('\nIDÊNTICO ao gabarito.');
} else {
  process.exitCode = 1;
}