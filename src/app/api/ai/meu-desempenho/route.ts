// src/app/api/ai/meu-desempenho/route.ts
// Endpoint de IA: Autoavaliação de Desempenho do Vendedor com Comparativo MTD (Month-To-Date)

import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

export interface CampaignMtdStats {
  campaign: string;
  label: string;
  currentMsgs: number;
  currentSales: number;
  currentConvRate: number;
  currentRevenue: number;
  prevMtdMsgs: number;
  prevMtdSales: number;
  prevMtdConvRate: number;
  prevMtdRevenue: number;
}

export interface SellerSelfEvaluationPayload {
  sellerName: string;
  currentDay: number;
  currentMonthName: string;
  previousMonthName: string;
  targetMsgs: number; // 60 msgs/dia * currentDay
  currentMtdMsgs: number;
  currentMtdSales: number;
  currentMtdConvRate: number;
  currentMtdRevenue: number;
  prevMtdMsgs: number;
  prevMtdSales: number;
  prevMtdConvRate: number;
  prevMtdRevenue: number;
  campaigns: CampaignMtdStats[];
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

    const diffTarget = body.currentMtdMsgs - body.targetMsgs;
    const targetStatus = diffTarget >= 0
      ? `✅ ACIMA DA META DIÁRIA: Você enviou ${body.currentMtdMsgs} msgs (está +${diffTarget} msgs à frente da meta mínima de ${body.targetMsgs} msgs até o dia ${body.currentDay}).`
      : `🚨 ABAIXO DA META DIÁRIA: Você enviou ${body.currentMtdMsgs} msgs de um mínimo de ${body.targetMsgs} msgs esperadas até hoje (faltam ${Math.abs(diffTarget)} msgs para atingir 60 msgs/dia).`;

    const deltaMsgs = body.currentMtdMsgs - body.prevMtdMsgs;
    const deltaMsgsPercent = body.prevMtdMsgs > 0 ? ((deltaMsgs / body.prevMtdMsgs) * 100).toFixed(1) : (body.currentMtdMsgs > 0 ? '+100' : '0');

    const deltaSales = body.currentMtdSales - body.prevMtdSales;
    const deltaRevenue = body.currentMtdRevenue - body.prevMtdRevenue;
    const deltaConv = (body.currentMtdConvRate - body.prevMtdConvRate).toFixed(1);

    const campaignsSummary = body.campaigns
      .filter(c => c.currentMsgs > 0 || c.prevMtdMsgs > 0)
      .map(c => {
        return `- ${c.label}:
   * Mês Atual (${body.currentMonthName} até dia ${body.currentDay}): ${c.currentMsgs} msgs, ${c.currentSales} vendas (${c.currentConvRate.toFixed(1)}% taxa), R$ ${c.currentRevenue.toFixed(2)}
   * Mês Anterior (${body.previousMonthName} até dia ${body.currentDay}): ${c.prevMtdMsgs} msgs, ${c.prevMtdSales} vendas (${c.prevMtdConvRate.toFixed(1)}% taxa), R$ ${c.prevMtdRevenue.toFixed(2)}`;
      })
      .join('\n');

    const prompt = `
Você é o Diretor e Mentor de Performance Comercial do CRM Inteligente. 
Faça uma avaliação executiva, profunda, humana e motivadora DIRETAMENTE PARA O VENDEDOR(A) ${body.sellerName}.

CONTEXTO TEMPORAL RIGOROSO:
- Estamos no dia ${body.currentDay} de ${body.currentMonthName}.
- A comparação é feita RIGOROSAMENTE com o mesmo período do mês anterior: Dia 1 ao dia ${body.currentDay} de ${body.previousMonthName}.

META OBRIGATÓRIA DE VOLUME:
- Mínimo de 60 mensagens por dia.
- Meta esperada até o dia ${body.currentDay}: ${body.targetMsgs} mensagens.
- Status atual da meta: ${targetStatus}

DADOS CONSOLIDADOS DO VENDEDOR (ATÉ O DIA ${body.currentDay}):
1. Mensagens Enviadas:
   - ${body.currentMonthName}: ${body.currentMtdMsgs} msgs
   - ${body.previousMonthName} (até dia ${body.currentDay}): ${body.prevMtdMsgs} msgs
   - Variação: ${deltaMsgs >= 0 ? '+' : ''}${deltaMsgs} msgs (${deltaMsgsPercent}%)

2. Vendas Convertidas:
   - ${body.currentMonthName}: ${body.currentMtdSales} pedidos
   - ${body.previousMonthName} (até dia ${body.currentDay}): ${body.prevMtdSales} pedidos
   - Variação: ${deltaSales >= 0 ? '+' : ''}${deltaSales} pedidos

3. Taxa de Conversão:
   - ${body.currentMonthName}: ${body.currentMtdConvRate.toFixed(1)}% (Meta: 6%)
   - ${body.previousMonthName} (até dia ${body.currentDay}): ${body.prevMtdConvRate.toFixed(1)}%
   - Variação: ${Number(deltaConv) >= 0 ? '+' : ''}${deltaConv} p.p.

4. Receita Gerada:
   - ${body.currentMonthName}: R$ ${body.currentMtdRevenue.toFixed(2)}
   - ${body.previousMonthName} (até dia ${body.currentDay}): R$ ${body.prevMtdRevenue.toFixed(2)}
   - Variação: ${deltaRevenue >= 0 ? '+' : ''}R$ ${deltaRevenue.toFixed(2)}

DETALHAMENTO POR CAMPANHA ATÉ O MOMENTO:
${campaignsSummary || 'Nenhuma interação registrada ainda nas campanhas.'}

ESTRUTURA DA SUA RESPOSTA (Fale em 2ª pessoa: "Você...", seja direto, objetivo e inspirador):
1. **Diagnóstico de Ritmo & Meta**: Avalie se o vendedor está cumprindo o ritmo mínimo de 60 msgs/dia. Se estiver abaixo, aponte a urgência com firmeza construtiva. Se estiver acima, parabenize pela disciplina.
2. **Comparativo com o Mês Anterior (até a mesma data)**: Mostre com clareza se o vendedor evoluiu ou retrocedeu em volume, conversão e receita frente ao mesmo período de ${body.previousMonthName}.
3. **Destaques de Campanhas**: Aponte a melhor campanha (maior tração/conversão) e a campanha onde o vendedor está deixando dinheiro na mesa.
4. **Plano de Ação para os Próximos Dias**: Dê 2 recomendações táticas altamente práticas para fechar o mês com recorde.

Formate em texto limpo e elegante com markdown, usando tópicos destacados e emojis. Seja profissional, analítico e motivador.
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
