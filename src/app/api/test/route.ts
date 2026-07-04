import { NextResponse } from 'next/server';
import { BlingProvider } from '@/lib/infrastructure/providers/BlingProvider';

export async function GET() {
  const bling = new BlingProvider('d948b6cc-cc2c-4399-8525-02f17f281d38');
  try {
    const order = await bling.getOrderById('13919');
    return NextResponse.json({ order });
  } catch (e) {
    return NextResponse.json({ error: String(e) });
  }
}
