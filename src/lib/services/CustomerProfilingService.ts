import { supabaseAdmin } from '@/lib/supabase';
import { GeminiService } from './GeminiService';

export interface CustomerProfileAnalysis {
  recencyDays: number;
  statusTag: 'COMPRADOR_HOJE' | 'ATIVO_FERVENDO' | 'RECORRENTE_VIP' | 'EM_RISCO' | 'SUMIDO_CHURN';
  leadScore: number;
  ltv: number;
  avgTicket: number;
  benchmarkComparison: string;
  recommendedAction: string;
}

export class CustomerProfilingService {
  private tenantId: string;

  constructor(tenantId: string = 'd948b6cc-cc2c-4399-8525-02f17f281d38') {
    this.tenantId = tenantId;
  }

  // Calcula o Lead Score com base na Recência real em dias, Frequência e Valor (RFM)
  calculateSmartLeadScore(lastPurchaseDateStr?: string, totalSpent: number = 0, purchaseCount: number = 1): { score: number; recencyDays: number; statusTag: any } {
    const now = new Date();
    let recencyDays = 999;

    if (lastPurchaseDateStr) {
      const lastDate = new Date(lastPurchaseDateStr);
      const diffMs = now.getTime() - lastDate.getTime();
      recencyDays = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
    }

    // 1. Pontuação de Recência (0 a 100)
    let recencyScore = 0;
    let statusTag: 'COMPRADOR_HOJE' | 'ATIVO_FERVENDO' | 'RECORRENTE_VIP' | 'EM_RISCO' | 'SUMIDO_CHURN' = 'SUMIDO_CHURN';

    if (recencyDays === 0) {
      recencyScore = 100;
      statusTag = 'COMPRADOR_HOJE';
    } else if (recencyDays <= 7) {
      recencyScore = 95;
      statusTag = 'ATIVO_FERVENDO';
    } else if (recencyDays <= 30) {
      recencyScore = 75;
      statusTag = 'RECORRENTE_VIP';
    } else if (recencyDays <= 60) {
      recencyScore = 45;
      statusTag = 'EM_RISCO';
    } else {
      recencyScore = 15;
      statusTag = 'SUMIDO_CHURN';
    }

    // 2. Pontuação de Valor (0 a 100)
    const valueScore = Math.min(100, Math.floor((totalSpent / 500) * 100));

    // 3. Pontuação de Frequência (0 a 100)
    const freqScore = Math.min(100, purchaseCount * 20);

    // Média Ponderada: Recência (50%), Valor (30%), Frequência (20%)
    const finalScore = Math.round((recencyScore * 0.50) + (valueScore * 0.30) + (freqScore * 0.20));

    return {
      score: Math.max(1, Math.min(100, finalScore)),
      recencyDays,
      statusTag
    };
  }

  // Aprendizado Contínuo a cada novo pedido: Atualiza perfil do cliente e histórico da loja
  async learnFromOrder(clientId: string, orderValue: number, orderDateStr?: string) {
    const { data: client } = await supabaseAdmin
      .from('clients')
      .select('*')
      .eq('id', clientId)
      .single();

    if (!client) return;

    const { data: ledger } = await supabaseAdmin
      .from('cashback_ledger')
      .select('order_id, original_amount, created_at')
      .eq('client_id', clientId);

    const purchaseCount = (ledger ? ledger.length : 0) + 1;
    const newTotalSpent = (Number(client.total_spent) || 0) + Number(orderValue);
    const saleDate = orderDateStr || new Date().toISOString();

    const { score, recencyDays, statusTag } = this.calculateSmartLeadScore(saleDate, newTotalSpent, purchaseCount);

    // Atualiza cliente com o novo Lead Score RFM recalculado
    await supabaseAdmin
      .from('clients')
      .update({
        total_spent: newTotalSpent,
        lead_score: score,
        base_lead_score: score,
        last_purchase_date: saleDate
      })
      .eq('id', clientId);

    // Gera um novo dossiê inteligente via Gemini sem informações incorretas
    try {
      const gemini = new GeminiService(this.tenantId);
      const newDossier = await gemini.generateDossieTatico(
        {
          ...client,
          total_spent: newTotalSpent,
          lead_score: score,
          last_purchase_date: saleDate
        },
        ledger || []
      );

      await supabaseAdmin
        .from('clients')
        .update({ preferences: newDossier })
        .eq('id', clientId);
    } catch (e) {
      console.error('Erro ao aprender com novo pedido:', e);
    }
  }
}
