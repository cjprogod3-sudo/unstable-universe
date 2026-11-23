import { handleCatalog } from './functions/api/catalog.js';
import { handleComments } from './functions/api/comments.js';
import { handleAccount } from './functions/api/account.js';
import { handleSite, checkForNewUploads } from './functions/api/site.js';

export default {
  async fetch(request, env, ctx) {
    const path = new URL(request.url).pathname;
    if (path === '/api/catalog') return handleCatalog(request, env);
    if (path === '/api/comments') return handleComments(request, env);
    if (path === '/api/account' || path.startsWith('/api/account/')) return handleAccount(request, env);
    if (path === '/api/site' || path.startsWith('/api/push/') || path.startsWith('/api/admin/')) return handleSite(request, env, ctx);
    const asset = await env.ASSETS.fetch(request);
    if (path === '/' || path === '/index.html' || path === '/app.js' || path === '/styles.css' || path === '/sw.js' || path === '/manifest.webmanifest') {
      const headers = new Headers(asset.headers);
      headers.set('Cache-Control', 'no-store, max-age=0');
      return new Response(asset.body, {status: asset.status, statusText: asset.statusText, headers});
    }
    return asset;
  },
  // Runs on the cron in wrangler.toml: looks for new playlist uploads and sends notifications.
  async scheduled(event, env, ctx) {
    ctx.waitUntil(checkForNewUploads(env).catch(error => console.error('upload check failed', error)));
  },
};
