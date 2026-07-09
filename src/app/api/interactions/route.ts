import { NextResponse } from 'next/server';
import { InteractionRepository } from '@/lib/infrastructure/repositories/InteractionRepository';

export async function POST(request: Request) {
  try {
    const { tenant_id, client_id, campaign_type, user_id } = await request.json();

    if (!tenant_id || !client_id || !campaign_type) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const repo = new InteractionRepository();
    await repo.createInteraction(tenant_id, client_id, campaign_type, user_id);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('API /interactions erro:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
