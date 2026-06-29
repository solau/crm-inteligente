import { supabaseAdmin } from '@/lib/supabase';

export class KanbanRepository {
  private tenantId: string;

  constructor(tenantId: string) {
    this.tenantId = tenantId;
  }

  async getOrCreateColumn(title: string, positionOrder: number): Promise<string> {
    let { data: column } = await supabaseAdmin
      .from('kanban_columns')
      .select('id')
      .eq('tenant_id', this.tenantId)
      .eq('title', title)
      .single();
    
    if (!column) {
      const { data: newColumn, error } = await supabaseAdmin
        .from('kanban_columns')
        .insert({ 
          tenant_id: this.tenantId, 
          title, 
          position_order: positionOrder, 
          is_system: true 
        })
        .select('id')
        .single();
        
      if (error || !newColumn) {
        throw new Error(`Erro ao criar coluna do Kanban: ${error?.message}`);
      }
      return newColumn.id;
    }

    return column.id;
  }

  async createDeal(clientId: string, columnId: string, title: string, value: number): Promise<void> {
    const { error } = await supabaseAdmin
      .from('deals')
      .insert({
        tenant_id: this.tenantId,
        client_id: clientId,
        column_id: columnId,
        title,
        value
      });

    if (error) {
      throw new Error(`Erro ao criar card no Kanban: ${error.message}`);
    }
  }
}
