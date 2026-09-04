import { createClient } from '@supabase/supabase-js';
import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { calculateRoiStats } from '@/lib/utils/roiLogic';
import { formatDate, formatDateTime, formatMonthYear } from '@/lib/utils/dateUtils';
import { 
  Users, 
  UserPlus, 
  Wallet, 
  Activity, 
  Trophy, 
  Crown,
  TrendingUp,
  ArrowRight,
  BarChart3,
  ShoppingCart
} from 'lucide-react';
import Link from 'next/link';
import { RunJobButton } from '@/components/RunJobButton';

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
  const tenantId = 'd948b6cc-cc2c-4399-8525-02f17f281d38';

  // ─────────────────────────────────────────────────────────────
  // 1. MÉTRICAS AGREGADAS — sem trazer rows para o JS
  // ─────────────────────────────────────────────────────────────

  // Total de compradores reais e soma do LTV — via COUNT+SUM no banco
  const { data: ltvAgg } = await supabase
    .from('clients')
    .select('total_spent')
    .eq('tenant_id', tenantId)
    .neq('phone', '00000000000')
    .gt('total_spent', 0)
    .csv(); // força retorno compacto, mas usaremos rpc

  // Alternativa: buscar via paginação eficiente (não precisa todos os rows)
  // Usamos aggregate por RPC — como não temos RPC definido, fazemos em 2 queries leves:

  // a) Compradores reais: count de clientes com total_spent > 0 e phone != dummy
  const { count: buyersCount } = await supabase
    .from('clients')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .neq('phone', '00000000000')
    .gt('total_spent', 0);

  // b) LTV total: temos que somar — fazemos em páginas de 1000 (select só coluna numérica)
  let totalLTV = 0;
  let ltvFrom = 0;
  let ltvFetching = true;
  while (ltvFetching) {
    const { data: rows } = await supabase
      .from('clients')
      .select('total_spent')
      .eq('tenant_id', tenantId)
      .neq('phone', '00000000000')
      .gt('total_spent', 0)
      .range(ltvFrom, ltvFrom + 999);
    if (!rows || rows.length === 0) { ltvFetching = false; break; }
    totalLTV += rows.reduce((s, r) => s + Number(r.total_spent || 0), 0);
    ltvFrom += 1000;
    if (rows.length < 1000) ltvFetching = false;
  }
  const avgLTV = (buyersCount || 0) > 0 ? totalLTV / (buyersCount || 1) : 0;

  // ─────────────────────────────────────────────────────────────
  // 2. NOVOS COMPRADORES (30 dias): 1ª compra registrada no ledger
  // ─────────────────────────────────────────────────────────────
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const thirtyStr = thirtyDaysAgo.toISOString();

  // Pega client_ids com compra nos últimos 30d
  const { data: recentLedger } = await supabase
    .from('cashback_ledger')
    .select('client_id')
    .eq('tenant_id', tenantId)
    .gte('created_at', thirtyStr);
  
  const recentIds = [...new Set((recentLedger || []).map(r => r.client_id).filter(Boolean))];

  // Desses, conta quantos NÃO têm registro mais antigo (= são novos de verdade)
  let newClients30d = 0;
  if (recentIds.length > 0) {
    const { data: olderEntries } = await supabase
      .from('cashback_ledger')
      .select('client_id')
      .eq('tenant_id', tenantId)
      .lt('created_at', thirtyStr)
      .in('client_id', recentIds);
    
    const hasOlderPurchase = new Set((olderEntries || []).map(r => r.client_id));
    newClients30d = recentIds.filter(id => !hasOlderPurchase.has(id)).length;
  }

  // ─────────────────────────────────────────────────────────────
  // 3. SCORE DE SAÚDE: média do lead_score dos compradores ativos (90d)
  // ─────────────────────────────────────────────────────────────
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

  let totalHealthScore = 0;
  let recentBuyersCount = 0;
  let healthFrom = 0;
  let healthFetching = true;
  while (healthFetching) {
    const { data: rows } = await supabase
      .from('clients')
      .select('lead_score, last_purchase_date')
      .eq('tenant_id', tenantId)
      .neq('phone', '00000000000')
      .gt('total_spent', 0)
      .gte('last_purchase_date', ninetyDaysAgo.toISOString())
      .range(healthFrom, healthFrom + 999);
    if (!rows || rows.length === 0) { healthFetching = false; break; }
    totalHealthScore += rows.reduce((s, r) => s + Number(r.lead_score || 0), 0);
    recentBuyersCount += rows.length;
    healthFrom += 1000;
    if (rows.length < 1000) healthFetching = false;
  }
  const avgHealth = recentBuyersCount > 0 ? (totalHealthScore / recentBuyersCount).toFixed(0) : '0';

  // ─────────────────────────────────────────────────────────────
  // 4. HISTÓRICO MENSAL (12 meses) — pedidos e receita real do ledger
  // ─────────────────────────────────────────────────────────────
  const now = new Date();
  const monthlyHistory: { label: string; key: string; orders: number; cashback: number; revenue: number }[] = [];

  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const start = d.toISOString();
    const end = new Date(d.getFullYear(), d.getMonth() + 1, 1).toISOString();
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

    const { count: ordersCount } = await supabase
      .from('cashback_ledger')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .gte('created_at', start)
      .lt('created_at', end);

    // Busca soma do cashback gerado (original_amount) — cashback = 10% da receita de produtos
    const { data: cashbackRows } = await supabase
      .from('cashback_ledger')
      .select('original_amount')
      .eq('tenant_id', tenantId)
      .gte('created_at', start)
      .lt('created_at', end);

    const totalCashback = (cashbackRows || []).reduce((s, r) => s + Number(r.original_amount || 0), 0);
    const estimatedRevenue = totalCashback * 10; // cashback = 10% da base

    monthlyHistory.push({
      key,
      label: d.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo', month: 'short', year: '2-digit' }),
      orders: ordersCount || 0,
      cashback: totalCashback,
      revenue: estimatedRevenue,
    });
  }

  const maxRevenue = Math.max(...monthlyHistory.map(m => m.revenue), 1);

  // ─────────────────────────────────────────────────────────────
  // 5. TOP 5 CLIENTES
  // ─────────────────────────────────────────────────────────────
  const { data: topClients } = await supabase
    .from('clients')
    .select('id, name, phone, total_spent, last_purchase_date')
    .eq('tenant_id', tenantId)
    .neq('phone', '00000000000')
    .order('total_spent', { ascending: false })
    .limit(5);

  // ─────────────────────────────────────────────────────────────
  // 6. VENDEDOR DO MÊS
  // ─────────────────────────────────────────────────────────────
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  
  const { data: interactions } = await supabase
    .from('client_interactions')
    .select(`id, campaign_type, user_id, user_profiles ( name ), created_at, sales_attribution ( id, revenue )`)
    .eq('tenant_id', tenantId)
    .gte('created_at', startOfMonth);

  let bestSeller = { name: 'Sem vendas', revenue: 0, sales: 0 };
  if (interactions) {
    const { sellerStats } = calculateRoiStats(interactions);
    for (const [sellerName, stats] of Object.entries(sellerStats)) {
      if ((stats as any).revenue > bestSeller.revenue) {
        bestSeller = { name: sellerName, revenue: (stats as any).revenue, sales: (stats as any).sales };
      }
    }
  }

  // ─────────────────────────────────────────────────────────────
  // 7. ALERTAS GERENCIAIS
  // ─────────────────────────────────────────────────────────────
  const { data: alertsRaw } = await supabase
    .from('managerial_alerts')
    .select('id, created_at, order_id, message, resolved, clients(name)')
    .gte('created_at', '2026-07-01T00:00:00Z')
    .order('created_at', { ascending: false });
    
  const uniqueAlertsMap = new Map();
  alertsRaw?.forEach(alert => {
    if (!uniqueAlertsMap.has(alert.order_id)) uniqueAlertsMap.set(alert.order_id, alert);
  });
  const alerts = Array.from(uniqueAlertsMap.values());

  const formatMoney = (val: number) => 
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

  const formatK = (val: number) =>
    val >= 1000 ? `R$ ${(val / 1000).toFixed(0)}k` : `R$ ${val.toFixed(0)}`;

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">Visão Geral</h1>
            <p className="text-muted-foreground mt-1 text-sm md:text-base">Saúde e Crescimento da Carteira de Clientes.</p>
          </div>
          <RunJobButton />
        </div>

        {/* 4 Cards Principais */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-card border border-border p-6 rounded-2xl shadow-sm hover:border-primary/50 transition-colors">
            <div className="flex justify-between items-start">
              <p className="text-sm font-medium text-muted-foreground">LTV Médio</p>
              <Wallet className="text-emerald-500 opacity-80" size={20} />
            </div>
            <h2 className="text-3xl font-black text-emerald-500 mt-2">{formatMoney(avgLTV)}</h2>
            <p className="text-xs text-muted-foreground mt-1">{buyersCount?.toLocaleString('pt-BR')} compradores reais</p>
          </div>

          <div className="bg-card border border-border p-6 rounded-2xl shadow-sm hover:border-primary/50 transition-colors">
            <div className="flex justify-between items-start">
              <p className="text-sm font-medium text-muted-foreground">Novos Compradores</p>
              <UserPlus className="text-indigo-400 opacity-80" size={20} />
            </div>
            <h2 className="text-3xl font-bold mt-2">{newClients30d}</h2>
            <p className="text-xs text-muted-foreground mt-1">1ª compra nos últimos 30 dias</p>
          </div>

          <div className="bg-card border border-border p-6 rounded-2xl shadow-sm hover:border-primary/50 transition-colors">
            <div className="flex justify-between items-start">
              <p className="text-sm font-medium text-muted-foreground">Compradores Reais</p>
              <ShoppingCart className="text-blue-400 opacity-80" size={20} />
            </div>
            <h2 className="text-3xl font-bold mt-2">{(buyersCount || 0).toLocaleString('pt-BR')}</h2>
            <p className="text-xs text-muted-foreground mt-1">Base ativa com total_spent {'>'} 0</p>
          </div>

          <div className="bg-card border border-border p-6 rounded-2xl shadow-sm hover:border-primary/50 transition-colors relative overflow-hidden">
            <div className="flex justify-between items-start relative z-10">
              <p className="text-sm font-medium text-muted-foreground">Score de Saúde</p>
              <Activity className="text-rose-400 opacity-80" size={20} />
            </div>
            <h2 className="text-3xl font-bold mt-2 relative z-10">{avgHealth} <span className="text-sm text-muted-foreground font-normal">/ 100</span></h2>
            <p className="text-xs text-muted-foreground mt-1 relative z-10">Compradores ativos (90d)</p>
            <div className="absolute -bottom-4 -right-4 text-rose-500/5">
              <Activity size={80} />
            </div>
          </div>
        </div>

        {/* ── HISTÓRICO MENSAL ── */}
        <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
          <div className="p-5 border-b border-border flex justify-between items-center">
            <div className="flex items-center gap-2">
              <BarChart3 className="text-primary" size={20} />
              <h3 className="font-semibold text-lg">Histórico de Compras — Últimos 12 Meses</h3>
            </div>
            <span className="text-xs text-muted-foreground">Pedidos por mês • receita estimada (cashback × 10)</span>
          </div>
          <div className="p-6">
            {/* Barras */}
            <div className="flex items-end gap-2 h-40">
              {monthlyHistory.map((m, idx) => {
                const pct = maxRevenue > 0 ? (m.revenue / maxRevenue) * 100 : 0;
                const isCurrentMonth = idx === monthlyHistory.length - 1;
                return (
                  <div key={m.key} className="flex-1 flex flex-col items-center gap-1 group relative">
                    {/* Tooltip */}
                    <div className="absolute -top-14 left-1/2 -translate-x-1/2 bg-popover border border-border rounded-lg px-3 py-2 text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity z-10 pointer-events-none shadow-lg">
                      <p className="font-semibold text-foreground">{m.orders} pedidos</p>
                      <p className="text-emerald-500">{formatK(m.revenue)}</p>
                    </div>
                    {/* Barra */}
                    <div
                      className={`w-full rounded-t-sm transition-all ${isCurrentMonth ? 'bg-primary' : 'bg-muted-foreground/30 group-hover:bg-primary/60'}`}
                      style={{ height: `${Math.max(pct, 2)}%` }}
                    />
                    {/* Label */}
                    <span className={`text-[9px] font-medium ${isCurrentMonth ? 'text-primary' : 'text-muted-foreground'}`}>
                      {m.label}
                    </span>
                  </div>
                );
              })}
            </div>
            {/* Resumo linha */}
            <div className="mt-4 pt-4 border-t border-border grid grid-cols-3 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground text-xs">Total pedidos (12m)</p>
                <p className="font-bold text-foreground">{monthlyHistory.reduce((s, m) => s + m.orders, 0).toLocaleString('pt-BR')}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Receita estimada (12m)</p>
                <p className="font-bold text-emerald-500">{formatMoney(monthlyHistory.reduce((s, m) => s + m.revenue, 0))}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Mês com mais pedidos</p>
                <p className="font-bold text-foreground">
                  {monthlyHistory.reduce((best, m) => m.orders > best.orders ? m : best, monthlyHistory[0])?.label} 
                  {' '}
                  <span className="text-muted-foreground font-normal">
                    ({monthlyHistory.reduce((best, m) => m.orders > best.orders ? m : best, monthlyHistory[0])?.orders} pedidos)
                  </span>
                </p>
              </div>
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
                    <th className="text-left py-3 px-5 font-medium">Pos.</th>
                    <th className="text-left py-3 px-5 font-medium">Cliente</th>
                    <th className="text-left py-3 px-5 font-medium">Última Compra</th>
                    <th className="text-right py-3 px-5 font-medium">Total Gasto (LTV)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {topClients?.map((c, idx) => (
                    <tr key={c.id} className="hover:bg-muted/10 transition-colors">
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
                        {c.last_purchase_date ? formatDate(c.last_purchase_date) : '-'}
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
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-32 bg-amber-500/20 blur-[50px] rounded-full pointer-events-none"></div>
            
            <div className="w-16 h-16 bg-amber-500/20 rounded-full flex items-center justify-center mb-4 relative z-10 border border-amber-500/30">
              <Crown className="text-amber-500" size={32} />
            </div>
            
            <h3 className="font-bold text-lg text-foreground relative z-10">Vendedor do Mês</h3>
            <p className="text-xs text-muted-foreground mb-6 relative z-10">Maior receita em {formatMonthYear(new Date())}</p>

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
                      <td className="py-3 px-5 whitespace-nowrap">{formatDateTime(alert.created_at)}</td>
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
