import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { GeminiService } from '@/lib/services/GeminiService';
import { BlingProvider } from '@/lib/infrastructure/providers/BlingProvider';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params;
    const clientId = resolvedParams.id;
    const tenantId = 'd948b6cc-cc2c-4399-8525-02f17f281d38';

    // 1. Busca os dados do cliente
    const { data: client, error } = await supabaseAdmin
      .from('clients')
      .select('*')
      .eq('id', clientId)
      .eq('tenant_id', tenantId)
      .single();

    if (error || !client) {
      return NextResponse.json({ error: 'Cliente não encontrado' }, { status: 404 });
    }

    // 2. Busca histórico do Bling
    let extratoPedidos: any[] = [];
    let stockMap: Record<string, number> = {};
    if (client.bling_id) {
      const bling = new BlingProvider(tenantId);
      extratoPedidos = await bling.getClientStatement(client.bling_id);
      
      // Extrair os produtos mais recentes para checar o estoque
      const productIds = new Set<string>();
      extratoPedidos.slice(0, 10).forEach(pedido => {
        if (pedido.itens) {
          pedido.itens.forEach((i: any) => {
            const prodId = i.produto?.id || i.item?.produto?.id;
            if (prodId) productIds.add(prodId.toString());
          });
        }
      });
      
      if (productIds.size > 0) {
        stockMap = await bling.fetchProductStock(Array.from(productIds));
      }
    }

    // 3. Roda a IA do Gemini
    const geminiService = new GeminiService(tenantId);
    const dossieTexto = await geminiService.generateDossieTatico(client, extratoPedidos, stockMap);

    // 4. Salva no banco de dados no campo 'preferences' (que serve de cache para IA)
    await supabaseAdmin
      .from('clients')
      .update({ preferences: dossieTexto })
      .eq('id', clientId);

    return NextResponse.json({ dossier: dossieTexto });

  } catch (error: any) {
    console.error("Erro na rota do dossiê:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
