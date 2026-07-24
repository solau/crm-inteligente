'use client';

import React, { useState, useEffect } from 'react';
import Header from '@/components/Header';
import {
  Bot,
  Activity,
  CheckCircle2,
  AlertTriangle,
  Bug,
  ShoppingBag,
  TrendingUp,
  MessageCircle,
  Play,
  RefreshCw,
  Zap,
  ShieldCheck,
  Package,
  Sparkles,
  ArrowUpRight,
  Clock,
  Layers,
  ChevronRight
} from 'lucide-react';

interface ScanData {
  timestamp: string;
  globalHealthScore: number;
  routines: {
    score: number;
    blingSyncStatus: string;
    cashbackCronStatus: string;
    whatsappWebhookStatus: string;
    databaseLatencyMs: number;
    items: Array<{ name: string; status: 'ok' | 'warning' | 'error'; responseTimeMs: number; details: string }>;
  };
  rules: {
    score: number;
    cashbackRuleStatus: 'pass' | 'warning' | 'error';
    conversionRuleStatus: 'pass' | 'warning' | 'error';
    messageRuleStatus: 'pass' | 'warning' | 'error';
    violations: Array<{ rule: string; severity: 'low' | 'medium' | 'high'; description: string; count: number }>;
  };
  business: {
    score: number;
    topProducts: Array<{ name: string; salesCount: number; totalRevenue: number }>;
    criticalStockItems: Array<{ name: string; currentStock: number; estimatedDaysLeft: number; suggestedReorderQty: number }>;
    messageConversions: Array<{ campaign: string; totalSent: number; totalConversions: number; conversionRate: number; totalRevenue: number }>;
    periodComparison: { currentSalesTotal: number; previousSalesTotal: number; growthPercentage: number; avgTicket: number };
    aiRecommendations: {
      storeImprovements: string[];
      salesImprovements: string[];
      purchasingImprovements: string[];
      historicalInsight: string;
    };
  };
  bugs: {
    score: number;
    errorCount: number;
    issues: Array<{ id: string; file: string; line?: number; severity: 'high' | 'medium' | 'low'; description: string; suggestion: string }>;
  };
}

export default function AgentesDashboardPage() {
  const [data, setData] = useState<ScanData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'business' | 'rules' | 'routines' | 'bugs'>('business');
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const fetchScanData = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/ai/agentes');
      const json = await res.json();
      if (json.success) {
        setData(json.data);
      }
    } catch (err) {
      console.error("Erro ao carregar dados dos agentes:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchScanData();
  }, []);

  const handleRunAll = async () => {
    try {
      setActionLoading('run_all');
      setActionMessage('Agentes executando varredura completa...');
      const res = await fetch('/api/ai/agentes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'run_all' })
      });
      const json = await res.json();
      if (json.success) {
        setData(json.data);
        setActionMessage('Varredura completa concluída com sucesso!');
      }
    } catch (err) {
      setActionMessage('Erro ao disparar varredura.');
    } finally {
      setActionLoading(null);
      setTimeout(() => setActionMessage(null), 4000);
    }
  };

  const handleTriggerJobs = async () => {
    try {
      setActionLoading('trigger_jobs');
      setActionMessage('Agente de Rotinas disparando jobs de background...');
      const res = await fetch('/api/ai/agentes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'trigger_jobs' })
      });
      const json = await res.json();
      if (json.success) {
        setActionMessage('Jobs de Sincronização e Cashback acionados com sucesso!');
        fetchScanData();
      }
    } catch (err) {
      setActionMessage('Erro ao acionar jobs.');
    } finally {
      setActionLoading(null);
      setTimeout(() => setActionMessage(null), 4000);
    }
  };

  const handleValidateRules = async () => {
    try {
      setActionLoading('validate_rules');
      setActionMessage('Agente Validador auditando regras de negócio...');
      const res = await fetch('/api/ai/agentes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'validate_rules' })
      });
      const json = await res.json();
      if (json.success) {
        setActionMessage('Regras de negócio e cashback auditadas com sucesso!');
        fetchScanData();
      }
    } catch (err) {
      setActionMessage('Erro ao validar regras.');
    } finally {
      setActionLoading(null);
      setTimeout(() => setActionMessage(null), 4000);
    }
  };

  if (loading && !data) {
    return (
      <div className="flex-1 flex flex-col bg-background min-h-screen">
        <Header />
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="flex flex-col items-center gap-4">
            <RefreshCw className="animate-spin text-primary w-10 h-10" />
            <p className="text-muted-foreground text-sm font-medium">Iniciando e conectando aos Agentes Especialistas...</p>
          </div>
        </div>
      </div>
    );
  }

  const score = data?.globalHealthScore || 0;
  const getScoreColor = (s: number) => {
    if (s >= 80) return 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20';
    if (s >= 60) return 'text-amber-500 bg-amber-500/10 border-amber-500/20';
    return 'text-rose-500 bg-rose-500/10 border-rose-500/20';
  };

  return (
    <div className="flex-1 flex flex-col bg-background min-h-screen pb-16">
      <Header />

      <main className="flex-1 p-6 md:p-8 max-w-7xl mx-auto w-full space-y-8">
        
        {/* Banner de Mensagem de Ação */}
        {actionMessage && (
          <div className="p-4 rounded-xl bg-primary/10 border border-primary/20 text-primary font-medium flex items-center justify-between animate-fade-in">
            <div className="flex items-center gap-3">
              <Sparkles className="w-5 h-5 animate-pulse" />
              <span>{actionMessage}</span>
            </div>
            {actionLoading && <RefreshCw className="w-4 h-4 animate-spin" />}
          </div>
        )}

        {/* --- CABEÇALHO EXECUTIVO E SCORE GLOBAL --- */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          
          {/* Card Principal: Score Geral */}
          <div className="lg:col-span-1 bg-card border border-border rounded-2xl p-6 flex flex-col items-center justify-center text-center relative overflow-hidden shadow-sm">
            <div className="absolute -top-10 -right-10 w-32 h-32 bg-primary/10 rounded-full blur-2xl pointer-events-none" />
            <div className="w-12 h-12 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mb-3">
              <Bot className="w-6 h-6 text-primary" />
            </div>
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Saúde Geral do Sistema</span>
            <div className="text-4xl font-extrabold tracking-tight text-foreground my-2">
              {score}<span className="text-xl font-normal text-muted-foreground">%</span>
            </div>
            <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${getScoreColor(score)}`}>
              {score >= 80 ? 'Sistema Saudável' : score >= 60 ? 'Requer Atenção' : 'Ação Crítica'}
            </span>
            <span className="text-[11px] text-muted-foreground mt-3 flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />
              Última varredura: {data ? new Date(data.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '--:--'}
            </span>
          </div>

          {/* Cards de Métricas Rápidas */}
          <div className="lg:col-span-3 grid grid-cols-1 sm:grid-cols-3 gap-4">
            
            <div className="bg-card border border-border rounded-2xl p-5 flex flex-col justify-between hover:border-primary/40 transition-colors">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground uppercase">Saúde das Rotinas</span>
                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                  <Activity className="w-4 h-4 text-emerald-500" />
                </div>
              </div>
              <div className="mt-4">
                <div className="text-2xl font-bold text-foreground">
                  {data?.routines.score || 0}%
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Latência Supabase: <span className="font-semibold text-foreground">{data?.routines.databaseLatencyMs || 0}ms</span>
                </p>
              </div>
            </div>

            <div className="bg-card border border-border rounded-2xl p-5 flex flex-col justify-between hover:border-primary/40 transition-colors">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground uppercase">Estoque Crítico (Compras)</span>
                <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center">
                  <Package className="w-4 h-4 text-amber-500" />
                </div>
              </div>
              <div className="mt-4">
                <div className="text-2xl font-bold text-amber-500">
                  {data?.business.criticalStockItems.length || 0} <span className="text-xs font-normal text-muted-foreground">Itens</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Risco iminente de desabastecimento
                </p>
              </div>
            </div>

            <div className="bg-card border border-border rounded-2xl p-5 flex flex-col justify-between hover:border-primary/40 transition-colors">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground uppercase">Bugs & Regras</span>
                <div className="w-8 h-8 rounded-lg bg-rose-500/10 flex items-center justify-center">
                  <Bug className="w-4 h-4 text-rose-500" />
                </div>
              </div>
              <div className="mt-4">
                <div className="text-2xl font-bold text-foreground">
                  {data?.bugs.errorCount || 0} <span className="text-xs font-normal text-muted-foreground">Alertas</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {data?.rules.violations.length || 0} violações de regras encontradas
                </p>
              </div>
            </div>

          </div>
        </div>

        {/* --- BARRA DE AÇÕES E DISPAROS AUTÔNOMOS --- */}
        <div className="bg-card border border-border rounded-2xl p-4 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
              <Zap className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-foreground">Ações e Automação de Agentes</h3>
              <p className="text-xs text-muted-foreground">Execute varreduras manuais ou acione as rotinas autônomas do sistema</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={handleTriggerJobs}
              disabled={!!actionLoading}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-muted hover:bg-muted/80 text-foreground transition-colors border border-border disabled:opacity-50"
            >
              <Play className="w-3.5 h-3.5 text-primary" />
              <span>Disparar Jobs de Rotina</span>
            </button>

            <button
              onClick={handleValidateRules}
              disabled={!!actionLoading}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-muted hover:bg-muted/80 text-foreground transition-colors border border-border disabled:opacity-50"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
              <span>Validar Regras de Negócio</span>
            </button>

            <button
              onClick={handleRunAll}
              disabled={!!actionLoading}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold bg-primary hover:bg-primary/90 text-primary-foreground transition-all shadow-md shadow-primary/20 disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${actionLoading === 'run_all' ? 'animate-spin' : ''}`} />
              <span>Executar Varredura Geral AI</span>
            </button>
          </div>
        </div>

        {/* --- CARDS DOS AGENTES ESPECIALISTAS --- */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          
          <div 
            onClick={() => setActiveTab('routines')}
            className={`cursor-pointer bg-card border rounded-2xl p-4 transition-all hover:shadow-md ${activeTab === 'routines' ? 'border-primary ring-1 ring-primary' : 'border-border'}`}
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-muted-foreground uppercase">Routine Health Agent</span>
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            </div>
            <p className="text-sm font-semibold text-foreground">Saúde de Rotinas & Jobs</p>
            <p className="text-xs text-muted-foreground mt-1">Status: {data?.routines.blingSyncStatus}</p>
          </div>

          <div 
            onClick={() => setActiveTab('rules')}
            className={`cursor-pointer bg-card border rounded-2xl p-4 transition-all hover:shadow-md ${activeTab === 'rules' ? 'border-primary ring-1 ring-primary' : 'border-border'}`}
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-muted-foreground uppercase">Rule Validation Agent</span>
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            </div>
            <p className="text-sm font-semibold text-foreground">Validação de Regras</p>
            <p className="text-xs text-muted-foreground mt-1">Cashback & Conversões Auditados</p>
          </div>

          <div 
            onClick={() => setActiveTab('business')}
            className={`cursor-pointer bg-card border rounded-2xl p-4 transition-all hover:shadow-md ${activeTab === 'business' ? 'border-primary ring-1 ring-primary' : 'border-border'}`}
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-muted-foreground uppercase">Business Intelligence</span>
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            </div>
            <p className="text-sm font-semibold text-foreground">Vendas, Estoque & IA</p>
            <p className="text-xs text-muted-foreground mt-1">Aprendizado Gemini Ativo</p>
          </div>

          <div 
            onClick={() => setActiveTab('bugs')}
            className={`cursor-pointer bg-card border rounded-2xl p-4 transition-all hover:shadow-md ${activeTab === 'bugs' ? 'border-primary ring-1 ring-primary' : 'border-border'}`}
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-muted-foreground uppercase">Bug Hunter Agent</span>
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            </div>
            <p className="text-sm font-semibold text-foreground">Caçador de Bugs</p>
            <p className="text-xs text-muted-foreground mt-1">{data?.bugs.errorCount || 0} Exceções Identificadas</p>
          </div>

        </div>

        {/* --- NAVEGAÇÃO DE ABAS ESPECIALIZADAS --- */}
        <div className="border-b border-border flex items-center gap-8 overflow-x-auto scrollbar-none">
          <button
            onClick={() => setActiveTab('business')}
            className={`pb-3 text-sm font-semibold flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap ${
              activeTab === 'business' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <Sparkles className="w-4 h-4" />
            <span>Aprendizado do Negócio, Vendas & Compras</span>
          </button>

          <button
            onClick={() => setActiveTab('rules')}
            className={`pb-3 text-sm font-semibold flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap ${
              activeTab === 'rules' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Validação de Regras de Negócio</span>
          </button>

          <button
            onClick={() => setActiveTab('routines')}
            className={`pb-3 text-sm font-semibold flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap ${
              activeTab === 'routines' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <Activity className="w-4 h-4" />
            <span>Saúde das Rotinas & Jobs</span>
          </button>

          <button
            onClick={() => setActiveTab('bugs')}
            className={`pb-3 text-sm font-semibold flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap ${
              activeTab === 'bugs' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <Bug className="w-4 h-4" />
            <span>Bugs & Audit de Código</span>
          </button>
        </div>

        {/* --- CONTEÚDO DAS ABAS --- */}
        {activeTab === 'business' && data && (
          <div className="space-y-8 animate-fade-in">
            
            {/* Bloco de Histórico de Aprendizado do Negócio */}
            <div className="bg-primary/5 border border-primary/20 rounded-2xl p-5 flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0 text-primary">
                <Bot className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <h4 className="text-sm font-bold text-foreground">Histórico de Aprendizado Contínuo do Negócio</h4>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                  {data.business.aiRecommendations.historicalInsight}
                </p>
              </div>
            </div>

            {/* Grid: Produtos Mais Vendidos vs Estoque Crítico (Compras) */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              
              {/* Produtos Mais Vendidos */}
              <div className="bg-card border border-border rounded-2xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <ShoppingBag className="w-5 h-5 text-primary" />
                    <h3 className="text-base font-bold text-foreground">Produtos Mais Vendidos (Top Sellers)</h3>
                  </div>
                </div>
                <div className="divide-y divide-border">
                  {data.business.topProducts.map((prod, idx) => (
                    <div key={idx} className="py-3 flex items-center justify-between text-sm">
                      <div className="flex items-center gap-3">
                        <span className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-xs font-bold text-muted-foreground">
                          #{idx + 1}
                        </span>
                        <span className="font-medium text-foreground">{prod.name}</span>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-foreground">R$ {prod.totalRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                        <div className="text-xs text-muted-foreground">{prod.salesCount} vendas</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Estoque Crítico & Alerta de Compras */}
              <div className="bg-card border border-border rounded-2xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-amber-500" />
                    <h3 className="text-base font-bold text-foreground">Estoque Crítico & Reposição de Compras</h3>
                  </div>
                  <span className="text-xs font-semibold text-amber-500 bg-amber-500/10 px-2.5 py-1 rounded-full">
                    Ação Necessária
                  </span>
                </div>
                <div className="divide-y divide-border">
                  {data.business.criticalStockItems.map((item, idx) => (
                    <div key={idx} className="py-3 flex items-center justify-between text-sm">
                      <div>
                        <div className="font-semibold text-foreground">{item.name}</div>
                        <div className="text-xs text-amber-500 font-medium">
                          Restam apenas {item.currentStock} un ({item.estimatedDaysLeft} dias de estoque)
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="inline-block px-3 py-1 rounded-lg bg-primary/10 text-primary text-xs font-bold">
                          Comprar +{item.suggestedReorderQty} un
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

            </div>

            {/* Conversão de Mensagens WhatsApp por Campanha */}
            <div className="bg-card border border-border rounded-2xl p-6">
              <div className="flex items-center gap-2 mb-4">
                <MessageCircle className="w-5 h-5 text-emerald-500" />
                <h3 className="text-base font-bold text-foreground">Conversão de Mensagens do WhatsApp</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-border text-xs text-muted-foreground font-semibold uppercase">
                      <th className="py-3 px-2">Campanha de Mensagem</th>
                      <th className="py-3 px-2">Disparos</th>
                      <th className="py-3 px-2">Conversões</th>
                      <th className="py-3 px-2">Taxa de Conversão</th>
                      <th className="py-3 px-2 text-right">Receita Gerada</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {data.business.messageConversions.map((camp, idx) => (
                      <tr key={idx} className="hover:bg-muted/50 transition-colors">
                        <td className="py-3 px-2 font-medium text-foreground">{camp.campaign}</td>
                        <td className="py-3 px-2 text-muted-foreground">{camp.totalSent}</td>
                        <td className="py-3 px-2 text-muted-foreground">{camp.totalConversions}</td>
                        <td className="py-3 px-2">
                          <span className="font-bold text-emerald-500">{camp.conversionRate}%</span>
                        </td>
                        <td className="py-3 px-2 text-right font-bold text-foreground">
                          R$ {camp.totalRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Recomendações Estratégicas do Gemini AI (Loja, Vendas, Compras) */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              
              <div className="bg-card border border-border rounded-2xl p-5 space-y-3">
                <div className="flex items-center gap-2 text-primary font-bold text-sm">
                  <Sparkles className="w-4 h-4" />
                  <span>Melhorias na Loja</span>
                </div>
                <ul className="space-y-2 text-xs text-muted-foreground">
                  {data.business.aiRecommendations.storeImprovements.map((rec, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <ChevronRight className="w-3.5 h-3.5 text-primary flex-shrink-0 mt-0.5" />
                      <span>{rec}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="bg-card border border-border rounded-2xl p-5 space-y-3">
                <div className="flex items-center gap-2 text-emerald-500 font-bold text-sm">
                  <TrendingUp className="w-4 h-4" />
                  <span>Melhorias nas Vendas</span>
                </div>
                <ul className="space-y-2 text-xs text-muted-foreground">
                  {data.business.aiRecommendations.salesImprovements.map((rec, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <ChevronRight className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0 mt-0.5" />
                      <span>{rec}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="bg-card border border-border rounded-2xl p-5 space-y-3">
                <div className="flex items-center gap-2 text-amber-500 font-bold text-sm">
                  <Package className="w-4 h-4" />
                  <span>Melhorias nas Compras</span>
                </div>
                <ul className="space-y-2 text-xs text-muted-foreground">
                  {data.business.aiRecommendations.purchasingImprovements.map((rec, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <ChevronRight className="w-3.5 h-3.5 text-amber-500 flex-shrink-0 mt-0.5" />
                      <span>{rec}</span>
                    </li>
                  ))}
                </ul>
              </div>

            </div>

          </div>
        )}

        {activeTab === 'rules' && data && (
          <div className="bg-card border border-border rounded-2xl p-6 space-y-6 animate-fade-in">
            <h3 className="text-base font-bold text-foreground">Conformidade e Auditoria de Regras de Negócio</h3>
            
            <div className="space-y-4">
              {data.rules.violations.map((v, i) => (
                <div key={i} className="p-4 rounded-xl border border-border flex items-start justify-between bg-muted/30">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                        v.severity === 'high' ? 'bg-rose-500/10 text-rose-500' : 'bg-amber-500/10 text-amber-500'
                      }`}>
                        {v.severity.toUpperCase()}
                      </span>
                      <h4 className="text-sm font-semibold text-foreground">{v.rule}</h4>
                    </div>
                    <p className="text-xs text-muted-foreground">{v.description}</p>
                  </div>
                  <span className="text-xs font-bold text-muted-foreground bg-muted px-2.5 py-1 rounded-lg">
                    {v.count} Ocorrência(s)
                  </span>
                </div>
              ))}

              {data.rules.violations.length === 0 && (
                <div className="p-8 text-center text-muted-foreground text-sm">
                  <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
                  Todas as regras de negócio de cashback, conversões e mensagens estão operando em 100% de conformidade!
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'routines' && data && (
          <div className="bg-card border border-border rounded-2xl p-6 space-y-6 animate-fade-in">
            <h3 className="text-base font-bold text-foreground">Saúde das Rotinas Operacionais & Latência</h3>
            
            <div className="divide-y divide-border">
              {data.routines.items.map((item, i) => (
                <div key={i} className="py-4 flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-semibold text-foreground">{item.name}</h4>
                    <p className="text-xs text-muted-foreground">{item.details}</p>
                  </div>
                  <div className="text-right flex items-center gap-4">
                    <span className="text-xs text-muted-foreground font-mono">{item.responseTimeMs} ms</span>
                    <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                      item.status === 'ok' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-amber-500/10 text-amber-500'
                    }`}>
                      {item.status.toUpperCase()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'bugs' && data && (
          <div className="bg-card border border-border rounded-2xl p-6 space-y-6 animate-fade-in">
            <h3 className="text-base font-bold text-foreground">Relatório de Exceções & Bugs de Código</h3>
            
            <div className="space-y-4">
              {data.bugs.issues.map((issue) => (
                <div key={issue.id} className="p-4 rounded-xl border border-border bg-muted/20 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono font-bold text-primary">{issue.id} - {issue.file} {issue.line ? `(Linha ${issue.line})` : ''}</span>
                    <span className="text-xs font-bold px-2 py-0.5 rounded bg-rose-500/10 text-rose-500 uppercase">{issue.severity}</span>
                  </div>
                  <p className="text-xs text-foreground font-medium">{issue.description}</p>
                  <p className="text-xs text-emerald-500 font-mono">💡 Sugestão: {issue.suggestion}</p>
                </div>
              ))}
            </div>
          </div>
        )}

      </main>
    </div>
  );
}
