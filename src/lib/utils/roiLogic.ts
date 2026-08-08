export interface InteractionRecord {
  id: string;
  campaign_type: string;
  user_id: string | null;
  user_profiles?: any;
  created_at: string;
  sales_attribution?: { id: string; revenue: number }[];
}

export interface RoiStats {
  totalMessages: number;
  totalSales: number;
  totalRevenue: number;
  conversionRate: string;
  campaignStats: Record<string, { msgs: number; sales: number; revenue: number }>;
  sellerStats: Record<string, { 
    msgsToday: number; 
    salesToday: number;
    convRateToday?: string;
    msgsWeek: number; 
    salesWeek: number;
    convRateWeek?: string;
    msgsMonth: number; 
    salesMonth: number;
    convRateMonth?: string;
    msgs: number; 
    sales: number; 
    revenue: number;
    convRate?: string;
  }>;
}

export function calculateRoiStats(interactions: InteractionRecord[], now: Date = new Date()): RoiStats {
  let totalMessages = 0;
  let totalSales = 0;
  let totalRevenue = 0;

  const campaignStats: Record<string, any> = {};
  const sellerStats: Record<string, any> = {};

  const todayStr = now.toISOString().split('T')[0];
  
  const sevenDaysAgo = new Date(now);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  interactions.forEach(int => {
    totalMessages++;
    const hasSale = int.sales_attribution && int.sales_attribution.length > 0;
    const revenue = hasSale ? int.sales_attribution!.reduce((acc, cur) => acc + Number(cur.revenue), 0) : 0;
    
    if (hasSale) totalSales++;
    totalRevenue += revenue;

    // Por Campanha
    const campaignType = int.campaign_type || 'OUTROS';
    if (!campaignStats[campaignType]) {
      campaignStats[campaignType] = { msgs: 0, sales: 0, revenue: 0 };
    }
    campaignStats[campaignType].msgs++;
    if (hasSale) campaignStats[campaignType].sales++;
    campaignStats[campaignType].revenue += revenue;

    // Por Vendedor com lógica de tempo
    const profile = Array.isArray(int.user_profiles) ? int.user_profiles[0] : int.user_profiles;
    const seller = profile?.name || (int.user_id ? `Vendedor ${int.user_id.split('-')[0]}` : 'Vendedor Anônimo');
    if (!sellerStats[seller]) {
      sellerStats[seller] = { 
        msgsToday: 0, salesToday: 0, 
        msgsWeek: 0, salesWeek: 0, 
        msgsMonth: 0, salesMonth: 0, 
        msgs: 0, sales: 0, revenue: 0 
      };
    }

    const intDateStr = int.created_at.split('T')[0];
    const intDate = new Date(int.created_at);

    if (intDateStr === todayStr) {
      sellerStats[seller].msgsToday++;
      if (hasSale) sellerStats[seller].salesToday++;
    }
    if (intDate >= sevenDaysAgo) {
      sellerStats[seller].msgsWeek++;
      if (hasSale) sellerStats[seller].salesWeek++;
    }
    if (intDate.getMonth() === currentMonth && intDate.getFullYear() === currentYear) {
      sellerStats[seller].msgsMonth++;
      if (hasSale) sellerStats[seller].salesMonth++;
    }

    sellerStats[seller].msgs++;
    if (hasSale) sellerStats[seller].sales++;
    sellerStats[seller].revenue += revenue;
  });

  Object.keys(sellerStats).forEach(seller => {
    const s = sellerStats[seller];
    s.convRate = s.msgs > 0 ? ((s.sales / s.msgs) * 100).toFixed(1) : '0.0';
    s.convRateToday = s.msgsToday > 0 ? ((s.salesToday / s.msgsToday) * 100).toFixed(1) : '0.0';
    s.convRateWeek = s.msgsWeek > 0 ? ((s.salesWeek / s.msgsWeek) * 100).toFixed(1) : '0.0';
    s.convRateMonth = s.msgsMonth > 0 ? ((s.salesMonth / s.msgsMonth) * 100).toFixed(1) : '0.0';
  });

  const conversionRate = totalMessages > 0 ? ((totalSales / totalMessages) * 100).toFixed(1) : '0.0';

  return {
    totalMessages,
    totalSales,
    totalRevenue,
    conversionRate,
    campaignStats,
    sellerStats
  };
}
