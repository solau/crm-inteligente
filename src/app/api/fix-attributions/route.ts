import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { InteractionRepository } from '@/lib/infrastructure/repositories/InteractionRepository';

export const maxDuration = 60; // 60s timeout limit

export async function GET(request: Request) {
  try {
    const interactionRepo = new InteractionRepository();
    
    // Pega todos os registros do cashback_ledger (representam pedidos válidos processados)
    const { data: cashbacks, error: cbError } = await supabaseAdmin
      .from('cashback_ledger')
      .select('*');

    if (cbError) throw cbError;
    if (!cashbacks || cashbacks.length === 0) {
      return NextResponse.json({ success: true, message: 'Nenhum cashback encontrado.' });
    }

    let fixCount = 0;
    const errors: any[] = [];

    for (const cb of cashbacks) {
      const orderId = cb.order_id;
      const clientId = cb.client_id;
      const tenantId = cb.tenant_id;
      const revenue = Number(cb.original_amount) * 10; // Já que cashback é 10%
      const saleDateStr = cb.created_at;

      // 1. Verifica se já existe atribuição
      const attributionExists = await interactionRepo.checkAttributionExists(orderId);
      
      if (!attributionExists) {
        // 2. Busca a interação mais recente nos últimos 15 dias antes da venda
        const lastInteraction = await interactionRepo.getLatestInteraction(clientId, saleDateStr);
        
        if (lastInteraction) {
          // 3. Cria a atribuição retroativa
          try {
            await interactionRepo.attributeSale(
              tenantId,
              lastInteraction.id,
              orderId,
              revenue
            );
            fixCount++;
          } catch (e: any) {
            errors.push({ orderId, error: e.message });
          }
        }
      }
    }

    return NextResponse.json({ 
      success: true, 
      message: `Conversões retroativas processadas com sucesso.`,
      fixed: fixCount,
      errors
    });

  } catch (error: any) {
    console.error('Erro na correção retroativa:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
