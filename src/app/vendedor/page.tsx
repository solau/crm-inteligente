import { AlertTriangle, Hand, Target, TrendingUp, Users, Clock, Smartphone, MessageCircle } from 'lucide-react';

export default function VendedorDashboard() {
  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-16">
      
      {/* Header do Vendedor */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pt-2">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground mb-1">Área de Vendas</h1>
          <p className="text-muted-foreground font-medium text-sm">Acompanhe suas metas e puxe novos atendimentos da fila.</p>
        </div>
        <div className="flex items-center gap-6 rounded-xl border border-border bg-card text-card-foreground shadow-sm p-4">
          <div className="px-4 border-r border-border">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Meta Mensal</p>
            <p className="text-xl font-bold text-foreground">R$ 15k <span className="text-xs font-medium text-muted-foreground">/ 30k</span></p>
          </div>
          <div className="px-4">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Ranking</p>
            <p className="text-xl font-bold text-primary flex items-center gap-1.5">2º Lugar <TrendingUp size={18}/></p>
          </div>
        </div>
      </div>

      {/* PAINEL DE ALERTAS (SLA e Mensagens Atrasadas) */}
      <div className="rounded-xl border border-destructive/20 bg-destructive/10 text-destructive-foreground shadow-sm overflow-hidden">
        <div className="flex flex-col space-y-1.5 p-6 pb-4">
          <h3 className="font-semibold leading-none tracking-tight flex items-center gap-2 text-destructive">
            <AlertTriangle size={18} /> Alertas de SLA (Prioridade Máxima)
          </h3>
        </div>
        <div className="p-6 pt-0 grid grid-cols-1 md:grid-cols-2 gap-4">
          
          <div className="rounded-lg border border-border bg-card text-card-foreground p-4 flex justify-between items-center group cursor-pointer hover:border-destructive/50 transition-all shadow-sm">
            <div className="flex items-center gap-4">
              <div className="p-2.5 bg-pink-500/20 text-pink-500 rounded-md"><Smartphone size={20} /></div>
              <div>
                <p className="font-semibold text-sm text-foreground">Comentário não respondido</p>
                <p className="text-xs text-muted-foreground font-medium flex items-center gap-1 mt-1">
                  <Clock size={12}/> Há 12 minutos
                </p>
              </div>
            </div>
            <button className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-xs font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-destructive text-destructive-foreground hover:bg-destructive/90 h-8 px-3">
              Responder
            </button>
          </div>

          <div className="rounded-lg border border-border bg-card text-card-foreground p-4 flex justify-between items-center group cursor-pointer hover:border-destructive/50 transition-all shadow-sm">
            <div className="flex items-center gap-4">
              <div className="p-2.5 bg-emerald-500/20 text-emerald-500 rounded-md"><MessageCircle size={20} /></div>
              <div>
                <p className="font-semibold text-sm text-foreground">WhatsApp (Cliente VIP)</p>
                <p className="text-xs text-muted-foreground font-medium flex items-center gap-1 mt-1">
                  <Clock size={12}/> Há 7 minutos
                </p>
              </div>
            </div>
            <button className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-xs font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-destructive text-destructive-foreground hover:bg-destructive/90 h-8 px-3">
              Responder
            </button>
          </div>

        </div>
      </div>

      {/* POOL DE ATENDIMENTO (Puxar Tarefas) */}
      <div className="pt-4">
        <h2 className="text-xl font-bold text-foreground mb-1 flex items-center gap-2">
          <Users size={20} className="text-primary" /> Fila de Clientes Disponíveis
        </h2>
        <p className="text-sm text-muted-foreground font-medium mb-6">Leads novos aguardando um vendedor.</p>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {[
            { nome: 'Marcos Silva', origem: 'Instagram', score: 95, tag: 'Buscando Wagyu' },
            { nome: 'Ana Paula', origem: 'WhatsApp', score: 82, tag: 'Dúvida Frete' },
            { nome: 'Cliente #8492', origem: 'Site (Bling)', score: 60, tag: 'Carrinho Abandonado' },
          ].map((lead, i) => (
            <div key={i} className="rounded-xl border border-border bg-card text-card-foreground shadow-sm hover:bg-muted/50 transition-all">
              <div className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h4 className="font-semibold text-foreground">{lead.nome}</h4>
                    <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mt-0.5">{lead.origem}</p>
                  </div>
                  <div className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 border-transparent bg-primary/20 text-primary">
                    Score {lead.score}
                  </div>
                </div>
                <div className="mb-6">
                  <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 text-foreground">
                    {lead.tag}
                  </span>
                </div>
                
                {/* Botão de Pull */}
                <button className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2 w-full gap-2">
                  <Hand size={16} /> Puxar Atendimento
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}
