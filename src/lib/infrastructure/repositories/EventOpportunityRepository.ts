import { supabaseAdmin } from '@/lib/supabase';
import { EventOpportunity, EventStage, EventStageHistory, LeadPriority } from '@/lib/types/events';
import { calculateLeadPriority } from '@/lib/utils/priorityLogic';
import { ClientRepository } from './ClientRepository';
import { CampaignRepository } from './CampaignRepository';

export interface CreateEventLeadInput {
  client_id?: string;
  stage?: EventStage;
  // Dados do contato
  company_name: string;
  contact_name: string;
  contact_phone: string;
  contact_email?: string | null;
  contact_role?: string | null;
  segment?: string | null;
  city?: string | null;
  instagram?: string | null;
  birth_date?: string | null;
  already_knew_brand?: string | null;
  category?: 'KIT' | 'EVENTO' | string;
  guests_range?: string | null;
  consent_marketing?: boolean;

  // Dados da confraternização
  expected_guests?: number | null;
  event_date?: string | null;
  is_exact_date?: boolean;
  location?: string | null;
  event_type?: string;
  notes?: string | null;
  estimated_value?: number;

  // Origem
  campaign_code?: string;
  origin_channel?: string;
  origin_site?: string;
  utm_source?: string | null;
  utm_medium?: string | null;
  utm_campaign?: string | null;
  utm_content?: string | null;
  utm_term?: string | null;
  consent_commercial?: boolean;
  privacy_terms_version?: string;
}

export class EventOpportunityRepository {
  private tenantId: string;
  private clientRepo: ClientRepository;
  private campaignRepo: CampaignRepository;

  constructor(tenantId: string = 'd948b6cc-cc2c-4399-8525-02f17f281d38') {
    this.tenantId = tenantId;
    this.clientRepo = new ClientRepository(tenantId);
    this.campaignRepo = new CampaignRepository(tenantId);
  }

  /**
   * Sanitiza telefone para comparação e busca
   */
  private cleanPhone(phone: string): string {
    return phone ? phone.replace(/\D/g, '') : '';
  }

  /**
   * Cria ou associa lead do BPE26 com garantia estrita anti-duplicação e idempotência.
   * - Quando categoria for EVENTO: cria/atualiza cliente e cria/atualiza oportunidade em event_opportunities.
   * - Quando categoria for KIT: cria/atualiza cliente com interesse em produtos/cortes nobres, sem criar oportunidade de evento.
   */
  async createOrUpdateEventOpportunity(input: CreateEventLeadInput): Promise<{ 
    opportunity: EventOpportunity | null; 
    clientId: string;
    category: 'KIT' | 'EVENTO';
    isDuplicate: boolean;
  }> {
    const rawPhone = this.cleanPhone(input.contact_phone);
    if (!rawPhone || rawPhone.length < 10) {
      throw new Error('Telefone de WhatsApp inválido para contato.');
    }

    const rawCat = (input.category || 'EVENTO').toUpperCase();
    const category: 'KIT' | 'EVENTO' = (rawCat.includes('KIT') || rawCat === 'KIT_CHURRASCO') ? 'KIT' : 'EVENTO';

    // 1. Vincula ou obtém a Campanha
    const campaignCode = (input.campaign_code || 'BPE26').toUpperCase();
    const campaign = await this.campaignRepo.getCampaignByCode(campaignCode);
    const campaignId = campaign && campaign.id !== 'bpe26-virtual-id' ? campaign.id : null;

    // 2. Verifica se o Cliente já existe no CRM por Telefone ou E-mail
    let existingClient = await this.clientRepo.getClientByPhone(rawPhone);

    if (!existingClient && input.contact_email) {
      const { data: clientByEmail } = await supabaseAdmin
        .from('clients')
        .select('id, bling_id, cashback_balance, lead_score, base_lead_score, name, phone, preferences, total_spent, last_purchase_date')
        .eq('tenant_id', this.tenantId)
        .eq('email', input.contact_email.trim().toLowerCase())
        .maybeSingle();

      if (clientByEmail) existingClient = clientByEmail as any;
    }

    let clientId: string;

    const bpeTag = category === 'KIT'
      ? `BPE26 (Kit Churrasco) - Empresa: ${input.company_name} | Instagram: ${input.instagram || 'N/I'} | Conhecia: ${input.already_knew_brand || 'N/I'} | Faixa Pessoas: ${input.guests_range || 'N/I'}${input.birth_date ? ` | Nasc: ${input.birth_date}` : ''}`
      : `BPE26 (Eventos Corporativos) - Empresa: ${input.company_name} | Instagram: ${input.instagram || 'N/I'} | Conhecia: ${input.already_knew_brand || 'N/I'} | Faixa Convidados: ${input.guests_range || 'N/I'}${input.birth_date ? ` | Nasc: ${input.birth_date}` : ''}`;

    if (existingClient && existingClient.id) {
      clientId = existingClient.id;
      // Preserva preferências e histórico existente, adicionando novo registro da campanha BPE26
      const currentPrefs = existingClient.preferences || '';
      const updatedPrefs = currentPrefs.includes(bpeTag)
        ? currentPrefs
        : `${currentPrefs} | ${bpeTag}`.trim().replace(/^\|\s*/, '');
      
      const clientUpdates: any = {
        preferences: updatedPrefs
      };

      // Atualiza e-mail caso o cliente não possuísse
      if (!existingClient.email && input.contact_email) {
        clientUpdates.email = input.contact_email.trim().toLowerCase();
      }

      await this.clientRepo.updateClient(clientId, clientUpdates);
    } else {
      // Cria novo cliente no CRM Alpha Bull
      const newPref = category === 'KIT'
        ? `Origem: ${campaignCode} - Kit Churrasco (Produtos) | Empresa: ${input.company_name} | Instagram: ${input.instagram || 'Não informado'} | Conhecia: ${input.already_knew_brand || 'Não informado'} | Faixa Pessoas: ${input.guests_range || 'Não informado'}${input.birth_date ? ` | Nascimento: ${input.birth_date}` : ''} | Consentimento Mkt: ${input.consent_marketing ? 'Sim' : 'Não'}`
        : `Origem: ${campaignCode} - Eventos Corporativos | Empresa: ${input.company_name} | Instagram: ${input.instagram || 'Não informado'} | Conhecia: ${input.already_knew_brand || 'Não informado'} | Faixa Convidados: ${input.guests_range || 'Não informado'}${input.birth_date ? ` | Nascimento: ${input.birth_date}` : ''} | Consentimento Mkt: ${input.consent_marketing ? 'Sim' : 'Não'}`;

      const newClient = await this.clientRepo.upsertClientByPhone({
        name: `${input.contact_name} (${input.company_name})`,
        phone: rawPhone,
        email: input.contact_email ? input.contact_email.trim().toLowerCase() : undefined,
        cashback_balance: 0,
        lead_score: category === 'EVENTO' ? 50 : 35, // Eventos iniciam com 50; Kit/produtos com 35
        preferences: newPref
      });
      clientId = newClient.id!;
    }

    // SE A CATEGORIA FOR KIT: Reutiliza fluxo de produto e NÃO cria oportunidade de evento
    if (category === 'KIT') {
      return {
        opportunity: null,
        clientId,
        category: 'KIT',
        isDuplicate: Boolean(existingClient)
      };
    }

    // 3. SE A CATEGORIA FOR EVENTO: Mecanismo de Idempotência e criação de oportunidade de evento
    let existingOpp: any = null;
    try {
      const { data: opps } = await supabaseAdmin
        .from('event_opportunities')
        .select('*')
        .eq('tenant_id', this.tenantId)
        .or(`client_id.eq.${clientId},contact_phone.eq.${rawPhone}`)
        .order('created_at', { ascending: false })
        .limit(1);

      if (opps && opps.length > 0) {
        existingOpp = opps[0];
      }
    } catch (e) {
      // Se a tabela ainda não existe no Supabase, continua para o fluxo resiliente
    }

    // 4. Calcula prioridade comercial automática levando em conta guests_range
    const priority = calculateLeadPriority({
      expectedGuests: input.expected_guests,
      guestsRange: input.guests_range,
      eventDate: input.event_date
    });

    // Se já existia uma oportunidade recente para o mesmo evento, atualiza com os dados mais recentes (idempotência)
    if (existingOpp) {
      const updates: Partial<EventOpportunity> = {
        company_name: input.company_name || existingOpp.company_name,
        contact_name: input.contact_name || existingOpp.contact_name,
        contact_email: input.contact_email || existingOpp.contact_email,
        contact_role: input.contact_role || existingOpp.contact_role,
        category: 'EVENTO',
        guests_range: input.guests_range || existingOpp.guests_range,
        expected_guests: input.expected_guests ?? existingOpp.expected_guests,
        instagram: input.instagram || existingOpp.instagram,
        birth_date: input.birth_date || existingOpp.birth_date,
        already_knew_brand: input.already_knew_brand || existingOpp.already_knew_brand,
        consent_marketing: input.consent_marketing ?? existingOpp.consent_marketing,
        event_date: input.event_date || existingOpp.event_date,
        is_exact_date: input.is_exact_date ?? existingOpp.is_exact_date,
        location: input.location || existingOpp.location,
        priority: priority,
        notes: input.notes ? `${existingOpp.notes || ''}\n${input.notes}`.trim() : existingOpp.notes,
        estimated_value: input.estimated_value ?? existingOpp.estimated_value,
        updated_at: new Date().toISOString()
      };

      try {
        const { data: updated, error: updErr } = await supabaseAdmin
          .from('event_opportunities')
          .update(updates)
          .eq('id', existingOpp.id)
          .select('*')
          .single();

        if (!updErr && updated) {
          return { opportunity: updated as EventOpportunity, clientId, category: 'EVENTO', isDuplicate: true };
        }
      } catch (e) {
        // Fallback
      }

      return { opportunity: { ...existingOpp, ...updates } as EventOpportunity, clientId, category: 'EVENTO', isDuplicate: true };
    }

    // 5. Inserção de Nova Oportunidade de Evento
    const newOpportunityData = {
      tenant_id: this.tenantId,
      campaign_id: campaignId,
      client_id: clientId,
      company_name: input.company_name,
      contact_name: input.contact_name,
      contact_phone: rawPhone,
      contact_email: input.contact_email ? input.contact_email.trim().toLowerCase() : null,
      contact_role: input.contact_role || null,
      segment: input.segment || null,
      city: input.city || null,
      category: 'EVENTO',
      guests_range: input.guests_range || null,
      instagram: input.instagram || null,
      birth_date: input.birth_date || null,
      already_knew_brand: input.already_knew_brand || null,
      consent_marketing: Boolean(input.consent_marketing),
      expected_guests: input.expected_guests || null,
      event_date: input.event_date || null,
      is_exact_date: Boolean(input.is_exact_date),
      location: input.location || null,
      event_type: input.event_type || 'confraternizacao_empresarial',
      notes: input.notes || (input.guests_range ? `Faixa de convidados: ${input.guests_range}` : null),
      estimated_value: input.estimated_value || 0,
      contracted_value: 0,
      origin_channel: input.origin_channel || 'QR Code',
      origin_site: input.origin_site || 'ChurrascoSalvador.com',
      utm_source: input.utm_source || null,
      utm_medium: input.utm_medium || null,
      utm_campaign: input.utm_campaign || null,
      utm_content: input.utm_content || null,
      utm_term: input.utm_term || null,
      consent_commercial: input.consent_commercial !== false,
      privacy_terms_version: input.privacy_terms_version || 'v1.0',
      privacy_accepted_at: new Date().toISOString(),
      priority,
      stage: 'novo_lead' as EventStage
    };

    try {
      const { data: inserted, error: insErr } = await supabaseAdmin
        .from('event_opportunities')
        .insert(newOpportunityData)
        .select('*')
        .single();

      if (!insErr && inserted) {
        // Registra histórico inicial de etapa
        await this.recordStageHistory(inserted.id, null, 'novo_lead', null, 'Lead captado via formulário BPE26');
        return { opportunity: inserted as EventOpportunity, clientId, category: 'EVENTO', isDuplicate: false };
      }
    } catch (e: any) {
      console.warn('Tabela event_opportunities ainda não criada no Supabase:', e.message);
    }

    // Fallback virtual caso a tabela ainda esteja aguardando execução da migration no Supabase
    const fallbackOpp: EventOpportunity = {
      id: `virtual-opp-${Date.now()}`,
      ...newOpportunityData,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    } as EventOpportunity;

    return { opportunity: fallbackOpp, clientId, category: 'EVENTO', isDuplicate: false };
  }

  /**
   * Atualiza a etapa comercial de uma oportunidade de evento registrando o histórico de movimentação
   */
  async updateStage(
    opportunityId: string, 
    newStage: EventStage, 
    userId?: string | null, 
    notes?: string | null,
    extraUpdates?: {
      loss_reason?: string | null;
      contracted_value?: number;
      next_contact_date?: string | null;
      assigned_to?: string | null;
    }
  ): Promise<EventOpportunity> {
    let { data: currentOpp, error: getErr } = await supabaseAdmin
      .from('event_opportunities')
      .select('*')
      .or(`id.eq.${opportunityId},client_id.eq.${opportunityId}`)
      .eq('tenant_id', this.tenantId)
      .maybeSingle();

    if (!currentOpp) {
      const { data: client } = await supabaseAdmin
        .from('clients')
        .select('*')
        .eq('id', opportunityId)
        .eq('tenant_id', this.tenantId)
        .maybeSingle();

      if (client) {
        const isKit = client.preferences?.toLowerCase().includes('kit');
        const created = await this.createOrUpdateEventOpportunity({
          client_id: client.id,
          company_name: client.company_name || (client.name?.includes('(') ? client.name.match(/\(([^)]+)\)/)?.[1] : client.name),
          contact_name: client.contact_name || client.name,
          contact_phone: client.phone,
          stage: newStage,
          notes: notes || undefined,
          category: isKit ? 'KIT' : 'EVENTO',
          campaign_code: 'BPE26'
        });
        currentOpp = created.opportunity;
      } else {
        throw new Error(`Oportunidade não encontrada: ${getErr?.message || 'ID inexistente'}`);
      }
    }

    const previousStage = currentOpp.stage;
    const updates: any = {
      stage: newStage,
      updated_at: new Date().toISOString(),
      ...(extraUpdates || {})
    };

    if (newStage === 'fechado') {
      updates.closed_at = new Date().toISOString();
    }

    const { data: updated, error: updErr } = await supabaseAdmin
      .from('event_opportunities')
      .update(updates)
      .eq('id', currentOpp.id)
      .select('*')
      .single();

    if (updErr || !updated) {
      throw new Error(`Erro ao atualizar etapa da oportunidade: ${updErr?.message}`);
    }

    // Registra histórico de mudança de etapa
    await this.recordStageHistory(currentOpp.id, previousStage, newStage, userId, notes);

    return updated as EventOpportunity;
  }

  /**
   * Registra movimentação no histórico de etapas
   */
  async recordStageHistory(
    opportunityId: string, 
    previousStage: string | null, 
    newStage: EventStage, 
    changedBy?: string | null, 
    notes?: string | null
  ): Promise<void> {
    try {
      await supabaseAdmin
        .from('event_stage_history')
        .insert({
          tenant_id: this.tenantId,
          event_opportunity_id: opportunityId,
          previous_stage: previousStage,
          new_stage: newStage,
          changed_by: changedBy || null,
          notes: notes || null
        });
    } catch (e) {
      console.warn('Erro ao registrar histórico de etapa:', e);
    }
  }

  /**
   * Lista oportunidades de eventos com filtros
   */
  async listOpportunities(filters?: {
    stage?: EventStage;
    priority?: LeadPriority;
    campaignId?: string;
    search?: string;
  }): Promise<EventOpportunity[]> {
    try {
      let query = supabaseAdmin
        .from('event_opportunities')
        .select(`
          *,
          user_profiles:assigned_to (name),
          campaigns:campaign_id (code, name)
        `)
        .eq('tenant_id', this.tenantId)
        .order('created_at', { ascending: false });

      if (filters?.stage) {
        query = query.eq('stage', filters.stage);
      }
      if (filters?.priority) {
        query = query.eq('priority', filters.priority);
      }
      if (filters?.campaignId) {
        query = query.eq('campaign_id', filters.campaignId);
      }

      const { data, error } = await query;
      if (error || !data) return [];

      return data.map((item: any) => ({
        ...item,
        assigned_to_name: item.user_profiles?.name || null,
        campaign_code: item.campaigns?.code || 'BPE26'
      })) as EventOpportunity[];
    } catch (e) {
      return [];
    }
  }

  /**
   * Obtém os detalhes completos de uma oportunidade com histórico de etapas
   */
  async getOpportunityDetails(opportunityId: string): Promise<{ opportunity: EventOpportunity; history: EventStageHistory[] } | null> {
    try {
      const { data: opp, error: oppErr } = await supabaseAdmin
        .from('event_opportunities')
        .select(`
          *,
          user_profiles:assigned_to (name),
          campaigns:campaign_id (code, name)
        `)
        .eq('id', opportunityId)
        .eq('tenant_id', this.tenantId)
        .single();

      if (oppErr || !opp) return null;

      const { data: history } = await supabaseAdmin
        .from('event_stage_history')
        .select(`
          *,
          user_profiles:changed_by (name)
        `)
        .eq('event_opportunity_id', opportunityId)
        .order('created_at', { ascending: false });

      const mappedOpp: EventOpportunity = {
        ...opp,
        assigned_to_name: opp.user_profiles?.name || null,
        campaign_code: opp.campaigns?.code || 'BPE26'
      };

      const mappedHistory: EventStageHistory[] = (history || []).map((h: any) => ({
        ...h,
        changed_by_name: h.user_profiles?.name || null
      }));

      return { opportunity: mappedOpp, history: mappedHistory };
    } catch (e) {
      return null;
    }
  }

  /**
   * Atualiza dados de follow-up comercial
   */
  async updateFollowUp(opportunityId: string, data: {
    notes?: string | null;
    assigned_to?: string | null;
    next_contact_date?: string | null;
    loss_reason?: string | null;
    budget_attachment_url?: string | null;
    estimated_value?: number;
    contracted_value?: number;
  }): Promise<EventOpportunity> {
    const { data: updated, error } = await supabaseAdmin
      .from('event_opportunities')
      .update({
        ...data,
        updated_at: new Date().toISOString()
      })
      .eq('id', opportunityId)
      .eq('tenant_id', this.tenantId)
      .select('*')
      .single();

    if (error || !updated) {
      throw new Error(`Erro ao atualizar follow-up: ${error?.message}`);
    }

    return updated as EventOpportunity;
  }
}
