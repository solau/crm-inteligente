import { NextResponse } from 'next/server';
import { QuizRepository } from '@/lib/infrastructure/repositories/QuizRepository';
import { getSession } from '@/lib/auth';

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const body = await request.json();
    const { question_ids, notes, campaign_code } = body;

    if (!question_ids || !Array.isArray(question_ids) || question_ids.length !== 5) {
      return NextResponse.json(
        { error: 'Para publicar uma versão do Quiz, selecione exatamente 5 perguntas.' },
        { status: 400 }
      );
    }

    const repo = new QuizRepository();
    const result = await repo.publishVersion(
      question_ids,
      session.id,
      notes,
      campaign_code || 'BPE26'
    );

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      message: `Versão ${result.versionNumber} do Quiz publicada com sucesso!`,
      versionNumber: result.versionNumber
    });
  } catch (error: any) {
    console.error('Erro ao publicar versão do quiz:', error);
    return NextResponse.json(
      { error: error.message || 'Falha ao publicar versão do quiz' },
      { status: 500 }
    );
  }
}
