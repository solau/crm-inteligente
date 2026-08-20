'use client';

import React, { useState, useMemo } from 'react';
import { 
  Users, 
  Calendar, 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  MessageSquare, 
  Target, 
  ArrowRight,
  Filter,
  BarChart3,
  Layers,
  Sparkles,
  Award,
  CheckCircle2
} from 'lucide-react';

export interface RawInteraction {
  id: string;
  campaign_type: string;
  user_id: string | null;
  user_profiles?: { name: string } | { name: string }[] | null;
  created_at: string;
  sales_attribution?: {
    id: string;
    revenue: number;
    order_id?: string;
    created_at?: string;
  }[] | null;
}

interface ConversionDashboardClientProps {
  interactions: RawInteraction[];
}

export default function ConversionDashboardClient({ interactions }: ConversionDashboardClientProps) {
  // 1. Extrair todos os meses e vendedores disponíveis
  const { allMonths, allSellers, monthLabels } = useMemo(() => {
    const monthsSet = new Set<string>();
    const sellersSet = new Set<string>();

    interactions.forEach(i => {
      const monthStr = i.created_at.slice(0, 7); // YYYY-MM
      monthsSet.add(monthStr);

      const profile = Array.isArray(i.user_profiles) ? i.user_profiles[0] : i.user_profiles;
      const seller = profile?.name || (i.user_id ? `Vendedor ${i.user_id.split('-')[0]}` : 'Sistema / Sem Vendedor');
      sellersSet.add(seller);
    });

    const months = Array.from(monthsSet).sort(); // ['2026-07', '2026-08']
    const sellers = Array.from(sellersSet).sort();

    const labels: Record<string, string> = {};
    months.forEach(m => {
      const [year, month] = m.split('-');
      const d = new Date(Number(year), Number(month) - 1, 1);
      const label = d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
      labels[m] = label.charAt(0).toUpperCase() + label.slice(1);
    });

    return {
      allMonths: months,
      allSellers: sellers,
      monthLabels: labels
    };
  }, [interactions]);

  // Estados dos Filtros
  const [selectedSeller, setSelectedSeller] = useState<string>('ALL');
  const [selectedMonths, setSelectedMonths] = useState<string[]>(allMonths);
  const [activeTab, setActiveTab] = useState<'SELLERS' | 'CAMPAIGNS' | 'RANKING'>('SELLERS');

  const formatMoney = (val: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

  // Alterna mês selecionado
  const toggleMonth = (m: string) => {
    if (selectedMonths.includes(m)) {
      if (selectedMonths.length > 1) {
        setSelectedMonths(selectedMonths.filter(x => x !== m));
      }
    } else {
      setSelectedMonths([...selectedMonths, m].sort());
    }
  };

  // 2. Processar a Matriz Mês x Vendedor
  const { 
    matrixSellerMonth, 
    matrixCampaignMonth, 
    sellerTotals, 
    campaignTotals, 
    monthTotals, 
    grandTotal 
  } = useMemo(() => {
    // matrixSellerMonth[seller][month] = { msgs, sales, revenue, convRate }
    const sellerMatrix: Record<string, Record<string, { msgs: number; sales: number; revenue: number; convRate: string }>> = {};
    const campaignMatrix: Record<string, Record<string, { msgs: number; sales: number; revenue: number; convRate: string }>> = {};

    const sTotals: Record<string, { msgs: number; sales: number; revenue: number; convRate: string }> = {};
    const cTotals: Record<string, { msgs: number; sales: number; revenue: number; convRate: string }> = {};
    const mTotals: Record<string, { msgs: number; sales: number; revenue: number; convRate: string }> = {};

    let gMsgs = 0;
    let gSales = 0;
    let gRevenue = 0;

    // Inicializa estruturas
    allSellers.forEach(s => {
      sellerMatrix[s] = {};
      sTotals[s] = { msgs: 0, sales: 0, revenue: 0, convRate: '0.0' };
      allMonths.forEach(m => {
        sellerMatrix[s][m] = { msgs: 0, sales: 0, revenue: 0, convRate: '0.0' };
      });
    });

    allMonths.forEach(m => {
      mTotals[m] = { msgs: 0, sales: 0, revenue: 0, convRate: '0.0' };
    });

    interactions.forEach(i => {
      const month = i.created_at.slice(0, 7);
      const profile = Array.isArray(i.user_profiles) ? i.user_profiles[0] : i.user_profiles;
      const seller = profile?.name || (i.user_id ? `Vendedor ${i.user_id.split('-')[0]}` : 'Sistema / Sem Vendedor');
      const campaign = i.campaign_type || 'OUTROS';

      const hasSale = i.sales_attribution && i.sales_attribution.length > 0;
      const rev = hasSale ? i.sales_attribution!.reduce((acc, cur) => acc + Number(cur.revenue), 0) : 0;

      // Filtro de vendedor
      if (selectedSeller !== 'ALL' && seller !== selectedSeller) {
        return;
      }

      // Se o mês está nos meses selecionados para os KPIs globais
      if (selectedMonths.includes(month)) {
        gMsgs++;
        if (hasSale) gSales++;
        gRevenue += rev;
      }

      // Vendedores
      if (sellerMatrix[seller] && sellerMatrix[seller][month]) {
        sellerMatrix[seller][month].msgs++;
        if (hasSale) sellerMatrix[seller][month].sales++;
        sellerMatrix[seller][month].revenue += rev;
      }

      // Campanhas
      if (!campaignMatrix[campaign]) {
        campaignMatrix[campaign] = {};
        cTotals[campaign] = { msgs: 0, sales: 0, revenue: 0, convRate: '0.0' };
        allMonths.forEach(m => {
          campaignMatrix[campaign][m] = { msgs: 0, sales: 0, revenue: 0, convRate: '0.0' };
        });
      }
      campaignMatrix[campaign][month].msgs++;
      if (hasSale) campaignMatrix[campaign][month].sales++;
      campaignMatrix[campaign][month].revenue += rev;

      // Totais por Mês (respeitando filtro de vendedor)
      mTotals[month].msgs++;
      if (hasSale) mTotals[month].sales++;
      mTotals[month].revenue += rev;

      // Totais por Vendedor (considerando meses selecionados)
      if (selectedMonths.includes(month)) {
        sTotals[seller].msgs++;
        if (hasSale) sTotals[seller].sales++;
        sTotals[seller].revenue += rev;
      }

      // Totais por Campanha (considerando meses selecionados)
      if (selectedMonths.includes(month)) {
        cTotals[campaign].msgs++;
        if (hasSale) cTotals[campaign].sales++;
        cTotals[campaign].revenue += rev;
      }
    });

    // Calcular taxas de conversão
    allSellers.forEach(s => {
      allMonths.forEach(m => {
        const item = sellerMatrix[s][m];
        item.convRate = item.msgs > 0 ? ((item.sales / item.msgs) * 100).toFixed(1) : '0.0';
      });
      const st = sTotals[s];
      st.convRate = st.msgs > 0 ? ((st.sales / st.msgs) * 100).toFixed(1) : '0.0';
    });

    Object.keys(campaignMatrix).forEach(c => {
      allMonths.forEach(m => {
        const item = campaignMatrix[c][m];
        item.convRate = item.msgs > 0 ? ((item.sales / item.msgs) * 100).toFixed(1) : '0.0';
      });
      const ct = cTotals[c];
      ct.convRate = ct.msgs > 0 ? ((ct.sales / ct.msgs) * 100).toFixed(1) : '0.0';
    });

    allMonths.forEach(m => {
      const mt = mTotals[m];
      mt.convRate = mt.msgs > 0 ? ((mt.sales / mt.msgs) * 100).toFixed(1) : '0.0';
    });

    const gConv = gMsgs > 0 ? ((gSales / gMsgs) * 100).toFixed(1) : '0.0';

    return {
      matrixSellerMonth: sellerMatrix,
      matrixCampaignMonth: campaignMatrix,
      sellerTotals: sTotals,
      campaignTotals: cTotals,
      monthTotals: mTotals,
      grandTotal: {
        msgs: gMsgs,
        sales: gSales,
        revenue: gRevenue,
        convRate: gConv,
        avgTicket: gSales > 0 ? gRevenue / gSales : 0
      }
    };
  }, [interactions, allSellers, allMonths, selectedSeller, selectedMonths]);

  // Lista de vendedores visíveis no filtro
  const visibleSellers = useMemo(() => {
    if (selectedSeller !== 'ALL') return [selectedSeller];
    return allSellers.filter(s => {
      const totalInSelected = selectedMonths.reduce((acc, m) => acc + (matrixSellerMonth[s]?.[m]?.msgs || 0), 0);
      return totalInSelected > 0;
    });
  }, [selectedSeller, allSellers, selectedMonths, matrixSellerMonth]);

  // Variação MoM entre os dois últimos meses selecionados
  const momComparison = useMemo(() => {
    if (selectedMonths.length < 2) return null;
    const sorted = [...selectedMonths].sort();
    const prevMonth = sorted[sorted.length - 2];
    const currMonth = sorted[sorted.length - 1];

    const prev = monthTotals[prevMonth] || { msgs: 0, sales: 0, revenue: 0 };
    const curr = monthTotals[currMonth] || { msgs: 0, sales: 0, revenue: 0 };

    const calcGrowth = (c: number, p: number) => {
      if (p === 0) return c > 0 ? 100 : 0;
      return Number((((c - p) / p) * 100).toFixed(1));
    };

    return {
      prevMonth,
      currMonth,
      prevLabel: monthLabels[prevMonth],
      currLabel: monthLabels[currMonth],
      revGrowth: calcGrowth(curr.revenue, prev.revenue),
      salesGrowth: calcGrowth(curr.sales, prev.sales),
      msgsGrowth: calcGrowth(curr.msgs, prev.msgs),
      prevRevenue: prev.revenue,
      currRevenue: curr.revenue,
      prevSales: prev.sales,
      currSales: curr.sales,
      prevMsgs: prev.msgs,
      currMsgs: curr.msgs
    };
  }, [selectedMonths, monthTotals, monthLabels]);

  return (
    <div className="min-h-screen bg-background p-4 md:p-8 space-y-8 text-foreground">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Header com Título e Filtros Globais */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 bg-card border border-border p-6 rounded-3xl shadow-sm">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                Dashboard Executivo
              </span>
              <span className="px-3 py-1 rounded-full text-xs font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                Comparativo MoM
              </span>
            </div>
            <h1 className="text-2xl md:text-3xl font-black tracking-tight text-foreground mt-2">
              Conversão & Comparativo Mês a Mês
            </h1>
            <p className="text-muted-foreground mt-1 text-sm md:text-base">
              Compare a evolução de mensagens, vendas convertidas e receita entre atendentes e períodos lado a lado.
            </p>
          </div>

          {/* Painel de Filtros */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Filtro de Vendedor */}
            <div className="flex items-center gap-2 bg-zinc-900 border border-zinc-700 px-3 py-2 rounded-2xl shadow-sm">
              <Users className="w-4 h-4 text-emerald-400" />
              <select
                value={selectedSeller}
                onChange={(e) => setSelectedSeller(e.target.value)}
                className="bg-zinc-900 text-white font-semibold text-sm focus:outline-none cursor-pointer border-none pr-2"
                style={{ colorScheme: 'dark', backgroundColor: '#18181b', color: '#ffffff' }}
              >
                <option value="ALL" style={{ backgroundColor: '#18181b', color: '#ffffff' }}>
                  👥 Todos os Vendedores
                </option>
                {allSellers.map(seller => (
                  <option key={seller} value={seller} style={{ backgroundColor: '#18181b', color: '#ffffff' }}>
                    👤 {seller}
                  </option>
                ))}
              </select>
            </div>

            {/* Seletor de Meses para Comparação */}
            <div className="flex items-center gap-1.5 bg-zinc-900/90 border border-zinc-700 p-1 rounded-2xl">
              <span className="text-xs font-semibold text-muted-foreground px-2 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" /> Meses:
              </span>
              {allMonths.map(m => {
                const isSelected = selectedMonths.includes(m);
                return (
                  <button
                    key={m}
                    onClick={() => toggleMonth(m)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                      isSelected
                        ? 'bg-emerald-500 text-black shadow-md shadow-emerald-500/20'
                        : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
                    }`}
                  >
                    {monthLabels[m]}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Cards de KPIs Consolidados do Período */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Receita Total */}
          <div className="bg-card border border-border p-6 rounded-3xl shadow-sm relative overflow-hidden bg-gradient-to-br from-emerald-500/10 via-transparent to-transparent">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Receita Total Gerada</p>
                <h3 className="text-3xl font-black text-emerald-400 mt-2">
                  {formatMoney(grandTotal.revenue)}
                </h3>
              </div>
              <div className="p-3 bg-emerald-500/15 rounded-2xl text-emerald-400">
                <DollarSign className="w-6 h-6" />
              </div>
            </div>
            {momComparison && (
              <div className="mt-4 flex items-center gap-1.5 text-xs font-bold">
                {momComparison.revGrowth >= 0 ? (
                  <span className="text-emerald-400 flex items-center gap-0.5">
                    <TrendingUp className="w-3.5 h-3.5" /> +{momComparison.revGrowth}%
                  </span>
                ) : (
                  <span className="text-rose-400 flex items-center gap-0.5">
                    <TrendingDown className="w-3.5 h-3.5" /> {momComparison.revGrowth}%
                  </span>
                )}
                <span className="text-muted-foreground font-normal">
                  vs {momComparison.prevLabel} ({formatMoney(momComparison.prevRevenue)})
                </span>
              </div>
            )}
          </div>

          {/* Card 2: Vendas Convertidas */}
          <div className="bg-card border border-border p-6 rounded-3xl shadow-sm">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Vendas Convertidas</p>
                <h3 className="text-3xl font-black text-foreground mt-2">
                  {grandTotal.sales} <span className="text-sm font-normal text-muted-foreground">pedidos</span>
                </h3>
              </div>
              <div className="p-3 bg-indigo-500/15 rounded-2xl text-indigo-400">
                <Target className="w-6 h-6" />
              </div>
            </div>
            {momComparison && (
              <div className="mt-4 flex items-center gap-1.5 text-xs font-bold">
                {momComparison.salesGrowth >= 0 ? (
                  <span className="text-emerald-400 flex items-center gap-0.5">
                    <TrendingUp className="w-3.5 h-3.5" /> +{momComparison.salesGrowth}%
                  </span>
                ) : (
                  <span className="text-rose-400 flex items-center gap-0.5">
                    <TrendingDown className="w-3.5 h-3.5" /> {momComparison.salesGrowth}%
                  </span>
                )}
                <span className="text-muted-foreground font-normal">
                  vs {momComparison.prevLabel} ({momComparison.prevSales} vnd)
                </span>
              </div>
            )}
          </div>

          {/* Card 3: Mensagens Enviadas */}
          <div className="bg-card border border-border p-6 rounded-3xl shadow-sm">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Mensagens Enviadas</p>
                <h3 className="text-3xl font-black text-foreground mt-2">
                  {grandTotal.msgs} <span className="text-sm font-normal text-muted-foreground">msgs</span>
                </h3>
              </div>
              <div className="p-3 bg-sky-500/15 rounded-2xl text-sky-400">
                <MessageSquare className="w-6 h-6" />
              </div>
            </div>
            {momComparison && (
              <div className="mt-4 flex items-center gap-1.5 text-xs font-bold">
                {momComparison.msgsGrowth >= 0 ? (
                  <span className="text-sky-400 flex items-center gap-0.5">
                    <TrendingUp className="w-3.5 h-3.5" /> +{momComparison.msgsGrowth}%
                  </span>
                ) : (
                  <span className="text-rose-400 flex items-center gap-0.5">
                    <TrendingDown className="w-3.5 h-3.5" /> {momComparison.msgsGrowth}%
                  </span>
                )}
                <span className="text-muted-foreground font-normal">
                  vs {momComparison.prevLabel} ({momComparison.prevMsgs} msgs)
                </span>
              </div>
            )}
          </div>

          {/* Card 4: Taxa de Conversão & Ticket Médio */}
          <div className="bg-card border border-border p-6 rounded-3xl shadow-sm">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Taxa Média & Ticket</p>
                <h3 className="text-3xl font-black text-amber-400 mt-2">
                  {grandTotal.convRate}%
                </h3>
              </div>
              <div className="p-3 bg-amber-500/15 rounded-2xl text-amber-400">
                <Sparkles className="w-6 h-6" />
              </div>
            </div>
            <div className="mt-4 text-xs text-muted-foreground font-medium flex items-center justify-between">
              <span>Ticket Médio por Venda:</span>
              <span className="font-bold text-foreground">{formatMoney(grandTotal.avgTicket)}</span>
            </div>
          </div>
        </div>

        {/* Abas de Navegação / Modos de Visualização */}
        <div className="flex items-center gap-2 border-b border-border pb-4">
          <button
            onClick={() => setActiveTab('SELLERS')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-2xl font-bold text-sm transition-all ${
              activeTab === 'SELLERS'
                ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20'
                : 'text-muted-foreground hover:text-foreground hover:bg-card border border-transparent'
            }`}
          >
            <Users className="w-4 h-4" />
            Tabela Comparativa por Vendedor
          </button>

          <button
            onClick={() => setActiveTab('CAMPAIGNS')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-2xl font-bold text-sm transition-all ${
              activeTab === 'CAMPAIGNS'
                ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20'
                : 'text-muted-foreground hover:text-foreground hover:bg-card border border-transparent'
            }`}
          >
            <Layers className="w-4 h-4" />
            Comparativo por Campanha
          </button>
        </div>

        {/* TABELA 1: COMPARATIVO POR VENDEDOR MÊS A MÊS LADO A LADO */}
        {activeTab === 'SELLERS' && (
          <div className="bg-card border border-border rounded-3xl overflow-hidden shadow-sm">
            <div className="p-6 bg-muted/20 border-b border-border flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-foreground">
                  Performance Lado a Lado dos Atendentes
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Análise direta de mensagens, vendas convertidas, taxa de conversão e receita gerada por mês.
                </p>
              </div>

              {selectedMonths.length >= 2 && (
                <span className="text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-3 py-1.5 rounded-xl">
                  ✓ Comparando {selectedMonths.map(m => monthLabels[m]).join(' vs ')}
                </span>
              )}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  {/* Linha 1 de Cabeçalho: Nome do Vendedor + Blocos de Meses */}
                  <tr className="border-b border-border bg-muted/40 text-muted-foreground text-xs uppercase tracking-wider">
                    <th className="py-4 px-6 text-left font-bold whitespace-nowrap sticky left-0 bg-card z-10">
                      Atendente / Vendedor
                    </th>
                    {selectedMonths.map(m => (
                      <th
                        key={m}
                        colSpan={4}
                        className="py-3 px-4 text-center font-bold border-l border-border bg-muted/20 text-foreground text-sm"
                      >
                        {monthLabels[m]}
                      </th>
                    ))}
                    {selectedMonths.length >= 2 && (
                      <th
                        colSpan={2}
                        className="py-3 px-4 text-center font-bold border-l border-emerald-500/30 bg-emerald-500/10 text-emerald-400 text-sm"
                      >
                        Evolução (MoM)
                      </th>
                    )}
                  </tr>

                  {/* Linha 2 de Cabeçalho: Subcolunas de cada mês */}
                  <tr className="border-b border-border bg-muted/20 text-muted-foreground text-[11px] font-semibold">
                    <th className="py-2.5 px-6 text-left whitespace-nowrap sticky left-0 bg-card z-10"></th>
                    {selectedMonths.map(m => (
                      <React.Fragment key={m}>
                        <th className="py-2.5 px-3 text-center border-l border-border">Msgs</th>
                        <th className="py-2.5 px-3 text-center">Vendas</th>
                        <th className="py-2.5 px-3 text-center">Taxa</th>
                        <th className="py-2.5 px-4 text-right">Receita</th>
                      </React.Fragment>
                    ))}
                    {selectedMonths.length >= 2 && (
                      <>
                        <th className="py-2.5 px-4 text-center border-l border-emerald-500/30">Δ Vendas</th>
                        <th className="py-2.5 px-4 text-right">Δ Receita</th>
                      </>
                    )}
                  </tr>
                </thead>

                <tbody className="divide-y divide-border">
                  {visibleSellers.map(seller => {
                    // Cálculo de crescimento se houver 2 meses
                    let deltaSales = 0;
                    let deltaRevenue = 0;
                    let deltaRevenuePercent = 0;

                    if (selectedMonths.length >= 2) {
                      const mFirst = selectedMonths[0];
                      const mLast = selectedMonths[selectedMonths.length - 1];
                      const firstData = matrixSellerMonth[seller]?.[mFirst] || { sales: 0, revenue: 0 };
                      const lastData = matrixSellerMonth[seller]?.[mLast] || { sales: 0, revenue: 0 };

                      deltaSales = lastData.sales - firstData.sales;
                      deltaRevenue = lastData.revenue - firstData.revenue;
                      deltaRevenuePercent = firstData.revenue > 0 
                        ? Number((((lastData.revenue - firstData.revenue) / firstData.revenue) * 100).toFixed(1))
                        : (lastData.revenue > 0 ? 100 : 0);
                    }

                    return (
                      <tr key={seller} className="hover:bg-muted/10 transition-colors">
                        {/* Nome do Vendedor */}
                        <td className="py-4 px-6 font-bold capitalize text-foreground whitespace-nowrap sticky left-0 bg-card z-10">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs">
                              {seller.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <span>{seller}</span>
                            </div>
                          </div>
                        </td>

                        {/* Colunas de Cada Mês */}
                        {selectedMonths.map(m => {
                          const data = matrixSellerMonth[seller]?.[m] || { msgs: 0, sales: 0, revenue: 0, convRate: '0.0' };
                          const hasSales = data.sales > 0;
                          return (
                            <React.Fragment key={m}>
                              <td className="py-4 px-3 text-center border-l border-border font-medium text-foreground">
                                {data.msgs}
                              </td>
                              <td className="py-4 px-3 text-center font-bold text-foreground">
                                {data.sales > 0 ? (
                                  <span className="text-emerald-400">{data.sales}</span>
                                ) : (
                                  <span className="text-muted-foreground">0</span>
                                )}
                              </td>
                              <td className="py-4 px-3 text-center">
                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold ${
                                  Number(data.convRate) > 0 
                                    ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20' 
                                    : 'text-zinc-400'
                                }`}>
                                  {data.convRate}%
                                </span>
                              </td>
                              <td className="py-4 px-4 text-right font-bold whitespace-nowrap text-foreground">
                                {hasSales ? (
                                  <span className="text-emerald-400">{formatMoney(data.revenue)}</span>
                                ) : (
                                  <span className="text-muted-foreground">R$ 0,00</span>
                                )}
                              </td>
                            </React.Fragment>
                          );
                        })}

                        {/* Colunas de Evolução MoM */}
                        {selectedMonths.length >= 2 && (
                          <>
                            <td className="py-4 px-4 text-center border-l border-emerald-500/30 font-bold">
                              {deltaSales > 0 ? (
                                <span className="text-emerald-400 flex items-center justify-center gap-0.5">
                                  <TrendingUp className="w-3.5 h-3.5" /> +{deltaSales}
                                </span>
                              ) : deltaSales < 0 ? (
                                <span className="text-rose-400 flex items-center justify-center gap-0.5">
                                  <TrendingDown className="w-3.5 h-3.5" /> {deltaSales}
                                </span>
                              ) : (
                                <span className="text-zinc-500">0</span>
                              )}
                            </td>
                            <td className="py-4 px-4 text-right font-bold whitespace-nowrap">
                              {deltaRevenue > 0 ? (
                                <span className="text-emerald-400">
                                  +{formatMoney(deltaRevenue)} <span className="text-[10px] font-semibold">({deltaRevenuePercent > 0 ? `+${deltaRevenuePercent}%` : `${deltaRevenuePercent}%`})</span>
                                </span>
                              ) : deltaRevenue < 0 ? (
                                <span className="text-rose-400">
                                  {formatMoney(deltaRevenue)} <span className="text-[10px] font-semibold">({deltaRevenuePercent}%)</span>
                                </span>
                              ) : (
                                <span className="text-zinc-500">R$ 0,00</span>
                              )}
                            </td>
                          </>
                        )}
                      </tr>
                    );
                  })}

                  {/* Linha de Total Geral da Equipe */}
                  <tr className="bg-muted/40 font-black border-t-2 border-border text-foreground">
                    <td className="py-5 px-6 uppercase tracking-wider sticky left-0 bg-muted/60 z-10 text-emerald-400 flex items-center gap-2">
                      <Award className="w-4 h-4" /> Total da Equipe
                    </td>
                    {selectedMonths.map(m => {
                      const data = monthTotals[m] || { msgs: 0, sales: 0, revenue: 0, convRate: '0.0' };
                      return (
                        <React.Fragment key={m}>
                          <td className="py-5 px-3 text-center border-l border-border text-base">
                            {data.msgs}
                          </td>
                          <td className="py-5 px-3 text-center text-emerald-400 text-base">
                            {data.sales}
                          </td>
                          <td className="py-5 px-3 text-center">
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-black bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                              {data.convRate}%
                            </span>
                          </td>
                          <td className="py-5 px-4 text-right text-emerald-400 text-base">
                            {formatMoney(data.revenue)}
                          </td>
                        </React.Fragment>
                      );
                    })}
                    {selectedMonths.length >= 2 && momComparison && (
                      <>
                        <td className="py-5 px-4 text-center border-l border-emerald-500/30 text-emerald-400 font-bold">
                          {momComparison.currSales - momComparison.prevSales > 0 
                            ? `+${momComparison.currSales - momComparison.prevSales}` 
                            : momComparison.currSales - momComparison.prevSales}
                        </td>
                        <td className="py-5 px-4 text-right font-black text-emerald-400 text-base">
                          {momComparison.currRevenue - momComparison.prevRevenue > 0 ? '+' : ''}
                          {formatMoney(momComparison.currRevenue - momComparison.prevRevenue)}
                        </td>
                      </>
                    )}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TABELA 2: COMPARATIVO POR CAMPANHA */}
        {activeTab === 'CAMPAIGNS' && (
          <div className="bg-card border border-border rounded-3xl overflow-hidden shadow-sm">
            <div className="p-6 bg-muted/20 border-b border-border flex justify-between items-center">
              <div>
                <h2 className="text-lg font-bold text-foreground">Performance Lado a Lado por Campanha</h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Descubra quais canais e gatilhos (Cashback 10d, Ausente 45d, Pós-Venda, Leads BPE25, etc.) geram maior receita mês a mês.
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/40 text-muted-foreground text-xs uppercase tracking-wider">
                    <th className="py-4 px-6 text-left font-bold whitespace-nowrap sticky left-0 bg-card z-10">
                      Campanha / Canal
                    </th>
                    {selectedMonths.map(m => (
                      <th
                        key={m}
                        colSpan={4}
                        className="py-3 px-4 text-center font-bold border-l border-border bg-muted/20 text-foreground text-sm"
                      >
                        {monthLabels[m]}
                      </th>
                    ))}
                  </tr>
                  <tr className="border-b border-border bg-muted/20 text-muted-foreground text-[11px] font-semibold">
                    <th className="py-2.5 px-6 text-left whitespace-nowrap sticky left-0 bg-card z-10"></th>
                    {selectedMonths.map(m => (
                      <React.Fragment key={m}>
                        <th className="py-2.5 px-3 text-center border-l border-border">Msgs</th>
                        <th className="py-2.5 px-3 text-center">Vendas</th>
                        <th className="py-2.5 px-3 text-center">Taxa</th>
                        <th className="py-2.5 px-4 text-right">Receita</th>
                      </React.Fragment>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {Object.keys(matrixCampaignMonth).map(campaign => (
                    <tr key={campaign} className="hover:bg-muted/10 transition-colors">
                      <td className="py-4 px-6 font-bold text-foreground whitespace-nowrap sticky left-0 bg-card z-10">
                        {campaign}
                      </td>
                      {selectedMonths.map(m => {
                        const data = matrixCampaignMonth[campaign]?.[m] || { msgs: 0, sales: 0, revenue: 0, convRate: '0.0' };
                        return (
                          <React.Fragment key={m}>
                            <td className="py-4 px-3 text-center border-l border-border font-medium text-foreground">
                              {data.msgs}
                            </td>
                            <td className="py-4 px-3 text-center font-bold text-foreground">
                              {data.sales > 0 ? (
                                <span className="text-emerald-400">{data.sales}</span>
                              ) : (
                                <span className="text-muted-foreground">0</span>
                              )}
                            </td>
                            <td className="py-4 px-3 text-center">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold ${
                                Number(data.convRate) > 0 
                                  ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20' 
                                  : 'text-zinc-400'
                              }`}>
                                {data.convRate}%
                              </span>
                            </td>
                            <td className="py-4 px-4 text-right font-bold whitespace-nowrap text-foreground">
                              {data.revenue > 0 ? (
                                <span className="text-emerald-400">{formatMoney(data.revenue)}</span>
                              ) : (
                                <span className="text-muted-foreground">R$ 0,00</span>
                              )}
                            </td>
                          </React.Fragment>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
