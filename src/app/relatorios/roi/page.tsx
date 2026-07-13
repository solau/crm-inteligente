import { createClient } from '@supabase/supabase-js';
import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { Target, BrainCircuit, DollarSign, MessageSquare } from 'lucide-react';
import RoiAIAnalyzer from './RoiAIAnalyzer'; // Client component
import { calculateRoiStats } from '@/lib/utils/roiLogic';

export const revalidate = 0;

export default async function RoiReportPage() {
  const session = await getSession();
  
  // Vendedores não têm acesso a este relatório financeiro/gerencial
  if (!session || session.role !== 'ADMIN') {
    redirect('/');
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Busca todas as interações e suas vendas atribuídas
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
    `);

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

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">Relatório de ROI</h1>
            <p className="text-muted-foreground mt-1 text-sm md:text-base">Análise de conversão das mensagens enviadas pelos vendedores.</p>
          </div>
          
          <RoiAIAnalyzer 
            stats={{ totalMessages, totalSales, totalRevenue, conversionRate, campaignStats, sellerStats }} 
          />
        </div>

        {/* Resumo Geral */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-card border border-border p-6 rounded-2xl shadow-sm">
            <div className="flex justify-between items-start">
              <p className="text-sm font-medium text-muted-foreground">Mensagens Enviadas</p>
              <MessageSquare className="text-primary opacity-50" size={20} />
            </div>
            <h2 className="text-3xl font-bold mt-2">{totalMessages}</h2>
          </div>
          <div className="bg-card border border-border p-6 rounded-2xl shadow-sm">
            <div className="flex justify-between items-start">
              <p className="text-sm font-medium text-muted-foreground">Vendas Convertidas</p>
              <Target className="text-emerald-500 opacity-50" size={20} />
            </div>
            <h2 className="text-3xl font-bold mt-2">{totalSales}</h2>
          </div>
          <div className="bg-card border border-border p-6 rounded-2xl shadow-sm">
            <div className="flex justify-between items-start">
              <p className="text-sm font-medium text-muted-foreground">Taxa de Conversão</p>
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
            <div className="p-4 bg-muted/30 border-b border-border">
              <h3 className="font-semibold">Performance por Vendedor (Meta Diária: 30 msgs)</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/10 text-muted-foreground">
                  <tr>
                    <th className="text-left py-3 px-4 font-medium whitespace-nowrap">Vendedor</th>
                    <th className="text-center py-3 px-4 font-medium">Msgs (Hoje)</th>
                    <th className="text-center py-3 px-4 font-medium">Msgs (7 Dias)</th>
                    <th className="text-center py-3 px-4 font-medium">Msgs (Mês)</th>
                    <th className="text-right py-3 px-4 font-medium">Vendas (Total)</th>
                    <th className="text-right py-3 px-4 font-medium">Receita (Total)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {Object.entries(sellerStats).map(([seller, data]: any) => {
                    const atingiuMeta = data.msgsToday >= 30;
                    return (
                      <tr key={seller} className="hover:bg-muted/10 transition-colors">
                        <td className="py-3 px-4 font-medium capitalize whitespace-nowrap">{seller}</td>
                        <td className="py-3 px-4 text-center">
                          <span className={`px-2 py-1 rounded-full text-xs font-bold ${atingiuMeta ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'}`}>
                            {data.msgsToday} / 30
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center">{data.msgsWeek}</td>
                        <td className="py-3 px-4 text-center">{data.msgsMonth}</td>
                        <td className="py-3 px-4 text-right text-emerald-500 font-semibold">{data.sales}</td>
                        <td className="py-3 px-4 text-right font-semibold whitespace-nowrap">{formatMoney(data.revenue)}</td>
                      </tr>
                    );
                  })}
                  {Object.keys(sellerStats).length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-muted-foreground">Sem dados registrados.</td>
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
                      <td className="py-3 px-4 text-right font-semibold whitespace-nowrap">{formatMoney(data.revenue)}</td>
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
