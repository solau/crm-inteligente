'use client';

import { useState } from 'react';
import { RefreshCw, CheckCircle2 } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function SyncKanbanButton() {
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const router = useRouter();

  const handleSync = async () => {
    setLoading(true);
    setDone(false);
    try {
      const res = await fetch('/api/sync/recent', { method: 'POST' });
      const data = await res.json();

      if (res.ok) {
        setDone(true);
        alert(`✅ Kanban Atualizado!\n\n${data.syncedOrdersCount || 0} pedidos recentes verificados e sincronizados com sucesso.`);
        router.refresh();
      } else {
        alert(`⚠️ Erro ao atualizar Kanban: ${data.error || 'Erro desconhecido'}`);
      }
    } catch (err) {
      console.error('Erro na sincronização do Kanban:', err);
      alert('Erro na comunicação com o servidor.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleSync}
      disabled={loading}
      className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all duration-200 border shadow-sm ${
        loading
          ? 'bg-muted text-muted-foreground cursor-not-allowed border-border'
          : done
          ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40 hover:bg-emerald-500/30'
          : 'bg-primary/10 text-primary border-primary/30 hover:bg-primary/20 active:scale-95'
      }`}
      title="Força a busca de novos pedidos no Bling dos últimos 7 dias e atualiza os cards do Kanban"
    >
      {done ? (
        <CheckCircle2 size={16} className="text-emerald-400" />
      ) : (
        <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
      )}
      <span>{loading ? 'Atualizando Bling...' : done ? 'Kanban Atualizado' : 'Atualizar Kanban (Bling)'}</span>
    </button>
  );
}
