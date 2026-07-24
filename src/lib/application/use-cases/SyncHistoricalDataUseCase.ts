import { BlingProvider } from '../../infrastructure/providers/BlingProvider';
import { ClientRepository } from '../../infrastructure/repositories/ClientRepository';
import { CashbackRepository } from '../../infrastructure/repositories/CashbackRepository';
import { KanbanRepository } from '../../infrastructure/repositories/KanbanRepository';
import { InteractionRepository } from '../../infrastructure/repositories/InteractionRepository';

export class SyncHistoricalDataUseCase {
  constructor(
    private blingProvider: BlingProvider,
    private clientRepository: ClientRepository,
    private cashbackRepository: CashbackRepository,
    private kanbanRepository?: KanbanRepository,
    private interactionRepository?: InteractionRepository
  ) {}

  async execute(): Promise<{ success: boolean; count: number }> {
    const historicalOrders = await this.blingProvider.fetchHistoricalData();
    const tenantId = 'd948b6cc-cc2c-4399-8525-02f17f281d38';

    const kanbanRepo = this.kanbanRepository || new KanbanRepository(tenantId);
    const interactionRepo = this.interactionRepository || new InteractionRepository();

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
          last_purchase_date: undefined,
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
        await this.cashbackRepository.consumeCashbackFIFO(tenantId, cliente.id!, desconto, order.order_id);
      }

      // Gera o novo Cashback
      const valorGerado = totalVenda * 0.10;
      
      const orderDate = new Date(order.data);
      const activeAt = new Date(orderDate);
      activeAt.setDate(activeAt.getDate() + 1); // Carência de 1 dia
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

      // Cálculo do RFM
      let baseRFM = (cliente.base_lead_score || 0) + 10 + Math.floor(totalVenda / 100);
      baseRFM = Math.min(100, baseRFM);
      const novoLeadScore = baseRFM;

      await this.clientRepository.updateClient(cliente.id!, {
        cashback_balance: saldoRealAtivo,
        lead_score: novoLeadScore,
        base_lead_score: baseRFM,
        bling_id: order.bling_id,
        total_spent: novoTotalGasto,
        last_purchase_date: novaDataUltimaCompra.toISOString()
      });

      // 3. Regra de Negócio: Movimentação para a Coluna 'Pós-Venda' no Kanban
      try {
        const columnId = await kanbanRepo.getOrCreateColumn('Pós-Venda', 99);
        await kanbanRepo.moveOrCreatePostSalesDeal(
          cliente.id!,
          columnId,
          'Acompanhamento Pós-Venda (Qualidade)',
          novoTotalGasto
        );
      } catch (err) {
        console.error('Erro ao mover card para Pós-Venda:', err);
      }

      // 4. Regra de Negócio: Atribuição de Conversão de Mensagem de WhatsApp
      try {
        const saleDateStr = orderDate.toISOString();
        const attributionExists = await interactionRepo.checkAttributionExists(order.order_id);
        if (!attributionExists) {
          const lastInteraction = await interactionRepo.getLatestInteraction(cliente.id!, saleDateStr);
          if (lastInteraction) {
            await interactionRepo.attributeSale(
              tenantId,
              lastInteraction.id,
              order.order_id,
              totalVenda,
              saleDateStr
            );
          }
        }
      } catch (err) {
        console.error('Erro ao atribuir conversão de venda:', err);
      }
    }

    return { success: true, count: historicalOrders.length };
  }
}
