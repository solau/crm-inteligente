'use client';

import { useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function SyncBlingButton({ clientId }: { clientId: string }) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSync = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/clientes/${clientId}/sync`, { method: 'POST' });
      const data = await res.json();
      
      if (res.ok) {
        alert(`Sincronização concluída! ${data.processed} pedido(s) novo(s) processado(s).`);
        router.refresh();
      } else {
        alert(`Erro na sincronização: ${data.error || 'Erro desconhecido'}`);
      }
    } catch (err) {
      console.error('Erro ao sincronizar', err);
      alert('Erro na comunicação com o servidor.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <button 
      onClick={handleSync} 
      disabled={loading}
      className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
        loading 
          ? 'bg-muted text-muted-foreground cursor-not-allowed' 
          : 'bg-primary/10 text-primary hover:bg-primary/20 border border-primary/20 shadow-sm'
      }`}
    >
      <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
      {loading ? 'Buscando Vendas...' : 'Sincronizar Bling'}
    </button>
  );
}
