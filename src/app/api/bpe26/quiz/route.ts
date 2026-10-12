import { NextResponse } from 'next/server';
import { QuizRepository } from '@/lib/infrastructure/repositories/QuizRepository';
import { corsHeaders, handleCorsPreflight } from '@/lib/utils/cors';

export async function OPTIONS(request: Request) {
  return handleCorsPreflight(request);
}

export async function GET(request: Request) {
  const origin = request.headers.get('origin');
  try {
    const repo = new QuizRepository();
    const questions = await repo.getPublicQuizQuestions();

    return NextResponse.json(
      {
        success: true,
        campaign: 'BPE26',
        total_questions: questions.length,
        questions
      },
      { headers: corsHeaders(origin) }
    );
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Falha ao buscar perguntas do Quiz.' },
      { status: 500, headers: corsHeaders(origin) }
    );
  }
}
