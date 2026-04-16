import { Platform } from "react-native";

const API_BASE =
  Platform.OS === "web"
    ? "/api/sintegra"
    : "https://confi-gilt.vercel.app/api/sintegra";

export type SintegraData = {
  inscricaoEstadual: string | null;
  razaoSocial: string | null;
  nomeFantasia: string | null;
  cnpjCpf: string | null;
  situacao: string | null;
  dataCredenciamento: string | null;
  endereco: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  municipio: string | null;
  uf: string | null;
  cep: string | null;
  telefone: string | null;
  atividadePrincipal: string | null;
  regimeApuracao: string | null;
};

export async function consultarSintegra(
  inscricaoEstadual: string,
): Promise<SintegraData> {
  const response = await fetch(API_BASE, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ inscricaoEstadual }),
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
    throw new Error("Nenhum dado encontrado.");
  }

  return json.data as SintegraData;
}
