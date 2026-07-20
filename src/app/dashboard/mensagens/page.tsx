import { createClient } from '@supabase/supabase-js';

export const revalidate = 0;

export default async function MensagensPage() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: messages, error } = await supabase
    .from('client_interactions')
    .select(`
      id,
      campaign_type,
      created_at,
      clients (
        name,
        phone
      ),
      user_profiles (
        name
      ),
      sales_attribution (
        order_id,
        revenue,
        created_at
      )
    `)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Erro ao buscar mensagens:', error);
  }

  const formatMoney = (val: number) => 
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

  return (
    <div className="min-h-screen bg-black/90 p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold text-white mb-2">Registro de Mensagens Enviadas</h1>
        <p className="text-white/50 mb-8">
          Histórico detalhado de todas as abordagens do Kanban e conversões atribuídas.
        </p>

        <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden backdrop-blur-md">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-white/80">
              <thead className="bg-white/5 text-white/50 font-medium">
                <tr>
                  <th className="px-6 py-4">Data da Mensagem</th>
                  <th className="px-6 py-4">Cliente</th>
                  <th className="px-6 py-4">Vendedor</th>
                  <th className="px-6 py-4">Campanha</th>
                  <th className="px-6 py-4">Próximo Contato Liberado</th>
                  <th className="px-6 py-4">Retorno (Venda)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {messages && messages.length > 0 ? (
                  messages.map((msg: any) => {
                    const hasConversion = msg.sales_attribution && msg.sales_attribution.length > 0;
                    const revenue = hasConversion ? msg.sales_attribution[0].revenue : 0;
                    const orderId = hasConversion ? msg.sales_attribution[0].order_id : null;
                    const client = msg.clients;
                    
                    return (
                      <tr key={msg.id} className="hover:bg-white/5 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap">
                          {new Date(msg.created_at).toLocaleString('pt-BR')}
                        </td>
                        <td className="px-6 py-4 font-medium text-white/90">
                          {client?.name || 'Cliente Removido'}
                          <span className="block text-white/50 text-xs font-normal">{client?.phone || '-'}</span>
                        </td>
                        <td className="px-6 py-4 text-white/80">
                          {msg.user_profiles?.name || <span className="text-white/30 italic">Bot / Sistema</span>}
                        </td>
                        <td className="px-6 py-4">
                          <span className="bg-white/10 text-sky-400 px-3 py-1 rounded-full text-xs font-semibold">
                            {msg.campaign_type}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {(() => {
                            const nextDate = new Date(msg.created_at);
                            nextDate.setDate(nextDate.getDate() + 15);
                            const isReleased = nextDate < new Date();
                            
                            return (
                              <div>
                                <span className="text-white/80 block">
                                  {nextDate.toLocaleDateString('pt-BR')}
                                </span>
                                {isReleased ? (
                                  <span className="text-emerald-400 text-xs font-semibold">✅ Liberado</span>
                                ) : (
                                  <span className="text-amber-400 text-xs font-semibold">⏳ Em Cooldown</span>
                                )}
                              </div>
                            );
                          })()}
                        </td>
                        <td className="px-6 py-4">
                          {hasConversion ? (
                            <div>
                              <span className="text-emerald-400 font-bold block">
                                {formatMoney(revenue)}
                              </span>
                              <span className="text-white/40 text-xs block mb-1">
                                Pedido #{orderId}
                              </span>
                              <span className="bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded text-[10px] uppercase font-bold">
                                {new Date(msg.sales_attribution[0].created_at).toLocaleDateString('pt-BR')}
                              </span>
                            </div>
                          ) : (
                            <span className="text-white/30 italic">Pendente</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-white/50">
                      Nenhuma mensagem enviada até o momento.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
