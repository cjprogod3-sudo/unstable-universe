import { handleCatalog } from './functions/api/catalog.js';
import { handleComments } from './functions/api/comments.js';

export default {
  async fetch(request, env) {
    const path = new URL(request.url).pathname;
    if (path === '/api/catalog') return handleCatalog(request, env);
    if (path === '/api/comments') return handleComments(request, env);
    const asset = await env.ASSETS.fetch(request);
    if (path === '/' || path === '/index.html' || path === '/app.js' || path === '/styles.css') {
      const headers = new Headers(asset.headers);
      headers.set('Cache-Control', 'no-store, max-age=0');
      return new Response(asset.body, {status: asset.status, statusText: asset.statusText, headers});
    }
    return asset;
  },
};
