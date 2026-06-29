import { BlingProvider } from '../infrastructure/providers/BlingProvider';
import { ClientRepository } from '../infrastructure/repositories/ClientRepository';
import { CashbackRepository } from '../infrastructure/repositories/CashbackRepository';

export class SyncHistoricalDataUseCase {
  constructor(
    private blingProvider: BlingProvider,
    private clientRepository: ClientRepository,
    private cashbackRepository: CashbackRepository
  ) {}

  async execute(): Promise<{ success: boolean; count: number }> {
    const historicalOrders = await this.blingProvider.fetchHistoricalData();
    const tenantId = 'd948b6cc-cc2c-4399-8525-02f17f281d38';

    // Para evitar gargalos, processamos em sequência
    for (const order of historicalOrders) {
      // 1. Upsert Cliente (Telefone é a chave)
      let cliente = await this.clientRepository.getClientByPhone(order.telefone);
      
      if (!cliente) {
        cliente = await this.clientRepository.upsertClientByPhone({
          bling_id: order.bling_id,
          name: order.nome,
          phone: order.telefone,
          cashback_balance: 0,
          lead_score: 0,
          tenant_id: tenantId,
          last_purchase_date: null,
          total_spent: 0,
          base_lead_score: 0
        });
      }

      // 2. Lógica de Ledger Histórico
      // Ignora pedidos que não foram Atendidos (ID 9)
      if (order.situacao !== 9) {
        continue;
      }

      const totalVenda = order.total_gasto;
      const desconto = order.desconto;

      // Consome FIFO se houve desconto
      if (desconto > 0) {
        await this.cashbackRepository.consumeCashbackFIFO(tenantId, cliente.id!, desconto);
      }

      // Gera o novo Cashback
      const valorGerado = totalVenda * 0.10;
      
      const orderDate = new Date(order.data);
      const activeAt = new Date(orderDate);
      activeAt.setDate(activeAt.getDate() + 1); // Carência mudou de 7 para 1 dia
      const expiresAt = new Date(orderDate);
      expiresAt.setDate(expiresAt.getDate() + 45);

      let status: 'PENDENTE' | 'ATIVO' | 'EXPIRADO' = 'ATIVO';
      
      const now = new Date();
      if (now > expiresAt) {
        status = 'EXPIRADO';
      } else if (now < activeAt) {
        status = 'PENDENTE';
      }

      await this.cashbackRepository.addCashback({
        tenant_id: tenantId,
        client_id: cliente.id!,
        order_id: order.order_id,
        original_amount: valorGerado,
        remaining_amount: valorGerado,
        status: status,
        created_at: orderDate.toISOString(),
        active_at: activeAt.toISOString(),
        expires_at: expiresAt.toISOString()
      });

      // Recalcula o saldo Ativo atual do cliente
      const saldoRealAtivo = await this.cashbackRepository.getActiveBalance(tenantId, cliente.id!);
      
      // Atualização de RFM Base (Recência, Frequência, Valor)
      const novoTotalGasto = (Number(cliente.total_spent) || 0) + totalVenda;
      let novaDataUltimaCompra = cliente.last_purchase_date ? new Date(cliente.last_purchase_date) : orderDate;
      if (orderDate > novaDataUltimaCompra) {
        novaDataUltimaCompra = orderDate;
      }

      // Cálculo do RFM (Sem Decadência por enquanto, o Decay será diário)
      // +10 por compra, +1 a cada R$100
      let baseRFM = (cliente.base_lead_score || 0) + 10 + Math.floor(totalVenda / 100);
      baseRFM = Math.min(100, baseRFM); // Cap em 100
      
      const novoLeadScore = baseRFM; // O score visível será o mesmo do base logo após a compra (Recência = 0)

      await this.clientRepository.updateClient(cliente.id!, {
        cashback_balance: saldoRealAtivo,
        lead_score: novoLeadScore,
        base_lead_score: baseRFM,
        bling_id: order.bling_id,
        total_spent: novoTotalGasto,
        last_purchase_date: novaDataUltimaCompra.toISOString()
      });
    }

    return { success: true, count: historicalOrders.length };
  }
}
