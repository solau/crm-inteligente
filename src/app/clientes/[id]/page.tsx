import { supabaseAdmin } from '@/lib/supabase';
import { BlingProvider } from '@/lib/infrastructure/providers/BlingProvider';
import { CashbackRepository } from '@/lib/infrastructure/repositories/CashbackRepository';
import { ArrowLeft, User, Phone, BrainCircuit, CreditCard, ShoppingBag, Clock, TrendingUp, AlertCircle, CheckCircle2, XCircle, Timer } from 'lucide-react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import AiDossier from '@/components/AiDossier';

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

  const getStatusIcon = (status: string) => {
    switch(status) {
      case 'ATIVO': return <CheckCircle2 className="text-emerald-400" size={16} />;
      case 'PENDENTE': return <Timer className="text-amber-400" size={16} />;
      case 'EXPIRADO': return <XCircle className="text-rose-400" size={16} />;
      case 'UTILIZADO': return <ShoppingBag className="text-blue-400" size={16} />;
      default: return <AlertCircle size={16} />;
    }
  };

  const getStatusColor = (status: string) => {
    switch(status) {
      case 'ATIVO': return 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20';
      case 'PENDENTE': return 'text-amber-400 bg-amber-400/10 border-amber-400/20';
      case 'EXPIRADO': return 'text-rose-400 bg-rose-400/10 border-rose-400/20';
      case 'UTILIZADO': return 'text-blue-400 bg-blue-400/10 border-blue-400/20';
      default: return 'text-muted-foreground bg-muted border-border';
    }
  };

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
        
        <div className="flex flex-col md:flex-row justify-between items-start gap-6">
          <div className="flex items-center gap-5">
            <div className="h-20 w-20 bg-gradient-to-br from-primary/20 to-primary/5 rounded-2xl flex items-center justify-center border border-primary/20 shadow-inner">
              <User size={40} className="text-primary" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-foreground">{client.name}</h1>
              <a href={whatsappUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 mt-2 px-3 py-1.5 rounded-lg bg-green-500/10 text-green-400 border border-green-500/20 hover:bg-green-500/20 transition-colors text-sm font-medium">
                <Phone size={14} /> {client.phone}
              </a>
            </div>
          </div>
          
          <div className="flex flex-wrap gap-4">
            <div className="bg-background/50 border border-border/50 rounded-xl p-4 min-w-[120px]">
              <div className="text-xs text-muted-foreground uppercase font-semibold mb-1 flex items-center gap-1"><TrendingUp size={12}/> Lead Score</div>
              <div className="text-2xl font-bold text-primary">{client.lead_score}<span className="text-sm text-muted-foreground font-normal">/100</span></div>
            </div>
            <div className="bg-background/50 border border-border/50 rounded-xl p-4 min-w-[120px]">
              <div className="text-xs text-muted-foreground uppercase font-semibold mb-1 flex items-center gap-1"><CreditCard size={12}/> LTV Total</div>
              <div className="text-2xl font-bold text-foreground">R$ {ltv.toFixed(2).replace('.', ',')}</div>
            </div>
            <div className="bg-background/50 border border-border/50 rounded-xl p-4 min-w-[120px]">
              <div className="text-xs text-muted-foreground uppercase font-semibold mb-1 flex items-center gap-1"><ShoppingBag size={12}/> Ticket Médio</div>
              <div className="text-2xl font-bold text-foreground">R$ {ticketMedio.toFixed(2).replace('.', ',')}</div>
            </div>
            <div className="bg-background/50 border border-border/50 rounded-xl p-4 min-w-[120px]">
              <div className="text-xs text-muted-foreground uppercase font-semibold mb-1 flex items-center gap-1"><Clock size={12}/> Frequência</div>
              <div className="text-2xl font-bold text-foreground">{intervaloMedioDias > 0 ? `${intervaloMedioDias} dias` : 'Única Compra'}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* COLUNA ESQUERDA: Financeiro e IA */}
        <div className="lg:col-span-1 space-y-6">
          
          {/* BLOCO 2: Coração Financeiro (Saldos) */}
          <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
            <div className="p-5 border-b border-border bg-muted/20">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <CreditCard className="text-emerald-400" size={18} /> Resumo de Cashback
              </h2>
            </div>
            <div className="p-5 space-y-4">
              <div className="p-4 bg-emerald-400/10 border border-emerald-400/20 rounded-xl flex justify-between items-center">
                <div>
                  <div className="text-xs text-emerald-400/70 uppercase font-semibold">Disponível para Abater</div>
                  <div className="text-2xl font-bold text-emerald-400">R$ {saldoAtivo.toFixed(2).replace('.', ',')}</div>
                </div>
                <CheckCircle2 className="text-emerald-400/50" size={32} />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-amber-400/5 border border-amber-400/10 rounded-xl">
                  <div className="text-xs text-amber-400/70 uppercase font-semibold">Pendente (Carência)</div>
                  <div className="text-lg font-bold text-amber-400">R$ {saldoPendente.toFixed(2).replace('.', ',')}</div>
                </div>
                <div className="p-3 bg-rose-400/5 border border-rose-400/10 rounded-xl">
                  <div className="text-xs text-rose-400/70 uppercase font-semibold">Expirado/Perdido</div>
                  <div className="text-lg font-bold text-rose-400">R$ {saldoExpirado.toFixed(2).replace('.', ',')}</div>
                </div>
              </div>
            </div>
          </div>

          {/* BLOCO IA: Dossiê Tático */}
          <AiDossier clientId={client.id} initialDossier={client.preferences} />
          
        </div>

        {/* COLUNA DIREITA: Ledgers e Compras Frias */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* TABELA: Cashback Ledger */}
          <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
            <div className="p-5 border-b border-border bg-muted/20 flex justify-between items-center">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Timer className="text-primary" size={18} /> Extrato de Cashback (Ledger)
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-muted-foreground uppercase bg-muted/50">
                  <tr>
                    <th className="px-5 py-3">Status</th>
                    <th className="px-5 py-3">Gerado Em</th>
                    <th className="px-5 py-3">Válido Até</th>
                    <th className="px-5 py-3 text-right">Valor Geração</th>
                    <th className="px-5 py-3 text-right">Saldo Atual</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {ledger.length === 0 ? (
                    <tr><td colSpan={5} className="px-5 py-8 text-center text-muted-foreground">Nenhum tíquete financeiro gerado ainda.</td></tr>
                  ) : (
                    ledger.map(l => (
                      <tr key={l.id} className="hover:bg-muted/30">
                        <td className="px-5 py-3">
                          <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md border text-xs font-semibold ${getStatusColor(l.status)}`}>
                            {getStatusIcon(l.status)} {l.status}
                          </div>
                        </td>
                        <td className="px-5 py-3 text-muted-foreground">{new Date(l.created_at || '').toLocaleDateString('pt-BR')}</td>
                        <td className="px-5 py-3 text-muted-foreground">{l.expires_at ? new Date(l.expires_at).toLocaleDateString('pt-BR') : '-'}</td>
                        <td className="px-5 py-3 text-right text-muted-foreground">R$ {Number(l.original_amount).toFixed(2).replace('.', ',')}</td>
                        <td className="px-5 py-3 text-right font-medium text-foreground">R$ {Number(l.remaining_amount).toFixed(2).replace('.', ',')}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* TABELA: Histórico ERP (Frio) */}
          <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
            <div className="p-5 border-b border-border bg-muted/20">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <ShoppingBag className="text-muted-foreground" size={18} /> Histórico de Compras (Bling)
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-muted-foreground uppercase bg-muted/50">
                  <tr>
                    <th className="px-5 py-3">Pedido</th>
                    <th className="px-5 py-3">Data</th>
                    <th className="px-5 py-3 text-right">Desconto Usado</th>
                    <th className="px-5 py-3 text-right">Total Pago</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {extratoBling.length === 0 ? (
                    <tr><td colSpan={4} className="px-5 py-8 text-center text-muted-foreground">Nenhuma compra no ERP.</td></tr>
                  ) : (
                    extratoBling.sort((a,b) => new Date(b.data).getTime() - new Date(a.data).getTime()).map(compra => (
                      <tr key={compra.id} className="hover:bg-muted/30">
                        <td className="px-5 py-3 font-medium text-foreground">#{compra.numero}</td>
                        <td className="px-5 py-3 text-muted-foreground">{new Date(compra.data).toLocaleDateString('pt-BR')}</td>
                        <td className="px-5 py-3 text-right text-rose-400/80">R$ {Number(compra.desconto).toFixed(2).replace('.', ',')}</td>
                        <td className="px-5 py-3 text-right font-medium text-emerald-400">R$ {Number(compra.total).toFixed(2).replace('.', ',')}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
