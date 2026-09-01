'use client';

import React, { useState, useMemo } from 'react';
import { 
  Calendar, 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  MessageSquare, 
  Target, 
  BrainCircuit, 
  Zap, 
  AlertTriangle, 
  Award, 
  Tag, 
  Sparkles,
  ArrowUp,
  ArrowDown,
  Clock,
  CheckCircle2,
  RefreshCw
} from 'lucide-react';
import { CampaignMtdStats } from '@/app/api/ai/meu-desempenho/route';

export interface RawSellerInteraction {
  id: string;
  campaign_type: string;
  user_id: string | null;
  created_at: string;
  sales_attribution?: {
    id: string;
    revenue: number;
    order_id?: string;
    created_at?: string;
  }[] | null;
}

interface MeuDesempenhoClientProps {
  sellerName: string;
  sellerId: string;
  interactions: RawSellerInteraction[];
}

export default function MeuDesempenhoClient({
  sellerName,
  interactions
}: MeuDesempenhoClientProps) {
  const [aiEvaluation, setAiEvaluation] = useState<string | null>(null);
  const [loadingAI, setLoadingAI] = useState(false);

  // Mapeamento de nomes de campanhas amigáveis
  const campaignLabels: Record<string, string> = {
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

  const formatMoney = (val: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

  // Cálculo MTD (Month-To-Date) e Comparativo com Mês Anterior até a mesma data
  const mtdStats = useMemo(() => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth(); // 0-11
    const currentDay = now.getDate(); // 1-31

    // Mês anterior
    const prevMonthDate = new Date(currentYear, currentMonth - 1, 1);
    const prevYear = prevMonthDate.getFullYear();
    const prevMonth = prevMonthDate.getMonth();

    const currentMonthKey = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`;
    const prevMonthKey = `${prevYear}-${String(prevMonth + 1).padStart(2, '0')}`;

    const currentMonthName = now.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
    const prevMonthName = prevMonthDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

    // Meta diária fixa
    const DAILY_GOAL = 60;
    const targetMsgs = currentDay * DAILY_GOAL;

    let currentMtdMsgs = 0;
    let currentMtdSales = 0;
    let currentMtdRevenue = 0;

    let prevMtdMsgs = 0;
    let prevMtdSales = 0;
    let prevMtdRevenue = 0;

    let prevFullMsgs = 0;
    let prevFullSales = 0;
    let prevFullRevenue = 0;

    // Estruturas por campanha
    const currentCampaignsMap: Record<string, { msgs: number; sales: number; revenue: number }> = {};
    const prevMtdCampaignsMap: Record<string, { msgs: number; sales: number; revenue: number }> = {};
    const allCampaignKeys = new Set<string>();

    interactions.forEach(i => {
      const iDate = new Date(i.created_at);
      const iYear = iDate.getFullYear();
      const iMonth = iDate.getMonth();
      const iDay = iDate.getDate();

      const campaign = i.campaign_type || 'OUTROS';
      allCampaignKeys.add(campaign);

      const hasSale = i.sales_attribution && i.sales_attribution.length > 0;
      const rev = hasSale ? i.sales_attribution!.reduce((acc, cur) => acc + Number(cur.revenue), 0) : 0;

      // 1. Mês Atual (MTD: até o dia atual)
      if (iYear === currentYear && iMonth === currentMonth) {
        if (iDay <= currentDay) {
          currentMtdMsgs++;
          if (hasSale) currentMtdSales++;
          currentMtdRevenue += rev;

          if (!currentCampaignsMap[campaign]) {
            currentCampaignsMap[campaign] = { msgs: 0, sales: 0, revenue: 0 };
          }
          currentCampaignsMap[campaign].msgs++;
          if (hasSale) currentCampaignsMap[campaign].sales++;
          currentCampaignsMap[campaign].revenue += rev;
        }
      }

      // 2. Mês Anterior
      if (iYear === prevYear && iMonth === prevMonth) {
        prevFullMsgs++;
        if (hasSale) prevFullSales++;
        prevFullRevenue += rev;

        // MTD do mês anterior (até o mesmo dia)
        if (iDay <= currentDay) {
          prevMtdMsgs++;
          if (hasSale) prevMtdSales++;
          prevMtdRevenue += rev;

          if (!prevMtdCampaignsMap[campaign]) {
            prevMtdCampaignsMap[campaign] = { msgs: 0, sales: 0, revenue: 0 };
          }
          prevMtdCampaignsMap[campaign].msgs++;
          if (hasSale) prevMtdCampaignsMap[campaign].sales++;
          prevMtdCampaignsMap[campaign].revenue += rev;
        }
      }
    });

    const currentMtdConvRate = currentMtdMsgs > 0 ? (currentMtdSales / currentMtdMsgs) * 100 : 0;
    const prevMtdConvRate = prevMtdMsgs > 0 ? (prevMtdSales / prevMtdMsgs) * 100 : 0;

    // Montar detalhamento de todas as campanhas
    const campaignsList: CampaignMtdStats[] = Array.from(allCampaignKeys).map(cKey => {
      const cur = currentCampaignsMap[cKey] || { msgs: 0, sales: 0, revenue: 0 };
      const prv = prevMtdCampaignsMap[cKey] || { msgs: 0, sales: 0, revenue: 0 };

      const cConv = cur.msgs > 0 ? (cur.sales / cur.msgs) * 100 : 0;
      const pConv = prv.msgs > 0 ? (prv.sales / prv.msgs) * 100 : 0;

      return {
        campaign: cKey,
        label: campaignLabels[cKey] || cKey,
        currentMsgs: cur.msgs,
        currentSales: cur.sales,
        currentConvRate: cConv,
        currentRevenue: cur.revenue,
        prevMtdMsgs: prv.msgs,
        prevMtdSales: prv.sales,
        prevMtdConvRate: pConv,
        prevMtdRevenue: prv.revenue
      };
    }).sort((a, b) => (b.currentRevenue + b.currentMsgs * 10) - (a.currentRevenue + a.currentMsgs * 10));

    // Variações MoM MTD
    const deltaMsgs = currentMtdMsgs - prevMtdMsgs;
    const deltaMsgsPercent = prevMtdMsgs > 0 ? ((deltaMsgs / prevMtdMsgs) * 100) : (currentMtdMsgs > 0 ? 100 : 0);

    const deltaSales = currentMtdSales - prevMtdSales;
    const deltaRevenue = currentMtdRevenue - prevMtdRevenue;
    const deltaRevenuePercent = prevMtdRevenue > 0 ? ((deltaRevenue / prevMtdRevenue) * 100) : (currentMtdRevenue > 0 ? 100 : 0);

    const deltaConv = currentMtdConvRate - prevMtdConvRate;

    const diffTarget = currentMtdMsgs - targetMsgs;
    const isAboveTarget = diffTarget >= 0;

    return {
      currentDay,
      currentMonthName: currentMonthName.charAt(0).toUpperCase() + currentMonthName.slice(1),
      previousMonthName: prevMonthName.charAt(0).toUpperCase() + prevMonthName.slice(1),
      targetMsgs,
      currentMtdMsgs,
      currentMtdSales,
      currentMtdConvRate,
      currentMtdRevenue,
      prevMtdMsgs,
      prevMtdSales,
      prevMtdConvRate,
      prevMtdRevenue,
      prevFullMsgs,
      prevFullSales,
      prevFullRevenue,
      deltaMsgs,
      deltaMsgsPercent,
      deltaSales,
      deltaRevenue,
      deltaRevenuePercent,
      deltaConv,
      diffTarget,
      isAboveTarget,
      campaignsList
    };
  }, [interactions]);

  // Disparo da Avaliação com IA
  const handleRunAiEvaluation = async () => {
    setLoadingAI(true);
    try {
      const payload = {
        sellerName,
        currentDay: mtdStats.currentDay,
        currentMonthName: mtdStats.currentMonthName,
        previousMonthName: mtdStats.previousMonthName,
        targetMsgs: mtdStats.targetMsgs,
        currentMtdMsgs: mtdStats.currentMtdMsgs,
        currentMtdSales: mtdStats.currentMtdSales,
        currentMtdConvRate: mtdStats.currentMtdConvRate,
        currentMtdRevenue: mtdStats.currentMtdRevenue,
        prevMtdMsgs: mtdStats.prevMtdMsgs,
        prevMtdSales: mtdStats.prevMtdSales,
        prevMtdConvRate: mtdStats.prevMtdConvRate,
        prevMtdRevenue: mtdStats.prevMtdRevenue,
        campaigns: mtdStats.campaignsList
      };

      const res = await fetch('/api/ai/meu-desempenho', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (data.success) {
        setAiEvaluation(data.analysis);
      } else {
        setAiEvaluation('⚠️ Ocorreu um erro ao gerar a avaliação com IA. Tente novamente em instantes.');
      }
    } catch (err) {
      console.error('Erro ao avaliar desempenho:', err);
      setAiEvaluation('⚠️ Falha de comunicação com o servidor de IA.');
    } finally {
      setLoadingAI(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-16">
      
      {/* 1. Header do Vendedor */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pt-2">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center text-white font-black text-2xl shadow-lg shadow-violet-500/20">
            {sellerName.charAt(0).toUpperCase()}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-violet-500/15 text-violet-400 border border-violet-500/30">
                Painel do Vendedor
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                <Clock className="w-3 h-3" /> Dia {mtdStats.currentDay} de {mtdStats.currentMonthName}
              </span>
            </div>
            <h1 className="text-2xl md:text-3xl font-black tracking-tight text-foreground mt-1">
              Meu Desempenho & Campanhas
            </h1>
            <p className="text-muted-foreground text-xs md:text-sm">
              Acompanhamento detalhado em tempo real comparando sempre com o mesmo período do mês anterior.
            </p>
          </div>
        </div>

        {/* Botão de Avaliação da IA */}
        <button
          onClick={handleRunAiEvaluation}
          disabled={loadingAI}
          className={`flex items-center gap-2.5 px-5 py-3 rounded-2xl font-bold text-sm text-white transition-all shadow-xl active:scale-95 border ${
            loadingAI
              ? 'bg-violet-600/50 border-violet-500/30 cursor-not-allowed'
              : 'bg-gradient-to-r from-violet-600 via-indigo-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 border-violet-400/40 shadow-violet-500/25'
          }`}
        >
          {loadingAI ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin text-violet-200" />
              <span>Gerando Avaliação com IA...</span>
            </>
          ) : (
            <>
              <BrainCircuit className="w-5 h-5 text-violet-200" />
              <span>Avaliar Meu Desempenho com IA</span>
            </>
          )}
        </button>
      </div>

      {/* 2. Banner da Meta MÍNIMA Obrigatória (60 msgs/dia) */}
      <div className="p-5 rounded-3xl bg-zinc-900/90 border border-zinc-800 shadow-sm relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="p-2.5 bg-amber-500/15 rounded-2xl text-amber-400 mt-0.5">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black text-white">
                  Meta Mínima Obrigatória: 60 Mensagens / Dia
                </h3>
                <span className="text-[10px] uppercase tracking-wider font-extrabold px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  Regra do CRM
                </span>
              </div>
              <p className="text-xs text-zinc-400 mt-1 max-w-2xl">
                Até o dia de hoje (dia {mtdStats.currentDay}), sua meta mínima acumulada é de{' '}
                <span className="text-white font-bold">{mtdStats.targetMsgs} mensagens</span>. 
                Meta semanal: <span className="text-white font-semibold">420 msgs</span> · Meta mensal: <span className="text-white font-semibold">1.800 msgs</span>.
              </p>
            </div>
          </div>

          {/* Status e Indicador vs Meta */}
          <div className="flex items-center gap-4 bg-zinc-950/80 px-4 py-3 rounded-2xl border border-zinc-800/80">
            <div className="text-right">
              <p className="text-[10px] text-zinc-400 font-semibold uppercase">Ritmo Atual</p>
              <div className="flex items-center gap-1.5 justify-end">
                <span className={`text-xl font-black ${mtdStats.isAboveTarget ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {mtdStats.currentMtdMsgs}
                </span>
                <span className="text-xs text-zinc-500 font-semibold">/ {mtdStats.targetMsgs}</span>
              </div>
            </div>
            <div className={`px-2.5 py-1 rounded-xl text-xs font-bold flex items-center gap-1 ${
              mtdStats.isAboveTarget ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
            }`}>
              {mtdStats.isAboveTarget ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>+{mtdStats.diffTarget} msgs</span>
                </>
              ) : (
                <>
                  <ArrowDown className="w-3.5 h-3.5" />
                  <span>{mtdStats.diffTarget} msgs</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Barra de Progresso da Meta Diária */}
        <div className="mt-4">
          <div className="flex justify-between items-center text-[10px] font-bold text-zinc-400 mb-1.5">
            <span>Progresso da Meta MTD</span>
            <span>{Math.min(200, ((mtdStats.currentMtdMsgs / (mtdStats.targetMsgs || 1)) * 100)).toFixed(0)}%</span>
          </div>
          <div className="w-full h-2.5 bg-zinc-800 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                mtdStats.isAboveTarget ? 'bg-gradient-to-r from-emerald-500 to-teal-400' : 'bg-gradient-to-r from-rose-500 to-amber-500'
              }`}
              style={{ width: `${Math.min(100, ((mtdStats.currentMtdMsgs / (mtdStats.targetMsgs || 1)) * 100))}%` }}
            />
          </div>
        </div>
      </div>

      {/* 3. Bloco de Avaliação da IA (Dossiê) */}
      {aiEvaluation && (
        <div className="p-6 rounded-3xl bg-zinc-900 border border-violet-500/30 shadow-2xl shadow-violet-500/10 space-y-4 animate-in fade-in zoom-in-95 duration-500">
          <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-violet-500/20 rounded-xl text-violet-400">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-black text-white flex items-center gap-2">
                  Avaliação da IA de Desempenho
                </h3>
                <p className="text-xs text-zinc-400">
                  Análise gerada pelo Gemini considerando o período de 1 a {mtdStats.currentDay} de {mtdStats.currentMonthName} vs {mtdStats.previousMonthName}.
                </p>
              </div>
            </div>
            <span className="text-[10px] font-bold px-3 py-1 rounded-full bg-violet-500/15 text-violet-300 border border-violet-500/30 uppercase tracking-wider">
              Análise Concluída
            </span>
          </div>

          <div className="prose prose-invert max-w-none text-zinc-200 text-sm leading-relaxed whitespace-pre-line">
            {aiEvaluation}
          </div>
        </div>
      )}

      {/* 4. Grid de KPIs Comparativos MTD (Mês Atual vs Mês Anterior até o dia X) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Card 1: Mensagens Enviadas */}
        <div className="bg-card border border-border p-6 rounded-3xl shadow-sm relative overflow-hidden">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Mensagens MTD</p>
              <h3 className="text-3xl font-black text-foreground mt-2">
                {mtdStats.currentMtdMsgs} <span className="text-xs font-normal text-muted-foreground">msgs</span>
              </h3>
            </div>
            <div className="p-3 bg-sky-500/15 rounded-2xl text-sky-400">
              <MessageSquare className="w-6 h-6" />
            </div>
          </div>
          <div className="mt-4 flex items-center gap-1.5 text-xs font-bold">
            {mtdStats.deltaMsgsPercent >= 0 ? (
              <span className="text-emerald-400 flex items-center gap-0.5">
                <TrendingUp className="w-3.5 h-3.5" /> +{mtdStats.deltaMsgsPercent.toFixed(1)}%
              </span>
            ) : (
              <span className="text-rose-400 flex items-center gap-0.5">
                <TrendingDown className="w-3.5 h-3.5" /> {mtdStats.deltaMsgsPercent.toFixed(1)}%
              </span>
            )}
            <span className="text-muted-foreground font-normal">
              vs {mtdStats.previousMonthName.split(' ')[0]} até dia {mtdStats.currentDay} ({mtdStats.prevMtdMsgs} msgs)
            </span>
          </div>
        </div>

        {/* Card 2: Vendas Convertidas */}
        <div className="bg-card border border-border p-6 rounded-3xl shadow-sm">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Vendas Convertidas</p>
              <h3 className="text-3xl font-black text-foreground mt-2">
                {mtdStats.currentMtdSales} <span className="text-xs font-normal text-muted-foreground">pedidos</span>
              </h3>
            </div>
            <div className="p-3 bg-indigo-500/15 rounded-2xl text-indigo-400">
              <Target className="w-6 h-6" />
            </div>
          </div>
          <div className="mt-4 flex items-center gap-1.5 text-xs font-bold">
            {mtdStats.deltaSales >= 0 ? (
              <span className="text-emerald-400 flex items-center gap-0.5">
                <TrendingUp className="w-3.5 h-3.5" /> +{mtdStats.deltaSales} vendas
              </span>
            ) : (
              <span className="text-rose-400 flex items-center gap-0.5">
                <TrendingDown className="w-3.5 h-3.5" /> {mtdStats.deltaSales} vendas
              </span>
            )}
            <span className="text-muted-foreground font-normal">
              vs {mtdStats.previousMonthName.split(' ')[0]} até dia {mtdStats.currentDay} ({mtdStats.prevMtdSales} vnd)
            </span>
          </div>
        </div>

        {/* Card 3: Taxa de Conversão */}
        <div className="bg-card border border-border p-6 rounded-3xl shadow-sm">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Taxa de Conversão</p>
              <h3 className="text-3xl font-black text-amber-400 mt-2">
                {mtdStats.currentMtdConvRate.toFixed(1)}%
              </h3>
            </div>
            <div className="p-3 bg-amber-500/15 rounded-2xl text-amber-400">
              <Sparkles className="w-6 h-6" />
            </div>
          </div>
          <div className="mt-4 flex items-center gap-1.5 text-xs font-bold">
            {mtdStats.deltaConv >= 0 ? (
              <span className="text-emerald-400 flex items-center gap-0.5">
                <TrendingUp className="w-3.5 h-3.5" /> +{mtdStats.deltaConv.toFixed(1)} p.p.
              </span>
            ) : (
              <span className="text-rose-400 flex items-center gap-0.5">
                <TrendingDown className="w-3.5 h-3.5" /> {mtdStats.deltaConv.toFixed(1)} p.p.
              </span>
            )}
            <span className="text-muted-foreground font-normal">
              vs {mtdStats.previousMonthName.split(' ')[0]} ({mtdStats.prevMtdConvRate.toFixed(1)}%)
            </span>
          </div>
        </div>

        {/* Card 4: Receita Gerada */}
        <div className="bg-card border border-border p-6 rounded-3xl shadow-sm bg-gradient-to-br from-emerald-500/10 via-transparent to-transparent">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Receita Gerada MTD</p>
              <h3 className="text-2xl md:text-3xl font-black text-emerald-400 mt-2">
                {formatMoney(mtdStats.currentMtdRevenue)}
              </h3>
            </div>
            <div className="p-3 bg-emerald-500/15 rounded-2xl text-emerald-400">
              <DollarSign className="w-6 h-6" />
            </div>
          </div>
          <div className="mt-4 flex items-center gap-1.5 text-xs font-bold">
            {mtdStats.deltaRevenue >= 0 ? (
              <span className="text-emerald-400 flex items-center gap-0.5">
                <TrendingUp className="w-3.5 h-3.5" /> +{mtdStats.deltaRevenuePercent.toFixed(1)}%
              </span>
            ) : (
              <span className="text-rose-400 flex items-center gap-0.5">
                <TrendingDown className="w-3.5 h-3.5" /> {mtdStats.deltaRevenuePercent.toFixed(1)}%
              </span>
            )}
            <span className="text-muted-foreground font-normal">
              vs {mtdStats.previousMonthName.split(' ')[0]} ({formatMoney(mtdStats.prevMtdRevenue)})
            </span>
          </div>
        </div>
      </div>

      {/* 5. Tabela Detalhada de TODAS AS CAMPANHAS */}
      <div className="bg-card border border-border rounded-3xl overflow-hidden shadow-sm">
        <div className="p-6 bg-muted/20 border-b border-border flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
              <Tag className="w-5 h-5 text-indigo-400" />
              Desempenho por Campanha (1 a {mtdStats.currentDay} de {mtdStats.currentMonthName})
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Comparativo exato com o mesmo intervalo de dias no mês de {mtdStats.previousMonthName}.
            </p>
          </div>

          <span className="text-xs font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-3 py-1.5 rounded-xl">
            {mtdStats.campaignsList.length} Campanhas Mapeadas
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              {/* Linha 1 de Cabeçalho */}
              <tr className="border-b border-border bg-muted/40 text-muted-foreground text-xs uppercase tracking-wider">
                <th className="py-4 px-6 text-left font-bold whitespace-nowrap">Campanha</th>
                <th colSpan={4} className="py-3 px-4 text-center font-bold border-l border-border bg-muted/20 text-foreground text-sm">
                  {mtdStats.currentMonthName} (até dia {mtdStats.currentDay})
                </th>
                <th colSpan={4} className="py-3 px-4 text-center font-bold border-l border-border bg-muted/10 text-muted-foreground text-sm">
                  {mtdStats.previousMonthName} (até dia {mtdStats.currentDay})
                </th>
                <th colSpan={2} className="py-3 px-4 text-center font-bold border-l border-emerald-500/30 bg-emerald-500/10 text-emerald-400 text-sm">
                  Evolução MoM
                </th>
              </tr>

              {/* Linha 2 de Cabeçalho */}
              <tr className="border-b border-border bg-muted/20 text-muted-foreground text-[11px] font-semibold">
                <th className="py-2.5 px-6 text-left">Nome</th>
                
                {/* Mês Atual */}
                <th className="py-2.5 px-3 text-center border-l border-border">Msgs</th>
                <th className="py-2.5 px-3 text-center">Vendas</th>
                <th className="py-2.5 px-3 text-center">Taxa</th>
                <th className="py-2.5 px-4 text-right">Receita</th>

                {/* Mês Anterior MTD */}
                <th className="py-2.5 px-3 text-center border-l border-border">Msgs</th>
                <th className="py-2.5 px-3 text-center">Vendas</th>
                <th className="py-2.5 px-3 text-center">Taxa</th>
                <th className="py-2.5 px-4 text-right">Receita</th>

                {/* Evolução */}
                <th className="py-2.5 px-3 text-center border-l border-emerald-500/30">Δ Vendas</th>
                <th className="py-2.5 px-4 text-right">Δ Receita</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-border">
              {mtdStats.campaignsList.map(c => {
                const diffSales = c.currentSales - c.prevMtdSales;
                const diffRev = c.currentRevenue - c.prevMtdRevenue;

                return (
                  <tr key={c.campaign} className="hover:bg-muted/30 transition-colors">
                    {/* Nome */}
                    <td className="py-4 px-6 text-foreground font-bold whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <Tag className="w-3.5 h-3.5 text-indigo-400" />
                        <span>{c.label}</span>
                      </div>
                    </td>

                    {/* Mês Atual */}
                    <td className="py-4 px-3 text-center border-l border-border font-bold text-foreground">
                      {c.currentMsgs}
                    </td>
                    <td className="py-4 px-3 text-center font-black">
                      {c.currentSales > 0 ? (
                        <span className="text-emerald-400">{c.currentSales}</span>
                      ) : (
                        <span className="text-muted-foreground">0</span>
                      )}
                    </td>
                    <td className="py-4 px-3 text-center">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-black ${
                        c.currentConvRate > 0
                          ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20'
                          : 'text-zinc-500'
                      }`}>
                        {c.currentConvRate.toFixed(1)}%
                      </span>
                    </td>
                    <td className="py-4 px-4 text-right font-black whitespace-nowrap text-emerald-400">
                      {formatMoney(c.currentRevenue)}
                    </td>

                    {/* Mês Anterior MTD */}
                    <td className="py-4 px-3 text-center border-l border-border text-muted-foreground">
                      {c.prevMtdMsgs}
                    </td>
                    <td className="py-4 px-3 text-center text-muted-foreground font-semibold">
                      {c.prevMtdSales}
                    </td>
                    <td className="py-4 px-3 text-center text-muted-foreground text-[11px]">
                      {c.prevMtdConvRate.toFixed(1)}%
                    </td>
                    <td className="py-4 px-4 text-right text-muted-foreground whitespace-nowrap font-medium">
                      {formatMoney(c.prevMtdRevenue)}
                    </td>

                    {/* Evolução */}
                    <td className="py-4 px-3 text-center border-l border-emerald-500/30 font-bold">
                      {diffSales > 0 ? (
                        <span className="text-emerald-400">+{diffSales}</span>
                      ) : diffSales < 0 ? (
                        <span className="text-rose-400">{diffSales}</span>
                      ) : (
                        <span className="text-zinc-500">0</span>
                      )}
                    </td>
                    <td className="py-4 px-4 text-right font-black whitespace-nowrap">
                      {diffRev > 0 ? (
                        <span className="text-emerald-400">+{formatMoney(diffRev)}</span>
                      ) : diffRev < 0 ? (
                        <span className="text-rose-400">{formatMoney(diffRev)}</span>
                      ) : (
                        <span className="text-zinc-500">R$ 0,00</span>
                      )}
                    </td>
                  </tr>
                );
              })}

              {/* Linha de Total */}
              <tr className="bg-muted/40 font-black border-t-2 border-border text-foreground">
                <td className="py-5 px-6 uppercase tracking-wider text-emerald-400 flex items-center gap-2">
                  <Award className="w-4 h-4" /> Total Consolidado MTD
                </td>

                {/* Atual */}
                <td className="py-5 px-3 text-center border-l border-border text-base">
                  {mtdStats.currentMtdMsgs}
                </td>
                <td className="py-5 px-3 text-center text-emerald-400 text-base">
                  {mtdStats.currentMtdSales}
                </td>
                <td className="py-5 px-3 text-center">
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-black bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                    {mtdStats.currentMtdConvRate.toFixed(1)}%
                  </span>
                </td>
                <td className="py-5 px-4 text-right text-emerald-400 text-base">
                  {formatMoney(mtdStats.currentMtdRevenue)}
                </td>

                {/* Anterior */}
                <td className="py-5 px-3 text-center border-l border-border text-muted-foreground">
                  {mtdStats.prevMtdMsgs}
                </td>
                <td className="py-5 px-3 text-center text-muted-foreground">
                  {mtdStats.prevMtdSales}
                </td>
                <td className="py-5 px-3 text-center text-muted-foreground text-xs">
                  {mtdStats.prevMtdConvRate.toFixed(1)}%
                </td>
                <td className="py-5 px-4 text-right text-muted-foreground">
                  {formatMoney(mtdStats.prevMtdRevenue)}
                </td>

                {/* Evolução */}
                <td className="py-5 px-3 text-center border-l border-emerald-500/30 text-emerald-400 font-bold">
                  {mtdStats.deltaSales >= 0 ? `+${mtdStats.deltaSales}` : mtdStats.deltaSales}
                </td>
                <td className="py-5 px-4 text-right text-emerald-400 font-black text-base">
                  {mtdStats.deltaRevenue >= 0 ? '+' : ''}{formatMoney(mtdStats.deltaRevenue)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
