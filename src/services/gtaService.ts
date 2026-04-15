import { Platform } from "react-native";

const API_BASE =
  Platform.OS === "web"
    ? "/api/gta"
    : "https://confi-gilt.vercel.app/api/gta";

export type GTAData = {
  codigo: number;
  mensagem?: string;
  // campos retornados pela API do IAGRO
  numero?: string;
  serie?: string;
  dataEmissao?: string;
  dataValidade?: string;
  finalidade?: string;
  situacao?: string;
  eSaniagro?: boolean;
  documentoId?: number;
  // origem
  origemInscricao?: string;
  origemNome?: string;
  origemFazenda?: string;
  origemMunicipio?: string;
  origemUF?: string;
  // destino
  destinoInscricao?: string;
  destinoNome?: string;
  destinoFazenda?: string;
  destinoMunicipio?: string;
  destinoUF?: string;
  // animais
  especie?: string;
  animais?: GTAAnimal[];
  totalAnimais?: number;
  // campo genérico para dados brutos
  [key: string]: any;
};

export type GTAAnimal = {
  raca?: string;
  sexo?: string;
  categoria?: string;
  quantidade?: number;
  idade?: number;
  idadeAnos?: number;
  [key: string]: any;
};

export async function consultarGTA(
  barcode: string,
  recaptchaToken: string,
): Promise<GTAData> {
  const response = await fetch(API_BASE, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ barcode, recaptchaToken }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Erro na consulta (${response.status}): ${errorBody}`);
  }

  const json = await response.json();

  // A API do IAGRO retorna { data, status: { codigo, mensagem }, ... }
  if (json.status?.codigo === 200) {
    return parseGTAResponse(json.data);
  }

  if (json.status?.codigo === 203) {
    throw new Error("Consulta não autorizada. Tente novamente.");
  }

  if (json.status?.mensagem) {
    throw new Error(json.status.mensagem);
  }

  throw new Error("Resposta inesperada da API.");
}

function parseGTAResponse(data: any): GTAData {
  if (!data) throw new Error("Nenhum documento encontrado.");

  // A estrutura pode variar - mapear campos conhecidos
  const animais: GTAAnimal[] = (data.animaisIdentificados || data.animais || []).map(
    (a: any) => ({
      ...a,
      idadeAnos: a.idade ? Math.floor(a.idade / 12) : undefined,
    }),
  );

  return {
    ...data,
    animais,
    totalAnimais:
      data.totalAnimais ??
      animais.reduce((sum: number, a: GTAAnimal) => sum + (a.quantidade || 0), 0),
  };
}
