/**
 * Planilha de campo enviada à certificadora SISBOV.
 *
 * Layout de seis colunas, uma linha por animal:
 *
 *   Sisbov;Manejo;Sexo;Raca;DataNasc;Data identificação
 *   105500508078035;807803;M;NE;05/01/2025;21/07/2026
 *
 * Módulo sem dependências de React Native para poder ser verificado fora do app.
 */
import { Bovino } from "./weighing.types";
import { gerarXlsx } from "./xlsx";

const COLUNAS = ["Sisbov", "Manejo", "Sexo", "Raca", "DataNasc", "Data identificação"];

function dataBr(iso?: string): string {
  if (!iso) return "";
  // Datas civis (yyyy-mm-dd) precisam ser lidas no fuso local: interpretadas
  // como UTC, a oeste de Greenwich voltariam um dia.
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (m) return `${m[3]}/${m[2]}/${m[1]}`;
  return new Date(iso).toLocaleDateString("pt-BR");
}

/** Linhas da planilha, sem cabeçalho — base comum do CSV e do XLSX. */
export function linhasPlanilhaCampo(animais: Bovino[]): string[][] {
  return animais.map((a) => [
    a.sisbov,
    a.manejo,
    a.sexo,
    a.metadados?.racaCodigo ?? a.raca,
    dataBr(a.dataNascimento),
    dataBr(a.dataEntrada),
  ]);
}

/** Planilha em CSV separado por ponto e vírgula, com BOM para o Excel. */
export function gerarCsvPlanilhaCampo(animais: Bovino[]): string {
  const linhas = linhasPlanilhaCampo(animais).map((l) => l.join(";"));
  return "﻿" + COLUNAS.join(";") + "\n" + linhas.join("\n");
}

/**
 * Planilha de campo em .xlsx — o formato que a certificadora recebe.
 *
 * Tudo vai como texto: SISBOV e manejo têm zeros à esquerda e seriam
 * convertidos em número pelo Excel, que comeria os zeros e estragaria a
 * identificação do animal.
 */
export function gerarXlsxPlanilhaCampo(animais: Bovino[], quando = new Date()): Uint8Array {
  return gerarXlsx(
    {
      nome: "Planilha de Campo",
      cabecalho: COLUNAS,
      linhas: linhasPlanilhaCampo(animais),
      larguras: [20, 12, 8, 8, 14, 18],
    },
    quando
  );
}

export { COLUNAS as COLUNAS_PLANILHA_CAMPO };
