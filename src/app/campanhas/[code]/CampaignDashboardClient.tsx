'use client';
import { useState, useMemo } from 'react';
import Link from 'next/link';
import { 
  Building2, Users, Calendar, DollarSign, Award, Percent, 
  ArrowLeft, Search, Filter, Phone, Mail, CheckCircle2, 
  AlertTriangle, ShieldCheck, ChevronRight, Sparkles, Tag, 
  FileText, TrendingUp, Clock, HelpCircle, Lock
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
  const [searchTerm, setSearchTerm] = useState('');
  const [filterPriority, setFilterPriority] = useState<string>('all');
  const [filterStage, setFilterStage] = useState<string>('all');
  const [filterMinGuests, setFilterMinGuests] = useState<string>('all');
  const [selectedOpportunity, setSelectedOpportunity] = useState<EventOpportunity | null>(null);

  const formatCurrency = (val: number = 0) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

  // Filtros aplicados sobre os leads
  const filteredLeads = useMemo(() => {
    return leads.filter((lead) => {
      const matchesSearch = 
        !searchTerm ||
        lead.company_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        lead.contact_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        lead.contact_phone.includes(searchTerm);

      const matchesPriority = filterPriority === 'all' || lead.priority === filterPriority;
      const matchesStage = filterStage === 'all' || lead.stage === filterStage;

      let matchesGuests = true;
      if (filterMinGuests === '15plus') {
        matchesGuests = Boolean(lead.expected_guests && lead.expected_guests >= 15);
      } else if (filterMinGuests === '26plus') {
        matchesGuests = Boolean(lead.expected_guests && lead.expected_guests >= 26);
      } else if (filterMinGuests === 'under15') {
        matchesGuests = Boolean(lead.expected_guests && lead.expected_guests < 15);
      }

      return matchesSearch && matchesPriority && matchesStage && matchesGuests;
    });
  }, [leads, searchTerm, filterPriority, filterStage, filterMinGuests]);

  // Cálculos dos 15 Indicadores Gerenciais Obrigatórios
  const totalLeads = leads.length;
  const empresasIdentificadas = new Set(leads.map(l => l.company_name.trim().toLowerCase())).size;
  const leads15Plus = leads.filter(l => (l.expected_guests || 0) >= 15).length;
  const leadsAltaPrioridade = leads.filter(l => l.priority === 'ALTA').length;

  const quizzesIniciados = quizSubmissionsCount.started || totalLeads;
  const quizzesConcluidos = quizSubmissionsCount.completed || coupons.length;

  const cuponsEmitidos = coupons.length;
  const cuponsUtilizados = coupons.filter(c => c.status === 'UTILIZADO').length;

  const solicitacoesOrcamento = leads.filter(l => 
    ['orcamento_solicitado', 'proposta_enviada', 'negociacao', 'fechado'].includes(l.stage)
  ).length;

  const propostasEnviadas = leads.filter(l => 
    ['proposta_enviada', 'negociacao', 'fechado'].includes(l.stage)
  ).length;

  const eventosFechados = leads.filter(l => l.stage === 'fechado').length;
  const oportunidadesPerdidas = leads.filter(l => l.stage === 'perdido').length;

  const valorTotalOrcamentos = leads.reduce((acc, l) => acc + (Number(l.estimated_value) || 0), 0);
  const faturamentoContratado = leads.reduce((acc, l) => acc + (Number(l.contracted_value) || 0), 0);

  const taxaConversao = totalLeads > 0 ? ((eventosFechados / totalLeads) * 100).toFixed(1) : '0.0';

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
            Painel Gerencial de Captação de Confraternizações Empresariais e Gestão do BPE 2026.
          </p>
        </div>

        {/* Abas */}
        <div className="flex items-center p-1 bg-muted/40 border border-border rounded-xl">
          <button
            onClick={() => setActiveTab('kpis')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'kpis' ? 'bg-amber-500 text-black shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Visão Geral (15 KPIs)
          </button>
          <button
            onClick={() => setActiveTab('leads')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'leads' ? 'bg-amber-500 text-black shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Leads Corporativos ({leads.length})
          </button>
          <button
            onClick={() => setActiveTab('coupons')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'coupons' ? 'bg-amber-500 text-black shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Cupons ({coupons.length})
          </button>
          <button
            onClick={() => setActiveTab('promocao')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'promocao' ? 'bg-amber-500 text-black shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Promoção 5 Isenções
          </button>
        </div>
      </div>

      {/* ABA 1: VISÃO GERAL COM OS 15 INDICADORES */}
      {activeTab === 'kpis' && (
        <div className="space-y-6">
          {/* Seção 1: Indicadores Comerciais Primários */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="rounded-2xl border border-border bg-card p-5 shadow-sm space-y-1">
              <span className="text-xs font-medium text-muted-foreground">Total de Leads Captados</span>
              <div className="text-2xl font-bold text-foreground">{totalLeads}</div>
              <p className="text-[11px] text-amber-400 font-medium">Captação via QR Code</p>
            </div>

            <div className="rounded-2xl border border-border bg-card p-5 shadow-sm space-y-1">
              <span className="text-xs font-medium text-muted-foreground">Empresas Identificadas</span>
              <div className="text-2xl font-bold text-foreground">{empresasIdentificadas}</div>
              <p className="text-[11px] text-emerald-400 font-medium">Contatos B2B únicos</p>
            </div>

            <div className="rounded-2xl border border-border bg-card p-5 shadow-sm space-y-1">
              <span className="text-xs font-medium text-muted-foreground">Leads com ≥ 15 Convidados</span>
              <div className="text-2xl font-bold text-foreground">{leads15Plus}</div>
              <p className="text-[11px] text-blue-400 font-medium">Elegíveis à confraternização</p>
            </div>

            <div className="rounded-2xl border border-border bg-card p-5 shadow-sm space-y-1">
              <span className="text-xs font-medium text-muted-foreground">Leads de Alta Prioridade</span>
              <div className="text-2xl font-bold text-rose-400">{leadsAltaPrioridade}</div>
              <p className="text-[11px] text-muted-foreground">Próximos 60 dias e ≥ 26 conv.</p>
            </div>
          </div>

          {/* Seção 2: Funil Comercial e Valores Financeiros */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="rounded-2xl border border-border bg-card p-5 shadow-sm space-y-1">
              <span className="text-xs font-medium text-muted-foreground">Solicitações de Orçamento</span>
              <div className="text-2xl font-bold text-foreground">{solicitacoesOrcamento}</div>
              <p className="text-[11px] text-zinc-400">Interesse explícito</p>
            </div>

            <div className="rounded-2xl border border-border bg-card p-5 shadow-sm space-y-1">
              <span className="text-xs font-medium text-muted-foreground">Propostas Enviadas</span>
              <div className="text-2xl font-bold text-foreground">{propostasEnviadas}</div>
              <p className="text-[11px] text-zinc-400">Em negociação ativa</p>
            </div>

            <div className="rounded-2xl border border-border bg-card p-5 shadow-sm space-y-1">
              <span className="text-xs font-medium text-muted-foreground">Eventos Fechados</span>
              <div className="text-2xl font-bold text-emerald-400">{eventosFechados}</div>
              <p className="text-[11px] text-emerald-500 font-medium">Taxa de conversão: {taxaConversao}%</p>
            </div>

            <div className="rounded-2xl border border-border bg-card p-5 shadow-sm space-y-1">
              <span className="text-xs font-medium text-muted-foreground">Oportunidades Perdidas</span>
              <div className="text-2xl font-bold text-zinc-400">{oportunidadesPerdidas}</div>
              <p className="text-[11px] text-zinc-500">Com registro de motivo</p>
            </div>
          </div>

          {/* Seção 3: Quiz, Cupons e Receita */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="rounded-2xl border border-border bg-card p-5 shadow-sm space-y-2">
              <span className="text-xs font-semibold text-amber-400 uppercase tracking-wider block">Engajamento no Quiz</span>
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
              <span className="text-xs font-semibold text-amber-400 uppercase tracking-wider block">Cupons de Cortes Nobres</span>
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
              <span className="text-xs font-semibold text-emerald-400 uppercase tracking-wider block">Pipeline Financeiro</span>
              <div className="flex justify-between items-center pt-2">
                <div>
                  <span className="text-xs text-muted-foreground block">Orçamentos Totais</span>
                  <p className="text-lg font-bold text-foreground">{formatCurrency(valorTotalOrcamentos)}</p>
                </div>
                <div className="text-right">
                  <span className="text-xs text-muted-foreground block">Faturamento Fechado</span>
                  <p className="text-lg font-bold text-emerald-400">{formatCurrency(faturamentoContratado)}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ABA 2: LEADS CORPORATIVOS COM FILTROS */}
      {activeTab === 'leads' && (
        <div className="space-y-4">
          {/* Barra de Filtros */}
          <div className="p-4 rounded-2xl border border-border bg-card flex flex-col md:flex-row gap-3 items-center justify-between">
            <div className="relative w-full md:w-72">
              <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Buscar empresa ou responsável..."
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
                <option value="all">Qtd. Convidados</option>
                <option value="15plus">≥ 15 Convidados</option>
                <option value="26plus">≥ 26 Convidados</option>
                <option value="under15">&lt; 15 Convidados</option>
              </select>
            </div>
          </div>

          {/* Tabela de Leads de Eventos */}
          <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-muted/40 border-b border-border uppercase tracking-wider text-muted-foreground font-semibold">
                  <tr>
                    <th className="px-5 py-3.5">Empresa</th>
                    <th className="px-5 py-3.5">Responsável / Cargo</th>
                    <th className="px-5 py-3.5">Convidados</th>
                    <th className="px-5 py-3.5">Data Prevista</th>
                    <th className="px-5 py-3.5">Prioridade</th>
                    <th className="px-5 py-3.5">Etapa Comercial</th>
                    <th className="px-5 py-3.5 text-right">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredLeads.map((lead) => {
                    const pInfo = PRIORITY_LABELS[lead.priority] || PRIORITY_LABELS.EM_NUTRICAO;
                    const sLabel = STAGE_LABELS[lead.stage] || 'Novo Lead';

                    return (
                      <tr 
                        key={lead.id} 
                        className="hover:bg-muted/30 transition-colors cursor-pointer"
                        onClick={() => setSelectedOpportunity(lead)}
                      >
                        <td className="px-5 py-4 font-bold text-foreground">
                          <div className="flex items-center gap-2">
                            <Building2 className="w-3.5 h-3.5 text-amber-400" />
                            <span>{lead.company_name}</span>
                          </div>
                        </td>
                        <td className="px-5 py-4 text-muted-foreground">
                          <div className="font-medium text-foreground">{lead.contact_name}</div>
                          <div className="text-[10px]">{lead.contact_phone} {lead.contact_role ? `• ${lead.contact_role}` : ''}</div>
                        </td>
                        <td className="px-5 py-4 font-semibold text-foreground">
                          {lead.expected_guests ? `${lead.expected_guests} pessoas` : 'A definir'}
                        </td>
                        <td className="px-5 py-4 text-muted-foreground">
                          {lead.event_date ? new Date(lead.event_date).toLocaleDateString('pt-BR') : 'A definir'}
                        </td>
                        <td className="px-5 py-4">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${pInfo.bg} ${pInfo.color}`}>
                            {pInfo.label}
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          <span className="px-2.5 py-1 rounded-lg bg-muted text-foreground font-medium text-[11px]">
                            {sLabel}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-right">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedOpportunity(lead);
                            }}
                            className="px-3 py-1.5 rounded-lg text-[11px] font-semibold bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 transition-colors"
                          >
                            Gerenciar
                          </button>
                        </td>
                      </tr>
                    );
                  })}

                  {filteredLeads.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-6 py-12 text-center text-muted-foreground">
                        Nenhum lead de evento corporativo encontrado com os filtros selecionados.
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
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                        c.status === 'ATIVO' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-zinc-500/10 text-zinc-400'
                      }`}>
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
          {/* Card de Aviso Legal Mandatório (Requisito 9) */}
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

          {/* Listagem de Leads Elegíveis com >= 15 convidados */}
          <div className="rounded-2xl border border-border bg-card p-6 space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-base font-bold text-foreground">Leads Elegíveis Mapeados (≥ 15 convidados)</h3>
                <p className="text-xs text-muted-foreground">
                  Empresas cadastradas que cumprem o pré-requisito de porte de evento para futura aplicação de regras autorizadas.
                </p>
              </div>
              <span className="text-xs font-bold text-amber-400 bg-amber-500/10 px-3 py-1 rounded-full border border-amber-500/20">
                {leads15Plus} Empresas Elegíveis
              </span>
            </div>

            <div className="divide-y divide-border pt-2">
              {leads.filter(l => (l.expected_guests || 0) >= 15).map(l => (
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

      {/* Modal Interativo para gerenciar lead selecionado */}
      {selectedOpportunity && (
        <EventOpportunityModal
          opportunity={selectedOpportunity}
          isOpen={Boolean(selectedOpportunity)}
          onClose={() => setSelectedOpportunity(null)}
          session={session}
        />
      )}
    </div>
  );
}
