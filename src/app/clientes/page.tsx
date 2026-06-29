import { supabaseAdmin } from '@/lib/supabase';
import Link from 'next/link';
import { Search, User, Phone, ChevronRight, Clock, AlertCircle, RefreshCw, ChevronLeft } from 'lucide-react';

export default async function ClientesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; filter?: string; p?: string }>;
}) {
  const resolvedParams = await searchParams;
  const q = resolvedParams?.q || '';
  const filter = resolvedParams?.filter || 'expirando'; // Default é expirando agora
  const currentPage = Math.max(1, parseInt(resolvedParams?.p || '1', 10));
  const ITEMS_PER_PAGE = 20;
  const tenantId = 'd948b6cc-cc2c-4399-8525-02f17f281d38';

  // 1. Contagem Total (para a Paginação UI)
  let countQuery = supabaseAdmin
    .from('vw_client_radar')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', tenantId);

  // Filtros aplicados na contagem
  if (q) {
    countQuery = countQuery.or(`name.ilike.%${q}%,phone.ilike.%${q}%`);
  }
  
  if (filter === 'expirando') {
    countQuery = countQuery.eq('has_active', true);
  } else if (filter === 'expirados') {
    const date45DaysAgo = new Date(Date.now() - 45 * 86400000).toISOString();
    const date90DaysAgo = new Date(Date.now() - 90 * 86400000).toISOString();
    countQuery = countQuery
      .eq('has_expired', true)
      .lt('last_purchase_date', date45DaysAgo)
      .gte('last_purchase_date', date90DaysAgo);
  } else if (filter === 'reativar') {
    const date90DaysAgo = new Date(Date.now() - 90 * 86400000).toISOString();
    countQuery = countQuery.lt('last_purchase_date', date90DaysAgo);
  }

  const { count: totalItemsResult } = await countQuery;
  const totalItems = totalItemsResult || 0;
  const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE) || 1;

  // 2. Busca Paginada de Clientes no Banco (SQL Puro)
  let query = supabaseAdmin
    .from('vw_client_radar')
    .select('*')
    .eq('tenant_id', tenantId);

  // Mesmos filtros
  if (q) {
    query = query.or(`name.ilike.%${q}%,phone.ilike.%${q}%`);
  }

  if (filter === 'expirando') {
    query = query.eq('has_active', true).order('next_expire_date', { ascending: true, nullsFirst: false });
  } else if (filter === 'expirados') {
    const date45DaysAgo = new Date(Date.now() - 45 * 86400000).toISOString();
    const date90DaysAgo = new Date(Date.now() - 90 * 86400000).toISOString();
    query = query
      .eq('has_expired', true)
      .lt('last_purchase_date', date45DaysAgo)
      .gte('last_purchase_date', date90DaysAgo)
      .order('last_expired_date', { ascending: false, nullsFirst: false });
  } else if (filter === 'reativar') {
    const date90DaysAgo = new Date(Date.now() - 90 * 86400000).toISOString();
    query = query
      .lt('last_purchase_date', date90DaysAgo)
      .order('last_purchase_date', { ascending: true, nullsFirst: false }); // Menor data = mais tempo sem comprar
  } else {
    // Todos
    query = query.order('cashback_balance', { ascending: false, nullsFirst: false });
  }

  // Paginação SQL nativa
  const from = (currentPage - 1) * ITEMS_PER_PAGE;
  const to = from + ITEMS_PER_PAGE - 1;
  query = query.range(from, to);

  const { data: rawClientes, error } = await query;

  // Processamento apenas de campos derivativos dinâmicos (dias) para a página atual
  const now = new Date();
  
  const pagedClientes = (rawClientes || []).map((cliente: any) => {
    let daysToNextExpire = null;
    if (cliente.next_expire_date) {
      daysToNextExpire = Math.ceil((new Date(cliente.next_expire_date).getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    }

    let daysSinceExpired = null;
    if (cliente.last_expired_date) {
      daysSinceExpired = Math.ceil((now.getTime() - new Date(cliente.last_expired_date).getTime()) / (1000 * 60 * 60 * 24));
    }

    let daysSincePurchase = null;
    if (cliente.last_purchase_date) {
      daysSincePurchase = Math.ceil((now.getTime() - new Date(cliente.last_purchase_date).getTime()) / (1000 * 60 * 60 * 24));
    }

    return {
      ...cliente,
      daysToNextExpire,
      daysSinceExpired,
      daysSincePurchase,
      totalExpiredAmount: cliente.total_expired_amount
    };
  });

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-12 max-w-5xl mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Clientes</h1>
          <p className="text-muted-foreground mt-1">Busque e acesse o dossiê 360º de seus contatos.</p>
        </div>
      </div>

      {/* Filtros e Busca */}
      <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center bg-card/50 backdrop-blur-xl border border-border/50 rounded-2xl p-4 shadow-sm">
        <form className="relative flex w-full lg:max-w-xs items-center">
          <Search className="absolute left-3 text-muted-foreground" size={18} />
          <input
            type="text"
            name="q"
            defaultValue={q}
            placeholder="Buscar..."
            className="w-full pl-10 pr-4 py-2 bg-background border border-border/50 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
          />
          <input type="hidden" name="filter" value={filter} />
          <button type="submit" className="ml-2 px-3 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-lg hover:bg-primary/90 transition-colors shadow-glow-sm">
            Buscar
          </button>
        </form>

        <div className="flex flex-wrap bg-muted/50 p-1 rounded-lg w-full lg:w-auto">
          <Link href={`/clientes?q=${q}&filter=todos`} className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${filter === 'todos' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
            Todos
          </Link>
          <Link href={`/clientes?q=${q}&filter=expirando`} className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${filter === 'expirando' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
            A Expirar
          </Link>
          <Link href={`/clientes?q=${q}&filter=expirados`} className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${filter === 'expirados' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
            Expirados
          </Link>
          <Link href={`/clientes?q=${q}&filter=reativar`} className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${filter === 'reativar' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
            Reativar (+90d)
          </Link>
        </div>
      </div>

      {/* Lista de Clientes */}
      <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-muted-foreground uppercase bg-muted/50">
              <tr>
                <th className="px-6 py-4 font-medium">Cliente</th>
                <th className="px-6 py-4 font-medium">Telefone</th>
                <th className="px-6 py-4 font-medium text-center">Score</th>
                <th className="px-6 py-4 font-medium text-right">Métricas</th>
                <th className="px-6 py-4 font-medium text-center">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {pagedClientes.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-muted-foreground">
                    Nenhum cliente encontrado.
                  </td>
                </tr>
              ) : (
                pagedClientes.map((cliente) => (
                  <tr key={cliente.id} className="hover:bg-muted/30 transition-colors group">
                    <td className="px-6 py-4 whitespace-nowrap font-medium text-foreground flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary border border-primary/20">
                        <User size={14} />
                      </div>
                      {cliente.name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Phone size={12} /> {cliente.phone}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <div className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-primary/10 text-primary border border-primary/20">
                        {cliente.lead_score} pts
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      {filter !== 'reativar' && filter !== 'expirados' && (
                        <div className="font-semibold text-emerald-400 mb-1">
                          R$ {Number(cliente.cashback_balance || 0).toFixed(2).replace('.', ',')}
                        </div>
                      )}
                      {filter === 'expirados' && (
                        <div className="font-semibold text-destructive mb-1">
                          - R$ {Number(cliente.totalExpiredAmount || 0).toFixed(2).replace('.', ',')} (Perdidos)
                        </div>
                      )}
                      {cliente.daysToNextExpire !== null && (filter === 'expirando' || filter === 'todos') && (
                        <div className="text-[10px] text-amber-500 font-medium flex items-center justify-end gap-1">
                          <Clock size={10} /> expira em {cliente.daysToNextExpire} dias
                        </div>
                      )}
                      {cliente.daysSinceExpired !== null && filter === 'expirados' && (
                        <div className="text-[10px] text-destructive font-medium flex items-center justify-end gap-1">
                          <AlertCircle size={10} /> expirou há {cliente.daysSinceExpired} dias
                        </div>
                      )}
                      {cliente.daysSincePurchase !== null && filter === 'reativar' && (
                        <div className="text-[10px] text-pink-500 font-medium flex items-center justify-end gap-1">
                          <RefreshCw size={10} /> não compra há {cliente.daysSincePurchase} dias
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <Link 
                        href={`/clientes/${cliente.id}`}
                        className="inline-flex items-center justify-center p-2 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                      >
                        <ChevronRight size={18} />
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        
        {/* Paginação */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-border bg-muted/20">
            <div className="text-sm text-muted-foreground">
              Mostrando <span className="font-medium text-foreground">{(currentPage - 1) * ITEMS_PER_PAGE + 1}</span> a <span className="font-medium text-foreground">{Math.min(currentPage * ITEMS_PER_PAGE, totalItems)}</span> de <span className="font-medium text-foreground">{totalItems}</span>
            </div>
            <div className="flex gap-2">
              <Link
                href={`/clientes?q=${q}&filter=${filter}&p=${currentPage - 1}`}
                className={`p-2 rounded-lg border border-border flex items-center justify-center transition-colors ${currentPage === 1 ? 'pointer-events-none opacity-50' : 'hover:bg-muted text-foreground'}`}
              >
                <ChevronLeft size={16} />
              </Link>
              <div className="flex items-center justify-center px-4 py-2 text-sm font-medium border border-border rounded-lg bg-background">
                Página {currentPage} de {totalPages}
              </div>
              <Link
                href={`/clientes?q=${q}&filter=${filter}&p=${currentPage + 1}`}
                className={`p-2 rounded-lg border border-border flex items-center justify-center transition-colors ${currentPage === totalPages ? 'pointer-events-none opacity-50' : 'hover:bg-muted text-foreground'}`}
              >
                <ChevronRight size={16} />
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
