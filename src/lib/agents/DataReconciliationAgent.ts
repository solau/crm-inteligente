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

  private async fetchAllPaginated(table: string, select: string, extraFilter?: (q: any) => any): Promise<any[]> {
    let allRows: any[] = [];
    let from = 0;
    const step = 1000;

    while (true) {
      let query = supabase
        .from(table)
        .select(select)
        .eq('tenant_id', this.tenantId);

      if (extraFilter) {
        query = extraFilter(query);
      }

      const { data, error } = await query.range(from, from + step - 1);

      if (error || !data || data.length === 0) break;
      allRows.push(...data);
      if (data.length < step) break;
      from += step;
    }

    return allRows;
  }

  async runReconciliation(): Promise<ReconciliationReport> {
    const details: string[] = [];
    let reconciledCount = 0;
    let reconciledAttributionsCount = 0;
    let totalAudited = 0;

    try {
      // 1. Busca TODOS os clientes cadastrados (com paginação estrita)
      const clients = await this.fetchAllPaginated('clients', 'id, name, phone, last_purchase_date, total_spent, cashback_balance');

      if (!clients || clients.length === 0) {
        return {
          score: 100,
          reconciledCount: 0,
          reconciledAttributionsCount: 0,
          totalAudited: 0,
          details: ['Tabela de clientes zerada ou indisponível.']
        };
      }

      totalAudited = clients.length;

      // 2. Busca TODOS os lançamentos do cashback_ledger (com paginação)
      const ledgerRows = await this.fetchAllPaginated('cashback_ledger', 'client_id, order_id, created_at, original_amount, remaining_amount, status, expires_at');

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

      // 3. Reconciliação Geral de datas de compra, Saldo de Cashback e Lead Score
      const now = new Date();
      const nowIso = now.toISOString();

      // Zero-out e expira qualquer item vencido
      await supabase
        .from('cashback_ledger')
        .update({ status: 'EXPIRADO', remaining_amount: 0 })
        .eq('tenant_id', this.tenantId)
        .in('status', ['ATIVO', 'PENDENTE'])
        .lte('expires_at', nowIso);

      // Garante remaining_amount = 0 em entradas EXPIRADAS/UTILIZADAS
      await supabase
        .from('cashback_ledger')
        .update({ remaining_amount: 0 })
        .eq('tenant_id', this.tenantId)
        .in('status', ['EXPIRADO', 'UTILIZADO'])
        .gt('remaining_amount', 0);

      // Busca TODOS os lançamentos ATIVOS para cálculo exato por cliente
      const activeLedgerRows = await this.fetchAllPaginated('cashback_ledger', 'client_id, remaining_amount', q => q.eq('status', 'ATIVO'));

      const realActiveBalanceMap = new Map<string, number>();
      if (activeLedgerRows) {
        activeLedgerRows.forEach(row => {
          if (!row.client_id) return;
          const curr = realActiveBalanceMap.get(row.client_id) || 0;
          realActiveBalanceMap.set(row.client_id, curr + Number(row.remaining_amount));
        });
      }

      for (const c of clients) {
        const latestLedgerDate = maxDateMap.get(c.id);
        const realBalance = Number((realActiveBalanceMap.get(c.id) || 0).toFixed(2));
        const updates: any = {};

        if (c.cashback_balance !== undefined && Math.abs(Number(c.cashback_balance) - realBalance) > 0.01) {
          updates.cashback_balance = realBalance;
          details.push(`Saldo Cashback Reconciliado: ${c.name} (R$ ${realBalance.toFixed(2)})`);
        }

        if (latestLedgerDate && (!c.last_purchase_date || new Date(latestLedgerDate) > new Date(c.last_purchase_date))) {
          const calcSpent = totalSpentMap.get(c.id) || Number(c.total_spent) || 0;
          const diffDays = Math.max(0, Math.floor((now.getTime() - new Date(latestLedgerDate).getTime()) / (1000 * 60 * 60 * 24)));
          const recencyScore = diffDays <= 7 ? 100 : diffDays <= 30 ? 80 : diffDays <= 60 ? 50 : 20;
          const leadScore = Math.min(100, Math.round(recencyScore * 0.6 + Math.min(40, calcSpent / 25)));

          reconciledCount++;
          details.push(`Data Reconciliada: ${c.name} (${new Date(latestLedgerDate).toLocaleDateString('pt-BR')})`);

          updates.last_purchase_date = latestLedgerDate;
          updates.lead_score = leadScore;
          updates.base_lead_score = leadScore;
        }

        if (Object.keys(updates).length > 0) {
          await supabase
            .from('clients')
            .update(updates)
            .eq('id', c.id);
        }
      }

      // 4. Reconciliação Geral de Atribuição de Conversões (sales_attribution)
      const interactions = await this.fetchAllPaginated('client_interactions', 'id, client_id, created_at', q => q.order('created_at', { ascending: false }));
      const existingAttributions = await this.fetchAllPaginated('sales_attribution', 'order_id');

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

          const orderDateClean = order.created_at ? order.created_at.replace(' ', '+') : new Date().toISOString();
          const orderTime = new Date(orderDateClean).getTime();

          const validInt = clientInts.find(int => {
            const intDateClean = int.created_at ? int.created_at.replace(' ', '+') : new Date().toISOString();
            const intTime = new Date(intDateClean).getTime();
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
        details: details.length > 0 ? details : ['Todas as vendas e conversões da base estão 100% reconciliadas.']
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
