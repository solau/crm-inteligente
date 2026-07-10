import { calculateRoiStats, InteractionRecord } from '../roiLogic';

describe('ROI Logic - Relatório de Conversão', () => {
  const baseInteraction: InteractionRecord = {
    id: '1',
    campaign_type: 'POS_VENDA',
    user_id: 'seller1',
    created_at: new Date().toISOString()
  };

  test('Deve somar corretamente total de mensagens, vendas e receita', () => {
    const interactions: InteractionRecord[] = [
      { ...baseInteraction, id: '1', sales_attribution: [{ id: 's1', revenue: 100 }] },
      { ...baseInteraction, id: '2', sales_attribution: [] },
      { ...baseInteraction, id: '3', sales_attribution: [{ id: 's2', revenue: 200 }, { id: 's3', revenue: 50 }] }
    ];

    const stats = calculateRoiStats(interactions);

    expect(stats.totalMessages).toBe(3);
    expect(stats.totalSales).toBe(2);
    expect(stats.totalRevenue).toBe(350); // 100 + 200 + 50
    expect(stats.conversionRate).toBe(((2 / 3) * 100).toFixed(1));
  });

  test('Deve agrupar estatísticas por campanha corretamente', () => {
    const interactions: InteractionRecord[] = [
      { ...baseInteraction, id: '1', campaign_type: 'CASHBACK_15D', sales_attribution: [{ id: 's1', revenue: 100 }] },
      { ...baseInteraction, id: '2', campaign_type: 'CASHBACK_15D', sales_attribution: [] },
      { ...baseInteraction, id: '3', campaign_type: 'POS_VENDA', sales_attribution: [{ id: 's2', revenue: 200 }] }
    ];

    const stats = calculateRoiStats(interactions);

    expect(stats.campaignStats['CASHBACK_15D'].msgs).toBe(2);
    expect(stats.campaignStats['CASHBACK_15D'].sales).toBe(1);
    expect(stats.campaignStats['CASHBACK_15D'].revenue).toBe(100);

    expect(stats.campaignStats['POS_VENDA'].msgs).toBe(1);
    expect(stats.campaignStats['POS_VENDA'].sales).toBe(1);
    expect(stats.campaignStats['POS_VENDA'].revenue).toBe(200);
  });

  test('Deve atribuir interações sem vendedor a vendedor-anonimo', () => {
    const interactions: InteractionRecord[] = [
      { ...baseInteraction, user_id: null, sales_attribution: [] }
    ];

    const stats = calculateRoiStats(interactions);
    expect(stats.sellerStats['vendedor-anonimo']).toBeDefined();
    expect(stats.sellerStats['vendedor-anonimo'].msgs).toBe(1);
  });

  test('Deve contabilizar corretamente os filtros de tempo do vendedor', () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString();

    const threeDaysAgo = new Date(today);
    threeDaysAgo.setDate(today.getDate() - 3);
    
    const twoMonthsAgo = new Date(today);
    twoMonthsAgo.setMonth(today.getMonth() - 2);

    const interactions: InteractionRecord[] = [
      { ...baseInteraction, created_at: todayStr },           // Hoje, Semana, Mês, Total
      { ...baseInteraction, created_at: threeDaysAgo.toISOString() }, // Semana, Mês, Total
      { ...baseInteraction, created_at: twoMonthsAgo.toISOString() }  // Total
    ];

    const stats = calculateRoiStats(interactions, today);
    const seller = stats.sellerStats['seller1'];

    expect(seller.msgsToday).toBe(1);
    expect(seller.msgsWeek).toBe(2);
    // msgsMonth dependerá se 2 meses atrás cair no mesmo mês? Não. Então é 2.
    // E total msgs = 3
    expect(seller.msgs).toBe(3);
  });
});
