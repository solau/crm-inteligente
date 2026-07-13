export interface KanbanClient {
  id: string;
  next_expire_date: string | null;
  last_purchase_date: string | null;
  has_active: boolean;
  [key: string]: any;
}

export interface Interaction {
  date: string;
  campaign: string;
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
  lastInteractions: Record<string, Interaction>,
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
    if (localContacted.has(c.id)) {
      continue;
    }

    const daysToExpire = diffDays(c.next_expire_date);
    const daysSincePurchase = diffDaysPast(c.last_purchase_date);
    
    const lastInt = lastInteractions[c.id];
    let isCooldown = false;

    // Lógica de Cooldown Baseada na Última Interação
    if (lastInt) {
      const intDate = new Date(lastInt.date);
      intDate.setHours(0, 0, 0, 0);
      const daysSinceInt = Math.ceil((today.getTime() - intDate.getTime()) / (1000 * 60 * 60 * 24));
      
      const camp = lastInt.campaign;
      
      if (daysSinceInt <= 0) {
        // Se mandou mensagem HOJE, não mostra em nenhum lugar até virar o dia.
        isCooldown = true;
      } else {
        if (camp === 'CASHBACK_15D') {
          if (daysToExpire !== null && daysToExpire > 5) {
            isCooldown = true;
          }
        } else if (camp === 'CASHBACK_10D') {
          if (daysToExpire !== null && daysToExpire > 1) {
            isCooldown = true;
          }
        } else if (camp === 'CASHBACK_5D') {
          if (daysToExpire !== null && daysToExpire > 1) {
            isCooldown = true;
          }
        } else if (camp === 'CASHBACK_1D') {
          // Se já falou no último dia, não precisa falar de novo no dia seguinte antes de expirar
          isCooldown = true;
        } else if (camp === 'AUSENTE_45D' || camp === 'OFERTA_90D') {
          if (daysSinceInt <= 15) {
            isCooldown = true;
          }
        }
      }
    }

    if (isCooldown) continue;

    // Prioridade 1: Cashback
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

    // Prioridade 2: Pós Venda
    if (daysSincePurchase !== null && daysSincePurchase >= -1 && daysSincePurchase <= 7) {
      const isPosVendaResolved = lastInt?.campaign === 'POS_VENDA' && new Date(lastInt.date).getTime() >= new Date(c.last_purchase_date!).getTime();
      
      if (!isPosVendaResolved) {
        colPosVenda.push(c);
        continue;
      }
    }

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
  
  col45d.sort((a, b) => new Date(b.last_purchase_date!).getTime() - new Date(a.last_purchase_date!).getTime());
  col90d.sort((a, b) => new Date(a.last_purchase_date!).getTime() - new Date(b.last_purchase_date!).getTime());

  return {
    colPosVenda,
    col1d,
    col5d,
    col10d,
    col15d,
    col45d,
    col90d
  };
}
