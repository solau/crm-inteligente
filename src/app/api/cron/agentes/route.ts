// src/app/api/cron/agentes/route.ts
// Cron Job Automático 100% Gratuito (Vercel Hobby / Cron-job.org)

import { NextResponse } from 'next/server';
import { AgentOrchestrator } from '@/lib/agents/AgentOrchestrator';

export async function GET(req: Request) {
  try {
    // Validação opcional de token de segurança para pings externos
    const { searchParams } = new URL(req.url);
    const authHeader = req.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && searchParams.get('secret') !== cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      // Permite em modo dev sem secret se não estiver definido
    }

    const orchestrator = new AgentOrchestrator();
    const scanResult = await orchestrator.executeFullDiagnostic();

    return NextResponse.json({
      success: true,
      message: 'Execução automática dos Agentes realizada com sucesso!',
      timestamp: scanResult.timestamp,
      globalHealthScore: scanResult.globalHealthScore
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Erro na execução automática dos agentes' },
      { status: 500 }
    );
  }
}
