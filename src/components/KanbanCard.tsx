'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Phone, CheckCircle, Clock, Ban, Building2, User, 
  Calendar, Users, ChevronRight 
} from 'lucide-react';
import Link from 'next/link';
import { EventOpportunityModal } from './EventOpportunityModal';
import { STAGE_LABELS } from '@/lib/utils/priorityLogic';

interface KanbanCardProps {
  client: any;
  campaignType: string;
  session?: any;
  onMessageSent?: (clientId: string) => void;
}

export function KanbanCard({ client, campaignType, session, onMessageSent }: KanbanCardProps) {
  const formatMoney = (val: number = 0) => 
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const isKitCard = campaignType === 'KITS' || Boolean(client.is_kit_opportunity) || (
    client.category === 'KIT' || 
    (client.preferences && typeof client.preferences === 'string' && client.preferences.toLowerCase().includes('kit') && client.preferences.toLowerCase().includes('bpe26'))
  );

  const isEventCard = !isKitCard && (campaignType === 'EVENTOS' || Boolean(client.is_event_opportunity) || (
    client.preferences && typeof client.preferences === 'string' && (
      client.preferences.toLowerCase().includes('confraterniza') ||
      client.preferences.toLowerCase().includes('evento')
    )
  ));

  const registerInteraction = async () => {
    if (isLoading) return;
    setIsLoading(true);
    try {
      await fetch('/api/interactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenant_id: client.tenant_id,
          client_id: client.id,
          campaign_type: campaignType,
          user_id: session?.id || null
        })
      });
      
      router.refresh();
      
      if (onMessageSent) {
        onMessageSent(client.id);
      }
    } catch (err) {
      console.error('Erro ao registrar interação no WhatsApp:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleNotApplicable = async () => {
    if (isLoading) return;
    setIsLoading(true);
    try {
      await fetch('/api/clientes/nao-se-aplica', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: client.id,
          action: 'ignore',
          reason: 'Não se aplica ao cliente'
        })
      });

      router.refresh();

      if (onMessageSent) {
        onMessageSent(client.id);
      }
    } catch (err) {
      console.error('Erro ao marcar cliente como não se aplica:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Se for card de Eventos BPE26
  if (isEventCard) {
    const companyName = client.company_name || (client.name?.includes('(') ? client.name.match(/\(([^)]+)\)/)?.[1] : null) || client.name || 'Empresa BPE26';
    const contactName = client.contact_name || client.name?.replace(/\s*\([^)]*\)\s*$/, '') || client.name || 'Responsável não informado';
    const guestsDisplay = client.guests_range || (client.expected_guests ? `${client.expected_guests} convidados` : 'A definir');
    const formattedDate = client.created_at ? new Date(client.created_at).toLocaleDateString('pt-BR') : 'Data recente';
    const stageKey = client.stage || 'novo_lead';
    const stageLabel = STAGE_LABELS[stageKey] || 'Novo Lead';

    const oppData = {
      id: client.event_opportunity_id || client.id,
      client_id: client.id,
      company_name: companyName,
      contact_name: contactName,
      contact_phone: client.phone,
      expected_guests: client.expected_guests,
      guests_range: client.guests_range,
      event_date: client.event_date,
      estimated_value: client.estimated_value || 0,
      contracted_value: client.contracted_value || 0,
      origin_channel: client.origin_channel,
      origin_site: client.origin_site,
      stage: client.stage || 'novo_lead',
      priority: client.priority || 'EM_NUTRICAO',
      assigned_to_name: client.assigned_to_name,
      notes: client.notes,
      created_at: client.created_at,
      category: client.category || 'EVENTO',
      campaign_code: client.campaign_code || 'BPE26'
    };

    return (
      <>
        <div 
          onClick={() => setIsModalOpen(true)}
          className="bg-zinc-900/80 hover:bg-zinc-900 border border-amber-500/30 hover:border-amber-500/60 p-3.5 rounded-xl shadow-md hover:shadow-xl hover:shadow-amber-500/5 transition-all mb-3 group relative cursor-pointer flex flex-col gap-2"
        >
          {/* Top: Nome da empresa em destaque & Etapa comercial */}
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-1.5 min-w-0 flex-1">
              <Building2 className="w-4 h-4 text-amber-400 shrink-0" />
              <h4 className="font-bold text-white text-sm truncate group-hover:text-amber-300 transition-colors" title={companyName}>
                {companyName}
              </h4>
            </div>
            <span className="shrink-0 px-2 py-0.5 rounded-md bg-white/10 text-white/90 text-[11px] font-medium whitespace-nowrap">
              {stageLabel}
            </span>
          </div>

          {/* Nome do responsável */}
          <div className="flex items-center gap-1.5 text-xs text-white/70 truncate">
            <User className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
            <span className="truncate">{contactName}</span>
          </div>

          {/* Convidados & Data do cadastro */}
          <div className="flex items-center justify-between text-xs text-white/60 pt-1.5 border-t border-white/5">
            <div className="flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span>{guestsDisplay}</span>
            </div>
            <div className="flex items-center gap-1 text-[11px] text-white/40">
              <Calendar className="w-3 h-3 text-zinc-500 shrink-0" />
              <span>{formattedDate}</span>
            </div>
          </div>

          {/* Botão GERENCIAR */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setIsModalOpen(true);
            }}
            className="w-full mt-1 py-1.5 px-3 rounded-lg text-xs font-semibold bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
          >
            <span>GERENCIAR</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Modal Interativo Compartilhado de Gerenciamento da Oportunidade */}
        <EventOpportunityModal
          opportunity={oppData}
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          session={session}
        />
      </>
    );
  }

  // Se for card de Kits BPE26
  if (isKitCard) {
    const clientName = client.contact_name || client.name?.replace(/\s*\([^)]*\)\s*$/, '') || client.name || 'Cliente BPE26';
    const companyName = client.company_name || client.preferences?.match(/Empresa:\s*([^|]+)/i)?.[1]?.trim() || (client.name?.includes('(') ? client.name.match(/\(([^)]+)\)/)?.[1] : null) || null;
    const peopleDisplay = client.guests_range || (client.expected_guests ? `${client.expected_guests} pessoas` : client.preferences?.match(/Faixa Pessoas:\s*([^|]+)/i)?.[1]?.trim() || 'A definir');
    const formattedDate = client.created_at ? new Date(client.created_at).toLocaleDateString('pt-BR') : 'Data recente';
    const stageKey = client.stage || 'novo_lead';
    const stageLabel = STAGE_LABELS[stageKey] || 'Novo Lead';

    const oppData = {
      id: client.event_opportunity_id || client.id,
      client_id: client.id,
      company_name: companyName || clientName,
      contact_name: clientName,
      contact_phone: client.phone,
      expected_guests: client.expected_guests,
      guests_range: client.guests_range || (client.preferences?.match(/Faixa Pessoas:\s*([^|]+)/i)?.[1]?.trim() || null),
      event_date: client.event_date,
      estimated_value: client.estimated_value || 0,
      contracted_value: client.contracted_value || 0,
      origin_channel: client.origin_channel,
      origin_site: client.origin_site,
      stage: client.stage || 'novo_lead',
      priority: client.priority || 'EM_NUTRICAO',
      assigned_to_name: client.assigned_to_name,
      notes: client.notes,
      created_at: client.created_at,
      category: 'KIT',
      campaign_code: client.campaign_code || 'BPE26'
    };

    return (
      <>
        <div 
          onClick={() => setIsModalOpen(true)}
          className="bg-zinc-900/80 hover:bg-zinc-900 border border-amber-500/30 hover:border-amber-500/60 p-3.5 rounded-xl shadow-md hover:shadow-xl hover:shadow-amber-500/5 transition-all mb-3 group relative cursor-pointer flex flex-col gap-2"
        >
          {/* Top: Nome do cliente em destaque & Etapa comercial */}
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-1.5 min-w-0 flex-1">
              <User className="w-4 h-4 text-amber-400 shrink-0" />
              <h4 className="font-bold text-white text-sm truncate group-hover:text-amber-300 transition-colors" title={clientName}>
                {clientName}
              </h4>
            </div>
            <span className="shrink-0 px-2 py-0.5 rounded-md bg-white/10 text-white/90 text-[11px] font-medium whitespace-nowrap">
              {stageLabel}
            </span>
          </div>

          {/* Nome da empresa (quando disponível) */}
          {companyName ? (
            <div className="flex items-center gap-1.5 text-xs text-white/70 truncate">
              <Building2 className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
              <span className="truncate">{companyName}</span>
            </div>
          ) : null}

          {/* Pessoas no churrasco & Data do cadastro */}
          <div className="flex items-center justify-between text-xs text-white/60 pt-1.5 border-t border-white/5">
            <div className="flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span>{peopleDisplay}</span>
            </div>
            <div className="flex items-center gap-1 text-[11px] text-white/40">
              <Calendar className="w-3 h-3 text-zinc-500 shrink-0" />
              <span>{formattedDate}</span>
            </div>
          </div>

          {/* Botão GERENCIAR */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setIsModalOpen(true);
            }}
            className="w-full mt-1 py-1.5 px-3 rounded-lg text-xs font-semibold bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
          >
            <span>GERENCIAR</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Modal Interativo Compartilhado de Gerenciamento da Oportunidade */}
        <EventOpportunityModal
          opportunity={oppData}
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          session={session}
        />
      </>
    );
  }

  // Texto padrão persuasivo do WhatsApp para outras campanhas do CRM
  let wppText = `Olá ${client.name}, tudo bem?`;
  if (campaignType === 'CORRIDA_ALPHAVILLE') {
    wppText = `Olá ${client.name}, tudo bem? Sou da equipe da Alpha Bull e vimos que você participou da Corrida Alphaville! 🏃‍♂️🥩 Preparamos uma condição especial exclusiva para você repor as energias e conhecer nossos cortes nobres. Gostaria de dar uma olhadinha no nosso cardápio?`;
  } else if (campaignType === 'LEADS_BPE25') {
    wppText = `Olá ${client.name}, tudo bem? Sou da equipe da Alpha Bull! Vimos seu contato através do BPE 2025. 🥩✨ Preparamos uma condição super especial para você conhecer nossos cortes nobres e produtos de alta qualidade. Gostaria de dar uma olhada no nosso catálogo?`;
  } else if (campaignType === 'LEADS_WHATSAPP') {
    wppText = `Olá ${client.name}, tudo bem? Sou da equipe da Alpha Bull! 🥩✨ Passando para compartilhar nossas novidades e os melhores cortes da semana para o seu churrasco. Posso te enviar nosso cardápio exclusivo?`;
  } else if (campaignType.includes('CASHBACK')) {
    wppText = `Olá ${client.name}! Vi que você tem ${formatMoney(client.cashback_balance)} em saldo de cashback disponível. Gostaria de aproveitar em sua próxima compra?`;
  } else if (campaignType === 'POS_VENDA') {
    wppText = `Olá ${client.name}, tudo bem? Passando para saber como foi sua experiência com os produtos da Alpha Bull. Deu tudo certo com o seu pedido?`;
  }

  const cleanPhone = client.phone ? client.phone.replace(/\D/g, '') : '';
  const wppLink = `https://wa.me/55${cleanPhone}?text=${encodeURIComponent(wppText)}`;

  // Card Tradicional do CRM (Cashback, Ausentes, etc.)
  return (
    <div className="bg-white/10 backdrop-blur-md border border-white/20 p-4 rounded-xl shadow-lg hover:shadow-xl transition-all mb-3 group relative">
      <div className="flex justify-between items-start mb-2">
        <Link href={`/clientes/${client.id}`} className="font-semibold text-white/90 hover:text-white text-sm truncate pr-2 flex-1 hover:underline">
          {client.name}
        </Link>
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-bold text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded">
            Score: {client.lead_score}
          </span>
        </div>
      </div>
      
      <div className="flex flex-col gap-1 mb-3">
        {client.cashback_balance > 0 && client.has_active && (
          <div className="text-xs text-white/70 flex items-center gap-1">
            <CheckCircle className="w-3 h-3 text-emerald-400" />
            Cashback: {formatMoney(client.cashback_balance)}
          </div>
        )}
        {client.total_expired_amount > 0 && (
          <div className="text-xs text-rose-300 flex items-center gap-1">
            <Clock className="w-3 h-3" />
            Perdido: {formatMoney(client.total_expired_amount)}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-2 border-t border-white/10 pt-3 mt-1">
        <div className="flex justify-between items-center gap-2">
          <button 
            onClick={registerInteraction}
            disabled={isLoading}
            className={`flex items-center gap-1 text-[11px] font-medium text-white/50 hover:text-white/90 bg-white/5 hover:bg-white/15 px-2 py-1.5 rounded-lg transition-colors flex-1 justify-center ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
            title="Marcar como contatado sem abrir o WhatsApp"
          >
            <CheckCircle className="w-3.5 h-3.5" />
            {isLoading ? 'Salvando...' : 'Já Falei'}
          </button>
          
          <button 
            onClick={() => {
              if (!isLoading) {
                window.open(wppLink, '_blank', 'noopener,noreferrer');
                registerInteraction();
              }
            }}
            disabled={isLoading}
            className={`flex items-center gap-1 text-[11px] font-medium text-emerald-400 hover:text-emerald-300 bg-emerald-400/10 hover:bg-emerald-400/20 px-2.5 py-1.5 rounded-lg transition-colors flex-1 justify-center ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <Phone className="w-3.5 h-3.5" />
            WhatsApp
          </button>
        </div>

        {/* Botão Não Se Aplica */}
        <button
          onClick={handleNotApplicable}
          disabled={isLoading}
          className="flex items-center justify-center gap-1.5 text-[10px] font-semibold text-rose-400/80 hover:text-rose-300 bg-rose-500/10 hover:bg-rose-500/20 py-1 px-2 rounded-md transition-colors w-full border border-rose-500/20"
          title="Remover este cliente do Kanban de vendas por não se aplicar"
        >
          <Ban className="w-3 h-3" />
          <span>Não Se Aplica</span>
        </button>
      </div>
    </div>
  );
}
