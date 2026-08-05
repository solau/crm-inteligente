import { BlingProvider } from '@/lib/infrastructure/providers/BlingProvider';
import { ClientRepository } from '@/lib/infrastructure/repositories/ClientRepository';
import { KanbanRepository } from '@/lib/infrastructure/repositories/KanbanRepository';
import { CashbackRepository } from '@/lib/infrastructure/repositories/CashbackRepository';
import { GeminiService } from '@/lib/services/GeminiService';
import { InteractionRepository } from '@/lib/infrastructure/repositories/InteractionRepository';
import { ProcessBlingWebhookUseCase } from './ProcessBlingWebhookUseCase';
import { DataReconciliationAgent } from '@/lib/agents/DataReconciliationAgent';

export class SyncRecentOrdersUseCase {
  constructor(private tenantId: string = 'd948b6cc-cc2c-4399-8525-02f17f281d38') {}

  async execute(days: number = 3): Promise<{ syncedOrdersCount: number; reconciliationScore: number }> {
    console.log(`[SyncRecentOrdersUseCase] Iniciando sincronização e reconciliação dos últimos ${days} dias...`);

    const blingProvider = new BlingProvider(this.tenantId);
    const clientRepository = new ClientRepository(this.tenantId);
    const kanbanRepository = new KanbanRepository(this.tenantId);
    const cashbackRepository = new CashbackRepository();
    const geminiService = new GeminiService(this.tenantId);
    const interactionRepository = new InteractionRepository();

    const webhookUseCase = new ProcessBlingWebhookUseCase(
      clientRepository,
      kanbanRepository,
      geminiService,
      cashbackRepository,
      blingProvider,
      interactionRepository
    );

    // 1. Data inicial para busca no Bling (há 'days' dias atrás)
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    const dateStr = startDate.toISOString().split('T')[0];

    let syncedOrdersCount = 0;

    try {
      const token = await blingProvider.getValidToken();
      if (token) {
        // Busca pedidos de venda do Bling a partir da data inicial
        const res = await fetch(`https://www.bling.com.br/Api/v3/pedidos/vendas?dataInicial=${dateStr}&limite=100`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const json = await res.json();
        const pedidos = json?.data || [];

        console.log(`[SyncRecentOrdersUseCase] Encontrados ${pedidos.length} pedidos no Bling desde ${dateStr}`);

        for (const p of pedidos) {
          const rawOrderId = p.id?.toString();
          if (!rawOrderId) continue;

          // Processa via webhookUseCase (já possui idempotência via checkOrderExists e atualiza last_purchase_date)
          try {
            await webhookUseCase.execute({ data: { id: rawOrderId } }, this.tenantId);
            syncedOrdersCount++;
          } catch (err) {
            console.error(`[SyncRecentOrdersUseCase] Erro ao processar pedido ${rawOrderId}:`, err);
          }
        }
      }
    } catch (error) {
      console.error('[SyncRecentOrdersUseCase] Erro ao buscar pedidos recentes no Bling:', error);
    }

    // 2. Executa o agente de Reconciliação (corrige datas de clientes, atribuição de conversões e scores)
    const reconciliationAgent = new DataReconciliationAgent(this.tenantId);
    const reconciliationResult = await reconciliationAgent.runReconciliation();

    console.log(`[SyncRecentOrdersUseCase] Concluído! Pedidos processados: ${syncedOrdersCount}, Score de reconciliação: ${reconciliationResult.score}`);

    return {
      syncedOrdersCount,
      reconciliationScore: reconciliationResult.score
    };
  }
}
