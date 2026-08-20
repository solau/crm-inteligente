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
  Layers, 
  Sparkles, 
  Award, 
  ChevronDown, 
  ChevronRight, 
  Filter, 
  Maximize2, 
  Minimize2,
  Tag
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
  // 1. Extrair meses, vendedores e campanhas únicos
  const { allMonths, allSellers, allCampaigns, monthLabels, campaignLabels } = useMemo(() => {
    const monthsSet = new Set<string>();
    const sellersSet = new Set<string>();
    const campaignsSet = new Set<string>();

    interactions.forEach(i => {
      const monthStr = i.created_at.slice(0, 7); // YYYY-MM
      monthsSet.add(monthStr);

      const profile = Array.isArray(i.user_profiles) ? i.user_profiles[0] : i.user_profiles;
      const seller = profile?.name || (i.user_id ? `Vendedor ${i.user_id.split('-')[0]}` : 'Sistema / Sem Vendedor');
      sellersSet.add(seller);

      const campaign = i.campaign_type || 'OUTROS';
      campaignsSet.add(campaign);
    });

    const months = Array.from(monthsSet).sort();
    const sellers = Array.from(sellersSet).sort();
    const campaigns = Array.from(campaignsSet).sort();

    const mLabels: Record<string, string> = {};
    months.forEach(m => {
      const [year, month] = m.split('-');
      const d = new Date(Number(year), Number(month) - 1, 1);
      const label = d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
      mLabels[m] = label.charAt(0).toUpperCase() + label.slice(1);
    });

    const cLabels: Record<string, string> = {
      'CASHBACK_1D': '⏰ Cashback (1 Dia)',
      'CASHBACK_5D': '⚡ Cashback (5 Dias)',
      'CASHBACK_10D': '🎁 Cashback (10 Dias)',
      'CASHBACK_15D': '🔥 Cashback (15 Dias)',
      'AUSENTE_45D': '💤 Ausente > 45d',
      'OFERTA_90D': '🛡️ Inativo > 90d',
      'POS_VENDA': '🤝 Pós-Venda (D+3)',
      'CORRIDA_ALPHAVILLE': '🏃 Corrida Alphaville',
      'LEADS_BPE25': '🎯 Leads BPE25',
      'OUTROS': '📌 Outros'
    };

    return {
      allMonths: months,
      allSellers: sellers,
      allCampaigns: campaigns,
      monthLabels: mLabels,
      campaignLabels: cLabels
    };
  }, [interactions]);

  // Estados dos Filtros
  const [selectedSeller, setSelectedSeller] = useState<string>('ALL');
  const [selectedCampaign, setSelectedCampaign] = useState<string>('ALL');
  const [selectedMonths, setSelectedMonths] = useState<string[]>(allMonths);
  const [activeView, setActiveView] = useState<'SELLER_FIRST' | 'CAMPAIGN_FIRST'>('SELLER_FIRST');
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set(allSellers));

  const formatMoney = (val: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

  // Toggle Mês
  const toggleMonth = (m: string) => {
    if (selectedMonths.includes(m)) {
      if (selectedMonths.length > 1) {
        setSelectedMonths(selectedMonths.filter(x => x !== m));
      }
    } else {
      setSelectedMonths([...selectedMonths, m].sort());
    }
  };

  // Toggle Linha Expandida
  const toggleExpand = (key: string) => {
    const next = new Set(expandedKeys);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setExpandedKeys(next);
  };

  const expandAll = () => {
    if (activeView === 'SELLER_FIRST') {
      setExpandedKeys(new Set(allSellers));
    } else {
      setExpandedKeys(new Set(allCampaigns));
    }
  };

  const collapseAll = () => {
    setExpandedKeys(new Set());
  };

  // 2. Processamento da Matriz Cruzada Completa (Vendedor x Campanha x Mês)
  const {
    sellerCampaignMatrix,
    campaignSellerMatrix,
    monthTotals,
    grandTotal
  } = useMemo(() => {
    // sellerCampaignMatrix[seller][campaign][month] = { msgs, sales, revenue, convRate }
    const scm: Record<string, Record<string, Record<string, { msgs: number; sales: number; revenue: number; convRate: string }>>> = {};
    // campaignSellerMatrix[campaign][seller][month]
    const csm: Record<string, Record<string, Record<string, { msgs: number; sales: number; revenue: number; convRate: string }>>> = {};

    const mTotals: Record<string, { msgs: number; sales: number; revenue: number; convRate: string }> = {};

    let gMsgs = 0;
    let gSales = 0;
    let gRevenue = 0;

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

      // Filtros
      if (selectedSeller !== 'ALL' && seller !== selectedSeller) return;
      if (selectedCampaign !== 'ALL' && campaign !== selectedCampaign) return;

      // Totais Globais dos Meses Selecionados
      if (selectedMonths.includes(month)) {
        gMsgs++;
        if (hasSale) gSales++;
        gRevenue += rev;
      }

      // Totais por Mês
      mTotals[month].msgs++;
      if (hasSale) mTotals[month].sales++;
      mTotals[month].revenue += rev;

      // SCM (Vendedor -> Campanha -> Mês)
      if (!scm[seller]) scm[seller] = {};
      if (!scm[seller][campaign]) {
        scm[seller][campaign] = {};
        allMonths.forEach(m => {
          scm[seller][campaign][m] = { msgs: 0, sales: 0, revenue: 0, convRate: '0.0' };
        });
      }
      scm[seller][campaign][month].msgs++;
      if (hasSale) scm[seller][campaign][month].sales++;
      scm[seller][campaign][month].revenue += rev;

      // CSM (Campanha -> Vendedor -> Mês)
      if (!csm[campaign]) csm[campaign] = {};
      if (!csm[campaign][seller]) {
        csm[campaign][seller] = {};
        allMonths.forEach(m => {
          csm[campaign][seller][m] = { msgs: 0, sales: 0, revenue: 0, convRate: '0.0' };
        });
      }
      csm[campaign][seller][month].msgs++;
      if (hasSale) csm[campaign][seller][month].sales++;
      csm[campaign][seller][month].revenue += rev;
    });

    // Calcular taxas de conversão
    Object.keys(scm).forEach(s => {
      Object.keys(scm[s]).forEach(c => {
        allMonths.forEach(m => {
          const item = scm[s][c][m];
          item.convRate = item.msgs > 0 ? ((item.sales / item.msgs) * 100).toFixed(1) : '0.0';
        });
      });
    });

    Object.keys(csm).forEach(c => {
      Object.keys(csm[c]).forEach(s => {
        allMonths.forEach(m => {
          const item = csm[c][s][m];
          item.convRate = item.msgs > 0 ? ((item.sales / item.msgs) * 100).toFixed(1) : '0.0';
        });
      });
    });

    allMonths.forEach(m => {
      const mt = mTotals[m];
      mt.convRate = mt.msgs > 0 ? ((mt.sales / mt.msgs) * 100).toFixed(1) : '0.0';
    });

    const gConv = gMsgs > 0 ? ((gSales / gMsgs) * 100).toFixed(1) : '0.0';

    return {
      sellerCampaignMatrix: scm,
      campaignSellerMatrix: csm,
      monthTotals: mTotals,
      grandTotal: {
        msgs: gMsgs,
        sales: gSales,
        revenue: gRevenue,
        convRate: gConv,
        avgTicket: gSales > 0 ? gRevenue / gSales : 0
      }
    };
  }, [interactions, allMonths, selectedSeller, selectedCampaign, selectedMonths]);

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
        
        {/* Header com Título e Filtros Combinados (Vendedor + Campanha + Meses) */}
        <div className="bg-card border border-border p-6 rounded-3xl shadow-sm space-y-6">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  Dashboard de Conversão Avançado
                </span>
                <span className="px-3 py-1 rounded-full text-xs font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                  Vendedor + Campanha Cruzados
                </span>
              </div>
              <h1 className="text-2xl md:text-3xl font-black tracking-tight text-foreground mt-2">
                Comparativo Cruzado: Campanha & Vendedor Mês a Mês
              </h1>
              <p className="text-muted-foreground mt-1 text-sm">
                Analise a performance de cada atendente em cada gatilho/campanha e compare a evolução lado a lado entre os meses.
              </p>
            </div>

            {/* Controles de Expansão Rápida */}
            <div className="flex items-center gap-2">
              <button
                onClick={expandAll}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-zinc-800 hover:bg-zinc-700 text-zinc-200 transition-colors border border-zinc-700"
              >
                <Maximize2 className="w-3.5 h-3.5" /> Expandir Todos
              </button>
              <button
                onClick={collapseAll}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-zinc-800 hover:bg-zinc-700 text-zinc-200 transition-colors border border-zinc-700"
              >
                <Minimize2 className="w-3.5 h-3.5" /> Recolher Todos
              </button>
            </div>
          </div>

          {/* Barra de Filtros Combinados */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-border">
            {/* 1. Filtro por Vendedor */}
            <div className="flex items-center gap-2 bg-zinc-900 border border-zinc-700 px-3 py-2 rounded-2xl">
              <Users className="w-4 h-4 text-emerald-400 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-[10px] text-zinc-400 font-semibold uppercase">Filtrar Atendente</p>
                <select
                  value={selectedSeller}
                  onChange={(e) => setSelectedSeller(e.target.value)}
                  className="w-full bg-zinc-900 text-white font-bold text-sm focus:outline-none cursor-pointer border-none"
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
            </div>

            {/* 2. Filtro por Campanha */}
            <div className="flex items-center gap-2 bg-zinc-900 border border-zinc-700 px-3 py-2 rounded-2xl">
              <Tag className="w-4 h-4 text-indigo-400 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-[10px] text-zinc-400 font-semibold uppercase">Filtrar Campanha</p>
                <select
                  value={selectedCampaign}
                  onChange={(e) => setSelectedCampaign(e.target.value)}
                  className="w-full bg-zinc-900 text-white font-bold text-sm focus:outline-none cursor-pointer border-none"
                  style={{ colorScheme: 'dark', backgroundColor: '#18181b', color: '#ffffff' }}
                >
                  <option value="ALL" style={{ backgroundColor: '#18181b', color: '#ffffff' }}>
                    🎯 Todas as Campanhas
                  </option>
                  {allCampaigns.map(c => (
                    <option key={c} value={c} style={{ backgroundColor: '#18181b', color: '#ffffff' }}>
                      {campaignLabels[c] || c}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* 3. Seleção de Meses */}
            <div className="flex items-center gap-2 bg-zinc-900 border border-zinc-700 px-3 py-2 rounded-2xl">
              <Calendar className="w-4 h-4 text-amber-400 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-[10px] text-zinc-400 font-semibold uppercase">Meses em Comparação</p>
                <div className="flex items-center gap-1 mt-1">
                  {allMonths.map(m => {
                    const isSelected = selectedMonths.includes(m);
                    return (
                      <button
                        key={m}
                        onClick={() => toggleMonth(m)}
                        className={`px-2.5 py-0.5 rounded-lg text-xs font-bold transition-all ${
                          isSelected
                            ? 'bg-emerald-500 text-black shadow-sm'
                            : 'text-zinc-400 hover:text-white bg-zinc-800'
                        }`}
                      >
                        {monthLabels[m].split(' ')[0]}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Cards de KPIs Consolidados */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Receita */}
          <div className="bg-card border border-border p-6 rounded-3xl shadow-sm relative overflow-hidden bg-gradient-to-br from-emerald-500/10 via-transparent to-transparent">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Receita Filtrada</p>
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
                  vs {momComparison.prevLabel.split(' ')[0]} ({formatMoney(momComparison.prevRevenue)})
                </span>
              </div>
            )}
          </div>

          {/* Card 2: Vendas */}
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
                  vs {momComparison.prevLabel.split(' ')[0]} ({momComparison.prevSales} vnd)
                </span>
              </div>
            )}
          </div>

          {/* Card 3: Mensagens */}
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
                  vs {momComparison.prevLabel.split(' ')[0]} ({momComparison.prevMsgs} msgs)
                </span>
              </div>
            )}
          </div>

          {/* Card 4: Conversão */}
          <div className="bg-card border border-border p-6 rounded-3xl shadow-sm">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Taxa & Ticket Médio</p>
                <h3 className="text-3xl font-black text-amber-400 mt-2">
                  {grandTotal.convRate}%
                </h3>
              </div>
              <div className="p-3 bg-amber-500/15 rounded-2xl text-amber-400">
                <Sparkles className="w-6 h-6" />
              </div>
            </div>
            <div className="mt-4 text-xs text-muted-foreground font-medium flex items-center justify-between">
              <span>Ticket Médio:</span>
              <span className="font-bold text-foreground">{formatMoney(grandTotal.avgTicket)}</span>
            </div>
          </div>
        </div>

        {/* Seletor de Modo de Agrupamento */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setActiveView('SELLER_FIRST')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-2xl font-bold text-sm transition-all ${
              activeView === 'SELLER_FIRST'
                ? 'bg-primary text-primary-foreground shadow-md shadow-primary/20'
                : 'text-muted-foreground hover:text-foreground bg-card border border-border'
            }`}
          >
            <Users className="w-4 h-4" />
            Por Vendedor (com detalhamento por campanha)
          </button>

          <button
            onClick={() => setActiveView('CAMPAIGN_FIRST')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-2xl font-bold text-sm transition-all ${
              activeView === 'CAMPAIGN_FIRST'
                ? 'bg-primary text-primary-foreground shadow-md shadow-primary/20'
                : 'text-muted-foreground hover:text-foreground bg-card border border-border'
            }`}
          >
            <Layers className="w-4 h-4" />
            Por Campanha (com detalhamento por vendedor)
          </button>
        </div>

        {/* TABELA PRINCIPAL MÊS A MÊS LADO A LADO COM DRILLDOWN */}
        <div className="bg-card border border-border rounded-3xl overflow-hidden shadow-sm">
          <div className="p-6 bg-muted/20 border-b border-border flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                {activeView === 'SELLER_FIRST' ? (
                  <>👥 Comparativo de Atendentes & Campanhas Mês a Mês</>
                ) : (
                  <>🎯 Comparativo de Campanhas & Atendentes Mês a Mês</>
                )}
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Clique nas linhas para expandir/recolher e inspecionar cada campanha individualmente.
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
                {/* Linha 1 de Cabeçalho: Agrupamento + Blocos de Meses */}
                <tr className="border-b border-border bg-muted/40 text-muted-foreground text-xs uppercase tracking-wider">
                  <th className="py-4 px-6 text-left font-bold whitespace-nowrap sticky left-0 bg-card z-10">
                    {activeView === 'SELLER_FIRST' ? 'Vendedor / Campanha' : 'Campanha / Vendedor'}
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
                      Evolução MoM
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
                {/* 1. MODO: AGRUPADO POR VENDEDOR */}
                {activeView === 'SELLER_FIRST' &&
                  Object.keys(sellerCampaignMatrix).map(seller => {
                    const campaignsOfSeller = Object.keys(sellerCampaignMatrix[seller] || {});
                    const isExpanded = expandedKeys.has(seller);

                    // Totais do Vendedor por Mês
                    const sellerMonthTotals: Record<string, { msgs: number; sales: number; revenue: number; convRate: string }> = {};
                    allMonths.forEach(m => {
                      let msgs = 0, sales = 0, revenue = 0;
                      campaignsOfSeller.forEach(c => {
                        const cell = sellerCampaignMatrix[seller][c][m];
                        if (cell) {
                          msgs += cell.msgs;
                          sales += cell.sales;
                          revenue += cell.revenue;
                        }
                      });
                      const convRate = msgs > 0 ? ((sales / msgs) * 100).toFixed(1) : '0.0';
                      sellerMonthTotals[m] = { msgs, sales, revenue, convRate };
                    });

                    // MoM do Vendedor
                    let deltaSales = 0;
                    let deltaRevenue = 0;
                    let deltaRevenuePercent = 0;

                    if (selectedMonths.length >= 2) {
                      const mFirst = selectedMonths[0];
                      const mLast = selectedMonths[selectedMonths.length - 1];
                      const firstData = sellerMonthTotals[mFirst] || { sales: 0, revenue: 0 };
                      const lastData = sellerMonthTotals[mLast] || { sales: 0, revenue: 0 };

                      deltaSales = lastData.sales - firstData.sales;
                      deltaRevenue = lastData.revenue - firstData.revenue;
                      deltaRevenuePercent = firstData.revenue > 0
                        ? Number((((lastData.revenue - firstData.revenue) / firstData.revenue) * 100).toFixed(1))
                        : (lastData.revenue > 0 ? 100 : 0);
                    }

                    return (
                      <React.Fragment key={seller}>
                        {/* Linha Pai: Vendedor */}
                        <tr 
                          onClick={() => toggleExpand(seller)}
                          className="bg-card hover:bg-muted/30 transition-colors cursor-pointer font-bold border-t border-border/80"
                        >
                          <td className="py-4 px-6 text-foreground whitespace-nowrap sticky left-0 bg-card z-10">
                            <div className="flex items-center gap-2">
                              {isExpanded ? (
                                <ChevronDown className="w-4 h-4 text-emerald-400" />
                              ) : (
                                <ChevronRight className="w-4 h-4 text-zinc-400" />
                              )}
                              <div className="w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs">
                                {seller.charAt(0).toUpperCase()}
                              </div>
                              <span className="text-base">{seller}</span>
                              <span className="text-xs font-normal text-muted-foreground">
                                ({campaignsOfSeller.length} campanhas)
                              </span>
                            </div>
                          </td>

                          {selectedMonths.map(m => {
                            const data = sellerMonthTotals[m];
                            return (
                              <React.Fragment key={m}>
                                <td className="py-4 px-3 text-center border-l border-border font-bold text-foreground">
                                  {data.msgs}
                                </td>
                                <td className="py-4 px-3 text-center font-black">
                                  {data.sales > 0 ? (
                                    <span className="text-emerald-400">{data.sales}</span>
                                  ) : (
                                    <span className="text-muted-foreground">0</span>
                                  )}
                                </td>
                                <td className="py-4 px-3 text-center">
                                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-black ${
                                    Number(data.convRate) > 0
                                      ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20'
                                      : 'text-zinc-400'
                                  }`}>
                                    {data.convRate}%
                                  </span>
                                </td>
                                <td className="py-4 px-4 text-right font-black whitespace-nowrap text-base">
                                  {data.revenue > 0 ? (
                                    <span className="text-emerald-400">{formatMoney(data.revenue)}</span>
                                  ) : (
                                    <span className="text-muted-foreground">R$ 0,00</span>
                                  )}
                                </td>
                              </React.Fragment>
                            );
                          })}

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
                              <td className="py-4 px-4 text-right font-black whitespace-nowrap">
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

                        {/* Linhas Filhas: Campanhas do Vendedor */}
                        {isExpanded &&
                          campaignsOfSeller.map(c => {
                            return (
                              <tr key={`${seller}-${c}`} className="bg-muted/10 hover:bg-muted/20 transition-colors text-xs">
                                <td className="py-2.5 px-6 pl-12 text-muted-foreground font-medium whitespace-nowrap sticky left-0 bg-muted/15 z-10">
                                  <div className="flex items-center gap-2">
                                    <Tag className="w-3 h-3 text-indigo-400" />
                                    <span>{campaignLabels[c] || c}</span>
                                  </div>
                                </td>

                                {selectedMonths.map(m => {
                                  const cell = sellerCampaignMatrix[seller][c][m] || { msgs: 0, sales: 0, revenue: 0, convRate: '0.0' };
                                  return (
                                    <React.Fragment key={m}>
                                      <td className="py-2.5 px-3 text-center border-l border-border text-muted-foreground">
                                        {cell.msgs}
                                      </td>
                                      <td className="py-2.5 px-3 text-center font-bold">
                                        {cell.sales > 0 ? (
                                          <span className="text-emerald-400">{cell.sales}</span>
                                        ) : (
                                          <span className="text-zinc-500">0</span>
                                        )}
                                      </td>
                                      <td className="py-2.5 px-3 text-center">
                                        <span className={`text-[11px] font-semibold ${Number(cell.convRate) > 0 ? 'text-emerald-400' : 'text-zinc-500'}`}>
                                          {cell.convRate}%
                                        </span>
                                      </td>
                                      <td className="py-2.5 px-4 text-right font-medium whitespace-nowrap">
                                        {cell.revenue > 0 ? (
                                          <span className="text-emerald-400 font-semibold">{formatMoney(cell.revenue)}</span>
                                        ) : (
                                          <span className="text-zinc-500">R$ 0,00</span>
                                        )}
                                      </td>
                                    </React.Fragment>
                                  );
                                })}

                                {selectedMonths.length >= 2 && (
                                  <>
                                    <td className="py-2.5 px-4 text-center border-l border-emerald-500/30 text-zinc-400">
                                      -
                                    </td>
                                    <td className="py-2.5 px-4 text-right text-zinc-400">
                                      -
                                    </td>
                                  </>
                                )}
                              </tr>
                            );
                          })}
                      </React.Fragment>
                    );
                  })}

                {/* 2. MODO: AGRUPADO POR CAMPANHA */}
                {activeView === 'CAMPAIGN_FIRST' &&
                  Object.keys(campaignSellerMatrix).map(campaign => {
                    const sellersOfCampaign = Object.keys(campaignSellerMatrix[campaign] || {});
                    const isExpanded = expandedKeys.has(campaign);

                    // Totais da Campanha por Mês
                    const campaignMonthTotals: Record<string, { msgs: number; sales: number; revenue: number; convRate: string }> = {};
                    allMonths.forEach(m => {
                      let msgs = 0, sales = 0, revenue = 0;
                      sellersOfCampaign.forEach(s => {
                        const cell = campaignSellerMatrix[campaign][s][m];
                        if (cell) {
                          msgs += cell.msgs;
                          sales += cell.sales;
                          revenue += cell.revenue;
                        }
                      });
                      const convRate = msgs > 0 ? ((sales / msgs) * 100).toFixed(1) : '0.0';
                      campaignMonthTotals[m] = { msgs, sales, revenue, convRate };
                    });

                    return (
                      <React.Fragment key={campaign}>
                        {/* Linha Pai: Campanha */}
                        <tr
                          onClick={() => toggleExpand(campaign)}
                          className="bg-card hover:bg-muted/30 transition-colors cursor-pointer font-bold border-t border-border/80"
                        >
                          <td className="py-4 px-6 text-foreground whitespace-nowrap sticky left-0 bg-card z-10">
                            <div className="flex items-center gap-2">
                              {isExpanded ? (
                                <ChevronDown className="w-4 h-4 text-indigo-400" />
                              ) : (
                                <ChevronRight className="w-4 h-4 text-zinc-400" />
                              )}
                              <Tag className="w-4 h-4 text-indigo-400" />
                              <span className="text-base">{campaignLabels[campaign] || campaign}</span>
                              <span className="text-xs font-normal text-muted-foreground">
                                ({sellersOfCampaign.length} atendentes)
                              </span>
                            </div>
                          </td>

                          {selectedMonths.map(m => {
                            const data = campaignMonthTotals[m];
                            return (
                              <React.Fragment key={m}>
                                <td className="py-4 px-3 text-center border-l border-border font-bold text-foreground">
                                  {data.msgs}
                                </td>
                                <td className="py-4 px-3 text-center font-black">
                                  {data.sales > 0 ? (
                                    <span className="text-emerald-400">{data.sales}</span>
                                  ) : (
                                    <span className="text-muted-foreground">0</span>
                                  )}
                                </td>
                                <td className="py-4 px-3 text-center">
                                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-black ${
                                    Number(data.convRate) > 0
                                      ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20'
                                      : 'text-zinc-400'
                                  }`}>
                                    {data.convRate}%
                                  </span>
                                </td>
                                <td className="py-4 px-4 text-right font-black whitespace-nowrap text-base">
                                  {data.revenue > 0 ? (
                                    <span className="text-emerald-400">{formatMoney(data.revenue)}</span>
                                  ) : (
                                    <span className="text-muted-foreground">R$ 0,00</span>
                                  )}
                                </td>
                              </React.Fragment>
                            );
                          })}

                          {selectedMonths.length >= 2 && (
                            <>
                              <td className="py-4 px-4 text-center border-l border-emerald-500/30 text-zinc-400">-</td>
                              <td className="py-4 px-4 text-right text-zinc-400">-</td>
                            </>
                          )}
                        </tr>

                        {/* Linhas Filhas: Vendedores da Campanha */}
                        {isExpanded &&
                          sellersOfCampaign.map(s => {
                            return (
                              <tr key={`${campaign}-${s}`} className="bg-muted/10 hover:bg-muted/20 transition-colors text-xs">
                                <td className="py-2.5 px-6 pl-12 text-muted-foreground font-medium whitespace-nowrap sticky left-0 bg-muted/15 z-10">
                                  <div className="flex items-center gap-2">
                                    <Users className="w-3 h-3 text-emerald-400" />
                                    <span>{s}</span>
                                  </div>
                                </td>

                                {selectedMonths.map(m => {
                                  const cell = campaignSellerMatrix[campaign][s][m] || { msgs: 0, sales: 0, revenue: 0, convRate: '0.0' };
                                  return (
                                    <React.Fragment key={m}>
                                      <td className="py-2.5 px-3 text-center border-l border-border text-muted-foreground">
                                        {cell.msgs}
                                      </td>
                                      <td className="py-2.5 px-3 text-center font-bold">
                                        {cell.sales > 0 ? (
                                          <span className="text-emerald-400">{cell.sales}</span>
                                        ) : (
                                          <span className="text-zinc-500">0</span>
                                        )}
                                      </td>
                                      <td className="py-2.5 px-3 text-center">
                                        <span className={`text-[11px] font-semibold ${Number(cell.convRate) > 0 ? 'text-emerald-400' : 'text-zinc-500'}`}>
                                          {cell.convRate}%
                                        </span>
                                      </td>
                                      <td className="py-2.5 px-4 text-right font-medium whitespace-nowrap">
                                        {cell.revenue > 0 ? (
                                          <span className="text-emerald-400 font-semibold">{formatMoney(cell.revenue)}</span>
                                        ) : (
                                          <span className="text-zinc-500">R$ 0,00</span>
                                        )}
                                      </td>
                                    </React.Fragment>
                                  );
                                })}

                                {selectedMonths.length >= 2 && (
                                  <>
                                    <td className="py-2.5 px-4 text-center border-l border-emerald-500/30 text-zinc-400">-</td>
                                    <td className="py-2.5 px-4 text-right text-zinc-400">-</td>
                                  </>
                                )}
                              </tr>
                            );
                          })}
                      </React.Fragment>
                    );
                  })}

                {/* Linha de Total Geral */}
                <tr className="bg-muted/40 font-black border-t-2 border-border text-foreground">
                  <td className="py-5 px-6 uppercase tracking-wider sticky left-0 bg-muted/60 z-10 text-emerald-400 flex items-center gap-2">
                    <Award className="w-4 h-4" /> Total Consolidado
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

      </div>
    </div>
  );
}
