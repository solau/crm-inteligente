import { NextResponse } from 'next/server';

export function corsHeaders(origin?: string | null) {
  const allowedOrigins = [
    'https://churrascosalvador.com',
    'https://www.churrascosalvador.com',
    'http://localhost:3000',
    'http://localhost:5173'
  ];

  let allowOrigin = '*';
  if (origin && allowedOrigins.includes(origin)) {
    allowOrigin = origin;
  }

  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS, PATCH',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
    'Access-Control-Max-Age': '86400',
  };
}

export function handleCorsPreflight(request: Request) {
  const origin = request.headers.get('origin');
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders(origin),
  });
}
