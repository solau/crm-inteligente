import { NextResponse } from 'next/server';
import { SyncRecentOrdersUseCase } from '@/lib/application/use-cases/SyncRecentOrdersUseCase';

export async function GET() {
  try {
    const useCase = new SyncRecentOrdersUseCase('d948b6cc-cc2c-4399-8525-02f17f281d38');
    const result = await useCase.execute(7);
    return NextResponse.json({ success: true, ...result });
  } catch (error: any) {
    console.error('Erro na sincronização dos últimos 3 dias:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST() {
  return GET();
}
