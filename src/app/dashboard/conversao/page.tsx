import { createClient } from '@supabase/supabase-js';

export const revalidate = 0;

export default async function ConversaoDashboardPage() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: stats, error } = await supabase
    .from('vw_kanban_dashboard')
    .select('*')
    .order('month', { ascending: false });

  if (error) {
    console.error('Erro ao buscar dashboard:', error);
  }

  const formatMoney = (val: number) => 
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

  return (
    <div className="min-h-screen bg-black/90 p-8">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-3xl font-bold text-white mb-2">Dashboard de Conversão do Kanban</h1>
        <p className="text-white/50 mb-8">Acompanhe a receita gerada a partir das ações ativas da equipe de vendas.</p>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {stats && stats.length > 0 ? (
            stats.map((stat: any, idx: number) => (
              <div key={idx} className="bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-md">
                <div className="flex justify-between items-start mb-4">
                  <h3 className="text-lg font-semibold text-white/90">{stat.campaign_type}</h3>
                  <span className="text-xs bg-white/10 text-white/60 px-2 py-1 rounded-full">
                    {new Date(stat.month).toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' })}
                  </span>
                </div>
                
                <div className="space-y-4">
                  <div>
                    <p className="text-white/40 text-sm">Receita Gerada</p>
                    <p className="text-2xl font-bold text-emerald-400">
                      {formatMoney(stat.total_revenue)}
                    </p>
                  </div>
                  
                  <div className="flex gap-4 border-t border-white/10 pt-4">
                    <div>
                      <p className="text-white/40 text-xs">Mensagens</p>
                      <p className="text-lg font-medium text-white/80">{stat.total_interactions}</p>
                    </div>
                    <div>
                      <p className="text-white/40 text-xs">Vendas</p>
                      <p className="text-lg font-medium text-white/80">{stat.total_conversions}</p>
                    </div>
                    <div>
                      <p className="text-white/40 text-xs">Taxa</p>
                      <p className="text-lg font-medium text-sky-400">{stat.conversion_rate}%</p>
                    </div>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="col-span-full text-center py-12 bg-white/5 rounded-2xl border border-white/10">
              <p className="text-white/50">Nenhuma conversão registrada ainda.</p>
              <p className="text-sm text-white/30 mt-2">Os dados aparecerão assim que as mensagens enviadas pelo Kanban resultarem em vendas.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
