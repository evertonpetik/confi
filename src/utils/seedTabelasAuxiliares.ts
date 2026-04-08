import { createBatch, getCollection } from "@/services/firestoreService"

type TabelaAuxiliar = {
  nome: string
  colecao: string
  dados: Record<string, string | number>[]
}

const tabelasAuxiliares: TabelaAuxiliar[] = [
  {
    nome: "Tamanho Corporal",
    colecao: "tamanhoCorporal",
    dados: [
      { descricao: '3 - Gir de pequeno porte, "Tucuras"', fator: 3 },
      { descricao: "4 - Gir, Nelore de pequeno porte", fator: 4 },
      { descricao: "5 - Nelore, Guzerá, Angus, Hereford", fator: 5 },
      { descricao: "6 - Nelore de Grande porte, Canchim, Brangus", fator: 6 },
      { descricao: "7 - F1 Britânica x Nelore, Limousin", fator: 7 },
      { descricao: "8 - F1 Continental x Nelore, Simental", fator: 8 },
      { descricao: "9 - Holandês, Chianina, Charolês, Braunvieh", fator: 9 },
    ],
  },
  {
    nome: "Implante",
    colecao: "implante",
    dados: [
      { descricao: "Nenhum", fator: 0.95 },
      { descricao: "Simples", fator: 1 },
      { descricao: "Combinação Simples", fator: 1.02 },
      { descricao: "Combinação Agressiva", fator: 1.084 },
    ],
  },
  {
    nome: "Movimentação",
    colecao: "movimentacao",
    dados: [
      { descricao: "Gado Próprio", tipo: "Entrada" },
      { descricao: "Compra", tipo: "Entrada" },
      { descricao: "Parceria", tipo: "Entrada" },
      { descricao: "Boitel", tipo: "Entrada" },
      { descricao: "Mudança de lote", tipo: "Entrada" },
      { descricao: "Sobrou", tipo: "Entrada" },
      { descricao: "Transferência", tipo: "Entrada" },
      { descricao: "Retorno ao lote", tipo: "Entrada" },
      { descricao: "Morte", tipo: "Saida" },
      { descricao: "Venda", tipo: "Saida" },
      { descricao: "Não Adaptação", tipo: "Saida" },
      { descricao: "Transferência", tipo: "Saida" },
      { descricao: "Mudança de lote", tipo: "Saida" },
      { descricao: "Faltou", tipo: "Saida" },
      { descricao: "Doente", tipo: "Saida" },
      { descricao: "Parida", tipo: "Saida" },
    ],
  },
  {
    nome: "Raça",
    colecao: "raca",
    dados: [
      { descricao: "Nelore", fator: 0.89 },
      { descricao: "Outros Zebuínos", fator: 0.89 },
      { descricao: "F1 Britânico", fator: 0.94 },
      { descricao: "F1 Continentais", fator: 0.96 },
      { descricao: "F1 Holandês", fator: 1.1 },
      { descricao: "Sintéticas", fator: 0.96 },
      { descricao: "Britânicas", fator: 1 },
      { descricao: "Continentais", fator: 1.05 },
      { descricao: "Cont. dupla apt.", fator: 1.1 },
      { descricao: "Holandês", fator: 1.2 },
    ],
  },
  {
    nome: "Compensatório",
    colecao: "compensatorio",
    dados: [
      { descricao: "Intenso", fator: 1.2 },
      { descricao: "Moderado", fator: 1.1 },
      { descricao: "Ausente", fator: 1 },
    ],
  },
  {
    nome: "Categoria",
    colecao: "categoria",
    dados: [
      { descricao: "Macho castr.", fator: 1.2 },
      { descricao: "Macho inteiro", fator: 1.1 },
      { descricao: "Novilhas", fator: 1 },
      { descricao: "Vacas", fator: 1 },
    ],
  },
  {
    nome: "Grau de Estrutura Corporal (GEC)",
    colecao: "gec",
    dados: [
      { descricao: "Tamanho Corporal 1 - Macho castr.", tamanhoCorporal: 1, categoria: "Macho castr.", fator: 1.04 },
      { descricao: "Tamanho Corporal 1 - Macho inteiro", tamanhoCorporal: 1, categoria: "Macho inteiro", fator: 1.25 },
      { descricao: "Tamanho Corporal 1 - Novilhas", tamanhoCorporal: 1, categoria: "Novilhas", fator: 1.56 },
      { descricao: "Tamanho Corporal 1 - Vacas", tamanhoCorporal: 1, categoria: "Vacas", fator: 1.56 },
      { descricao: "Tamanho Corporal 2 - Macho castr.", tamanhoCorporal: 2, categoria: "Macho castr.", fator: 0.98 },
      { descricao: "Tamanho Corporal 2 - Macho inteiro", tamanhoCorporal: 2, categoria: "Macho inteiro", fator: 1.19 },
      { descricao: "Tamanho Corporal 2 - Novilhas", tamanhoCorporal: 2, categoria: "Novilhas", fator: 1.47 },
      { descricao: "Tamanho Corporal 2 - Vacas", tamanhoCorporal: 2, categoria: "Vacas", fator: 1.47 },
      { descricao: "Tamanho Corporal 3 - Macho castr.", tamanhoCorporal: 3, categoria: "Macho castr.", fator: 0.93 },
      { descricao: "Tamanho Corporal 3 - Macho inteiro", tamanhoCorporal: 3, categoria: "Macho inteiro", fator: 1.13 },
      { descricao: "Tamanho Corporal 3 - Novilhas", tamanhoCorporal: 3, categoria: "Novilhas", fator: 1.39 },
      { descricao: "Tamanho Corporal 3 - Vacas", tamanhoCorporal: 3, categoria: "Vacas", fator: 1.39 },
      { descricao: "Tamanho Corporal 4 - Macho castr.", tamanhoCorporal: 4, categoria: "Macho castr.", fator: 0.88 },
      { descricao: "Tamanho Corporal 4 - Macho inteiro", tamanhoCorporal: 4, categoria: "Macho inteiro", fator: 1.06 },
      { descricao: "Tamanho Corporal 4 - Novilhas", tamanhoCorporal: 4, categoria: "Novilhas", fator: 1.32 },
      { descricao: "Tamanho Corporal 4 - Vacas", tamanhoCorporal: 4, categoria: "Vacas", fator: 1.32 },
      { descricao: "Tamanho Corporal 5 - Macho castr.", tamanhoCorporal: 5, categoria: "Macho castr.", fator: 0.83 },
      { descricao: "Tamanho Corporal 5 - Macho inteiro", tamanhoCorporal: 5, categoria: "Macho inteiro", fator: 1 },
      { descricao: "Tamanho Corporal 5 - Novilhas", tamanhoCorporal: 5, categoria: "Novilhas", fator: 1.25 },
      { descricao: "Tamanho Corporal 5 - Vacas", tamanhoCorporal: 5, categoria: "Vacas", fator: 1.25 },
      { descricao: "Tamanho Corporal 6 - Macho castr.", tamanhoCorporal: 6, categoria: "Macho castr.", fator: 0.79 },
      { descricao: "Tamanho Corporal 6 - Macho inteiro", tamanhoCorporal: 6, categoria: "Macho inteiro", fator: 0.95 },
      { descricao: "Tamanho Corporal 6 - Novilhas", tamanhoCorporal: 6, categoria: "Novilhas", fator: 1.19 },
      { descricao: "Tamanho Corporal 6 - Vacas", tamanhoCorporal: 6, categoria: "Vacas", fator: 1.19 },
      { descricao: "Tamanho Corporal 7 - Macho castr.", tamanhoCorporal: 7, categoria: "Macho castr.", fator: 0.76 },
      { descricao: "Tamanho Corporal 7 - Macho inteiro", tamanhoCorporal: 7, categoria: "Macho inteiro", fator: 0.91 },
      { descricao: "Tamanho Corporal 7 - Novilhas", tamanhoCorporal: 7, categoria: "Novilhas", fator: 1.14 },
      { descricao: "Tamanho Corporal 7 - Vacas", tamanhoCorporal: 7, categoria: "Vacas", fator: 1.14 },
      { descricao: "Tamanho Corporal 8 - Macho castr.", tamanhoCorporal: 8, categoria: "Macho castr.", fator: 0.73 },
      { descricao: "Tamanho Corporal 8 - Macho inteiro", tamanhoCorporal: 8, categoria: "Macho inteiro", fator: 0.87 },
      { descricao: "Tamanho Corporal 8 - Novilhas", tamanhoCorporal: 8, categoria: "Novilhas", fator: 1.09 },
      { descricao: "Tamanho Corporal 8 - Vacas", tamanhoCorporal: 8, categoria: "Vacas", fator: 1.09 },
      { descricao: "Tamanho Corporal 9 - Macho castr.", tamanhoCorporal: 9, categoria: "Macho castr.", fator: 0.69 },
      { descricao: "Tamanho Corporal 9 - Macho inteiro", tamanhoCorporal: 9, categoria: "Macho inteiro", fator: 0.83 },
      { descricao: "Tamanho Corporal 9 - Novilhas", tamanhoCorporal: 9, categoria: "Novilhas", fator: 1.04 },
      { descricao: "Tamanho Corporal 9 - Vacas", tamanhoCorporal: 9, categoria: "Vacas", fator: 1.04 },
    ],
  },
  {
    nome: "Aditivos",
    colecao: "aditivos",
    dados: [
      { descricao: "Nenhum", fator: 1 },
      { descricao: "Monensina", fator: 1.1 },
      { descricao: "Salinomicina", fator: 1.1 },
      { descricao: "Lasolicida", fator: 1.1 },
    ],
  },
  {
    nome: "Piquetes",
    colecao: "piquetes",
    dados: [
      { descricao: "Piquete 1", capacidade: 150 },
      { descricao: "Piquete 2", capacidade: 150 },
      { descricao: "Piquete 3", capacidade: 150 },
      { descricao: "Piquete 4", capacidade: 150 },
      { descricao: "Piquete 5", capacidade: 150 },
      { descricao: "Piquete 6", capacidade: 150 },
      { descricao: "Piquete 7", capacidade: 150 },
      { descricao: "Piquete 8", capacidade: 150 },
      { descricao: "Piquete 9", capacidade: 150 },
      { descricao: "Piquete 10", capacidade: 150 },
      { descricao: "Piquete 11", capacidade: 150 },
      { descricao: "Piquete 12", capacidade: 150 },
      { descricao: "Piquete 13", capacidade: 150 },
      { descricao: "Piquete 14", capacidade: 150 },
      { descricao: "Piquete 15", capacidade: 150 },
      { descricao: "Piquete 16", capacidade: 150 },
      { descricao: "Piquete 17", capacidade: 80 },
      { descricao: "Piquete 18", capacidade: 80 },
      { descricao: "Piquete 19", capacidade: 180 },
      { descricao: "Piquete 20", capacidade: 180 },
    ],
  },
  {
    nome: "Vagão",
    colecao: "vagao",
    dados: [
      { descricao: "Vertimix", capacidade: 7000 },
    ],
  },
  {
    nome: "Nota de Leitura",
    colecao: "notaLeitura",
    dados: [
      { descricao: "1", fator: 1.1 },
      { descricao: "2", fator: 1.03 },
      { descricao: "3", fator: 1 },
      { descricao: "4", fator: 0.97 },
      { descricao: "5", fator: 0.9 },
    ],
  },
  {
    nome: "Parametros",
    colecao: "parametros",
    dados: [
      { descricao: "tempoMS", valor: 3 },
      { descricao: "custo_operacional", valor: 2 },
    ],
  },
]

export async function seedTabelasAuxiliares(): Promise<string> {
  const resultados: string[] = []

  for (const tabela of tabelasAuxiliares) {
    const snapshot = await getCollection(tabela.colecao)

    if (!snapshot.empty) {
      resultados.push(`"${tabela.nome}" ja existe (${snapshot.size} registros) - ignorada`)
      continue
    }

    const batch = createBatch()
    for (const item of tabela.dados) {
      batch.set([tabela.colecao], item)
    }
    await batch.commit()
    resultados.push(`"${tabela.nome}" criada com ${tabela.dados.length} registros`)
  }

  return resultados.join("\n")
}
