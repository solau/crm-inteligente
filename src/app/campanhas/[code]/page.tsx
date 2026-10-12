import { CampaignRepository } from '@/lib/infrastructure/repositories/CampaignRepository';
import { EventOpportunityRepository } from '@/lib/infrastructure/repositories/EventOpportunityRepository';
import { CouponRepository } from '@/lib/infrastructure/repositories/CouponRepository';
import { QuizRepository } from '@/lib/infrastructure/repositories/QuizRepository';
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
  const quizRepo = new QuizRepository();

  const campaign = await campaignRepo.getCampaignByCode(campaignCode);
  if (!campaign) {
    redirect('/campanhas');
  }

  // Busca leads de eventos e kits
  const leads = await eventRepo.listOpportunities();

  // Busca cupons emitidos
  const coupons = await couponRepo.listCoupons(campaignCode);

  // Busca perguntas do banco de quiz
  const quizQuestions = await quizRepo.getAllBankQuestions(campaignCode);

  // Busca métricas detalhadas do quiz
  const quizMetrics = await quizRepo.getQuizMetrics(campaignCode);

  // Busca submissões recentes do quiz
  const quizSubmissions = await quizRepo.getQuizSubmissions(50);

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
      quizQuestions={quizQuestions}
      quizMetrics={quizMetrics}
      quizSubmissions={quizSubmissions}
      session={session}
    />
  );
}
