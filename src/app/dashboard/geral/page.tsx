import { createClient } from '@supabase/supabase-js';
import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { calculateRoiStats } from '@/lib/utils/roiLogic';
import { 
  Users, 
  UserPlus, 
  Wallet, 
  Activity, 
  Trophy, 
  Crown,
  TrendingUp,
  ArrowRight
} from 'lucide-react';
import Link from 'next/link';

export const revalidate = 0;

export default async function AdminDashboardPage() {
  const session = await getSession();
  
  if (!session || session.role !== 'ADMIN') {
    redirect('/');
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // 1. Total Histórico e LTV Médio e Saúde
  const { data: clientsData } = await supabase
    .from('clients')
    .select('id, created_at, total_spent, lead_score');

  const { count: totalClients } = await supabase
    .from('clients')
    .select('id', { count: 'exact', head: true });

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  
  const { count: newClients30d } = await supabase
    .from('clients')
    .select('id', { count: 'exact', head: true })
    .gte('created_at', thirtyDaysAgo.toISOString());

  let totalLtv = 0;
  let buyersCount = 0;
  let totalHealthScore = 0;

  if (clientsData) {
    for (const c of clientsData) {
      if (c.total_spent > 0) {
        totalLtv += Number(c.total_spent);
        buyersCount++;
      }
      totalHealthScore += Number(c.lead_score || 0);
    }
  }

  const avgLTV = buyersCount > 0 ? totalLtv / buyersCount : 0;
  const avgHealth = (totalClients || 0) > 0 ? (totalHealthScore / (totalClients || 1)).toFixed(0) : '0';

  // 2. Ranking Top 5 Clientes
  const { data: topClients } = await supabase
    .from('clients')
    .select('id, name, phone, total_spent, last_purchase_date')
    .order('total_spent', { ascending: false })
    .limit(5);

  // 3. Vendedor do Mês
  const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
  
  const { data: interactions } = await supabase
    .from('client_interactions')
    .select(`
      id,
      campaign_type,
      user_id,
      user_profiles ( name ),
      created_at,
      sales_attribution (
        id,
        revenue
      )
    `)
    .gte('created_at', startOfMonth);

  let bestSeller = { name: 'Sem vendas', revenue: 0, sales: 0 };
  
  if (interactions) {
    const { sellerStats } = calculateRoiStats(interactions);
    // Encontrar o melhor
    for (const [sellerName, stats] of Object.entries(sellerStats)) {
      if ((stats as any).revenue > bestSeller.revenue) {
        bestSeller = {
          name: sellerName,
          revenue: (stats as any).revenue,
          sales: (stats as any).sales
        };
      }
    }
  }

  // 4. Alertas Gerenciais (Descontos abusivos etc) a partir de 01/07/2026
  const { data: alerts } = await supabase
    .from('managerial_alerts')
    .select('id, created_at, order_id, message, resolved, clients(name)')
    .gte('created_at', '2026-07-01T00:00:00Z')
    .order('created_at', { ascending: false });

  const formatMoney = (val: number) => 
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">Visão Geral</h1>
          <p className="text-muted-foreground mt-1 text-sm md:text-base">Saúde e Crescimento da Carteira de Clientes.</p>
        </div>

        {/* 4 Cards Principais */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-card border border-border p-6 rounded-2xl shadow-sm hover:border-primary/50 transition-colors">
            <div className="flex justify-between items-start">
              <p className="text-sm font-medium text-muted-foreground">LTV Médio</p>
              <Wallet className="text-emerald-500 opacity-80" size={20} />
            </div>
            <h2 className="text-3xl font-black text-emerald-500 mt-2">{formatMoney(avgLTV)}</h2>
            <p className="text-xs text-muted-foreground mt-1">Por cliente pagante</p>
          </div>

          <div className="bg-card border border-border p-6 rounded-2xl shadow-sm hover:border-primary/50 transition-colors">
            <div className="flex justify-between items-start">
              <p className="text-sm font-medium text-muted-foreground">Novos Clientes</p>
              <UserPlus className="text-indigo-400 opacity-80" size={20} />
            </div>
            <h2 className="text-3xl font-bold mt-2">{newClients30d || 0}</h2>
            <p className="text-xs text-muted-foreground mt-1">Últimos 30 dias</p>
          </div>

          <div className="bg-card border border-border p-6 rounded-2xl shadow-sm hover:border-primary/50 transition-colors">
            <div className="flex justify-between items-start">
              <p className="text-sm font-medium text-muted-foreground">Base Histórica</p>
              <Users className="text-blue-400 opacity-80" size={20} />
            </div>
            <h2 className="text-3xl font-bold mt-2">{totalClients || 0}</h2>
            <p className="text-xs text-muted-foreground mt-1">Total de cadastros</p>
          </div>

          <div className="bg-card border border-border p-6 rounded-2xl shadow-sm hover:border-primary/50 transition-colors relative overflow-hidden">
            <div className="flex justify-between items-start relative z-10">
              <p className="text-sm font-medium text-muted-foreground">Score de Saúde</p>
              <Activity className="text-rose-400 opacity-80" size={20} />
            </div>
            <h2 className="text-3xl font-bold mt-2 relative z-10">{avgHealth} <span className="text-sm text-muted-foreground font-normal">/ 100</span></h2>
            <p className="text-xs text-muted-foreground mt-1 relative z-10">Média global</p>
            
            {/* Background decoration */}
            <div className="absolute -bottom-4 -right-4 text-rose-500/5">
              <Activity size={80} />
            </div>
          </div>
        </div>

        {/* Listas e Rankings */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Top 5 Clientes */}
          <div className="lg:col-span-2 bg-card border border-border rounded-2xl shadow-sm overflow-hidden flex flex-col">
            <div className="p-5 border-b border-border flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Trophy className="text-amber-500" size={20} />
                <h3 className="font-semibold text-lg">Ranking de Melhores Clientes</h3>
              </div>
              <Link href="/clientes" className="text-xs font-medium text-primary hover:underline flex items-center gap-1">
                Ver Todos <ArrowRight size={12} />
              </Link>
            </div>
            <div className="p-0 overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/30 text-muted-foreground">
                  <tr>
                    <th className="text-left py-3 px-5 font-medium">Posição</th>
                    <th className="text-left py-3 px-5 font-medium">Cliente</th>
                    <th className="text-left py-3 px-5 font-medium">Última Compra</th>
                    <th className="text-right py-3 px-5 font-medium">Total Gasto (LTV)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {topClients?.map((c, idx) => (
                    <tr key={idx} className="hover:bg-muted/10 transition-colors">
                      <td className="py-4 px-5">
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${idx === 0 ? 'bg-amber-500/20 text-amber-500' : idx === 1 ? 'bg-slate-300/20 text-slate-300' : idx === 2 ? 'bg-orange-700/20 text-orange-700' : 'bg-muted text-muted-foreground'}`}>
                          {idx + 1}
                        </div>
                      </td>
                      <td className="py-4 px-5 font-medium capitalize">
                        <Link href={`/clientes/${c.id}`} className="hover:underline text-foreground">
                          {c.name}
                        </Link>
                        {c.phone && <span className="block text-[10px] text-muted-foreground font-normal mt-0.5">{c.phone}</span>}
                      </td>
                      <td className="py-4 px-5 text-muted-foreground">
                        {c.last_purchase_date ? new Date(c.last_purchase_date).toLocaleDateString('pt-BR') : '-'}
                      </td>
                      <td className="py-4 px-5 text-right font-black text-emerald-500">
                        {formatMoney(Number(c.total_spent))}
                      </td>
                    </tr>
                  ))}
                  {(!topClients || topClients.length === 0) && (
                    <tr>
                      <td colSpan={4} className="py-8 text-center text-muted-foreground">Nenhum cliente com histórico de compras.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Vendedor do Mês */}
          <div className="bg-gradient-to-br from-amber-500/20 to-orange-600/5 border border-amber-500/20 rounded-2xl shadow-sm p-6 relative overflow-hidden flex flex-col items-center text-center">
            {/* Glow */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-32 bg-amber-500/20 blur-[50px] rounded-full pointer-events-none"></div>
            
            <div className="w-16 h-16 bg-amber-500/20 rounded-full flex items-center justify-center mb-4 relative z-10 border border-amber-500/30">
              <Crown className="text-amber-500" size={32} />
            </div>
            
            <h3 className="font-bold text-lg text-foreground relative z-10">Vendedor do Mês</h3>
            <p className="text-xs text-muted-foreground mb-6 relative z-10">Maior receita em {new Date().toLocaleString('pt-BR', { month: 'long' })}</p>

            <div className="flex-1 flex flex-col justify-center items-center w-full relative z-10">
              <p className="text-2xl font-black text-foreground capitalize mb-2">{bestSeller.name}</p>
              
              <div className="w-full bg-background/50 border border-border rounded-xl p-4 mt-4 backdrop-blur-sm">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs text-muted-foreground">Receita Gerada</span>
                  <TrendingUp className="text-emerald-500" size={14} />
                </div>
                <p className="text-xl font-black text-emerald-500 text-left">{formatMoney(bestSeller.revenue)}</p>
                <div className="mt-2 pt-2 border-t border-border flex justify-between items-center text-xs">
                  <span className="text-muted-foreground">Vendas Fechadas</span>
                  <span className="font-bold">{bestSeller.sales}</span>
                </div>
              </div>
            </div>
          </div>

        </div>

        {/* Section: Alertas Gerenciais */}
        {alerts && alerts.length > 0 && (
          <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden flex flex-col mt-6">
            <div className="p-4 border-b border-border bg-rose-500/5">
              <h3 className="font-semibold text-rose-500 flex items-center gap-2">
                <Activity size={18} />
                Alertas do Sistema (Descontos &gt; 20%)
              </h3>
            </div>
            <div className="p-0 overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/30 text-muted-foreground">
                  <tr>
                    <th className="text-left py-3 px-5 font-medium">Data</th>
                    <th className="text-left py-3 px-5 font-medium">Pedido</th>
                    <th className="text-left py-3 px-5 font-medium">Cliente</th>
                    <th className="text-left py-3 px-5 font-medium">Mensagem do Alerta</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {alerts.map((alert, idx) => (
                    <tr key={idx} className="hover:bg-muted/10 transition-colors">
                      <td className="py-3 px-5 whitespace-nowrap">{new Date(alert.created_at).toLocaleString('pt-BR')}</td>
                      <td className="py-3 px-5 font-bold">#{alert.order_id}</td>
                      <td className="py-3 px-5 font-medium capitalize">{(alert.clients as any)?.name || 'Desconhecido'}</td>
                      <td className="py-3 px-5 text-rose-500">{alert.message}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
