import { Platform } from "react-native";

const API_BASE =
  Platform.OS === "web"
    ? "/api/gta"
    : "https://confi-gilt.vercel.app/api/gta";

export type GTAAnimal = {
  descricao: string;
  especie: string | null;
  sexo: string | null;
  faixaEtaria: string | null;
  qtdEnviada: number;
  qtdRecebida: number;
};

export type GTAData = {
  identificacao: {
    situacao: string | null;
    protocolo: string | null;
    numero: string | null;
    serie: string | null;
    uf: string | null;
    codigoBarras: string | null;
  };
  especie: {
    grupo: string | null;
    especie: string | null;
    finalidade: string | null;
  };
  emissao: {
    localidade: string | null;
    municipio: string | null;
    emitente: string | null;
    dataEmissao: string | null;
    dataRecebimento: string | null;
    dataValidade: string | null;
    observacao: string | null;
  };
  origem: {
    tipo: string | null;
    codigo: string | null;
    nome: string | null;
    cpfCnpj: string | null;
    nomeProdutor: string | null;
    uf: string | null;
    municipio: string | null;
  };
  destino: {
    tipo: string | null;
    codigo: string | null;
    nome: string | null;
    cpfCnpj: string | null;
    nomeProdutor: string | null;
    uf: string | null;
    municipio: string | null;
  };
  animais: GTAAnimal[];
  totalAnimais: number;
};

export async function consultarGTA(barcode: string): Promise<GTAData> {
  const response = await fetch(API_BASE, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ barcode }),
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    throw new Error(
      errorBody.error || `Erro na consulta (${response.status})`,
    );
  }

  const json = await response.json();

  if (json.error) {
    throw new Error(json.error);
  }

  if (!json.data) {
    throw new Error("Nenhum documento encontrado.");
  }

  return json.data as GTAData;
}
