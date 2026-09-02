// src/app/vendedor/desempenho/page.tsx
// Página de Desempenho do Vendedor Logado com Benchmark de Equipe

import { createClient } from '@supabase/supabase-js';
import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import MeuDesempenhoClient, { RawSellerInteraction, TeamMonthlySummary } from './MeuDesempenhoClient';

export const revalidate = 0; // Dados em tempo real

export default async function VendedorDesempenhoPage() {
  const session = await getSession();

  if (!session?.id) {
    redirect('/login');
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

  // 1. Buscar perfil atualizado do vendedor
  let sellerName = session.name || 'Vendedor';
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('name')
    .eq('id', session.id)
    .single();

  if (profile?.name) {
    sellerName = profile.name;
  }

  // 2. Buscar todas as interações para calcular dados do vendedor e média agregada da equipe
  const sellerInteractions: RawSellerInteraction[] = [];
  // Agregação por mês e por usuário para filtrar apenas ativos (> 50 msgs)
  const sellerMonthlyStats: Record<string, Record<string, { msgs: number; sales: number; revenue: number }>> = {};

  let from = 0;
  const step = 1000;
  let hasMore = true;

  while (hasMore) {
    const { data: batch, error } = await supabase
      .from('client_interactions')
      .select(`
        id,
        campaign_type,
        user_id,
        created_at,
        sales_attribution (
          id,
          revenue,
          order_id,
          created_at
        )
      `)
      .order('created_at', { ascending: false })
      .range(from, from + step - 1);

    if (error || !batch || batch.length === 0) break;

    for (const item of batch) {
      const monthKey = item.created_at.slice(0, 7); // YYYY-MM
      const hasSale = item.sales_attribution && item.sales_attribution.length > 0;
      const rev = hasSale ? item.sales_attribution!.reduce((acc: number, cur: any) => acc + Number(cur.revenue || 0), 0) : 0;

      // Agregação por usuário para benchmark da equipe
      if (item.user_id) {
        if (!sellerMonthlyStats[monthKey]) {
          sellerMonthlyStats[monthKey] = {};
        }
        if (!sellerMonthlyStats[monthKey][item.user_id]) {
          sellerMonthlyStats[monthKey][item.user_id] = { msgs: 0, sales: 0, revenue: 0 };
        }
        sellerMonthlyStats[monthKey][item.user_id].msgs++;
        if (hasSale) sellerMonthlyStats[monthKey][item.user_id].sales++;
        sellerMonthlyStats[monthKey][item.user_id].revenue += rev;
      }

      // Dados individuais do vendedor logado
      if (item.user_id === session.id) {
        sellerInteractions.push(item as unknown as RawSellerInteraction);
      }
    }

    if (batch.length < step) break;
    from += step;
  }

  // Montar objeto seguro de benchmark da equipe por mês considerando apenas usuários ativos (> 50 msgs)
  const teamMonthlySummary: Record<string, TeamMonthlySummary> = {};
  Object.keys(sellerMonthlyStats).forEach(m => {
    const allUsersInMonth = Object.values(sellerMonthlyStats[m]);

    // Regra: Para as médias da equipe, considerar apenas usuários ativos no mês que mandaram mais de 50 mensagens
    const activeUsers = allUsersInMonth.filter(u => u.msgs > 50);
    const pool = activeUsers.length > 0 ? activeUsers : allUsersInMonth.filter(u => u.msgs > 0);

    const activeSellersCount = Math.max(1, pool.length);
    const totalMsgs = pool.reduce((acc, u) => acc + u.msgs, 0);
    const totalSales = pool.reduce((acc, u) => acc + u.sales, 0);
    const totalRevenue = pool.reduce((acc, u) => acc + u.revenue, 0);

    const avgMsgsPerSeller = totalMsgs / activeSellersCount;
    const avgConvRate = totalMsgs > 0 ? (totalSales / totalMsgs) * 100 : 0;
    const avgRevenuePerSeller = totalRevenue / activeSellersCount;

    teamMonthlySummary[m] = {
      totalMsgs,
      totalSales,
      totalRevenue,
      activeSellersCount,
      avgMsgsPerSeller,
      avgConvRate,
      avgRevenuePerSeller
    };
  });

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-7xl mx-auto px-4 md:px-8 pt-6">
        <MeuDesempenhoClient
          sellerName={sellerName}
          sellerId={session.id}
          interactions={sellerInteractions}
          teamMonthlySummary={teamMonthlySummary}
        />
      </div>
    </div>
  );
}
