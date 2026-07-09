'use client';
import { useState } from 'react';
import { KanbanColumn } from './KanbanColumn';

interface KanbanBoardProps {
  clients: any[];
  session?: any;
  lastInteractions?: Record<string, { date: string, campaign: string }>;
}

export function KanbanBoard({ clients, session, lastInteractions = {} }: KanbanBoardProps) {
  // Guarda no estado apenas os ids contatados AGORA (no render atual) para esconder instantaneamente
  const [localContacted, setLocalContacted] = useState<Set<string>>(new Set());

  const handleMessageSent = (clientId: string) => {
    setLocalContacted(prev => {
      const newSet = new Set(prev);
      newSet.add(clientId);
      return newSet;
    });
  };

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Helper para lidar com datas de fuso horário corretamente
  const parseSafeDate = (dateStr: string | null) => {
    if (!dateStr) return null;
    const cleanStr = dateStr.split('T')[0].split(' ')[0]; // Garante apenas YYYY-MM-DD
    const parts = cleanStr.split('-');
    if (parts.length === 3) {
      return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    }
    const d = new Date(dateStr);
    d.setHours(0,0,0,0);
    return d;
  };

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

  const colPosVenda = [];
  const col1d = [];
  const col5d = [];
  const col10d = [];
  const col15d = []; // Nova coluna
  const col45d = [];
  const col90d = [];

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
      intDate.setHours(0,0,0,0);
      const daysSinceInt = diffDaysPast(lastInt.date) || 0;
      
      const camp = lastInt.campaign;
      
      if (daysSinceInt === 0) {
        // Se mandou mensagem HOJE, não mostra em nenhum lugar até virar o dia.
        isCooldown = true;
      } else {
        if (camp === 'CASHBACK_15D') {
          // Se enviou no 15d, pula o de 10 e só reaparece quando faltar <= 5
          if (daysToExpire !== null && daysToExpire > 5) {
            isCooldown = true;
          }
        } else if (camp === 'CASHBACK_10D') {
          // Se enviou no 10d, só reaparece no Expira Hoje (<= 1)
          if (daysToExpire !== null && daysToExpire > 1) {
            isCooldown = true;
          }
        } else if (camp === 'CASHBACK_5D') {
          // Se enviou no 5d, só reaparece no Expira Hoje (<= 1)
          if (daysToExpire !== null && daysToExpire > 1) {
            isCooldown = true;
          }
        } else if (camp === 'AUSENTE_45D' || camp === 'OFERTA_90D') {
          // Se enviou pra ausente e não comprou, só reaparece daqui 15 dias
          if (daysSinceInt <= 15) {
            isCooldown = true;
          }
        }
      }
    }

    if (isCooldown) continue;

    // Prioridade 1: Cashback (Mais Urgente que o Pós-Venda)
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
      colPosVenda.push(c);
      continue;
    }

    // Prioridade 3: Ausências (> 45d e > 90d)
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
  col1d.sort((a, b) => new Date(a.next_expire_date).getTime() - new Date(b.next_expire_date).getTime());
  col5d.sort((a, b) => new Date(a.next_expire_date).getTime() - new Date(b.next_expire_date).getTime());
  col10d.sort((a, b) => new Date(a.next_expire_date).getTime() - new Date(b.next_expire_date).getTime());
  col15d.sort((a, b) => new Date(a.next_expire_date).getTime() - new Date(b.next_expire_date).getTime());
  
  col45d.sort((a, b) => new Date(b.last_purchase_date).getTime() - new Date(a.last_purchase_date).getTime());
  col90d.sort((a, b) => new Date(a.last_purchase_date).getTime() - new Date(b.last_purchase_date).getTime());

  return (
    <div className="flex gap-4 overflow-x-auto pb-6 pt-2 custom-scrollbar snap-x snap-mandatory">
      <KanbanColumn title="Pós-Venda (<= 7d)" clients={colPosVenda} campaignType="POS_VENDA" color="border-sky-500" session={session} onMessageSent={handleMessageSent} />
      <KanbanColumn title="Expira HOJE" clients={col1d} campaignType="CASHBACK_1D" color="border-rose-500" session={session} onMessageSent={handleMessageSent} />
      <KanbanColumn title="Expira em < 5d" clients={col5d} campaignType="CASHBACK_5D" color="border-orange-500" session={session} onMessageSent={handleMessageSent} />
      <KanbanColumn title="Expira em < 10d" clients={col10d} campaignType="CASHBACK_10D" color="border-yellow-400" session={session} onMessageSent={handleMessageSent} />
      <KanbanColumn title="Expira em < 15d" clients={col15d} campaignType="CASHBACK_15D" color="border-green-400" session={session} onMessageSent={handleMessageSent} />
      <KanbanColumn title="Ausente > 45d" clients={col45d} campaignType="AUSENTE_45D" color="border-purple-500" session={session} onMessageSent={handleMessageSent} />
      <KanbanColumn title="Ausente > 90d (Oferta)" clients={col90d} campaignType="OFERTA_90D" color="border-indigo-500" session={session} onMessageSent={handleMessageSent} />
    </div>
  );
}
