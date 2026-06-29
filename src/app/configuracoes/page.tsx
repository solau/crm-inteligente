import { Settings, Link2, CheckCircle2, DownloadCloud } from 'lucide-react';
import Link from 'next/link';
import { SyncButton } from './SyncButton';
import { supabaseAdmin } from '@/lib/supabase';

export default async function Configuracoes() {
  const tenantId = 'd948b6cc-cc2c-4399-8525-02f17f281d38'; // Tenant de Teste
  
  // Busca no banco se a loja possui um token ativo
  const { data } = await supabaseAdmin
    .from('bling_credentials')
    .select('access_token')
    .eq('tenant_id', tenantId)
    .single();

  const isConnected = !!data?.access_token;
  
  
  // Constrói a URL oficial de autorização do Bling
  const blingClientId = process.env.BLING_CLIENT_ID;
  const blingAuthUrl = `https://www.bling.com.br/Api/v3/oauth/authorize?response_type=code&client_id=${blingClientId}&state=${tenantId}`;

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-16 max-w-4xl mx-auto">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pt-2">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground mb-1 flex items-center gap-3">
            <Settings size={28} className="text-muted-foreground" /> Configurações
          </h1>
          <p className="text-muted-foreground font-medium text-sm">Gerencie suas integrações e preferências do sistema.</p>
        </div>
      </div>

      {/* Integrações ERP */}
      <div className="pt-4">
        <h2 className="text-xl font-bold text-foreground mb-6">Integrações de Software</h2>

        <div className="rounded-xl border border-border bg-card text-card-foreground shadow-sm overflow-hidden">
          <div className="p-8 flex flex-col md:flex-row gap-8 items-center justify-between">
            <div className="flex items-center gap-6">
              <div className="w-16 h-16 bg-emerald-500/10 rounded-2xl flex items-center justify-center border border-emerald-500/20">
                <span className="font-extrabold text-emerald-500 text-xl tracking-tight">bling</span>
              </div>
              <div>
                <h3 className="font-bold text-foreground text-lg">Bling ERP (API v3)</h3>
                <p className="text-sm text-muted-foreground mt-1">Sincronize pedidos, produtos e calcule o LTV dos clientes.</p>
              </div>
            </div>

            <div className="w-full md:w-auto flex items-center gap-4">
              {isConnected ? (
                <div className="flex items-center gap-3 w-full md:w-auto">
                  <span className="inline-flex items-center gap-2 px-4 py-3 bg-emerald-500/10 text-emerald-500 rounded-lg font-bold text-sm border border-emerald-500/20">
                    <CheckCircle2 size={18} /> Conectado
                  </span>
                  <SyncButton />
                </div>
              ) : (
                <Link 
                  href={blingAuthUrl}
                  className="w-full md:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg font-bold text-sm transition-colors shadow-sm"
                >
                  <Link2 size={18} /> Conectar Conta
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}
