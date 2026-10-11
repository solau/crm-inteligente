import { NextResponse } from 'next/server';
import { EventOpportunityRepository } from '@/lib/infrastructure/repositories/EventOpportunityRepository';
import { getSession } from '@/lib/auth';

export async function GET(request: Request) {
  try {
    // 1. Verificação de Autenticação Administrativa do CRM
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { error: 'Não autorizado. Acesso restrito a usuários autenticados no CRM Alpha Bull.' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const stage = searchParams.get('stage') as any;
    const priority = searchParams.get('priority') as any;
    const campaignId = searchParams.get('campaignId') || undefined;

    const repo = new EventOpportunityRepository();
    const opportunities = await repo.listOpportunities({
      stage,
      priority,
      campaignId
    });

    return NextResponse.json({ success: true, data: opportunities });
  } catch (error: any) {
    console.error('Erro ao listar oportunidades de eventos:', error);
    return NextResponse.json({ error: error.message || 'Falha ao buscar eventos' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    // 1. Verificação de Autenticação Administrativa do CRM
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { error: 'Não autorizado. Apenas operadores autenticados podem criar eventos manualmente.' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const repo = new EventOpportunityRepository();
    const result = await repo.createOrUpdateEventOpportunity(body);

    return NextResponse.json({ 
      success: true, 
      data: result.opportunity, 
      isDuplicate: result.isDuplicate 
    });
  } catch (error: any) {
    console.error('Erro ao criar oportunidade de evento:', error);
    return NextResponse.json({ error: error.message || 'Falha ao salvar evento' }, { status: 400 });
  }
}
