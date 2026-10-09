export const ORDEM_PREFIXO_PIQUETE: Record<string, number> = {
  piquete: 0,
  rinc: 1,
  rn: 2,
};

export function extrairPrefixoNumeroPiquete(nome: string): { prefixo: string; numero: number } {
  const match = nome.match(/^([A-Za-zÀ-ÿ]+)\s*(\d+)/);
  if (match) {
    return { prefixo: match[1].toLowerCase(), numero: parseInt(match[2], 10) };
  }
  return { prefixo: nome.toLowerCase(), numero: 0 };
}

export function compararPiquetes(nomeA: string, nomeB: string): number {
  const a = extrairPrefixoNumeroPiquete(nomeA);
  const b = extrairPrefixoNumeroPiquete(nomeB);
  const ordemA = ORDEM_PREFIXO_PIQUETE[a.prefixo] ?? 99;
  const ordemB = ORDEM_PREFIXO_PIQUETE[b.prefixo] ?? 99;
  if (ordemA !== ordemB) return ordemA - ordemB;
  if (a.prefixo !== b.prefixo) return a.prefixo.localeCompare(b.prefixo);
  return a.numero - b.numero;
}
