// src/app/api/vendedor/stats-hoje/route.ts
// Retorna a contagem de mensagens enviadas hoje pelo vendedor logado considerando o fuso de Brasília (America/Sao_Paulo)

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

    // Obter data atual no fuso horário do Brasil (America/Sao_Paulo)
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });

    const parts = formatter.formatToParts(now);
    const partMap: Record<string, string> = {};
    parts.forEach(p => { partMap[p.type] = p.value; });

    const y = partMap.year;
    const m = partMap.month;
    const d = partMap.day;

    // Início do dia em Brasília: YYYY-MM-DDT00:00:00-03:00 convertido para ISO string
    // -03:00 significa 03:00:00 UTC
    const startOfDayBrasiliaISO = new Date(`${y}-${m}-${d}T00:00:00-03:00`).toISOString();

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
      timestamp: now.toISOString()
    });
  } catch (err: any) {
    console.error('Erro na API stats-hoje:', err);
    return NextResponse.json({ error: err.message || 'Erro interno' }, { status: 500 });
  }
}
