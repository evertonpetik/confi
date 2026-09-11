/**
 * Extração dos campos de uma e-GTA a partir do texto do PDF.
 *
 * Só regex sobre string: roda no navegador, no React Native e no Node. A
 * extração do texto do PDF é que é específica de plataforma e fica em
 * ./gtaPdfParser.web (browser) ou na Cloud Function (nativo).
 */
import { GTA, GtaAnimal } from "./weighing.types";

// ─── Helpers de parsing ───────────────────────────────────────────────────────

function campo(text: string, re: RegExp): string {
  const m = re.exec(text);
  return m ? m[1].replace(/\s+/g, " ").trim() : "";
}

function parseDataBr(s: string): string {
  const m = /(\d{2})\/(\d{2})\/(\d{4})(?:\s+\d{2}:\d{2}:\d{2})?/.exec(s);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : "";
}

function limparTextoBruto(text: string): string {
  return text
    .replace(/\r/g, "\n")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{2,}/g, "\n")
    .trim();
}

function limparValorCampo(value: string): string {
  return value
    .replace(/\s+/g, " ")
    .replace(/[\s\)]*$/g, "")
    .replace(/^[\s(]+/g, "")
    .replace(/[),.;]+$/g, "")
    .trim();
}

function limparNome(value: string): string {
  return limparValorCampo(
    value
      .replace(/^(?:DESTINO|PROCEDENCIA)\s+/i, "")
      .replace(/^Nome\s*[:()]?\s*/i, "")
      .replace(/\s+(?:Estabelecimento|Insc\.?|Municipio|UF|CPF\/CNPJ|CNPJ|CPF).*$/i, "")
  );
}

function extrairValor(text: string, padroes: RegExp[]): string {
  for (const re of padroes) {
    const m = re.exec(text);
    if (m && m[1]) {
      return limparValorCampo(m[1]);
    }
  }
  return "";
}

// Localiza os blocos de Procedência/Destino pela posição de cada "CPF/CNPJ" encontrado,
// pois o content stream do PDF pode desenhar os dois blocos fora da ordem visual/leitura.
function localizarBlocos(textFlat: string): { proc: string; dest: string } {
  const cpfRe = /CPF\/CNPJ\s*(?:\(|:)?\s*[\d.\-\/]{11,18}/gi;
  const posicoes: number[] = [];
  let cm: RegExpExecArray | null;
  while ((cm = cpfRe.exec(textFlat)) !== null) posicoes.push(cm.index);

  if (posicoes.length === 0) return { proc: textFlat, dest: "" };
  if (posicoes.length === 1) return { proc: textFlat.slice(posicoes[0]), dest: "" };

  const destLabelIdx = textFlat.search(/\bDESTINO\b/i);
  const procLabelIdx = textFlat.search(/\bPROCED[EÊ]NCIA\b/i);

  let destIdx: number, procIdx: number;
  if (destLabelIdx !== -1) {
    destIdx = posicoes.find((i) => i >= destLabelIdx) ?? posicoes[posicoes.length - 1];
    procIdx = posicoes.find((i) => i !== destIdx) ?? posicoes[0];
  } else if (procLabelIdx !== -1) {
    procIdx = posicoes.find((i) => i >= procLabelIdx) ?? posicoes[0];
    destIdx = posicoes.find((i) => i !== procIdx) ?? posicoes[posicoes.length - 1];
  } else {
    [procIdx, destIdx] = posicoes; // fallback: ordem de leitura (Procedência antes de Destino)
  }

  const ordenadas = [...posicoes].sort((a, b) => a - b);
  const proximoApos = (idx: number) => {
    const pos = ordenadas.indexOf(idx);
    return pos >= 0 && pos + 1 < ordenadas.length ? ordenadas[pos + 1] : textFlat.length;
  };

  return {
    proc: textFlat.slice(procIdx, proximoApos(procIdx)),
    dest: textFlat.slice(destIdx, proximoApos(destIdx)),
  };
}

// ─── Parser dos campos da e-GTA IAGRO ────────────────────────────────────────

export function parseGtaText(text: string): Partial<GTA> {
  const textClean = limparTextoBruto(text);
  const textFlat = textClean.replace(/\s*\n\s*/g, " ");
  const uf = campo(textClean, /\bUF\b[\s\n]+([A-Z]{2})\b/i) || campo(textFlat, /UF\s*(?:\(|:)?\s*([A-Z]{2})/i);
  // No PDF real os rótulos "Número"/"Série" não aparecem como texto (fazem parte do template/imagem);
  // apenas os valores são desenhados logo após "e-GTA", na ordem UF, Número, Série.
  const eGtaM = /e-GTA[^A-Za-z0-9]{0,4}UF\s+([A-Z]{2})\s+(\d{4,8})\s+([A-Z])\b/i.exec(textFlat);
  const numero = campo(textClean, /N.mero\b[\s\n]+(\d{5,8})/i) || campo(textFlat, /N.mero\s*(?:\(|:)?\s*(\d{5,8})/i) || eGtaM?.[2] || "";
  const serie = campo(textClean, /S.rie\b[\s\n]+([A-Z])/i) || campo(textFlat, /S.rie\s*(?:\(|:)?\s*([A-Z])/i) || eGtaM?.[3] || "";

  const { proc: blocProcFlat, dest: blocDestFlat } = localizarBlocos(textFlat);

  const procCpfCnpj = extrairValor(blocProcFlat, [
    /CPF\/CNPJ\s*(?:\(|:)?\s*([\d.\-\/]{11,18})/i,
    /CPF\/CNPJ\s*([\d.\-\/]{11,18})/i,
  ]);
  const procRegiao = extrairValor(blocProcFlat, [/Regi.o\s*(?:\(|:)?\s*([^\n\r,]+)/i, /Regi.o\s*([^\n\r,]+)/i]);
  const procNome = limparNome(extrairValor(blocProcFlat, [
    /Nome\s*(?:\(|:)?\s*([A-ZÀ-Ö][A-ZÀ-Ö0-9\s\.\-&'/]{2,80}?)\s*(?:\)|(?=\s*(?:Estabelecimento|CPF\/CNPJ|Insc|Municipio|UF|$)))/i,
    /Nome\s*(?:\(|:)?\s*([A-ZÀ-Ö][A-ZÀ-Ö0-9\s\.\-&'/]{2,80}?)(?=\s*Estabelecimento\s*(?:\(|:)?\s*)/i,
    /([A-ZÀ-Ö][A-ZÀ-Ö0-9\s\.\-&'/]{2,80}?)(?=\s*\)\s*Estabelecimento\s*(?:\(|:)?\s*)/i,
  ]));
  const procFazenda = extrairValor(blocProcFlat, [
    /Estabelecimento\s*(?:\(|:)?\s*(?:Nome da fazenda,\s*)?([A-ZÀ-Ö][A-ZÀ-Ö0-9\s\.\-&'/]{1,119}?)(?=\s*(?:\d{5,}|C.digo|Insc|Inscrição|Municipio|UF|CPF\/CNPJ|$))/i,
    /Estabelecimento\s*(?:\(|:)?\s*(?:Nome da fazenda,\s*)?([A-ZÀ-Ö][A-ZÀ-Ö0-9\s\.\-&'/]{2,120})/i,
  ]);
  const procCodigoMapa = extrairValor(blocProcFlat, [
    /C.digo\s+MAPA\s*(?:\(|:)?\s*(\d+)/i,
    /C\.digo\s+MAPA\s*(\d+)/i,
    /(\d{10,20})(?=\s*Insc)/i, // rótulo "Código MAPA" pode estar ausente no texto extraído; usa o dígito antes de Insc
  ]);
  const procInsc = extrairValor(blocProcFlat, [
    /Insc(?:ri[çc]ã|ri[cç])?o\s*Estadual\s*(?:\(|:)?\s*([\d.\-\/]+)/i,
    /Insc\.?\s*Estadual\s*(?:\(|:)?\s*([\d.\-\/]+)/i,
  ]);
  const procMunicipio = extrairValor(blocProcFlat, [
    /(?:Municipio|Município)\s*(?:\(|:)?\s*(?:\d+\s*-\s*)?([A-ZÀ-Ö][A-ZÀ-Ö0-9\s\.\-&'()]{2,80}?)(?=\s*(?:UF|$))/i,
    /Municipio\s*:\s*([A-ZÀ-Ö][A-ZÀ-Ö0-9\s\.\-&'()]{2,80}?)(?=\s*(?:UF|$))/i,
  ]);
  const procUf = extrairValor(blocProcFlat, [/Municipio:.*?UF\s*(?:\(|:)?\s*([A-Z]{2})/i, /UF\s*(?:\(|:)?\s*([A-Z]{2})/i, /\b([A-Z]{2})\b(?=\s*(?:\)|$))/i]) || uf;

  const destCpfCnpj = extrairValor(blocDestFlat, [
    /CPF\/CNPJ\s*(?:\(|:)?\s*([\d.\-\/]{11,18})/i,
    /CPF\/CNPJ\s*([\d.\-\/]{11,18})/i,
  ]);
  const destRegiao = extrairValor(blocDestFlat, [/Regi.o\s*(?:\(|:)?\s*([^\n\r,]+)/i, /Regi.o\s*([^\n\r,]+)/i]);
  const destNome = limparNome(extrairValor(blocDestFlat, [
    /Nome\s*(?:\(|:)?\s*([A-ZÀ-Ö][A-ZÀ-Ö0-9\s\.\-&'/]{2,80}?)\s*(?:\)|(?=\s*(?:Estabelecimento|CPF\/CNPJ|Insc|Municipio|UF|$)))/i,
    /Nome\s*(?:\(|:)?\s*([A-ZÀ-Ö][A-ZÀ-Ö0-9\s\.\-&'/]{2,80}?)(?=\s*Estabelecimento\s*(?:\(|:)?\s*)/i,
    /([A-ZÀ-Ö][A-ZÀ-Ö0-9\s\.\-&'/]{2,80}?)(?=\s*\)\s*Estabelecimento\s*(?:\(|:)?\s*)/i,
  ]) || extrairValor(blocDestFlat, [/^([A-ZÀ-Ö][A-ZÀ-Ö0-9\s\.\-&'/]{2,80}?)(?=\s*Estabelecimento\s*(?:\(|:)?\s*)/i]));
  const destFazenda = extrairValor(blocDestFlat, [
    /Estabelecimento\s*(?:\(|:)?\s*(?:Nome da fazenda,\s*)?([A-ZÀ-Ö][A-ZÀ-Ö0-9\s\.\-&'/]{1,119}?)(?=\s*(?:\d{5,}|C.digo|Insc|Inscrição|Municipio|UF|CPF\/CNPJ|$))/i,
    /Estabelecimento\s*(?:\(|:)?\s*(?:Nome da fazenda,\s*)?([A-ZÀ-Ö][A-ZÀ-Ö0-9\s\.\-&'/]{2,120})/i,
  ]);
  const destCodigoMapa = extrairValor(blocDestFlat, [
    /C.digo\s+MAPA\s*(?:\(|:)?\s*(\d+)/i,
    /C\.digo\s+MAPA\s*(\d+)/i,
    /(\d{10,20})(?=\s*Insc)/i,
  ]);
  const destInsc = extrairValor(blocDestFlat, [
    /Insc(?:ri[çc]ã|ri[cç])?o\s*Estadual\s*(?:\(|:)?\s*([\d.\-\/]+)/i,
    /Insc\.?\s*Estadual\s*(?:\(|:)?\s*([\d.\-\/]+)/i,
  ]);
  const destMunicipio = extrairValor(blocDestFlat, [
    /(?:Municipio|Município)\s*(?:\(|:)?\s*(?:\d+\s*-\s*)?([A-ZÀ-Ö][A-ZÀ-Ö0-9\s\.\-&'()]{2,80}?)(?=\s*(?:UF|$))/i,
    /Municipio\s*:\s*([A-ZÀ-Ö][A-ZÀ-Ö0-9\s\.\-&'()]{2,80}?)(?=\s*(?:UF|$))/i,
  ]);
  const destUf = extrairValor(blocDestFlat, [/Municipio:.*?UF\s*(?:\(|:)?\s*([A-Z]{2})/i, /UF\s*(?:\(|:)?\s*([A-Z]{2})/i, /\b([A-Z]{2})\b(?=\s*(?:\)|$))/i]) || uf;

  // Lookahead nos próximos rótulos conhecidos: sem isso, campos "livres" (sem delimitador de
  // linha real, já que o stream de um PDF real não tem \n entre campos) vazam até o fim do texto.
  const finalidade = campo(textClean, /FINALIDADE\s*(?:\(|:)?\s*([^\n\r]*?)(?=\s*(?:DESTINO|PROCED[EÊ]NCIA|ANIMAIS|VACINA|MEIO DE TRANSPORTE|FINALIDADE|Evento|Local Evento|$))/i) || campo(textFlat, /FINALIDADE\s*(?:\(|:)?\s*([^\n\r]*?)(?=\s*(?:DESTINO|PROCED[EÊ]NCIA|ANIMAIS|VACINA|MEIO DE TRANSPORTE|FINALIDADE|Evento|Local Evento|$))/i);
  const transporte = campo(textClean, /MEIO DE TRANSPORTE\s*(?:\(|:)?\s*([^\n\r]*?)(?=\s*(?:DESTINO|PROCED[EÊ]NCIA|ANIMAIS|VACINA|MEIO DE TRANSPORTE|FINALIDADE|Evento|Local Evento|$))/i) || campo(textFlat, /MEIO DE TRANSPORTE\s*(?:\(|:)?\s*([^\n\r]*?)(?=\s*(?:DESTINO|PROCED[EÊ]NCIA|ANIMAIS|VACINA|MEIO DE TRANSPORTE|FINALIDADE|Evento|Local Evento|$))/i);
  const rota = campo(textClean, /ROTA\s+([^\n\r]*?)(?=\s*(?:OBSERVA[ÇC][ÕO]ES|CONDI[ÇC][ÃA]O|MARCA DO REBANHO|Data|Validade|Unidade Expedidora|$))/i) || campo(textFlat, /ROTA\s+([^\n\r]*?)(?=\s*(?:OBSERVA[ÇC][ÕO]ES|CONDI[ÇC][ÃA]O|MARCA DO REBANHO|Data|Validade|Unidade Expedidora|$))/i);
  const dataEmissao = parseDataBr(campo(textClean, /(?:Data|Emiss.o)\s*(?:\(|:)?\s*(\d{2}\/\d{2}\/\d{4}(?:\s+\d{2}:\d{2}:\d{2})?)/i) || campo(textFlat, /(?:Data|Emiss.o)\s*(?:\(|:)?\s*(\d{2}\/\d{2}\/\d{4}(?:\s+\d{2}:\d{2}:\d{2})?)/i));
  const dataValidade = parseDataBr(campo(textClean, /Validade\s*(?:\(|:)?\s*(\d{2}\/\d{2}\/\d{4})/i) || campo(textFlat, /Validade\s*(?:\(|:)?\s*(\d{2}\/\d{2}\/\d{4})/i));
  const unidadeExpedidora = campo(textClean, /Unidade Expedidora\s*(?:\(|:)?\s*([^\n\r]*?)(?=\s*(?:Fone|E-mail|IDENTIFICA[ÇC][ÃA]O|Cargo|Portaria|$))/i) || campo(textFlat, /Unidade Expedidora\s*(?:\(|:)?\s*([^\n\r]*?)(?=\s*(?:Fone|E-mail|IDENTIFICA[ÇC][ÃA]O|Cargo|Portaria|$))/i);

  const animais: GtaAnimal[] = [];

  // Uma GTA pode declarar vários grupos de animais (ex: 13 de "13 A 24 MESES" +
  // 7 de "25 A 36 MESES"), então a varredura precisa ser global e vir primeiro:
  // pegar só o primeiro grupo subdimensiona o lote e a conferência com a
  // certificadora não fecha.
  const animalReGlobal = /\b(BOVINO\s+(?:MACHO|F\.MEA|FÊMEA|FEMEA|MISTO)\s+(?:\d+\s+A\s+\d+|\d+|ACIMA DE\s+\d+)\s+MES(?:ES)?)\s*(\d{1,6})(?=\s*(?:Data|Validade|[A-ZÀ-Ö]|$))/gi;
  let am: RegExpExecArray | null;
  while ((am = animalReGlobal.exec(textFlat)) !== null) {
    const desc = am[1].replace(/\s+/g, " ").trim();
    const qtd = parseInt(am[2], 10);
    if (qtd <= 0 || qtd > 99999) continue;
    if (animais.some((a) => a.descricao === desc && a.quantidade === qtd)) continue;
    const sexo: "M" | "F" | "ambos" = /f\.mea|fêmea|femea/i.test(desc) ? "F" : /macho/i.test(desc) ? "M" : "ambos";
    const idadeM = /((?:\d+\s+A\s+\d+|\d+|ACIMA DE \d+)\s+MESES)/i.exec(desc);
    animais.push({ descricao: desc, quantidade: qtd, sexo, idadeCategoria: idadeM?.[1] || desc });
  }

  // Grupos nomeados evitam bugs de índice ao combinar alternativas num único regex.
  // 3ª alternativa cobre PDFs reais em que só o rótulo "ANIMAIS QUANTIDADE" e o número
  // sobrevivem à extração (a descrição do animal, ex. "BOVINO FÊMEA...", não é extraída).
  const animalMatchRe =
    /(?:Animais\s*(?:\(\s*(?<descParen>[^)]+?)\s*\))?\s*,?\s*QUANTIDADE\s*(?:\(\s*(?<qtdParen>\d+)\s*\)|:\s*(?<qtdColon>\d+)))|(?:(?<descBovino>BOVINO\s+(?:MACHO|FÊMEA|F\.MEA|FEMEA|MISTO)\s+(?:\d+\s+A\s+\d+|\d+|ACIMA DE\s+\d+)\s+MES(?:ES)?)\s*(?<qtdBovino>\d{1,6})(?=\s*(?:Data|Validade|[A-ZÀ-Ö]|$)))|(?:\bANIMAIS\s+QUANTIDADE\s+(?<qtdBare>\d{1,6})(?=\s*(?:BOVINO|BRUCELOSE|VACINA|Data|Validade|[A-ZÀ-Ö]|$)))/i;
  // Só consultado quando a varredura global não achou nenhum grupo descrito.
  const am1 = animais.length === 0 ? animalMatchRe.exec(textFlat) : null;
  let semDescricao = false;
  if (am1?.groups) {
    const g = am1.groups;
    const descricao = (g.descParen || g.descBovino || "BOVINO").replace(/\s+/g, " ").trim();
    const quantidade = parseInt(g.qtdParen || g.qtdColon || g.qtdBovino || g.qtdBare || "0", 10);
    semDescricao = !g.descParen && !g.descBovino;
    const sexo: "M" | "F" | "ambos" = /f\.mea|femea|fêmea/i.test(descricao) ? "F" : /macho/i.test(descricao) ? "M" : "ambos";
    const idadeMatch = descricao.match(/(\d+\s+A\s+\d+\s+MESES|\d+\s+MESES|\d+\s+A\s+\d+\s+MES|\d+\s+A\s+\d+\s+M\b)/i);
    if (quantidade > 0) animais.push({ descricao, quantidade, sexo, idadeCategoria: idadeMatch?.[1]?.trim() || descricao });
  }

  let totalMachos = animais.filter((a) => a.sexo === "M" || a.sexo === "ambos").reduce((s, a) => s + a.quantidade, 0);
  let totalFemeas = animais.filter((a) => a.sexo === "F").reduce((s, a) => s + a.quantidade, 0);
  // O quadro de totais no rodapé da guia ("Fêmea 0 | Macho 15 | Total 15").
  //
  // O negative lookahead é o que separa esses rótulos da descrição do animal:
  // sem ele, "BOVINO MACHO 0 A 12 MESES" casa como se o total de machos fosse
  // 0 — e o código então deduzia 15 fêmeas num lote só de machos.
  const NAO_E_FAIXA = /(?!\s*A\s+\d)/.source;
  const mM =
    new RegExp(String.raw`(?:^|[^A-Za-zÀ-Öà-ö])Macho\s+(\d{1,6})` + NAO_E_FAIXA, "i").exec(textFlat);
  const mF =
    new RegExp(String.raw`(?:^|[^A-Za-zÀ-Öà-ö])(?:F\.mea|Fêmea|Femea)\s+(\d{1,6})` + NAO_E_FAIXA, "i").exec(textFlat);
  const mT =
    new RegExp(String.raw`(?:^|[^A-Za-zÀ-Öà-ö])Total\s+(\d{1,6})` + NAO_E_FAIXA, "i").exec(textFlat);

  if (am1?.groups) {
    const g = am1.groups;
    const qty = parseInt(g.qtdParen || g.qtdColon || g.qtdBovino || g.qtdBare || "0", 10);
    if (qty > 0 && /(?:f\.mea|femea|fêmea)/i.test(g.descParen || g.descBovino || "")) totalFemeas = qty;
    if (qty > 0 && /macho/i.test(g.descParen || g.descBovino || "")) totalMachos = qty;
  }
  if (mM) totalMachos = parseInt(mM[1], 10);
  if (mF && parseInt(mF[1], 10) > 0) totalFemeas = parseInt(mF[1], 10);
  if (animais.length && !mF && animais[0]?.sexo === "F") totalFemeas = animais[0].quantidade;
  if (animais.length && !mM && animais[0]?.sexo === "M") totalMachos = animais[0].quantidade;
  const total = mT ? parseInt(mT[1], 10) : totalMachos + totalFemeas;

  // Sem rótulo "Fêmea"/"Macho" no texto extraído, mas com Total conhecido: deriva o que faltar.
  if (mT && !mF && mM) totalFemeas = Math.max(0, total - totalMachos);
  if (mT && !mM && mF) totalMachos = Math.max(0, total - totalFemeas);

  // Animal detectado sem descrição (rótulo "ANIMAIS QUANTIDADE N" isolado): infere sexo pelos totais.
  if (semDescricao && animais.length === 1 && animais[0].sexo === "ambos") {
    if (totalFemeas > 0 && totalMachos === 0) animais[0].sexo = "F";
    else if (totalMachos > 0 && totalFemeas === 0) animais[0].sexo = "M";
  }

  return {
    numero, serie, uf: uf || procUf,
    procCpfCnpj, procNome, procFazenda, procCodigoMapa,
    procInscricaoEstadual: procInsc, procMunicipio, procUf, procRegiao,
    destCpfCnpj, destNome, destFazenda, destCodigoMapa,
    destInscricaoEstadual: destInsc, destMunicipio, destUf, destRegiao,
    finalidade, transporte, animais, totalMachos, totalFemeas, total,
    rota, dataEmissao, dataValidade, unidadeExpedidora, status: "ativa",
  };
}

/**
 * Aponta divergências entre as guias de um mesmo embarque.
 *
 * Guias de origens ou destinos diferentes no mesmo processo quase sempre
 * indicam PDF trocado de pasta, e isso só apareceria na certificadora.
 */
export function conferirLoteDeGtas(gtas: Partial<GTA>[]): string[] {
  const avisos: string[] = [];
  if (gtas.length < 2) return avisos;

  const origens = new Set(gtas.map((g) => g.procCodigoMapa).filter(Boolean));
  if (origens.size > 1) {
    avisos.push(`GTAs com origens diferentes: ${[...origens].join(", ")}`);
  }

  const destinos = new Set(gtas.map((g) => g.destCodigoMapa).filter(Boolean));
  if (destinos.size > 1) {
    avisos.push(`GTAs com destinos diferentes: ${[...destinos].join(", ")}`);
  }

  const numeros = gtas.map((g) => `${g.serie ?? ""}${g.numero ?? ""}`).filter((n) => n);
  const repetidos = numeros.filter((n, i) => numeros.indexOf(n) !== i);
  if (repetidos.length > 0) {
    avisos.push(`GTA repetida no lote: ${[...new Set(repetidos)].join(", ")}`);
  }

  return avisos;
}
