import { NextRequest, NextResponse } from 'next/server';

// Define routes that require authentication
const protectedApiRoutes = [
  '/api/cart',
];

// Define routes that are public (excluded from auth check)
const publicApiRoutes = [
  '/api/cart/recommendations',
];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Check if this is a public API route first
  const isPublicRoute = publicApiRoutes.some(route =>
    pathname.startsWith(route)
  );
  if (isPublicRoute) {
    return NextResponse.next();
  }

  // Check if this is an API route that requires authentication
  const isProtectedApiRoute = protectedApiRoutes.some(route => 
    pathname.startsWith(route)
  );

  if (isProtectedApiRoute) {
    // Get the authorization header
    const token = request.headers.get('authorization');
    
    // If no token or doesn't start with Bearer, return 401
    if (!token || !token.startsWith('Bearer ')) {
      return NextResponse.json(
        { message: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    // Continue to the API route with the token
    return NextResponse.next();
  }
  
  // For non-API routes or unprotected routes, just pass through
  return NextResponse.next();
}

// Configure which routes the middleware runs on
export const config = {
  matcher: [
    '/api/:path*',
  ],
}; 