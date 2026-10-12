'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  X, Building2, User, Phone, Mail, Calendar, Users, DollarSign, 
  Tag, Clock, CheckCircle2, AlertCircle, ArrowRight, Save, Send,
  FileText, ShieldCheck, MapPin, ChevronRight, Award, Percent, HelpCircle
} from 'lucide-react';
import { EventOpportunity, EventStage, EventStageHistory, LeadPriority } from '@/lib/types/events';
import { STAGE_LABELS, PRIORITY_LABELS } from '@/lib/utils/priorityLogic';

interface EventOpportunityModalProps {
  opportunity: Partial<EventOpportunity> & { id: string; client_id?: string };
  isOpen: boolean;
  onClose: () => void;
  session?: any;
  onSaveSuccess?: (updatedOpp: EventOpportunity) => void;
}

const STAGES: { key: EventStage; label: string }[] = [
  { key: 'novo_lead', label: 'Novo Lead' },
  { key: 'contato_realizado', label: 'Contato Realizado' },
  { key: 'qualificacao', label: 'Evento em Qualificação' },
  { key: 'orcamento_solicitado', label: 'Orçamento Solicitado' },
  { key: 'proposta_enviada', label: 'Proposta Enviada' },
  { key: 'negociacao', label: 'Em Negociação' },
  { key: 'fechado', label: 'Evento Fechado' },
  { key: 'perdido', label: 'Oportunidade Perdida' }
];

export function EventOpportunityModal({ opportunity, isOpen, onClose, session, onSaveSuccess }: EventOpportunityModalProps) {
  const router = useRouter();
  const [currentStage, setCurrentStage] = useState<EventStage>((opportunity.stage as EventStage) || 'novo_lead');
  const [notes, setNotes] = useState(opportunity.notes || '');
  const [lossReason, setLossReason] = useState(opportunity.loss_reason || '');
  const [contractedValue, setContractedValue] = useState(opportunity.contracted_value || 0);
  const [estimatedValue, setEstimatedValue] = useState(opportunity.estimated_value || 0);
  const [nextContactDate, setNextContactDate] = useState(opportunity.next_contact_date || '');
  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [quizInfo, setQuizInfo] = useState<{
    has_participated: boolean;
    submission?: any;
    coupon?: any;
  } | null>(null);
  const [isLoadingQuiz, setIsLoadingQuiz] = useState(false);

  useEffect(() => {
    if (!isOpen || !opportunity.contact_phone) return;
    const cleanPhone = (opportunity.contact_phone || '').replace(/\D/g, '');
    if (!cleanPhone) return;

    setIsLoadingQuiz(true);
    fetch(`/api/bpe26/admin/quiz/resultado-lead?phone=${cleanPhone}`)
      .then(res => res.json())
      .then(data => {
        if (data && data.has_participated) {
          setQuizInfo(data);
        } else {
          setQuizInfo(null);
        }
      })
      .catch(err => console.warn('Erro ao carregar dados do quiz:', err))
      .finally(() => setIsLoadingQuiz(false));
  }, [isOpen, opportunity.contact_phone]);

  if (!isOpen) return null;

  const handleSave = async () => {
    setIsSaving(true);
    setFeedback(null);
    try {
      const res = await fetch(`/api/eventos/${opportunity.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stage: currentStage,
          notes,
          loss_reason: currentStage === 'perdido' ? lossReason : null,
          contracted_value: currentStage === 'fechado' ? Number(contractedValue) : undefined,
          estimated_value: Number(estimatedValue),
          next_contact_date: nextContactDate || null,
          user_id: session?.id || null
        })
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Falha ao atualizar');
      }

      const json = await res.json().catch(() => null);
      if (onSaveSuccess && json?.data) {
        onSaveSuccess(json.data);
      }

      setFeedback({ type: 'success', message: 'Oportunidade atualizada com sucesso!' });
      router.refresh();
      setTimeout(() => {
        onClose();
      }, 800);
    } catch (e: any) {
      setFeedback({ type: 'error', message: e.message || 'Erro ao salvar alterações.' });
    } finally {
      setIsSaving(false);
    }
  };

  const priority = (opportunity.priority as LeadPriority) || 'EM_NUTRICAO';
  const priorityInfo = PRIORITY_LABELS[priority] || PRIORITY_LABELS.EM_NUTRICAO;

  const formatCurrency = (val: number = 0) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

  const isKit = opportunity.category === 'KIT' || opportunity.event_type === 'kit_churrasco';

  const cleanPhone = (opportunity.contact_phone || '').replace(/\D/g, '');
  const wppText = isKit
    ? `Olá ${opportunity.contact_name || ''}, tudo bem? Sou da equipe comercial da Alpha Bull Boutique de Carnes Nobres. Vimos seu interesse em nossos Kits de Churrasco com cortes nobres através do BPE26! Podemos conversar sobre o kit ideal e entrega para você?`
    : `Olá ${opportunity.contact_name || ''}, tudo bem? Sou da equipe comercial da Alpha Bull Boutique de Carnes Nobres. Vimos o interesse da ${opportunity.company_name || 'sua empresa'} em realizar uma confraternização corporativa conosco através do BPE26! Gostaria de conversar sobre o cardápio e a melhor data para o seu evento?`;
  const wppLink = `https://wa.me/55${cleanPhone}?text=${encodeURIComponent(wppText)}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header Modal */}
        <div className="p-6 border-b border-zinc-800/80 bg-zinc-900/60 flex items-start justify-between">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                isKit ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40' : 'bg-blue-500/20 text-blue-300 border border-blue-500/40'
              }`}>
                {isKit ? 'Kit Churrasco' : 'Evento Corporativo'}
              </span>
              <span className="text-zinc-500 text-xs">•</span>
              <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold border ${priorityInfo.bg} ${priorityInfo.color}`}>
                {priorityInfo.label}
              </span>
              <span className="text-zinc-500 text-xs">•</span>
              <span className="text-xs text-amber-400 font-medium flex items-center gap-1">
                <Tag className="w-3 h-3" />
                {opportunity.campaign_code || 'BPE26'}
              </span>
            </div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              {isKit ? <User className="w-5 h-5 text-amber-400" /> : <Building2 className="w-5 h-5 text-amber-400" />}
              {isKit ? (opportunity.contact_name || opportunity.company_name) : (opportunity.company_name || opportunity.contact_name || 'Empresa não informada')}
            </h2>
            <p className="text-sm text-zinc-400 flex items-center gap-1.5">
              {isKit ? <Building2 className="w-3.5 h-3.5 text-zinc-400" /> : <User className="w-3.5 h-3.5 text-zinc-400" />}
              {isKit ? (opportunity.company_name || 'Empresa não informada') : (`${opportunity.contact_name || ''} ${opportunity.contact_role ? `(${opportunity.contact_role})` : ''}`)}
            </p>
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800/60 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Conteúdo com Scroll */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 custom-scrollbar">
          
          {feedback && (
            <div className={`p-3.5 rounded-xl text-xs font-medium flex items-center gap-2 ${
              feedback.type === 'success' ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400' : 'bg-rose-500/10 border border-rose-500/20 text-rose-400'
            }`}>
              {feedback.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
              {feedback.message}
            </div>
          )}

          {/* Stepper de Etapas Comerciais */}
          <div>
            <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider block mb-2.5">
              Etapa Comercial
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {STAGES.map((s) => {
                const isActive = currentStage === s.key;
                return (
                  <button
                    key={s.key}
                    type="button"
                    onClick={() => setCurrentStage(s.key)}
                    className={`px-3 py-2 text-xs font-medium rounded-xl border text-left transition-all flex flex-col justify-between ${
                      isActive 
                        ? 'bg-amber-500/15 border-amber-500 text-amber-300 shadow-sm shadow-amber-500/10' 
                        : 'bg-zinc-900/50 border-zinc-800 text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200'
                    }`}
                  >
                    <span>{s.label}</span>
                    {isActive && <span className="w-1.5 h-1.5 rounded-full bg-amber-400 mt-1 self-end"></span>}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Grid de Informações Chave */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 rounded-xl bg-zinc-900/40 border border-zinc-800/80">
            <div>
              <span className="text-[11px] text-zinc-400 block font-medium">
                {isKit ? 'Pessoas no Churrasco' : 'Convidados / Faixa'}
              </span>
              <p className="text-sm font-semibold text-white flex items-center gap-1.5 mt-0.5">
                <Users className="w-4 h-4 text-amber-400" />
                {opportunity.guests_range || (opportunity.expected_guests ? `${opportunity.expected_guests} pessoas` : 'A definir')}
              </p>
            </div>
            <div>
              <span className="text-[11px] text-zinc-400 block font-medium">
                {isKit ? 'Data Pretendida' : 'Data Prevista'}
              </span>
              <p className="text-sm font-semibold text-white flex items-center gap-1.5 mt-0.5">
                <Calendar className="w-4 h-4 text-amber-400" />
                {opportunity.event_date ? new Date(opportunity.event_date).toLocaleDateString('pt-BR') : 'A definir'}
              </p>
            </div>
            <div>
              <span className="text-[11px] text-zinc-400 block font-medium">Origem do Lead</span>
              <p className="text-sm font-semibold text-white flex items-center gap-1.5 mt-0.5">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                {opportunity.origin_channel || 'QR Code'} • {opportunity.origin_site || 'ChurrascoSalvador.com'}
              </p>
            </div>
          </div>

          {/* Contato & Detalhes da Campanha */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-3.5 rounded-xl bg-zinc-900/30 border border-zinc-800/60 space-y-2">
              <span className="text-[11px] text-zinc-400 block font-semibold uppercase tracking-wider">Contatos e Identificação</span>
              <p className="text-xs text-zinc-300 flex items-center gap-2">
                <Phone className="w-3.5 h-3.5 text-zinc-400" />
                {opportunity.contact_phone}
              </p>
              {opportunity.contact_email && (
                <p className="text-xs text-zinc-300 flex items-center gap-2">
                  <Mail className="w-3.5 h-3.5 text-zinc-400" />
                  {opportunity.contact_email}
                </p>
              )}
              {opportunity.instagram && (
                <p className="text-xs text-amber-300 flex items-center gap-2">
                  <span className="text-zinc-400 font-bold">IG:</span>
                  {opportunity.instagram}
                </p>
              )}
              {opportunity.birth_date && session?.role === 'ADMIN' && (
                <p className="text-xs text-zinc-400 flex items-center gap-2">
                  <Clock className="w-3.5 h-3.5 text-zinc-500" />
                  Nascimento: {opportunity.birth_date} (Acesso Restrito)
                </p>
              )}
              {opportunity.already_knew_brand && (
                <p className="text-xs text-zinc-400">
                  <span className="text-zinc-500 font-medium">Conhecia Alpha Bull:</span> {opportunity.already_knew_brand === 'sim' ? 'Sim' : opportunity.already_knew_brand === 'ja_ouvi' ? 'Já ouviu falar' : 'Não conhecia'}
                </p>
              )}
              {opportunity.city && (
                <p className="text-xs text-zinc-300 flex items-center gap-2">
                  <MapPin className="w-3.5 h-3.5 text-zinc-400" />
                  {opportunity.city}
                </p>
              )}
            </div>

            <div className="p-3.5 rounded-xl bg-zinc-900/30 border border-zinc-800/60 space-y-2">
              <span className="text-[11px] text-zinc-400 block font-semibold uppercase tracking-wider">
                {isKit ? 'Valores do Kit de Churrasco' : 'Valores da Oportunidade'}
              </span>
              <div>
                <label className="text-[10px] text-zinc-400 block">
                  {isKit ? 'Orçamento Estimado (R$)' : 'Valor Estimado (R$)'}
                </label>
                <input
                  type="number"
                  value={estimatedValue}
                  onChange={(e) => setEstimatedValue(Number(e.target.value))}
                  className="w-full mt-1 bg-zinc-950 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500"
                />
              </div>
              {currentStage === 'fechado' && (
                <div>
                  <label className="text-[10px] text-emerald-400 font-medium block">
                    {isKit ? 'Valor de Venda do Kit (R$)' : 'Valor Contratado Final (R$)'}
                  </label>
                  <input
                    type="number"
                    value={contractedValue}
                    onChange={(e) => setContractedValue(Number(e.target.value))}
                    className="w-full mt-1 bg-zinc-950 border border-emerald-500/50 rounded-lg px-2.5 py-1.5 text-xs text-emerald-300 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              )}
            </div>
          </div>

          {/* Próximo Contato & Perda */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-zinc-400 block mb-1">
                Data do Próximo Contato (Follow-up)
              </label>
              <input
                type="date"
                value={nextContactDate}
                onChange={(e) => setNextContactDate(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
              />
            </div>

            {currentStage === 'perdido' && (
              <div>
                <label className="text-xs font-semibold text-rose-400 block mb-1">
                  Motivo da Perda
                </label>
                <input
                  type="text"
                  placeholder="Ex: Orçamento fora do limite, optou por outro local..."
                  value={lossReason}
                  onChange={(e) => setLossReason(e.target.value)}
                  className="w-full bg-zinc-900 border border-rose-500/40 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-rose-500"
                />
              </div>
            )}
          </div>

          {/* Seção: RESULTADO DO QUIZ (Desafio Alpha Bull - Tablet BPE26) */}
          {quizInfo?.has_participated && (
            <div className="p-4 rounded-2xl bg-gradient-to-br from-amber-500/10 via-zinc-900/60 to-zinc-950 border border-amber-500/30 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-amber-500/20 text-amber-400">
                    <Award className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-amber-300 uppercase tracking-wider flex items-center gap-1.5">
                      Resultado do Quiz — Desafio Alpha Bull
                    </h3>
                    <p className="text-[11px] text-zinc-400">
                      Origem: <span className="text-white font-medium">Quiz Presencial — Estande BPE26</span> • Versão {quizInfo.submission?.quiz_version || 1}
                    </p>
                  </div>
                </div>
                {quizInfo.submission?.completed_at && (
                  <span className="text-[10px] text-zinc-400 bg-zinc-800/80 px-2 py-0.5 rounded-full flex items-center gap-1">
                    <Clock className="w-3 h-3 text-amber-400" />
                    {new Date(quizInfo.submission.completed_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                  </span>
                )}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                <div className="p-2.5 rounded-xl bg-zinc-900/80 border border-zinc-800/80">
                  <span className="text-[10px] text-zinc-400 block font-medium">Pontuação</span>
                  <div className="text-base font-bold text-white flex items-baseline gap-1 mt-0.5">
                    <span className="text-amber-400">{quizInfo.submission?.score ?? '—'}</span>
                    <span className="text-xs text-zinc-500">/ 5 acertos</span>
                  </div>
                </div>

                <div className="p-2.5 rounded-xl bg-zinc-900/80 border border-zinc-800/80">
                  <span className="text-[10px] text-zinc-400 block font-medium">Desconto Conquistado</span>
                  <div className="text-base font-bold text-emerald-400 flex items-center gap-1 mt-0.5">
                    <Percent className="w-3.5 h-3.5" />
                    <span>{quizInfo.submission?.discount_percent ?? quizInfo.coupon?.discount_percent ?? 0}% OFF</span>
                  </div>
                </div>

                <div className="p-2.5 rounded-xl bg-zinc-900/80 border border-zinc-800/80 col-span-2">
                  <span className="text-[10px] text-zinc-400 block font-medium">Cupom Individual Alpha Bull</span>
                  <div className="flex items-center justify-between gap-2 mt-0.5">
                    <span className="font-mono text-sm font-bold text-amber-300">
                      {quizInfo.coupon?.code || quizInfo.submission?.coupon_code || 'Sem cupom (score < 2)'}
                    </span>
                    {(quizInfo.coupon || quizInfo.submission?.coupon_code) && (
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        (quizInfo.coupon?.status === 'UTILIZADO')
                          ? 'bg-zinc-800 text-zinc-400 border border-zinc-700'
                          : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      }`}>
                        {quizInfo.coupon?.status || 'ATIVO'}
                      </span>
                    )}
                  </div>
                  {quizInfo.coupon?.expires_at && (
                    <span className="text-[9px] text-zinc-500 block mt-1">
                      Validade: {new Date(quizInfo.coupon.expires_at).toLocaleDateString('pt-BR')}
                    </span>
                  )}
                </div>
              </div>

              {/* Respostas detalhadas em visualização administrativa autorizada */}
              {quizInfo.submission?.answers && Object.keys(quizInfo.submission.answers).length > 0 && (
                <div className="pt-2 border-t border-zinc-800/60">
                  <span className="text-[10px] text-zinc-400 font-semibold uppercase tracking-wider block mb-1.5">
                    Respostas do Participante (Visualização Administrativa):
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {Object.entries(quizInfo.submission.answers).map(([qid, ans]: [string, any], idx: number) => (
                      <span key={qid} className="text-[10px] px-2 py-1 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-300 font-mono">
                        Q{idx + 1}: <strong className="text-amber-400">{ans}</strong>
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Observações Comerciais */}
          <div>
            <label className="text-xs font-semibold text-zinc-400 block mb-1.5">
              Observações Comerciais & Histórico de Negociação
            </label>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Descreva detalhes como preferências de cortes, exigência de open bar, estrutura do local..."
              className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500 resize-none"
            />
          </div>
        </div>

        {/* Footer com Ações */}
        <div className="p-4 border-t border-zinc-800/80 bg-zinc-900/60 flex items-center justify-between gap-3">
          <a
            href={wppLink}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 transition-colors"
          >
            <Phone className="w-3.5 h-3.5" />
            <span>Falar no WhatsApp</span>
          </a>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="px-4 py-2 rounded-xl text-xs font-medium text-zinc-400 hover:text-white bg-zinc-800/50 hover:bg-zinc-800 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="flex items-center gap-1.5 px-5 py-2 rounded-xl text-xs font-semibold bg-amber-500 hover:bg-amber-400 text-black transition-colors shadow-lg shadow-amber-500/20 disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{isSaving ? 'Salvando...' : 'Salvar Alterações'}</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
