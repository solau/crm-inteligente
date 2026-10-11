import { supabaseAdmin } from '@/lib/supabase';
import { Campaign } from '@/lib/types/events';

export const DEFAULT_BPE26_CAMPAIGN = {
  code: 'BPE26',
  name: 'Desafio Alpha Bull — BPE26',
  type: 'Captação de leads para eventos corporativos',
  description: 'Campanha interativa e de captação de confraternizações empresariais no Bahia Potência Empresarial 2026 via QR Code e ChurrascoSalvador.com.',
  origin: 'QR Code e landing page',
  commercial_goal: 'Captar empresas interessadas em contratar a Alpha Bull para confraternizações corporativas e eventos de fim de ano.',
  discount_rules: {
    "0": 0,
    "1": 0,
    "2": 5,
    "3": 8,
    "4": 15,
    "5": 20
  },
  regulations: 'Descontos do quiz aplicáveis exclusivamente na compra de cortes nobres na boutique Alpha Bull. Cupons de uso único, individuais e intransferíveis, não cumulativos com outras promoções. Prazo de validade de 30 dias. A campanha de 5 isenções exige contratação mínima de 15 convidados e regulamento aprovado.',
  status: 'ativa' as const
};

export class CampaignRepository {
  private tenantId: string;

  constructor(tenantId: string = 'd948b6cc-cc2c-4399-8525-02f17f281d38') {
    this.tenantId = tenantId;
  }

  async getCampaignByCode(code: string): Promise<Campaign | null> {
    try {
      const { data, error } = await supabaseAdmin
        .from('campaigns')
        .select('*')
        .eq('tenant_id', this.tenantId)
        .eq('code', code.toUpperCase())
        .maybeSingle();

      if (data) return data as Campaign;

      // Se for BPE26 e não existir ainda no banco, cria automaticamente
      if (code.toUpperCase() === 'BPE26') {
        const { data: created, error: insertErr } = await supabaseAdmin
          .from('campaigns')
          .insert({
            tenant_id: this.tenantId,
            ...DEFAULT_BPE26_CAMPAIGN,
            starts_at: new Date().toISOString()
          })
          .select('*')
          .single();

        if (!insertErr && created) {
          return created as Campaign;
        }
      }

      if (error && error.code !== 'PGRST116') {
        console.warn('Tabela campaigns ainda não criada ou erro de consulta, retornando fallback BPE26:', error.message);
        if (code.toUpperCase() === 'BPE26') {
          return {
            id: 'bpe26-virtual-id',
            tenant_id: this.tenantId,
            ...DEFAULT_BPE26_CAMPAIGN,
            starts_at: '2026-10-01T00:00:00Z',
            ends_at: null,
            created_at: new Date().toISOString()
          } as Campaign;
        }
      }

      return null;
    } catch (e: any) {
      console.warn('Falha ao obter campanha por código:', e.message);
      if (code.toUpperCase() === 'BPE26') {
        return {
          id: 'bpe26-virtual-id',
          tenant_id: this.tenantId,
          ...DEFAULT_BPE26_CAMPAIGN,
          starts_at: '2026-10-01T00:00:00Z',
          ends_at: null,
          created_at: new Date().toISOString()
        } as Campaign;
      }
      return null;
    }
  }

  async listCampaigns(): Promise<Campaign[]> {
    try {
      const { data, error } = await supabaseAdmin
        .from('campaigns')
        .select('*')
        .eq('tenant_id', this.tenantId)
        .order('created_at', { ascending: false });

      if (data && data.length > 0) return data as Campaign[];

      // Se a tabela estiver vazia, garante o BPE26
      const bpe = await this.getCampaignByCode('BPE26');
      return bpe ? [bpe] : [];
    } catch (e) {
      const bpe = await this.getCampaignByCode('BPE26');
      return bpe ? [bpe] : [];
    }
  }

  async createCampaign(data: Partial<Campaign>): Promise<Campaign> {
    const { data: created, error } = await supabaseAdmin
      .from('campaigns')
      .insert({
        tenant_id: this.tenantId,
        code: (data.code || 'CAMP').toUpperCase(),
        name: data.name || 'Nova Campanha',
        type: data.type || 'Captação de leads para eventos corporativos',
        description: data.description || null,
        origin: data.origin || 'QR Code',
        commercial_goal: data.commercial_goal || null,
        discount_rules: data.discount_rules || DEFAULT_BPE26_CAMPAIGN.discount_rules,
        regulations: data.regulations || null,
        status: data.status || 'ativa',
        starts_at: data.starts_at || new Date().toISOString(),
        ends_at: data.ends_at || null
      })
      .select('*')
      .single();

    if (error || !created) {
      throw new Error(`Erro ao criar campanha: ${error?.message}`);
    }

    return created as Campaign;
  }
}
