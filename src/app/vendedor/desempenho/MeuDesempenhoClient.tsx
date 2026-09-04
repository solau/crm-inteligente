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
  AlertTriangle, 
  Award, 
  Tag, 
  Sparkles,
  ArrowUp,
  ArrowDown,
  Clock,
  CheckCircle2,
  RefreshCw,
  Users,
  History
} from 'lucide-react';
import { CampaignMonthStats } from '@/app/api/ai/meu-desempenho/route';
import HourlyGoalMonitor from '@/components/HourlyGoalMonitor';
import { formatMonthYear } from '@/lib/utils/dateUtils';

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

export interface TeamMonthlySummary {
  totalMsgs: number;
  totalSales: number;
  totalRevenue: number;
  activeSellersCount: number;
  avgMsgsPerSeller: number;
  avgConvRate: number;
  avgRevenuePerSeller: number;
}

interface MeuDesempenhoClientProps {
  sellerName: string;
  sellerId: string;
  interactions: RawSellerInteraction[];
  teamMonthlySummary: Record<string, TeamMonthlySummary>;
}

export default function MeuDesempenhoClient({
  sellerName,
  interactions,
  teamMonthlySummary
}: MeuDesempenhoClientProps) {
  // 1. Extrair todos os meses disponíveis
  const { allMonths, monthLabels } = useMemo(() => {
    const monthsSet = new Set<string>();
    
    // Meses das interações do vendedor
    interactions.forEach(i => {
      monthsSet.add(i.created_at.slice(0, 7));
    });

    // Meses da equipe
    Object.keys(teamMonthlySummary).forEach(m => monthsSet.add(m));

    // Garante que o mês atual esteja na lista
    const now = new Date();
    const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    monthsSet.add(currentMonthKey);

    const sortedMonths = Array.from(monthsSet).sort().reverse(); // Mais recente primeiro

    const mLabels: Record<string, string> = {};
    sortedMonths.forEach(m => {
      const [year, month] = m.split('-');
      const d = new Date(Number(year), Number(month) - 1, 1);
      const label = formatMonthYear(d);
      mLabels[m] = label.charAt(0).toUpperCase() + label.slice(1);
    });

    return { allMonths: sortedMonths, monthLabels: mLabels };
  }, [interactions, teamMonthlySummary]);

  // Mês Selecionado (padrão: mês mais recente)
  const [selectedMonth, setSelectedMonth] = useState<string>(allMonths[0] || '');
  const [aiEvaluations, setAiEvaluations] = useState<Record<string, string>>({});
  const [loadingAI, setLoadingAI] = useState(false);

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
    'LEADS_WHATSAPP': '💬 Leads - Whatsapp',
    'OUTROS': '📌 Outros'
  };

  const formatMoney = (val: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

  // 2. Processamento Completo do Mês Selecionado vs Mês Anterior vs Histórico vs Equipe
  const monthData = useMemo(() => {
    if (!selectedMonth) return null;

    const now = new Date();
    const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const isCurrentMonth = selectedMonth === currentMonthKey;
    const currentDay = now.getDate();

    const [selYear, selMonth] = selectedMonth.split('-').map(Number);
    const daysInSelMonth = new Date(selYear, selMonth, 0).getDate();
    const daysToEvaluate = isCurrentMonth ? currentDay : daysInSelMonth;

    // Meta diária de 60 msgs/dia
    const DAILY_GOAL = 60;
    const targetMsgs = daysToEvaluate * DAILY_GOAL;

    // Identificar mês imediatamente anterior
    const prevDate = new Date(selYear, selMonth - 2, 1);
    const prevMonthKey = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;
    const prevMonthName = monthLabels[prevMonthKey] || prevMonthKey;

    // Dados do Mês Selecionado
    let selMsgs = 0;
    let selSales = 0;
    let selRevenue = 0;

    // Dados do Mês Anterior (mesmo intervalo de dias para comparação justa)
    let prevMsgs = 0;
    let prevSales = 0;
    let prevRevenue = 0;

    // Histórico geral do vendedor (todos os meses gravados)
    const sellerHistoryByMonth: Record<string, { msgs: number; sales: number; revenue: number }> = {};
    const campaignMapSelected: Record<string, { msgs: number; sales: number; revenue: number }> = {};
    const campaignMapPrev: Record<string, { msgs: number; sales: number; revenue: number }> = {};
    const allCampaignKeys = new Set<string>([
      'CASHBACK_1D',
      'CASHBACK_5D',
      'CASHBACK_10D',
      'CASHBACK_15D',
      'AUSENTE_45D',
      'OFERTA_90D',
      'POS_VENDA',
      'CORRIDA_ALPHAVILLE',
      'LEADS_BPE25',
      'LEADS_WHATSAPP',
      'OUTROS'
    ]);

    interactions.forEach(i => {
      const iMonth = i.created_at.slice(0, 7);
      const iDate = new Date(i.created_at);
      const iDay = iDate.getDate();
      const campaign = i.campaign_type || 'OUTROS';
      allCampaignKeys.add(campaign);

      const hasSale = i.sales_attribution && i.sales_attribution.length > 0;
      const rev = hasSale ? i.sales_attribution!.reduce((acc, cur) => acc + Number(cur.revenue || 0), 0) : 0;

      // Agregação histórica do vendedor
      if (!sellerHistoryByMonth[iMonth]) {
        sellerHistoryByMonth[iMonth] = { msgs: 0, sales: 0, revenue: 0 };
      }
      sellerHistoryByMonth[iMonth].msgs++;
      if (hasSale) sellerHistoryByMonth[iMonth].sales++;
      sellerHistoryByMonth[iMonth].revenue += rev;

      // 1. Mês Selecionado
      if (iMonth === selectedMonth) {
        if (!isCurrentMonth || iDay <= currentDay) {
          selMsgs++;
          if (hasSale) selSales++;
          selRevenue += rev;

          if (!campaignMapSelected[campaign]) campaignMapSelected[campaign] = { msgs: 0, sales: 0, revenue: 0 };
          campaignMapSelected[campaign].msgs++;
          if (hasSale) campaignMapSelected[campaign].sales++;
          campaignMapSelected[campaign].revenue += rev;
        }
      }

      // 2. Mês Anterior (mesmo corte de dias)
      if (iMonth === prevMonthKey) {
        if (!isCurrentMonth || iDay <= currentDay) {
          prevMsgs++;
          if (hasSale) prevSales++;
          prevRevenue += rev;

          if (!campaignMapPrev[campaign]) campaignMapPrev[campaign] = { msgs: 0, sales: 0, revenue: 0 };
          campaignMapPrev[campaign].msgs++;
          if (hasSale) campaignMapPrev[campaign].sales++;
          campaignMapPrev[campaign].revenue += rev;
        }
      }
    });

    const selConvRate = selMsgs > 0 ? (selSales / selMsgs) * 100 : 0;
    const prevConvRate = prevMsgs > 0 ? (prevSales / prevMsgs) * 100 : 0;

    // Cálculo da média histórica do próprio vendedor (excluindo o mês atual para benchmark limpo)
    const otherMonths = Object.keys(sellerHistoryByMonth).filter(m => m !== selectedMonth);
    let sellerHistAvgMsgs = 0;
    let sellerHistAvgConv = 0;
    let sellerHistAvgRevenue = 0;

    if (otherMonths.length > 0) {
      let sumM = 0, sumS = 0, sumR = 0;
      otherMonths.forEach(m => {
        const d = sellerHistoryByMonth[m];
        sumM += d.msgs;
        sumS += d.sales;
        sumR += d.revenue;
      });
      sellerHistAvgMsgs = sumM / otherMonths.length;
      sellerHistAvgConv = sumM > 0 ? (sumS / sumM) * 100 : 0;
      sellerHistAvgRevenue = sumR / otherMonths.length;
    } else {
      sellerHistAvgMsgs = selMsgs;
      sellerHistAvgConv = selConvRate;
      sellerHistAvgRevenue = selRevenue;
    }

    // Benchmark da Equipe para o mês selecionado
    const teamStats = teamMonthlySummary[selectedMonth] || {
      totalMsgs: 0,
      totalSales: 0,
      totalRevenue: 0,
      activeSellersCount: 1,
      avgMsgsPerSeller: 0,
      avgConvRate: 0,
      avgRevenuePerSeller: 0
    };

    // Montar lista de campanhas do mês
    const campaignsList: CampaignMonthStats[] = Array.from(allCampaignKeys).map(cKey => {
      const cur = campaignMapSelected[cKey] || { msgs: 0, sales: 0, revenue: 0 };
      const prv = campaignMapPrev[cKey] || { msgs: 0, sales: 0, revenue: 0 };

      const cConv = cur.msgs > 0 ? (cur.sales / cur.msgs) * 100 : 0;
      const pConv = prv.msgs > 0 ? (prv.sales / prv.msgs) * 100 : 0;

      return {
        campaign: cKey,
        label: campaignLabels[cKey] || cKey,
        monthMsgs: cur.msgs,
        monthSales: cur.sales,
        monthConvRate: cConv,
        monthRevenue: cur.revenue,
        prevMonthMsgs: prv.msgs,
        prevMonthSales: prv.sales,
        prevMonthConvRate: pConv,
        prevMonthRevenue: prv.revenue
      };
    }).sort((a, b) => (b.monthRevenue + b.monthMsgs * 10) - (a.monthRevenue + a.monthMsgs * 10));

    // Variações vs Mês Anterior
    const deltaMsgs = selMsgs - prevMsgs;
    const deltaMsgsPercent = prevMsgs > 0 ? ((deltaMsgs / prevMsgs) * 100) : (selMsgs > 0 ? 100 : 0);
    const deltaSales = selSales - prevSales;
    const deltaRevenue = selRevenue - prevRevenue;
    const deltaRevenuePercent = prevRevenue > 0 ? ((deltaRevenue / prevRevenue) * 100) : (selRevenue > 0 ? 100 : 0);
    const deltaConv = selConvRate - prevConvRate;

    // Variações vs Histórico Próprio
    const deltaVsHistMsgs = selMsgs - sellerHistAvgMsgs;
    const deltaVsHistConv = selConvRate - sellerHistAvgConv;
    const deltaVsHistRevenue = selRevenue - sellerHistAvgRevenue;

    // Variações vs Equipe
    const deltaVsTeamMsgs = selMsgs - teamStats.avgMsgsPerSeller;
    const deltaVsTeamConv = selConvRate - teamStats.avgConvRate;
    const deltaVsTeamRevenue = selRevenue - teamStats.avgRevenuePerSeller;

    const diffTarget = selMsgs - targetMsgs;
    const isAboveTarget = diffTarget >= 0;

    return {
      monthKey: selectedMonth,
      monthName: monthLabels[selectedMonth],
      prevMonthName,
      isCurrentMonth,
      currentDay: daysToEvaluate,
      targetMsgs,
      selMsgs,
      selSales,
      selConvRate,
      selRevenue,
      prevMsgs,
      prevSales,
      prevConvRate,
      prevRevenue,
      deltaMsgs,
      deltaMsgsPercent,
      deltaSales,
      deltaRevenue,
      deltaRevenuePercent,
      deltaConv,
      sellerHistAvgMsgs,
      sellerHistAvgConv,
      sellerHistAvgRevenue,
      deltaVsHistMsgs,
      deltaVsHistConv,
      deltaVsHistRevenue,
      teamStats,
      deltaVsTeamMsgs,
      deltaVsTeamConv,
      deltaVsTeamRevenue,
      diffTarget,
      isAboveTarget,
      campaignsList
    };
  }, [selectedMonth, interactions, teamMonthlySummary, monthLabels]);

  // Disparo da Avaliação com IA
  const handleRunAiEvaluation = async () => {
    if (!monthData) return;

    setLoadingAI(true);
    try {
      const payload = {
        sellerName,
        monthEvaluated: monthData.monthName,
        isCurrentMonth: monthData.isCurrentMonth,
        currentDay: monthData.currentDay,
        previousMonthName: monthData.prevMonthName,
        targetMsgs: monthData.targetMsgs,
        monthMsgs: monthData.selMsgs,
        monthSales: monthData.selSales,
        monthConvRate: monthData.selConvRate,
        monthRevenue: monthData.selRevenue,
        prevMonthMsgs: monthData.prevMsgs,
        prevMonthSales: monthData.prevSales,
        prevMonthConvRate: monthData.prevConvRate,
        prevMonthRevenue: monthData.prevRevenue,
        sellerHistoricalAvgMsgs: monthData.sellerHistAvgMsgs,
        sellerHistoricalAvgConv: monthData.sellerHistAvgConv,
        sellerHistoricalAvgRevenue: monthData.sellerHistAvgRevenue,
        teamMonthAvgMsgs: monthData.teamStats.avgMsgsPerSeller,
        teamMonthAvgConv: monthData.teamStats.avgConvRate,
        teamMonthAvgRevenue: monthData.teamStats.avgRevenuePerSeller,
        campaigns: monthData.campaignsList
      };

      const res = await fetch('/api/ai/meu-desempenho', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (data.success) {
        setAiEvaluations(prev => ({ ...prev, [selectedMonth]: data.analysis }));
      } else {
        setAiEvaluations(prev => ({ ...prev, [selectedMonth]: '⚠️ Ocorreu um erro ao gerar a avaliação com IA.' }));
      }
    } catch (err) {
      console.error('Erro ao avaliar desempenho:', err);
      setAiEvaluations(prev => ({ ...prev, [selectedMonth]: '⚠️ Falha de comunicação com a IA.' }));
    } finally {
      setLoadingAI(false);
    }
  };

  if (!monthData) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        Nenhum dado registrado para avaliação.
      </div>
    );
  }

  const currentAiText = aiEvaluations[selectedMonth];

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-16">
      
      {/* Alerta de Ritmo Horário e Sirene */}
      <HourlyGoalMonitor sellerName={sellerName} />

      {/* 1. Header do Vendedor com Seletor de Mês */}
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
                <Clock className="w-3 h-3" /> {monthData.isCurrentMonth ? `Até Dia ${monthData.currentDay}` : 'Mês Fechado'}
              </span>
            </div>
            <h1 className="text-2xl md:text-3xl font-black tracking-tight text-foreground mt-1">
              Meu Desempenho & Campanhas
            </h1>
            <p className="text-muted-foreground text-xs md:text-sm">
              Avaliação do seu resultado em <span className="text-white font-bold">{monthData.monthName}</span> comparado com seu histórico e a média da equipe.
            </p>
          </div>
        </div>

        {/* Controles de Mês e Botão de Avaliação */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Seletor de Mês */}
          <div className="flex items-center gap-2 bg-zinc-900 border border-zinc-700 px-3.5 py-2.5 rounded-2xl">
            <Calendar className="w-4 h-4 text-amber-400" />
            <div>
              <p className="text-[9px] text-zinc-400 font-bold uppercase">Mês de Avaliação</p>
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="bg-zinc-900 text-white font-black text-sm focus:outline-none cursor-pointer border-none"
                style={{ colorScheme: 'dark', backgroundColor: '#18181b', color: '#ffffff' }}
              >
                {allMonths.map(m => (
                  <option key={m} value={m} style={{ backgroundColor: '#18181b', color: '#ffffff' }}>
                    📅 {monthLabels[m]}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Botão de Avaliação da IA */}
          <button
            onClick={handleRunAiEvaluation}
            disabled={loadingAI}
            className={`flex items-center gap-2 px-5 py-3 rounded-2xl font-bold text-sm text-white transition-all shadow-xl active:scale-95 border ${
              loadingAI
                ? 'bg-violet-600/50 border-violet-500/30 cursor-not-allowed'
                : 'bg-gradient-to-r from-violet-600 via-indigo-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 border-violet-400/40 shadow-violet-500/25'
            }`}
          >
            {loadingAI ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin text-violet-200" />
                <span>Avaliando {monthData.monthName.split(' ')[0]}...</span>
              </>
            ) : (
              <>
                <BrainCircuit className="w-5 h-5 text-violet-200" />
                <span>Avaliar Meu Desempenho com IA</span>
              </>
            )}
          </button>
        </div>
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
                {monthData.isCurrentMonth
                  ? `Para o mês atual (até o dia ${monthData.currentDay}), sua meta acumulada é de ${monthData.targetMsgs} mensagens.`
                  : `Para o mês fechado de ${monthData.monthName} (${monthData.currentDay} dias), a meta mínima foi de ${monthData.targetMsgs} mensagens.`}
                {' '}Meta semanal: <span className="text-white font-semibold">420 msgs</span> · Mensal: <span className="text-white font-semibold">1.800 msgs</span>.
              </p>
            </div>
          </div>

          {/* Status e Indicador vs Meta */}
          <div className="flex items-center gap-4 bg-zinc-950/80 px-4 py-3 rounded-2xl border border-zinc-800/80">
            <div className="text-right">
              <p className="text-[10px] text-zinc-400 font-semibold uppercase">Volume Enviado</p>
              <div className="flex items-center gap-1.5 justify-end">
                <span className={`text-xl font-black ${monthData.isAboveTarget ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {monthData.selMsgs}
                </span>
                <span className="text-xs text-zinc-500 font-semibold">/ {monthData.targetMsgs}</span>
              </div>
            </div>
            <div className={`px-2.5 py-1 rounded-xl text-xs font-bold flex items-center gap-1 ${
              monthData.isAboveTarget ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
            }`}>
              {monthData.isAboveTarget ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>+{monthData.diffTarget} msgs</span>
                </>
              ) : (
                <>
                  <ArrowDown className="w-3.5 h-3.5" />
                  <span>{monthData.diffTarget} msgs</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Barra de Progresso */}
        <div className="mt-4">
          <div className="flex justify-between items-center text-[10px] font-bold text-zinc-400 mb-1.5">
            <span>Progresso da Meta de {monthData.monthName}</span>
            <span>{Math.min(200, ((monthData.selMsgs / (monthData.targetMsgs || 1)) * 100)).toFixed(0)}%</span>
          </div>
          <div className="w-full h-2.5 bg-zinc-800 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                monthData.isAboveTarget ? 'bg-gradient-to-r from-emerald-500 to-teal-400' : 'bg-gradient-to-r from-rose-500 to-amber-500'
              }`}
              style={{ width: `${Math.min(100, ((monthData.selMsgs / (monthData.targetMsgs || 1)) * 100))}%` }}
            />
          </div>
        </div>
      </div>

      {/* 3. Dossiê de Avaliação da IA para o Mês Selecionado */}
      {currentAiText && (
        <div className="p-6 rounded-3xl bg-zinc-900 border border-violet-500/30 shadow-2xl shadow-violet-500/10 space-y-4 animate-in fade-in zoom-in-95 duration-500">
          <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-violet-500/20 rounded-xl text-violet-400">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-black text-white flex items-center gap-2">
                  Avaliação da IA: {monthData.monthName}
                </h3>
                <p className="text-xs text-zinc-400">
                  Comparação completa com seu histórico pessoal e com a média da equipe.
                </p>
              </div>
            </div>
            <span className="text-[10px] font-bold px-3 py-1 rounded-full bg-violet-500/15 text-violet-300 border border-violet-500/30 uppercase tracking-wider">
              Análise Concluída
            </span>
          </div>

          <div className="prose prose-invert max-w-none text-zinc-200 text-sm leading-relaxed whitespace-pre-line">
            {currentAiText}
          </div>
        </div>
      )}

      {/* 4. Grid de KPIs: Mês Selecionado vs Mês Anterior */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Card 1: Mensagens */}
        <div className="bg-card border border-border p-6 rounded-3xl shadow-sm relative overflow-hidden">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Mensagens Enviadas</p>
              <h3 className="text-3xl font-black text-foreground mt-2">
                {monthData.selMsgs} <span className="text-xs font-normal text-muted-foreground">msgs</span>
              </h3>
            </div>
            <div className="p-3 bg-sky-500/15 rounded-2xl text-sky-400">
              <MessageSquare className="w-6 h-6" />
            </div>
          </div>
          <div className="mt-4 flex items-center gap-1.5 text-xs font-bold">
            {monthData.deltaMsgsPercent >= 0 ? (
              <span className="text-emerald-400 flex items-center gap-0.5">
                <TrendingUp className="w-3.5 h-3.5" /> +{monthData.deltaMsgsPercent.toFixed(1)}%
              </span>
            ) : (
              <span className="text-rose-400 flex items-center gap-0.5">
                <TrendingDown className="w-3.5 h-3.5" /> {monthData.deltaMsgsPercent.toFixed(1)}%
              </span>
            )}
            <span className="text-muted-foreground font-normal">
              vs {monthData.prevMonthName.split(' ')[0]} ({monthData.prevMsgs} msgs)
            </span>
          </div>
        </div>

        {/* Card 2: Vendas */}
        <div className="bg-card border border-border p-6 rounded-3xl shadow-sm">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Vendas Convertidas</p>
              <h3 className="text-3xl font-black text-foreground mt-2">
                {monthData.selSales} <span className="text-xs font-normal text-muted-foreground">pedidos</span>
              </h3>
            </div>
            <div className="p-3 bg-indigo-500/15 rounded-2xl text-indigo-400">
              <Target className="w-6 h-6" />
            </div>
          </div>
          <div className="mt-4 flex items-center gap-1.5 text-xs font-bold">
            {monthData.deltaSales >= 0 ? (
              <span className="text-emerald-400 flex items-center gap-0.5">
                <TrendingUp className="w-3.5 h-3.5" /> +{monthData.deltaSales} vendas
              </span>
            ) : (
              <span className="text-rose-400 flex items-center gap-0.5">
                <TrendingDown className="w-3.5 h-3.5" /> {monthData.deltaSales} vendas
              </span>
            )}
            <span className="text-muted-foreground font-normal">
              vs {monthData.prevMonthName.split(' ')[0]} ({monthData.prevSales} vnd)
            </span>
          </div>
        </div>

        {/* Card 3: Taxa de Conversão */}
        <div className="bg-card border border-border p-6 rounded-3xl shadow-sm">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Taxa de Conversão</p>
              <h3 className="text-3xl font-black text-amber-400 mt-2">
                {monthData.selConvRate.toFixed(1)}%
              </h3>
            </div>
            <div className="p-3 bg-amber-500/15 rounded-2xl text-amber-400">
              <Sparkles className="w-6 h-6" />
            </div>
          </div>
          <div className="mt-4 flex items-center gap-1.5 text-xs font-bold">
            {monthData.deltaConv >= 0 ? (
              <span className="text-emerald-400 flex items-center gap-0.5">
                <TrendingUp className="w-3.5 h-3.5" /> +{monthData.deltaConv.toFixed(1)} p.p.
              </span>
            ) : (
              <span className="text-rose-400 flex items-center gap-0.5">
                <TrendingDown className="w-3.5 h-3.5" /> {monthData.deltaConv.toFixed(1)} p.p.
              </span>
            )}
            <span className="text-muted-foreground font-normal">
              vs {monthData.prevMonthName.split(' ')[0]} ({monthData.prevConvRate.toFixed(1)}%)
            </span>
          </div>
        </div>

        {/* Card 4: Receita */}
        <div className="bg-card border border-border p-6 rounded-3xl shadow-sm bg-gradient-to-br from-emerald-500/10 via-transparent to-transparent">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Receita no Mês</p>
              <h3 className="text-2xl md:text-3xl font-black text-emerald-400 mt-2">
                {formatMoney(monthData.selRevenue)}
              </h3>
            </div>
            <div className="p-3 bg-emerald-500/15 rounded-2xl text-emerald-400">
              <DollarSign className="w-6 h-6" />
            </div>
          </div>
          <div className="mt-4 flex items-center gap-1.5 text-xs font-bold">
            {monthData.deltaRevenue >= 0 ? (
              <span className="text-emerald-400 flex items-center gap-0.5">
                <TrendingUp className="w-3.5 h-3.5" /> +{monthData.deltaRevenuePercent.toFixed(1)}%
              </span>
            ) : (
              <span className="text-rose-400 flex items-center gap-0.5">
                <TrendingDown className="w-3.5 h-3.5" /> {monthData.deltaRevenuePercent.toFixed(1)}%
              </span>
            )}
            <span className="text-muted-foreground font-normal">
              vs {monthData.prevMonthName.split(' ')[0]} ({formatMoney(monthData.prevRevenue)})
            </span>
          </div>
        </div>
      </div>

      {/* 5. Painel Duplo de Benchmark: Histórico Pessoal vs Média da Equipe */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Bloco 1: Comparativo com Histórico do Próprio Atendente */}
        <div className="p-6 rounded-3xl bg-zinc-900 border border-zinc-800 shadow-sm space-y-4">
          <div className="flex items-center gap-3 border-b border-zinc-800 pb-3">
            <div className="p-2 bg-indigo-500/15 rounded-xl text-indigo-400">
              <History className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-white text-base">Comparativo vs Seu Próprio Histórico</h3>
              <p className="text-xs text-zinc-400">Seu resultado em {monthData.monthName} contra sua média histórica pessoal.</p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="p-3.5 rounded-2xl bg-zinc-950/80 border border-zinc-800">
              <p className="text-[10px] text-zinc-400 font-semibold uppercase">Mensagens</p>
              <p className="text-base font-black text-white mt-1">{monthData.selMsgs} <span className="text-xs text-zinc-500">/ {monthData.sellerHistAvgMsgs.toFixed(0)} méd.</span></p>
              <p className={`text-[10px] font-bold mt-1 ${monthData.deltaVsHistMsgs >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {monthData.deltaVsHistMsgs >= 0 ? '+' : ''}{monthData.deltaVsHistMsgs.toFixed(0)} msgs
              </p>
            </div>

            <div className="p-3.5 rounded-2xl bg-zinc-950/80 border border-zinc-800">
              <p className="text-[10px] text-zinc-400 font-semibold uppercase">Conversão</p>
              <p className="text-base font-black text-amber-400 mt-1">{monthData.selConvRate.toFixed(1)}% <span className="text-xs text-zinc-500">/ {monthData.sellerHistAvgConv.toFixed(1)}%</span></p>
              <p className={`text-[10px] font-bold mt-1 ${monthData.deltaVsHistConv >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {monthData.deltaVsHistConv >= 0 ? '+' : ''}{monthData.deltaVsHistConv.toFixed(1)} p.p.
              </p>
            </div>

            <div className="p-3.5 rounded-2xl bg-zinc-950/80 border border-zinc-800">
              <p className="text-[10px] text-zinc-400 font-semibold uppercase">Receita</p>
              <p className="text-base font-black text-emerald-400 mt-1">{formatMoney(monthData.selRevenue)}</p>
              <p className={`text-[10px] font-bold mt-1 ${monthData.deltaVsHistRevenue >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {monthData.deltaVsHistRevenue >= 0 ? '+' : ''}{formatMoney(monthData.deltaVsHistRevenue)}
              </p>
            </div>
          </div>
        </div>

        {/* Bloco 2: Comparativo vs Média de Toda a Equipe */}
        <div className="p-6 rounded-3xl bg-zinc-900 border border-zinc-800 shadow-sm space-y-4">
          <div className="flex items-center gap-3 border-b border-zinc-800 pb-3">
            <div className="p-2 bg-emerald-500/15 rounded-xl text-emerald-400">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-white text-base">Comparativo vs Média da Equipe ({monthData.monthName})</h3>
              <p className="text-xs text-zinc-400">Seu desempenho posicionado frente à média de {monthData.teamStats.activeSellersCount} atendente(s) ativo(s) (&gt; 50 msgs no mês).</p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="p-3.5 rounded-2xl bg-zinc-950/80 border border-zinc-800">
              <p className="text-[10px] text-zinc-400 font-semibold uppercase">Msgs vs Equipe</p>
              <p className="text-base font-black text-white mt-1">{monthData.selMsgs} <span className="text-xs text-zinc-500">/ {monthData.teamStats.avgMsgsPerSeller.toFixed(0)} eq.</span></p>
              <p className={`text-[10px] font-bold mt-1 ${monthData.deltaVsTeamMsgs >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {monthData.deltaVsTeamMsgs >= 0 ? '+' : ''}{monthData.deltaVsTeamMsgs.toFixed(0)} msgs
              </p>
            </div>

            <div className="p-3.5 rounded-2xl bg-zinc-950/80 border border-zinc-800">
              <p className="text-[10px] text-zinc-400 font-semibold uppercase">Taxa vs Equipe</p>
              <p className="text-base font-black text-amber-400 mt-1">{monthData.selConvRate.toFixed(1)}% <span className="text-xs text-zinc-500">/ {monthData.teamStats.avgConvRate.toFixed(1)}%</span></p>
              <p className={`text-[10px] font-bold mt-1 ${monthData.deltaVsTeamConv >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {monthData.deltaVsTeamConv >= 0 ? '+' : ''}{monthData.deltaVsTeamConv.toFixed(1)} p.p.
              </p>
            </div>

            <div className="p-3.5 rounded-2xl bg-zinc-950/80 border border-zinc-800">
              <p className="text-[10px] text-zinc-400 font-semibold uppercase">Faturamento vs Eq.</p>
              <p className="text-base font-black text-emerald-400 mt-1">{formatMoney(monthData.selRevenue)}</p>
              <p className={`text-[10px] font-bold mt-1 ${monthData.deltaVsTeamRevenue >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {monthData.deltaVsTeamRevenue >= 0 ? '+' : ''}{formatMoney(monthData.deltaVsTeamRevenue)}
              </p>
            </div>
          </div>
        </div>

      </div>

      {/* 6. Tabela Detalhada de TODAS AS CAMPANHAS */}
      <div className="bg-card border border-border rounded-3xl overflow-hidden shadow-sm">
        <div className="p-6 bg-muted/20 border-b border-border flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
              <Tag className="w-5 h-5 text-indigo-400" />
              Desempenho por Campanha em {monthData.monthName}
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Comparativo exato de cada gatilho frente a {monthData.prevMonthName}.
            </p>
          </div>

          <span className="text-xs font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-3 py-1.5 rounded-xl">
            {monthData.campaignsList.length} Campanhas
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-muted-foreground text-xs uppercase tracking-wider">
                <th className="py-4 px-6 text-left font-bold whitespace-nowrap">Campanha</th>
                <th colSpan={4} className="py-3 px-4 text-center font-bold border-l border-border bg-muted/20 text-foreground text-sm">
                  {monthData.monthName}
                </th>
                <th colSpan={4} className="py-3 px-4 text-center font-bold border-l border-border bg-muted/10 text-muted-foreground text-sm">
                  {monthData.prevMonthName}
                </th>
                <th colSpan={2} className="py-3 px-4 text-center font-bold border-l border-emerald-500/30 bg-emerald-500/10 text-emerald-400 text-sm">
                  Evolução
                </th>
              </tr>

              <tr className="border-b border-border bg-muted/20 text-muted-foreground text-[11px] font-semibold">
                <th className="py-2.5 px-6 text-left">Nome</th>
                
                {/* Mês Selecionado */}
                <th className="py-2.5 px-3 text-center border-l border-border">Msgs</th>
                <th className="py-2.5 px-3 text-center">Vendas</th>
                <th className="py-2.5 px-3 text-center">Taxa</th>
                <th className="py-2.5 px-4 text-right">Receita</th>

                {/* Mês Anterior */}
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
              {monthData.campaignsList.map(c => {
                const diffSales = c.monthSales - c.prevMonthSales;
                const diffRev = c.monthRevenue - c.prevMonthRevenue;

                return (
                  <tr key={c.campaign} className="hover:bg-muted/30 transition-colors">
                    <td className="py-4 px-6 text-foreground font-bold whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <Tag className="w-3.5 h-3.5 text-indigo-400" />
                        <span>{c.label}</span>
                      </div>
                    </td>

                    {/* Mês Selecionado */}
                    <td className="py-4 px-3 text-center border-l border-border font-bold text-foreground">
                      {c.monthMsgs}
                    </td>
                    <td className="py-4 px-3 text-center font-black">
                      {c.monthSales > 0 ? (
                        <span className="text-emerald-400">{c.monthSales}</span>
                      ) : (
                        <span className="text-muted-foreground">0</span>
                      )}
                    </td>
                    <td className="py-4 px-3 text-center">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-black ${
                        c.monthConvRate > 0
                          ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20'
                          : 'text-zinc-500'
                      }`}>
                        {c.monthConvRate.toFixed(1)}%
                      </span>
                    </td>
                    <td className="py-4 px-4 text-right font-black whitespace-nowrap text-emerald-400">
                      {formatMoney(c.monthRevenue)}
                    </td>

                    {/* Mês Anterior */}
                    <td className="py-4 px-3 text-center border-l border-border text-muted-foreground">
                      {c.prevMonthMsgs}
                    </td>
                    <td className="py-4 px-3 text-center text-muted-foreground font-semibold">
                      {c.prevMonthSales}
                    </td>
                    <td className="py-4 px-3 text-center text-muted-foreground text-[11px]">
                      {c.prevMonthConvRate.toFixed(1)}%
                    </td>
                    <td className="py-4 px-4 text-right text-muted-foreground whitespace-nowrap font-medium">
                      {formatMoney(c.prevMonthRevenue)}
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
                  <Award className="w-4 h-4" /> Total do Mês
                </td>

                <td className="py-5 px-3 text-center border-l border-border text-base">
                  {monthData.selMsgs}
                </td>
                <td className="py-5 px-3 text-center text-emerald-400 text-base">
                  {monthData.selSales}
                </td>
                <td className="py-5 px-3 text-center">
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-black bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                    {monthData.selConvRate.toFixed(1)}%
                  </span>
                </td>
                <td className="py-5 px-4 text-right text-emerald-400 text-base">
                  {formatMoney(monthData.selRevenue)}
                </td>

                <td className="py-5 px-3 text-center border-l border-border text-muted-foreground">
                  {monthData.prevMsgs}
                </td>
                <td className="py-5 px-3 text-center text-muted-foreground">
                  {monthData.prevSales}
                </td>
                <td className="py-5 px-3 text-center text-muted-foreground text-xs">
                  {monthData.prevConvRate.toFixed(1)}%
                </td>
                <td className="py-5 px-4 text-right text-muted-foreground">
                  {formatMoney(monthData.prevRevenue)}
                </td>

                <td className="py-5 px-3 text-center border-l border-emerald-500/30 text-emerald-400 font-bold">
                  {monthData.deltaSales >= 0 ? `+${monthData.deltaSales}` : monthData.deltaSales}
                </td>
                <td className="py-5 px-4 text-right text-emerald-400 font-black text-base">
                  {monthData.deltaRevenue >= 0 ? '+' : ''}{formatMoney(monthData.deltaRevenue)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
