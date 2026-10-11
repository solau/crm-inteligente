import { supabaseAdmin } from '@/lib/supabase';
import { Coupon } from '@/lib/types/events';
import crypto from 'crypto';

// Cache em memória para resiliência imediata e idempotência mesmo com latência de rede
const memoryCouponsStore = new Map<string, Coupon>();

export class CouponRepository {
  private tenantId: string;

  constructor(tenantId: string = 'd948b6cc-cc2c-4399-8525-02f17f281d38') {
    this.tenantId = tenantId;
  }

  /**
   * Gera código único e legível para cupom, ex: BPE26-K9X7W
   */
  private generateUniqueCode(prefix: string = 'BPE26'): string {
    const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'; // sem 0, 1, I, O
    let randomPart = '';
    const bytes = crypto.randomBytes(5);
    for (let i = 0; i < 5; i++) {
      randomPart += chars[bytes[i] % chars.length];
    }
    return `${prefix}-${randomPart}`;
  }

  /**
   * Busca cupom ativo pelo telefone do participante
   */
  async getActiveCouponByPhone(phone: string, campaignCode: string = 'BPE26'): Promise<Coupon | null> {
    const cleanPhone = phone.replace(/\D/g, '');

    // 1. Verifica cache em memória primeiro (resiliência instantânea)
    for (const c of memoryCouponsStore.values()) {
      if ((c as any).participant_phone === cleanPhone && c.status === 'ATIVO') {
        return c;
      }
    }

    // 2. Consulta banco de dados Supabase com timeout de segurança
    try {
      const fetchPromise = supabaseAdmin
        .from('coupons')
        .select('*')
        .eq('tenant_id', this.tenantId)
        .ilike('code', `${campaignCode}%`)
        .eq('status', 'ATIVO')
        .gte('expires_at', new Date().toISOString())
        .limit(1)
        .maybeSingle();

      const timeoutPromise = new Promise<{ data: any; error: any }>((resolve) =>
        setTimeout(() => resolve({ data: null, error: new Error('DB_TIMEOUT') }), 3000)
      );

      const { data } = await Promise.race([fetchPromise, timeoutPromise]);
      if (data) return data as Coupon;
      return null;
    } catch (e) {
      return null;
    }
  }

  /**
   * Busca cupom pelo código único
   */
  async getCouponByCode(code: string): Promise<Coupon | null> {
    const upperCode = code.trim().toUpperCase();

    // 1. Checa memória
    if (memoryCouponsStore.has(upperCode)) {
      return memoryCouponsStore.get(upperCode)!;
    }

    // 2. Checa Supabase
    try {
      const fetchPromise = supabaseAdmin
        .from('coupons')
        .select('*')
        .eq('tenant_id', this.tenantId)
        .eq('code', upperCode)
        .maybeSingle();

      const timeoutPromise = new Promise<{ data: any; error: any }>((resolve) =>
        setTimeout(() => resolve({ data: null, error: new Error('DB_TIMEOUT') }), 3000)
      );

      const { data } = await Promise.race([fetchPromise, timeoutPromise]);
      if (data) return data as Coupon;
      return null;
    } catch (e) {
      return null;
    }
  }

  /**
   * Emite novo cupom de desconto com validade de 30 dias
   */
  async issueCoupon(params: {
    participant_phone: string;
    participant_name: string;
    discount_percent: number;
    campaign_code?: string;
    validityDays?: number;
  }): Promise<Coupon> {
    const campaignCode = (params.campaign_code || 'BPE26').toUpperCase();
    const validityDays = params.validityDays || 30;
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + validityDays);

    const code = this.generateUniqueCode(campaignCode);
    const cleanPhone = params.participant_phone.replace(/\D/g, '');

    const newCoupon: any = {
      id: `coupon-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      tenant_id: this.tenantId,
      campaign_id: 'bpe26-virtual-id',
      code,
      discount_percent: params.discount_percent,
      issued_at: new Date().toISOString(),
      expires_at: expiresAt.toISOString(),
      status: 'ATIVO',
      min_purchase_value: 0,
      restrictions: 'Válido exclusivamente para compras de produtos elegíveis da Alpha Bull (cortes nobres). Não cumulativo com outras promoções. Uso único por participante.',
      participant_phone: cleanPhone
    };

    // Armazena no cache em memória
    memoryCouponsStore.set(code, newCoupon);

    // Tenta persistir no Supabase em background sem travar o usuário
    try {
      const insertPromise = supabaseAdmin
        .from('coupons')
        .insert({
          tenant_id: this.tenantId,
          code,
          discount_percent: params.discount_percent,
          issued_at: newCoupon.issued_at,
          expires_at: newCoupon.expires_at,
          status: 'ATIVO',
          min_purchase_value: 0,
          restrictions: newCoupon.restrictions
        })
        .select('*')
        .single();

      const timeoutPromise = new Promise<{ data: any; error: any }>((resolve) =>
        setTimeout(() => resolve({ data: null, error: new Error('DB_TIMEOUT') }), 3000)
      );

      const { data, error } = await Promise.race([insertPromise, timeoutPromise]);
      if (!error && data) {
        memoryCouponsStore.set(code, { ...data, participant_phone: cleanPhone });
        return { ...data, participant_phone: cleanPhone } as Coupon;
      }
    } catch (e) {
      console.warn('Persistência de cupom no Supabase tratada:', e);
    }

    return newCoupon as Coupon;
  }

  /**
   * Lista todos os cupons da campanha
   */
  async listCoupons(campaignCode: string = 'BPE26'): Promise<Coupon[]> {
    try {
      const fetchPromise = supabaseAdmin
        .from('coupons')
        .select('*')
        .eq('tenant_id', this.tenantId)
        .ilike('code', `${campaignCode}%`)
        .order('issued_at', { ascending: false });

      const timeoutPromise = new Promise<{ data: any; error: any }>((resolve) =>
        setTimeout(() => resolve({ data: null, error: new Error('DB_TIMEOUT') }), 3000)
      );

      const { data } = await Promise.race([fetchPromise, timeoutPromise]);
      if (data && data.length > 0) return data as Coupon[];
    } catch (e) {
      // continua para fallback da memória
    }

    return Array.from(memoryCouponsStore.values()).filter(c => c.code.startsWith(campaignCode));
  }

  /**
   * Marca cupom como utilizado
   */
  async useCoupon(code: string, orderId?: string): Promise<boolean> {
    const upperCode = code.trim().toUpperCase();
    if (memoryCouponsStore.has(upperCode)) {
      const c = memoryCouponsStore.get(upperCode)!;
      c.status = 'UTILIZADO';
      c.used_at = new Date().toISOString();
      c.order_id = orderId || null;
    }

    try {
      const { error } = await supabaseAdmin
        .from('coupons')
        .update({
          status: 'UTILIZADO',
          used_at: new Date().toISOString(),
          order_id: orderId || null
        })
        .eq('tenant_id', this.tenantId)
        .eq('code', upperCode)
        .eq('status', 'ATIVO');

      return !error;
    } catch (e) {
      return true;
    }
  }
}
