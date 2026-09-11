/**
 * Fechamento de um processo de mangueiro.
 *
 * Junta o que a certificadora precisa receber — planilha de campo e as GTAs
 * originais — e confere antes de deixar fechar: divergência entre o declarado
 * na guia e o efetivamente manejado é o tipo de erro que só volta semanas
 * depois, já como pendência de certificação.
 */
import { conferirEmbarque, ConferenciaEmbarque } from "./embarque";
import { conferirProcesso, faixasDoProcesso } from "./faixasProcesso";
import { gerarCsvPlanilhaCampo, gerarXlsxPlanilhaCampo } from "./planilhaCampo";
import { Bovino, Evento, GTA, ProcessoMangueiro } from "./weighing.types";
import { ArquivoZip, criarZip, textoParaBytes } from "./zip";

export interface ResumoFechamento {
  /** Verdadeiro quando nada impede o envio à certificadora. */
  pronto: boolean;
  previsto: number;
  manejados: number;
  /** Divergências entre GTA e manejo — impedem o fechamento. */
  pendencias: string[];
  /** Pontos de atenção que não impedem, mas precisam de olhada. */
  avisos: string[];
  embarque: ConferenciaEmbarque;
  manejadosPorFaixa: Record<string, number>;
}

/** Contagem por faixa a partir dos eventos de cadastro já gravados. */
export function contarPorFaixa(eventos: Evento[]): Record<string, number> {
  const contagem: Record<string, number> = {};
  for (const ev of eventos) {
    if (ev.tipo === "cadastro" && ev.faixaEtaria) {
      contagem[ev.faixaEtaria] = (contagem[ev.faixaEtaria] ?? 0) + 1;
    }
  }
  return contagem;
}

export function resumirFechamento(
  processo: ProcessoMangueiro,
  gtas: GTA[],
  animais: Bovino[],
  eventos: Evento[]
): ResumoFechamento {
  const faixas = faixasDoProcesso(gtas);
  const manejadosPorFaixa = contarPorFaixa(eventos);
  const conferencia = conferirProcesso(faixas, manejadosPorFaixa);
  const embarque = conferirEmbarque(animais);

  const avisos: string[] = [...embarque.avisos];

  // Animal sem peso não tem como entrar no controle de ganho depois.
  const semPeso = animais.filter((a) => !a.pesoEntrada || a.pesoEntrada <= 0);
  if (semPeso.length > 0) {
    avisos.push(`${semPeso.length} animal(is) sem peso registrado`);
  }

  // O chip é o que liga o animal ao brinco na leitura de campo.
  const semChip = animais.filter((a) => !a.chipRfid);
  if (semChip.length > 0) {
    avisos.push(`${semChip.length} animal(is) sem chip RFID lido`);
  }

  const semLocal = animais.filter((a) => !a.metadados?.localId);
  if (semLocal.length > 0) {
    avisos.push(`${semLocal.length} animal(is) sem destino informado`);
  }

  if (gtas.length === 0) {
    avisos.push("Processo sem GTA vinculada");
  }

  return {
    pronto: conferencia.ok && animais.length > 0,
    previsto: conferencia.previsto || processo.totalAnimaisPrevisto,
    manejados: animais.length,
    pendencias: conferencia.pendencias,
    avisos,
    embarque,
    manejadosPorFaixa,
  };
}

// ─── Pacote da certificadora ─────────────────────────────────────────────────

export interface GtaComPdf {
  gta: GTA;
  /** PDF original da guia, já baixado do Storage. */
  pdf?: Uint8Array;
}

function nomeArquivoSeguro(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9._-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80);
}

/**
 * Monta o zip que vai à certificadora: a planilha de campo e as GTAs originais.
 *
 * Vai junto porque é assim que a certificadora recebe — planilha sem as guias
 * volta como pendência. O CSV acompanha o xlsx para quem prefere abrir em
 * outro programa.
 */
export function montarPacoteCertificadora(
  processo: ProcessoMangueiro,
  animais: Bovino[],
  gtas: GtaComPdf[],
  quando = new Date()
): { nome: string; bytes: Uint8Array } {
  const base = nomeArquivoSeguro(processo.nome || "processo");
  const dia = quando.toISOString().slice(0, 10);

  const arquivos: ArquivoZip[] = [
    {
      nome: `planilha-de-campo-${base}.xlsx`,
      conteudo: gerarXlsxPlanilhaCampo(animais, quando),
    },
    {
      nome: `planilha-de-campo-${base}.csv`,
      conteudo: textoParaBytes(gerarCsvPlanilhaCampo(animais)),
    },
  ];

  for (const { gta, pdf } of gtas) {
    if (!pdf) continue;
    arquivos.push({
      nome: `gtas/GTA-${nomeArquivoSeguro(`${gta.serie}${gta.numero}`)}.pdf`,
      conteudo: pdf,
    });
  }

  arquivos.push({
    nome: "resumo.txt",
    conteudo: textoParaBytes(textoResumo(processo, animais, gtas, quando)),
  });

  return { nome: `certificadora-${base}-${dia}.zip`, bytes: criarZip(arquivos, quando) };
}

function textoResumo(
  processo: ProcessoMangueiro,
  animais: Bovino[],
  gtas: GtaComPdf[],
  quando: Date
): string {
  const linhas = [
    `Processo: ${processo.nome}`,
    `Tipo: ${processo.tipo}`,
    `Gerado em: ${quando.toLocaleString("pt-BR")}`,
    "",
    `Animais na planilha: ${animais.length}`,
    `Previsto nas GTAs: ${processo.totalAnimaisPrevisto}`,
    "",
    "GTAs:",
    ...gtas.map(
      ({ gta }) =>
        `  ${gta.serie} ${gta.numero} · ${gta.total} animais · ${gta.procFazenda || gta.procNome}` +
        ` → ${gta.destFazenda || gta.destNome}`
    ),
  ];

  const terceiros = animais.filter((a) => a.proprietario?.tipo === "terceiro");
  if (terceiros.length > 0) {
    linhas.push("", `Animais de terceiros: ${terceiros.length}`);
    const porDono = new Map<string, number>();
    for (const a of terceiros) {
      porDono.set(a.proprietario!.nome, (porDono.get(a.proprietario!.nome) ?? 0) + 1);
    }
    for (const [nome, qtd] of porDono) linhas.push(`  ${qtd} de ${nome}`);
  }

  return linhas.join("\n") + "\n";
}
