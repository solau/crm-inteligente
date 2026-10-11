import { NextResponse } from 'next/server';
import { EventOpportunityRepository } from '@/lib/infrastructure/repositories/EventOpportunityRepository';
import { corsHeaders, handleCorsPreflight } from '@/lib/utils/cors';
import { checkRateLimit, isBotSubmission } from '@/lib/utils/security';

export async function OPTIONS(request: Request) {
  return handleCorsPreflight(request);
}

export async function POST(request: Request) {
  const origin = request.headers.get('origin');
  const clientIp = request.headers.get('x-forwarded-for')?.split(',')[0] || request.headers.get('x-real-ip') || 'unknown';

  // Rate Limiting (máximo 5 cliques de orçamento por minuto por IP)
  const rl = checkRateLimit(`orcamento:${clientIp}`, 5, 60000);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: `Muitas solicitações. Aguarde ${rl.resetInSec} segundos.` },
      { status: 429, headers: corsHeaders(origin) }
    );
  }

  try {
    const body = await request.json();

    if (isBotSubmission(body)) {
      return NextResponse.json(
        { error: 'Solicitação bloqueada pelo sistema anti-bot.' },
        { status: 400, headers: corsHeaders(origin) }
      );
    }

    if (!body.phone && !body.opportunity_id) {
      return NextResponse.json(
        { error: 'Informe phone ou opportunity_id para registrar a solicitação de orçamento.' },
        { status: 400, headers: corsHeaders(origin) }
      );
    }

    const repo = new EventOpportunityRepository();

    if (body.opportunity_id) {
      await repo.updateStage(
        body.opportunity_id,
        'orcamento_solicitado',
        null,
        'Participante clicou no botão Solicitar Orçamento na landing page ChurrascoSalvador.com'
      );
    } else if (body.phone) {
      const cleanPhone = body.phone.replace(/\D/g, '');
      const opportunities = await repo.listOpportunities();
      const opp = opportunities.find(o => o.contact_phone.replace(/\D/g, '') === cleanPhone);
      if (opp) {
        await repo.updateStage(
          opp.id,
          'orcamento_solicitado',
          null,
          'Participante solicitou orçamento direto pelo botão da campanha ChurrascoSalvador.com'
        );
      }
    }

    return NextResponse.json(
      {
        success: true,
        message: 'Solicitação de orçamento registrada com sucesso no CRM Alpha Bull!'
      },
      { headers: corsHeaders(origin) }
    );
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Falha ao registrar solicitação de orçamento.' },
      { status: 500, headers: corsHeaders(origin) }
    );
  }
}
