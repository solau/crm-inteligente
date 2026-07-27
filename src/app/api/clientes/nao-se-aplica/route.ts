import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getSession } from '@/lib/auth';

export const revalidate = 0;

export async function GET() {
  try {
    const tenantId = 'd948b6cc-cc2c-4399-8525-02f17f281d38';

    // 1. Busca todas as interações do tipo NAO_SE_APLICA
    const { data: interactions, error: intErr } = await supabaseAdmin
      .from('client_interactions')
      .select('id, client_id, campaign_type, created_at, user_id')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false });

    if (intErr) {
      return NextResponse.json({ error: intErr.message }, { status: 500 });
    }

    // 2. Filtra os clientes cuja ÚLTIMA interação registrada foi NAO_SE_APLICA
    const latestMap = new Map<string, any>();
    (interactions || []).forEach(item => {
      if (!latestMap.has(item.client_id)) {
        latestMap.set(item.client_id, item);
      }
    });

    const ignoredClientIds: string[] = [];
    const metaMap = new Map<string, { date: string; userId: string }>();

    for (const [clientId, item] of latestMap.entries()) {
      if (item.campaign_type === 'NAO_SE_APLICA') {
        ignoredClientIds.push(clientId);
        metaMap.set(clientId, { date: item.created_at, userId: item.user_id });
      }
    }

    if (ignoredClientIds.length === 0) {
      return NextResponse.json({ success: true, clients: [] });
    }

    // 3. Busca os dados dos clientes ignorados e os nomes dos usuários que efetuaram a marcação
    const { data: clients, error: cErr } = await supabaseAdmin
      .from('clients')
      .select('id, name, phone, email, last_purchase_date, total_spent, lead_score')
      .in('id', ignoredClientIds);

    if (cErr) {
      return NextResponse.json({ error: cErr.message }, { status: 500 });
    }

    const { data: profiles } = await supabaseAdmin
      .from('user_profiles')
      .select('id, name');

    const profileMap = new Map<string, string>();
    (profiles || []).forEach(p => profileMap.set(p.id, p.name));
    
    // Mapeamento de IDs legados
    profileMap.set('admin-1', 'Jorge');
    profileMap.set('vend-1', 'Alane');
    profileMap.set('vend-2', 'Harley');
    profileMap.set('vend-3', 'Ycla');

    const result = (clients || []).map(c => {
      const meta = metaMap.get(c.id);
      const userName = meta?.userId ? (profileMap.get(meta.userId) || 'Atendente') : 'Sistema';
      return {
        ...c,
        flaggedAt: meta?.date || new Date().toISOString(),
        flaggedBy: userName
      };
    });

    return NextResponse.json({
      success: true,
      count: result.length,
      clients: result
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Erro ao buscar clientes ignorados' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getSession();
    const tenantId = 'd948b6cc-cc2c-4399-8525-02f17f281d38';
    const { clientId, action = 'ignore', reason = 'Não se aplica' } = await req.json();

    if (!clientId) {
      return NextResponse.json({ error: 'clientId é obrigatório' }, { status: 400 });
    }

    if (action === 'ignore') {
      // Registra interação de NAO_SE_APLICA
      const { error } = await supabaseAdmin
        .from('client_interactions')
        .insert({
          tenant_id: tenantId,
          client_id: clientId,
          campaign_type: 'NAO_SE_APLICA',
          user_id: session?.id || null
        });

      if (error) {
        console.error('Erro ao inserir NAO_SE_APLICA:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        message: 'Cliente marcado como "Não se aplica" e removido do Kanban com sucesso!'
      });
    }

    if (action === 'reactivate') {
      // Registra interação de REATIVADO para cancelar o NAO_SE_APLICA
      const { error } = await supabaseAdmin
        .from('client_interactions')
        .insert({
          tenant_id: tenantId,
          client_id: clientId,
          campaign_type: 'REATIVADO',
          channel: 'SYSTEM',
          status: 'DELIVERED',
          user_id: session?.id || null
        });

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        message: 'Cliente reativado com sucesso e restaurado no Kanban de vendas!'
      });
    }

    return NextResponse.json({ error: 'Ação inválida' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Erro ao processar solicitação' }, { status: 500 });
  }
}
