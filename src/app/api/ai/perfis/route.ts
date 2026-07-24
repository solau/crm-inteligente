import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { GeminiService } from '@/lib/services/GeminiService';
import { CustomerProfilingService } from '@/lib/services/CustomerProfilingService';

export const revalidate = 0;

export async function GET(request: Request) {
  try {
    const tenantId = 'd948b6cc-cc2c-4399-8525-02f17f281d38';

    // 1. Busca amostra dos clientes com maiores LTVs e compras recentes
    const { data: clients, error } = await supabaseAdmin
      .from('clients')
      .select('id, name, phone, last_purchase_date, total_spent, lead_score')
      .order('total_spent', { ascending: false })
      .limit(100);

    if (error || !clients) {
      return NextResponse.json({ error: 'Falha ao buscar base de clientes' }, { status: 500 });
    }

    const profiling = new CustomerProfilingService(tenantId);
    
    // Categoriza em memória
    let vips = 0;
    let fervendo = 0;
    let recorrentes = 0;
    let ausentes = 0;

    let vipsLtv = 0;
    let fervendoLtv = 0;
    let recorrentesLtv = 0;
    let ausentesLtv = 0;

    const now = new Date();

    clients.forEach(c => {
      const ltv = Number(c.total_spent) || 0;
      let recencyDays = 999;
      if (c.last_purchase_date) {
        recencyDays = Math.max(0, Math.floor((now.getTime() - new Date(c.last_purchase_date).getTime()) / (1000 * 60 * 60 * 24)));
      }

      if (ltv >= 800) {
        vips++;
        vipsLtv += ltv;
      } else if (recencyDays <= 7) {
        fervendo++;
        fervendoLtv += ltv;
      } else if (recencyDays <= 45) {
        recorrentes++;
        recorrentesLtv += ltv;
      } else {
        ausentes++;
        ausentesLtv += ltv;
      }
    });

    const total = clients.length || 1;

    const profileDistribution = [
      { category: '💎 VIPs / High LTV (LTV > R$ 800)', count: vips, percentage: Math.round((vips / total) * 100), avgLtv: vips > 0 ? Math.round(vipsLtv / vips) : 0 },
      { category: '🔥 Recém-Compradores (Ativos Fervendo <= 7d)', count: fervendo, percentage: Math.round((fervendo / total) * 100), avgLtv: fervendo > 0 ? Math.round(fervendoLtv / fervendo) : 0 },
      { category: '🎯 Recorrentes em Crescimento (8d a 45d)', count: recorrentes, percentage: Math.round((recorrentes / total) * 100), avgLtv: recorrentes > 0 ? Math.round(recorrentesLtv / recorrentes) : 0 },
      { category: '❄️ Ausentes para Reengajamento (> 45d)', count: ausentes, percentage: Math.round((ausentes / total) * 100), avgLtv: ausentes > 0 ? Math.round(ausentesLtv / ausentes) : 0 }
    ];

    // 2. Análise da IA Gemini
    const gemini = new GeminiService(tenantId);
    const aiReport = await gemini.generateStoreProfilesReport(clients);

    return NextResponse.json({
      success: true,
      totalAnalyzed: total,
      profileDistribution,
      aiReport
    });
  } catch (err: any) {
    console.error('Erro na API de perfis:', err);
    return NextResponse.json({ error: err.message || 'Erro ao gerar análise de perfis' }, { status: 500 });
  }
}
