import { NextResponse } from 'next/server';
import { QuizRepository } from '@/lib/infrastructure/repositories/QuizRepository';
import { corsHeaders, handleCorsPreflight } from '@/lib/utils/cors';
import { 
  checkRateLimit, 
  isBotSubmission, 
  sanitizeString, 
  generateParticipantToken 
} from '@/lib/utils/security';

export async function OPTIONS(request: Request) {
  return handleCorsPreflight(request);
}

export async function POST(request: Request) {
  const origin = request.headers.get('origin');
  const clientIp = request.headers.get('x-forwarded-for')?.split(',')[0] || request.headers.get('x-real-ip') || 'unknown';

  // 1. Rate Limiting por IP (ajustado para 60 requisições por minuto para suportar o tablet compartilhado no estande)
  const rl = checkRateLimit(`quiz:${clientIp}`, 60, 60000);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: `Limite de tentativas excedido. Aguarde ${rl.resetInSec} segundos para submeter novamente.` },
      { status: 429, headers: corsHeaders(origin) }
    );
  }

  try {
    const body = await request.json();

    // 2. Proteção Anti-Bot (Honeypot)
    if (isBotSubmission(body)) {
      return NextResponse.json(
        { error: 'Submissão automatizada bloqueada pelo sistema anti-bot.' },
        { status: 400, headers: corsHeaders(origin) }
      );
    }

    if (!body.participant_name || !body.participant_phone || !body.answers) {
      return NextResponse.json(
        { error: 'Parâmetros obrigatórios ausentes: participant_name, participant_phone e answers.' },
        { status: 400, headers: corsHeaders(origin) }
      );
    }

    const cleanPhone = body.participant_phone.replace(/\D/g, '');
    if (cleanPhone.length < 10) {
      return NextResponse.json(
        { error: 'Telefone inválido para identificação do participante.' },
        { status: 400, headers: corsHeaders(origin) }
      );
    }

    // Rate Limiting adicional por número de telefone (evita flooding no mesmo celular)
    const rlPhone = checkRateLimit(`quiz_phone:${cleanPhone}`, 5, 60000);
    if (!rlPhone.allowed) {
      return NextResponse.json(
        { error: 'Muitas tentativas para este número de telefone. Aguarde um minuto.' },
        { status: 429, headers: corsHeaders(origin) }
      );
    }

    const userAgent = request.headers.get('user-agent') || 'unknown';

    // 3. Sanitização dos dados
    const participantName = sanitizeString(body.participant_name, 100);
    const participantEmail = body.participant_email ? sanitizeString(body.participant_email, 120).toLowerCase() : null;
    const companyName = body.company_name ? sanitizeString(body.company_name, 120) : null;
    const originChannel = body.origin_channel ? sanitizeString(body.origin_channel, 50) : 'BPE26_QUIZ_STAND';

    const repo = new QuizRepository();
    const result = await repo.submitQuiz({
      participant_name: participantName,
      participant_phone: cleanPhone,
      participant_email: participantEmail,
      company_name: companyName,
      answers: body.answers,
      campaign_code: 'BPE26',
      origin_channel: originChannel,
      ip_address: clientIp,
      user_agent: userAgent
    });

    // 4. Gera token criptográfico para consulta segura de benefícios
    const participantToken = generateParticipantToken(cleanPhone, 'BPE26');

    return NextResponse.json(
      {
        success: true,
        data: {
          score: result.score,
          total_questions: result.total_questions,
          discount_percent: result.discount_percent,
          coupon_code: result.coupon_code,
          is_new_coupon: result.is_new_coupon,
          message: result.message,
          participant_token: participantToken
        }
      },
      { headers: corsHeaders(origin) }
    );
  } catch (error: any) {
    console.error('Erro na rota /api/bpe26/quiz/responder:', error);
    return NextResponse.json(
      { error: error.message || 'Falha ao processar respostas do Quiz.' },
      { status: 500, headers: corsHeaders(origin) }
    );
  }
}
