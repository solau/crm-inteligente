import { NextResponse } from 'next/server';
import { ProcessBlingWebhookUseCase } from '@/lib/application/use-cases/ProcessBlingWebhookUseCase';
import { ClientRepository } from '@/lib/infrastructure/repositories/ClientRepository';
import { KanbanRepository } from '@/lib/infrastructure/repositories/KanbanRepository';
import { CashbackRepository } from '@/lib/infrastructure/repositories/CashbackRepository';
import { GeminiService } from '@/lib/services/GeminiService';
import { BlingProvider } from '@/lib/infrastructure/providers/BlingProvider';

// Rota POST que o Bling chama quando um evento acontece (Ex: Pedido Faturado)
export async function POST(request: Request) {
  try {
    const payload = await request.json();
    
    // No mundo real, validaríamos a assinatura do webhook para garantir que veio do Bling.
    const tenantId = 'd948b6cc-cc2c-4399-8525-02f17f281d38'; // Tenant Hardcoded para o MVP

    // Instancia os Repositórios
    const clientRepository = new ClientRepository(tenantId);
    const kanbanRepository = new KanbanRepository(tenantId);
    const cashbackRepository = new CashbackRepository();
    const geminiService = new GeminiService(tenantId);
    const blingProvider = new BlingProvider(tenantId);
    
    // Processa a regra de negócios (Cashback, Score, Kanban)
    const useCase = new ProcessBlingWebhookUseCase(clientRepository, kanbanRepository, geminiService, cashbackRepository, blingProvider);
    await useCase.execute(payload);

    return NextResponse.json({ success: true, message: 'Webhook processado' });
  } catch (error) {
    console.error('Erro ao processar Webhook do Bling:', error);
    return NextResponse.json({ error: 'Falha ao processar' }, { status: 500 });
  }
}
