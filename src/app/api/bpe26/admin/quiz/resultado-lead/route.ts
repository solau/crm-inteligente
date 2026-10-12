import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getSession } from '@/lib/auth';

export async function GET(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const phone = searchParams.get('phone')?.replace(/\D/g, '');

    if (!phone) {
      return NextResponse.json({ error: 'Telefone obrigatório' }, { status: 400 });
    }

    // Busca a submissão mais recente do quiz para este telefone
    const { data: submission, error: subErr } = await supabaseAdmin
      .from('quiz_submissions')
      .select('*')
      .eq('participant_phone', phone)
      .order('completed_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!submission) {
      // Verifica se há pelo menos um cupom emitido para este telefone
      const { data: coupon } = await supabaseAdmin
        .from('coupons')
        .select('*')
        .ilike('restrictions', `%${phone}%`)
        .maybeSingle();

      if (coupon) {
        return NextResponse.json({
          has_participated: true,
          submission: null,
          coupon: {
            code: coupon.code,
            discount_percent: coupon.discount_percent,
            status: coupon.status,
            issued_at: coupon.issued_at,
            expires_at: coupon.expires_at,
            restrictions: coupon.restrictions
          }
        });
      }

      return NextResponse.json({ has_participated: false });
    }

    // Busca cupom associado à submissão ou ao código
    let couponData = null;
    if (submission.coupon_code) {
      const { data: c } = await supabaseAdmin
        .from('coupons')
        .select('*')
        .eq('code', submission.coupon_code)
        .maybeSingle();
      if (c) couponData = c;
    }

    return NextResponse.json({
      has_participated: true,
      submission: {
        id: submission.id,
        participant_name: submission.participant_name,
        participant_phone: submission.participant_phone,
        participant_email: submission.participant_email,
        company_name: submission.company_name,
        score: submission.score,
        total_questions: 5,
        discount_percent: submission.discount_percent,
        coupon_code: submission.coupon_code,
        origin_channel: submission.origin_channel || 'BPE26_QUIZ_STAND',
        quiz_version: submission.quiz_version || 1,
        answers: submission.answers || {},
        completed_at: submission.completed_at || submission.created_at
      },
      coupon: couponData ? {
        code: couponData.code,
        discount_percent: couponData.discount_percent,
        status: couponData.status,
        issued_at: couponData.issued_at,
        expires_at: couponData.expires_at,
        restrictions: couponData.restrictions
      } : null
    });
  } catch (error: any) {
    console.error('Erro ao consultar resultado do quiz do lead:', error);
    return NextResponse.json(
      { error: error.message || 'Falha ao buscar resultado do quiz do lead' },
      { status: 500 }
    );
  }
}
