import { Saida } from "@/components/InsumoCard";

export function calcularConsumoUltimoDia(saidas: Saida[]): { data: string | null; quantidade: number } {
  let maisRecente: string | null = null;
  for (const s of saidas) {
    if (!maisRecente || s.data > maisRecente) maisRecente = s.data;
  }
  if (!maisRecente) return { data: null, quantidade: 0 };
  const quantidade = saidas
    .filter((s) => s.data === maisRecente)
    .reduce((acc, s) => acc + s.quantidade, 0);
  return { data: maisRecente, quantidade };
}

export function calcularAutonomiaDias(estoqueAtual: number, consumoUltimoDia: number): number | null {
  if (consumoUltimoDia <= 0) return null;
  return estoqueAtual / consumoUltimoDia;
}

export function isEstoqueBaixo(autonomiaDias: number | null, autonomiaMinimaDias?: number): boolean {
  if (autonomiaDias === null) return false;
  if (!autonomiaMinimaDias || autonomiaMinimaDias <= 0) return false;
  return autonomiaDias <= autonomiaMinimaDias;
}
