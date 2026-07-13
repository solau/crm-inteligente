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
    msgsWeek: number; 
    msgsMonth: number; 
    msgs: number; 
    sales: number; 
    revenue: number 
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
      sellerStats[seller] = { msgsToday: 0, msgsWeek: 0, msgsMonth: 0, msgs: 0, sales: 0, revenue: 0 };
    }

    const intDateStr = int.created_at.split('T')[0];
    const intDate = new Date(int.created_at);

    if (intDateStr === todayStr) {
      sellerStats[seller].msgsToday++;
    }
    if (intDate >= sevenDaysAgo) {
      sellerStats[seller].msgsWeek++;
    }
    if (intDate.getMonth() === currentMonth && intDate.getFullYear() === currentYear) {
      sellerStats[seller].msgsMonth++;
    }

    sellerStats[seller].msgs++;
    if (hasSale) sellerStats[seller].sales++;
    sellerStats[seller].revenue += revenue;
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
