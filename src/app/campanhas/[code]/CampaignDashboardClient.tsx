'use client';
import { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import { 
  Building2, Users, Calendar, DollarSign, Award, Percent, 
  ArrowLeft, Search, Filter, Phone, Mail, CheckCircle2, 
  AlertTriangle, ShieldCheck, ChevronRight, Sparkles, Tag, 
  FileText, TrendingUp, Clock, HelpCircle, Lock, User, Package, 
  ShoppingBag, Plus, Edit2, Layers, Check, Trophy
} from 'lucide-react';
import { 
  EventOpportunity, 
  Coupon, 
  LeadPriority, 
  EventStage, 
  QuizQuestionAdmin, 
  QuizMetrics, 
  QuizSubmissionRecord 
} from '@/lib/types/events';
import { STAGE_LABELS, PRIORITY_LABELS } from '@/lib/utils/priorityLogic';
import { EventOpportunityModal } from '@/components/EventOpportunityModal';

interface DashboardProps {
  campaign: any;
  leads: EventOpportunity[];
  coupons: Coupon[];
  quizSubmissionsCount: { started: number; completed: number };
  quizQuestions?: QuizQuestionAdmin[];
  quizMetrics?: QuizMetrics;
  quizSubmissions?: QuizSubmissionRecord[];
  session?: any;
}

export function CampaignDashboardClient({
  campaign,
  leads,
  coupons,
  quizSubmissionsCount,
  quizQuestions = [],
  quizMetrics,
  quizSubmissions = [],
  session
}: DashboardProps) {
  const [activeTab, setActiveTab] = useState<'kpis' | 'leads' | 'coupons' | 'quiz' | 'promocao'>('kpis');
  const [categoryView, setCategoryView] = useState<'all' | 'KIT' | 'EVENTO'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterPriority, setFilterPriority] = useState<string>('all');
  const [filterStage, setFilterStage] = useState<string>('all');
  const [filterMinGuests, setFilterMinGuests] = useState<string>('all');
  const [filterOrigin, setFilterOrigin] = useState<string>('all');
  const [selectedOpportunity, setSelectedOpportunity] = useState<EventOpportunity | null>(null);
  const [leadsList, setLeadsList] = useState<EventOpportunity[]>(leads);

  // Estados de Gerenciamento do Quiz
  const [questionsList, setQuestionsList] = useState<QuizQuestionAdmin[]>(quizQuestions);
  const [selectedForPublish, setSelectedForPublish] = useState<string[]>(() => {
    return (quizQuestions.length > 0 ? quizQuestions.slice(0, 5) : []).map(q => q.id);
  });
  const [isQuestionModalOpen, setIsQuestionModalOpen] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<Partial<QuizQuestionAdmin> | null>(null);
  const [isPublishing, setIsPublishing] = useState(false);
  const [isSavingQuestion, setIsSavingQuestion] = useState(false);
  const [adminFeedback, setAdminFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Form de Pergunta
  const [formText, setFormText] = useState('');
  const [formExplanation, setFormExplanation] = useState('');
  const [formOrder, setFormOrder] = useState<number>(1);
  const [formOptions, setFormOptions] = useState<Array<{ letter: string; option_text: string; is_correct: boolean }>>([
    { letter: 'A', option_text: '', is_correct: false },
    { letter: 'B', option_text: '', is_correct: true },
    { letter: 'C', option_text: '', is_correct: false },
    { letter: 'D', option_text: '', is_correct: false }
  ]);

  // Sincroniza lista local quando prop do servidor mudar
  useEffect(() => {
    setLeadsList(leads);
  }, [leads]);

  useEffect(() => {
    if (quizQuestions && quizQuestions.length > 0) {
      setQuestionsList(quizQuestions);
      if (selectedForPublish.length === 0) {
        setSelectedForPublish(quizQuestions.slice(0, 5).map(q => q.id));
      }
    }
  }, [quizQuestions]);

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

  // Leads por Origem
  const totalQuizStandLeads = useMemo(() => {
    return leadsList.filter(l => 
      (l.origin_channel || '').includes('QUIZ') || 
      (l.origin_channel || '').includes('Estande') ||
      (l.notes || '').includes('[QUIZ STAND')
    ).length;
  }, [leadsList]);

  const totalQrCodeLeads = totalLeads - totalQuizStandLeads;

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
  const quizzesIniciados = quizMetrics?.quizzesStarted || quizSubmissionsCount.started || totalLeads;
  const quizzesConcluidos = quizMetrics?.quizzesCompleted || quizSubmissionsCount.completed || coupons.length;
  const cuponsEmitidos = quizMetrics?.couponsIssued || coupons.length;
  const cuponsUtilizados = quizMetrics?.couponsUsed || coupons.filter((c) => c.status === 'UTILIZADO').length;

  // Filtros aplicados sobre a listagem de leads
  const filteredLeads = useMemo(() => {
    return leadsList.filter((lead) => {
      // 1. Filtro da Opção de Visualização (Todos, Kits, Eventos)
      if (categoryView === 'KIT' && !isKitLead(lead)) return false;
      if (categoryView === 'EVENTO' && isKitLead(lead)) return false;

      // 2. Filtro de Origem
      const isQuizStand = (lead.origin_channel || '').includes('QUIZ') || 
                          (lead.origin_channel || '').includes('Estande') ||
                          (lead.notes || '').includes('[QUIZ STAND');
      if (filterOrigin === 'quiz' && !isQuizStand) return false;
      if (filterOrigin === 'qr' && isQuizStand) return false;

      // 3. Busca textual
      const s = searchTerm.toLowerCase();
      const matchesSearch =
        !searchTerm ||
        (lead.company_name || '').toLowerCase().includes(s) ||
        (lead.contact_name || '').toLowerCase().includes(s) ||
        (lead.contact_phone || '').includes(searchTerm);

      // 4. Prioridade
      const matchesPriority = filterPriority === 'all' || lead.priority === filterPriority;

      // 5. Etapa Comercial
      const matchesStage = filterStage === 'all' || lead.stage === filterStage;

      // 6. Faixa de Participantes
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
  }, [leadsList, categoryView, filterOrigin, searchTerm, filterPriority, filterStage, filterMinGuests]);

  // Handler para abrir modal de criação/edição de pergunta
  const handleOpenQuestionModal = (question?: QuizQuestionAdmin) => {
    if (question) {
      setEditingQuestion(question);
      setFormText(question.question_text);
      setFormExplanation(question.explanation || '');
      setFormOrder(question.order_num);
      setFormOptions(question.options.map(o => ({
        letter: o.letter,
        option_text: o.option_text,
        is_correct: o.is_correct
      })));
    } else {
      setEditingQuestion(null);
      setFormText('');
      setFormExplanation('');
      setFormOrder(questionsList.length + 1);
      setFormOptions([
        { letter: 'A', option_text: '', is_correct: false },
        { letter: 'B', option_text: '', is_correct: true },
        { letter: 'C', option_text: '', is_correct: false },
        { letter: 'D', option_text: '', is_correct: false }
      ]);
    }
    setAdminFeedback(null);
    setIsQuestionModalOpen(true);
  };

  // Salvar Pergunta no Banco
  const handleSaveQuestionSubmit = async () => {
    if (!formText.trim()) {
      setAdminFeedback({ type: 'error', message: 'O enunciado da pergunta é obrigatório.' });
      return;
    }
    const emptyOpts = formOptions.some(o => !o.option_text.trim());
    if (emptyOpts) {
      setAdminFeedback({ type: 'error', message: 'Preencha o texto das 4 alternativas (A, B, C e D).' });
      return;
    }
    const correctCount = formOptions.filter(o => o.is_correct).length;
    if (correctCount !== 1) {
      setAdminFeedback({ type: 'error', message: 'Selecione exatamente uma alternativa correta.' });
      return;
    }

    setIsSavingQuestion(true);
    setAdminFeedback(null);
    try {
      const res = await fetch('/api/bpe26/admin/quiz/perguntas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingQuestion?.id,
          question_text: formText,
          explanation: formExplanation,
          order_num: formOrder,
          options: formOptions,
          campaign_code: 'BPE26'
        })
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Erro ao salvar pergunta');
      }

      setAdminFeedback({ type: 'success', message: 'Pergunta salva com sucesso no banco!' });
      // Recarrega lista
      const listRes = await fetch('/api/bpe26/admin/quiz/perguntas?campaign=BPE26');
      const listData = await listRes.json();
      if (listData.questions) {
        setQuestionsList(listData.questions);
      }
      setTimeout(() => {
        setIsQuestionModalOpen(false);
      }, 1000);
    } catch (err: any) {
      setAdminFeedback({ type: 'error', message: err.message || 'Falha ao salvar pergunta.' });
    } finally {
      setIsSavingQuestion(false);
    }
  };

  // Publicar Versão com 5 perguntas
  const handlePublishVersionSubmit = async () => {
    if (selectedForPublish.length !== 5) {
      setAdminFeedback({ 
        type: 'error', 
        message: `Selecione exatamente 5 perguntas para publicar a versão do Quiz. Atualmente: ${selectedForPublish.length} selecionadas.` 
      });
      return;
    }

    setIsPublishing(true);
    setAdminFeedback(null);
    try {
      const res = await fetch('/api/bpe26/admin/quiz/publicar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question_ids: selectedForPublish,
          campaign_code: 'BPE26',
          notes: 'Versão publicada pelo painel administrativo para o tablet do estande BPE26.'
        })
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Erro ao publicar versão');
      }

      setAdminFeedback({ 
        type: 'success', 
        message: `Versão ${data.versionNumber} do Quiz publicada com sucesso! As 5 perguntas selecionadas estão ativas no tablet.` 
      });

      // Recarrega perguntas
      const listRes = await fetch('/api/bpe26/admin/quiz/perguntas?campaign=BPE26');
      const listData = await listRes.json();
      if (listData.questions) {
        setQuestionsList(listData.questions);
      }
    } catch (err: any) {
      setAdminFeedback({ type: 'error', message: err.message || 'Falha ao publicar versão do quiz.' });
    } finally {
      setIsPublishing(false);
    }
  };

  const toggleSelectForPublish = (qId: string) => {
    if (selectedForPublish.includes(qId)) {
      setSelectedForPublish(prev => prev.filter(id => id !== qId));
    } else {
      if (selectedForPublish.length >= 5) {
        setAdminFeedback({ 
          type: 'error', 
          message: 'Você já selecionou 5 perguntas. Desmarque uma antes de adicionar outra.' 
        });
        return;
      }
      setSelectedForPublish(prev => [...prev, qId]);
    }
  };

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
            Painel Central Unificado de Captação e Gestão de Leads BPE 2026 (Kits, Eventos e Quiz no Estande).
          </p>
        </div>

        {/* Abas Principais */}
        <div className="flex flex-wrap items-center p-1 bg-muted/40 border border-border rounded-xl gap-1">
          <button
            onClick={() => setActiveTab('kpis')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'kpis'
                ? 'bg-amber-500 text-black shadow-sm font-bold'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Visão Geral (Indicadores)
          </button>
          <button
            onClick={() => setActiveTab('leads')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
              activeTab === 'leads'
                ? 'bg-amber-500 text-black shadow-sm font-bold'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <span>Leads BPE26</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-black/10 text-current font-bold">
              {leadsList.length}
            </span>
          </button>
          <button
            onClick={() => setActiveTab('quiz')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
              activeTab === 'quiz'
                ? 'bg-amber-500 text-black shadow-sm font-bold'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Award className="w-3.5 h-3.5" />
            <span>Quiz no Estande</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-black/10 text-current font-bold">
              {questionsList.length}
            </span>
          </button>
          <button
            onClick={() => setActiveTab('coupons')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'coupons'
                ? 'bg-amber-500 text-black shadow-sm font-bold'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Cupons ({coupons.length})
          </button>
          <button
            onClick={() => setActiveTab('promocao')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'promocao'
                ? 'bg-amber-500 text-black shadow-sm font-bold'
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
            <div className="p-5 rounded-2xl border border-border bg-card shadow-sm space-y-2">
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="text-xs font-semibold uppercase tracking-wider">Leads Únicos Captados</span>
                <Users className="w-4 h-4 text-amber-500" />
              </div>
              <div className="text-3xl font-black text-foreground">{totalLeadsUnicos}</div>
              <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1 border-t border-border/50">
                <span>QR Code: <strong>{totalQrCodeLeads}</strong></span>
                <span>Quiz Estande: <strong>{totalQuizStandLeads}</strong></span>
              </div>
            </div>

            <div className="p-5 rounded-2xl border border-border bg-card shadow-sm space-y-2">
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="text-xs font-semibold uppercase tracking-wider">Interesse em Kits</span>
                <Package className="w-4 h-4 text-amber-400" />
              </div>
              <div className="text-3xl font-black text-amber-400">{totalKitLeads}</div>
              <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1 border-t border-border/50">
                <span>Vendas Concluídas: <strong className="text-emerald-400">{kitsVendidos}</strong></span>
                <span>Conversão: <strong>{taxaConversaoKits}%</strong></span>
              </div>
            </div>

            <div className="p-5 rounded-2xl border border-border bg-card shadow-sm space-y-2">
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="text-xs font-semibold uppercase tracking-wider">Interesse em Eventos</span>
                <Building2 className="w-4 h-4 text-blue-400" />
              </div>
              <div className="text-3xl font-black text-blue-400">{totalEventoLeads}</div>
              <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1 border-t border-border/50">
                <span>Contratados: <strong className="text-emerald-400">{eventosFechados}</strong></span>
                <span>Conversão: <strong>{taxaConversaoEventos}%</strong></span>
              </div>
            </div>

            <div className="p-5 rounded-2xl border border-border bg-card shadow-sm space-y-2">
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="text-xs font-semibold uppercase tracking-wider">Faturamento Fechado</span>
                <DollarSign className="w-4 h-4 text-emerald-500" />
              </div>
              <div className="text-3xl font-black text-emerald-400">{formatCurrency(faturamentoTotalContratado)}</div>
              <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1 border-t border-border/50">
                <span>Kits: <strong>{formatCurrency(faturamentoKits)}</strong></span>
                <span>Eventos: <strong>{formatCurrency(faturamentoEventos)}</strong></span>
              </div>
            </div>
          </div>

          {/* Seção 2: Indicadores do Quiz no Estande & Cupons */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-5 rounded-2xl border border-border bg-card shadow-sm space-y-2">
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="text-xs font-semibold uppercase tracking-wider">Desafio Alpha Bull</span>
                <Award className="w-4 h-4 text-amber-500" />
              </div>
              <div className="text-2xl font-bold text-foreground">
                {quizSubmissions.length} <span className="text-xs font-normal text-muted-foreground">participações</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Média de acertos: <strong className="text-foreground">{quizMetrics?.averageScore ?? 0} / 5.0</strong>
              </p>
            </div>

            <div className="p-5 rounded-2xl border border-border bg-card shadow-sm space-y-2">
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="text-xs font-semibold uppercase tracking-wider">Taxa de Conclusão Quiz</span>
                <TrendingUp className="w-4 h-4 text-emerald-500" />
              </div>
              <div className="text-2xl font-bold text-emerald-400">{quizMetrics?.completionRate ?? 100}%</div>
              <p className="text-xs text-muted-foreground">Visitantes concluíram as 5 perguntas</p>
            </div>

            <div className="p-5 rounded-2xl border border-border bg-card shadow-sm space-y-2">
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="text-xs font-semibold uppercase tracking-wider">Cupons Conquistados</span>
                <Tag className="w-4 h-4 text-amber-500" />
              </div>
              <div className="text-2xl font-bold text-amber-400">{cuponsEmitidos}</div>
              <p className="text-xs text-muted-foreground">Desconto médio: <strong>{quizMetrics?.averageDiscount ?? 0}% OFF</strong></p>
            </div>

            <div className="p-5 rounded-2xl border border-border bg-card shadow-sm space-y-2">
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="text-xs font-semibold uppercase tracking-wider">Cupons Utilizados</span>
                <ShoppingBag className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="text-2xl font-bold text-foreground">{cuponsUtilizados}</div>
              <p className="text-xs text-muted-foreground">Compras efetivadas na boutique</p>
            </div>
          </div>
        </div>
      )}

      {/* ABA 2: LEADS BPE26 COM FILTRO DE ORIGEM & KITS/EVENTOS */}
      {activeTab === 'leads' && (
        <div className="space-y-6">
          {/* Seletor de Categoria & Filtro de Origem */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 rounded-2xl border border-border bg-card">
            <div className="flex flex-wrap items-center gap-2">
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

            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Origem:</span>
              <select
                value={filterOrigin}
                onChange={(e) => setFilterOrigin(e.target.value)}
                className="px-3 py-1.5 bg-muted/40 border border-border rounded-xl text-xs text-foreground focus:outline-none focus:border-amber-500 font-medium"
              >
                <option value="all">Todas as Origens</option>
                <option value="qr">QR Code (BPE26_QRCODE)</option>
                <option value="quiz">Quiz no Estande (BPE26_QUIZ_STAND)</option>
              </select>
            </div>
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
                    <th className="px-5 py-3.5">Origem</th>
                    <th className="px-5 py-3.5">Participantes</th>
                    <th className="px-5 py-3.5">Data Cadastro</th>
                    <th className="px-5 py-3.5">Etapa Comercial</th>
                    <th className="px-5 py-3.5 text-right">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredLeads.map((lead) => {
                    const isKit = isKitLead(lead);
                    const sLabel = STAGE_LABELS[lead.stage] || lead.stage || 'Novo Lead';
                    const cleanPhone = sanitizePhone(lead.contact_phone);
                    const wppUrl = cleanPhone ? `https://wa.me/55${cleanPhone}` : '#';
                    const formattedDate = lead.created_at ? new Date(lead.created_at).toLocaleDateString('pt-BR') : 'Recente';
                    const guestsDisplay = lead.expected_guests ? `${lead.expected_guests} pessoas` : lead.guests_range || 'A definir';
                    const isQuizOrigin = (lead.origin_channel || '').includes('QUIZ') || (lead.origin_channel || '').includes('Estande') || (lead.notes || '').includes('[QUIZ STAND');

                    return (
                      <tr
                        key={lead.id}
                        className="hover:bg-muted/30 transition-colors cursor-pointer group"
                        onClick={() => setSelectedOpportunity(lead)}
                      >
                        {/* Cliente */}
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

                        {/* Origem */}
                        <td className="px-5 py-4">
                          {isQuizOrigin ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                              <Award className="w-3 h-3 text-amber-400" />
                              Quiz no Estande
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-zinc-800 text-zinc-300 border border-zinc-700">
                              QR Code
                            </span>
                          )}
                        </td>

                        {/* Participantes */}
                        <td className="px-5 py-4 font-semibold text-foreground">
                          <div className="flex items-center gap-1.5">
                            <Users className="w-3.5 h-3.5 text-zinc-400" />
                            <span>{guestsDisplay}</span>
                          </div>
                        </td>

                        {/* Data Cadastro */}
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

                        {/* Botão GERENCIAR */}
                        <td className="px-5 py-4 text-right">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedOpportunity(lead);
                            }}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-400 text-black shadow-sm transition-all"
                          >
                            <span>Gerenciar</span>
                            <ChevronRight className="w-3 h-3" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  {filteredLeads.length === 0 && (
                    <tr>
                      <td colSpan={9} className="px-5 py-12 text-center text-muted-foreground">
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

      {/* ABA 3: QUIZ NO ESTANDE (ADMINISTRAÇÃO DO DESAFIO ALPHA BULL) */}
      {activeTab === 'quiz' && (
        <div className="space-y-6">
          {/* Header da Aba com Ações */}
          <div className="p-6 rounded-2xl border border-amber-500/30 bg-gradient-to-br from-amber-500/10 via-zinc-900/60 to-zinc-950 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/40">
                  Tablet Estande BPE26
                </span>
                <span className="text-zinc-500 text-xs">•</span>
                <span className="text-xs text-zinc-400 font-mono">
                  Versão Publicada Ativa: <strong className="text-white">5 Perguntas Oficiais</strong>
                </span>
              </div>
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <Trophy className="w-5 h-5 text-amber-400" />
                Desafio Alpha Bull — Gerenciador do Quiz Presencial
              </h2>
              <p className="text-xs text-zinc-400 max-w-2xl">
                Cadastre e edite perguntas no banco, selecione as 5 perguntas ativas no tablet do estande, acompanhe os acertos dos visitantes e a emissão de cupons com regras exclusivas de carnes nobres.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => handleOpenQuestionModal()}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-zinc-800 hover:bg-zinc-700 text-white border border-zinc-700 transition-colors"
              >
                <Plus className="w-4 h-4 text-amber-400" />
                <span>Nova Pergunta</span>
              </button>

              <button
                onClick={handlePublishVersionSubmit}
                disabled={isPublishing || selectedForPublish.length !== 5}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-400 text-black shadow-lg shadow-amber-500/20 transition-all disabled:opacity-50"
              >
                <Layers className="w-4 h-4" />
                <span>{isPublishing ? 'Publicando...' : `Publicar Versão (${selectedForPublish.length}/5)`}</span>
              </button>
            </div>
          </div>

          {/* Feedback Administrativo */}
          {adminFeedback && (
            <div className={`p-4 rounded-xl text-xs font-medium flex items-center justify-between gap-2 ${
              adminFeedback.type === 'success' 
                ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400' 
                : 'bg-rose-500/10 border border-rose-500/20 text-rose-400'
            }`}>
              <div className="flex items-center gap-2">
                {adminFeedback.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
                <span>{adminFeedback.message}</span>
              </div>
              <button onClick={() => setAdminFeedback(null)} className="text-xs opacity-70 hover:opacity-100">✕</button>
            </div>
          )}

          {/* Indicadores Detalhados do Quiz */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="p-4 rounded-xl border border-border bg-card">
              <span className="text-[10px] text-muted-foreground uppercase font-semibold block">Cadastros no Tablet</span>
              <div className="text-2xl font-black text-foreground mt-1">{quizSubmissions.length}</div>
            </div>

            <div className="p-4 rounded-xl border border-border bg-card">
              <span className="text-[10px] text-muted-foreground uppercase font-semibold block">Taxa de Conclusão</span>
              <div className="text-2xl font-black text-emerald-400 mt-1">{quizMetrics?.completionRate ?? 100}%</div>
            </div>

            <div className="p-4 rounded-xl border border-border bg-card">
              <span className="text-[10px] text-muted-foreground uppercase font-semibold block">Média de Acertos</span>
              <div className="text-2xl font-black text-amber-400 mt-1">{quizMetrics?.averageScore ?? 0} <span className="text-xs font-normal text-muted-foreground">/ 5</span></div>
            </div>

            <div className="p-4 rounded-xl border border-border bg-card">
              <span className="text-[10px] text-muted-foreground uppercase font-semibold block">Cupons Emitidos</span>
              <div className="text-2xl font-black text-foreground mt-1">{cuponsEmitidos}</div>
            </div>

            <div className="p-4 rounded-xl border border-border bg-card">
              <span className="text-[10px] text-muted-foreground uppercase font-semibold block">Cupons Utilizados</span>
              <div className="text-2xl font-black text-emerald-400 mt-1">{cuponsUtilizados}</div>
            </div>

            <div className="p-4 rounded-xl border border-border bg-card">
              <span className="text-[10px] text-muted-foreground uppercase font-semibold block">Desconto Médio</span>
              <div className="text-2xl font-black text-amber-300 mt-1">{quizMetrics?.averageDiscount ?? 0}%</div>
            </div>
          </div>

          {/* Distribuição de Acertos e Descontos Conquistados */}
          <div className="p-5 rounded-2xl border border-border bg-card space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xs font-bold text-foreground uppercase tracking-wider">
                  Distribuição de Desempenho dos Participantes & Níveis de Desconto
                </h3>
                <p className="text-[11px] text-muted-foreground">
                  Regra estrita: 0-1 acertos: 0% | 2 acertos: 5% | 3 acertos: 8% | 4 acertos: 15% | 5 acertos: 20% OFF
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-1">
              <div className="p-3 rounded-xl bg-muted/40 border border-border">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-zinc-400">0 ou 1 Acerto</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 font-semibold">0% OFF</span>
                </div>
                <div className="text-xl font-black text-foreground mt-2">
                  {(quizMetrics?.scoreDistribution?.score0 ?? 0) + (quizMetrics?.scoreDistribution?.score1 ?? 0)}
                </div>
                <span className="text-[10px] text-muted-foreground">Sem cupom</span>
              </div>

              <div className="p-3 rounded-xl bg-muted/40 border border-border">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-zinc-300">2 Acertos</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-semibold">5% OFF</span>
                </div>
                <div className="text-xl font-black text-foreground mt-2">
                  {quizMetrics?.scoreDistribution?.score2 ?? 0}
                </div>
                <span className="text-[10px] text-muted-foreground">Cupom emitido</span>
              </div>

              <div className="p-3 rounded-xl bg-muted/40 border border-border">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-zinc-300">3 Acertos</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-semibold">8% OFF</span>
                </div>
                <div className="text-xl font-black text-foreground mt-2">
                  {quizMetrics?.scoreDistribution?.score3 ?? 0}
                </div>
                <span className="text-[10px] text-muted-foreground">Cupom emitido</span>
              </div>

              <div className="p-3 rounded-xl bg-muted/40 border border-border">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-zinc-200">4 Acertos</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-semibold">15% OFF</span>
                </div>
                <div className="text-xl font-black text-amber-400 mt-2">
                  {quizMetrics?.scoreDistribution?.score4 ?? 0}
                </div>
                <span className="text-[10px] text-muted-foreground">Cupom emitido</span>
              </div>

              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-amber-300 flex items-center gap-1">
                    <Trophy className="w-3 h-3 text-amber-400" />
                    5 Acertos
                  </span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500 text-black font-bold">20% OFF</span>
                </div>
                <div className="text-xl font-black text-amber-300 mt-2">
                  {quizMetrics?.scoreDistribution?.score5 ?? 0}
                </div>
                <span className="text-[10px] text-amber-400/80">Gabarito Máximo</span>
              </div>
            </div>
          </div>

          {/* Banco de Perguntas & Seletor de 5 Perguntas para Publicação */}
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                  <span>Banco de Perguntas Cadastradas</span>
                  <span className="text-xs font-normal text-muted-foreground">({questionsList.length} perguntas)</span>
                </h3>
                <p className="text-xs text-muted-foreground">
                  Marque o checkbox de exatamente 5 perguntas para compor a versão oficial do tablet e clique em &quot;Publicar Versão&quot;.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                  selectedForPublish.length === 5 
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' 
                    : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                }`}>
                  {selectedForPublish.length} de 5 selecionadas
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3">
              {questionsList.map((q, idx) => {
                const isSelected = selectedForPublish.includes(q.id);
                const isCurrentlyActiveInTablet = idx < 5;

                return (
                  <div
                    key={q.id}
                    className={`p-4 rounded-2xl border transition-all ${
                      isSelected 
                        ? 'border-amber-500/50 bg-amber-500/5 shadow-sm' 
                        : 'border-border bg-card'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3 flex-1">
                        <button
                          type="button"
                          onClick={() => toggleSelectForPublish(q.id)}
                          className={`mt-0.5 w-5 h-5 rounded flex items-center justify-center transition-colors ${
                            isSelected
                              ? 'bg-amber-500 text-black font-bold'
                              : 'border border-zinc-700 hover:border-zinc-500 bg-zinc-900'
                          }`}
                          title={isSelected ? 'Desmarcar da versão do tablet' : 'Selecionar para versão do tablet'}
                        >
                          {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                        </button>

                        <div className="space-y-2 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-xs font-mono font-bold text-amber-400">
                              Questão {idx + 1}
                            </span>
                            {isCurrentlyActiveInTablet && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                                Ativa no Tablet (Versão 1)
                              </span>
                            )}
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-zinc-800 text-zinc-400">
                              4 Alternativas
                            </span>
                          </div>

                          <h4 className="text-sm font-semibold text-foreground leading-snug">
                            {q.question_text}
                          </h4>

                          {/* Alternativas A, B, C, D */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                            {q.options.map((opt) => (
                              <div
                                key={opt.letter}
                                className={`p-2.5 rounded-xl border text-xs flex items-start gap-2 ${
                                  opt.is_correct
                                    ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-300 font-medium'
                                    : 'bg-muted/30 border-border text-muted-foreground'
                                }`}
                              >
                                <span className={`w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-bold shrink-0 ${
                                  opt.is_correct ? 'bg-emerald-500 text-black' : 'bg-zinc-800 text-zinc-400'
                                }`}>
                                  {opt.letter}
                                </span>
                                <span className="flex-1">{opt.option_text}</span>
                                {opt.is_correct && (
                                  <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider shrink-0">
                                    Correta
                                  </span>
                                )}
                              </div>
                            ))}
                          </div>

                          {q.explanation && (
                            <p className="text-[11px] text-muted-foreground bg-muted/20 p-2 rounded-lg border border-border/50">
                              <strong className="text-foreground">Justificativa Gastronômica:</strong> {q.explanation}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => handleOpenQuestionModal(q)}
                          className="p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
                          title="Editar Pergunta"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Histórico Recente de Participações no Tablet */}
          <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-sm space-y-0">
            <div className="p-4 border-b border-border flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-foreground">Participações Recentes no Estande</h3>
                <p className="text-xs text-muted-foreground">Resultados registrados em tempo real no tablet compartilhado.</p>
              </div>
              <span className="text-xs text-muted-foreground">
                Total: <strong className="text-foreground">{quizSubmissions.length}</strong> participações
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-muted/40 border-b border-border uppercase tracking-wider text-muted-foreground font-semibold">
                  <tr>
                    <th className="px-5 py-3">Participante</th>
                    <th className="px-5 py-3">Empresa</th>
                    <th className="px-5 py-3">WhatsApp</th>
                    <th className="px-5 py-3">Pontuação</th>
                    <th className="px-5 py-3">Desconto</th>
                    <th className="px-5 py-3">Cupom</th>
                    <th className="px-5 py-3">Data / Hora</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {quizSubmissions.map((sub) => {
                    const cleanPhone = sanitizePhone(sub.participant_phone);
                    const wppUrl = cleanPhone ? `https://wa.me/55${cleanPhone}` : '#';
                    return (
                      <tr key={sub.id} className="hover:bg-muted/30 transition-colors">
                        <td className="px-5 py-3 font-semibold text-foreground">
                          {sub.participant_name}
                        </td>
                        <td className="px-5 py-3 text-muted-foreground">
                          {sub.company_name || 'Não informada'}
                        </td>
                        <td className="px-5 py-3 font-mono text-[11px]">
                          {cleanPhone ? (
                            <a href={wppUrl} target="_blank" rel="noopener noreferrer" className="text-emerald-400 hover:underline">
                              {sub.participant_phone}
                            </a>
                          ) : '—'}
                        </td>
                        <td className="px-5 py-3 font-bold text-foreground">
                          <span className={sub.score >= 4 ? 'text-amber-400' : sub.score >= 2 ? 'text-white' : 'text-zinc-500'}>
                            {sub.score} / 5 acertos
                          </span>
                        </td>
                        <td className="px-5 py-3 font-bold text-emerald-400">
                          {sub.discount_percent}% OFF
                        </td>
                        <td className="px-5 py-3">
                          {sub.coupon_code ? (
                            <span className="font-mono text-[11px] font-bold text-amber-300 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                              {sub.coupon_code}
                            </span>
                          ) : (
                            <span className="text-zinc-500 text-[11px]">Sem cupom</span>
                          )}
                        </td>
                        <td className="px-5 py-3 text-muted-foreground">
                          {new Date(sub.completed_at).toLocaleString('pt-BR', { 
                            day: '2-digit', 
                            month: '2-digit', 
                            hour: '2-digit', 
                            minute: '2-digit' 
                          })}
                        </td>
                      </tr>
                    );
                  })}
                  {quizSubmissions.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-5 py-8 text-center text-muted-foreground">
                        Nenhuma submissão de quiz registrada até o momento.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ABA 4: CUPONS */}
      {activeTab === 'coupons' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-5 rounded-2xl border border-border bg-card">
              <span className="text-xs text-muted-foreground uppercase font-semibold block">Total Emitidos</span>
              <div className="text-3xl font-black text-foreground mt-1">{coupons.length}</div>
            </div>
            <div className="p-5 rounded-2xl border border-border bg-card">
              <span className="text-xs text-muted-foreground uppercase font-semibold block">Cupons Ativos</span>
              <div className="text-3xl font-black text-amber-400 mt-1">
                {coupons.filter(c => c.status === 'ATIVO').length}
              </div>
            </div>
            <div className="p-5 rounded-2xl border border-border bg-card">
              <span className="text-xs text-muted-foreground uppercase font-semibold block">Cupons Utilizados</span>
              <div className="text-3xl font-black text-emerald-400 mt-1">
                {coupons.filter(c => c.status === 'UTILIZADO').length}
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-muted/40 border-b border-border uppercase tracking-wider text-muted-foreground font-semibold">
                  <tr>
                    <th className="px-5 py-3.5">Código</th>
                    <th className="px-5 py-3.5">Desconto</th>
                    <th className="px-5 py-3.5">Status</th>
                    <th className="px-5 py-3.5">Emissão</th>
                    <th className="px-5 py-3.5">Validade</th>
                    <th className="px-5 py-3.5">Regras & Restrições</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {coupons.map((c) => (
                    <tr key={c.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-5 py-4 font-mono font-bold text-amber-400">{c.code}</td>
                      <td className="px-5 py-4 font-bold text-emerald-400">{c.discount_percent}% OFF</td>
                      <td className="px-5 py-4">
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          c.status === 'UTILIZADO'
                            ? 'bg-zinc-800 text-zinc-400 border border-zinc-700'
                            : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        }`}>
                          {c.status}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-muted-foreground">{new Date(c.issued_at).toLocaleDateString('pt-BR')}</td>
                      <td className="px-5 py-4 text-muted-foreground">{new Date(c.expires_at).toLocaleDateString('pt-BR')}</td>
                      <td className="px-5 py-4 text-muted-foreground max-w-xs truncate">{c.restrictions}</td>
                    </tr>
                  ))}
                  {coupons.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-5 py-12 text-center text-muted-foreground">
                        Nenhum cupom emitido até o momento.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ABA 5: PROMOÇÃO 5 ISENÇÕES */}
      {activeTab === 'promocao' && (
        <div className="space-y-6">
          <div className="p-6 rounded-2xl border border-amber-500/30 bg-card space-y-4">
            <div className="flex items-center justify-between">
              <span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-amber-500/10 text-amber-400 border border-amber-500/20">
                Aguardando Autorização Legal
              </span>
              <Lock className="w-5 h-5 text-muted-foreground" />
            </div>
            <h3 className="text-xl font-bold text-foreground">
              Promoção Especial BPE26 — Cinco Isenções Alpha Bull
            </h3>
            <p className="text-sm text-muted-foreground max-w-2xl">
              Módulo comercial regulamentado para premiação com isenção de 5 participantes na contratação de confraternização corporativa (mínimo de 15 convidados).
            </p>
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

      {/* Modal de Cadastro / Edição de Perguntas do Quiz */}
      {isQuestionModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-xl bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-5 border-b border-zinc-800 bg-zinc-900/60 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Award className="w-4 h-4 text-amber-400" />
                  {editingQuestion ? 'Editar Pergunta do Quiz' : 'Nova Pergunta do Quiz'}
                </h3>
                <p className="text-xs text-zinc-400">Banco de Perguntas — Desafio Alpha Bull BPE26</p>
              </div>
              <button onClick={() => setIsQuestionModalOpen(false)} className="text-zinc-400 hover:text-white p-1">✕</button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4 flex-1 custom-scrollbar text-xs">
              <div>
                <label className="text-xs font-semibold text-zinc-300 block mb-1">Enunciado da Pergunta *</label>
                <textarea
                  rows={3}
                  value={formText}
                  onChange={(e) => setFormText(e.target.value)}
                  placeholder="Ex: Qual é a principal característica que define a carne Wagyu...?"
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500 resize-none"
                />
              </div>

              {/* 4 Alternativas A, B, C, D */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-zinc-300 block">
                  Alternativas (selecione o radio da resposta correta) *
                </label>
                {formOptions.map((opt, idx) => (
                  <div key={opt.letter} className="flex items-center gap-2 bg-zinc-900/80 p-2.5 rounded-xl border border-zinc-800">
                    <input
                      type="radio"
                      name="correct_option"
                      checked={opt.is_correct}
                      onChange={() => {
                        setFormOptions(prev => prev.map((o, i) => ({
                          ...o,
                          is_correct: i === idx
                        })));
                      }}
                      className="accent-amber-500 w-4 h-4 cursor-pointer"
                    />
                    <span className="w-5 text-center font-bold text-amber-400">{opt.letter}</span>
                    <input
                      type="text"
                      value={opt.option_text}
                      onChange={(e) => {
                        const val = e.target.value;
                        setFormOptions(prev => prev.map((o, i) => i === idx ? { ...o, option_text: val } : o));
                      }}
                      placeholder={`Texto da alternativa ${opt.letter}...`}
                      className="flex-1 bg-zinc-950 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500"
                    />
                  </div>
                ))}
              </div>

              <div>
                <label className="text-xs font-semibold text-zinc-300 block mb-1">Justificativa Gastronômica / Explicação</label>
                <textarea
                  rows={2}
                  value={formExplanation}
                  onChange={(e) => setFormExplanation(e.target.value)}
                  placeholder="Explicação pedagógica da resposta correta..."
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-2.5 text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500 resize-none"
                />
              </div>
            </div>

            <div className="p-4 border-t border-zinc-800 bg-zinc-900/60 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsQuestionModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-medium text-zinc-400 hover:text-white bg-zinc-800 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSaveQuestionSubmit}
                disabled={isSavingQuestion}
                className="px-5 py-2 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-400 text-black transition-colors disabled:opacity-50"
              >
                {isSavingQuestion ? 'Salvando...' : 'Salvar Pergunta'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
