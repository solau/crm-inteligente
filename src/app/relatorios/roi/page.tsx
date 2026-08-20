import { createClient } from '@supabase/supabase-js';
import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { Target, BrainCircuit, DollarSign, MessageSquare } from 'lucide-react';
import RoiAIAnalyzer from './RoiAIAnalyzer'; // Client component
import { calculateRoiStats } from '@/lib/utils/roiLogic';
import MonthFilter from './MonthFilter';

export const revalidate = 0;

export default async function RoiReportPage({
  searchParams,
}: {
  searchParams?: Promise<{ month?: string }>;
}) {
  const session = await getSession();
  const resolvedSearchParams = searchParams ? await searchParams : {};
  
  // Vendedores não têm acesso a este relatório financeiro/gerencial
  if (!session || session.role !== 'ADMIN') {
    redirect('/');
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const today = new Date();
  const currentMonthStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
  const selectedMonth = resolvedSearchParams.month || currentMonthStr;

  // Calcula início e fim do mês selecionado
  const [year, month] = selectedMonth.split('-');
  const startDate = new Date(Number(year), Number(month) - 1, 1);
  const endDate = new Date(Number(year), Number(month), 1); // 1º dia do mês seguinte

  // Busca todas as interações e suas vendas atribuídas no mês selecionado
  const { data: interactions, error } = await supabase
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
    .gte('created_at', startDate.toISOString())
    .lt('created_at', endDate.toISOString());

  if (error) {
    console.error('Erro ao buscar dados de ROI', error);
  }

  const {
    totalMessages,
    totalSales,
    totalRevenue,
    conversionRate,
    campaignStats,
    sellerStats
  } = calculateRoiStats(interactions || []);

  const formatMoney = (val: number) => 
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

  // Gera opções de meses (últimos 12 meses)
  const monthOptions = [];
  const tempDate = new Date();
  tempDate.setDate(1);
  for (let i = 0; i < 12; i++) {
    const v = `${tempDate.getFullYear()}-${String(tempDate.getMonth() + 1).padStart(2, '0')}`;
    const label = tempDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
    monthOptions.push({ value: v, label: label.charAt(0).toUpperCase() + label.slice(1) });
    tempDate.setMonth(tempDate.getMonth() - 1);
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">Relatório de ROI</h1>
            <p className="text-muted-foreground mt-1 text-sm md:text-base">Análise de conversão das mensagens enviadas pelos vendedores.</p>
          </div>
          
          <div className="flex items-center gap-4">
            <MonthFilter options={monthOptions} selectedMonth={selectedMonth} />
            <RoiAIAnalyzer 
              stats={{ totalMessages, totalSales, totalRevenue, conversionRate, campaignStats, sellerStats }} 
            />
          </div>
        </div>

        {/* Resumo Geral */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-card border border-border p-6 rounded-2xl shadow-sm">
            <div className="flex justify-between items-start">
              <p className="text-sm font-medium text-muted-foreground">Enviados no Mês</p>
              <MessageSquare className="text-primary opacity-50" size={20} />
            </div>
            <h2 className="text-3xl font-bold mt-2">{totalMessages}</h2>
          </div>
          <div className="bg-card border border-border p-6 rounded-2xl shadow-sm">
            <div className="flex justify-between items-start">
              <p className="text-sm font-medium text-muted-foreground">Vendas (Mês)</p>
              <Target className="text-emerald-500 opacity-50" size={20} />
            </div>
            <h2 className="text-3xl font-bold mt-2">{totalSales}</h2>
          </div>
          <div className="bg-card border border-border p-6 rounded-2xl shadow-sm">
            <div className="flex justify-between items-start">
              <p className="text-sm font-medium text-muted-foreground">Conversão (Mês)</p>
              <BrainCircuit className="text-indigo-500 opacity-50" size={20} />
            </div>
            <h2 className="text-3xl font-bold mt-2">{conversionRate}%</h2>
          </div>
          <div className="bg-card border border-border p-6 rounded-2xl shadow-sm bg-emerald-500/5">
            <div className="flex justify-between items-start">
              <p className="text-sm font-medium text-emerald-500">Receita Gerada</p>
              <DollarSign className="text-emerald-500" size={20} />
            </div>
            <h2 className="text-3xl font-black text-emerald-500 mt-2">{formatMoney(totalRevenue)}</h2>
          </div>
        </div>

        {/* Tabelas de Detalhamento */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          
          {/* Por Vendedor */}
          <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm flex flex-col col-span-1 md:col-span-2">
            <div className="p-4 bg-muted/30 border-b border-border flex justify-between items-center">
              <h3 className="font-semibold text-foreground">Performance por Vendedor / Atendente</h3>
              <span className="text-xs text-muted-foreground bg-muted px-2.5 py-1 rounded-full font-medium">
                {monthOptions.find(o => o.value === selectedMonth)?.label || selectedMonth}
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/10 text-muted-foreground">
                  {selectedMonth === currentMonthStr ? (
                    <tr>
                      <th className="text-left py-3 px-4 font-medium whitespace-nowrap">Atendente</th>
                      <th className="text-center py-3 px-4 font-medium">Hoje</th>
                      <th className="text-center py-3 px-4 font-medium">Últimos 7 Dias</th>
                      <th className="text-center py-3 px-4 font-medium">Total do Mês</th>
                      <th className="text-center py-3 px-4 font-medium">Conversão (Mês)</th>
                      <th className="text-right py-3 px-4 font-medium">Receita Gerada</th>
                    </tr>
                  ) : (
                    <tr>
                      <th className="text-left py-3 px-4 font-medium whitespace-nowrap">Atendente</th>
                      <th className="text-center py-3 px-4 font-medium">Msgs Enviadas</th>
                      <th className="text-center py-3 px-4 font-medium">Vendas Convertidas</th>
                      <th className="text-center py-3 px-4 font-medium">Taxa de Conversão</th>
                      <th className="text-right py-3 px-4 font-medium">Receita Gerada</th>
                    </tr>
                  )}
                </thead>
                <tbody className="divide-y divide-border">
                  {Object.entries(sellerStats).map(([seller, data]: any) => {
                    const isCurrentMonth = selectedMonth === currentMonthStr;
                    const atingiuMeta = data.msgsToday >= 30;
                    return (
                      <tr key={seller} className="hover:bg-muted/10 transition-colors">
                        <td className="py-3.5 px-4 font-medium capitalize whitespace-nowrap">
                          <div className="text-foreground font-semibold text-sm">{seller}</div>
                          {isCurrentMonth && (
                            <div className={`text-[11px] font-medium mt-0.5 ${atingiuMeta ? 'text-emerald-400' : 'text-zinc-400'}`}>
                              {data.msgsToday} / 30 msgs hoje
                            </div>
                          )}
                        </td>

                        {isCurrentMonth ? (
                          <>
                            <td className="py-3.5 px-4 text-center whitespace-nowrap">
                              <span className="font-bold text-foreground">{data.msgsToday}</span> <span className="text-xs text-muted-foreground">msgs</span> <br/>
                              <span className="text-emerald-400 font-semibold text-xs">{data.salesToday} vnd</span>
                            </td>
                            <td className="py-3.5 px-4 text-center whitespace-nowrap">
                              <span className="font-bold text-foreground">{data.msgsWeek}</span> <span className="text-xs text-muted-foreground">msgs</span> <br/>
                              <span className="text-emerald-400 font-semibold text-xs">{data.salesWeek} vnd</span> <span className="text-indigo-400 text-[11px]">({data.convRateWeek}%)</span>
                            </td>
                            <td className="py-3.5 px-4 text-center whitespace-nowrap">
                              <span className="font-bold text-foreground text-base">{data.msgs}</span> <span className="text-xs text-muted-foreground">msgs</span> <br/>
                              <span className="text-emerald-400 font-semibold text-xs">{data.sales} vnd</span>
                            </td>
                            <td className="py-3.5 px-4 text-center whitespace-nowrap">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold ${
                                Number(data.convRate) > 0 
                                  ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20' 
                                  : 'bg-zinc-800 text-zinc-400'
                              }`}>
                                {data.convRate}%
                              </span>
                            </td>
                            <td className="py-3.5 px-4 text-right font-bold whitespace-nowrap text-emerald-400 text-base">
                              {formatMoney(data.revenue)}
                            </td>
                          </>
                        ) : (
                          <>
                            <td className="py-3.5 px-4 text-center whitespace-nowrap">
                              <span className="font-bold text-foreground text-base">{data.msgs}</span>
                              <span className="text-xs text-muted-foreground ml-1">msgs</span>
                            </td>
                            <td className="py-3.5 px-4 text-center whitespace-nowrap">
                              <span className="text-emerald-400 font-bold text-base">{data.sales}</span>
                              <span className="text-xs text-muted-foreground ml-1">vendas</span>
                            </td>
                            <td className="py-3.5 px-4 text-center whitespace-nowrap">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold ${
                                Number(data.convRate) > 0 
                                  ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20' 
                                  : 'bg-zinc-800 text-zinc-400'
                              }`}>
                                {data.convRate}%
                              </span>
                            </td>
                            <td className="py-3.5 px-4 text-right font-bold whitespace-nowrap text-emerald-400 text-base">
                              {formatMoney(data.revenue)}
                            </td>
                          </>
                        )}
                      </tr>
                    );
                  })}
                  {Object.keys(sellerStats).length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-muted-foreground">Sem dados registrados no período selecionado.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Por Campanha */}
          <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm flex flex-col col-span-1 md:col-span-2">
            <div className="p-4 bg-muted/30 border-b border-border">
              <h3 className="font-semibold">Performance por Campanha</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/10 text-muted-foreground">
                  <tr>
                    <th className="text-left py-3 px-4 font-medium whitespace-nowrap">Campanha</th>
                    <th className="text-right py-3 px-4 font-medium">Msgs</th>
                    <th className="text-right py-3 px-4 font-medium">Vendas</th>
                    <th className="text-right py-3 px-4 font-medium">Receita</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {Object.entries(campaignStats).map(([campaign, data]: any) => (
                    <tr key={campaign} className="hover:bg-muted/10 transition-colors">
                      <td className="py-3 px-4 font-medium whitespace-nowrap">{campaign}</td>
                      <td className="py-3 px-4 text-right">{data.msgs}</td>
                      <td className="py-3 px-4 text-right text-emerald-500">{data.sales}</td>
                      <td className="py-3 px-4 text-right font-semibold whitespace-nowrap text-emerald-500">{formatMoney(data.revenue)}</td>
                    </tr>
                  ))}
                  {Object.keys(campaignStats).length === 0 && (
                    <tr>
                      <td colSpan={4} className="py-8 text-center text-muted-foreground">Sem dados registrados.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
