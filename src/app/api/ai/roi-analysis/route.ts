import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

export async function POST(request: Request) {
  try {
    const { stats } = await request.json();

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'Chave de API do Gemini não configurada' }, { status: 500 });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    const prompt = `
Você é um consultor especialista em Vendas, CRM e Recuperação de Clientes.
Analise os seguintes dados de ROI (Retorno sobre Investimento) da operação de vendas (abordagens via WhatsApp do Kanban):

Métricas Gerais:
- Total de Mensagens Enviadas: ${stats.totalMessages}
- Total de Vendas Convertidas: ${stats.totalSales}
- Taxa de Conversão: ${stats.conversionRate}%
- Receita Gerada: R$ ${stats.totalRevenue.toFixed(2)}

Desempenho por Campanha:
${JSON.stringify(stats.campaignStats, null, 2)}

Desempenho por Vendedor (A meta mínima de cada um é enviar 30 mensagens por dia):
${JSON.stringify(stats.sellerStats, null, 2)}

Por favor, forneça uma análise executiva breve (máximo de 3 ou 4 parágrafos curtos) respondendo:
1. Como está a performance geral e a taxa de conversão?
2. Avalie o desempenho de cada vendedor. Quem bateu a meta diária de 30 mensagens (msgsToday)? Quem está convertendo mais vendas?
3. Qual a sua recomendação número 1 para melhorar os resultados amanhã?

Seja direto, profissional e focado em métricas.
    `;

    const result = await model.generateContent(prompt);
    const text = result.response.text();

    return NextResponse.json({ analysis: text });
  } catch (error: any) {
    console.error('Erro ao gerar análise de IA:', error);
    return NextResponse.json({ error: 'Falha ao conectar com o modelo de Inteligência Artificial' }, { status: 500 });
  }
}
