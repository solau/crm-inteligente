import { supabaseAdmin } from '@/lib/supabase';
import { BlingProvider } from '@/lib/infrastructure/providers/BlingProvider';
import { CashbackRepository } from '@/lib/infrastructure/repositories/CashbackRepository';
import { ArrowLeft, User, Phone, BrainCircuit, CreditCard, ShoppingBag, Clock, TrendingUp, AlertCircle } from 'lucide-react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import AiDossier from '@/components/AiDossier';
import SyncBlingButton from '@/components/SyncBlingButton';
import CashbackLedgerTable from '@/components/CashbackLedgerTable';
import OrderHistoryTable from '@/components/OrderHistoryTable';

export default async function ClienteDetalhes({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  const tenantId = 'd948b6cc-cc2c-4399-8525-02f17f281d38';
  
  // 1. Busca os dados do Cliente no Supabase
  const { data: client, error } = await supabaseAdmin
    .from('clients')
    .select('*')
    .eq('id', resolvedParams.id)
    .eq('tenant_id', tenantId)
    .single();

  if (error || !client) {
    redirect('/clientes');
  }

  // 2. Busca o Histórico de Vendas no Bling
  let extratoBling: any[] = [];
  let ltv = 0;
  let ticketMedio = 0;
  let intervaloMedioDias = 0;

  if (client.bling_id) {
    try {
      const blingProvider = new BlingProvider(tenantId);
      extratoBling = await blingProvider.getClientStatement(client.bling_id);
      
      if (extratoBling.length > 0) {
        // Ordena por data (mais antigo para mais novo para cálculos matemáticos corretos)
        const sorted = [...extratoBling].sort((a, b) => new Date(a.data).getTime() - new Date(b.data).getTime());
        
        ltv = sorted.reduce((sum, order) => sum + (Number(order.total) || 0), 0);
        ticketMedio = ltv / sorted.length;

        if (sorted.length > 1) {
          const primeiraCompra = new Date(sorted[0].data).getTime();
          const ultimaCompra = new Date(sorted[sorted.length - 1].data).getTime();
          const diferencaDias = (ultimaCompra - primeiraCompra) / (1000 * 60 * 60 * 24);
          intervaloMedioDias = Math.round(diferencaDias / (sorted.length - 1));
        }
      }
    } catch (e) {
      console.error('Erro ao buscar extrato do bling para o cliente', client.id);
    }
  }

  // 3. Busca o Dossiê Financeiro de Cashback (Ledger)
  const cashbackRepo = new CashbackRepository();
  const ledger = await cashbackRepo.getClientLedger(tenantId, client.id);
  
  const saldoAtivo = ledger.filter(l => l.status === 'ATIVO').reduce((sum, l) => sum + Number(l.remaining_amount), 0);
  const saldoPendente = ledger.filter(l => l.status === 'PENDENTE').reduce((sum, l) => sum + Number(l.remaining_amount), 0);
  const saldoExpirado = ledger.filter(l => l.status === 'EXPIRADO').reduce((sum, l) => sum + Number(l.remaining_amount), 0);

  const whatsappUrl = `https://wa.me/55${client.phone.replace(/\D/g, '')}?text=Olá%20${encodeURIComponent(client.name.split(' ')[0])},%20tudo%20bem?`;

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-12 max-w-6xl mx-auto">
      
      {/* Botão de Voltar */}
      <div>
        <Link href="/clientes" className="inline-flex items-center text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft size={16} className="mr-2" />
          Voltar para Busca
        </Link>
      </div>

      {/* BLOCO 1: Cabeçalho Tático */}
      <div className="bg-card/40 backdrop-blur-xl border border-border/50 rounded-2xl p-6 shadow-glow-sm relative overflow-hidden">
        {/* Glow de Fundo */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 rounded-full blur-3xl -z-10 translate-x-1/3 -translate-y-1/2"></div>
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
              <User size={24} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-foreground tracking-tight">{client.name}</h1>
                <span className="text-xs px-2 py-0.5 rounded-full font-semibold border border-primary/20 bg-primary/10 text-primary">
                  Lead Score {client.lead_score}
                </span>
              </div>
              <p className="text-sm text-muted-foreground flex items-center gap-1 mt-0.5">
                <Phone size={14} /> {client.phone}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <SyncBlingButton clientId={client.id} />
            
            <a 
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-white text-sm font-semibold px-4 py-2.5 rounded-xl shadow-glow-sm transition-all duration-300"
            >
              Iniciar Conversa
            </a>
          </div>
        </div>
      </div>

      {/* BLOCO 2: Grid Principal (2 Colunas) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* COLUNA ESQUERDA: Métricas e Dossiê */}
        <div className="lg:col-span-1 space-y-6">
          
          {/* CARDS: Resumo Financeiro */}
          <div className="grid grid-cols-1 gap-4">
            <div className="bg-card border border-border rounded-2xl p-4 shadow-sm relative overflow-hidden">
              <div className="absolute top-0 right-0 p-3 opacity-10 text-primary">
                <TrendingUp size={48} />
              </div>
              <p className="text-xs font-medium text-muted-foreground">LTV Total</p>
              <h3 className="text-lg font-bold text-foreground mt-1">
                R$ {ltv.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </h3>
            </div>

            <div className="bg-card border border-border rounded-2xl p-4 shadow-sm relative overflow-hidden">
              <div className="absolute top-0 right-0 p-3 opacity-10 text-primary">
                <CreditCard size={48} />
              </div>
              <p className="text-xs font-medium text-muted-foreground">Ticket Médio</p>
              <h3 className="text-lg font-bold text-foreground mt-1">
                R$ {ticketMedio.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </h3>
            </div>

            <div className="bg-card border border-border rounded-2xl p-4 shadow-sm relative overflow-hidden">
              <div className="absolute top-0 right-0 p-3 opacity-10 text-primary">
                <Clock size={48} />
              </div>
              <p className="text-xs font-medium text-muted-foreground">Freq. Média</p>
              <h3 className="text-lg font-bold text-foreground mt-1">
                {intervaloMedioDias > 0 ? `${intervaloMedioDias} dias` : 'Única Compra'}
              </h3>
            </div>
          </div>

          {/* CARDS: Status Cashback */}
          <div className="grid grid-cols-1 gap-4">
            <div className="bg-card border border-border/80 rounded-2xl p-4 shadow-sm bg-emerald-500/[0.02]">
              <p className="text-xs font-medium text-emerald-400/80">Saldo Ativo</p>
              <h3 className="text-xl font-black text-emerald-400 mt-1">
                R$ {saldoAtivo.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </h3>
            </div>

            <div className="bg-card border border-border/80 rounded-2xl p-4 shadow-sm bg-amber-500/[0.02]">
              <p className="text-xs font-medium text-amber-400/80">Saldo Pendente</p>
              <h3 className="text-xl font-black text-amber-400 mt-1">
                R$ {saldoPendente.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </h3>
            </div>

            <div className="bg-card border border-border/80 rounded-2xl p-4 shadow-sm bg-rose-500/[0.02]">
              <p className="text-xs font-medium text-rose-400/80">Saldo Expirado</p>
              <h3 className="text-xl font-black text-rose-400 mt-1">
                R$ {saldoExpirado.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </h3>
            </div>
          </div>

          {/* BLOCO IA: Dossiê Tático */}
          <AiDossier clientId={client.id} initialDossier={client.preferences} />
          
        </div>

        {/* COLUNA DIREITA: Ledgers e Compras Frias */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* TABELA: Cashback Ledger */}
          <CashbackLedgerTable ledger={ledger} />

          {/* TABELA: Histórico ERP (Frio) */}
          <OrderHistoryTable orders={extratoBling} />

        </div>
      </div>
    </div>
  );
}
