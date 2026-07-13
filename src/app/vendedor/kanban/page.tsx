import { createClient } from '@supabase/supabase-js';
import { KanbanBoard } from '@/components/KanbanBoard';
import { getSession } from '@/lib/auth';

export const revalidate = 0; // Para garantir que os dados estejam sempre frescos

export default async function KanbanPage() {
  const session = await getSession();
  
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      global: {
        fetch: (url, options) => fetch(url, { ...options, cache: 'no-store' })
      }
    }
  );

  // Busca os dados da view que alimenta o radar com paginação para ignorar o limite de 1000 linhas
  let clients: any[] = [];
  let from = 0;
  const step = 1000;
  let hasMore = true;

  while (hasMore) {
    const { data, error } = await supabase
      .from('vw_client_radar')
      .select('*')
      .range(from, from + step - 1);
      
    if (error) {
      console.error("Erro ao buscar clientes no Kanban:", error);
      break;
    }
    
    if (data && data.length > 0) {
      clients = [...clients, ...data];
      if (data.length < step) {
        hasMore = false;
      } else {
        from += step;
      }
    } else {
      hasMore = false;
    }
  }

  // The error handling is inside the loop

  // Busca interações dos últimos 15 dias para lógica de Cooldown
  const fifteenDaysAgo = new Date();
  fifteenDaysAgo.setDate(fifteenDaysAgo.getDate() - 15);
  fifteenDaysAgo.setHours(0, 0, 0, 0);
  
  const { data: interactionsData } = await supabase
    .from('client_interactions')
    .select('client_id, created_at, campaign_type')
    .gte('created_at', fifteenDaysAgo.toISOString())
    .order('created_at', { ascending: false });
    
  // Mapeia para pegar apenas a interação mais recente de cada cliente nos últimos 15 dias
  const lastInteractions: Record<string, { date: string, campaign: string }> = {};
  if (interactionsData) {
    for (const int of interactionsData) {
      if (!lastInteractions[int.client_id]) {
        lastInteractions[int.client_id] = {
          date: int.created_at,
          campaign: int.campaign_type
        };
      }
    }
  }

  let sellerName = 'Vendedor';
  let messagesToday = 0;
  
  if (session?.id) {
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('name')
      .eq('id', session.id)
      .single();
      
    if (profile) sellerName = profile.name;
    
    // Contar mensagens de hoje
    const todayStr = new Date().toISOString().split('T')[0];
    const { count } = await supabase
      .from('client_interactions')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', session.id)
      .gte('created_at', `${todayStr}T00:00:00.000Z`);
      
    messagesToday = count || 0;
  }

  return (
    <div className="min-h-screen bg-black/90 pt-8 px-4 md:px-8 relative">
      <div className="max-w-[1600px] mx-auto pt-4">
        <div className="mb-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-white/90">Kanban Inteligente</h1>
            <p className="text-white/50 text-xs md:text-sm">Organização automática com base no ciclo de vida e cashback do cliente.</p>
          </div>
          
          {/* Header KPI do Vendedor */}
          {session?.id && (
            <div className="flex items-center gap-4 bg-white/5 border border-white/10 rounded-2xl px-4 py-2">
              <div className="flex items-center gap-3 border-r border-white/10 pr-4">
                <div className="w-9 h-9 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold">
                  {sellerName.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-white/50">Atendente</p>
                  <p className="text-sm font-bold text-white/90 capitalize">{sellerName}</p>
                </div>
              </div>
              <div className="pl-1">
                <p className="text-[10px] uppercase tracking-wider text-white/50">Sua Meta Diária</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className={`text-lg font-black leading-none ${messagesToday >= 30 ? 'text-emerald-500' : 'text-white/90'}`}>
                    {messagesToday}
                  </span>
                  <span className="text-sm font-medium text-white/30 leading-none">/ 30 msgs</span>
                </div>
              </div>
            </div>
          )}
        </div>
        
        {/* Kanban Board Container */}
        <KanbanBoard 
          clients={clients || []} 
          session={session}
          lastInteractions={lastInteractions}
        />
      </div>
    </div>
  );
}
