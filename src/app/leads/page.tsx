import { MoreHorizontal, Plus, MessageCircle, AlertCircle } from 'lucide-react';
import Link from 'next/link';

export default function LeadsKanban() {
  const columns = [
    { title: 'Novos Leads', count: 5, bg: 'bg-muted/50', border: 'border-border', dot: 'bg-muted-foreground' },
    { title: 'Em Contato', count: 12, bg: 'bg-blue-500/10', border: 'border-blue-500/20', dot: 'bg-blue-500' },
    { title: 'Apresentação', count: 4, bg: 'bg-purple-500/10', border: 'border-purple-500/20', dot: 'bg-purple-500' },
    { title: 'Negociação', count: 3, bg: 'bg-amber-500/10', border: 'border-amber-500/20', dot: 'bg-amber-500' },
    { title: 'Fechado (Ganho)', count: 28, bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', dot: 'bg-emerald-500' }
  ];

  return (
    <div className="h-[calc(100vh-140px)] flex flex-col animate-in fade-in slide-in-from-bottom-4 duration-700">
      
      {/* Header do Kanban */}
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground mb-1">Pipeline de Vendas</h1>
          <p className="text-muted-foreground font-medium text-sm flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse ring-2 ring-emerald-500/20"></span>
            Sincronizado com WhatsApp e Bling
          </p>
        </div>
        <button className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2 gap-2">
          <Plus size={16} />
          <span>Novo Lead</span>
        </button>
      </div>

      {/* Área do Kanban */}
      <div className="flex-1 flex gap-6 overflow-x-auto pb-6 custom-scrollbar">
        
        {columns.map((col, i) => (
          <div key={i} className={`flex-shrink-0 w-[320px] rounded-xl border ${col.border} bg-card text-card-foreground shadow-sm flex flex-col overflow-hidden`}>
            
            {/* Título da Coluna */}
            <div className={`p-4 flex items-center justify-between ${col.bg} border-b ${col.border}`}>
              <div className="flex items-center gap-3">
                <span className={`w-2 h-2 rounded-full ${col.dot}`}></span>
                <h3 className="font-semibold text-foreground text-sm">{col.title}</h3>
                <span className="inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 border-transparent bg-background text-foreground shadow-sm">
                  {col.count}
                </span>
              </div>
              <button className="text-muted-foreground hover:text-foreground transition-colors p-1.5 rounded-md hover:bg-muted/80">
                <MoreHorizontal size={18} />
              </button>
            </div>

            {/* Lista de Cards */}
            <div className="flex-1 p-4 space-y-3 overflow-y-auto bg-muted/20">
              
              {/* Exemplo de Card */}
              <Link href="/clientes/123" className="block rounded-lg border border-border bg-card text-card-foreground shadow-sm hover:border-primary/50 transition-all cursor-pointer group p-4">
                <div className="flex justify-between items-start mb-3">
                  <div className="space-y-1">
                    <h4 className="font-semibold text-foreground text-sm leading-tight group-hover:text-primary transition-colors">Empresa Alpha Ltda</h4>
                    <span className="text-[10px] font-bold text-primary uppercase tracking-wider">Score IA: 92</span>
                  </div>
                  <span className="inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 border-transparent bg-secondary text-secondary-foreground">
                    R$ 4.500
                  </span>
                </div>
                
                <p className="text-xs text-muted-foreground mb-4 leading-relaxed line-clamp-2">
                  Cliente perguntou sobre o prazo de entrega. Grande chance de fechamento hoje.
                </p>

                <div className="flex items-center justify-between pt-3 border-t border-border/50">
                  <div className="flex items-center gap-1.5 text-[10px] font-semibold text-muted-foreground">
                    <MessageCircle size={14} />
                    <span>Há 10 min</span>
                  </div>
                  
                  {/* Avatar do Vendedor */}
                  <div className="w-6 h-6 rounded-full bg-primary/20 text-primary flex items-center justify-center text-[10px] font-bold ring-2 ring-background">
                    JV
                  </div>
                </div>
              </Link>

              {/* Exemplo de Card com Alerta */}
              {i === 1 && (
                <div className="rounded-lg border border-amber-500/30 bg-card text-card-foreground shadow-sm hover:border-amber-500/60 transition-all cursor-grab relative overflow-hidden group p-4 pl-5">
                  <div className="absolute top-0 left-0 w-1 h-full bg-amber-500"></div>
                  <div className="flex justify-between items-start mb-3">
                    <div className="space-y-1">
                      <h4 className="font-semibold text-foreground text-sm leading-tight group-hover:text-amber-500 transition-colors">João Silva</h4>
                      <span className="text-[10px] font-bold text-amber-500 flex items-center gap-1 uppercase tracking-wider">
                        <AlertCircle size={12} /> Cashback Vencendo
                      </span>
                    </div>
                    <span className="inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 border-transparent bg-secondary text-secondary-foreground">R$ 800</span>
                  </div>
                </div>
              )}

            </div>
          </div>
        ))}

        <div className="w-4 flex-shrink-0"></div>
      </div>
    </div>
  );
}
