'use client';

import { useState } from 'react';
import { Calculator, CheckCircle2 } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function ReconcileCashbackButton({ clientId }: { clientId: string }) {
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const router = useRouter();

  const handleReconcile = async () => {
    setLoading(true);
    setDone(false);
    try {
      const res = await fetch(`/api/clientes/${clientId}/reconcile-cashback`, { method: 'POST' });
      const data = await res.json();

      if (res.ok) {
        setDone(true);
        alert(`✅ Cashback Revisado!\n\nSaldo Ativo: R$ ${data.cashback_balance.toFixed(2)}\nLTV Total: R$ ${data.total_spent.toFixed(2)}`);
        router.refresh();
      } else {
        alert(`⚠️ Erro ao revisar cashback: ${data.error || 'Erro desconhecido'}`);
      }
    } catch (err) {
      console.error('Erro ao revisar cashback', err);
      alert('Erro na comunicação com o servidor.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleReconcile}
      disabled={loading}
      className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all duration-200 border ${
        loading
          ? 'bg-muted text-muted-foreground cursor-not-allowed border-border'
          : done
          ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30 hover:bg-emerald-500/20'
          : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30 hover:bg-amber-500/20 shadow-sm'
      }`}
      title="Revisa e recalcula o extrato de cashback e descontos do Bling para este cliente"
    >
      {done ? (
        <CheckCircle2 size={15} className="text-emerald-500" />
      ) : (
        <Calculator size={15} className={loading ? 'animate-spin' : ''} />
      )}
      <span>{loading ? 'Revisando...' : done ? 'Cashback Auditado' : 'Revisar Cashback'}</span>
    </button>
  );
}
