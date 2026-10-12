import { NextResponse } from 'next/server';
import { QuizRepository } from '@/lib/infrastructure/repositories/QuizRepository';
import { getSession } from '@/lib/auth';

export async function GET(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const campaignCode = searchParams.get('campaign') || 'BPE26';

    const repo = new QuizRepository();
    const questions = await repo.getAllBankQuestions(campaignCode);

    return NextResponse.json({
      success: true,
      total: questions.length,
      questions
    });
  } catch (error: any) {
    console.error('Erro ao buscar perguntas do banco:', error);
    return NextResponse.json(
      { error: error.message || 'Falha ao buscar perguntas do quiz' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const body = await request.json();
    if (!body.question_text || !body.options || body.options.length !== 4) {
      return NextResponse.json(
        { error: 'A pergunta deve ter enunciado e exatamente quatro alternativas (A, B, C, D).' },
        { status: 400 }
      );
    }

    const repo = new QuizRepository();
    const result = await repo.saveQuestion({
      id: body.id,
      question_text: body.question_text,
      explanation: body.explanation,
      order_num: body.order_num || 1,
      options: body.options,
      campaign_code: body.campaign_code || 'BPE26'
    });

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      message: 'Pergunta salva com sucesso!',
      questionId: result.questionId
    });
  } catch (error: any) {
    console.error('Erro ao salvar pergunta:', error);
    return NextResponse.json(
      { error: error.message || 'Falha ao salvar pergunta' },
      { status: 500 }
    );
  }
}
