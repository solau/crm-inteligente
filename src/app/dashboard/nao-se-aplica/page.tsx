import { createClient } from '@supabase/supabase-js';
import { Ban, RotateCcw, User, Phone, Calendar, ArrowLeft, ShieldAlert } from 'lucide-react';
import Link from 'next/link';
import ReactivateClientButton from '@/components/ReactivateClientButton';
import { getSession } from '@/lib/auth';

export const revalidate = 0;

export default async function NaoSeAplicaAdminPage() {
  const session = await getSession();
  const tenantId = 'd948b6cc-cc2c-4399-8525-02f17f281d38';

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // 1. Busca todas as interações do tipo NAO_SE_APLICA
  const { data: interactions } = await supabase
    .from('client_interactions')
    .select('id, client_id, campaign_type, created_at, user_id')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false });

  // 2. Filtra os clientes cuja ÚLTIMA interação registrada foi NAO_SE_APLICA
  const latestMap = new Map<string, any>();
  (interactions || []).forEach(item => {
    if (!latestMap.has(item.client_id)) {
      latestMap.set(item.client_id, item);
    }
  });

  const ignoredClientIds: string[] = [];
  const metaMap = new Map<string, { date: string; userId: string }>();

  for (const [clientId, item] of latestMap.entries()) {
    if (item.campaign_type === 'NAO_SE_APLICA') {
      ignoredClientIds.push(clientId);
      metaMap.set(clientId, { date: item.created_at, userId: item.user_id });
    }
  }

  let ignoredClients: any[] = [];
  if (ignoredClientIds.length > 0) {
    const { data: clientsData } = await supabase
      .from('clients')
      .select('id, name, phone, email, last_purchase_date, total_spent, lead_score')
      .in('id', ignoredClientIds);

    ignoredClients = (clientsData || []).map(c => ({
      ...c,
      flaggedAt: metaMap.get(c.id)?.date || new Date().toISOString()
    }));
  }

  const formatMoney = (val: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

  return (
    <div className="min-h-screen bg-black/90 p-4 md:p-8 text-white">
      <div className="max-w-6xl mx-auto space-y-8">
        
        {/* Header Tático */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white/5 border border-white/10 rounded-3xl p-6 backdrop-blur-xl">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="bg-rose-500/20 text-rose-400 text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1.5 border border-rose-500/30">
                <Ban size={14} /> Painel Administrativo de Exclusão
              </span>
            </div>
            <h1 className="text-2xl md:text-3xl font-black tracking-tight">Clientes em "Não se Aplica"</h1>
            <p className="text-white/50 text-xs md:text-sm mt-1">
              Clientes removidos do Kanban de Vendas. Clique em Reativar para restaurar o cliente na fila.
            </p>
          </div>

          <Link
            href="/vendedor/kanban"
            className="inline-flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white text-xs font-semibold px-4 py-2.5 rounded-xl border border-white/20 transition-all"
          >
            <ArrowLeft size={14} />
            <span>Voltar ao Kanban</span>
          </Link>
        </div>

        {/* Tabela de Clientes Ignorados */}
        <div className="bg-white/5 border border-white/10 rounded-3xl p-6 backdrop-blur-xl">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-rose-400" />
                Lista de Clientes Ocultados ({ignoredClients.length})
              </h2>
              <p className="text-xs text-white/50 mt-0.5">
                Estes clientes não aparecem no Kanban dos vendedores.
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-white/10 text-white/40 uppercase tracking-wider">
                  <th className="pb-3">Cliente</th>
                  <th className="pb-3">Telefone</th>
                  <th className="pb-3">Marcado Em</th>
                  <th className="pb-3">Última Compra</th>
                  <th className="pb-3">LTV Total</th>
                  <th className="pb-3 text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {ignoredClients.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-white/40 text-sm">
                      Nenhum cliente marcado como "Não se aplica". Todos os clientes estão disponíveis no Kanban.
                    </td>
                  </tr>
                ) : (
                  ignoredClients.map((c, idx) => (
                    <tr key={idx} className="hover:bg-white/5 transition-colors">
                      <td className="py-3.5 font-semibold text-white/90">{c.name}</td>
                      <td className="py-3.5 text-white/60">{c.phone}</td>
                      <td className="py-3.5 text-rose-400 font-medium">
                        {new Date(c.flaggedAt).toLocaleDateString('pt-BR')}
                      </td>
                      <td className="py-3.5 text-white/60">
                        {c.last_purchase_date ? new Date(c.last_purchase_date).toLocaleDateString('pt-BR') : 'N/A'}
                      </td>
                      <td className="py-3.5 font-bold text-white/90">{formatMoney(Number(c.total_spent) || 0)}</td>
                      <td className="py-3.5 text-right">
                        <ReactivateClientButton clientId={c.id} clientName={c.name} />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}
