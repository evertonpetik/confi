import { parseGtaText } from "./gtaPdfParser.web.ts";

const sample = `
PROCEDENCIA
CPF/CNPJ (07352069100)
Nome (OLIVEIRA NANTES COELHO)
Estabelecimento (Nome da fazenda, FAZENDA SANTA MARIA)
Inscrição estadual (285093797)
Municipio (RIO VERDE DE MATO GROSSO)
UF(MS)
DESTINO
CPF/CNPJ (80398987149)
Nome (RENATO FELIPE PINHEIRO MARTINS)
Estabelecimento (Nome da fazenda, FAZENDA RINCÃO - GLEBA A / B)
Inscrição estadual (288599276)
Municipio (RIO VERDE DE MATO GROSSO)
UF(MS)
Animais (BOVINO FÊMEA 0 A 12 MESES), QUANTIDADE (10)
Data (24/07/2026 15:16:47)
Validade (31/07/2026)
`;

// Mimetiza a ordem real de extração de um e-GTA verdadeiro: o bloco de Destino aparece
// no texto ANTES do de Procedência, o nome da fazenda vem colado ao código MAPA sem rótulo,
// e o resumo Fêmea/Macho/Total é uma linha de cabeçalhos seguida de outra linha de valores.
const flattenedSample = `ANIMAIS QUANTIDADE BOVINO FÊMEA 0 A 12 MESES 10 BRUCELOSE 10/05/2026 FINALIDADE: ENGORDA MEIO DE TRANSPORTE: RODOVIÁRIO DESTINO CPF/CNPJ: 80398987149 PLANALTO Nome: RENATO FELIPE PINHEIRO MARTINS Estabelecimento: FAZENDA RINCÃO - GLEBA A / B 500001918750001 Insc. Estadual: 288599276 Municipio: 5007406 - RIO VERDE DE MATO GROSSO UF: MS (e-GTA UF MS 390452 W CPF/CNPJ: 07352069100 PANTANAL Nome: OLIVEIRA NANTES COELHO Estabelecimento: FAZENDA SANTA MARIA 500000076150001 Insc.Estadual: 285093797 Municipio: 5007406 - RIO VERDE DE MATO GROSSO UF: MS Evento: 14983 - LEILÃO Data: 24/07/2026 15:16:47 Validade: 31/07/2026 Fêmea Macho Total 10 0 10`;

const parsed = parseGtaText(sample);
const flattenedParsed = parseGtaText(flattenedSample);

console.log(JSON.stringify({
  procCpfCnpj: parsed.procCpfCnpj,
  procNome: parsed.procNome,
  procFazenda: parsed.procFazenda,
  procInscricaoEstadual: parsed.procInscricaoEstadual,
  procMunicipio: parsed.procMunicipio,
  procUf: parsed.procUf,
  destCpfCnpj: parsed.destCpfCnpj,
  destNome: parsed.destNome,
  destFazenda: parsed.destFazenda,
  destInscricaoEstadual: parsed.destInscricaoEstadual,
  destMunicipio: parsed.destMunicipio,
  destUf: parsed.destUf,
  animais: parsed.animais,
  totalFemeas: parsed.totalFemeas,
  total: parsed.total,
  dataEmissao: parsed.dataEmissao,
  dataValidade: parsed.dataValidade,
}, null, 2));

if (parsed.procCpfCnpj !== "07352069100") throw new Error(`procCpfCnpj esperado 07352069100, recebido ${parsed.procCpfCnpj}`);
if (parsed.procNome !== "OLIVEIRA NANTES COELHO") throw new Error(`procNome inválido: ${parsed.procNome}`);
if (parsed.procFazenda !== "FAZENDA SANTA MARIA") throw new Error(`procFazenda inválida: ${parsed.procFazenda}`);
if (parsed.procMunicipio !== "RIO VERDE DE MATO GROSSO") throw new Error(`procMunicipio inválido: ${parsed.procMunicipio}`);
if (parsed.procUf !== "MS") throw new Error(`procUf inválido: ${parsed.procUf}`);
if (parsed.destCpfCnpj !== "80398987149") throw new Error(`destCpfCnpj inválido: ${parsed.destCpfCnpj}`);
if (parsed.destNome !== "RENATO FELIPE PINHEIRO MARTINS") throw new Error(`destNome inválido: ${parsed.destNome}`);
if (parsed.destFazenda !== "FAZENDA RINCÃO - GLEBA A / B") throw new Error(`destFazenda inválida: ${parsed.destFazenda}`);
if (parsed.destMunicipio !== "RIO VERDE DE MATO GROSSO") throw new Error(`destMunicipio inválido: ${parsed.destMunicipio}`);
if (parsed.animais[0]?.quantidade !== 10) throw new Error(`quantidade inválida: ${parsed.animais[0]?.quantidade}`);
if (parsed.animais[0]?.sexo !== "F") throw new Error(`sexo inválido: ${parsed.animais[0]?.sexo}`);
if (parsed.totalFemeas !== 10) throw new Error(`totalFemeas inválido: ${parsed.totalFemeas}`);
if (parsed.total !== 10) throw new Error(`total inválido: ${parsed.total}`);
if (parsed.dataEmissao !== "2026-07-24") throw new Error(`dataEmissao inválida: ${parsed.dataEmissao}`);
if (parsed.dataValidade !== "2026-07-31") throw new Error(`dataValidade inválida: ${parsed.dataValidade}`);

if (flattenedParsed.procCpfCnpj !== "07352069100") throw new Error(`flattened procCpfCnpj inválido: ${flattenedParsed.procCpfCnpj}`);
if (flattenedParsed.procNome !== "OLIVEIRA NANTES COELHO") throw new Error(`flattened procNome inválido: ${flattenedParsed.procNome}`);
if (flattenedParsed.procFazenda !== "FAZENDA SANTA MARIA") throw new Error(`flattened procFazenda inválida: ${flattenedParsed.procFazenda}`);
if (flattenedParsed.destCpfCnpj !== "80398987149") throw new Error(`flattened destCpfCnpj inválido: ${flattenedParsed.destCpfCnpj}`);
if (flattenedParsed.destNome !== "RENATO FELIPE PINHEIRO MARTINS") throw new Error(`flattened destNome inválido: ${flattenedParsed.destNome}`);
if (flattenedParsed.destFazenda !== "FAZENDA RINCÃO - GLEBA A / B") throw new Error(`flattened destFazenda inválida: ${flattenedParsed.destFazenda}`);
if (flattenedParsed.animais[0]?.quantidade !== 10) throw new Error(`flattened quantidade inválida: ${flattenedParsed.animais[0]?.quantidade}`);
if (flattenedParsed.totalFemeas !== 10) throw new Error(`flattened totalFemeas inválido: ${flattenedParsed.totalFemeas}`);
if (flattenedParsed.total !== 10) throw new Error(`flattened total inválido: ${flattenedParsed.total}`);
if (flattenedParsed.dataValidade !== "2026-07-31") throw new Error(`flattened dataValidade inválida: ${flattenedParsed.dataValidade}`);

// Texto REAL extraído pelo app a partir do PDF anexado pelo usuário (colado literalmente do log
// do console). Neste PDF real, vários rótulos (Número, Série, Fêmea, Código MAPA, e a descrição
// do animal "BOVINO FÊMEA...") não são extraídos — fazem parte do template/imagem, não do texto.
const realSample = `ANIMAIS QUANTIDADE 10 BRUCELOSE 10/05/2026 FINALIDADE: ENGORDA MEIO DE TRANSPORTE: DESTINO CPF/CNPJ: 80398987149 PLANALTO Nome: RENATO FELIPE PINHEIRO MARTINS Estabelecimento: 500001918750001 Insc. Estadual: 288599276 Municipio: 5007406 - RIO VERDE DE MATO GROSSO UF: MS \\( e-GTA \\) UF MS 390452 W CPF/CNPJ: 07352069100 PANTANAL Nome: OLIVEIRA NANTES COELHO Estabelecimento: FAZENDA SANTA MARIA 500000076150001 Insc.Estadual: 285093797 Municipio: 5007406 - RIO VERDE DE MATO GROSSO UF: MS Evento: LTDA Local Evento: _________________________________________ OLIVEIRA NANTES COELHO 07352069100 Macho 0 Total 10 10 Total por Extenso DEZ ANIMAIS ROTA REBANHO A FOGO. MARCA DO REBANHO Data: 24/07/2026 15:16:47 Validade: 31/07/2026 Unidade Expedidora: Fone: 67 - 3292-1131 E-mail: iagrorioverde@iagro.ms.gov.br FLAVIELTON PINHEIRO DE OLIVEIRA Cargo: Portaria: 070000028509379790001498370000000390452238 50233904529240720260100000104074062307074067 Para conferir autenticidade consulte: www.servicos.iagro.ms.gov.br`;
const realParsed = parseGtaText(realSample);
console.log(JSON.stringify(realParsed, null, 2));

if (realParsed.numero !== "390452") throw new Error(`real numero inválido: ${realParsed.numero}`);
if (realParsed.serie !== "W") throw new Error(`real serie inválida: ${realParsed.serie}`);
if (realParsed.uf !== "MS") throw new Error(`real uf inválida: ${realParsed.uf}`);
if (realParsed.procCpfCnpj !== "07352069100") throw new Error(`real procCpfCnpj inválido: ${realParsed.procCpfCnpj}`);
if (realParsed.procNome !== "OLIVEIRA NANTES COELHO") throw new Error(`real procNome inválido: ${realParsed.procNome}`);
if (realParsed.procFazenda !== "FAZENDA SANTA MARIA") throw new Error(`real procFazenda inválida: ${realParsed.procFazenda}`);
if (realParsed.destCpfCnpj !== "80398987149") throw new Error(`real destCpfCnpj inválido: ${realParsed.destCpfCnpj}`);
if (realParsed.destNome !== "RENATO FELIPE PINHEIRO MARTINS") throw new Error(`real destNome inválido: ${realParsed.destNome}`);
if (realParsed.animais[0]?.quantidade !== 10) throw new Error(`real quantidade inválida: ${realParsed.animais[0]?.quantidade}`);
if (realParsed.animais[0]?.sexo !== "F") throw new Error(`real sexo inválido: ${realParsed.animais[0]?.sexo}`);
if (realParsed.totalFemeas !== 10) throw new Error(`real totalFemeas inválido: ${realParsed.totalFemeas}`);
if (realParsed.totalMachos !== 0) throw new Error(`real totalMachos inválido: ${realParsed.totalMachos}`);
if (realParsed.total !== 10) throw new Error(`real total inválido: ${realParsed.total}`);
if (realParsed.dataEmissao !== "2026-07-24") throw new Error(`real dataEmissao inválida: ${realParsed.dataEmissao}`);
if (realParsed.dataValidade !== "2026-07-31") throw new Error(`real dataValidade inválida: ${realParsed.dataValidade}`);

console.log("GTA parser regression OK");
