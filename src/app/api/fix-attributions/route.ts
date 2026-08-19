import { NextResponse } from 'next/server';
import { DataReconciliationAgent } from '@/lib/agents/DataReconciliationAgent';

export const maxDuration = 60; // 60s timeout limit

export async function GET(request: Request) {
  try {
    const tenantId = 'd948b6cc-cc2c-4399-8525-02f17f281d38';
    const agent = new DataReconciliationAgent(tenantId);
    const report = await agent.runReconciliation();

    return NextResponse.json({ 
      success: true, 
      message: 'Reconciliação e auditoria de conversões concluída com sucesso.',
      report
    });
  } catch (error: any) {
    console.error('Erro na correção de conversões:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
