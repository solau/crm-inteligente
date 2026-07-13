import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const sellers = [
    { email: 'harley@alphabull.com', password: 'password123', name: 'Harley', username: 'Harley' },
    { email: 'alane@alphabull.com', password: 'password123', name: 'Alane', username: 'Alane' },
    { email: 'ycla@alphabull.com', password: 'password123', name: 'Ycla', username: 'Ycla' },
    { email: 'jorge@alphabull.com', password: 'password123', name: 'Jorge', username: 'Jorge', role: 'admin' }
  ];

  const results = [];

  const { data: tenants } = await supabase.from('tenants').select('id').limit(1);
  if (!tenants || tenants.length === 0) {
    return NextResponse.json({ error: 'Nenhum tenant encontrado.' });
  }
  const tenantId = tenants[0].id;

  for (const s of sellers) {
    const { data: user, error: authError } = await supabase.auth.admin.createUser({
      email: s.email,
      password: s.password,
      email_confirm: true
    });

    if (authError && !authError.message.includes('already registered')) {
      results.push({ name: s.name, error: authError.message });
      continue;
    }

    let userId = user?.user?.id;
    
    // Se o usuário já existia, busca o id dele
    if (!userId) {
      const { data: existingUser } = await supabase.auth.admin.listUsers();
      const match = existingUser.users.find(u => u.email === s.email);
      if (match) {
        userId = match.id;
      }
    }
    
    if (userId) {
      // Tenta inserir no profile (ignorando se já existir via ON CONFLICT ou apenas pegando o erro)
      const { error: profileError } = await supabase.from('user_profiles').insert({
        id: userId,
        tenant_id: tenantId,
        name: s.name,
        role: s.role || 'vendedor'
      });

      results.push({ name: s.name, id: userId, profileCreated: !profileError });
    }
  }

  return NextResponse.json(results);
}
