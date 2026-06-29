'use client';

import { useState } from 'react';
import { DownloadCloud, Loader2 } from 'lucide-react';

export function SyncButton() {
  const [loading, setLoading] = useState(false);

  const handleSync = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/sync');
      const data = await res.json();
      
      if (data.success) {
        alert(`Sucesso! ${data.count} clientes históricos importados do Bling.`);
      } else {
        alert('Erro ao sincronizar histórico.');
      }
    } catch (e) {
      alert('Erro de conexão ao sincronizar.');
    }
    setLoading(false);
  };

  return (
    <button
      onClick={handleSync}
      disabled={loading}
      className="inline-flex items-center gap-2 px-6 py-3 bg-secondary text-secondary-foreground hover:bg-secondary/80 rounded-lg font-bold text-sm transition-colors shadow-sm disabled:opacity-50"
    >
      {loading ? <Loader2 size={18} className="animate-spin" /> : <DownloadCloud size={18} />}
      {loading ? 'Baixando...' : 'Sincronizar Histórico'}
    </button>
  );
}
