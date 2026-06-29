import { BarChart3, TrendingUp, Users, DollarSign, BrainCircuit, ArrowUpRight, MessageSquareText, Trophy } from 'lucide-react';
import { supabaseAdmin } from '@/lib/supabase';
import Link from 'next/link';

export default async function Home() {
  const tenantId = 'd948b6cc-cc2c-4399-8525-02f17f281d38';

  // Busca os 5 maiores clientes por Cashback / LTV
  const { data: topClients } = await supabaseAdmin
    .from('clients')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('cashback_balance', { ascending: false })
    .limit(5);

  const totalClients = await supabaseAdmin
    .from('clients')
    .select('*', { count: 'exact', head: true })
    .eq('tenant_id', tenantId);
  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-12">
      
      {/* Header da Página */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pt-2">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground mb-1">Bom dia, Jorge 👋</h1>
          <p className="text-muted-foreground font-medium text-sm">Aqui está o resumo da sua operação hoje.</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-md font-medium transition-colors text-sm shadow-sm">
          <BrainCircuit size={16} />
          <span>Analisar Vendas com IA</span>
        </button>
      </div>

      {/* Grid de Métricas */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Clientes Base Histórica', value: totalClients.count || '0', icon: Users, trend: 'Sincronizado', isPositive: true },
          { label: 'Novos Leads (WhatsApp)', value: '143', icon: MessageSquareText, trend: '+5% vs ontem', isPositive: true },
          { label: 'LTV Médio (Lifetime Value)', value: 'R$ 3.850', icon: TrendingUp, trend: '+R$ 150 vs mês ant.', isPositive: true },
          { label: 'Score de Saúde (IA)', value: '85/100', icon: BrainCircuit, trend: 'Tendência de Alta', isPositive: true },
        ].map((stat, i) => (
          <div key={i} className="rounded-xl border border-border bg-card text-card-foreground shadow-sm">
            <div className="p-6 flex flex-row items-center justify-between space-y-0 pb-2">
              <h3 className="tracking-tight text-sm font-medium">{stat.label}</h3>
              <stat.icon size={16} className="text-muted-foreground" />
            </div>
            <div className="p-6 pt-0">
              <div className="text-2xl font-bold">{stat.value}</div>
              <p className={`text-xs mt-1 flex items-center gap-1 ${stat.isPositive ? 'text-emerald-500' : 'text-destructive'}`}>
                {stat.isPositive ? <ArrowUpRight size={12} /> : null}
                {stat.trend}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Seção Inferior */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        
        {/* Tabela de Top Clientes */}
        <div className="col-span-1 lg:col-span-2 rounded-xl border border-border bg-card text-card-foreground shadow-sm flex flex-col min-h-[420px]">
          <div className="flex flex-col space-y-1.5 p-6 pb-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold leading-none tracking-tight flex items-center gap-2">
                <Trophy size={18} className="text-amber-500" />
                Ranking de Clientes VIPs (Histórico)
              </h3>
            </div>
          </div>
          <div className="p-0 flex-1 w-full flex flex-col">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-muted-foreground uppercase bg-muted/30 border-y border-border">
                  <tr>
                    <th className="px-6 py-3 font-medium">Nome do Cliente</th>
                    <th className="px-6 py-3 font-medium">Telefone</th>
                    <th className="px-6 py-3 font-medium text-right">Cashback Acumulado</th>
                    <th className="px-6 py-3 font-medium">IA Preferências</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {topClients && topClients.map((client) => (
                    <tr key={client.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-6 py-4 font-semibold text-foreground">
                        <Link href={`/clientes/${client.id}`} className="text-primary hover:underline">
                          {client.name}
                        </Link>
                      </td>
                      <td className="px-6 py-4 text-muted-foreground">{client.phone}</td>
                      <td className="px-6 py-4 text-right font-bold text-emerald-500">
                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(client.cashback_balance || 0)}
                      </td>
                      <td className="px-6 py-4 text-muted-foreground max-w-[200px] truncate" title={client.preferences || 'Analisando perfil...'}>
                        {client.preferences || 'Sem histórico de preferências mapeado.'}
                      </td>
                    </tr>
                  ))}
                  {(!topClients || topClients.length === 0) && (
                    <tr>
                      <td colSpan={4} className="px-6 py-8 text-center text-muted-foreground">
                        Nenhum cliente sincronizado ainda.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
        
        {/* IA */}
        <div className="col-span-1 rounded-xl border border-border bg-card text-card-foreground shadow-sm relative overflow-hidden flex flex-col">
          <div className="flex flex-col space-y-1.5 p-6 pb-4 relative z-10">
            <div className="flex items-center gap-2">
              <div className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
              </div>
              <h3 className="font-semibold leading-none tracking-tight text-primary">Insights da IA</h3>
            </div>
          </div>

          <div className="p-6 pt-0 space-y-4 relative z-10 flex-1">
            <div className="rounded-lg border border-border bg-card text-card-foreground p-4 hover:bg-muted/50 transition-colors cursor-pointer group shadow-sm">
              <div className="flex justify-between items-start mb-2">
                <span className="text-[10px] font-semibold text-amber-500 uppercase tracking-wider">Atenção ao Estoque</span>
                <span className="text-xs text-muted-foreground">Há 5 min</span>
              </div>
              <p className="text-sm text-foreground leading-relaxed">
                O produto <strong className="font-medium">Cadeira Gamer X</strong> está parado há 45 dias. 
                Sugiro campanha de <span className="text-emerald-500 font-medium">15% OFF</span>.
              </p>
              <button className="mt-3 text-xs text-primary font-medium flex items-center gap-1 group-hover:underline">
                Criar Automação <ArrowUpRight size={14} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
