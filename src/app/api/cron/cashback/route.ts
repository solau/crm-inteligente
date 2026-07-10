import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { CashbackRepository } from '@/lib/infrastructure/repositories/CashbackRepository';
import { ClientRepository } from '@/lib/infrastructure/repositories/ClientRepository';

export const maxDuration = 60; // Permite até 60s de execução na Vercel (Hobby/Pro)

// Rota protegida por secret para ser chamada pela Vercel Cron
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const secret = searchParams.get('secret');

  // Proteção básica (em produção usaríamos process.env.CRON_SECRET)
  if (secret !== 'alpha-bull-cron-secret-123') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const tenantId = 'd948b6cc-cc2c-4399-8525-02f17f281d38';
  const now = new Date().toISOString();

  try {
    const cashbackRepo = new CashbackRepository();
    const clientRepo = new ClientRepository(tenantId);
    const affectedClients = new Set<string>();

    // 1. Ativa cashbacks PENDENTES que passaram da carência (7 dias/24h)
    const { data: activated, error: errAtv } = await supabaseAdmin
      .from('cashback_ledger')
      .update({ status: 'ATIVO' })
      .eq('tenant_id', tenantId)
      .eq('status', 'PENDENTE')
      .lte('active_at', now)
      .select('client_id');
      
    if (errAtv) throw errAtv;
    activated?.forEach(c => affectedClients.add(c.client_id));

    // 2. Expira cashbacks ATIVOS que passaram da validade (45 dias)
    const { data: expired, error: errExp } = await supabaseAdmin
      .from('cashback_ledger')
      .update({ status: 'EXPIRADO' })
      .eq('tenant_id', tenantId)
      .eq('status', 'ATIVO')
      .lte('expires_at', now)
      .select('client_id');

    if (errExp) throw errExp;
    expired?.forEach(c => affectedClients.add(c.client_id));

    // 3. Apodrecimento (Decay) de Lead Score e Saldo de Cashback
    let updatedCount = 0;
    
    // Puxa todos os clientes para reavaliar score e saldo
    const { data: allClients, error: errClients } = await supabaseAdmin
      .from('clients')
      .select('id, base_lead_score, last_purchase_date')
      .eq('tenant_id', tenantId);

    if (errClients) throw errClients;

    if (allClients) {
      // Processa os clientes em lotes paralelos seguros (evita timeout da Vercel)
      const chunkSize = 10;
      for (let i = 0; i < allClients.length; i += chunkSize) {
        const chunk = allClients.slice(i, i + chunkSize);
        
        await Promise.all(chunk.map(async (client) => {
          // Só recalcula Saldo se ele teve cashbacks afetados agora
          let novoSaldo: number | undefined;
          if (affectedClients.has(client.id)) {
            novoSaldo = await cashbackRepo.getActiveBalance(tenantId, client.id);
          }
          
          // Recalcula Decadência (Decay) do Lead Score
          let penalty = 0;
          if (client.last_purchase_date) {
            const lastPurchase = new Date(client.last_purchase_date);
            const diffTime = Math.abs(new Date().getTime() - lastPurchase.getTime());
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            
            if (diffDays > 90) penalty = 70;
            else if (diffDays > 60) penalty = 40;
            else if (diffDays > 30) penalty = 20;
          }

          const baseScore = client.base_lead_score || 0;
          let novoLeadScore = baseScore - penalty;
          novoLeadScore = Math.max(0, Math.min(100, novoLeadScore));

          const updateData: any = { lead_score: novoLeadScore };
          if (novoSaldo !== undefined) {
            updateData.cashback_balance = novoSaldo;
          }

          await clientRepo.updateClient(client.id, updateData);
          updatedCount++;
        }));
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Rotina de cashback concluída com sucesso',
      activated_count: activated?.length || 0,
      expired_count: expired?.length || 0,
      clients_updated: updatedCount
    });

  } catch (error: any) {
    console.error('Erro no Cron Job de Cashback:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
