import { createClient } from '@supabase/supabase-js';
import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import CustomerProfilesClient, { ClientProfileData } from './CustomerProfilesClient';

export const revalidate = 0;

export default async function CustomerProfilesDashboardPage() {
  const session = await getSession();

  if (!session) {
    redirect('/');
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Busca todos os clientes com paginação completa
  const allClients: ClientProfileData[] = [];
  let from = 0;
  const step = 1000;
  let hasMore = true;

  while (hasMore) {
    const { data: batch, error } = await supabase
      .from('clients')
      .select('id, name, phone, last_purchase_date, total_spent, lead_score, cashback_balance, preferences')
      .order('total_spent', { ascending: false })
      .range(from, from + step - 1);

    if (error || !batch || batch.length === 0) break;
    allClients.push(...(batch as unknown as ClientProfileData[]));
    if (batch.length < step) break;
    from += step;
  }

  return <CustomerProfilesClient clients={allClients} />;
}
