export type EstimativaPesoResult = {
  pesoEstimado: number;
  confiancaMin: number;
  confiancaMax: number;
  escoreCondicaoCorporal: number;
  observacao: string;
};

export type AnimalContext = {
  raca?: string;
  categoria?: string;
  tamanhoCorporal?: string;
  pesoProjetado?: number;
  gmdEstimado?: number;
};

const SYSTEM_PROMPT = `Voce e um especialista em avaliacao visual de bovinos de corte. Sua tarefa e estimar o peso vivo do animal na foto com base em: condicao corporal (escala 1-9), tamanho de frame, musculatura, cobertura de gordura, e caracteristicas da raca.

Responda APENAS com JSON valido no formato:
{
  "pesoEstimado": <numero em kg>,
  "confiancaMin": <limite inferior em kg>,
  "confiancaMax": <limite superior em kg>,
  "escoreCondicaoCorporal": <numero de 1 a 9>,
  "observacao": "<breve justificativa da estimativa em portugues>"
}

Nao inclua texto fora do JSON. Nao use markdown.`;

function buildUserPrompt(contexto?: AnimalContext): string {
  let prompt = "Estime o peso vivo deste bovino.";

  if (contexto) {
    const detalhes: string[] = [];
    if (contexto.raca) detalhes.push(`Raca: ${contexto.raca}`);
    if (contexto.categoria) detalhes.push(`Categoria: ${contexto.categoria}`);
    if (contexto.tamanhoCorporal) detalhes.push(`Tamanho Corporal: ${contexto.tamanhoCorporal}`);
    if (contexto.pesoProjetado) detalhes.push(`Peso projetado pelo sistema: ${contexto.pesoProjetado.toFixed(1)} kg`);
    if (contexto.gmdEstimado) detalhes.push(`GMD estimado: ${contexto.gmdEstimado} kg/dia`);

    if (detalhes.length > 0) {
      prompt += `\nInformacoes adicionais do lote: ${detalhes.join(", ")}.`;
    }
  }

  return prompt;
}

export async function estimarPesoPorImagem(
  base64Image: string,
  mimeType: string,
  apiKey: string,
  contexto?: AnimalContext
): Promise<EstimativaPesoResult> {
  const mediaType = mimeType as "image/jpeg" | "image/png" | "image/gif" | "image/webp";

  const isWeb = typeof window !== "undefined" && typeof document !== "undefined";
  const url = isWeb ? "/api/anthropic" : "https://api.anthropic.com/v1/messages";

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "x-api-key": apiKey,
  };
  if (!isWeb) {
    headers["anthropic-version"] = "2023-06-01";
  }

  const response = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: mediaType,
                data: base64Image,
              },
            },
            {
              type: "text",
              text: buildUserPrompt(contexto),
            },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    if (response.status === 401) {
      throw new Error("Chave da API invalida. Verifique em Configuracoes > Configuracoes IA.");
    }
    throw new Error(`Erro na API (${response.status}): ${errorBody}`);
  }

  const data = await response.json();

  const textContent = data.content?.find((c: any) => c.type === "text");
  if (!textContent?.text) {
    throw new Error("Resposta vazia da API.");
  }

  const jsonText = textContent.text.trim();
  try {
    const resultado: EstimativaPesoResult = JSON.parse(jsonText);

    if (
      typeof resultado.pesoEstimado !== "number" ||
      typeof resultado.confiancaMin !== "number" ||
      typeof resultado.confiancaMax !== "number" ||
      typeof resultado.escoreCondicaoCorporal !== "number"
    ) {
      throw new Error("Campos obrigatorios ausentes na resposta.");
    }

    return resultado;
  } catch (parseError) {
    // Try to extract JSON from response if it has extra text
    const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    throw new Error("Nao foi possivel interpretar a resposta da IA.");
  }
}
