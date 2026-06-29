import { NextResponse } from 'next/server';
import { ClientRepository } from '@/lib/infrastructure/repositories/ClientRepository';
import { KanbanRepository } from '@/lib/infrastructure/repositories/KanbanRepository';
import { CashbackRepository } from '@/lib/infrastructure/repositories/CashbackRepository';
import { GeminiService } from '@/lib/services/GeminiService';
import { BlingProvider } from '@/lib/infrastructure/providers/BlingProvider';
import { ProcessBlingWebhookUseCase } from '@/lib/application/use-cases/ProcessBlingWebhookUseCase';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const clientId = (await params).id;
    const tenantId = 'd948b6cc-cc2c-4399-8525-02f17f281d38'; // Tenant Hardcoded para o MVP

    const clientRepository = new ClientRepository(tenantId);
    const kanbanRepository = new KanbanRepository(tenantId);
    const cashbackRepository = new CashbackRepository();
    const geminiService = new GeminiService(tenantId);
    const blingProvider = new BlingProvider(tenantId);

    // 1. Busca o cliente no nosso banco de dados
    const client = await clientRepository.getClientById(clientId);
    if (!client) {
      return NextResponse.json({ error: 'Cliente não encontrado no CRM' }, { status: 404 });
    }

    let blingId = client.bling_id;

    // 2. Se o cliente não tem bling_id, busca na API de contatos do Bling pelo telefone
    if (!blingId) {
      if (!client.phone) {
        return NextResponse.json({ error: 'Cliente sem telefone e sem ID do Bling' }, { status: 400 });
      }

      console.log(`Buscando bling_id para o telefone ${client.phone}...`);
      const blingContact = await blingProvider.getContactByPhone(client.phone);
      
      if (blingContact && blingContact.id) {
        blingId = blingContact.id.toString();
        // Atualiza no nosso banco para não precisar buscar novamente no futuro
        await clientRepository.updateClient(clientId, { bling_id: blingId });
        console.log(`Bling ID atualizado para o cliente: ${blingId}`);
      } else {
        return NextResponse.json({ error: 'Cliente não encontrado no Bling com este telefone' }, { status: 404 });
      }
    }

    // 3. Busca todos os pedidos do cliente no Bling
    console.log(`Buscando pedidos para o contato ${blingId}...`);
    const orders = await blingProvider.getOrdersByContactId(blingId as string);
    
    // Filtra os pedidos que estão com situação "Atendido" (9) ou outras situações de venda ativa (6, 15, 24)
    const useCase = new ProcessBlingWebhookUseCase(clientRepository, kanbanRepository, geminiService, cashbackRepository, blingProvider);

    let processedCount = 0;

    for (const order of orders) {
      if (order.situacao && [6, 9, 15, 24].includes(order.situacao.id)) {
        const orderId = order.id.toString();
        
        // Verifica se o cashback já foi gerado para esse pedido (evita dupla inserção)
        const isDuplicated = await cashbackRepository.checkOrderExists(orderId);
        if (isDuplicated) {
          console.log(`Pedido ${orderId} já processado anteriormente.`);
          continue;
        }

        console.log(`Processando pedido histórico faltante: ${orderId}`);
        // Força a execução usando o formato fake de payload
        const payload = { data: { id: orderId } };
        await useCase.execute(payload, tenantId);
        processedCount++;
      }
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Sincronização finalizada com sucesso',
      processed: processedCount
    });

  } catch (error) {
    console.error('Erro na sincronização manual:', error);
    return NextResponse.json({ error: 'Erro ao sincronizar cliente' }, { status: 500 });
  }
}
