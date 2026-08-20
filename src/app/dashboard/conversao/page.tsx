import { createClient } from '@supabase/supabase-js';
import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import ConversionDashboardClient, { RawInteraction } from './ConversionDashboardClient';

export const revalidate = 0;

export default async function ConversaoDashboardPage() {
  const session = await getSession();

  // Apenas administradores têm acesso ao dashboard financeiro/gerencial
  if (!session || session.role !== 'ADMIN') {
    redirect('/');
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Busca todas as interações do histórico com paginação
  const allInteractions: RawInteraction[] = [];
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
        user_profiles ( name ),
        created_at,
        sales_attribution (
          id,
          revenue,
          order_id,
          created_at
        )
      `)
      .order('created_at', { ascending: false })
      .range(from, from + step - 1);

    if (error || !batch || batch.length === 0) break;
    allInteractions.push(...(batch as unknown as RawInteraction[]));
    if (batch.length < step) break;
    from += step;
  }

  return <ConversionDashboardClient interactions={allInteractions} />;
}
