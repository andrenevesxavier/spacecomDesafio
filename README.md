# Detecção de Encontros (tornozeleiras e medidas protetivas)
 
Solução em **TypeScript (Node.js)** que lê os datasets de geolocalização e detecta encontros físicos entre monitorados, entre monitorados da mesma facção e entre agressor e vítima.
 
## Como executar
 
Requisitos:
 
- Node.js 20 ou superior.
- **Os datasets de entrada (`.txt`).** Eles não acompanham este repositório por causa do tamanho (o dataset 7 tem 12 milhões de linhas), então é preciso baixá-los pelos links do desafio e colocá-los em uma pasta à escolha, por exemplo `data/`. Sem eles não há o que processar: o programa recebe o caminho do arquivo como argumento. Os JSONs gerados por esta solução estão em `output/`.
```bash
npm install
npx tsc
```
 
### Comando principal (solução e medição de tempo)
 
Este é o comando que executa a solução. Ele usa a **grade espacial** e é o que deve ser cronometrado e avaliado:
 
```bash
node dist/index.js <dataset.txt> <saida.json>
```
 
Exemplo:
 
```bash
node dist/index.js data/dataset3.txt output/saida3.json
```
 
Ele imprime linhas lidas, timestamps, **tempo total (leitura + detecção)** e a quantidade de encontros. O tempo medido não inclui a gravação do arquivo JSON. Todos os tempos da seção [Desempenho](#desempenho) vêm deste comando.
 
### Comandos auxiliares (apenas validação)
 
Não fazem parte da solução. Servem para provar que a grade não altera o resultado:
 
```bash
# mesmo comando com a força bruta (referência de corretude, bem mais lenta)
node dist/index.js <dataset.txt> <saida.json> bruta
 
# compara dois JSONs (usado para comparar o resultado da grade com a força bruta)
node dist/comparar.js <gerado.json> <referencia.json>
```
 
## Estrutura
 
| Arquivo | Responsabilidade |
|---|---|
| `src/index.ts` | Orquestra: lê, detecta, grava o JSON e mede o tempo |
| `src/csvParser.ts` | `LeitorCsv`: lê o arquivo em blocos de bytes e entrega um timestamp por vez |
| `src/grupo.ts` | `Grupo`: pontos de um timestamp em arrays tipados (reaproveitado) |
| `src/haversine.ts` | Distância de Haversine (raio 6.371.000 m) |
| `src/regras.ts` | Regras de negócio: medida protetiva, classificação do tipo, montagem do resultado |
| `src/detectorGrade.ts` | Detecção por grade espacial (usada por padrão) |
| `src/detectorForcaBruta.ts` | Detecção comparando todos os pares (referência de corretude) |
| `src/comparar.ts` | Ferramenta de validação entre dois JSONs |
 
## Lógica utilizada
 
1. **Leitura em streaming.** O arquivo é lido em blocos de 16 MB e interpretado direto dos bytes, sem `split` nem uma string por linha. O dataset 7 (12 milhões de linhas) passa de 512 milhões de caracteres, o que inviabiliza `readFileSync` com conversão para string.
2. **Agrupamento por timestamp.** O desafio só permite comparar posições com timestamp idêntico, então o arquivo é tratado como uma sequência de grupos, um por timestamp. Cada grupo é processado assim que termina e depois descartado, o que mantém o uso de memória baixo. Isso pressupõe o arquivo agrupado por timestamp, como nos datasets fornecidos. Se um timestamp reaparecer depois de outro, o programa interrompe com erro claro em vez de gerar resultado incorreto.
3. **Grade espacial.** Dentro de um grupo, os pontos são distribuídos em células. O tamanho da célula é calculado a partir do limite de 20 m: em latitude, 20 m correspondem a `20 / 6.371.000` radianos; em longitude, o limite depende de `cos(latitude)`, e usa-se a pior latitude do grupo. Há 1% de folga contra arredondamento. Um ponto só é comparado com os pontos da própria célula e das células vizinhas. Cada par de células vizinhas é visitado uma única vez.
4. **Tabela hash própria.** As células ficam em uma tabela hash de endereçamento aberto sobre arrays tipados, reaproveitada entre os timestamps (um contador de geração evita limpá-la). Isso substituiu um `Map` do JavaScript e reduziu cerca de 4x o tempo da detecção.
5. **Haversine só nos candidatos.** A grade apenas escolhe quais pares vale testar. Quem decide se é encontro é o Haversine com `distância < 20 m` (estritamente menor). Como a célula é sempre maior que o limite, a grade não perde pares; no pior caso traz um candidato a mais, que o Haversine descarta.
6. **Classificação e unicidade.** Cada par vira no máximo um encontro por timestamp, com IDs ordenados. Quando o par se encaixa em mais de um tipo, vale o mais específico: **protetiva > faccao > generico** (confirmado pelos gabaritos dos datasets de teste, que não repetem o par).
7. **Saída.** Os encontros saem na mesma ordem da força bruta (por posição no arquivo), no formato pedido.
## Decisões de regra de negócio
 
- **Vítima só forma encontro com o agressor vinculado a ela** (`idsRestricaoMedida`). Uma vítima perto de qualquer outro monitorado, inclusive outra vítima, não gera encontro. Os datasets de teste só têm vítimas perto do próprio agressor, então esta regra foi uma interpretação do enunciado, que define encontro genérico entre "monitorados" e vítimas como pessoas com rastreador portátil.
- **Facção vazia não conta como facção igual.** Só monitorados com facção preenchida e idêntica geram encontro de facção.
- **Distância exatamente igual a 20 m não é encontro** (o enunciado pede menor que 20).
## Por que esta abordagem
 
- **Corretude verificável.** A força bruta é a implementação mais simples possível das regras e serve de referência. A grade foi comparada com ela em todos os 7 datasets (resultado idêntico, incluindo posições e distâncias bit a bit), e os datasets 1 e 2 também foram comparados com os gabaritos oficiais.
- **Eficiência onde importa.** A força bruta cresce com o quadrado do número de pontos por timestamp. A grade troca isso por um custo quase linear, e como os encontros são raros, a grande maioria dos pares nem chega ao Haversine.
- **Memória constante.** O processamento por timestamp e os arrays tipados reaproveitados evitam criar milhões de objetos (um por linha) e a pressão sobre o coletor de lixo.
- **Organização.** O comportamento está separado em classes e módulos com uma responsabilidade cada, enquanto os dados do laço crítico ficam em estruturas compactas, que é onde estava o custo.
## Desempenho
 
Tempo total (leitura + detecção) em execução única, Node 24, Windows. A coluna **Grade espacial** é o tempo do comando principal (`node dist/index.js <dataset.txt> <saida.json>`), ou seja, o da solução entregue. A coluna da força bruta é só referência: usa o mesmo parser, então isola o efeito da grade.
 
| Dataset | Linhas | Força bruta | Grade espacial | Encontros |
|---|---|---|---|---|
| 1 | 5 mil | 8 ms | 8 ms | 4 |
| 2 | 25 mil | 22 ms | 14 ms | 6 |
| 3 | 100 mil | 90 ms | 36 ms | 10 |
| 4 | 400 mil | 458 ms | 114 ms | 15 |
| 5 | 1 milhão | 1.473 ms | 228 ms | 21 |
| 6 | 8 milhões | 13.960 ms | 1.738 ms | 27 |
| 7 | 12 milhões | 24.743 ms | 2.566 ms | 35 |
 
Referência do caminho até aqui, no dataset 7: 32,3 s na primeira versão (força bruta com parser simples), 12,3 s com a primeira grade (`Map`) e 2,6 s na versão final.
 
Onde o tempo do dataset 7 é gasto na versão final: leitura bruta do disco ~120 ms, parsing ~1.550 ms, detecção ~870 ms.
 
## Validação
 
- Datasets 1 e 2: resultado idêntico ao gabarito (tipo, posições e distância).
- Datasets 3 a 7: resultado da grade idêntico ao da força bruta. O parser otimizado também foi comparado com a saída da versão anterior do parser (idêntica).
- A ferramenta `comparar` acusa pares faltando, sobrando, duplicados, tipo errado e qualquer diferença em posição ou distância.
## Limitações conhecidas
 
- O arquivo precisa estar agrupado por timestamp (como nos datasets fornecidos); caso contrário o programa interrompe com erro.
- A grade não trata o encontro entre pontos em lados opostos do meridiano ±180°. Não afeta os dados do desafio.
- Cada linha deve caber no buffer de leitura (16 MB) e o timestamp deve ter no máximo 64 caracteres.
- Se o formato dos números divergir do esperado (mais de 15 dígitos, notação científica), o parser recorre à conversão padrão do JavaScript, mais lenta porém correta.
 
