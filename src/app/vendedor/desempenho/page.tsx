// src/app/vendedor/desempenho/page.tsx
// Página de Desempenho do Vendedor Logado

import { createClient } from '@supabase/supabase-js';
import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import MeuDesempenhoClient, { RawSellerInteraction } from './MeuDesempenhoClient';

export const revalidate = 0; // Dados em tempo real

export default async function VendedorDesempenhoPage() {
  const session = await getSession();

  if (!session?.id) {
    redirect('/login');
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      global: {
        fetch: (url, options) => fetch(url, { ...options, cache: 'no-store' })
      }
    }
  );

  // Buscar perfil atualizado do vendedor
  let sellerName = session.name || 'Vendedor';
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('name')
    .eq('id', session.id)
    .single();

  if (profile?.name) {
    sellerName = profile.name;
  }

  // Buscar todas as interações do vendedor logado com paginação
  const sellerInteractions: RawSellerInteraction[] = [];
  let from = 0;
  const step = 1000;
  let hasMore = true;

  while (hasMore) {
    const { data: batch, error } = await supabase
      .from('client_interactions')
      .select(`
        id,
        campaign_type,
        user_id,
        created_at,
        sales_attribution (
          id,
          revenue,
          order_id,
          created_at
        )
      `)
      .eq('user_id', session.id)
      .order('created_at', { ascending: false })
      .range(from, from + step - 1);

    if (error || !batch || batch.length === 0) break;
    sellerInteractions.push(...(batch as unknown as RawSellerInteraction[]));
    if (batch.length < step) break;
    from += step;
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-7xl mx-auto px-4 md:px-8 pt-6">
        <MeuDesempenhoClient
          sellerName={sellerName}
          sellerId={session.id}
          interactions={sellerInteractions}
        />
      </div>
    </div>
  );
}
