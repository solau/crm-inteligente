import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET() {
  await supabaseAdmin.from('deals').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabaseAdmin.from('cashback_ledger').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  const { error } = await supabaseAdmin.from('clients').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  if (error) return NextResponse.json({ error: error.message });
  return NextResponse.json({ message: 'Limpeza concluída com sucesso!' });
}
