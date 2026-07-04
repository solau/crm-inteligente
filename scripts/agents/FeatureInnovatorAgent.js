const { GoogleGenerativeAI } = require('@google/generative-ai');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');

// Load env variables
dotenv.config({ path: path.join(__dirname, '../../.env.local') });

class FeatureInnovatorAgent {
  constructor() {
    this.name = 'FeatureInnovatorAgent';
    const apiKey = process.env.GEMINI_API_KEY;
    this.genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null;
  }

  async execute() {
    console.log(`[${this.name}] Gerando propostas de melhorias e novas funcionalidades...`);
    const insights = [];

    const defaultSuggestions = `
1. **Campanhas de Remarketing Automatizadas por Segmento (WhatsApp):**
   - Agendar disparos automáticos para clientes com status "Risco de Churn" ou "Esfriando" no CRM, enviando ofertas personalizadas com base nos produtos favoritos deles que voltaram ao estoque.
2. **Gráficos e Cohorts RFM Interativos:**
   - Criar uma aba de Analytics na Dashboard para exibir o histograma de Recência e Frequência do cliente, facilitando a identificação visual de grupos saudáveis versus grupos que precisam de retenção imediata.
3. **Regras Avançadas de Cashback Customizáveis:**
   - Implementar uma tela de configurações onde o lojista pode definir porcentagens de cashback diferenciadas por categoria de produto (ex: cashback de 15% para cortes nobres de Wagyu e 5% para acompanhamentos) e carência customizável.
4. **Relatórios Gerenciais em PDF via WhatsApp:**
   - Um agente que envia relatórios executivos diários para o gestor com o fechamento do dia (cashbacks emitidos, resgatados, LTV médio e alertas de capping de desconto).
`;

    if (!this.genAI) {
      insights.push({
        type: 'OPPORTUNITY',
        title: 'Sugestões de novas funcionalidades (Modo Offline)',
        content: `A chave do Gemini não foi detectada no ambiente para geração dinâmica. Aqui estão as propostas pré-configuradas baseadas na arquitetura do CRM:\n\n${defaultSuggestions}`
      });
      return insights;
    }

    try {
      const model = this.genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
      const prompt = `
        Você é o FeatureInnovatorAgent, um agente especialista em design de produto de CRM inteligente e engenharia de software.
        A aplicação é um "CRM Inteligente" com as seguintes características:
        - Integração com Bling ERP (pedidos e clientes).
        - Gestão de Cashback (Ledger, FIFO, carência, expiração).
        - Painel de controle de leads e dossiê de preferências gerado por IA.
        - Foco no cliente final e engajamento.

        Propõe 3 a 4 novas funcionalidades que tragam altíssimo valor de negócio (fidelização, recompra e retenção) e descreva os benefícios técnicos de implementação de cada uma.
        Responda em português, usando formatação Markdown amigável com listas claras. Vá direto ao ponto, sem introduções ou saudações.
      `;
      const result = await model.generateContent(prompt);
      const suggestions = result.response.text();
      
      insights.push({
        type: 'OPPORTUNITY',
        title: 'Sugestões de melhorias e inovações (Gerado via IA)',
        content: suggestions
      });
    } catch (e) {
      console.error('Erro ao chamar Gemini no FeatureInnovatorAgent:', e);
      insights.push({
        type: 'OPPORTUNITY',
        title: 'Sugestões de novas funcionalidades (Modo Offline - Fallback)',
        content: `Falha ao conectar com o Gemini API. Aqui estão as sugestões baseadas no design do CRM:\n\n${defaultSuggestions}`
      });
    }

    return insights;
  }
}

module.exports = FeatureInnovatorAgent;
