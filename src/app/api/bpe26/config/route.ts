import { NextResponse } from 'next/server';
import { CampaignRepository } from '@/lib/infrastructure/repositories/CampaignRepository';
import { corsHeaders, handleCorsPreflight } from '@/lib/utils/cors';

export async function OPTIONS(request: Request) {
  return handleCorsPreflight(request);
}

export async function GET(request: Request) {
  const origin = request.headers.get('origin');
  try {
    const repo = new CampaignRepository();
    const campaign = await repo.getCampaignByCode('BPE26');

    const publicConfig = {
      campaign_code: 'BPE26',
      campaign_name: campaign?.name || 'Desafio Alpha Bull — BPE26',
      description: campaign?.description || 'Captação de confraternizações empresariais BPE 2026',
      discount_rules: {
        "0_acertos": "0% OFF",
        "1_acerto": "0% OFF",
        "2_acertos": "5% OFF",
        "3_acertos": "8% OFF",
        "4_acertos": "15% OFF",
        "5_acertos": "20% OFF"
      },
      product_eligibility: 'Válido exclusivamente para compras de produtos elegíveis (cortes nobres) da Alpha Bull. Não aplicável a serviços de confraternização.',
      promotion_exemption: {
        name: '5 Participantes Isentos',
        is_active: false,
        status: 'Aguardando validação jurídica e autorização aplicável',
        min_guests: 15,
        exempt_participants: 5
      },
      event_types_supported: ['Confraternização Empresarial', 'Evento de Fim de Ano', 'Almoço/Jantar Corporativo'],
      regulations: campaign?.regulations || 'Uso único, individual e intransferível. Validade de 30 dias após emissão.'
    };

    return NextResponse.json(
      { success: true, data: publicConfig },
      { headers: corsHeaders(origin) }
    );
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Falha ao carregar configurações públicas da campanha.' },
      { status: 500, headers: corsHeaders(origin) }
    );
  }
}
