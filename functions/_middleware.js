/**
 * Cloudflare Pages Middleware Proxy
 * Routes API and redirection paths to the backend server on the VPS
 * Serves static React/Vite assets via Cloudflare Pages global CDN
 */

export async function onRequest(context) {
  const url = new URL(context.request.url);
  
  // List of paths that must be forwarded to the backend server
  const proxyPrefixes = ['/api', '/go', '/track', '/instagram', '/whatsapp'];
  const needsProxy = proxyPrefixes.some(prefix => 
    url.pathname === prefix || url.pathname.startsWith(prefix + '/')
  );
  
  if (!needsProxy) {
    // Serve static frontend assets (HTML, JS, CSS, images, PWA manifests)
    return context.next();
  }

  // Handle CORS preflight OPTIONS request immediately at the edge
  if (context.request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS, PATCH',
        'Access-Control-Allow-Headers': '*',
        'Access-Control-Max-Age': '86400',
      }
    });
  }

  const backendHost = context.env.BACKEND_URL || 'https://api.bhashyamramakrishna.in';
  const targetUrl = new URL(url.pathname + url.search, backendHost);

  const requestHeaders = new Headers(context.request.headers);
  requestHeaders.set('Host', new URL(backendHost).host);

  const modifiedRequest = new Request(targetUrl.toString(), {
    method: context.request.method,
    headers: requestHeaders,
    body: ['GET', 'HEAD'].includes(context.request.method) ? undefined : context.request.body,
    redirect: 'follow'
  });

  try {
    const response = await fetch(modifiedRequest);
    const responseHeaders = new Headers(response.headers);
    responseHeaders.set('Access-Control-Allow-Origin', '*');
    responseHeaders.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
    responseHeaders.set('Access-Control-Allow-Headers', '*');

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders
    });
  } catch (err) {
    return new Response(JSON.stringify({ 
      error: 'Backend gateway proxy error', 
      message: err.message,
      target: targetUrl.toString()
    }), {
      status: 502,
      headers: { 
        'Content-Type': 'application/json', 
        'Access-Control-Allow-Origin': '*' 
      }
    });
  }
}
