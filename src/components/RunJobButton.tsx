"use client";

import { useState } from 'react';
import { Play } from 'lucide-react';

export function RunJobButton() {
  const [loading, setLoading] = useState(false);

  const handleRunJob = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/cron/cashback?secret=alpha-bull-cron-secret-123');
      const data = await res.json();
      if (res.ok) {
        alert(`Job executado com sucesso!\nAtivados: ${data.activated_count}\nExpirados: ${data.expired_count}\nClientes Atualizados: ${data.clients_updated}`);
      } else {
        alert('Erro ao executar job: ' + JSON.stringify(data));
      }
    } catch (err: any) {
      alert('Erro: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleRunJob}
      disabled={loading}
      className="flex items-center gap-2 bg-primary text-primary-foreground hover:bg-primary/90 px-4 py-2 rounded-md text-sm font-medium transition-colors disabled:opacity-50"
    >
      <Play size={16} />
      {loading ? 'Executando...' : 'Rodar Job de Cashback'}
    </button>
  );
}
