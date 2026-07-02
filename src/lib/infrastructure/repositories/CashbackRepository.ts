import { supabaseAdmin } from '../../supabase';

export interface CashbackLedgerEntry {
  id?: string;
  tenant_id: string;
  client_id: string;
  order_id: string;
  original_amount: number;
  remaining_amount: number;
  status: 'PENDENTE' | 'ATIVO' | 'UTILIZADO' | 'EXPIRADO';
  created_at?: string;
  active_at?: string;
  expires_at?: string;
  used_on_order_id?: string;
  used_at?: string;
}

export class CashbackRepository {
  /**
   * Adiciona uma nova entrada de cashback (Nova Venda)
   */
  async addCashback(entry: CashbackLedgerEntry): Promise<void> {
    // Evita duplicidade verificando o order_id
    const { data: existing } = await supabaseAdmin
      .from('cashback_ledger')
      .select('id')
      .eq('order_id', entry.order_id)
      .eq('client_id', entry.client_id)
      .single();
      
    if (existing) {
      return; // Já existe, ignora
    }

    const { error } = await supabaseAdmin
      .from('cashback_ledger')
      .insert(entry);
    
    if (error) {
      console.error('Erro ao adicionar cashback:', error);
      throw new Error('Falha ao registrar cashback no ledger');
    }
  }

  /**
   * Verifica se um pedido já foi processado no ledger de cashback
   */
  async checkOrderExists(orderId: string): Promise<boolean> {
    const { data } = await supabaseAdmin
      .from('cashback_ledger')
      .select('id')
      .eq('order_id', orderId)
      .limit(1)
      .single();
    return !!data;
  }

  /**
   * Consome o cashback disponível (Regra FIFO)
   * Retorna true se conseguiu consumir todo o valor, false caso o saldo seja insuficiente
   */
  async consumeCashbackFIFO(tenantId: string, clientId: string, amountToConsume: number, orderId: string): Promise<boolean> {
    if (amountToConsume <= 0) return true;

    // Busca cashbacks ATIVOS, ordenados pelo vencimento mais próximo (FIFO)
    const { data: activeCashbacks, error } = await supabaseAdmin
      .from('cashback_ledger')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('client_id', clientId)
      .eq('status', 'ATIVO')
      .order('expires_at', { ascending: true });

    if (error) throw new Error('Falha ao buscar cashbacks ativos');
    
    let remainingToConsume = amountToConsume;

    for (const cashback of activeCashbacks) {
      if (remainingToConsume <= 0) break;

      const availableInThisEntry = cashback.remaining_amount;

      if (availableInThisEntry <= remainingToConsume) {
        // Consome tudo deste registro e marca como UTILIZADO
        await supabaseAdmin
          .from('cashback_ledger')
          .update({
            remaining_amount: 0,
            status: 'UTILIZADO',
            used_on_order_id: orderId,
            used_at: new Date().toISOString()
          })
          .eq('id', cashback.id);
        
        remainingToConsume -= availableInThisEntry;
      } else {
        // Consome parcialmente este registro
        const newRemaining = availableInThisEntry - remainingToConsume;
        await supabaseAdmin
          .from('cashback_ledger')
          .update({
            remaining_amount: newRemaining,
            used_on_order_id: orderId,
            used_at: new Date().toISOString()
          })
          .eq('id', cashback.id);
        
        remainingToConsume = 0;
      }
    }

    return remainingToConsume === 0;
  }

  /**
   * Calcula o Saldo Total Ativo de um cliente
   */
  async getActiveBalance(tenantId: string, clientId: string): Promise<number> {
    const { data, error } = await supabaseAdmin
      .from('cashback_ledger')
      .select('remaining_amount')
      .eq('tenant_id', tenantId)
      .eq('client_id', clientId)
      .eq('status', 'ATIVO');
      
    if (error || !data) return 0;
    return data.reduce((sum, item) => sum + Number(item.remaining_amount), 0);
  }

  /**
   * Registra um Alerta Gerencial
   */
  async createAlert(tenantId: string, clientId: string, orderId: string, alertType: string, message: string): Promise<void> {
    await supabaseAdmin
      .from('managerial_alerts')
      .insert({
        tenant_id: tenantId,
        client_id: clientId,
        order_id: orderId,
        alert_type: alertType,
        message: message
      });
  }

  /**
   * Retorna o extrato detalhado do cliente (Ledger)
   */
  async getClientLedger(tenantId: string, clientId: string): Promise<CashbackLedgerEntry[]> {
    const { data, error } = await supabaseAdmin
      .from('cashback_ledger')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('client_id', clientId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Erro ao buscar ledger:', error);
      return [];
    }
    return data as CashbackLedgerEntry[];
  }

  /**
   * Revoga (deleta) todos os cashbacks gerados por um pedido cancelado
   */
  async revokeCashback(tenantId: string, clientId: string, orderId: string): Promise<void> {
    const { error } = await supabaseAdmin
      .from('cashback_ledger')
      .delete()
      .eq('tenant_id', tenantId)
      .eq('client_id', clientId)
      .eq('order_id', orderId);

    if (error) {
      console.error('Erro ao revogar cashback:', error);
    }
  }
}
