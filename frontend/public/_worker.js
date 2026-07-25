const WORKER_URL = 'https://knowscape-api.sifangzhiji.workers.dev';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname.startsWith('/api/')) {
      const workerUrl = `${WORKER_URL}${url.pathname}${url.search}`;
      const proxyHeaders = new Headers(request.headers);
      const proxyRequest = new Request(workerUrl, {
        method: request.method,
        headers: proxyHeaders,
        body: ['GET', 'HEAD'].includes(request.method) ? null : request.body,
      });
      try {
        return await fetch(proxyRequest);
      } catch (e) {
        return new Response(JSON.stringify({ success: false, message: 'API unavailable' }), {
          status: 502,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }
    try {
      return await env.ASSETS.fetch(request);
    } catch (e) {
      return new Response('Not Found', { status: 404 });
    }
  },
};
