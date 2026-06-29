'use client';

import { useState, useEffect } from 'react';
import { BrainCircuit, RefreshCw, ChevronRight } from 'lucide-react';

export default function AiDossier({ clientId, initialDossier }: { clientId: string, initialDossier?: string }) {
  const [dossier, setDossier] = useState<string | null>(initialDossier || null);
  const [loading, setLoading] = useState(false);

  const generateDossier = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/clientes/${clientId}/dossie`, { method: 'POST' });
      const data = await res.json();
      if (data.dossier) {
        setDossier(data.dossier);
      }
    } catch (err) {
      console.error("Erro ao gerar dossiê", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-card border border-primary/30 rounded-2xl overflow-hidden shadow-glow-sm relative">
      {/* Background animado e luxuoso */}
      <div className="absolute top-0 right-0 w-48 h-48 bg-primary/10 rounded-full blur-3xl -z-10 translate-x-1/2 -translate-y-1/2"></div>
      
      <div className="p-5 border-b border-border/50 bg-primary/5 flex justify-between items-center">
        <h2 className="text-lg font-semibold flex items-center gap-2 text-primary">
          <BrainCircuit size={20} className={loading ? "animate-pulse text-primary" : "text-primary"} /> 
          Dossiê Tático IA
        </h2>
        
        {dossier && !loading && (
          <button onClick={generateDossier} className="text-xs text-muted-foreground hover:text-primary transition-colors flex items-center gap-1">
            <RefreshCw size={12} /> Regenerar
          </button>
        )}
      </div>

      <div className="p-5">
        {loading ? (
          <div className="space-y-3">
            <div className="h-4 bg-muted animate-pulse rounded w-3/4"></div>
            <div className="h-4 bg-muted animate-pulse rounded w-full"></div>
            <div className="h-4 bg-muted animate-pulse rounded w-5/6"></div>
            <p className="text-xs text-muted-foreground mt-4 animate-pulse">A Inteligência Artificial está escaneando o perfil e as compras do cliente...</p>
          </div>
        ) : dossier ? (
          <div className="space-y-4">
            <p className="text-sm leading-relaxed text-foreground/90 font-medium">
              {dossier}
            </p>
            <div className="pt-2">
               <button className="text-xs bg-primary/20 text-primary border border-primary/30 px-3 py-1.5 rounded-full inline-flex items-center gap-1 font-semibold hover:bg-primary/30 transition-colors">
                 Gerar Mensagem de Venda <ChevronRight size={12}/>
               </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center text-center py-6">
            <BrainCircuit size={32} className="text-muted-foreground/30 mb-3" />
            <p className="text-sm text-muted-foreground mb-4">A IA ainda não analisou este cliente.</p>
            <button 
              onClick={generateDossier}
              className="bg-primary text-primary-foreground px-5 py-2 rounded-xl text-sm font-semibold hover:bg-primary/90 transition-all shadow-glow-sm"
            >
              Gerar Dossiê IA Agora
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
