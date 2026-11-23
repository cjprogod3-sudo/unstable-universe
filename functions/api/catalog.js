const YT = 'https://www.googleapis.com/youtube/v3';
const PLAYLIST_ID = 'PLzdPgQvHT2bpN6XE_i_SnTErvBtKycHwg';

const formatDuration = value => {
  const match = value.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  const hours = Number(match?.[1] || 0);
  const minutes = Number(match?.[2] || 0);
  const seconds = Number(match?.[3] || 0);
  return hours ? `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}` : `${minutes}:${String(seconds).padStart(2, '0')}`;
};
const timeAgo = iso => {
  const days = Math.max(1, Math.floor((Date.now() - new Date(iso)) / 86400000));
  return days < 30 ? `${days} days ago` : days < 365 ? `${Math.floor(days / 30)} months ago` : `${Math.floor(days / 365)} years ago`;
};
const creator = channel => /wemmbu/i.test(channel) ? 'Wemmbu' : /parrot/i.test(channel) ? 'Parrot' : /spoke/i.test(channel) ? 'Spoke' : /flamefrags/i.test(channel) ? 'FlameFrags' : channel;
const views = value => new Intl.NumberFormat('en', {notation: 'compact', maximumFractionDigits: 1}).format(Number(value || 0));

function response(body, status = 200) {
  return Response.json(body, {status, headers: {'Cache-Control': 'no-store'}});
}
async function youtube(path, parameters, key) {
  const url = new URL(`${YT}/${path}`);
  url.search = new URLSearchParams({...parameters, key});
  const result = await fetch(url);
  if (!result.ok) throw new Error(`YouTube ${path} request failed (${result.status})`);
  return result.json();
}

export async function handleCatalog(request, env) {
  if (!env.YOUTUBE_API_KEY) return response({error: 'YouTube API key is not configured.'}, 503);
  const url = new URL(request.url);
  try {
    if (url.searchParams.get('mode') === 'discover') {
      return response({sources: [{id: PLAYLIST_ID, title: 'Official Unstable Universe playlist'}], refreshedAt: new Date().toISOString()});
    }
    const playlistId = url.searchParams.get('playlistId');
    if (!playlistId) return response({error: 'playlistId is required.'}, 400);
    if (playlistId !== PLAYLIST_ID) return response({error: 'Only the official playlist is supported.'}, 400);
    const pageToken = url.searchParams.get('pageToken') || '';
    const page = await youtube('playlistItems', {part: 'snippet,contentDetails', playlistId, maxResults: '50', ...(pageToken ? {pageToken} : {})}, env.YOUTUBE_API_KEY);
    const entries = (page.items || []).filter(item => item.contentDetails?.videoId);
    const ids = entries.map(item => item.contentDetails.videoId);
    const details = ids.length ? await youtube('videos', {part: 'snippet,contentDetails,statistics', id: ids.join(',')}, env.YOUTUBE_API_KEY) : {items: []};
    const byId = new Map((details.items || []).map(item => [item.id, item]));
    const videos = entries.map((entry, index) => {
      const video = byId.get(entry.contentDetails.videoId);
      const snippet = video?.snippet || entry.snippet;
      return {
        id: entry.contentDetails.videoId,
        position: Number(entry.snippet?.position ?? index) + 1,
        title: snippet.title,
        creator: creator(snippet.channelTitle),
        channelTitle: snippet.channelTitle,
        publishedAt: snippet.publishedAt,
        date: new Date(snippet.publishedAt).toLocaleDateString('en-US', {year: 'numeric', month: 'short', day: 'numeric'}),
        ago: timeAgo(snippet.publishedAt),
        length: formatDuration(video?.contentDetails?.duration || 'PT0S'),
        views: views(video?.statistics?.viewCount),
        description: (snippet.description || '').slice(0, 260),
        thumbnail: snippet.thumbnails?.high?.url || snippet.thumbnails?.medium?.url || '',
        official: true,
        verified: true
      };
    });
    return response({videos, nextPageToken: page.nextPageToken || null, playlistId, refreshedAt: new Date().toISOString()});
  } catch (error) {
    return response({error: error.message || 'Catalog refresh failed.'}, 502);
  }
}

export const onRequestGet = ({request, env}) => handleCatalog(request, env);
