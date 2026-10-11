import { CampaignRepository } from '@/lib/infrastructure/repositories/CampaignRepository';
import { EventOpportunityRepository } from '@/lib/infrastructure/repositories/EventOpportunityRepository';
import { CouponRepository } from '@/lib/infrastructure/repositories/CouponRepository';
import { CampaignDashboardClient } from './CampaignDashboardClient';
import { getSession } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { redirect } from 'next/navigation';

export const revalidate = 0;

export default async function CampaignPage({ params }: { params: Promise<{ code: string }> }) {
  const resolvedParams = await params;
  const campaignCode = resolvedParams.code.toUpperCase();
  const session = await getSession();

  const campaignRepo = new CampaignRepository();
  const eventRepo = new EventOpportunityRepository();
  const couponRepo = new CouponRepository();

  const campaign = await campaignRepo.getCampaignByCode(campaignCode);
  if (!campaign) {
    redirect('/campanhas');
  }

  // Busca leads de eventos
  const leads = await eventRepo.listOpportunities();

  // Busca cupons emitidos
  const coupons = await couponRepo.listCoupons(campaignCode);

  // Busca contagem de quiz submissions
  let startedCount = leads.length;
  let completedCount = coupons.length;

  try {
    const { count: totalSubmissions } = await supabaseAdmin
      .from('quiz_submissions')
      .select('*', { count: 'exact', head: true });

    if (totalSubmissions) {
      startedCount = Math.max(startedCount, totalSubmissions);
      completedCount = Math.max(completedCount, totalSubmissions);
    }
  } catch (e) {
    // Ignora se tabela ainda não criada
  }

  return (
    <CampaignDashboardClient
      campaign={campaign}
      leads={leads}
      coupons={coupons}
      quizSubmissionsCount={{ started: startedCount, completed: completedCount }}
      session={session}
    />
  );
}
