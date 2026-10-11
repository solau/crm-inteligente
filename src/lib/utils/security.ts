import crypto from 'crypto';

// Segredo do servidor para assinatura HMAC
const SERVER_SECRET = process.env.SUPABASE_SERVICE_ROLE_KEY || 'alpha-bull-bpe26-secure-secret-2026';

/**
 * Gera um token assinado (HMAC-SHA256) para o participante do BPE26.
 * O token tem validade de 30 dias e vincula o participante ao seu número de telefone.
 */
export function generateParticipantToken(phone: string, campaignCode: string = 'BPE26'): string {
  const cleanPhone = phone.replace(/\D/g, '');
  const expiresAt = Date.now() + 30 * 24 * 60 * 60 * 1000; // 30 dias
  const payload = `${cleanPhone}:${campaignCode.toUpperCase()}:${expiresAt}`;
  const signature = crypto.createHmac('sha256', SERVER_SECRET).update(payload).digest('hex');
  const token = Buffer.from(`${payload}:${signature}`).toString('base64url');
  return token;
}

/**
 * Valida o token do participante e garante que ele pertence ao telefone informado.
 */
export function verifyParticipantToken(token: string, expectedPhone?: string): { valid: boolean; phone?: string; expired?: boolean } {
  if (!token) return { valid: false };

  try {
    const decoded = Buffer.from(token, 'base64url').toString('utf-8');
    const parts = decoded.split(':');
    if (parts.length !== 4) return { valid: false };

    const [phone, campaign, expiresAtStr, signature] = parts;
    const expiresAt = Number(expiresAtStr);

    // Valida expiração
    if (Date.now() > expiresAt) {
      return { valid: false, phone, expired: true };
    }

    // Valida assinatura HMAC
    const payload = `${phone}:${campaign}:${expiresAtStr}`;
    const expectedSignature = crypto.createHmac('sha256', SERVER_SECRET).update(payload).digest('hex');

    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
      return { valid: false };
    }

    // Se um telefone específico foi passado para verificação, garante correspondência exata
    if (expectedPhone) {
      const cleanExpected = expectedPhone.replace(/\D/g, '');
      if (cleanExpected !== phone) {
        return { valid: false };
      }
    }

    return { valid: true, phone, expired: false };
  } catch (e) {
    return { valid: false };
  }
}

// Armazenamento em memória simples para Rate Limiting
interface RateLimitRecord {
  count: number;
  resetAt: number;
}

const rateLimitStore = new Map<string, RateLimitRecord>();

// Limpeza periódica do cache de rate limit
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of rateLimitStore.entries()) {
    if (now > value.resetAt) {
      rateLimitStore.delete(key);
    }
  }
}, 60000);

/**
 * Rate Limiting simples e eficiente baseado em janela deslizante por IP ou identificador.
 * @param key Identificador (ex: `ip:192.168.1.1` ou `phone:71988887777`)
 * @param limit Número máximo de requisições permitidas
 * @param windowMs Duração da janela em milissegundos
 */
export function checkRateLimit(key: string, limit: number = 10, windowMs: number = 60000): { allowed: boolean; remaining: number; resetInSec: number } {
  const now = Date.now();
  const record = rateLimitStore.get(key);

  if (!record || now > record.resetAt) {
    rateLimitStore.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: limit - 1, resetInSec: Math.ceil(windowMs / 1000) };
  }

  if (record.count >= limit) {
    const resetInSec = Math.max(1, Math.ceil((record.resetAt - now) / 1000));
    return { allowed: false, remaining: 0, resetInSec };
  }

  record.count++;
  const resetInSec = Math.max(1, Math.ceil((record.resetAt - now) / 1000));
  return { allowed: true, remaining: limit - record.count, resetInSec };
}

/**
 * Proteção Honeypot: Se bots preencherem campos ocultos, identifica como automação maliciosa.
 */
export function isBotSubmission(body: Record<string, any>): boolean {
  if (!body || typeof body !== 'object') return false;
  // Campos armadilha típicos que humanos não preenchem
  const honeypotFields = ['_hp_check', 'website_url', 'b_hp_field', 'address2_hidden'];
  for (const field of honeypotFields) {
    if (body[field] && typeof body[field] === 'string' && body[field].trim().length > 0) {
      return true;
    }
  }
  return false;
}

/**
 * Sanitização e validação de strings contra XSS e injeções
 */
export function sanitizeString(input: any, maxLength: number = 255): string {
  if (!input || typeof input !== 'string') return '';
  return input
    .trim()
    .replace(/[<>]/g, '') // remove tags básicas
    .slice(0, maxLength);
}
