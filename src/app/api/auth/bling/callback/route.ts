import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
// Importação simulada do SDK oficial, assumindo 'bling-erp-api'
// import Bling from 'bling-erp-api';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state'); // No mundo real, enviamos o tenant_id no state
  
  if (!code) {
    return NextResponse.json({ error: 'Authorization code is missing' }, { status: 400 });
  }

  // O "state" será o tenantId que iniciou a requisição
  const tenantId = state || 'd948b6cc-cc2c-4399-8525-02f17f281d38'; // Fallback para dev

  const clientId = process.env.BLING_CLIENT_ID;
  const clientSecret = process.env.BLING_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return NextResponse.json({ error: 'Bling credentials missing on server.' }, { status: 500 });
  }

  try {
    const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    
    // Troca o código pelo Token Real do Bling via API oficial
    const response = await fetch('https://www.bling.com.br/Api/v3/oauth/token', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': '1.0'
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: code
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Bling OAuth Exchange falhou:', errorText);
      throw new Error(`Bling retornou status ${response.status}`);
    }

    const authResponse = await response.json();


    const expiresAt = new Date();
    expiresAt.setSeconds(expiresAt.getSeconds() + authResponse.expires_in);

    // Salvar no banco (Upsert)
    const { error } = await supabaseAdmin.from('bling_credentials').upsert({
      tenant_id: tenantId,
      access_token: authResponse.access_token,
      refresh_token: authResponse.refresh_token,
      expires_at: expiresAt.toISOString()
    });

    if (error) {
      console.error('Supabase DB Error:', error);
      return NextResponse.json({ error: 'Failed to save credentials' }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: 'Bling conectado com sucesso à sua Loja!' });

  } catch (error) {
    console.error('Bling OAuth Error:', error);
    return NextResponse.json({ error: 'Failed to authenticate with Bling' }, { status: 500 });
  }
}
