export type LeadPriority = 'ALTA' | 'MEDIA' | 'EM_NUTRICAO' | 'OUTRAS';

export type EventStage = 
  | 'novo_lead' 
  | 'contato_realizado' 
  | 'qualificacao' 
  | 'orcamento_solicitado' 
  | 'proposta_enviada' 
  | 'negociacao' 
  | 'fechado' 
  | 'perdido';

export interface Campaign {
  id: string;
  tenant_id: string;
  code: string;
  name: string;
  type: string;
  description?: string | null;
  origin?: string | null;
  commercial_goal?: string | null;
  discount_rules?: Record<string, number>;
  regulations?: string | null;
  starts_at?: string | null;
  ends_at?: string | null;
  status: 'rascunho' | 'ativa' | 'pausada' | 'encerrada';
  created_at: string;
}

export interface EventOpportunity {
  id: string;
  tenant_id: string;
  campaign_id?: string | null;
  client_id: string;
  deal_id?: string | null;
  company_name: string;
  contact_name: string;
  contact_phone: string;
  contact_email?: string | null;
  contact_role?: string | null;
  segment?: string | null;
  city?: string | null;
  category?: string | null;
  guests_range?: string | null;
  instagram?: string | null;
  birth_date?: string | null;
  already_knew_brand?: string | null;
  consent_marketing?: boolean;
  expected_guests?: number | null;
  event_date?: string | null;
  is_exact_date?: boolean;
  location?: string | null;
  event_type?: string;
  notes?: string | null;
  estimated_value: number;
  contracted_value: number;
  origin_channel?: string;
  origin_site?: string;
  utm_source?: string | null;
  utm_medium?: string | null;
  utm_campaign?: string | null;
  utm_content?: string | null;
  utm_term?: string | null;
  consent_commercial: boolean;
  privacy_terms_version: string;
  privacy_accepted_at: string;
  priority: LeadPriority;
  stage: EventStage;
  assigned_to?: string | null;
  assigned_to_name?: string | null;
  loss_reason?: string | null;
  next_contact_date?: string | null;
  budget_attachment_url?: string | null;
  closed_at?: string | null;
  created_at: string;
  updated_at: string;
  campaign_code?: string;
}

export interface EventStageHistory {
  id: string;
  tenant_id: string;
  event_opportunity_id: string;
  previous_stage?: string | null;
  new_stage: EventStage;
  changed_by?: string | null;
  changed_by_name?: string | null;
  notes?: string | null;
  created_at: string;
}

export interface QuizQuestionPublic {
  id: string;
  order_num: number;
  question_text: string;
  options: {
    letter: string;
    option_text: string;
  }[];
}

export interface QuizSubmissionResult {
  score: number;
  total_questions: number;
  discount_percent: number;
  coupon_code?: string;
  is_new_coupon: boolean;
  message: string;
}

export interface Coupon {
  id: string;
  tenant_id: string;
  campaign_id: string;
  client_id?: string | null;
  submission_id?: string | null;
  code: string;
  discount_percent: number;
  issued_at: string;
  expires_at: string;
  status: 'ATIVO' | 'UTILIZADO' | 'EXPIRADO' | 'CANCELADO';
  used_at?: string | null;
  order_id?: string | null;
  min_purchase_value: number;
  max_discount_value?: number | null;
  restrictions: string;
}
