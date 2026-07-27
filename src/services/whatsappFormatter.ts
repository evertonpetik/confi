/**
 * whatsappFormatter.ts
 *
 * Formata respostas da IA para serem ótimas no WhatsApp: curtas, escanáveis,
 * com emojis para destacar, e estruturadas por bullet points.
 */

export function formatarResposta(respostaBruta: string): string {
  // Se a resposta já é curta (< 150 chars), retorna como está
  if (respostaBruta.length < 150) {
    return respostaBruta;
  }

  // Limita a ~1000 caracteres (limite prático do WhatsApp por mensagem)
  if (respostaBruta.length > 1000) {
    const truncado = respostaBruta.substring(0, 950).trim();
    // Encontra o último ponto antes de truncar
    const ultimoPonto = truncado.lastIndexOf(".");
    return (ultimoPonto > 800 ? truncado.substring(0, ultimoPonto + 1) : truncado) + "\n…";
  }

  return respostaBruta;
}

/**
 * Função helper para formatar dados estruturados de análise
 * Converte objetos em formato legível para WhatsApp
 */
export function formatarAnalise(dados: any): string {
  if (!dados || typeof dados !== "object") {
    return String(dados);
  }

  const linhas: string[] = [];

  // Se é um erro, retorna de forma clara
  if (dados.erro) {
    return `❌ ${dados.erro}`;
  }

  // Se tem resumo/mensagem, começa com isso
  if (dados.mensagem) {
    linhas.push(dados.mensagem);
  }
  if (dados.resumo) {
    linhas.push(dados.resumo);
  }

  // Se tem alertas, formata com emoji
  if (dados.alertas && Array.isArray(dados.alertas)) {
    if (dados.alertas.length === 0) {
      linhas.push("✅ Nenhum alerta");
    } else {
      linhas.push("\n⚠️ Alertas:");
      dados.alertas.slice(0, 3).forEach((a: any) => {
        linhas.push(`• ${a.mensagem || a.tipo}`);
      });
      if (dados.alertas.length > 3) {
        linhas.push(`• ...e mais ${dados.alertas.length - 3}`);
      }
    }
  }

  // Se tem problemas, formata com emoji
  if (dados.lotesComProblema && Array.isArray(dados.lotesComProblema)) {
    if (dados.lotesComProblema.length > 0) {
      linhas.push("\n🚨 Lotes com problema:");
      dados.lotesComProblema.slice(0, 3).forEach((l: any) => {
        linhas.push(
          `• Lote ${l.numeroLote}: ${l.problemas?.join(", ") || "problemas detectados"}`
        );
      });
    }
  }

  // Dados de lote
  if (dados.numero || dados.quantidadeAtual) {
    linhas.push("\n📊 Status do lote:");
    if (dados.numero) linhas.push(`• Número: ${dados.numero}`);
    if (dados.quantidadeAtual) linhas.push(`• Animais: ${dados.quantidadeAtual}`);
    if (dados.pesoMedioEstimado) linhas.push(`• Peso médio: ${dados.pesoMedioEstimado} kg`);
    if (dados.gmdEstimado) linhas.push(`• GMD: ${dados.gmdEstimado} kg/dia`);
    if (dados.cmsAtual) linhas.push(`• CMS: ${dados.cmsAtual}%`);
    if (dados.piquete) linhas.push(`• Piquete: ${dados.piquete}`);
  }

  // Histórico GMD
  if (dados.gmdRealMedio !== undefined && dados.registros) {
    linhas.push("\n📈 GMD Histórico:");
    linhas.push(`• Média: ${dados.gmdRealMedio} kg/dia`);
    linhas.push(`• Registros: ${dados.registros.length} dias`);
  }

  // Estoque
  if (dados.estoqueKg !== undefined) {
    const diasSuprimento = (dados.estoqueKg / 30).toFixed(1); // ~30kg/dia padrão
    linhas.push("\n📦 Estoque:");
    linhas.push(`• ${dados.nome}: ${Math.round(dados.estoqueKg)} kg`);
    linhas.push(`• Dias: ~${diasSuprimento} dias`);
    if (dados.precoMedioKg) linhas.push(`• Preço: R$ ${dados.precoMedioKg.toFixed(2)}/kg`);

    // Alerta se estoque baixo
    if (parseInt(diasSuprimento) < 15) {
      linhas.push(`• ⚠️ Estoque baixo! Encomendar?`);
    }
  }

  return linhas.join("\n");
}
