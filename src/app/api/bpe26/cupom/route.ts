import { NextResponse } from 'next/server';
import { CouponRepository } from '@/lib/infrastructure/repositories/CouponRepository';
import { corsHeaders, handleCorsPreflight } from '@/lib/utils/cors';
import { verifyParticipantToken, checkRateLimit } from '@/lib/utils/security';

export async function OPTIONS(request: Request) {
  return handleCorsPreflight(request);
}

export async function GET(request: Request) {
  const origin = request.headers.get('origin');
  const clientIp = request.headers.get('x-forwarded-for')?.split(',')[0] || request.headers.get('x-real-ip') || 'unknown';

  // 1. Rate Limiting de proteção (máximo 10 requisições por minuto por IP)
  const rl = checkRateLimit(`cupom:${clientIp}`, 10, 60000);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: `Muitas tentativas. Aguarde ${rl.resetInSec} segundos antes de tentar novamente.` },
      { status: 429, headers: corsHeaders(origin) }
    );
  }

  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code')?.trim();
    const phone = searchParams.get('phone')?.trim();
    
    // Token enviado por Query Param ou por Header Authorization: Bearer <token>
    const authHeader = request.headers.get('authorization');
    const headerToken = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;
    const token = searchParams.get('token')?.trim() || headerToken;

    if (!code && !phone) {
      return NextResponse.json(
        { error: 'Informe o código do cupom (code) ou o telefone verificado com token.' },
        { status: 400, headers: corsHeaders(origin) }
      );
    }

    const repo = new CouponRepository();

    // Cenário A: Consulta direta por código único do cupom (validação pública de compra/checkout)
    if (code) {
      const coupon = await repo.getCouponByCode(code);
      if (!coupon) {
        return NextResponse.json(
          { success: false, message: 'Cupom inválido ou inexistente.' },
          { status: 404, headers: corsHeaders(origin) }
        );
      }

      // Retorna apenas dados de validação comercial (SEM expor dados do participante)
      return NextResponse.json(
        {
          success: true,
          data: {
            code: coupon.code,
            discount_percent: coupon.discount_percent,
            status: coupon.status,
            expires_at: coupon.expires_at,
            restrictions: coupon.restrictions
          }
        },
        { headers: corsHeaders(origin) }
      );
    }

    // Cenário B: Consulta por telefone -> EXIGE TOKEN DE SEGURANÇA HMAC DO PARTICIPANTE
    if (phone) {
      const cleanPhone = phone.replace(/\D/g, '');
      if (cleanPhone.length < 10) {
        return NextResponse.json(
          { error: 'Telefone inválido para consulta.' },
          { status: 400, headers: corsHeaders(origin) }
        );
      }

      if (!token) {
        return NextResponse.json(
          { 
            error: 'Acesso restrito. Para consultar cupom por telefone, é obrigatório fornecer o token de verificação emitido ao concluir o quiz, ou consulte diretamente pelo código do cupom.',
            requires_auth: true
          },
          { status: 401, headers: corsHeaders(origin) }
        );
      }

      // Validação criptográfica do token
      const tokenVerification = verifyParticipantToken(token, cleanPhone);
      if (!tokenVerification.valid) {
        return NextResponse.json(
          { 
            error: tokenVerification.expired 
              ? 'Token de participante expirado. Por favor, acesse novamente o quiz para renovar seu acesso.' 
              : 'Token de participante inválido para o telefone informado.',
            requires_auth: true
          },
          { status: 403, headers: corsHeaders(origin) }
        );
      }

      // Token válido: recupera o cupom ativo com segurança total
      const coupon = await repo.getActiveCouponByPhone(cleanPhone, 'BPE26');
      if (!coupon) {
        return NextResponse.json(
          { success: false, message: 'Nenhum cupom ativo encontrado para este participante.' },
          { status: 404, headers: corsHeaders(origin) }
        );
      }

      return NextResponse.json(
        {
          success: true,
          data: {
            code: coupon.code,
            discount_percent: coupon.discount_percent,
            status: coupon.status,
            expires_at: coupon.expires_at,
            restrictions: coupon.restrictions
          }
        },
        { headers: corsHeaders(origin) }
      );
    }

    return NextResponse.json(
      { error: 'Parâmetros insuficientes para consulta.' },
      { status: 400, headers: corsHeaders(origin) }
    );
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Erro ao consultar cupom.' },
      { status: 500, headers: corsHeaders(origin) }
    );
  }
}
