export type VeiculoQRPayload = {
  type: "confi_veiculo";
  id: string;
  nome: string;
  tipoMarcador: "km" | "horimetro" | "nenhum";
};

export function generateVeiculoQRPayload(veiculo: {
  id: string;
  nome: string;
  tipoMarcador: "km" | "horimetro" | "nenhum";
}): string {
  const payload: VeiculoQRPayload = {
    type: "confi_veiculo",
    id: veiculo.id,
    nome: veiculo.nome,
    tipoMarcador: veiculo.tipoMarcador,
  };
  return JSON.stringify(payload);
}

export function parseVeiculoQRPayload(data: string): VeiculoQRPayload | null {
  try {
    const parsed = JSON.parse(data);
    if (parsed.type !== "confi_veiculo") return null;
    if (!parsed.id || !parsed.nome || !parsed.tipoMarcador) return null;
    return {
      type: "confi_veiculo",
      id: parsed.id,
      nome: parsed.nome,
      tipoMarcador: parsed.tipoMarcador,
    };
  } catch {
    return null;
  }
}
