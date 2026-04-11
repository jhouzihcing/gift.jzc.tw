import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export default function proxy(request: NextRequest) {
  // A simple mechanism: redirect logic could be placed here if needed.
  // For Firebase, Auth state usually lives on the client side,
  // but if we use a session cookie we could verify it here.
  
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|manifest.json|icons).*)'],
};
