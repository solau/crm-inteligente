import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const sessionCookie = request.cookies.get('session');
  
  const isLoginPage = request.nextUrl.pathname === '/login';
  
  if (!sessionCookie && !isLoginPage && !request.nextUrl.pathname.startsWith('/api/')) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  if (sessionCookie) {
    try {
      const decoded = Buffer.from(sessionCookie.value, 'base64').toString('utf-8');
      const session = JSON.parse(decoded);
      
      // Se for vendedor, bloquear rotas específicas
      if (session.role === 'VENDEDOR') {
        const path = request.nextUrl.pathname;
        // Vendedores só podem acessar /vendedor/kanban, /clientes e /clientes/[id]
        if (
          !path.startsWith('/vendedor/kanban') && 
          !path.startsWith('/clientes') &&
          !path.startsWith('/api/')
        ) {
          return NextResponse.redirect(new URL('/vendedor/kanban', request.url));
        }
      }

      // Redireciona login para a home dependendo do role se já logado
      if (isLoginPage) {
        if (session.role === 'ADMIN') {
          return NextResponse.redirect(new URL('/', request.url));
        } else {
          return NextResponse.redirect(new URL('/vendedor/kanban', request.url));
        }
      }
    } catch (e) {
      if (!isLoginPage) {
        return NextResponse.redirect(new URL('/login', request.url));
      }
    }
  }
  
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
