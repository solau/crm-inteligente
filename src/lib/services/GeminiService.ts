// src/lib/services/GeminiService.ts
// Arquitetura limpa: Lógica do Agente de IA

import { GoogleGenerativeAI } from '@google/generative-ai';

export class GeminiService {
  private tenantId: string;
  private genAI: GoogleGenerativeAI | null;

  constructor(tenantId: string) {
    this.tenantId = tenantId;
    const apiKey = process.env.GEMINI_API_KEY;
    this.genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null;
  }

  // Busca o contexto do negócio no Supabase
  private async getTenantContext() {
    return "Sua Empresa de Vendas";
  }

  async calculateLeadScore(clientData: any, interactions: any[]) {
    const context = await this.getTenantContext();
    console.log(`Calculating score for tenant ${this.tenantId}`);
    return 85; // Mock
  }

  async generateRemarketingMessage(clientHistory: any) {
    return "Oi! Vimos que você gosta dos nossos produtos. Temos uma oferta especial.";
  }

  async analyzeKanbanIntent(whatsappMessage: string) {
    return {
      action: 'MOVE_CARD',
      targetColumn: 'Fechado (Ganho)'
    };
  }

  async generateDossieTatico(cliente: any, extratoPedidos: any[], stockMap: Record<string, number> = {}): Promise<string> {
    if (!this.genAI) {
      return "⚠️ A Chave da API do Google Gemini não foi configurada. Configure no arquivo .env.local para ativar a inteligência.";
    }
    
    // Resumo financeiro do cliente
    const totalGasto = cliente.total_spent || 0;
    const score = cliente.lead_score || 0;
    
    // Resumo dos últimos produtos comprados e seus saldos em estoque
    const ultimosItens = extratoPedidos.slice(0, 10).map((p: any) => {
      if (!p.itens || p.itens.length === 0) return '';
      return p.itens.map((i: any) => {
        const prodId = i.produto?.id || i.item?.produto?.id;
        const nome = i.descricao || (i.item && i.item.descricao) || 'Produto Genérico';
        const estoque = prodId && stockMap[prodId] !== undefined ? stockMap[prodId] : 'Desconhecido';
        return `${nome} (Estoque: ${estoque})`;
      }).join(', ');
    }).filter(Boolean);
    const listaProdutos = ultimosItens.join(' | ');

    const prompt = `
      Você é a Inteligência Artificial de Vendas (Dossiê Tático) auxiliando um vendedor.
      
      Você precisa analisar o seguinte cliente:
      - Nome: ${cliente.name}
      - Total Gasto na Vida: R$ ${totalGasto}
      - Lead Score (0 a 100): ${score} (100 = Fã leal comprando sempre; <30 = Cliente esfriando/sumido)
      - Últimas compras reais dele e SALDO EM ESTOQUE ATUAL: ${listaProdutos || 'Nenhuma compra registrada'}

      REGRAS CRÍTICAS DE NEGÓCIO:
      1. Liste de forma natural no texto os produtos que o cliente mais comprou e que possuam estoque maior que zero (Estoque > 0). Se o cliente tiver bastante histórico de compras, liste sempre no mínimo 5 produtos.
      2. NUNCA invente produtos que não estão na lista de compras reais acima. É ESTRITAMENTE PROIBIDO "alucinar" produtos, como "cortes de carne", "sorvete belga" ou qualquer item não citado.
      3. Baseie as suas dicas de re-compra EXCLUSIVAMENTE nos produtos da lista com estoque.
      4. SE O ESTOQUE DO PRODUTO FOR ZERO (0), É PROIBIDO SUgeri-lo! Nesse caso, apenas foque no relacionamento institucional, sem sugerir falsas alternativas.
      5. Escreva em parágrafo único (máximo de 5 linhas). Nada de listas (bullet points) ou e-mail. É um resumo tático rápido e persuasivo.

      Diga ao vendedor que tom ele deve usar (Ex: 'Cliente Premium, trate-o com exclusividade' ou 'Cliente esfriando, ofereça algo novo').
      NÃO use saudações, vá direto ao ponto tático.
    `;

    try {
      const model = this.genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
      const result = await model.generateContent(prompt);
      const response = await result.response;
      return response.text();
    } catch (error) {
      console.error("Erro no Gemini:", error);
      return "⚠️ Erro ao gerar o Dossiê Tático via IA. Tente novamente mais tarde.";
    }
  }

  async analyzePreferences(historicoAntigo: string | undefined, novosProdutos: Array<{ descricao: string, quantidade: number }>): Promise<string> {
    if (!this.genAI) {
      return historicoAntigo || "";
    }

    const listaProdutos = novosProdutos.map(p => `${p.quantidade}x ${p.descricao}`).join(', ');
    
    const prompt = `
      Atuando como IA de vendas especialista.
      Um cliente acabou de comprar: ${listaProdutos}.
      O histórico de preferências atual dele é: ${historicoAntigo || 'Nenhum histórico ainda'}.
      
      Por favor, gere um resumo em no MÁXIMO 2 frases descrevendo o perfil de preferências deste cliente, mesclando os gostos antigos com as novas compras. Seja sucinto e direto ao ponto para o vendedor ler rapidamente.
    `;

    try {
      const model = this.genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
      const result = await model.generateContent(prompt);
      return result.response.text();
    } catch (error) {
      console.error("Erro no Gemini (Preferences):", error);
      return historicoAntigo || "";
    }
  }
}
