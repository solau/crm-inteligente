// src/app/api/ai/meu-desempenho/route.ts
// Endpoint de IA: Autoavaliação do Vendedor por Mês com Comparativo Histórico Próprio e da Equipe

import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

export interface CampaignMonthStats {
  campaign: string;
  label: string;
  monthMsgs: number;
  monthSales: number;
  monthConvRate: number;
  monthRevenue: number;
  prevMonthMsgs: number;
  prevMonthSales: number;
  prevMonthConvRate: number;
  prevMonthRevenue: number;
}

export interface SellerSelfEvaluationPayload {
  sellerName: string;
  monthEvaluated: string; // Ex: "Agosto de 2026"
  isCurrentMonth: boolean;
  currentDay: number;
  previousMonthName: string;
  targetMsgs: number; // 60 msgs/dia * dias do periodo
  
  // Dados do mês avaliado
  monthMsgs: number;
  monthSales: number;
  monthConvRate: number;
  monthRevenue: number;

  // Comparativo com o mês imediatamente anterior
  prevMonthMsgs: number;
  prevMonthSales: number;
  prevMonthConvRate: number;
  prevMonthRevenue: number;

  // Histórico do próprio vendedor (médias históricas)
  sellerHistoricalAvgMsgs?: number;
  sellerHistoricalAvgConv?: number;
  sellerHistoricalAvgRevenue?: number;

  // Benchmark da Equipe no Mês
  teamMonthAvgMsgs: number;
  teamMonthAvgConv: number;
  teamMonthAvgRevenue: number;

  // Campanhas
  campaigns: CampaignMonthStats[];
}

export async function POST(req: Request) {
  try {
    const body: SellerSelfEvaluationPayload = await req.json();

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'GEMINI_API_KEY não configurada.' },
        { status: 500 }
      );
    }

    const genAI = new GoogleGenerativeAI(apiKey);

    const diffTarget = body.monthMsgs - body.targetMsgs;
    const targetStatus = diffTarget >= 0
      ? `✅ ACIMA DA META MÍNIMA DE 60 MSGS/DIA: Você enviou ${body.monthMsgs} msgs (+${diffTarget} msgs acima da meta de ${body.targetMsgs} msgs).`
      : `🚨 ABAIXO DA META MÍNIMA DE 60 MSGS/DIA: Você enviou ${body.monthMsgs} msgs de um mínimo de ${body.targetMsgs} msgs necessárias (faltaram ${Math.abs(diffTarget)} msgs para manter 60/dia).`;

    const deltaMsgs = body.monthMsgs - body.prevMonthMsgs;
    const deltaMsgsPercent = body.prevMonthMsgs > 0 ? ((deltaMsgs / body.prevMonthMsgs) * 100).toFixed(1) : (body.monthMsgs > 0 ? '+100' : '0');
    const deltaSales = body.monthSales - body.prevMonthSales;
    const deltaRevenue = body.monthRevenue - body.prevMonthRevenue;
    const deltaConv = (body.monthConvRate - body.prevMonthConvRate).toFixed(1);

    const deltaVsTeamConv = (body.monthConvRate - body.teamMonthAvgConv).toFixed(1);
    const deltaVsTeamMsgs = body.monthMsgs - body.teamMonthAvgMsgs;
    const deltaVsTeamRevenue = body.monthRevenue - body.teamMonthAvgRevenue;

    const selfHistoryComparison = (body.sellerHistoricalAvgMsgs !== undefined && body.sellerHistoricalAvgMsgs > 0)
      ? `- Sua média histórica pessoal: ${body.sellerHistoricalAvgMsgs.toFixed(0)} msgs/mês, conversão média de ${body.sellerHistoricalAvgConv?.toFixed(1)}%, faturamento médio de R$ ${body.sellerHistoricalAvgRevenue?.toFixed(2)}.`
      : `- Primeiro registro de histórico individual.`;

    const campaignsSummary = body.campaigns
      .filter(c => c.monthMsgs > 0 || c.prevMonthMsgs > 0)
      .map(c => {
        return `- ${c.label}: ${c.monthMsgs} msgs enviadas, ${c.monthSales} vendas (${c.monthConvRate.toFixed(1)}% taxa), R$ ${c.monthRevenue.toFixed(2)} (vs ${c.prevMonthMsgs} msgs e R$ ${c.prevMonthRevenue.toFixed(2)} no mês anterior)`;
      })
      .join('\n');

    const prompt = `
Você é o Diretor e Mentor Comercial de Vendas.
Faça uma avaliação detalhada, humana, profissional e motivadora DIRETAMENTE PARA O VENDEDOR(A) ${body.sellerName}.

MÊS AVALIADO: ${body.monthEvaluated} (${body.isCurrentMonth ? `Mês em andamento até o dia ${body.currentDay}` : 'Mês Fechado Completo'})
META MÍNIMA OBRIGATÓRIA: 60 mensagens por dia (${body.targetMsgs} mensagens no período).
STATUS DA META DE 60 MSGS/DIA: ${targetStatus}

1. SEU RESULTADO EM ${body.monthEvaluated}:
- Mensagens Enviadas: ${body.monthMsgs} msgs (${deltaMsgs >= 0 ? '+' : ''}${deltaMsgs} msgs ou ${deltaMsgsPercent}% vs ${body.previousMonthName})
- Vendas Convertidas: ${body.monthSales} pedidos (${deltaSales >= 0 ? '+' : ''}${deltaSales} vs ${body.previousMonthName})
- Taxa de Conversão: ${body.monthConvRate.toFixed(1)}% (${Number(deltaConv) >= 0 ? '+' : ''}${deltaConv} p.p. vs ${body.previousMonthName}) [Meta: 6%]
- Receita Gerada: R$ ${body.monthRevenue.toFixed(2)} (${deltaRevenue >= 0 ? '+' : ''}R$ ${deltaRevenue.toFixed(2)} vs ${body.previousMonthName})

2. COMPARATIVO COM SEU PRÓPRIO HISTÓRICO:
${selfHistoryComparison}

3. COMPARATIVO COM A MÉDIA DE TODA A EQUIPE EM ${body.monthEvaluated}:
- Média de mensagens por vendedor na equipe: ${body.teamMonthAvgMsgs.toFixed(0)} msgs (Você está ${deltaVsTeamMsgs >= 0 ? `+${deltaVsTeamMsgs} msgs ACIMA` : `${Math.abs(deltaVsTeamMsgs)} msgs ABAIXO`} da média da equipe)
- Taxa de conversão média da equipe: ${body.teamMonthAvgConv.toFixed(1)}% (Você está ${Number(deltaVsTeamConv) >= 0 ? `+${deltaVsTeamConv} p.p. ACIMA` : `${Math.abs(Number(deltaVsTeamConv))} p.p. ABAIXO`} da média da equipe)
- Faturamento médio por vendedor na equipe: R$ ${body.teamMonthAvgRevenue.toFixed(2)} (Você está ${deltaVsTeamRevenue >= 0 ? `+R$ ${deltaVsTeamRevenue.toFixed(2)} ACIMA` : `-R$ ${Math.abs(deltaVsTeamRevenue).toFixed(2)} ABAIXO`} da média da equipe)

4. DESEMPENHO POR CAMPANHA NO MÊS:
${campaignsSummary || 'Nenhuma interação registrada ainda nas campanhas.'}

ESTRUTURA OBRIGATÓRIA DA RESPOSTA (Fale em 2ª pessoa: "Você...", use markdown e tópicos claros):
1. **Ritmo & Meta de 60 msgs/dia**: Destaque se o vendedor bateu a meta mínima obrigatória de 60 mensagens por dia no mês de ${body.monthEvaluated}.
2. **Evolução Pessoal (Mês a Mês e Histórico)**: Compare o resultado dele com o mês anterior (${body.previousMonthName}) e com a média histórica dele mesmo (se está em evolução ou precisa acelerar).
3. **Seu Posicionamento vs Média da Equipe**: Mostre como o vendedor performou em relação à média geral do time (volume, conversão e faturamento).
4. **Destaques de Campanhas & Plano de Ação**: Aponte a campanha de maior sucesso e dê 2 dicas práticas para converter mais nas campanhas fracas.

Seja motivador, perspicaz e focado em metas de alta performance!
    `.trim();

    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
    const result = await model.generateContent(prompt);
    const analysis = result.response.text();

    return NextResponse.json({ success: true, analysis });
  } catch (error: any) {
    console.error('Erro na autoavaliação do vendedor:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Erro ao gerar avaliação.' },
      { status: 500 }
    );
  }
}
