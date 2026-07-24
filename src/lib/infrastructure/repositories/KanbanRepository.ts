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
      .ilike('title', `%${title}%`)
      .maybeSingle();
    
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

  // Move a negociação existente do cliente para o Pós-Venda ou cria se não existir
  async moveOrCreatePostSalesDeal(clientId: string, columnId: string, title: string, value: number): Promise<void> {
    const { data: existingDeal } = await supabaseAdmin
      .from('deals')
      .select('id')
      .eq('client_id', clientId)
      .limit(1)
      .maybeSingle();

    if (existingDeal) {
      await supabaseAdmin
        .from('deals')
        .update({
          column_id: columnId,
          title,
          value
        })
        .eq('id', existingDeal.id);
    } else {
      await this.createDeal(clientId, columnId, title, value);
    }
  }
}
