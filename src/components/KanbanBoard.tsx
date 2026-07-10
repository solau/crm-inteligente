'use client';
import { useState } from 'react';
import { KanbanColumn } from './KanbanColumn';
import { getKanbanColumns } from '@/lib/utils/kanbanLogic';

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

  const {
    colPosVenda,
    col1d,
    col5d,
    col10d,
    col15d,
    col45d,
    col90d
  } = getKanbanColumns(clients, lastInteractions, localContacted, today);

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
