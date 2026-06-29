import { NextResponse } from 'next/server';
import { GeminiService } from '@/lib/services/GeminiService';

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const tenantId = payload.tenant_id || "mock-tenant-id";

    // 1. Recebemos a mensagem do WhatsApp (Evolution API / webhook)
    const clientMessage = payload.message?.text;
    
    if (clientMessage) {
      // 2. Acionamos a Inteligência Artificial para ler a intenção da mensagem
      const aiService = new GeminiService(tenantId);
      const intent = await aiService.analyzeKanbanIntent(clientMessage);
      
      // 3. Se a IA detectou que é para mover o card, o sistema atualiza o Supabase (Kanban Autônomo)
      if (intent.action === 'MOVE_CARD') {
        console.log(`AI moved card to ${intent.targetColumn}`);
        // Chamar repositório para atualizar banco
      }
    }

    return NextResponse.json({ success: true }, { status: 200 });

  } catch (error) {
    console.error('Webhook WhatsApp Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
