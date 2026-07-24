// src/app/api/ai/agentes/route.ts
// Endpoint da Central de Agentes AI: Consulta e Disparos Autônomos

import { NextResponse } from 'next/server';
import { AgentOrchestrator } from '@/lib/agents/AgentOrchestrator';
import { AgentMemoryService } from '@/lib/agents/AgentMemoryService';

export async function GET() {
  try {
    let latestScan = AgentMemoryService.getLatestScan();

    // Se ainda não houve nenhuma varredura na sessão, executa uma varredura inicial
    if (!latestScan) {
      const orchestrator = new AgentOrchestrator();
      latestScan = await orchestrator.executeFullDiagnostic();
    }

    return NextResponse.json({
      success: true,
      data: latestScan,
      evolutionSummary: AgentMemoryService.getEvolutionSummary()
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Falha ao consultar agentes' },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { action = 'run_all' } = body;
    const orchestrator = new AgentOrchestrator();

    if (action === 'trigger_jobs') {
      const result = await orchestrator.triggerRoutineJobs();
      return NextResponse.json({ success: true, action: 'trigger_jobs', result });
    }

    if (action === 'validate_rules') {
      const result = await orchestrator.validateBusinessRules();
      return NextResponse.json({ success: true, action: 'validate_rules', result });
    }

    // Ação padrão: Execução completa multi-agente
    const scanResult = await orchestrator.executeFullDiagnostic();
    return NextResponse.json({
      success: true,
      action: 'run_all',
      data: scanResult,
      evolutionSummary: AgentMemoryService.getEvolutionSummary()
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Falha ao executar ação dos agentes' },
      { status: 500 }
    );
  }
}
