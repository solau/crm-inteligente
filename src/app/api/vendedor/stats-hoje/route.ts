// src/app/api/vendedor/stats-hoje/route.ts
// Retorna a contagem de mensagens enviadas hoje pelo vendedor logado para o monitor horário

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getSession } from '@/lib/auth';

export async function GET() {
  try {
    const session = await getSession();
    if (!session?.id) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        global: {
          fetch: (url, options) => fetch(url, { ...options, cache: 'no-store' })
        }
      }
    );

    // Início do dia atual (00:00:00 local)
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}T00:00:00.000Z`;

    // Buscar mensagens enviadas pelo vendedor hoje
    const { count, error } = await supabase
      .from('client_interactions')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', session.id)
      .gte('created_at', todayStr);

    if (error) {
      console.error('Erro ao buscar mensagens de hoje:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      sellerId: session.id,
      sellerName: session.name,
      msgsToday: count || 0,
      timestamp: now.toISOString()
    });
  } catch (err: any) {
    console.error('Erro na API stats-hoje:', err);
    return NextResponse.json({ error: err.message || 'Erro interno' }, { status: 500 });
  }
}
