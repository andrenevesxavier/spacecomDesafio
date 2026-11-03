function crescerInt32(a: Int32Array, tam: number): Int32Array {
  const n = new Int32Array(tam);
  n.set(a);
  return n;
}
function crescerFloat64(a: Float64Array, tam: number): Float64Array {
  const n = new Float64Array(tam);
  n.set(a);
  return n;
}

export class Grupo {
  timestamp = '';
  n = 0;
  id: Int32Array = new Int32Array(256);
  faccao: Int32Array = new Int32Array(256); 
  lat: Float64Array = new Float64Array(256);
  lon: Float64Array = new Float64Array(256);
  protetiva: Uint8Array = new Uint8Array(256);
  restricoes: (number[] | null)[] = []; 

  reiniciar(timestamp: string): void {
    this.timestamp = timestamp;
    this.n = 0;
  }

  adicionar(
    id: number, faccao: number, lat: number, lon: number,
    protetiva: number, restricoes: number[] | null
  ): void {
    if (this.n === this.id.length) this.crescer();
    const i = this.n++;
    this.id[i] = id;
    this.faccao[i] = faccao;
    this.lat[i] = lat;
    this.lon[i] = lon;
    this.protetiva[i] = protetiva;
    this.restricoes[i] = restricoes;
  }

  private crescer(): void {
    const tam = this.id.length * 2;
    this.id = crescerInt32(this.id, tam);
    this.faccao = crescerInt32(this.faccao, tam);
    this.lat = crescerFloat64(this.lat, tam);
    this.lon = crescerFloat64(this.lon, tam);
    const p = new Uint8Array(tam);
    p.set(this.protetiva);
    this.protetiva = p;
  }
}