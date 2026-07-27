/**
 * api/cron/alertas.ts
 *
 * Rodado diariamente pelo Vercel Cron (configurar em vercel.json).
 * Verifica alertas de CMS fora do previsto (lógica da seção 5.4 da
 * documentação técnica) e envia mensagem proativa via WhatsApp para
 * os usuários vinculados.
 *
 * IMPORTANTE: alertas proativos usam a categoria "Utility" de template
 * do WhatsApp (precisa ser um template pré-aprovado pela Meta se o
 * destinatário não te escreveu nas últimas 24h). Para simplificar,
 * este exemplo assume que o texto livre funciona (o que só é garantido
 * dentro da janela de 24h de uma conversa já aberta pelo usuário).
 * Se os alertas forem para fora dessa janela, você precisará criar um
 * template de mensagem aprovado no Meta Business Manager.
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { sendWhatsAppText } from "../../src/services/whatsappService";
import {
  getCollection,
  queryCollection,
  setCurrentFazendaId,
  fsWhere,
} from "../../src/services/firestoreServiceServer";

// Protege o endpoint de cron pra só o Vercel poder chamar (ver docs do Vercel Cron)
const CRON_SECRET = process.env.CRON_SECRET as string;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const authHeader = req.headers.authorization;
  if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
    return res.status(401).send("Não autorizado");
  }

  setCurrentFazendaId(null);
  let totalAlertas = 0;

  try {
    // "fazendas" é coleção raiz — lista todos os tenants do sistema
    const fazendasSnap = await getCollection("fazendas");

    for (const fazendaDoc of fazendasSnap.docs) {
      const fazendaId = fazendaDoc.id;
      setCurrentFazendaId(fazendaId);

      try {
        const alertas = await verificarAlertasCMS();
        totalAlertas += alertas.length;

        for (const alerta of alertas) {
          // whatsappUsuarios é raiz, então filtramos explicitamente por
          // fazendaId + produtorId pra achar os destinatários certos
          const usuariosSnap = await queryCollection(
            ["whatsappUsuarios"],
            [
              fsWhere("fazendaId", "==", fazendaId),
              fsWhere("produtorId", "==", alerta.produtorId),
              fsWhere("ativo", "==", true),
            ]
          );

          for (const usuarioDoc of usuariosSnap.docs) {
            const usuario = usuarioDoc.data();
            await sendWhatsAppText(usuario.telefone, alerta.mensagem);
          }
        }
      } catch (errFazenda) {
        // Uma fazenda com erro não deve travar as demais
        console.error(`Erro ao processar alertas da fazenda ${fazendaId}:`, errFazenda);
      } finally {
        setCurrentFazendaId(null);
      }
    }

    return res.status(200).json({ fazendasProcessadas: fazendasSnap.size, alertasEnviados: totalAlertas });
  } catch (err) {
    console.error("Erro no cron de alertas:", err);
    return res.status(500).send("Erro ao processar alertas");
  } finally {
    setCurrentFazendaId(null);
  }
}

interface Alerta {
  produtorId: string;
  mensagem: string;
}

async function verificarAlertasCMS(): Promise<Alerta[]> {
  const alertas: Alerta[] = [];

  const lotesSnap = await queryCollection(["lotes"], [fsWhere("ativo", "==", true)]);

  for (const loteDoc of lotesSnap.docs) {
    const lote = loteDoc.data();

    const leiturasSnap = await getCollection("lotes", loteDoc.id, "leituras");
    const leituras = leiturasSnap.docs.map((d) => d.data());
    if (leituras.length === 0) continue;

    const ultima = leituras.sort((a, b) => b.data.localeCompare(a.data))[0];

    // Exemplo simplificado: fatorMax/fatorMin viriam da sua tabela `notaLeitura`.
    // Aqui usamos limites fixos de +-10% como no exemplo da documentação.
    const limiteMax = ultima.cmsAnterior * 1.1;
    const limiteMin = ultima.cmsAnterior * 0.9;

    if (ultima.cmsNovo > limiteMax) {
      alertas.push({
        produtorId: lote.produtorId,
        mensagem: `⚠️ Lote ${lote.numero} (piquete ${lote.piqueteNome}): CMS acima do esperado (${ultima.cmsNovo}%). Vale conferir a leitura de cocho.`,
      });
    } else if (ultima.cmsNovo < limiteMin) {
      alertas.push({
        produtorId: lote.produtorId,
        mensagem: `⚠️ Lote ${lote.numero} (piquete ${lote.piqueteNome}): CMS abaixo do esperado (${ultima.cmsNovo}%). Vale conferir a leitura de cocho.`,
      });
    }
  }

  return alertas;
}
