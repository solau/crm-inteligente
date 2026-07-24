import { supabaseAdmin as supabase } from '@/lib/supabase';

export interface ReconciliationReport {
  score: number;
  reconciledCount: number;
  totalAudited: number;
  details: string[];
}

export class DataReconciliationAgent {
  private tenantId: string;

  constructor(tenantId: string = 'd948b6cc-cc2c-4399-8525-02f17f281d38') {
    this.tenantId = tenantId;
  }

  async runReconciliation(): Promise<ReconciliationReport> {
    const details: string[] = [];
    let reconciledCount = 0;
    let totalAudited = 0;

    try {
      // 1. Busca todos os clientes cadastrados
      const { data: clients, error: cErr } = await supabase
        .from('clients')
        .select('id, name, phone, last_purchase_date, total_spent')
        .eq('tenant_id', this.tenantId);

      if (cErr || !clients) {
        return {
          score: 100,
          reconciledCount: 0,
          totalAudited: 0,
          details: ['Tabela de clientes zerada ou indisponível.']
        };
      }

      totalAudited = clients.length;

      // 2. Busca todas as compras do cashback_ledger
      const { data: ledgerRows } = await supabase
        .from('cashback_ledger')
        .select('client_id, created_at, original_amount')
        .eq('tenant_id', this.tenantId);

      const maxDateMap = new Map<string, string>();
      const totalSpentMap = new Map<string, number>();

      if (ledgerRows) {
        ledgerRows.forEach(row => {
          if (!row.client_id) return;
          const currentMax = maxDateMap.get(row.client_id);
          const orderDate = new Date(row.created_at).getTime();

          if (!currentMax || orderDate > new Date(currentMax).getTime()) {
            maxDateMap.set(row.client_id, row.created_at);
          }

          const currentSpent = totalSpentMap.get(row.client_id) || 0;
          const purchaseVal = (Number(row.original_amount) || 0) * 10;
          totalSpentMap.set(row.client_id, currentSpent + purchaseVal);
        });
      }

      // 3. Identifica e reconcilia divergências de datas e Lead Score em segundo plano
      const now = new Date();

      for (const c of clients) {
        const latestLedgerDate = maxDateMap.get(c.id);
        if (!latestLedgerDate) continue;

        if (!c.last_purchase_date || new Date(latestLedgerDate) > new Date(c.last_purchase_date)) {
          const calcSpent = totalSpentMap.get(c.id) || Number(c.total_spent) || 0;
          const diffDays = Math.max(0, Math.floor((now.getTime() - new Date(latestLedgerDate).getTime()) / (1000 * 60 * 60 * 24)));
          const recencyScore = diffDays <= 7 ? 100 : diffDays <= 30 ? 80 : diffDays <= 60 ? 50 : 20;
          const leadScore = Math.min(100, Math.round(recencyScore * 0.6 + Math.min(40, calcSpent / 25)));

          reconciledCount++;
          details.push(`Reconciliado: ${c.name} (Data atualizada para ${new Date(latestLedgerDate).toLocaleDateString('pt-BR')}, Score: ${leadScore})`);

          await supabase
            .from('clients')
            .update({
              last_purchase_date: latestLedgerDate,
              lead_score: leadScore,
              base_lead_score: leadScore
            })
            .eq('id', c.id);
        }
      }

      const score = Math.max(0, 100 - (reconciledCount * 5));

      return {
        score,
        reconciledCount,
        totalAudited,
        details: details.length > 0 ? details : ['Todos os clientes estão com as datas de compra 100% sincronizadas.']
      };
    } catch (err: any) {
      console.error('Erro na reconciliação de dados pelo agente:', err);
      return {
        score: 90,
        reconciledCount,
        totalAudited,
        details: [`Erro durante a execução do agente: ${err.message}`]
      };
    }
  }
}
