// src/app/api/ai/desempenho/route.ts
// Endpoint de IA: Análise de Desempenho Individual de Funcionários

import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

export interface EmployeeStatsPayload {
  name: string;
  period: string; // Ex: "Agosto 2026" ou "Julho - Agosto 2026"
  totalMsgs: number;
  targetMsgs: number; // meta calculada para o período (60/dia × dias)
  totalSales: number;
  convRate: number; // %
  revenue: number;
  bestCampaign: string;
  bestCampaignConvRate: number;
  worstCampaign: string;
  worstCampaignConvRate: number;
  momMsgsChange: number | null;   // % variação vs mês anterior
  momConvChange: number | null;   // % variação de conversão vs mês anterior
  teamAvgMsgs: number;
  teamAvgConv: number;
  teamAvgRevenue: number;
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
      ? `✅ ACIMA da meta: enviou ${diffMsgs} msgs a mais (${diffPercent}% acima)`
      : `🚨 ABAIXO da meta: faltaram ${Math.abs(diffMsgs)} msgs (${Math.abs(Number(diffPercent))}% abaixo)`;

    const momText = body.momMsgsChange !== null
      ? `Comparado ao mês anterior: msgs ${body.momMsgsChange >= 0 ? '+' : ''}${body.momMsgsChange?.toFixed(1)}%, conversão ${body.momConvChange !== null ? (body.momConvChange >= 0 ? '+' : '') + body.momConvChange?.toFixed(1) + '%' : 'N/A'}`
      : 'Apenas um mês selecionado para comparação.';

    const rankText = `Ranking de conversão: ${body.rank}º lugar de ${body.totalSellers} atendentes`;

    const prompt = `
Você é o Diretor de Performance de Vendas de uma boutique premium de carnes (Wagyu, Angus). Analise o desempenho do funcionário abaixo para uma reunião de equipe.

FUNCIONÁRIO: ${body.name}
PERÍODO ANALISADO: ${body.period}

DADOS DE PERFORMANCE:
- Mensagens enviadas: ${body.totalMsgs} (Meta MÍNIMA: ${body.targetMsgs} msgs — 60/dia)
- Status vs meta: ${statusMeta}
- Vendas convertidas: ${body.totalSales} pedidos
- Taxa de conversão: ${body.convRate.toFixed(1)}% (meta: 6%)
- Receita gerada: R$ ${body.revenue.toFixed(2)}
- Melhor campanha: ${body.bestCampaign} (${body.bestCampaignConvRate.toFixed(1)}% conversão)
- Campanha que precisa de atenção: ${body.worstCampaign} (${body.worstCampaignConvRate.toFixed(1)}% conversão)
- ${momText}

CONTEXTO DA EQUIPE:
- Média de msgs da equipe: ${body.teamAvgMsgs.toFixed(0)}
- Taxa de conversão média da equipe: ${body.teamAvgConv.toFixed(1)}%
- Receita média por atendente: R$ ${body.teamAvgRevenue.toFixed(2)}
- ${rankText}

REGRAS OBRIGATÓRIAS:
1. Se o funcionário estiver ABAIXO de 60 msgs/dia, mencione isso com clareza e urgência na primeira frase.
2. Se estiver ACIMA, reconheça brevemente e foque nos outros aspectos.
3. Destaque a melhor campanha como ponto forte.
4. Aponte UM ponto de melhoria específico e acionável (ex: "Intensificar abordagem na campanha X", "Converter mais no pós-venda").
5. Compare com a equipe de forma construtiva.
6. Escreva em no máximo 4 frases. Tom profissional, direto e motivador.
7. Responda APENAS com o texto da análise, sem títulos ou marcadores.
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
