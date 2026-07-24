import { NextResponse } from 'next/server';
import { InteractionRepository } from '@/lib/infrastructure/repositories/InteractionRepository';

export async function POST(request: Request) {
  try {
    const { tenant_id, client_id, campaign_type, user_id } = await request.json();

    if (!tenant_id || !client_id || !campaign_type) {
      return NextResponse.json({ error: 'Campos obrigatórios ausentes (tenant_id, client_id, campaign_type)' }, { status: 400 });
    }

    // Sanitiza o user_id: se não for UUID válido no Postgres, passa undefined para evitar violação de chave estrangeira
    const isUuid = user_id && typeof user_id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(user_id);
    const validUserId = isUuid ? user_id : undefined;

    const repo = new InteractionRepository();
    await repo.createInteraction(tenant_id, client_id, campaign_type, validUserId);

    return NextResponse.json({ success: true, message: 'Interação registrada com sucesso!' });
  } catch (error: any) {
    console.error('API /interactions erro:', error);
    return NextResponse.json({ error: error.message || 'Falha ao registrar interação' }, { status: 500 });
  }
}
