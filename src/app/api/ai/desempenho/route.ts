// src/app/api/ai/desempenho/route.ts
// Endpoint de IA: Análise de Desempenho Individual do Atendente para o Administrador

import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

export interface EmployeeStatsPayload {
  name: string;
  monthEvaluated: string; // Ex: "Agosto de 2026"
  isCurrentMonth: boolean;
  currentDay: number;
  totalMsgs: number;
  targetMsgs: number; // meta calculada para o período (60/dia × dias)
  totalSales: number;
  convRate: number; // %
  revenue: number;
  bestCampaign: string;
  bestCampaignConvRate: number;
  worstCampaign: string;
  worstCampaignConvRate: number;
  
  // Comparativo com mês imediatamente anterior
  previousMonthName?: string;
  momMsgsChange: number | null;   // % variação vs mês anterior
  momConvChange: number | null;   // % variação de conversão vs mês anterior
  momRevenueChange?: number | null; // % variação de receita vs mês anterior

  // Comparativo com o Histórico do Próprio Atendente
  sellerHistoricalAvgMsgs?: number;
  sellerHistoricalAvgConv?: number;
  sellerHistoricalAvgRevenue?: number;

  // Comparativo com a Equipe
  teamMonthAvgMsgs: number;
  teamMonthAvgConv: number;
  teamMonthAvgRevenue: number;
  teamHistoricalAvgConv?: number;
  rank: number;
  totalSellers: number;
}

export async function POST(req: Request) {
  try {
    const body: EmployeeStatsPayload = await req.json();

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'GEMINI_API_KEY não configurada.' },
        { status: 500 }
      );
    }

    const genAI = new GoogleGenerativeAI(apiKey);

    const diffMsgs = body.totalMsgs - body.targetMsgs;
    const diffPercent = body.targetMsgs > 0
      ? ((diffMsgs / body.targetMsgs) * 100).toFixed(1)
      : '0';

    const statusMeta = diffMsgs >= 0
      ? `✅ ACIMA da meta de 60 msgs/dia: enviou ${body.totalMsgs} msgs (está +${diffMsgs} msgs ou +${diffPercent}% acima da meta de ${body.targetMsgs} msgs)`
      : `🚨 ABAIXO da meta de 60 msgs/dia: enviou ${body.totalMsgs} msgs (faltaram ${Math.abs(diffMsgs)} msgs ou -${Math.abs(Number(diffPercent))}% abaixo da meta de ${body.targetMsgs} msgs)`;

    const momText = body.momMsgsChange !== null
      ? `Comparado a ${body.previousMonthName || 'mês anterior'}: volume de msgs ${body.momMsgsChange >= 0 ? '+' : ''}${body.momMsgsChange?.toFixed(1)}%, conversão ${body.momConvChange !== null ? (body.momConvChange >= 0 ? '+' : '') + body.momConvChange?.toFixed(1) + '%' : 'N/A'}, receita ${body.momRevenueChange !== undefined && body.momRevenueChange !== null ? (body.momRevenueChange >= 0 ? '+' : '') + body.momRevenueChange.toFixed(1) + '%' : 'N/A'}`
      : 'Primeiro mês registrado no período.';

    // Histórico do próprio vendedor
    const selfHistoryText = (body.sellerHistoricalAvgMsgs !== undefined && body.sellerHistoricalAvgMsgs > 0)
      ? `Histórico médio pessoal do atendente: Média de ${body.sellerHistoricalAvgMsgs.toFixed(0)} msgs/mês, conversão média de ${body.sellerHistoricalAvgConv?.toFixed(1)}%, receita média de R$ ${body.sellerHistoricalAvgRevenue?.toFixed(2)}/mês.`
      : `Primeiro registro histórico do atendente.`;

    const prompt = `
Você é o Diretor de Performance de Vendas de uma boutique de carnes nobres.
Analise o desempenho do atendente ${body.name} no mês de ${body.monthEvaluated} para o Administrador/Gestor.

MÊS AVALIADO: ${body.monthEvaluated} (${body.isCurrentMonth ? `Mês em andamento até o dia ${body.currentDay}` : 'Mês Fechado Completo'})
META MÍNIMA OBRIGATÓRIA: 60 mensagens por dia (Meta para este período: ${body.targetMsgs} msgs).

1. RESULTADO DO ATENDENTE NO MÊS:
- Mensagens enviadas: ${body.totalMsgs} msgs (${statusMeta})
- Vendas convertidas: ${body.totalSales} pedidos
- Taxa de conversão: ${body.convRate.toFixed(1)}% (Meta da loja: 6%)
- Faturamento gerado: R$ ${body.revenue.toFixed(2)}
- Melhor campanha no mês: ${body.bestCampaign} (${body.bestCampaignConvRate.toFixed(1)}% taxa)
- Campanha que precisa de atenção: ${body.worstCampaign} (${body.worstCampaignConvRate.toFixed(1)}% taxa)
- ${momText}

2. COMPARATIVO COM O HISTÓRICO DO PRÓPRIO ATENDENTE:
- ${selfHistoryText}

3. COMPARATIVO COM A EQUIPE TODA NO MÊS (${body.monthEvaluated}):
- Ranking do atendente: ${body.rank}º lugar entre ${body.totalSellers} atendentes
- Média de mensagens da equipe no mês: ${body.teamMonthAvgMsgs.toFixed(0)} msgs
- Taxa de conversão média da equipe no mês: ${body.teamMonthAvgConv.toFixed(1)}%
- Receita média por atendente no mês: R$ ${body.teamMonthAvgRevenue.toFixed(2)}

DIRETRIZES DE RESPOSTA PARA O GESTOR:
1. Avalie o cumprimento da meta mínima de 60 msgs/dia logo de início.
2. Compare o desempenho do atendente tanto contra o seu próprio histórico pessoal quanto contra a média de toda a equipe no mês.
3. Destaque a campanha de maior conversão e aponte 1 ação de melhoria corretiva direta para a equipe aplicar com esse funcionário.
4. Mantenha em no máximo 4 a 5 frases, tom executivo, preciso e orientado a resultados. Responda apenas com o texto da análise.
    `.trim();

    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
    const result = await model.generateContent(prompt);
    const analysis = result.response.text();

    return NextResponse.json({ success: true, analysis });
  } catch (error: any) {
    console.error('Erro na análise de desempenho IA:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Erro ao gerar análise.' },
      { status: 500 }
    );
  }
}
