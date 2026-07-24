import { createClient } from '@supabase/supabase-js';
import { Users, TrendingUp, Sparkles, ShieldCheck, Flame, Heart, AlertCircle, ArrowRight } from 'lucide-react';
import Link from 'next/link';

export const revalidate = 0;

export default async function CustomerProfilesDashboardPage() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: clients } = await supabase
    .from('clients')
    .select('id, name, phone, last_purchase_date, total_spent, lead_score')
    .order('total_spent', { ascending: false })
    .limit(200);

  const now = new Date();
  const totalClients = clients ? clients.length : 0;

  let vips: any[] = [];
  let fervendo: any[] = [];
  let recorrentes: any[] = [];
  let ausentes: any[] = [];

  (clients || []).forEach(c => {
    const ltv = Number(c.total_spent) || 0;
    let recencyDays = 999;
    if (c.last_purchase_date) {
      recencyDays = Math.max(0, Math.floor((now.getTime() - new Date(c.last_purchase_date).getTime()) / (1000 * 60 * 60 * 24)));
    }

    if (ltv >= 800) {
      vips.push({ ...c, recencyDays });
    } else if (recencyDays <= 7) {
      fervendo.push({ ...c, recencyDays });
    } else if (recencyDays <= 45) {
      recorrentes.push({ ...c, recencyDays });
    } else {
      ausentes.push({ ...c, recencyDays });
    }
  });

  const formatMoney = (val: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

  return (
    <div className="min-h-screen bg-black/90 p-4 md:p-8 text-white">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Header Tático */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white/5 border border-white/10 rounded-3xl p-6 backdrop-blur-xl">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="bg-primary/20 text-primary text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1.5 border border-primary/30">
                <Sparkles size={14} /> IA de Aprendizado & Perfilamento
              </span>
            </div>
            <h1 className="text-2xl md:text-3xl font-black tracking-tight">Inteligência de Perfis dos Clientes</h1>
            <p className="text-white/50 text-xs md:text-sm mt-1">
              Perfilamento preditivo em tempo real com aprendizado contínuo a cada novo pedido.
            </p>
          </div>

          <Link
            href="/dashboard/agentes"
            className="inline-flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white text-xs font-semibold px-4 py-2.5 rounded-xl border border-white/20 transition-all"
          >
            <span>Central de Agentes AI</span>
            <ArrowRight size={14} />
          </Link>
        </div>

        {/* 4 Cards Principais dos Perfis */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          
          {/* Card 1: VIPs */}
          <div className="bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-transparent border border-amber-500/20 rounded-3xl p-6 backdrop-blur-md relative overflow-hidden">
            <div className="flex justify-between items-start mb-4">
              <div className="w-10 h-10 rounded-2xl bg-amber-500/20 flex items-center justify-center text-amber-400">
                <ShieldCheck size={20} />
              </div>
              <span className="text-xs font-bold text-amber-400 bg-amber-400/10 px-2.5 py-1 rounded-full border border-amber-400/20">
                LTV &gt; R$ 800
              </span>
            </div>
            <p className="text-xs text-white/50 font-medium">Clientes VIPs (Leais)</p>
            <h3 className="text-3xl font-black text-amber-400 mt-1">{vips.length}</h3>
            <p className="text-xs text-white/40 mt-3 border-t border-amber-500/10 pt-3">
              Média LTV: {formatMoney(vips.reduce((acc, c) => acc + (Number(c.total_spent) || 0), 0) / (vips.length || 1))}
            </p>
          </div>

          {/* Card 2: Recém-Compradores Fervendo */}
          <div className="bg-gradient-to-br from-emerald-500/10 via-emerald-500/5 to-transparent border border-emerald-500/20 rounded-3xl p-6 backdrop-blur-md relative overflow-hidden">
            <div className="flex justify-between items-start mb-4">
              <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 flex items-center justify-center text-emerald-400">
                <Flame size={20} />
              </div>
              <span className="text-xs font-bold text-emerald-400 bg-emerald-400/10 px-2.5 py-1 rounded-full border border-emerald-400/20">
                Compra &lt;= 7d
              </span>
            </div>
            <p className="text-xs text-white/50 font-medium">Recém-Compradores (Fervendo)</p>
            <h3 className="text-3xl font-black text-emerald-400 mt-1">{fervendo.length}</h3>
            <p className="text-xs text-white/40 mt-3 border-t border-emerald-500/10 pt-3">
              Engajamento Máximo / Pós-Venda Ativo
            </p>
          </div>

          {/* Card 3: Recorrentes em Crescimento */}
          <div className="bg-gradient-to-br from-sky-500/10 via-sky-500/5 to-transparent border border-sky-500/20 rounded-3xl p-6 backdrop-blur-md relative overflow-hidden">
            <div className="flex justify-between items-start mb-4">
              <div className="w-10 h-10 rounded-2xl bg-sky-500/20 flex items-center justify-center text-sky-400">
                <Heart size={20} />
              </div>
              <span className="text-xs font-bold text-sky-400 bg-sky-400/10 px-2.5 py-1 rounded-full border border-sky-400/20">
                8d a 45d
              </span>
            </div>
            <p className="text-xs text-white/50 font-medium">Recorrentes em Crescimento</p>
            <h3 className="text-3xl font-black text-sky-400 mt-1">{recorrentes.length}</h3>
            <p className="text-xs text-white/40 mt-3 border-t border-sky-500/10 pt-3">
              Frequência Regular de Compras
            </p>
          </div>

          {/* Card 4: Ausentes */}
          <div className="bg-gradient-to-br from-rose-500/10 via-rose-500/5 to-transparent border border-rose-500/20 rounded-3xl p-6 backdrop-blur-md relative overflow-hidden">
            <div className="flex justify-between items-start mb-4">
              <div className="w-10 h-10 rounded-2xl bg-rose-500/20 flex items-center justify-center text-rose-400">
                <AlertCircle size={20} />
              </div>
              <span className="text-xs font-bold text-rose-400 bg-rose-400/10 px-2.5 py-1 rounded-full border border-rose-400/20">
                &gt; 45d Sem Comprar
              </span>
            </div>
            <p className="text-xs text-white/50 font-medium">Ausentes (Risco de Churn)</p>
            <h3 className="text-3xl font-black text-rose-400 mt-1">{ausentes.length}</h3>
            <p className="text-xs text-white/40 mt-3 border-t border-rose-500/10 pt-3">
              Requer Régua de Reativação
            </p>
          </div>

        </div>

        {/* Tabela de Amostra dos Clientes Recentes Fervendo */}
        <div className="bg-white/5 border border-white/10 rounded-3xl p-6 backdrop-blur-xl">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Flame className="w-5 h-5 text-emerald-400" />
                Clientes Compradores Fervendo (Compras Recentes)
              </h2>
              <p className="text-xs text-white/50 mt-0.5">
                Clientes que realizaram compras recentemente e possuem Lead Score elevado para acompanhamento.
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-white/10 text-white/40 uppercase tracking-wider">
                  <th className="pb-3">Cliente</th>
                  <th className="pb-3">Telefone</th>
                  <th className="pb-3">Última Compra</th>
                  <th className="pb-3">Total Gasto (LTV)</th>
                  <th className="pb-3">Lead Score RFM</th>
                  <th className="pb-3 text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {fervendo.slice(0, 10).map((c, idx) => (
                  <tr key={idx} className="hover:bg-white/5 transition-colors">
                    <td className="py-3.5 font-semibold text-white/90">{c.name}</td>
                    <td className="py-3.5 text-white/60">{c.phone}</td>
                    <td className="py-3.5 text-emerald-400 font-medium">
                      {c.last_purchase_date ? new Date(c.last_purchase_date).toLocaleDateString('pt-BR') : 'Hoje'}
                    </td>
                    <td className="py-3.5 font-bold text-white/90">{formatMoney(Number(c.total_spent) || 0)}</td>
                    <td className="py-3.5">
                      <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold px-2.5 py-1 rounded-md">
                        {c.lead_score} / 100
                      </span>
                    </td>
                    <td className="py-3.5 text-right">
                      <Link
                        href={`/clientes/${c.id}`}
                        className="text-xs text-primary hover:underline font-semibold"
                      >
                        Ver Dossiê IA &rarr;
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}
