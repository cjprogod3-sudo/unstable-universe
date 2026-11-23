const YT = 'https://www.googleapis.com/youtube/v3';
export async function handleComments(request, env) {
  const videoId = new URL(request.url).searchParams.get('videoId');
  if (!videoId) return Response.json({error:'videoId is required.'},{status:400});
  if (!env.YOUTUBE_API_KEY) return Response.json({error:'YouTube API key is not configured.'},{status:503});
  try {
    const u = new URL(`${YT}/commentThreads`); u.search = new URLSearchParams({part:'snippet',videoId,maxResults:'8',order:'relevance',textFormat:'plainText',key:env.YOUTUBE_API_KEY});
    const data = await fetch(u).then(r => r.ok ? r.json() : Promise.reject(new Error(r.status === 403 ? 'Comments are disabled or unavailable.' : `YouTube comments request failed (${r.status})`)));
    return Response.json({comments:data.items.map(x => {const s=x.snippet.topLevelComment.snippet;return {author:s.authorDisplayName,text:s.textDisplay,publishedAt:new Date(s.publishedAt).toLocaleDateString(),likes:s.likeCount}})});
  } catch (error) { return Response.json({error:error.message || 'Comments refresh failed.'},{status:502}); }
}

export const onRequestGet = ({request, env}) => handleComments(request, env);
