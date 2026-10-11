'use client';
import { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import { 
  Building2, Users, Calendar, DollarSign, Award, Percent, 
  ArrowLeft, Search, Filter, Phone, Mail, CheckCircle2, 
  AlertTriangle, ShieldCheck, ChevronRight, Sparkles, Tag, 
  FileText, TrendingUp, Clock, HelpCircle, Lock, User, Package, ShoppingBag
} from 'lucide-react';
import { EventOpportunity, Coupon, LeadPriority, EventStage } from '@/lib/types/events';
import { STAGE_LABELS, PRIORITY_LABELS } from '@/lib/utils/priorityLogic';
import { EventOpportunityModal } from '@/components/EventOpportunityModal';

interface DashboardProps {
  campaign: any;
  leads: EventOpportunity[];
  coupons: Coupon[];
  quizSubmissionsCount: { started: number; completed: number };
  session?: any;
}

export function CampaignDashboardClient({
  campaign,
  leads,
  coupons,
  quizSubmissionsCount,
  session
}: DashboardProps) {
  const [activeTab, setActiveTab] = useState<'kpis' | 'leads' | 'coupons' | 'promocao'>('kpis');
  const [categoryView, setCategoryView] = useState<'all' | 'KIT' | 'EVENTO'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterPriority, setFilterPriority] = useState<string>('all');
  const [filterStage, setFilterStage] = useState<string>('all');
  const [filterMinGuests, setFilterMinGuests] = useState<string>('all');
  const [selectedOpportunity, setSelectedOpportunity] = useState<EventOpportunity | null>(null);
  const [leadsList, setLeadsList] = useState<EventOpportunity[]>(leads);

  // Sincroniza lista local quando prop do servidor mudar
  useEffect(() => {
    setLeadsList(leads);
  }, [leads]);

  const handleOpportunityUpdated = (updated: EventOpportunity) => {
    setLeadsList((prev) =>
      prev.map((item) => (item.id === updated.id ? { ...item, ...updated } : item))
    );
    if (selectedOpportunity?.id === updated.id) {
      setSelectedOpportunity((prev) => (prev ? { ...prev, ...updated } : null));
    }
  };

  const formatCurrency = (val: number = 0) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

  const sanitizePhone = (phone?: string) => (phone || '').replace(/\D/g, '');

  const isKitLead = (lead: EventOpportunity) =>
    lead.category === 'KIT' || lead.event_type === 'kit_churrasco';

  // 1. Desduplicação de leads únicos (não contar o mesmo participante duas vezes)
  const uniqueParticipantsMap = useMemo(() => {
    const map = new Map<string, EventOpportunity>();
    leadsList.forEach((lead) => {
      const cleanPhone = sanitizePhone(lead.contact_phone);
      const key = cleanPhone && cleanPhone.length >= 8 
        ? cleanPhone 
        : `${(lead.contact_name || '').toLowerCase().trim()}_${(lead.company_name || '').toLowerCase().trim()}`;
      if (!map.has(key)) {
        map.set(key, lead);
      }
    });
    return map;
  }, [leadsList]);

  const totalLeadsUnicos = uniqueParticipantsMap.size;
  const totalLeads = leadsList.length;

  // 2. Separação por Categoria (Kits vs Eventos)
  const kitLeads = useMemo(() => leadsList.filter((l) => isKitLead(l)), [leadsList]);
  const eventoLeads = useMemo(() => leadsList.filter((l) => !isKitLead(l)), [leadsList]);

  const totalKitLeads = kitLeads.length;
  const totalEventoLeads = eventoLeads.length;

  // 3. Indicadores de Fechamento e Vendas Reais
  const kitsVendidos = kitLeads.filter((l) => l.stage === 'fechado').length;
  const eventosFechados = eventoLeads.filter((l) => l.stage === 'fechado').length;
  const totalFechados = kitsVendidos + eventosFechados;

  // 4. Faturamentos Reais por Categoria
  const faturamentoKits = kitLeads
    .filter((l) => l.stage === 'fechado')
    .reduce((acc, l) => acc + (Number(l.contracted_value) || Number(l.estimated_value) || 0), 0);

  const faturamentoEventos = eventoLeads
    .filter((l) => l.stage === 'fechado')
    .reduce((acc, l) => acc + (Number(l.contracted_value) || Number(l.estimated_value) || 0), 0);

  const faturamentoTotalContratado = faturamentoKits + faturamentoEventos;

  // 5. Orçamentos em negociação / pipeline total
  const valorTotalOrcamentos = leadsList.reduce(
    (acc, l) => acc + (Number(l.estimated_value) || 0),
    0
  );

  // 6. Taxas de conversão por categoria
  const taxaConversaoKits =
    totalKitLeads > 0 ? ((kitsVendidos / totalKitLeads) * 100).toFixed(1) : '0.0';
  const taxaConversaoEventos =
    totalEventoLeads > 0 ? ((eventosFechados / totalEventoLeads) * 100).toFixed(1) : '0.0';
  const taxaConversaoGeral =
    totalLeads > 0 ? ((totalFechados / totalLeads) * 100).toFixed(1) : '0.0';

  // 7. Indicadores Adicionais de Qualificação
  const empresasIdentificadas = new Set(
    leadsList
      .map((l) => (l.company_name || '').trim().toLowerCase())
      .filter((n) => n && n !== 'não informada' && n !== 'individual')
  ).size;

  const leads15Plus = leadsList.filter((l) => (l.expected_guests || 0) >= 15).length;
  const leadsAltaPrioridade = leadsList.filter((l) => l.priority === 'ALTA').length;

  const solicitacoesOrcamento = leadsList.filter((l) =>
    ['orcamento_solicitado', 'proposta_enviada', 'negociacao', 'fechado'].includes(l.stage)
  ).length;

  const propostasEnviadas = leadsList.filter((l) =>
    ['proposta_enviada', 'negociacao', 'fechado'].includes(l.stage)
  ).length;

  const oportunidadesPerdidas = leadsList.filter((l) => l.stage === 'perdido').length;

  // Engajamento Quiz e Cupons
  const quizzesIniciados = quizSubmissionsCount.started || totalLeads;
  const quizzesConcluidos = quizSubmissionsCount.completed || coupons.length;
  const cuponsEmitidos = coupons.length;
  const cuponsUtilizados = coupons.filter((c) => c.status === 'UTILIZADO').length;

  // Filtros aplicados sobre a listagem de leads
  const filteredLeads = useMemo(() => {
    return leadsList.filter((lead) => {
      // 1. Filtro da Opção de Visualização (Todos, Kits, Eventos)
      if (categoryView === 'KIT' && !isKitLead(lead)) return false;
      if (categoryView === 'EVENTO' && isKitLead(lead)) return false;

      // 2. Busca textual
      const s = searchTerm.toLowerCase();
      const matchesSearch =
        !searchTerm ||
        (lead.company_name || '').toLowerCase().includes(s) ||
        (lead.contact_name || '').toLowerCase().includes(s) ||
        (lead.contact_phone || '').includes(searchTerm);

      // 3. Prioridade
      const matchesPriority = filterPriority === 'all' || lead.priority === filterPriority;

      // 4. Etapa Comercial
      const matchesStage = filterStage === 'all' || lead.stage === filterStage;

      // 5. Faixa de Participantes
      let matchesGuests = true;
      const guests = lead.expected_guests || 0;
      if (filterMinGuests === '15plus') {
        matchesGuests = guests >= 15;
      } else if (filterMinGuests === '26plus') {
        matchesGuests = guests >= 26;
      } else if (filterMinGuests === 'under15') {
        matchesGuests = guests < 15;
      }

      return matchesSearch && matchesPriority && matchesStage && matchesGuests;
    });
  }, [leadsList, categoryView, searchTerm, filterPriority, filterStage, filterMinGuests]);

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-16">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pt-2">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Link
              href="/campanhas"
              className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
            >
              <ArrowLeft size={14} />
              <span>Voltar para Campanhas</span>
            </Link>
            <span className="text-zinc-600">•</span>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase bg-amber-500/10 text-amber-400 border border-amber-500/20">
              {campaign?.code || 'BPE26'}
            </span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <span>{campaign?.name || 'Desafio Alpha Bull — BPE26'}</span>
          </h1>
          <p className="text-muted-foreground font-medium text-sm">
            Painel Central Unificado de Captação e Gestão de Leads BPE 2026 (Kits e Eventos).
          </p>
        </div>

        {/* Abas Principais */}
        <div className="flex items-center p-1 bg-muted/40 border border-border rounded-xl">
          <button
            onClick={() => setActiveTab('kpis')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'kpis'
                ? 'bg-amber-500 text-black shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Visão Geral (Indicadores)
          </button>
          <button
            onClick={() => setActiveTab('leads')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
              activeTab === 'leads'
                ? 'bg-amber-500 text-black shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <span>Leads BPE26</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-black/10 text-current font-bold">
              {leadsList.length}
            </span>
          </button>
          <button
            onClick={() => setActiveTab('coupons')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'coupons'
                ? 'bg-amber-500 text-black shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Cupons ({coupons.length})
          </button>
          <button
            onClick={() => setActiveTab('promocao')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'promocao'
                ? 'bg-amber-500 text-black shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Promoção 5 Isenções
          </button>
        </div>
      </div>

      {/* ABA 1: VISÃO GERAL COM OS INDICADORES REAIS UNIFICADOS */}
      {activeTab === 'kpis' && (
        <div className="space-y-6">
          {/* Seção 1: Indicadores Comerciais Primários & Categorias */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="rounded-2xl border border-border bg-card p-5 shadow-sm space-y-1">
              <span className="text-xs font-medium text-muted-foreground">Total de Leads Únicos</span>
              <div className="text-2xl font-bold text-foreground">{totalLeadsUnicos}</div>
              <p className="text-[11px] text-amber-400 font-medium">
                {totalLeads} oportunidades cadastradas (sem duplicidades)
              </p>
            </div>

            <div className="rounded-2xl border border-border bg-card p-5 shadow-sm space-y-1">
              <span className="text-xs font-medium text-muted-foreground">Leads de Kits Churrasco</span>
              <div className="text-2xl font-bold text-amber-400">{totalKitLeads}</div>
              <p className="text-[11px] text-zinc-400 font-medium">
                Kits de cortes nobres Alpha Bull
              </p>
            </div>

            <div className="rounded-2xl border border-border bg-card p-5 shadow-sm space-y-1">
              <span className="text-xs font-medium text-muted-foreground">Leads de Eventos</span>
              <div className="text-2xl font-bold text-blue-400">{totalEventoLeads}</div>
              <p className="text-[11px] text-zinc-400 font-medium">
                Confraternizações corporativas B2B
              </p>
            </div>

            <div className="rounded-2xl border border-border bg-card p-5 shadow-sm space-y-1">
              <span className="text-xs font-medium text-muted-foreground">Empresas Identificadas</span>
              <div className="text-2xl font-bold text-emerald-400">{empresasIdentificadas}</div>
              <p className="text-[11px] text-muted-foreground">Contatos corporativos únicos</p>
            </div>
          </div>

          {/* Seção 2: Conversão & Vendas Reais por Categoria */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="rounded-2xl border border-border bg-card p-5 shadow-sm space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">Kits Vendidos</span>
                <span className="text-[10px] font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20">
                  {taxaConversaoKits}% conv.
                </span>
              </div>
              <div className="text-2xl font-bold text-foreground">{kitsVendidos}</div>
              <p className="text-[11px] text-amber-400/90 font-medium">
                Faturamento: {formatCurrency(faturamentoKits)}
              </p>
            </div>

            <div className="rounded-2xl border border-border bg-card p-5 shadow-sm space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">Eventos Fechados</span>
                <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20">
                  {taxaConversaoEventos}% conv.
                </span>
              </div>
              <div className="text-2xl font-bold text-emerald-400">{eventosFechados}</div>
              <p className="text-[11px] text-emerald-400 font-medium">
                Faturamento: {formatCurrency(faturamentoEventos)}
              </p>
            </div>

            <div className="rounded-2xl border border-border bg-card p-5 shadow-sm space-y-1">
              <span className="text-xs font-medium text-muted-foreground">Faturamento Total Fechado</span>
              <div className="text-2xl font-bold text-emerald-400">{formatCurrency(faturamentoTotalContratado)}</div>
              <p className="text-[11px] text-zinc-400">
                Taxa de conversão global: {taxaConversaoGeral}%
              </p>
            </div>

            <div className="rounded-2xl border border-border bg-card p-5 shadow-sm space-y-1">
              <span className="text-xs font-medium text-muted-foreground">Pipeline / Orçamentos Totais</span>
              <div className="text-2xl font-bold text-foreground">{formatCurrency(valorTotalOrcamentos)}</div>
              <p className="text-[11px] text-zinc-400">{solicitacoesOrcamento} orçamentos solicitados</p>
            </div>
          </div>

          {/* Seção 3: Qualificação e Funil Comercial */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="rounded-2xl border border-border bg-card p-5 shadow-sm space-y-1">
              <span className="text-xs font-medium text-muted-foreground">Propostas Enviadas</span>
              <div className="text-2xl font-bold text-foreground">{propostasEnviadas}</div>
              <p className="text-[11px] text-zinc-400">Em negociação ativa</p>
            </div>

            <div className="rounded-2xl border border-border bg-card p-5 shadow-sm space-y-1">
              <span className="text-xs font-medium text-muted-foreground">Leads com ≥ 15 Participantes</span>
              <div className="text-2xl font-bold text-foreground">{leads15Plus}</div>
              <p className="text-[11px] text-blue-400 font-medium">Elegíveis à campanha BPE26</p>
            </div>

            <div className="rounded-2xl border border-border bg-card p-5 shadow-sm space-y-1">
              <span className="text-xs font-medium text-muted-foreground">Leads Alta Prioridade</span>
              <div className="text-2xl font-bold text-rose-400">{leadsAltaPrioridade}</div>
              <p className="text-[11px] text-muted-foreground">Decisão imediata nos próximos 60 dias</p>
            </div>

            <div className="rounded-2xl border border-border bg-card p-5 shadow-sm space-y-1">
              <span className="text-xs font-medium text-muted-foreground">Oportunidades Perdidas</span>
              <div className="text-2xl font-bold text-zinc-400">{oportunidadesPerdidas}</div>
              <p className="text-[11px] text-zinc-500">Com registro de motivo</p>
            </div>
          </div>

          {/* Seção 4: Quiz, Cupons e Engajamento */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="rounded-2xl border border-border bg-card p-5 shadow-sm space-y-2">
              <span className="text-xs font-semibold text-amber-400 uppercase tracking-wider block">
                Engajamento no Quiz
              </span>
              <div className="flex justify-between items-center pt-2">
                <div>
                  <span className="text-xs text-muted-foreground block">Iniciados</span>
                  <p className="text-xl font-bold text-foreground">{quizzesIniciados}</p>
                </div>
                <div className="text-right">
                  <span className="text-xs text-muted-foreground block">Concluídos</span>
                  <p className="text-xl font-bold text-emerald-400">{quizzesConcluidos}</p>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-card p-5 shadow-sm space-y-2">
              <span className="text-xs font-semibold text-amber-400 uppercase tracking-wider block">
                Cupons de Cortes Nobres
              </span>
              <div className="flex justify-between items-center pt-2">
                <div>
                  <span className="text-xs text-muted-foreground block">Emitidos</span>
                  <p className="text-xl font-bold text-foreground">{cuponsEmitidos}</p>
                </div>
                <div className="text-right">
                  <span className="text-xs text-muted-foreground block">Utilizados</span>
                  <p className="text-xl font-bold text-indigo-400">{cuponsUtilizados}</p>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-card p-5 shadow-sm space-y-2">
              <span className="text-xs font-semibold text-emerald-400 uppercase tracking-wider block">
                Faturamento Geral Fechado
              </span>
              <div className="flex justify-between items-center pt-2">
                <div>
                  <span className="text-xs text-muted-foreground block">Kits</span>
                  <p className="text-lg font-bold text-amber-300">{formatCurrency(faturamentoKits)}</p>
                </div>
                <div className="text-right">
                  <span className="text-xs text-muted-foreground block">Eventos</span>
                  <p className="text-lg font-bold text-emerald-400">{formatCurrency(faturamentoEventos)}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ABA 2: LISTAGEM UNIFICADA DE LEADS (TODOS, KITS, EVENTOS) */}
      {activeTab === 'leads' && (
        <div className="space-y-4">
          {/* Sub-abas de Opções de Visualização: Todos os Leads, Kits, Eventos */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-1.5 p-1 bg-muted/30 border border-border rounded-xl w-fit">
              <button
                onClick={() => setCategoryView('all')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                  categoryView === 'all'
                    ? 'bg-amber-500 text-black shadow-sm font-bold'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <span>Todos os Leads</span>
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-black/10 text-current font-bold">
                  {leadsList.length}
                </span>
              </button>

              <button
                onClick={() => setCategoryView('KIT')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                  categoryView === 'KIT'
                    ? 'bg-amber-500 text-black shadow-sm font-bold'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Package className="w-3.5 h-3.5" />
                <span>Kits</span>
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-black/10 text-current font-bold">
                  {totalKitLeads}
                </span>
              </button>

              <button
                onClick={() => setCategoryView('EVENTO')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                  categoryView === 'EVENTO'
                    ? 'bg-amber-500 text-black shadow-sm font-bold'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Building2 className="w-3.5 h-3.5" />
                <span>Eventos</span>
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-black/10 text-current font-bold">
                  {totalEventoLeads}
                </span>
              </button>
            </div>

            <span className="text-xs text-muted-foreground">
              Mostrando <strong className="text-foreground">{filteredLeads.length}</strong> de{' '}
              {categoryView === 'all'
                ? `${leadsList.length} leads`
                : categoryView === 'KIT'
                ? `${totalKitLeads} kits`
                : `${totalEventoLeads} eventos`}
            </span>
          </div>

          {/* Barra de Filtros Pesquisa e Critérios */}
          <div className="p-4 rounded-2xl border border-border bg-card flex flex-col md:flex-row gap-3 items-center justify-between">
            <div className="relative w-full md:w-80">
              <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Buscar cliente, empresa ou telefone..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-muted/40 border border-border rounded-xl text-xs text-foreground placeholder-muted-foreground focus:outline-none focus:border-amber-500"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
              <select
                value={filterPriority}
                onChange={(e) => setFilterPriority(e.target.value)}
                className="px-3 py-2 bg-muted/40 border border-border rounded-xl text-xs text-foreground focus:outline-none focus:border-amber-500"
              >
                <option value="all">Todas Prioridades</option>
                <option value="ALTA">Alta Prioridade</option>
                <option value="MEDIA">Média Prioridade</option>
                <option value="EM_NUTRICAO">Em Nutrição</option>
                <option value="OUTRAS">Outras</option>
              </select>

              <select
                value={filterStage}
                onChange={(e) => setFilterStage(e.target.value)}
                className="px-3 py-2 bg-muted/40 border border-border rounded-xl text-xs text-foreground focus:outline-none focus:border-amber-500"
              >
                <option value="all">Todas Etapas</option>
                <option value="novo_lead">Novo Lead</option>
                <option value="contato_realizado">Contato Realizado</option>
                <option value="qualificacao">Em Qualificação</option>
                <option value="orcamento_solicitado">Orçamento Solicitado</option>
                <option value="proposta_enviada">Proposta Enviada</option>
                <option value="negociacao">Em Negociação</option>
                <option value="fechado">Fechado</option>
                <option value="perdido">Perdido</option>
              </select>

              <select
                value={filterMinGuests}
                onChange={(e) => setFilterMinGuests(e.target.value)}
                className="px-3 py-2 bg-muted/40 border border-border rounded-xl text-xs text-foreground focus:outline-none focus:border-amber-500"
              >
                <option value="all">Qtd. Participantes</option>
                <option value="15plus">≥ 15 Participantes</option>
                <option value="26plus">≥ 26 Participantes</option>
                <option value="under15">&lt; 15 Participantes</option>
              </select>
            </div>
          </div>

          {/* Tabela de Leads BPE26 Unificada */}
          <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-muted/40 border-b border-border uppercase tracking-wider text-muted-foreground font-semibold">
                  <tr>
                    <th className="px-5 py-3.5">Cliente</th>
                    <th className="px-5 py-3.5">Empresa</th>
                    <th className="px-5 py-3.5">WhatsApp</th>
                    <th className="px-5 py-3.5">Categoria</th>
                    <th className="px-5 py-3.5">Participantes</th>
                    <th className="px-5 py-3.5">Data Cadastro</th>
                    <th className="px-5 py-3.5">Etapa Comercial</th>
                    <th className="px-5 py-3.5">Responsável</th>
                    <th className="px-5 py-3.5 text-right">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredLeads.map((lead) => {
                    const isKit = isKitLead(lead);
                    const sLabel = STAGE_LABELS[lead.stage] || lead.stage || 'Novo Lead';
                    const cleanPhone = sanitizePhone(lead.contact_phone);
                    const wppUrl = cleanPhone 
                      ? `https://wa.me/55${cleanPhone}` 
                      : '#';

                    const formattedDate = lead.created_at
                      ? new Date(lead.created_at).toLocaleDateString('pt-BR')
                      : 'Recente';

                    const guestsDisplay = lead.expected_guests
                      ? `${lead.expected_guests} pessoas`
                      : lead.guests_range || 'A definir';

                    return (
                      <tr
                        key={lead.id}
                        className="hover:bg-muted/30 transition-colors cursor-pointer group"
                        onClick={() => setSelectedOpportunity(lead)}
                      >
                        {/* Nome do Cliente */}
                        <td className="px-5 py-4 font-bold text-foreground">
                          <div className="flex items-center gap-2">
                            <User className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                            <span className="group-hover:text-amber-400 transition-colors">
                              {lead.contact_name || 'Não informado'}
                            </span>
                          </div>
                          {lead.contact_role && (
                            <span className="text-[10px] text-muted-foreground block pl-5.5">
                              {lead.contact_role}
                            </span>
                          )}
                        </td>

                        {/* Empresa */}
                        <td className="px-5 py-4 text-foreground font-medium">
                          <div className="flex items-center gap-1.5">
                            <Building2 className="w-3.5 h-3.5 text-amber-400/80 shrink-0" />
                            <span>{lead.company_name || 'Não informada'}</span>
                          </div>
                        </td>

                        {/* WhatsApp */}
                        <td className="px-5 py-4">
                          {cleanPhone ? (
                            <a
                              href={wppUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 font-mono text-[11px] transition-colors"
                              title="Conversar no WhatsApp"
                            >
                              <Phone className="w-3 h-3 shrink-0" />
                              <span>{lead.contact_phone}</span>
                            </a>
                          ) : (
                            <span className="text-muted-foreground">{lead.contact_phone || '—'}</span>
                          )}
                        </td>

                        {/* Categoria */}
                        <td className="px-5 py-4">
                          {isKit ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-500/15 text-amber-300 border border-amber-500/30">
                              <Package className="w-3 h-3" />
                              Kit
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-blue-500/15 text-blue-300 border border-blue-500/30">
                              <Building2 className="w-3 h-3" />
                              Evento
                            </span>
                          )}
                        </td>

                        {/* Quantidade de Participantes */}
                        <td className="px-5 py-4 font-semibold text-foreground">
                          <div className="flex items-center gap-1.5">
                            <Users className="w-3.5 h-3.5 text-zinc-400" />
                            <span>{guestsDisplay}</span>
                          </div>
                        </td>

                        {/* Data do Cadastro */}
                        <td className="px-5 py-4 text-muted-foreground">
                          <div className="flex items-center gap-1.5">
                            <Calendar className="w-3.5 h-3.5 text-zinc-500" />
                            <span>{formattedDate}</span>
                          </div>
                        </td>

                        {/* Etapa Comercial */}
                        <td className="px-5 py-4">
                          <span className={`px-2.5 py-1 rounded-lg font-medium text-[11px] ${
                            lead.stage === 'fechado'
                              ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                              : lead.stage === 'perdido'
                              ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                              : 'bg-muted text-foreground border border-border'
                          }`}>
                            {sLabel}
                          </span>
                        </td>

                        {/* Responsável pelo Atendimento */}
                        <td className="px-5 py-4 text-muted-foreground">
                          {lead.assigned_to_name || 'Equipe Alpha Bull'}
                        </td>

                        {/* Botão GERENCIAR */}
                        <td className="px-5 py-4 text-right">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedOpportunity(lead);
                            }}
                            className="px-3 py-1.5 rounded-lg text-[11px] font-bold bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 transition-colors cursor-pointer inline-flex items-center gap-1"
                          >
                            <span>GERENCIAR</span>
                            <ChevronRight className="w-3 h-3" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}

                  {filteredLeads.length === 0 && (
                    <tr>
                      <td colSpan={9} className="px-6 py-12 text-center text-muted-foreground">
                        Nenhum lead encontrado com os filtros selecionados.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ABA 3: CUPONS DE DESCONTO */}
      {activeTab === 'coupons' && (
        <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-sm">
          <div className="p-5 border-b border-border bg-muted/20">
            <h3 className="font-bold text-foreground text-sm">Cupons Emitidos pelo Quiz BPE26</h3>
            <p className="text-xs text-muted-foreground">
              Descontos de 5% a 20% válidos exclusivamente em cortes nobres na boutique Alpha Bull.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-muted/40 border-b border-border uppercase tracking-wider text-muted-foreground font-semibold">
                <tr>
                  <th className="px-5 py-3.5">Código do Cupom</th>
                  <th className="px-5 py-3.5">Desconto</th>
                  <th className="px-5 py-3.5">Status</th>
                  <th className="px-5 py-3.5">Emissão</th>
                  <th className="px-5 py-3.5">Validade</th>
                  <th className="px-5 py-3.5">Restrição</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {coupons.map((c) => (
                  <tr key={c.id || c.code} className="hover:bg-muted/30 transition-colors">
                    <td className="px-5 py-4 font-mono font-bold text-amber-400 text-sm">
                      {c.code}
                    </td>
                    <td className="px-5 py-4 font-bold text-foreground">
                      {c.discount_percent}% OFF
                    </td>
                    <td className="px-5 py-4">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                          c.status === 'ATIVO'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : 'bg-zinc-500/10 text-zinc-400'
                        }`}
                      >
                        {c.status}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-muted-foreground">
                      {new Date(c.issued_at).toLocaleDateString('pt-BR')}
                    </td>
                    <td className="px-5 py-4 text-muted-foreground">
                      {new Date(c.expires_at).toLocaleDateString('pt-BR')}
                    </td>
                    <td className="px-5 py-4 text-muted-foreground max-w-xs truncate" title={c.restrictions}>
                      {c.restrictions}
                    </td>
                  </tr>
                ))}

                {coupons.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-muted-foreground">
                      Nenhum cupom gerado até o momento.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ABA 4: PROMOÇÃO CINCO ISENÇÕES */}
      {activeTab === 'promocao' && (
        <div className="space-y-6">
          <div className="p-6 rounded-2xl border border-amber-500/30 bg-amber-500/5 space-y-3">
            <div className="flex items-center gap-2 text-amber-400 font-bold text-sm">
              <Lock className="w-4 h-4" />
              <span>Módulo Administrativo Promocional — Status: DESATIVADO POR PADRÃO</span>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Conforme as diretrizes de governança e conformidade legal, a promoção de <strong>Cinco Isenções</strong> não gera sorteios nem divulga premiações automaticamente antes da devida validação jurídica e obtenção de autorização aplicável.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2 text-xs text-foreground font-medium">
              <div className="p-3 rounded-xl bg-background border border-border">
                <span className="text-muted-foreground block text-[10px]">Premiação</span>
                5 Participantes Isentos
              </div>
              <div className="p-3 rounded-xl bg-background border border-border">
                <span className="text-muted-foreground block text-[10px]">Regra Mínima</span>
                Mínimo de 15 convidados contratados
              </div>
              <div className="p-3 rounded-xl bg-background border border-border">
                <span className="text-muted-foreground block text-[10px]">Abrangência</span>
                Não é evento gratuito, isenta 5 participantes
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-card p-6 space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-base font-bold text-foreground">Leads Elegíveis Mapeados (≥ 15 convidados)</h3>
                <p className="text-xs text-muted-foreground">
                  Empresas cadastradas que cumprem o pré-requisito de porte de evento para futura aplicação de regras autorizadas.
                </p>
              </div>
              <span className="text-xs font-bold text-amber-400 bg-amber-500/10 px-3 py-1 rounded-full border border-amber-500/20">
                {leads15Plus} Leads Elegíveis
              </span>
            </div>

            <div className="divide-y divide-border pt-2">
              {leadsList.filter((l) => (l.expected_guests || 0) >= 15).map((l) => (
                <div key={l.id} className="py-3 flex items-center justify-between">
                  <div>
                    <h4 className="font-bold text-foreground text-xs">{l.company_name}</h4>
                    <span className="text-[11px] text-muted-foreground">{l.contact_name} • {l.contact_phone}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-semibold text-emerald-400">{l.expected_guests} participantes</span>
                    <span className="text-[10px] text-muted-foreground block">
                      {l.event_date ? new Date(l.event_date).toLocaleDateString('pt-BR') : 'Data a definir'}
                    </span>
                  </div>
                </div>
              ))}

              {leads15Plus === 0 && (
                <p className="text-xs text-muted-foreground py-6 text-center">
                  Nenhum lead com 15 ou mais convidados cadastrado ainda.
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal Interativo Compartilhado para gerenciar lead selecionado */}
      {selectedOpportunity && (
        <EventOpportunityModal
          opportunity={selectedOpportunity}
          isOpen={Boolean(selectedOpportunity)}
          onClose={() => setSelectedOpportunity(null)}
          session={session}
          onSaveSuccess={handleOpportunityUpdated}
        />
      )}
    </div>
  );
}
