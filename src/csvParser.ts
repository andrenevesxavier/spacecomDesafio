import { openSync, readSync, closeSync } from 'node:fs';
import { Grupo } from './grupo';

const TAM_BUFFER = 16 * 1024 * 1024;
const TAM_MAX_TS = 64;
const POT10: number[] = Array.from({ length: 23 }, (_, k) => Number(`1e${k}`));

const PV = 59;       
const ASPAS = 34;    
const VIRGULA = 44;  
const PONTO = 46;    
const MENOS = 45;    
const LETRA_T = 116; 
const NOVA_LINHA = 10;

export class LeitorCsv {
  private grupo = new Grupo();
  private tsAtual = new Uint8Array(TAM_MAX_TS);
  private tsLen = 0;
  private temGrupo = false;
  private cabecalho = true;
  private linhas = 0;
  private pos = 0; 
  private vistos = new Set<string>();

  // aoFecharGrupo é chamado sincronamente; o Grupo é reaproveitado depois.
  constructor(private aoFecharGrupo: (g: Grupo) => void) {}

  ler(caminho: string): { linhas: number; timestamps: number } {
    const fd = openSync(caminho, 'r');
    const buf = Buffer.allocUnsafe(TAM_BUFFER);
    let sobra = 0;

    try {
      for (;;) {
        const lidos = readSync(fd, buf, sobra, buf.length - sobra, null);
        if (lidos === 0) break;

        const total = sobra + lidos;
        const vista = buf.subarray(0, total);
        let ini = 0;
        let nl: number;
        while ((nl = vista.indexOf(NOVA_LINHA, ini)) !== -1) {
          this.processar(buf, ini, nl);
          ini = nl + 1;
        }

        sobra = total - ini;
        if (sobra === buf.length) throw new Error('Linha maior que o buffer.');
        if (sobra > 0) buf.copyWithin(0, ini, total);
      }
      if (sobra > 0) this.processar(buf, 0, sobra); // última linha sem \n
    } finally {
      closeSync(fd);
    }

    if (this.temGrupo) this.aoFecharGrupo(this.grupo);
    return { linhas: this.linhas, timestamps: this.vistos.size };
  }

  private processar(b: Buffer, ini: number, fim: number): void {
    while (fim > ini && b[fim - 1] <= 32) fim--;
    while (ini < fim && b[ini] <= 32) ini++;
    if (ini >= fim) return;
    if (this.cabecalho) {
      this.cabecalho = false;
      return;
    }

    let p = ini;
    let c = 0;

    // idMonitorado
    let id = 0;
    while (p < fim && (c = b[p]) !== PV) { id = id * 10 + (c - 48); p++; }
    p++;

    // faccaoMonitorado (vazio = sem facção)
    let faccao = -1;
    if (b[p] !== PV) {
      faccao = 0;
      while (p < fim && (c = b[p]) !== PV) { faccao = faccao * 10 + (c - 48); p++; }
    }
    p++;

    // timestamp (entre aspas)
    if (b[p] === ASPAS) p++;
    const tsIni = p;
    while (p < fim && (c = b[p]) !== ASPAS && c !== PV) p++;
    const tsFim = p;
    if (b[p] === ASPAS) p++;
    p++;

    // latitude e longitude
    const lat = this.lerDecimal(b, p, fim);
    p = this.pos;
    const lon = this.lerDecimal(b, p, fim);
    p = this.pos;

    // medidaProtetiva
    const protetiva = b[p] === LETRA_T ? 1 : 0;
    while (p < fim && b[p] !== PV) p++;
    p++;

    // idsRestricaoMedida: "1,2,3" (aspas e vazio tratados)
    let lista: number[] | null = null;
    let atual = 0;
    let temDigito = false;
    for (; p <= fim; p++) {
      c = p < fim ? b[p] : VIRGULA;
      if (c >= 48 && c <= 57) {
        atual = atual * 10 + (c - 48);
        temDigito = true;
      } else if (c === VIRGULA) {
        if (temDigito) (lista ??= []).push(atual);
        atual = 0;
        temDigito = false;
      }
    }

    // mudou o timestamp? compara bytes; só cria string quando muda
    const len = tsFim - tsIni;
    let igual = this.temGrupo && len === this.tsLen;
    if (igual) {
      for (let k = len - 1; k >= 0; k--) {
        if (b[tsIni + k] !== this.tsAtual[k]) { igual = false; break; }
      }
    }
    if (!igual) {
      if (len > TAM_MAX_TS) throw new Error('Timestamp com tamanho inesperado.');
      if (this.temGrupo) this.aoFecharGrupo(this.grupo);

      const ts = b.toString('latin1', tsIni, tsFim);
      if (this.vistos.has(ts)) {
        throw new Error(`Arquivo fora de ordem: o timestamp ${ts} reapareceu.`);
      }
      this.vistos.add(ts);
      this.grupo.reiniciar(ts);
      for (let k = 0; k < len; k++) this.tsAtual[k] = b[tsIni + k];
      this.tsLen = len;
      this.temGrupo = true;
    }

    this.grupo.adicionar(id, faccao, lat, lon, protetiva, lista);
    this.linhas++;
  }

  private lerDecimal(b: Buffer, p: number, fim: number): number {
    const ini = p;
    let negativo = false;
    if (b[p] === MENOS) { negativo = true; p++; }

    let mant = 0, casas = 0, digitos = 0;
    let viuPonto = false, ok = true;
    for (; p < fim; p++) {
      const c = b[p];
      if (c === PV) break;
      if (c === PONTO) {
        if (viuPonto) ok = false;
        viuPonto = true;
        continue;
      }
      if (c < 48 || c > 57) { ok = false; continue; }
      mant = mant * 10 + (c - 48);
      digitos++;
      if (viuPonto) casas++;
    }
    this.pos = p + 1;

    if (!ok || digitos > 15 || casas > 22) return Number(b.toString('latin1', ini, p));
    const v = mant / POT10[casas];
    return negativo ? -v : v;
  }
}