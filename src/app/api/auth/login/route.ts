import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';

const USERS = [
  { id: 'admin-1', username: 'Jorge', password: '270118', role: 'ADMIN', name: 'Jorge' },
  { id: 'vend-1', username: 'Alane', password: 'Alane', role: 'VENDEDOR', name: 'Alane' },
  { id: 'vend-2', username: 'Harley', password: 'Harley', role: 'VENDEDOR', name: 'Harley' },
  { id: 'vend-3', username: 'Ycla', password: 'Ycla', role: 'VENDEDOR', name: 'Ycla' },
];

export async function POST(request: Request) {
  try {
    const { username, password } = await request.json();

    const user = USERS.find(
      (u) => u.username.toLowerCase() === username.toLowerCase() && u.password === password
    );

    if (!user) {
      return NextResponse.json({ error: 'Credenciais inválidas' }, { status: 401 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    
    // Busca o UUID real do usuário no banco
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('id')
      .ilike('name', user.name)
      .limit(1)
      .single();

    const realUserId = profile?.id || user.id;

    // Cria os dados da sessão
    const sessionData = JSON.stringify({
      id: realUserId,
      username: user.username,
      name: user.name,
      role: user.role
    });

    // Encriptação real deveria ser usada, mas para MVP faremos Base64 básico
    const sessionEncoded = Buffer.from(sessionData).toString('base64');

    const cookieStore = await cookies();
    cookieStore.set('session', sessionEncoded, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7 // 1 semana
    });

    return NextResponse.json({ success: true, user: { name: user.name, role: user.role } });
  } catch (error) {
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
