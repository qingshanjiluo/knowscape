// Cloudflare Pages Function: 代理 /api/v1/* 到 Workers API
const WORKER_URL = 'https://knowscape-api.sifangzhiji.workers.dev';

export const onRequest: PagesFunction = async (context) => {
  const { request } = context;
  const url = new URL(request.url);
  const workerUrl = WORKER_URL + url.pathname + url.search;
  
  // 复制原始请求头，添加 CORS 头
  const headers = new Headers(request.headers);
  
  // 转发请求到 Worker
  const response = await fetch(workerUrl, {
    method: request.method,
    headers: headers,
    body: request.method !== 'GET' && request.method !== 'HEAD' ? request.body : undefined,
  });

  // 复制响应并添加 CORS 头
  const respHeaders = new Headers(response.headers);
  respHeaders.set('Access-Control-Allow-Origin', '*');
  respHeaders.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  respHeaders.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: respHeaders,
  });
};
