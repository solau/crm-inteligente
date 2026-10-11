// src/app/api/vendedor/stats-hoje/route.ts
// Retorna a contagem de mensagens enviadas hoje pelo vendedor logado considerando o fuso de Brasília (America/Sao_Paulo)

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getSession } from '@/lib/auth';
import { startOfTodayUTC } from '@/lib/utils/dateUtils';

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

    // Início do dia em Brasília (00:00:00-03:00) convertido para ISO UTC (ex: 03:00:00Z)
    const startOfDayBrasiliaISO = startOfTodayUTC();

    // Buscar mensagens enviadas pelo vendedor hoje (a partir de 00:00 de Brasília)
    const { count, error } = await supabase
      .from('client_interactions')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', session.id)
      .gte('created_at', startOfDayBrasiliaISO);

    if (error) {
      console.error('Erro ao buscar mensagens de hoje:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      sellerId: session.id,
      sellerName: session.name,
      msgsToday: count || 0,
      startOfDay: startOfDayBrasiliaISO,
      timestamp: new Date().toISOString()
    });
  } catch (err: any) {
    console.error('Erro na API stats-hoje:', err);
    return NextResponse.json({ error: err.message || 'Erro interno' }, { status: 500 });
  }
}
