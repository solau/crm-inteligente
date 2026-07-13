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
  
  // Stats
  let msgs1d = 0;
  let diffMsgs1d = 0;
  
  let msgs7d = 0;
  let diffMsgs7d = 0;
  
  let msgs30d = 0;
  let conv30d = 0;
  let diffMsgs30d = 0;
  let diffConv30d = 0;
  
  if (session?.id) {
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('name')
      .eq('id', session.id)
      .single();
      
    if (profile) sellerName = profile.name;
    
    // Obter todas as interações dos últimos 30 dias (Equipe toda)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const todayStr = new Date().toISOString().split('T')[0] + 'T00:00:00.000Z';
    
    const { data: allInteractions } = await supabase
      .from('client_interactions')
      .select('user_id, created_at, sales_attribution(id)')
      .gte('created_at', thirtyDaysAgo);

    if (allInteractions) {
      type UserStats = { m1: number, m7: number, m30: number, s30: number };
      const statsByUser: Record<string, UserStats> = {};
      
      for (const int of allInteractions) {
        if (!int.user_id) continue;
        if (!statsByUser[int.user_id]) {
          statsByUser[int.user_id] = { m1: 0, m7: 0, m30: 0, s30: 0 };
        }
        
        const isToday = int.created_at >= todayStr;
        const is7d = int.created_at >= sevenDaysAgo;
        const hasSale = int.sales_attribution && int.sales_attribution.length > 0;
        
        // 30d
        statsByUser[int.user_id].m30++;
        if (hasSale) statsByUser[int.user_id].s30++;
        
        // 7d
        if (is7d) {
          statsByUser[int.user_id].m7++;
        }
        
        // 1d
        if (isToday) {
          statsByUser[int.user_id].m1++;
        }
      }
      
      const myStats = statsByUser[session.id] || { m1: 0, m7: 0, m30: 0, s30: 0 };
      msgs1d = myStats.m1;
      msgs7d = myStats.m7;
      msgs30d = myStats.m30;
      conv30d = msgs30d > 0 ? (myStats.s30 / msgs30d) * 100 : 0;

      const otherUsers = Object.keys(statsByUser).filter(id => id !== session.id);
      if (otherUsers.length > 0) {
        // Averages
        let teamM1 = 0;
        let teamM7 = 0;
        let teamM30 = 0;
        let teamC30 = 0;
        
        for (const id of otherUsers) {
          const u = statsByUser[id];
          teamM1 += u.m1;
          teamM7 += u.m7;
          teamM30 += u.m30;
          teamC30 += u.m30 > 0 ? (u.s30 / u.m30) * 100 : 0;
        }
        
        teamM1 /= otherUsers.length;
        teamM7 /= otherUsers.length;
        teamM30 /= otherUsers.length;
        teamC30 /= otherUsers.length;
        
        if (teamM1 > 0) diffMsgs1d = ((msgs1d - teamM1) / teamM1) * 100;
        else if (msgs1d > 0) diffMsgs1d = 100;
        
        if (teamM7 > 0) diffMsgs7d = ((msgs7d - teamM7) / teamM7) * 100;
        else if (msgs7d > 0) diffMsgs7d = 100;
        
        if (teamM30 > 0) diffMsgs30d = ((msgs30d - teamM30) / teamM30) * 100;
        else if (msgs30d > 0) diffMsgs30d = 100;
        
        if (teamC30 > 0) diffConv30d = ((conv30d - teamC30) / teamC30) * 100;
        else if (conv30d > 0) diffConv30d = 100;
        
      } else {
        if (msgs1d > 0) diffMsgs1d = 100;
        if (msgs7d > 0) diffMsgs7d = 100;
        if (msgs30d > 0) diffMsgs30d = 100;
        if (conv30d > 0) diffConv30d = 100;
      }
    }
  }

  return (
    <div className="min-h-screen bg-black/90 pt-8 px-4 md:px-8 relative">
      <div className="max-w-[1600px] mx-auto pt-4">
        <div className="mb-6 flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4">
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-white/90">Kanban Inteligente</h1>
            <p className="text-white/50 text-xs md:text-sm">Organização automática com base no ciclo de vida e cashback do cliente.</p>
          </div>
          
          {/* Header KPI do Vendedor */}
          {session?.id && (
            <div className="flex flex-wrap items-center gap-4 bg-white/5 border border-white/10 rounded-2xl px-4 py-2">
              <div className="flex items-center gap-3 border-r border-white/10 pr-4">
                <div className="w-9 h-9 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold">
                  {sellerName.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-white/50">Atendente</p>
                  <p className="text-sm font-bold text-white/90 capitalize whitespace-nowrap">{sellerName}</p>
                </div>
              </div>
              
              <div className="flex items-center gap-6 pl-1">
                {/* HOJE */}
                <div className="flex flex-col">
                  <p className="text-[10px] uppercase tracking-wider text-white/50">Hoje (Meta)</p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className={`text-lg font-black leading-none ${msgs1d >= 30 ? 'text-emerald-500' : 'text-white/90'}`}>
                      {msgs1d}
                    </span>
                    <span className="text-xs font-medium text-white/30 leading-none">/ 30</span>
                  </div>
                  <div className="mt-1 flex items-center gap-1">
                    <span className={`text-[10px] font-bold ${diffMsgs1d > 0 ? 'text-emerald-500' : diffMsgs1d < 0 ? 'text-red-400' : 'text-white/50'}`}>
                      {diffMsgs1d > 0 ? '+' : ''}{diffMsgs1d.toFixed(0)}%
                    </span>
                    <span className="text-[10px] text-white/30">vs eq.</span>
                  </div>
                </div>
                
                {/* 7 DIAS */}
                <div className="border-l border-white/10 pl-6 flex flex-col">
                  <p className="text-[10px] uppercase tracking-wider text-white/50">7 Dias</p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className={`text-lg font-black leading-none ${msgs7d >= 210 ? 'text-emerald-500' : 'text-white/90'}`}>
                      {msgs7d}
                    </span>
                    <span className="text-xs font-medium text-white/30 leading-none">/ 210</span>
                  </div>
                  <div className="mt-1 flex items-center gap-1">
                    <span className={`text-[10px] font-bold ${diffMsgs7d > 0 ? 'text-emerald-500' : diffMsgs7d < 0 ? 'text-red-400' : 'text-white/50'}`}>
                      {diffMsgs7d > 0 ? '+' : ''}{diffMsgs7d.toFixed(0)}%
                    </span>
                    <span className="text-[10px] text-white/30">vs eq.</span>
                  </div>
                </div>

                {/* 30 DIAS */}
                <div className="border-l border-white/10 pl-6 flex flex-col">
                  <p className="text-[10px] uppercase tracking-wider text-white/50">30 Dias</p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className={`text-lg font-black leading-none ${msgs30d >= 900 ? 'text-emerald-500' : 'text-white/90'}`}>
                      {msgs30d}
                    </span>
                    <span className="text-xs font-medium text-white/30 leading-none">/ 900</span>
                  </div>
                  <div className="mt-1 flex items-center gap-1">
                    <span className={`text-[10px] font-bold ${diffMsgs30d > 0 ? 'text-emerald-500' : diffMsgs30d < 0 ? 'text-red-400' : 'text-white/50'}`}>
                      {diffMsgs30d > 0 ? '+' : ''}{diffMsgs30d.toFixed(0)}%
                    </span>
                    <span className="text-[10px] text-white/30">vs eq.</span>
                  </div>
                </div>

                {/* CONVERSÃO MÊS */}
                <div className="border-l border-white/10 pl-6 flex flex-col">
                  <p className="text-[10px] uppercase tracking-wider text-white/50">Conversão (Meta)</p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className={`text-lg font-black leading-none ${conv30d >= 6 ? 'text-emerald-500' : 'text-indigo-400'}`}>
                      {conv30d.toFixed(1)}%
                    </span>
                    <span className="text-xs font-medium text-white/30 leading-none">/ 6%</span>
                  </div>
                  <div className="mt-1 flex items-center gap-1">
                    <span className={`text-[10px] font-bold ${diffConv30d > 0 ? 'text-emerald-500' : diffConv30d < 0 ? 'text-red-400' : 'text-white/50'}`}>
                      {diffConv30d > 0 ? '+' : ''}{diffConv30d.toFixed(0)}%
                    </span>
                    <span className="text-[10px] text-white/30">vs eq.</span>
                  </div>
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
