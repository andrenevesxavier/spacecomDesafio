import { writeFileSync } from 'node:fs';
import { LeitorCsv } from './csvParser';
import { detectarGrupo as detectarBruta } from './detectorForcaBruta';
import { detectarGrupo as detectarGrade } from './detectorGrade';
import { Encontro } from './types';

function main(): void {
  const [entrada, saida, modo] = process.argv.slice(2);
  if (!entrada || !saida) {
    console.error('Uso: node dist/index.js <dataset.txt> <saida.json> [bruta]');
    process.exit(1);
  }

  const detectar = modo === 'bruta' ? detectarBruta : detectarGrade;
  const encontros: Encontro[] = [];

  const t0 = performance.now();
  const leitor = new LeitorCsv((g) => detectar(g, encontros));
  const { linhas, timestamps } = leitor.ler(entrada);
  const t1 = performance.now();

  writeFileSync(saida, JSON.stringify(encontros));

  console.log(`Linhas:     ${linhas}`);
  console.log(`Timestamps: ${timestamps}`);
  console.log(`Total:      ${(t1 - t0).toFixed(0)} ms (leitura + detecção)`);
  console.log(`Encontros:  ${encontros.length}`);
}

main();