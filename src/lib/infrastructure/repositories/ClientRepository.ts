import { supabaseAdmin } from '@/lib/supabase';

export interface ClientData {
  id?: string;
  tenant_id?: string;
  name: string;
  phone: string;
  email?: string;
  bling_id?: string;
  cashback_balance: number;
  lead_score: number;
  preferences?: string;
  created_at?: string;
  total_spent?: number;
  last_purchase_date?: string;
  base_lead_score?: number;
}

export class ClientRepository {
  private tenantId: string;

  constructor(tenantId: string) {
    this.tenantId = tenantId;
  }

  async upsertClientByPhone(clientData: ClientData): Promise<ClientData> {
    // Busca se o cliente já existe pelo telefone
    const { data: existingClient } = await supabaseAdmin
      .from('clients')
      .select('id')
      .eq('phone', clientData.phone)
      .eq('tenant_id', this.tenantId)
      .single();

    if (existingClient) {
      // Se existe, atualiza
      const { data, error } = await supabaseAdmin
        .from('clients')
        .update(clientData)
        .eq('id', existingClient.id)
        .select('id, cashback_balance, lead_score, base_lead_score, name, phone, preferences, total_spent, last_purchase_date')
        .single();
        
      if (error || !data) throw new Error(`Erro ao atualizar cliente: ${error?.message}`);
      return data as ClientData;
    } else {
      // Se não existe, insere
      const { data, error } = await supabaseAdmin
        .from('clients')
        .insert({ tenant_id: this.tenantId, ...clientData })
        .select('id, cashback_balance, lead_score, base_lead_score, name, phone, preferences, total_spent, last_purchase_date')
        .single();

      if (error || !data) throw new Error(`Erro ao inserir cliente: ${error?.message}`);
      return data as ClientData;
    }
  }

  async getClientByPhone(phone: string): Promise<ClientData | null> {
    const { data, error } = await supabaseAdmin
      .from('clients')
      .select('id, cashback_balance, lead_score, base_lead_score, name, phone, preferences, total_spent, last_purchase_date')
      .eq('phone', phone)
      .eq('tenant_id', this.tenantId)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 = 0 rows returned
      throw new Error(`Erro ao buscar cliente: ${error.message}`);
    }

    return data as ClientData | null;
  }

  async updateClient(clientId: string, updates: Partial<ClientData>): Promise<void> {
    const { error } = await supabaseAdmin
      .from('clients')
      .update(updates)
      .eq('id', clientId)
      .eq('tenant_id', this.tenantId);

    if (error) {
      throw new Error(`Erro ao atualizar cliente: ${error.message}`);
    }
  }
}
