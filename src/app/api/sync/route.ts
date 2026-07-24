import { NextResponse } from 'next/server';
import { SyncHistoricalDataUseCase } from '@/lib/application/use-cases/SyncHistoricalDataUseCase';
import { BlingProvider } from '@/lib/infrastructure/providers/BlingProvider';
import { ClientRepository } from '@/lib/infrastructure/repositories/ClientRepository';
import { CashbackRepository } from '@/lib/infrastructure/repositories/CashbackRepository';
import { KanbanRepository } from '@/lib/infrastructure/repositories/KanbanRepository';
import { InteractionRepository } from '@/lib/infrastructure/repositories/InteractionRepository';

export const maxDuration = 300; // Permite que a sincronização demore até 5 minutos (Vercel/Next.js) sem dar timeout

// Rota GET para disparo manual da Sincronização Histórica
export async function GET(request: Request) {
  try {
    const tenantId = 'd948b6cc-cc2c-4399-8525-02f17f281d38'; // Tenant Hardcoded para o MVP

    // Instancia os Repositórios/Providers
    const blingProvider = new BlingProvider(tenantId);
    const clientRepository = new ClientRepository(tenantId);
    const cashbackRepository = new CashbackRepository();
    const kanbanRepository = new KanbanRepository(tenantId);
    const interactionRepository = new InteractionRepository();
    
    const useCase = new SyncHistoricalDataUseCase(
      blingProvider,
      clientRepository,
      cashbackRepository,
      kanbanRepository,
      interactionRepository
    );
    
    const result = await useCase.execute();

    return NextResponse.json({ ...result, success: true, message: 'Carga histórica concluída!' });
  } catch (error) {
    console.error('Erro na Carga Histórica do Bling:', error);
    return NextResponse.json({ error: 'Falha ao sincronizar' }, { status: 500 });
  }
}
