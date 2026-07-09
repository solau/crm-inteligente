import { cookies } from 'next/headers';

export async function getSession() {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get('session');
  
  if (!sessionCookie) {
    return null;
  }

  try {
    const decoded = Buffer.from(sessionCookie.value, 'base64').toString('utf-8');
    return JSON.parse(decoded) as {
      id: string;
      username: string;
      name: string;
      role: 'ADMIN' | 'VENDEDOR';
    };
  } catch (e) {
    return null;
  }
}
