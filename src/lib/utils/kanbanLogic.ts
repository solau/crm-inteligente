export interface KanbanClient {
  id: string;
  next_expire_date: string | null;
  last_purchase_date: string | null;
  has_active: boolean;
  [key: string]: any;
}

export interface ClientInteractions {
  latest: { date: string, campaign: string } | null;
  latestPosVenda: { date: string, campaign: string } | null;
}

export interface KanbanColumns {
  colPosVenda: KanbanClient[];
  col1d: KanbanClient[];
  col5d: KanbanClient[];
  col10d: KanbanClient[];
  col15d: KanbanClient[];
  col45d: KanbanClient[];
  col90d: KanbanClient[];
}

export function parseSafeDate(dateStr: string | null): Date | null {
  if (!dateStr) return null;
  const cleanStr = dateStr.split('T')[0].split(' ')[0];
  const parts = cleanStr.split('-');
  if (parts.length === 3) {
    return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
  }
  const d = new Date(dateStr);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function getKanbanColumns(
  clients: KanbanClient[],
  lastInteractions: Record<string, ClientInteractions>,
  localContacted: Set<string>,
  now: Date = new Date()
): KanbanColumns {
  
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);

  const diffDays = (dateStr: string | null) => {
    const d = parseSafeDate(dateStr);
    if (!d) return null;
    const diffTime = d.getTime() - today.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };
  
  const diffDaysPast = (dateStr: string | null) => {
    const d = parseSafeDate(dateStr);
    if (!d) return null;
    const diffTime = today.getTime() - d.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  const colPosVenda: KanbanClient[] = [];
  const col1d: KanbanClient[] = [];
  const col5d: KanbanClient[] = [];
  const col10d: KanbanClient[] = [];
  const col15d: KanbanClient[] = [];
  const col45d: KanbanClient[] = [];
  const col90d: KanbanClient[] = [];

  for (const c of clients) {
    // Exclusão estrita: Clientes sem telefone cadastrado ou com telefones genéricos não entram no Kanban
    const cleanPhone = c.phone ? c.phone.replace(/\D/g, '') : '';
    if (!cleanPhone || cleanPhone.length < 10 || cleanPhone === '00000000000' || cleanPhone.startsWith('5500')) {
      continue;
    }

    if (localContacted.has(c.id)) {
      continue;
    }

    const daysToExpire = diffDays(c.next_expire_date);
    const daysSincePurchase = diffDaysPast(c.last_purchase_date);
    
    const record = lastInteractions[c.id];
    const lastInt = record?.latest;
    const lastPosVenda = record?.latestPosVenda;

    // Regra de Exclusão "Não se Aplica": Se a última ação registrada for NAO_SE_APLICA, o cliente é sumido do Kanban
    if (lastInt?.campaign === 'NAO_SE_APLICA') {
      continue;
    }
    
    let isCooldown = false;

    // Lógica de Cooldown Baseada na Última Interação
    if (lastInt) {
      const intDate = parseSafeDate(lastInt.date);
      let daysSinceInt = 0;
      if (intDate) {
        const diffTime = today.getTime() - intDate.getTime();
        daysSinceInt = Math.round(diffTime / (1000 * 60 * 60 * 24));
      }
      
      const camp = lastInt.campaign;
      
      if (daysSinceInt <= 0) {
        // Se mandou mensagem HOJE, não mostra em nenhum lugar até virar o dia.
        isCooldown = true;
      } else {
        if (camp === 'CASHBACK_15D') {
          if (c.has_active && daysToExpire !== null && daysToExpire > 5) {
            isCooldown = true;
          }
        } else if (camp === 'CASHBACK_10D') {
          if (c.has_active && daysToExpire !== null && daysToExpire > 1) {
            isCooldown = true;
          }
        } else if (camp === 'CASHBACK_5D') {
          if (c.has_active && daysToExpire !== null && daysToExpire > 1) {
            isCooldown = true;
          }
        } else if (camp === 'CASHBACK_1D') {
          if (c.has_active && daysSinceInt < 1) {
            isCooldown = true;
          }
        } else if (camp === 'AUSENTE_45D' || camp === 'OFERTA_90D') {
          // Cooldown de 15 dias: dias 0 a 14. No 15º dia (daysSinceInt >= 15), o cliente fica LIBERADO.
          if (daysSinceInt < 15) {
            isCooldown = true;
          }
        }
      }
    }
    // Prioridade 1: Pós Venda
    // Regra:
    //   - Compra nos últimos 7 dias
    //   - Nenhuma mensagem enviada HOJE
    //   - Nenhum POS_VENDA enviado nos últimos 15 dias (cooldown absoluto, independente de nova compra)
    //   - Se o último POS_VENDA foi há >= 15 dias E houve nova compra após esse POS_VENDA: libera para nova abordagem
    let assignedPosVenda = false;
    if (daysSincePurchase !== null && daysSincePurchase >= -1 && daysSincePurchase <= 7) {
      let isBlockedPosVenda = false;

      // Bloqueia se mandou qualquer mensagem HOJE
      if (lastInt) {
        const intDate = parseSafeDate(lastInt.date);
        if (intDate) {
          const daysSinceInt = Math.round((today.getTime() - intDate.getTime()) / (1000 * 60 * 60 * 24));
          if (daysSinceInt <= 0) {
            isBlockedPosVenda = true;
          }
        }
      }

      // Bloqueia se recebeu POS_VENDA nos últimos 15 dias (cooldown absoluto)
      if (!isBlockedPosVenda && record?.latestPosVenda) {
        const posVendaDay = parseSafeDate(record.latestPosVenda.date);
        if (posVendaDay) {
          const daysSincePosVenda = Math.round((today.getTime() - posVendaDay.getTime()) / (1000 * 60 * 60 * 24));
          if (daysSincePosVenda < 15) {
            // Dentro do cooldown de 15 dias → bloqueado
            isBlockedPosVenda = true;
          } else {
            // Cooldown expirado: só aparece se houve nova compra APÓS o último POS_VENDA
            const purchaseDay = parseSafeDate(c.last_purchase_date);
            if (purchaseDay && purchaseDay.getTime() <= posVendaDay.getTime()) {
              // Compra é anterior ou igual ao último POS_VENDA → já foi atendido para essa compra
              isBlockedPosVenda = true;
            }
          }
        }
      }

      if (!isBlockedPosVenda) {
        colPosVenda.push(c);
        assignedPosVenda = true;
      }
    }

    if (assignedPosVenda) continue;

    // Para as demais colunas (Cashback, Ausentes), aplica o Cooldown geral
    if (isCooldown) continue;

    // Prioridade 2: Cashback
    let assigned = false;
    if (c.has_active && daysToExpire !== null) {
      if (daysToExpire <= 1) {
        col1d.push(c);
        assigned = true;
      } else if (daysToExpire > 1 && daysToExpire <= 5) {
        col5d.push(c);
        assigned = true;
      } else if (daysToExpire > 5 && daysToExpire <= 10) {
        col10d.push(c);
        assigned = true;
      } else if (daysToExpire > 10 && daysToExpire <= 15) {
        col15d.push(c);
        assigned = true;
      }
    }

    if (assigned) continue;

    // Prioridade 3: Ausências
    if (daysSincePurchase !== null) {
      if (daysSincePurchase > 45 && daysSincePurchase <= 90) {
        col45d.push(c);
        continue;
      } else if (daysSincePurchase > 90) {
        col90d.push(c);
        continue;
      }
    }
  }

  // Ordenações
  colPosVenda.sort((a, b) => new Date(b.last_purchase_date!).getTime() - new Date(a.last_purchase_date!).getTime());
  
  col1d.sort((a, b) => new Date(a.next_expire_date!).getTime() - new Date(b.next_expire_date!).getTime());
  col5d.sort((a, b) => new Date(a.next_expire_date!).getTime() - new Date(b.next_expire_date!).getTime());
  col10d.sort((a, b) => new Date(a.next_expire_date!).getTime() - new Date(b.next_expire_date!).getTime());
  col15d.sort((a, b) => new Date(a.next_expire_date!).getTime() - new Date(b.next_expire_date!).getTime());
  
  col45d.sort((a, b) => (b.lead_score ?? 0) - (a.lead_score ?? 0));
  col90d.sort((a, b) => (b.lead_score ?? 0) - (a.lead_score ?? 0));

  // Limita colunas de ausentes aos clientes mais relevantes (lead_score DESC)
  const MAX_ABSENT = 1000;
  const col45dLimited = col45d.slice(0, MAX_ABSENT);
  const col90dLimited = col90d.slice(0, MAX_ABSENT);

  return {
    colPosVenda,
    col1d,
    col5d,
    col10d,
    col15d,
    col45d: col45dLimited,
    col90d: col90dLimited
  };
}

