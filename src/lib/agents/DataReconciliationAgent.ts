import { supabaseAdmin as supabase } from '@/lib/supabase';

export interface ReconciliationReport {
  score: number;
  reconciledCount: number;
  reconciledAttributionsCount: number;
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
    let reconciledAttributionsCount = 0;
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
          reconciledAttributionsCount: 0,
          totalAudited: 0,
          details: ['Tabela de clientes zerada ou indisponível.']
        };
      }

      totalAudited = clients.length;

      // 2. Busca todas as compras do cashback_ledger
      const { data: ledgerRows } = await supabase
        .from('cashback_ledger')
        .select('client_id, order_id, created_at, original_amount')
        .eq('tenant_id', this.tenantId);

      const maxDateMap = new Map<string, string>();
      const totalSpentMap = new Map<string, number>();
      const uniqueOrdersMap = new Map<string, any>();

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

          if (!uniqueOrdersMap.has(row.order_id)) {
            uniqueOrdersMap.set(row.order_id, row);
          }
        });
      }

      // 3. Reconciliação de datas de compra e Lead Score
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
          details.push(`Data Reconciliada: ${c.name} (${new Date(latestLedgerDate).toLocaleDateString('pt-BR')})`);

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

      // 4. Reconciliação de Atribuição de Conversões (sales_attribution)
      const { data: interactions } = await supabase
        .from('client_interactions')
        .select('id, client_id, created_at')
        .eq('tenant_id', this.tenantId)
        .order('created_at', { ascending: false });

      const { data: existingAttributions } = await supabase
        .from('sales_attribution')
        .select('order_id')
        .eq('tenant_id', this.tenantId);

      const existingOrderIds = new Set((existingAttributions || []).map(a => a.order_id));

      if (interactions && interactions.length > 0) {
        const interactionsByClient = new Map<string, any[]>();
        interactions.forEach(int => {
          if (!interactionsByClient.has(int.client_id)) {
            interactionsByClient.set(int.client_id, []);
          }
          interactionsByClient.get(int.client_id)!.push(int);
        });

        for (const order of uniqueOrdersMap.values()) {
          if (existingOrderIds.has(order.order_id)) continue;

          const clientInts = interactionsByClient.get(order.client_id);
          if (!clientInts || clientInts.length === 0) continue;

          const orderTime = new Date(order.created_at).getTime();
          const validInt = clientInts.find(int => {
            const intTime = new Date(int.created_at).getTime();
            const diffDays = (orderTime - intTime) / (1000 * 60 * 60 * 24);
            return diffDays >= 0 && diffDays <= 30;
          });

          if (validInt) {
            reconciledAttributionsCount++;
            const rev = (Number(order.original_amount) || 0) * 10;
            details.push(`Conversão Atribuída: Pedido #${order.order_id} (R$ ${rev.toFixed(2)})`);

            await supabase.from('sales_attribution').insert({
              tenant_id: this.tenantId,
              interaction_id: validInt.id,
              order_id: order.order_id,
              revenue: rev,
              created_at: order.created_at
            });
          }
        }
      }

      const totalFixes = reconciledCount + reconciledAttributionsCount;
      const score = Math.max(0, 100 - (totalFixes * 5));

      return {
        score,
        reconciledCount,
        reconciledAttributionsCount,
        totalAudited,
        details: details.length > 0 ? details : ['Todas as vendas e conversões estão 100% atribuídas.']
      };
    } catch (err: any) {
      console.error('Erro na reconciliação de conversões pelo agente:', err);
      return {
        score: 90,
        reconciledCount,
        reconciledAttributionsCount,
        totalAudited,
        details: [`Erro durante a execução do agente: ${err.message}`]
      };
    }
  }
}
