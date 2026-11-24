import { handleCatalog } from './functions/api/catalog.js';
import { handleComments } from './functions/api/comments.js';
import { handleAccount } from './functions/api/account.js';
import { handleSite, checkForNewUploads } from './functions/api/site.js';
import { handleLibrary } from './functions/api/library.js';
import { handleMoments, indexMoments } from './functions/api/moments.js';

export default {
  async fetch(request, env, ctx) {
    const path = new URL(request.url).pathname;
    if (path === '/api/catalog') return handleCatalog(request, env);
    if (path === '/api/comments') return handleComments(request, env);
    if (path === '/api/account' || path.startsWith('/api/account/')) return handleAccount(request, env);
    if (path === '/api/library' || path.startsWith('/api/library/') || path.startsWith('/api/admin/library/') || path === '/api/admin/wiki') return handleLibrary(request, env);
    if (path === '/api/moments' || path === '/api/video') return handleMoments(request, env);
    if (path === '/api/site' || path.startsWith('/api/push/') || path.startsWith('/api/admin/')) return handleSite(request, env, ctx);
    const asset = await env.ASSETS.fetch(request);
    if (path === '/' || path === '/index.html' || path === '/app.js' || path === '/library.js' || path === '/styles.css' || path === '/sw.js' || path === '/manifest.webmanifest') {
      const headers = new Headers(asset.headers);
      headers.set('Cache-Control', 'no-store, max-age=0');
      return new Response(asset.body, {status: asset.status, statusText: asset.statusText, headers});
    }
    return asset;
  },
  // Runs on the cron in wrangler.toml: looks for new playlist uploads and sends notifications.
  // Free plan: 50 outbound requests per run. The playlist check uses ~8 plus one per
  // alert subscriber, so the remaining work (moments) only runs when
  // no alerts went out, and each takes a bounded slice.
  async scheduled(event, env, ctx) {
    ctx.waitUntil((async () => {
      let check = {};
      try { check = await checkForNewUploads(env); } catch (error) { console.error('upload check failed', error); }
      if (!env.DB || (check.sent || 0) > 0) return;
      try {
        // The Library is imported from the admin's browser (see dist/library.js).
        if (check.videos) await indexMoments(env, check.videos, 25);
      } catch (error) { console.error('background job failed', error); }
    })());
  },
};
