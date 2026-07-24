'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { RotateCcw } from 'lucide-react';

interface ReactivateClientButtonProps {
  clientId: string;
  clientName: string;
}

export default function ReactivateClientButton({ clientId, clientName }: ReactivateClientButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleReactivate = async () => {
    if (loading) return;
    setLoading(true);

    try {
      const res = await fetch('/api/clientes/nao-se-aplica', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId,
          action: 'reactivate'
        })
      });

      const json = await res.json();
      if (json.success) {
        router.refresh();
      } else {
        alert(`Erro ao reativar cliente: ${json.error}`);
      }
    } catch (err: any) {
      alert(`Falha na reativação: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleReactivate}
      disabled={loading}
      className="inline-flex items-center gap-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 font-semibold px-3 py-1.5 rounded-lg text-xs border border-emerald-500/30 transition-all disabled:opacity-50"
      title={`Reativar ${clientName} no Kanban de Vendas`}
    >
      <RotateCcw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
      <span>{loading ? 'Reativando...' : 'Reativar Cliente'}</span>
    </button>
  );
}
