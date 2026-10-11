import { NextResponse } from 'next/server';
import { EventOpportunityRepository } from '@/lib/infrastructure/repositories/EventOpportunityRepository';
import { getSession } from '@/lib/auth';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { error: 'Não autorizado. Acesso restrito a operadores do CRM Alpha Bull.' },
        { status: 401 }
      );
    }

    const { id } = await params;
    const repo = new EventOpportunityRepository();
    const result = await repo.getOpportunityDetails(id);

    if (!result) {
      return NextResponse.json({ error: 'Oportunidade não encontrada' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: result.opportunity, history: result.history });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Erro ao consultar oportunidade' }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { error: 'Não autorizado. Acesso restrito a operadores do CRM Alpha Bull.' },
        { status: 401 }
      );
    }

    const { id } = await params;
    const body = await request.json();
    const userId = body.user_id || session.id || null;

    const repo = new EventOpportunityRepository();

    if (body.stage) {
      const updated = await repo.updateStage(id, body.stage, userId, body.notes, {
        loss_reason: body.loss_reason,
        contracted_value: body.contracted_value,
        next_contact_date: body.next_contact_date,
        assigned_to: body.assigned_to
      });
      return NextResponse.json({ success: true, data: updated });
    }

    const updated = await repo.updateFollowUp(id, body);
    return NextResponse.json({ success: true, data: updated });
  } catch (error: any) {
    console.error('Erro ao atualizar oportunidade:', error);
    return NextResponse.json({ error: error.message || 'Erro ao atualizar oportunidade' }, { status: 400 });
  }
}
