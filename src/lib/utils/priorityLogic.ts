import { LeadPriority } from '../types/events';

interface PriorityParams {
  expectedGuests?: number | null;
  guestsRange?: string | null;
  eventDate?: string | Date | null;
  referenceDate?: Date;
}

/**
 * Calcula a prioridade comercial automática de um lead de evento:
 * - ALTA: Próximos 60 dias E >= 26 participantes.
 * - MEDIA: 15 a 25 participantes com data definida OU >= 26 participantes com data mais distante (> 60 dias).
 * - EM NUTRIÇÃO: Sem data prevista OU quantidade indefinida.
 * - OUTRAS: Menos de 15 participantes.
 */
export function calculateLeadPriority(params: PriorityParams): LeadPriority {
  let { expectedGuests, guestsRange, eventDate, referenceDate = new Date() } = params;

  // Se expectedGuests não foi informado numericamente, infere a escala através de guestsRange
  if ((expectedGuests === null || expectedGuests === undefined) && guestsRange) {
    const rangeLower = guestsRange.toLowerCase();
    if (rangeLower.includes('mais de 100') || rangeLower.includes('ev_mais_100') ||
        rangeLower.includes('51 a 100') || rangeLower.includes('ev_51_100') ||
        rangeLower.includes('26 a 50') || rangeLower.includes('ev_26_50')) {
      expectedGuests = 30; // Indicador de >= 26 participantes
    } else if (rangeLower.includes('15 a 25') || rangeLower.includes('ev_15_25')) {
      expectedGuests = 20; // Indicador de 15 a 25 participantes
    } else if (rangeLower.includes('até 14') || rangeLower.includes('ate 14') || rangeLower.includes('ev_ate_14') ||
               rangeLower.includes('até 5') || rangeLower.includes('6 a 10') || rangeLower.includes('11 a 15')) {
      expectedGuests = 10; // Menos de 15 participantes
    } else {
      expectedGuests = null;
    }
  }

  // Se quantidade indefinida ou nula, ou sem data prevista -> EM NUTRIÇÃO
  if (expectedGuests === null || expectedGuests === undefined || !eventDate) {
    // Se tiver menos de 15 participantes definidos, mesmo sem data é OUTRAS
    if (expectedGuests !== null && expectedGuests !== undefined && expectedGuests < 15) {
      return 'OUTRAS';
    }
    return 'EM_NUTRICAO';
  }

  // Menos de 15 participantes -> OUTRAS OPORTUNIDADES
  if (expectedGuests < 15) {
    return 'OUTRAS';
  }

  // Parse seguro da data do evento
  let targetDate: Date;
  if (typeof eventDate === 'string') {
    const clean = eventDate.split('T')[0].split(' ')[0];
    const parts = clean.split('-');
    if (parts.length === 3) {
      targetDate = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    } else {
      targetDate = new Date(eventDate);
    }
  } else {
    targetDate = new Date(eventDate);
  }

  if (isNaN(targetDate.getTime())) {
    return 'EM_NUTRICAO';
  }

  const today = new Date(referenceDate);
  today.setHours(0, 0, 0, 0);
  targetDate.setHours(0, 0, 0, 0);

  const diffDays = Math.ceil((targetDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  // ALTA PRIORIDADE: Próximos 60 dias E >= 26 participantes
  if (diffDays >= 0 && diffDays <= 60 && expectedGuests >= 26) {
    return 'ALTA';
  }

  // MÉDIA PRIORIDADE:
  // 1. 15 a 25 participantes com data definida (futura)
  // 2. >= 26 participantes com data mais distante (> 60 dias)
  if (expectedGuests >= 15 && expectedGuests <= 25 && diffDays >= 0) {
    return 'MEDIA';
  }

  if (expectedGuests >= 26 && diffDays > 60) {
    return 'MEDIA';
  }

  // Se a data já passou no passado, categoriza em nutrição/outras
  if (diffDays < 0) {
    return 'EM_NUTRICAO';
  }

  return 'MEDIA';
}

export const STAGE_LABELS: Record<string, string> = {
  novo_lead: 'Novo Lead',
  contato_realizado: 'Contato Realizado',
  qualificacao: 'Evento em Qualificação',
  orcamento_solicitado: 'Orçamento Solicitado',
  proposta_enviada: 'Proposta Enviada',
  negociacao: 'Em Negociação',
  fechado: 'Evento Fechado',
  perdido: 'Oportunidade Perdida'
};

export const PRIORITY_LABELS: Record<LeadPriority, { label: string; color: string; bg: string }> = {
  ALTA: { label: 'Alta Prioridade', color: 'text-rose-400', bg: 'bg-rose-500/10 border-rose-500/20' },
  MEDIA: { label: 'Média Prioridade', color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20' },
  EM_NUTRICAO: { label: 'Em Nutrição', color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/20' },
  OUTRAS: { label: 'Outras Oportunidades', color: 'text-zinc-400', bg: 'bg-zinc-500/10 border-zinc-500/20' }
};
