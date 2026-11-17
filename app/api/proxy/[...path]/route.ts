import { NextRequest, NextResponse } from 'next/server';

// API_INTERNAL_URL dipakai untuk server-to-server request dalam Docker network
// NEXT_PUBLIC_API_URL sebagai fallback (external domain, bisa kena DNS/SSL issue dari dalam container)
const API_BASE_URL = process.env.API_INTERNAL_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';

// Headers that should not be forwarded to avoid connection issues
const EXCLUDED_HEADERS = new Set([
  'host',
  'connection',
  'upgrade',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailers',
  'transfer-encoding',
  'content-length', // Let fetch handle this automatically
]);

function getCleanHeaders(sourceHeaders: Headers): Record<string, string> {
  const cleanHeaders: Record<string, string> = {};
  
  sourceHeaders.forEach((value, key) => {
    if (!EXCLUDED_HEADERS.has(key.toLowerCase())) {
      cleanHeaders[key] = value;
    }
  });
  
  return cleanHeaders;
}

function extractTargetPath(request: NextRequest): string {
  const fullPath = request.nextUrl.pathname;
  const proxyPrefix = '/api/proxy/';
  
  if (fullPath.startsWith(proxyPrefix)) {
    return fullPath.slice(proxyPrefix.length);
  }
  
  return '';
}

async function handleProxyRequest(request: NextRequest, method: string) {
  try {
    const targetPath = extractTargetPath(request);
    
    if (!targetPath) {
      return NextResponse.json(
        { error: 'Invalid proxy path' }, 
        { status: 400 }
      );
    }

    const searchParams = request.nextUrl.searchParams.toString();
    const targetUrl = `${API_BASE_URL}/${targetPath}${searchParams ? `?${searchParams}` : ''}`;
    
    console.log(`Proxying ${method} request to: ${targetUrl}`);

    // Get clean headers
    const headers = getCleanHeaders(request.headers);
    
    // Handle request body for non-GET requests
    let body: string | FormData | undefined = undefined;
    
    if (method !== 'GET' && method !== 'HEAD') {
      const contentType = request.headers.get('content-type') || '';
      
      if (contentType.includes('application/json')) {
        body = await request.text();
      } else if (contentType.includes('multipart/form-data')) {
        body = await request.formData();
      } else if (contentType.includes('application/x-www-form-urlencoded')) {
        body = await request.text();
      } else {
        body = await request.text();
      }
    }

    // Create abort controller for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
    }, 30000);

    try {
      const response = await fetch(targetUrl, {
        method,
        headers,
        body,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // Handle response
      const responseContentType = response.headers.get('content-type') || '';
      let responseData;

      if (responseContentType.includes('application/json')) {
        responseData = await response.json();
      } else {
        responseData = await response.text();
      }

      return NextResponse.json(responseData, {
        status: response.status,
        statusText: response.statusText,
      });

    } catch (fetchError) {
      clearTimeout(timeoutId);
      throw fetchError;
    }

  } catch (error) {
    console.error(`Proxy ${method} error:`, error);
    
    // Handle timeout errors
    if (error instanceof Error && error.name === 'AbortError') {
      return NextResponse.json(
        { error: 'Request timeout' },
        { status: 504 }
      );
    }

    // Handle other errors
    return NextResponse.json(
      { 
        error: 'Proxy request failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  return handleProxyRequest(request, 'GET');
}

export async function POST(request: NextRequest) {
  return handleProxyRequest(request, 'POST');
}

export async function PUT(request: NextRequest) {
  return handleProxyRequest(request, 'PUT');
}

export async function DELETE(request: NextRequest) {
  return handleProxyRequest(request, 'DELETE');
}

export async function PATCH(request: NextRequest) {
  return handleProxyRequest(request, 'PATCH');
}