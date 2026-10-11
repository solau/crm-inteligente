'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { 
  X, Building2, User, Phone, Mail, Calendar, Users, DollarSign, 
  Tag, Clock, CheckCircle2, AlertCircle, ArrowRight, Save, Send,
  FileText, ShieldCheck, MapPin, ChevronRight
} from 'lucide-react';
import { EventOpportunity, EventStage, EventStageHistory, LeadPriority } from '@/lib/types/events';
import { STAGE_LABELS, PRIORITY_LABELS } from '@/lib/utils/priorityLogic';

interface EventOpportunityModalProps {
  opportunity: Partial<EventOpportunity> & { id: string; client_id?: string };
  isOpen: boolean;
  onClose: () => void;
  session?: any;
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

export function EventOpportunityModal({ opportunity, isOpen, onClose, session }: EventOpportunityModalProps) {
  const router = useRouter();
  const [currentStage, setCurrentStage] = useState<EventStage>((opportunity.stage as EventStage) || 'novo_lead');
  const [notes, setNotes] = useState(opportunity.notes || '');
  const [lossReason, setLossReason] = useState(opportunity.loss_reason || '');
  const [contractedValue, setContractedValue] = useState(opportunity.contracted_value || 0);
  const [estimatedValue, setEstimatedValue] = useState(opportunity.estimated_value || 0);
  const [nextContactDate, setNextContactDate] = useState(opportunity.next_contact_date || '');
  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

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

  const cleanPhone = (opportunity.contact_phone || '').replace(/\D/g, '');
  const wppText = `Olá ${opportunity.contact_name || ''}, tudo bem? Sou da equipe comercial da Alpha Bull Boutique de Carnes Nobres. Vimos o interesse da ${opportunity.company_name || 'sua empresa'} em realizar uma confraternização corporativa conosco através do BPE26! Gostaria de conversar sobre o cardápio e a melhor data para o seu evento?`;
  const wppLink = `https://wa.me/55${cleanPhone}?text=${encodeURIComponent(wppText)}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header Modal */}
        <div className="p-6 border-b border-zinc-800/80 bg-zinc-900/60 flex items-start justify-between">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${priorityInfo.bg} ${priorityInfo.color}`}>
                {priorityInfo.label}
              </span>
              <span className="text-zinc-500 text-xs">•</span>
              <span className="text-xs text-amber-400 font-medium flex items-center gap-1">
                <Tag className="w-3 h-3" />
                {opportunity.campaign_code || 'BPE26'}
              </span>
            </div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <Building2 className="w-5 h-5 text-amber-400" />
              {opportunity.company_name || 'Empresa não informada'}
            </h2>
            <p className="text-sm text-zinc-400 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-zinc-400" />
              {opportunity.contact_name} {opportunity.contact_role ? `(${opportunity.contact_role})` : ''}
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
              <span className="text-[11px] text-zinc-400 block font-medium">Convidados / Faixa</span>
              <p className="text-sm font-semibold text-white flex items-center gap-1.5 mt-0.5">
                <Users className="w-4 h-4 text-amber-400" />
                {opportunity.guests_range || (opportunity.expected_guests ? `${opportunity.expected_guests} pessoas` : 'A definir')}
              </p>
            </div>
            <div>
              <span className="text-[11px] text-zinc-400 block font-medium">Data Prevista</span>
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
              <span className="text-[11px] text-zinc-400 block font-semibold uppercase tracking-wider">Valores da Oportunidade</span>
              <div>
                <label className="text-[10px] text-zinc-400 block">Valor Estimado (R$)</label>
                <input
                  type="number"
                  value={estimatedValue}
                  onChange={(e) => setEstimatedValue(Number(e.target.value))}
                  className="w-full mt-1 bg-zinc-950 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500"
                />
              </div>
              {currentStage === 'fechado' && (
                <div>
                  <label className="text-[10px] text-emerald-400 font-medium block">Valor Contratado Final (R$)</label>
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
