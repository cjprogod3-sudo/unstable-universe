import { handleCatalog } from './functions/api/catalog.js';
import { handleComments } from './functions/api/comments.js';

export default {
  async fetch(request, env) {
    const path = new URL(request.url).pathname;
    if (path === '/api/catalog') return handleCatalog(request, env);
    if (path === '/api/comments') return handleComments(request, env);
    return env.ASSETS.fetch(request);
  },
};
