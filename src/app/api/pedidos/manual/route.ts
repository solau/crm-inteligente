import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { CashbackRepository } from '@/lib/infrastructure/repositories/CashbackRepository';
import { ClientRepository } from '@/lib/infrastructure/repositories/ClientRepository';
import { KanbanRepository } from '@/lib/infrastructure/repositories/KanbanRepository';
import { InteractionRepository } from '@/lib/infrastructure/repositories/InteractionRepository';

export async function POST(request: Request) {
  try {
    const { clientId, totalValue, orderId, orderDate } = await request.json();
    const tenantId = 'd948b6cc-cc2c-4399-8525-02f17f281d38';

    if (!clientId || !totalValue || Number(totalValue) <= 0) {
      return NextResponse.json(
        { success: false, error: 'Selecione um cliente e informe um valor de venda válido.' },
        { status: 400 }
      );
    }

    const valorVenda = Number(totalValue);
    const saleOrderDate = orderDate ? new Date(orderDate) : new Date();
    const saleDateIso = saleOrderDate.toISOString();
    const generatedOrderId = orderId || `MANUAL-${Date.now()}`;

    const clientRepo = new ClientRepository(tenantId);
    const cashbackRepo = new CashbackRepository();
    const kanbanRepo = new KanbanRepository(tenantId);
    const interactionRepo = new InteractionRepository();

    // 1. Busca dados do cliente
    const { data: client, error: clientErr } = await supabaseAdmin
      .from('clients')
      .select('*')
      .eq('id', clientId)
      .single();

    if (clientErr || !client) {
      return NextResponse.json({ success: false, error: 'Cliente não encontrado.' }, { status: 404 });
    }

    // 2. Gera Cashback Ledger (10% de Cashback com 1 dia de carência e 45 dias de expiração)
    const valorCashback = valorVenda * 0.10;
    const activeAt = new Date(saleOrderDate);
    activeAt.setDate(activeAt.getDate() + 1);
    const expiresAt = new Date(saleOrderDate);
    expiresAt.setDate(expiresAt.getDate() + 45);

    await cashbackRepo.addCashback({
      tenant_id: tenantId,
      client_id: clientId,
      order_id: generatedOrderId,
      original_amount: valorCashback,
      remaining_amount: valorCashback,
      status: 'PENDENTE',
      created_at: saleDateIso,
      active_at: activeAt.toISOString(),
      expires_at: expiresAt.toISOString()
    });

    // 3. Atualiza Saldo de Cashback e Métricas do Cliente
    const novoSaldoAtivo = await cashbackRepo.getActiveBalance(tenantId, clientId);
    const novoTotalGasto = (Number(client.total_spent) || 0) + valorVenda;
    
    let baseRFM = (client.base_lead_score || 0) + 10 + Math.floor(valorVenda / 100);
    baseRFM = Math.min(100, baseRFM);

    await clientRepo.updateClient(clientId, {
      cashback_balance: novoSaldoAtivo,
      lead_score: baseRFM,
      base_lead_score: baseRFM,
      total_spent: novoTotalGasto,
      last_purchase_date: saleDateIso
    });

    // 4. Move ou cria card na Coluna 'Pós-Venda' no Kanban
    const posVendaColId = await kanbanRepo.getOrCreateColumn('Pós-Venda', 99);
    await kanbanRepo.moveOrCreatePostSalesDeal(
      clientId,
      posVendaColId,
      'Acompanhamento Pós-Venda (Qualidade)',
      valorVenda
    );

    // 5. Verifica e registra Atribuição de Venda ao WhatsApp se o cliente recebeu mensagem prévia
    const lastInteraction = await interactionRepo.getLatestInteraction(clientId, saleDateIso);
    if (lastInteraction) {
      await interactionRepo.attributeSale(
        tenantId,
        lastInteraction.id,
        generatedOrderId,
        valorVenda,
        saleDateIso
      );
    }

    return NextResponse.json({
      success: true,
      message: `Venda de R$ ${valorVenda.toFixed(2)} lançada com sucesso! Cliente movido para Pós-Venda.`,
      orderId: generatedOrderId,
      cashbackGenerated: valorCashback
    });
  } catch (error: any) {
    console.error('Erro ao lançar venda manual:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Falha ao registrar venda manual' },
      { status: 500 }
    );
  }
}
