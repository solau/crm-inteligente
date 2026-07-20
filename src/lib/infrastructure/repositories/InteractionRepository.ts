import { createClient, SupabaseClient } from '@supabase/supabase-js';

export class InteractionRepository {
  private supabase: SupabaseClient;

  constructor() {
    this.supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
  }

  async getLatestInteraction(clientId: string, maxDateStr?: string) {
    let query = this.supabase
      .from('client_interactions')
      .select('*')
      .eq('client_id', clientId);

    if (maxDateStr) {
      // Interação deve ter ocorrido antes ou no exato momento da venda
      query = query.lte('created_at', maxDateStr);
      
      // Janela de atribuição: Apenas interações dos últimos 15 dias importam
      const minDate = new Date(maxDateStr);
      minDate.setDate(minDate.getDate() - 15);
      query = query.gte('created_at', minDate.toISOString());
    }

    const { data, error } = await query
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
      
    if (error && error.code !== 'PGRST116') {
      console.error('Erro ao buscar interação:', error);
    }
    return data;
  }

  async attributeSale(tenantId: string, interactionId: string, orderId: string, revenue: number) {
    const { error } = await this.supabase
      .from('sales_attribution')
      .insert({
        tenant_id: tenantId,
        interaction_id: interactionId,
        order_id: orderId,
        revenue: revenue
      });
      
    if (error) {
      console.error('Erro ao registrar atribuição de venda:', error);
    }
  }

  async createInteraction(tenantId: string, clientId: string, campaignType: string, userId?: string) {
    const { error } = await this.supabase
      .from('client_interactions')
      .insert({
        tenant_id: tenantId,
        client_id: clientId,
        campaign_type: campaignType,
        user_id: userId
      });
      
    if (error) {
      console.error('Erro ao registrar interação:', error);
    }
  }

  async checkAttributionExists(orderId: string): Promise<boolean> {
    const { data, error } = await this.supabase
      .from('sales_attribution')
      .select('id')
      .eq('order_id', orderId)
      .limit(1)
      .maybeSingle();
      
    if (error) {
      console.error('Erro ao verificar atribuição de venda:', error);
    }
    return !!data;
  }
}
