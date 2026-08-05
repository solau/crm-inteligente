import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { BlingProvider } from '@/lib/infrastructure/providers/BlingProvider';
import { ClientRepository } from '@/lib/infrastructure/repositories/ClientRepository';
import { KanbanRepository } from '@/lib/infrastructure/repositories/KanbanRepository';
import { CashbackRepository } from '@/lib/infrastructure/repositories/CashbackRepository';
import { GeminiService } from '@/lib/services/GeminiService';
import { ProcessBlingWebhookUseCase } from '@/lib/application/use-cases/ProcessBlingWebhookUseCase';
import { InteractionRepository } from '@/lib/infrastructure/repositories/InteractionRepository';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const clientId = (await params).id;
    const tenantId = 'd948b6cc-cc2c-4399-8525-02f17f281d38';

    // 1. Busca o cliente no CRM
    const { data: client, error } = await supabaseAdmin
      .from('clients')
      .select('*')
      .eq('id', clientId)
      .eq('tenant_id', tenantId)
      .single();

    if (error || !client) {
      return NextResponse.json({ error: 'Cliente não encontrado' }, { status: 404 });
    }

    const blingProvider = new BlingProvider(tenantId);
    const token = await blingProvider.getValidToken();

    let blingId = client.bling_id;
    if (!blingId) {
      const contact = client.phone ? await blingProvider.getContactByPhone(client.phone) : null;
      if (contact && contact.id) {
        blingId = contact.id.toString();
        await supabaseAdmin.from('clients').update({ bling_id: blingId }).eq('id', clientId);
      }
    }

    let ordersFromBling: any[] = [];
    if (token && blingId) {
      ordersFromBling = await blingProvider.getOrdersByContactId(blingId);
      ordersFromBling.sort((a, b) => new Date(a.data).getTime() - new Date(b.data).getTime());

      // 2. Processa e importa qualquer pedido faltante do Bling para este cliente
      const clientRepository = new ClientRepository(tenantId);
      const kanbanRepository = new KanbanRepository(tenantId);
      const cashbackRepository = new CashbackRepository();
      const geminiService = new GeminiService(tenantId);
      const interactionRepository = new InteractionRepository();

      const webhookUseCase = new ProcessBlingWebhookUseCase(
        clientRepository,
        kanbanRepository,
        geminiService,
        cashbackRepository,
        blingProvider,
        interactionRepository
      );

      for (const order of ordersFromBling) {
        if (order.situacao && [6, 9, 15, 24].includes(order.situacao.id)) {
          const orderId = order.id.toString();
          const isDuplicated = await cashbackRepository.checkOrderExists(orderId);
          if (!isDuplicated) {
            await webhookUseCase.execute({ data: { id: orderId } }, tenantId);
          }
        }
      }
    }

    // 3. Carrega todos os lançamentos atualizados de cashback_ledger deste cliente
    const { data: ledgerEntries } = await supabaseAdmin
      .from('cashback_ledger')
      .select('*')
      .eq('client_id', clientId)
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: true });

    let exactLtv = 0;
    const blingOrdersMap = new Map();

    for (const p of ordersFromBling) {
      try {
        const detailJson = await blingProvider.getOrderById(p.id.toString());
        if (detailJson) {
          const totalProdutos = Number(detailJson.totalProdutos) || 0;
          const frete = Number(detailJson.transporte?.frete) || 0;
          const outrasDespesas = Number(detailJson.outrasDespesas) || 0;
          const total = Number(detailJson.total) || 0;
          const descontoOficial = Number(detailJson.desconto?.valor) || 0;

          exactLtv += total;

          const bruto = totalProdutos + frete + outrasDespesas;
          let descontoCalculado = 0;
          if (bruto > total) descontoCalculado = bruto - total;
          else if (descontoOficial > 0) descontoCalculado = descontoOficial;

          descontoCalculado = Number(descontoCalculado.toFixed(2));

          const baseProdutos = totalProdutos > 0 ? totalProdutos : Math.max(0, total - frete);
          const baseCashback = Math.max(0, baseProdutos - descontoCalculado);
          const cashbackGerado = Number((baseCashback * 0.10).toFixed(2));

          blingOrdersMap.set(p.id.toString(), {
            totalPago: total,
            desconto: descontoCalculado,
            cashbackGerado
          });
        }
      } catch (e) {}
    }

    const now = new Date();
    const currentLedger = ledgerEntries || [];

    // Recalcula o estado do Ledger com a regra: 10% de (totalProdutos - desconto) + deduções FIFO + validade real de 45 dias
    let clientLedgerState = currentLedger.map((e: any) => {
      const blingInfo = blingOrdersMap.get(e.order_id);
      const newOriginal = blingInfo ? blingInfo.cashbackGerado : Number(e.original_amount) || 0;
      const createdDate = new Date(e.created_at);
      const realExpiresAt = new Date(createdDate.getTime() + 45 * 24 * 60 * 60 * 1000);

      return {
        id: e.id,
        order_id: e.order_id,
        original_amount: newOriginal,
        remaining_amount: newOriginal,
        status: 'ATIVO',
        created_at: createdDate,
        expires_at: realExpiresAt
      };
    });

    for (let i = 0; i < clientLedgerState.length; i++) {
      const entry = clientLedgerState[i];

      if (entry.expires_at <= now) {
        entry.status = 'EXPIRADO';
        entry.remaining_amount = 0;
      }

      const blingInfo = blingOrdersMap.get(entry.order_id);
      const discount = blingInfo ? blingInfo.desconto : 0;

      if (discount > 0.05) {
        let amountToAbate = discount;

        for (let j = 0; j < i; j++) {
          const prior = clientLedgerState[j];
          if (prior.expires_at >= entry.created_at && prior.remaining_amount > 0) {
            const abate = Math.min(prior.remaining_amount, amountToAbate);
            prior.remaining_amount = Number((prior.remaining_amount - abate).toFixed(2));
            amountToAbate = Number((amountToAbate - abate).toFixed(2));

            if (prior.remaining_amount <= 0) {
              prior.remaining_amount = 0;
              prior.status = 'UTILIZADO';
            }

            if (amountToAbate <= 0) break;
          }
        }
      }
    }

    let realActiveBalance = 0;
    for (let i = 0; i < clientLedgerState.length; i++) {
      const state = clientLedgerState[i];

      if (state.expires_at <= now) {
        state.status = 'EXPIRADO';
        state.remaining_amount = 0;
      }

      if (state.status === 'ATIVO') {
        realActiveBalance += state.remaining_amount;
      }

      await supabaseAdmin
        .from('cashback_ledger')
        .update({
          original_amount: state.original_amount,
          remaining_amount: state.remaining_amount,
          expires_at: state.expires_at.toISOString(),
          status: state.status
        })
        .eq('id', state.id);
    }

    realActiveBalance = Number(realActiveBalance.toFixed(2));
    const finalLtv = exactLtv > 0 ? Number(exactLtv.toFixed(2)) : Number(client.total_spent) || 0;

    await supabaseAdmin
      .from('clients')
      .update({
        cashback_balance: realActiveBalance,
        total_spent: finalLtv
      })
      .eq('id', clientId);

    return NextResponse.json({
      success: true,
      message: 'Pedidos sincronizados e Cashback auditado com sucesso!',
      cashback_balance: realActiveBalance,
      total_spent: finalLtv
    });
  } catch (err: any) {
    console.error('Erro na reconciliação de cashback do cliente:', err);
    return NextResponse.json({ error: 'Erro ao revisar cashback' }, { status: 500 });
  }
}
