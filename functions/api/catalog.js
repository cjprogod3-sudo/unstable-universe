const YT = 'https://www.googleapis.com/youtube/v3';

const duration = value => {
  const m = value.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/), h = Number(m?.[1] || 0), min = Number(m?.[2] || 0), sec = Number(m?.[3] || 0);
  return h ? `${h}:${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}` : `${min}:${String(sec).padStart(2, '0')}`;
};
const ago = iso => {
  const d = Math.max(1, Math.floor((Date.now() - new Date(iso)) / 86400000));
  return d < 30 ? `${d} days ago` : d < 365 ? `${Math.floor(d / 30)} months ago` : `${Math.floor(d / 365)} years ago`;
};
const format = n => new Intl.NumberFormat('en', {notation: 'compact', maximumFractionDigits: 1}).format(Number(n || 0));
const creator = title => /wemmbu/i.test(title) ? 'Wemmbu' : /parrot/i.test(title) ? 'Parrot' : /spoke/i.test(title) ? 'Spoke' : /flamefrags/i.test(title) ? 'FlameFrags' : title;

export async function onRequestGet({request, env}) {
  const playlistId = new URL(request.url).searchParams.get('playlistId');
  if (!playlistId) return Response.json({error: 'playlistId is required.'}, {status: 400});
  if (!env.YOUTUBE_API_KEY) return Response.json({error: 'YouTube API key is not configured.'}, {status: 503});
  const cacheKey = new Request(new URL(request.url));
  const cached = await caches.default.match(cacheKey);
  if (cached) return cached;
  try {
    let pageToken = '', items = [];
    do {
      const u = new URL(`${YT}/playlistItems`);
      u.search = new URLSearchParams({part: 'snippet,contentDetails', playlistId, maxResults: '50', pageToken, key: env.YOUTUBE_API_KEY});
      const page = await fetch(u).then(r => r.ok ? r.json() : Promise.reject(new Error(`YouTube playlist request failed (${r.status})`)));
      items.push(...page.items.filter(x => x.contentDetails?.videoId)); pageToken = page.nextPageToken || '';
    } while (pageToken);
    const detail = new Map();
    for (let i = 0; i < items.length; i += 50) {
      const u = new URL(`${YT}/videos`); u.search = new URLSearchParams({part: 'snippet,contentDetails,statistics', id: items.slice(i, i + 50).map(x => x.contentDetails.videoId).join(','), key: env.YOUTUBE_API_KEY});
      const result = await fetch(u).then(r => r.ok ? r.json() : Promise.reject(new Error(`YouTube video request failed (${r.status})`)));
      result.items.forEach(x => detail.set(x.id, x));
    }
    const videos = items.map((entry, position) => {
      const x = detail.get(entry.contentDetails.videoId), s = x?.snippet || entry.snippet;
      return {id: entry.contentDetails.videoId, position: position + 1, title: s.title, creator: creator(s.channelTitle), channelTitle: s.channelTitle, date: new Date(s.publishedAt).toLocaleDateString('en-US', {year:'numeric',month:'short',day:'numeric'}), ago: ago(s.publishedAt), length: duration(x?.contentDetails?.duration || 'PT0S'), views: format(x?.statistics?.viewCount), description: (s.description || '').slice(0, 260), thumbnail: s.thumbnails?.high?.url || s.thumbnails?.medium?.url || '', official: true};
    });
    const response = Response.json({videos, refreshedAt: new Date().toISOString()}, {headers: {'Cache-Control': 'public, max-age=600'}});
    await caches.default.put(cacheKey, response.clone()); return response;
  } catch (error) { return Response.json({error: error.message || 'Catalog refresh failed.'}, {status: 502}); }
}
