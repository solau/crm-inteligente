import { NextResponse } from 'next/server';
import { EventOpportunityRepository } from '@/lib/infrastructure/repositories/EventOpportunityRepository';
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
  const rl = checkRateLimit(`participante:${clientIp}`, 60, 60000);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: `Muitas inscrições vindas deste dispositivo. Aguarde ${rl.resetInSec} segundos para tentar novamente.` },
      { status: 429, headers: corsHeaders(origin) }
    );
  }

  try {
    const body = await request.json();

    // 2. Proteção Anti-Bot (Honeypot)
    if (isBotSubmission(body)) {
      return NextResponse.json(
        { error: 'Cadastro automatizado rejeitado pelo sistema anti-bot.' },
        { status: 400, headers: corsHeaders(origin) }
      );
    }

    // 3. Normalização de campos com suporte a formatos snake_case e camelCase
    const rawContactName = body.contact_name || body.full_name || body.fullName || '';
    const rawCompanyName = body.company_name || body.company || '';
    const rawPhone = body.contact_phone || body.phone || body.whatsapp || '';
    const rawEmail = body.contact_email || body.email || '';
    const rawCategory = body.category || body.interest || body.primary_interest || '';
    const rawKnownBrand = body.already_knew_brand || body.known_brand || body.knownAlphaBull || '';
    const rawGuestsRange = body.guests_range || body.guestCount || body.estimated_guests || (body.expected_guests ? String(body.expected_guests) : '');
    const rawInstagram = body.instagram || '';
    const rawBirthDate = body.birth_date || body.birthDate || null;
    const consentMarketing = Boolean(body.consent_marketing ?? body.acceptMarketing ?? false);
    const consentCommercial = body.consent_commercial !== false && body.consent_privacy !== false && body.acceptPrivacy !== false;

    // 4. Validação rigorosa de campos obrigatórios
    if (!rawContactName.trim() || !rawCompanyName.trim() || !rawPhone.trim() || !rawEmail.trim()) {
      return NextResponse.json(
        { error: 'Campos obrigatórios ausentes: Nome completo, Nome da empresa, WhatsApp e E-mail são mandatórios.' },
        { status: 400, headers: corsHeaders(origin) }
      );
    }

    // Validação de telefone (DDD + número)
    const cleanPhone = rawPhone.replace(/\D/g, '');
    if (cleanPhone.length < 10) {
      return NextResponse.json(
        { error: 'Número de WhatsApp inválido. Informe DDD + número com pelo menos 10 dígitos.' },
        { status: 400, headers: corsHeaders(origin) }
      );
    }

    // Validação de e-mail básico
    const cleanEmail = rawEmail.trim().toLowerCase();
    if (!cleanEmail.includes('@') || !cleanEmail.includes('.')) {
      return NextResponse.json(
        { error: 'E-mail corporativo ou pessoal em formato inválido.' },
        { status: 400, headers: corsHeaders(origin) }
      );
    }

    // Validação de categoria (KIT ou EVENTO)
    const normalizedCategory = rawCategory.toString().toLowerCase().includes('kit') ? 'KIT' : 
                              (rawCategory.toString().toLowerCase().includes('event') ? 'EVENTO' : null);

    if (!normalizedCategory) {
      return NextResponse.json(
        { error: 'Categoria inválida. Selecione obrigatoriamente entre Kit de churrasco ou Eventos corporativos.' },
        { status: 400, headers: corsHeaders(origin) }
      );
    }

    // Validação de conhecimento prévio da Alpha Bull
    if (!rawKnownBrand.toString().trim()) {
      return NextResponse.json(
        { error: 'Por favor, informe se você já conhecia a Alpha Bull.' },
        { status: 400, headers: corsHeaders(origin) }
      );
    }

    // Validação de quantidade/faixa de pessoas
    if (!rawGuestsRange.toString().trim()) {
      return NextResponse.json(
        { error: `Por favor, selecione a quantidade prevista de ${normalizedCategory === 'KIT' ? 'participantes do seu churrasco' : 'convidados do seu evento'}.` },
        { status: 400, headers: corsHeaders(origin) }
      );
    }

    // Rate limiting por telefone para evitar spam
    const rlPhone = checkRateLimit(`participante_phone:${cleanPhone}`, 5, 60000);
    if (!rlPhone.allowed) {
      return NextResponse.json(
        { error: 'Muitas tentativas para este número de telefone. Aguarde um minuto.' },
        { status: 429, headers: corsHeaders(origin) }
      );
    }

    // 5. Sanitização rigorosa das entradas
    const companyName = sanitizeString(rawCompanyName, 150);
    const contactName = sanitizeString(rawContactName, 120);
    const contactEmail = sanitizeString(cleanEmail, 120);
    const contactRole = body.contact_role ? sanitizeString(body.contact_role, 80) : null;
    const segment = body.segment ? sanitizeString(body.segment, 80) : null;
    const city = body.city ? sanitizeString(body.city, 80) : null;
    const location = body.location ? sanitizeString(body.location, 150) : null;
    const notes = body.notes ? sanitizeString(body.notes, 500) : null;
    const instagram = rawInstagram ? sanitizeString(rawInstagram.trim().replace(/^@+/, '@'), 80) : null;
    const birthDate = rawBirthDate ? sanitizeString(rawBirthDate, 30) : null;
    const alreadyKnewBrand = sanitizeString(rawKnownBrand.toString(), 60);
    const guestsRange = sanitizeString(rawGuestsRange.toString(), 60);

    // 6. Chamada ao repositório de oportunidades e leads
    const repo = new EventOpportunityRepository();
    const result = await repo.createOrUpdateEventOpportunity({
      company_name: companyName,
      contact_name: contactName,
      contact_phone: cleanPhone,
      contact_email: contactEmail,
      contact_role: contactRole,
      segment,
      city,
      category: normalizedCategory,
      guests_range: guestsRange,
      instagram,
      birth_date: birthDate,
      already_knew_brand: alreadyKnewBrand,
      consent_marketing: consentMarketing,
      consent_commercial: consentCommercial,
      expected_guests: body.expected_guests ? Math.min(10000, Math.max(1, Number(body.expected_guests))) : null,
      event_date: body.event_date ? sanitizeString(body.event_date, 20) : null,
      is_exact_date: Boolean(body.is_exact_date),
      location,
      event_type: normalizedCategory === 'EVENTO' ? 'confraternizacao_empresarial' : 'kit_churrasco',
      notes,
      estimated_value: body.estimated_value ? Math.max(0, Number(body.estimated_value)) : undefined,
      campaign_code: 'BPE26',
      origin_channel: (() => {
        const raw = (body.origin_channel || body.origin || '').toString().toLowerCase();
        if (raw.includes('quiz') || raw.includes('stand') || raw.includes('estande')) {
          return 'BPE26_QUIZ_STAND';
        }
        if (raw.includes('qr') || body.origin_channel === 'QR Code') {
          return 'BPE26_QRCODE';
        }
        return body.origin_channel ? sanitizeString(body.origin_channel, 50) : 'BPE26_QRCODE';
      })(),
      origin_site: 'ChurrascoSalvador.com',
      utm_source: body.utm_source ? sanitizeString(body.utm_source, 50) : null,
      utm_medium: body.utm_medium ? sanitizeString(body.utm_medium, 50) : null,
      utm_campaign: body.utm_campaign ? sanitizeString(body.utm_campaign, 50) : 'BPE26',
      utm_content: body.utm_content ? sanitizeString(body.utm_content, 50) : null,
      utm_term: body.utm_term ? sanitizeString(body.utm_term, 50) : null,
      privacy_terms_version: body.privacy_terms_version ? sanitizeString(body.privacy_terms_version, 20) : 'v1.0'
    });

    // 7. Token HMAC de segurança para autenticar o participante sem expor número de telefone
    const participantToken = generateParticipantToken(cleanPhone, 'BPE26');

    // 8. Resposta customizada por categoria comercial
    if (normalizedCategory === 'KIT') {
      return NextResponse.json(
        {
          success: true,
          category: 'KIT',
          message: result.isDuplicate
            ? 'Cadastro atualizado com sucesso! Seu interesse em kits de churrasco foi registrado no CRM.'
            : 'Participante cadastrado com sucesso! Interesse em kits de carnes nobres registrado.',
          lead: {
            client_id: result.clientId,
            company_name: companyName,
            contact_name: contactName,
            category: 'KIT',
            guests_range: guestsRange
          },
          participant_token: participantToken
        },
        { headers: corsHeaders(origin) }
      );
    }

    return NextResponse.json(
      {
        success: true,
        category: 'EVENTO',
        message: result.isDuplicate 
          ? 'Inscrição de evento corporativo atualizada com sucesso!' 
          : 'Participante e oportunidade de evento corporativo cadastrados com sucesso!',
        lead: {
          client_id: result.clientId,
          opportunity_id: result.opportunity?.id,
          company_name: result.opportunity?.company_name || companyName,
          contact_name: result.opportunity?.contact_name || contactName,
          category: 'EVENTO',
          priority: result.opportunity?.priority,
          stage: result.opportunity?.stage,
          guests_range: guestsRange
        },
        participant_token: participantToken
      },
      { headers: corsHeaders(origin) }
    );
  } catch (error: any) {
    console.error('Erro na rota /api/bpe26/participante:', error);
    return NextResponse.json(
      { error: error.message || 'Falha ao processar cadastro do participante no CRM.' },
      { status: 500, headers: corsHeaders(origin) }
    );
  }
}
